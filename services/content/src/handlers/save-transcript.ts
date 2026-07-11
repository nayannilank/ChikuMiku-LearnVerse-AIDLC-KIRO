/**
 * Save Transcript Handler
 * PUT /content/chapters/:id/transcript
 *
 * Accepts learner-edited transcript pages, validates them, organizes with
 * sequential markers, persists atomically, and resets AI flag if needed.
 *
 * Requirements: 8.4, 8.5, 8.6, 25.2
 */
import { TranscriptPage, APIError } from '@chikumiku/types';
import { DBClient } from '../clients/db-client';
import { organizeTranscript, OrganizedTranscript } from '../transcript/organizer';

export interface SaveTranscriptRequest {
  pages: TranscriptPage[];
}

export interface SaveTranscriptResponse {
  success: true;
  organized: OrganizedTranscript;
  aiAssetsReset: boolean;
}

export interface SaveTranscriptDependencies {
  dbClient: DBClient;
}

/**
 * Validate the transcript save request.
 * All pages must have non-empty text (successful OCR or manual entry).
 */
export function validateTranscriptRequest(
  request: SaveTranscriptRequest
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!request.pages || !Array.isArray(request.pages)) {
    errors.pages = 'Pages array is required';
    return { valid: false, errors };
  }

  if (request.pages.length === 0) {
    errors.pages = 'At least one transcript page is required';
    return { valid: false, errors };
  }

  for (const page of request.pages) {
    // Each page must have non-empty text (Req 8.6: prevent save when any page not successfully processed)
    if (!page.text || page.text.trim().length === 0) {
      errors[`page_${page.pageNumber}`] =
        `Page ${page.pageNumber} has no transcript text. All pages must be successfully processed before saving.`;
    }

    // Validate classification
    if (page.classification !== 'content' && page.classification !== 'exercise') {
      errors[`page_${page.pageNumber}_classification`] =
        `Page ${page.pageNumber} has invalid classification. Must be 'content' or 'exercise'.`;
    }

    // Validate page number
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
      errors[`page_${page.pageNumber}_number`] =
        `Page number must be a positive integer.`;
    }

    // Validate language
    if (!page.language || page.language.trim().length === 0) {
      errors[`page_${page.pageNumber}_language`] =
        `Page ${page.pageNumber} must have a detected language.`;
    }
  }

  // Validate no duplicate page numbers
  const pageNumbers = request.pages.map(p => p.pageNumber);
  const uniqueNumbers = new Set(pageNumbers);
  if (uniqueNumbers.size !== pageNumbers.length) {
    errors.pageNumbers = 'Duplicate page numbers detected. Each page must have a unique number.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Handle transcript save request.
 * Validates, organizes, persists atomically, and resets AI flag if needed.
 */
export async function handleSaveTranscript(
  chapterId: string,
  request: SaveTranscriptRequest,
  deps: SaveTranscriptDependencies
): Promise<SaveTranscriptResponse | APIError> {
  // 1. Validate chapter ID
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  // 2. Validate request payload (Req 8.6: prevent save when any page not successfully processed)
  const validation = validateTranscriptRequest(request);
  if (!validation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Transcript data contains invalid or incomplete pages',
      details: validation.errors,
      retryable: false,
    };
  }

  // 3. Verify chapter exists
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

  // 4. Organize transcript with sequential markers (Req 8.4)
  const organized = organizeTranscript(request.pages);

  // 5. Persist atomically — all pages or none (Req 8.6)
  const pagesToSave = request.pages.map(p => ({
    pageNumber: p.pageNumber,
    text: p.text,
    language: p.language,
  }));

  await deps.dbClient.saveTranscriptAtomic(chapterId, pagesToSave);

  // 6. If AI assets were previously generated, reset the flag (Req 25.2)
  let aiAssetsReset = false;
  const aiStatus = await deps.dbClient.getChapterAiStatus(chapterId);
  if (aiStatus.aiAssetsGenerated) {
    await deps.dbClient.resetAiAssetsFlag(chapterId);
    aiAssetsReset = true;
  }

  // 7. Return success only after verified persistence (Req 8.6)
  return {
    success: true,
    organized,
    aiAssetsReset,
  };
}
