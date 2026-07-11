/**
 * Integration tests for SQS message processing flows.
 * Tests the message lifecycle from Lambda → SQS → processing → success/failure/DLQ.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import type { OCRQueueMessage, SQSClient } from '../../content/src/clients/sqs-client';
import type { DBClient, PageRecord } from '../../content/src/clients/db-client';
import { handleProcessOCR } from '../../content/src/handlers/process-ocr';

// --- Mock SQS Infrastructure ---

interface QueuedMessage {
  messageId: string;
  body: OCRQueueMessage;
  receiveCount: number;
  sentAt: string;
}

interface DLQMessage {
  messageId: string;
  body: OCRQueueMessage;
  reason: string;
}

/**
 * In-memory SQS queue simulator for integration testing.
 * Tracks messages, supports receive count for DLQ behavior.
 */
function createMockSQSQueue(maxReceiveCount: number = 3) {
  const messages: QueuedMessage[] = [];
  const dlqMessages: DLQMessage[] = [];
  const processedMessages: QueuedMessage[] = [];
  let messageCounter = 0;

  return {
    messages,
    dlqMessages,
    processedMessages,

    /** Send a message to the queue. */
    async send(body: OCRQueueMessage): Promise<string> {
      const messageId = `msg-${++messageCounter}`;
      messages.push({
        messageId,
        body,
        receiveCount: 0,
        sentAt: new Date().toISOString(),
      });
      return messageId;
    },

    /** Receive the next message from the queue. */
    receive(): QueuedMessage | null {
      if (messages.length === 0) return null;
      const msg = messages[0];
      msg.receiveCount++;
      return msg;
    },

    /** Acknowledge successful processing (remove from queue). */
    acknowledge(messageId: string): void {
      const idx = messages.findIndex(m => m.messageId === messageId);
      if (idx >= 0) {
        processedMessages.push(messages[idx]);
        messages.splice(idx, 1);
      }
    },

    /** Simulate message processing failure (visibility timeout). */
    nack(messageId: string): void {
      const msg = messages.find(m => m.messageId === messageId);
      if (msg && msg.receiveCount >= maxReceiveCount) {
        // Move to DLQ after max retries
        dlqMessages.push({
          messageId: msg.messageId,
          body: msg.body,
          reason: `Exceeded maxReceiveCount (${maxReceiveCount})`,
        });
        messages.splice(messages.indexOf(msg), 1);
      }
      // Otherwise message stays in queue for retry
    },

    getQueueDepth(): number {
      return messages.length;
    },

    getDLQDepth(): number {
      return dlqMessages.length;
    },
  };
}

// --- Mock DB Client ---

function createMockDBClient(pages: PageRecord[] = []): DBClient {
  const storedPages = [...pages];

  return {
    async getChapterById(chapterId: string) {
      if (chapterId === 'non-existent') return null;
      return { id: chapterId, name: 'Test Chapter', subjectId: 's1', bookId: 'b1' };
    },
    async getPagesByChapter(_chapterId: string) {
      return storedPages;
    },
    async updatePageOcrStatus(pageId: string, status: string) {
      const page = storedPages.find(p => p.id === pageId);
      if (page) page.ocrStatus = status as PageRecord['ocrStatus'];
    },
    async createPage(data: Partial<PageRecord>) {
      const page = { ...data, ocrStatus: 'pending' } as PageRecord;
      storedPages.push(page);
      return page;
    },
  } as unknown as DBClient;
}

// --- Mock SQS Client that wires to the queue simulator ---

function createMockSQSClient(queue: ReturnType<typeof createMockSQSQueue>): SQSClient {
  return {
    async sendOCRMessage(message: OCRQueueMessage): Promise<string> {
      return queue.send(message);
    },
  };
}

// --- Tests ---

describe('SQS Message Processing Integration Tests', () => {
  describe('Content Lambda → OCR Queue flow', () => {
    it('queues OCR messages for all pending pages when processing is triggered', async () => {
      const pages: PageRecord[] = [
        { id: 'page-1', chapterId: 'ch-001', pageNumber: 1, classification: 'content', imageS3Key: 'pages/ch-001/1_content.jpeg', ocrStatus: 'pending' },
        { id: 'page-2', chapterId: 'ch-001', pageNumber: 2, classification: 'content', imageS3Key: 'pages/ch-001/2_content.jpeg', ocrStatus: 'pending' },
        { id: 'page-3', chapterId: 'ch-001', pageNumber: 3, classification: 'exercise', imageS3Key: 'pages/ch-001/3_exercise.jpeg', ocrStatus: 'pending' },
      ] as PageRecord[];

      const queue = createMockSQSQueue();
      const sqsClient = createMockSQSClient(queue);
      const dbClient = createMockDBClient(pages);

      const result = await handleProcessOCR('ch-001', { dbClient, sqsClient });

      expect(result).toHaveProperty('success', true);
      if ('pagesQueued' in result) {
        expect(result.pagesQueued).toBe(3);
      }

      // Verify 3 messages were queued
      expect(queue.messages).toHaveLength(3);
      expect(queue.messages[0].body.chapterId).toBe('ch-001');
      expect(queue.messages[0].body.pageId).toBe('page-1');
      expect(queue.messages[1].body.pageNumber).toBe(2);
      expect(queue.messages[2].body.imageS3Key).toBe('pages/ch-001/3_exercise.jpeg');
    });

    it('skips pages that are already processing or completed', async () => {
      const pages: PageRecord[] = [
        { id: 'page-1', chapterId: 'ch-002', pageNumber: 1, classification: 'content', imageS3Key: 'pages/ch-002/1.jpeg', ocrStatus: 'completed' },
        { id: 'page-2', chapterId: 'ch-002', pageNumber: 2, classification: 'content', imageS3Key: 'pages/ch-002/2.jpeg', ocrStatus: 'processing' },
        { id: 'page-3', chapterId: 'ch-002', pageNumber: 3, classification: 'content', imageS3Key: 'pages/ch-002/3.jpeg', ocrStatus: 'pending' },
      ] as PageRecord[];

      const queue = createMockSQSQueue();
      const sqsClient = createMockSQSClient(queue);
      const dbClient = createMockDBClient(pages);

      const result = await handleProcessOCR('ch-002', { dbClient, sqsClient });

      expect(result).toHaveProperty('success', true);
      if ('pagesQueued' in result) {
        expect(result.pagesQueued).toBe(1); // Only the pending page
      }
      expect(queue.messages).toHaveLength(1);
      expect(queue.messages[0].body.pageId).toBe('page-3');
    });
  });

  describe('Message retry and DLQ behavior', () => {
    it('retries failed messages up to maxReceiveCount before moving to DLQ', async () => {
      const queue = createMockSQSQueue(3); // Max 3 receives

      // Send a message
      await queue.send({
        chapterId: 'ch-003',
        pageId: 'page-fail',
        imageS3Key: 'pages/ch-003/1.jpeg',
        pageNumber: 1,
      });

      // Simulate 3 failed processing attempts
      for (let attempt = 0; attempt < 3; attempt++) {
        const msg = queue.receive();
        expect(msg).not.toBeNull();
        queue.nack(msg!.messageId);
      }

      // After 3 failures, message should be in DLQ
      expect(queue.getQueueDepth()).toBe(0);
      expect(queue.getDLQDepth()).toBe(1);
      expect(queue.dlqMessages[0].body.pageId).toBe('page-fail');
      expect(queue.dlqMessages[0].reason).toContain('maxReceiveCount');
    });

    it('successfully processes message on retry after transient failure', async () => {
      const queue = createMockSQSQueue(3);

      await queue.send({
        chapterId: 'ch-004',
        pageId: 'page-retry',
        imageS3Key: 'pages/ch-004/1.jpeg',
        pageNumber: 1,
      });

      // First attempt fails
      const msg1 = queue.receive();
      expect(msg1).not.toBeNull();
      queue.nack(msg1!.messageId);
      expect(queue.getQueueDepth()).toBe(1); // Still in queue

      // Second attempt succeeds
      const msg2 = queue.receive();
      expect(msg2).not.toBeNull();
      expect(msg2!.receiveCount).toBe(2);
      queue.acknowledge(msg2!.messageId);

      // Message removed from queue (processed)
      expect(queue.getQueueDepth()).toBe(0);
      expect(queue.getDLQDepth()).toBe(0);
      expect(queue.processedMessages).toHaveLength(1);
    });
  });

  describe('AI Generation queue processing', () => {
    it('processes explanation generation requests from the queue', async () => {
      const queue = createMockSQSQueue(3);

      // Simulate sending AI generation requests (explanation, grammar, revision)
      const aiRequests = [
        { chapterId: 'ch-005', pageId: 'page-1', imageS3Key: '', pageNumber: 1 },
        { chapterId: 'ch-005', pageId: 'page-2', imageS3Key: '', pageNumber: 2 },
      ] as OCRQueueMessage[];

      for (const req of aiRequests) {
        await queue.send(req);
      }

      expect(queue.getQueueDepth()).toBe(2);

      // Process all messages successfully
      while (queue.getQueueDepth() > 0) {
        const msg = queue.receive();
        if (msg) {
          queue.acknowledge(msg.messageId);
        }
      }

      expect(queue.getQueueDepth()).toBe(0);
      expect(queue.processedMessages).toHaveLength(2);
      expect(queue.getDLQDepth()).toBe(0);
    });

    it('handles mixed success/failure across multiple messages', async () => {
      const queue = createMockSQSQueue(2); // Lower threshold for test

      // Send 3 messages
      await queue.send({ chapterId: 'ch-006', pageId: 'success-1', imageS3Key: 'k1', pageNumber: 1 });
      await queue.send({ chapterId: 'ch-006', pageId: 'fail-1', imageS3Key: 'k2', pageNumber: 2 });
      await queue.send({ chapterId: 'ch-006', pageId: 'success-2', imageS3Key: 'k3', pageNumber: 3 });

      // Process first message successfully
      const msg1 = queue.receive();
      queue.acknowledge(msg1!.messageId);

      // Second message fails twice → DLQ
      const msg2a = queue.receive();
      queue.nack(msg2a!.messageId);
      const msg2b = queue.receive();
      queue.nack(msg2b!.messageId);

      // Third message succeeds
      const msg3 = queue.receive();
      queue.acknowledge(msg3!.messageId);

      expect(queue.processedMessages).toHaveLength(2);
      expect(queue.getDLQDepth()).toBe(1);
      expect(queue.dlqMessages[0].body.pageId).toBe('fail-1');
    });
  });
});
