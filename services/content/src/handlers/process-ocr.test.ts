import { handleProcessOCR, ProcessOCRDependencies, ProcessOCRResponse } from './process-ocr';
import { handleOCRProgress, OCRProgressDependencies, OCRProgressResponse } from './ocr-progress';
import { handleRetryOCR, RetryOCRDependencies, RetryOCRResponse } from './retry-ocr';
import { APIError } from '@chikumiku/types';
import { DBClient, PageRecord, ChapterWithPages } from '../clients/db-client';
import { SQSClient } from '../clients/sqs-client';

// Helper to create a mock page record
function mockPage(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    id: 'page-1',
    chapterId: 'chapter-123',
    pageNumber: 1,
    classification: 'content',
    imageS3Key: 'images/chapter-123/page-1.jpg',
    transcriptText: null,
    detectedLanguage: null,
    ocrStatus: 'pending',
    processedAt: null,
    ...overrides,
  };
}

// Helper to create a mock chapter with pages
function mockChapterWithPages(pages: PageRecord[] = [mockPage()]): ChapterWithPages {
  return {
    id: 'chapter-123',
    bookId: 'book-123',
    chapterNumber: 1,
    chapterName: 'Introduction',
    aiAssetsGenerated: false,
    academicYear: '2024-2025',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages,
    bookName: 'Mathematics',
    subjectId: 'subject-123',
  };
}

// Helper to create mock DB client
function createMockDBClient(overrides: Partial<DBClient> = {}): DBClient {
  return {
    getBooksBySubject: jest.fn().mockResolvedValue([]),
    getChaptersByBook: jest.fn().mockResolvedValue([]),
    chapterNumberExists: jest.fn().mockResolvedValue(false),
    createChapter: jest.fn().mockResolvedValue({}),
    getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages()),
    findOrCreateBook: jest.fn().mockResolvedValue({}),
    getPagesByChapter: jest.fn().mockResolvedValue([mockPage()]),
    createPage: jest.fn().mockResolvedValue(mockPage()),
    updatePageOrder: jest.fn().mockResolvedValue(undefined),
    deletePage: jest.fn().mockResolvedValue(undefined),
    updatePageClassification: jest.fn().mockResolvedValue(undefined),
    updatePageImage: jest.fn().mockResolvedValue(undefined),
    updatePageOcrStatus: jest.fn().mockResolvedValue(undefined),
    saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
    resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
    getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
    ...overrides,
  };
}

// Helper to create mock SQS client
function createMockSQSClient(overrides: Partial<SQSClient> = {}): SQSClient {
  return {
    sendOCRMessage: jest.fn().mockResolvedValue('msg-id-123'),
    ...overrides,
  };
}

function isAPIError(response: unknown): response is APIError {
  return typeof response === 'object' && response !== null && 'statusCode' in response;
}

describe('handleProcessOCR', () => {
  it('sends all pending pages to SQS queue and updates status', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1 }),
      mockPage({ id: 'page-2', pageNumber: 2 }),
      mockPage({ id: 'page-3', pageNumber: 3 }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as ProcessOCRResponse;
    expect(result.success).toBe(true);
    expect(result.totalPages).toBe(3);
    expect(result.pagesQueued).toBe(3);
    expect(sqsClient.sendOCRMessage).toHaveBeenCalledTimes(3);
    expect(dbClient.updatePageOcrStatus).toHaveBeenCalledTimes(3);

    // Verify each page was sent with correct message
    expect(sqsClient.sendOCRMessage).toHaveBeenCalledWith({
      chapterId: 'chapter-123',
      pageId: 'page-1',
      imageS3Key: 'images/chapter-123/page-1.jpg',
      pageNumber: 1,
    });
    expect(sqsClient.sendOCRMessage).toHaveBeenCalledWith({
      chapterId: 'chapter-123',
      pageId: 'page-2',
      imageS3Key: 'images/chapter-123/page-1.jpg',
      pageNumber: 2,
    });

    // Verify status was updated to 'processing'
    expect(dbClient.updatePageOcrStatus).toHaveBeenCalledWith('page-1', 'processing');
    expect(dbClient.updatePageOcrStatus).toHaveBeenCalledWith('page-2', 'processing');
    expect(dbClient.updatePageOcrStatus).toHaveBeenCalledWith('page-3', 'processing');
  });

  it('returns 404 when chapter does not exist', async () => {
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(null),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('nonexistent-chapter', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('CHAPTER_NOT_FOUND');
    expect(sqsClient.sendOCRMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when chapter has no pages', async () => {
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages([])),
      getPagesByChapter: jest.fn().mockResolvedValue([]),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('chapter-123', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('NO_PAGES');
    expect(sqsClient.sendOCRMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when chapter ID is empty', async () => {
    const dbClient = createMockDBClient();
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('VALIDATION_ERROR');
  });

  it('skips pages already in processing or completed status', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'pending' }),
      mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'processing' }),
      mockPage({ id: 'page-3', pageNumber: 3, ocrStatus: 'completed', transcriptText: 'Hello' }),
      mockPage({ id: 'page-4', pageNumber: 4, ocrStatus: 'failed' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as ProcessOCRResponse;
    expect(result.pagesQueued).toBe(2); // only pending + failed are queued
    expect(sqsClient.sendOCRMessage).toHaveBeenCalledTimes(2);

    // Verify the page statuses in response
    const queuedPages = result.pages.filter((p) => p.status === 'queued');
    const alreadyProcessing = result.pages.filter((p) => p.status === 'already_processing');
    const alreadyCompleted = result.pages.filter((p) => p.status === 'already_completed');
    expect(queuedPages).toHaveLength(2);
    expect(alreadyProcessing).toHaveLength(1);
    expect(alreadyCompleted).toHaveLength(1);
  });

  it('includes progress message with page count format', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1 }),
      mockPage({ id: 'page-2', pageNumber: 2 }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    const response = await handleProcessOCR('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as ProcessOCRResponse;
    expect(result.message).toContain('Extracting text from pages...');
    expect(result.message).toContain('0/2');
  });

  it('sends OCR queue messages with exactly the required fields (chapterId, pageId, imageS3Key, pageNumber)', async () => {
    const pages = [
      mockPage({ id: 'page-abc', pageNumber: 7, imageS3Key: 'images/ch-1/page-7.png' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: ProcessOCRDependencies = { dbClient, sqsClient };

    await handleProcessOCR('chapter-xyz', deps);

    const sentMessage = (sqsClient.sendOCRMessage as jest.Mock).mock.calls[0][0];
    // Verify exact structure matches OCRQueueMessage interface
    expect(sentMessage).toEqual({
      chapterId: 'chapter-xyz',
      pageId: 'page-abc',
      imageS3Key: 'images/ch-1/page-7.png',
      pageNumber: 7,
    });
    // Verify no extra fields are included
    expect(Object.keys(sentMessage).sort()).toEqual(['chapterId', 'imageS3Key', 'pageId', 'pageNumber']);
  });
});

describe('handleOCRProgress', () => {
  it('returns per-page status with aggregate counts', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Hello', detectedLanguage: 'en' }),
      mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'processing' }),
      mockPage({ id: 'page-3', pageNumber: 3, ocrStatus: 'failed' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const deps: OCRProgressDependencies = { dbClient };

    const response = await handleOCRProgress('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as OCRProgressResponse;
    expect(result.success).toBe(true);
    expect(result.progress.total).toBe(3);
    expect(result.progress.completed).toBe(1);
    expect(result.progress.processing).toBe(1);
    expect(result.progress.failed).toBe(1);
    expect(result.progress.pending).toBe(0);
    expect(result.isComplete).toBe(false);
    expect(result.message).toContain('Extracting text from pages...');
  });

  it('reports complete with success when all pages are done', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Page 1 text' }),
      mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'completed', transcriptText: 'Page 2 text' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const deps: OCRProgressDependencies = { dbClient };

    const response = await handleOCRProgress('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as OCRProgressResponse;
    expect(result.isComplete).toBe(true);
    expect(result.message).toContain('processed successfully');
  });

  it('reports complete with failures when some pages failed', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Text' }),
      mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'failed' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const deps: OCRProgressDependencies = { dbClient };

    const response = await handleOCRProgress('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as OCRProgressResponse;
    expect(result.isComplete).toBe(true);
    expect(result.progress.failed).toBe(1);
    expect(result.message).toContain('failed');
  });

  it('returns 404 for nonexistent chapter', async () => {
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(null),
    });
    const deps: OCRProgressDependencies = { dbClient };

    const response = await handleOCRProgress('nonexistent', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(404);
  });

  it('includes language detection info per page', async () => {
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Hello', detectedLanguage: 'en' }),
      mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'completed', transcriptText: 'Hola', detectedLanguage: 'es' }),
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const deps: OCRProgressDependencies = { dbClient };

    const response = await handleOCRProgress('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as OCRProgressResponse;
    expect(result.pages[0].detectedLanguage).toBe('en');
    expect(result.pages[1].detectedLanguage).toBe('es');
  });
});

describe('handleRetryOCR', () => {
  it('re-queues a failed page for processing', async () => {
    const failedPage = mockPage({ id: 'page-2', pageNumber: 2, ocrStatus: 'failed' });
    const pages = [
      mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Text' }),
      failedPage,
    ];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('chapter-123', 'page-2', deps);

    expect(isAPIError(response)).toBe(false);
    const result = response as RetryOCRResponse;
    expect(result.success).toBe(true);
    expect(result.pageId).toBe('page-2');
    expect(result.status).toBe('queued');
    expect(sqsClient.sendOCRMessage).toHaveBeenCalledWith({
      chapterId: 'chapter-123',
      pageId: 'page-2',
      imageS3Key: 'images/chapter-123/page-1.jpg',
      pageNumber: 2,
    });
    expect(dbClient.updatePageOcrStatus).toHaveBeenCalledWith('page-2', 'processing');
  });

  it('rejects retry for page not in failed status', async () => {
    const processingPage = mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'processing' });
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages([processingPage])),
      getPagesByChapter: jest.fn().mockResolvedValue([processingPage]),
    });
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('chapter-123', 'page-1', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_PAGE_STATUS');
    expect(sqsClient.sendOCRMessage).not.toHaveBeenCalled();
  });

  it('rejects retry for completed page', async () => {
    const completedPage = mockPage({ id: 'page-1', pageNumber: 1, ocrStatus: 'completed', transcriptText: 'Text' });
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages([completedPage])),
      getPagesByChapter: jest.fn().mockResolvedValue([completedPage]),
    });
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('chapter-123', 'page-1', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_PAGE_STATUS');
  });

  it('returns 404 when page does not exist in chapter', async () => {
    const pages = [mockPage({ id: 'page-1', pageNumber: 1 })];
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages(pages)),
      getPagesByChapter: jest.fn().mockResolvedValue(pages),
    });
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('chapter-123', 'nonexistent-page', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('PAGE_NOT_FOUND');
  });

  it('returns 404 when chapter does not exist', async () => {
    const dbClient = createMockDBClient({
      getChapterById: jest.fn().mockResolvedValue(null),
    });
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('nonexistent', 'page-1', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('CHAPTER_NOT_FOUND');
  });

  it('returns 400 when page ID is empty', async () => {
    const dbClient = createMockDBClient();
    const sqsClient = createMockSQSClient();
    const deps: RetryOCRDependencies = { dbClient, sqsClient };

    const response = await handleRetryOCR('chapter-123', '', deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
  });
});
