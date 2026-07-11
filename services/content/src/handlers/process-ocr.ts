/**
 * Process OCR Handler
 * POST /content/chapters/:id/process
 *
 * Triggers OCR processing for all pending pages in a chapter by sending
 * messages to the SQS OCR queue. Each page is processed independently
 * so failures don't affect other pages.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.7, 8.8
 */
import { APIError } from '@chikumiku/types';
import { DBClient, PageRecord } from '../clients/db-client';
import { SQSClient, OCRQueueMessage } from '../clients/sqs-client';

export interface ProcessOCRResponse {
  success: true;
  chapterId: string;
  totalPages: number;
  pagesQueued: number;
  message: string;
  pages: {
    pageId: string;
    pageNumber: number;
    status: 'queued' | 'already_processing' | 'already_completed';
  }[];
}

export interface ProcessOCRDependencies {
  dbClient: DBClient;
  sqsClient: SQSClient;
}

/**
 * Handle OCR processing trigger for a chapter.
 * Sends each pending page to the SQS OCR queue and updates status to 'processing'.
 */
export async function handleProcessOCR(
  chapterId: string,
  deps: ProcessOCRDependencies
): Promise<ProcessOCRResponse | APIError> {
  // 1. Validate chapter ID
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  // 2. Fetch chapter to verify it exists
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

  // 3. Get all pages for the chapter
  const pages = await deps.dbClient.getPagesByChapter(chapterId);
  if (pages.length === 0) {
    return {
      statusCode: 400,
      errorCode: 'NO_PAGES',
      message: 'Chapter has no pages to process',
      details: { chapterId: 'Add at least one page before triggering OCR processing' },
      retryable: false,
    };
  }

  // 4. Filter pages eligible for processing (pending or failed)
  const eligiblePages = pages.filter(
    (p) => p.ocrStatus === 'pending' || p.ocrStatus === 'failed'
  );

  // 5. Queue each eligible page for OCR processing
  const pageResults: ProcessOCRResponse['pages'] = [];
  let pagesQueued = 0;

  for (const page of pages) {
    if (page.ocrStatus === 'processing') {
      pageResults.push({
        pageId: page.id,
        pageNumber: page.pageNumber,
        status: 'already_processing',
      });
      continue;
    }

    if (page.ocrStatus === 'completed') {
      pageResults.push({
        pageId: page.id,
        pageNumber: page.pageNumber,
        status: 'already_completed',
      });
      continue;
    }

    // Page is pending or failed — send to OCR queue
    const message: OCRQueueMessage = {
      chapterId,
      pageId: page.id,
      imageS3Key: page.imageS3Key,
      pageNumber: page.pageNumber,
    };

    await deps.sqsClient.sendOCRMessage(message);
    await deps.dbClient.updatePageOcrStatus(page.id, 'processing');

    pageResults.push({
      pageId: page.id,
      pageNumber: page.pageNumber,
      status: 'queued',
    });
    pagesQueued++;
  }

  return {
    success: true,
    chapterId,
    totalPages: pages.length,
    pagesQueued,
    message: `Extracting text from pages... (0/${pagesQueued})`,
    pages: pageResults,
  };
}
