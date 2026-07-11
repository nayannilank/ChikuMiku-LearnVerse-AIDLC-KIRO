/**
 * SQS Client interface for the content service.
 * Abstracts SQS operations for OCR message queuing.
 *
 * Requirements: 8.1, 8.2, 8.8
 */

/** Message payload sent to the OCR processing queue. */
export interface OCRQueueMessage {
  chapterId: string;
  pageId: string;
  imageS3Key: string;
  pageNumber: number;
}

/** SQS client interface for testability. */
export interface SQSClient {
  /**
   * Send a message to the OCR processing queue.
   * Returns the SQS message ID on success.
   */
  sendOCRMessage(message: OCRQueueMessage): Promise<string>;
}
