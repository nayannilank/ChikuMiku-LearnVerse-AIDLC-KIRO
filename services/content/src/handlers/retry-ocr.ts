/**
 * Retry OCR Handler
 * POST /content/chapters/:id/pages/:pageId/retry
 *
 * Re-queues a failed page for OCR processing. Only pages in 'failed'
 * status can be retried — this ensures other pages are unaffected.
 *
 * Requirements: 8.8
 */
import { APIError } from '@chikumiku/types';
import { DBClient, PageRecord } from '../clients/db-client';
import { SQSClient, OCRQueueMessage } from '../clients/sqs-client';

export interface RetryOCRResponse {
  success: true;
  pageId: string;
  pageNumber: number;
  status: 'queued';
  message: string;
}

export interface RetryOCRDependencies {
  dbClient: DBClient;
  sqsClient: SQSClient;
}

/**
 * Handle retry request for a failed OCR page.
 * Validates the page is in failed status, then re-queues it.
 */
export async function handleRetryOCR(
  chapterId: string,
  pageId: string,
  deps: RetryOCRDependencies
): Promise<RetryOCRResponse | APIError> {
  // 1. Validate inputs
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  if (!pageId || pageId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Page ID is required',
      retryable: false,
    };
  }

  // 2. Verify chapter exists
  const chapter = await deps.dbClient.getChapterById(chapterId);
  if (!chapter) {
    return {
      statusCode: 404,
      errorCode: 'CHAPTER_NOT_FOUND',
      message: 'Chapter not found',
      details: { chapterId: 'No chapter exists with the provided ID' },
      retryable: false,
    };
  }

  // 3. Find the page within the chapter
  const pages = await deps.dbClient.getPagesByChapter(chapterId);
  const page = pages.find((p) => p.id === pageId);

  if (!page) {
    return {
      statusCode: 404,
      errorCode: 'PAGE_NOT_FOUND',
      message: 'Page not found in this chapter',
      details: { pageId: 'No page exists with the provided ID in this chapter' },
      retryable: false,
    };
  }

  // 4. Verify page is in failed status
  if (page.ocrStatus !== 'failed') {
    return {
      statusCode: 400,
      errorCode: 'INVALID_PAGE_STATUS',
      message: 'Only failed pages can be retried',
      details: {
        pageId: `Page is currently in '${page.ocrStatus}' status. Only pages with 'failed' status can be retried.`,
      },
      retryable: false,
    };
  }

  // 5. Re-queue the page for OCR processing
  const message: OCRQueueMessage = {
    chapterId,
    pageId: page.id,
    imageS3Key: page.imageS3Key,
    pageNumber: page.pageNumber,
  };

  await deps.sqsClient.sendOCRMessage(message);
  await deps.dbClient.updatePageOcrStatus(page.id, 'processing');

  return {
    success: true,
    pageId: page.id,
    pageNumber: page.pageNumber,
    status: 'queued',
    message: `Page ${page.pageNumber} re-queued for OCR processing`,
  };
}
