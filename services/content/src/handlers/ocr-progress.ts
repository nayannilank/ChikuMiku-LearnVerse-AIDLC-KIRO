/**
 * OCR Progress Handler
 * GET /content/chapters/:id/ocr-status
 *
 * Returns per-page OCR status with aggregate counts for progress tracking.
 * Supports the progress indicator "Extracting text from pages..." with current/total.
 *
 * Requirements: 8.2, 8.8
 */
import { APIError } from '@chikumiku/types';
import { DBClient, PageRecord } from '../clients/db-client';

export interface OCRProgressResponse {
  success: true;
  chapterId: string;
  progress: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  message: string;
  isComplete: boolean;
  pages: {
    pageId: string;
    pageNumber: number;
    ocrStatus: PageRecord['ocrStatus'];
    detectedLanguage: string | null;
    hasTranscript: boolean;
  }[];
}

export interface OCRProgressDependencies {
  dbClient: DBClient;
}

/**
 * Handle OCR progress query for a chapter.
 * Returns per-page status and aggregate progress counts.
 */
export async function handleOCRProgress(
  chapterId: string,
  deps: OCRProgressDependencies
): Promise<OCRProgressResponse | APIError> {
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

  // 4. Calculate progress counts
  const total = pages.length;
  const completed = pages.filter((p) => p.ocrStatus === 'completed').length;
  const processing = pages.filter((p) => p.ocrStatus === 'processing').length;
  const pending = pages.filter((p) => p.ocrStatus === 'pending').length;
  const failed = pages.filter((p) => p.ocrStatus === 'failed').length;

  // 5. Build progress message
  const processed = completed + failed;
  const isComplete = processing === 0 && pending === 0;
  let message: string;

  if (isComplete && failed === 0) {
    message = `All ${total} pages processed successfully`;
  } else if (isComplete && failed > 0) {
    message = `Processing complete. ${failed} page(s) failed.`;
  } else {
    message = `Extracting text from pages... (${processed}/${total})`;
  }

  return {
    success: true,
    chapterId,
    progress: { total, completed, processing, pending, failed },
    message,
    isComplete,
    pages: pages.map((p) => ({
      pageId: p.id,
      pageNumber: p.pageNumber,
      ocrStatus: p.ocrStatus,
      detectedLanguage: p.detectedLanguage,
      hasTranscript: p.transcriptText !== null && p.transcriptText.length > 0,
    })),
  };
}
