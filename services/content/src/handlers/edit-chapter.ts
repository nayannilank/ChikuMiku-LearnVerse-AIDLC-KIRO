/**
 * Edit Chapter Handler
 * PUT /content/chapters/:id
 *
 * Updates a chapter's name and/or number. Validates with the same rules as
 * creation and guards against duplicate chapter numbers within the same book
 * (excluding the chapter being edited).
 *
 * Requirements: 6.2
 */
import type { APIError } from '@chikumiku/types';
import { validateChapterName } from '@chikumiku/validation';
import type { ChapterRecord, DBClient } from '../clients/db-client';

/** Request body for editing a chapter. */
export interface EditChapterRequest {
  chapterName?: string;
  chapterNumber?: number;
}

export interface EditChapterResponse {
  success: true;
  chapter: ChapterRecord;
}

export interface EditChapterDependencies {
  dbClient: DBClient;
}

const MIN_CHAPTER_NUMBER = 1;
const MAX_CHAPTER_NUMBER = 999;

export async function handleEditChapter(
  chapterId: string,
  body: EditChapterRequest,
  deps: EditChapterDependencies
): Promise<EditChapterResponse | APIError> {
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  const { chapterName, chapterNumber } = body ?? {};
  if (chapterName === undefined && chapterNumber === undefined) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'At least one field (chapterName or chapterNumber) must be provided',
      retryable: false,
    };
  }

  const errors: Record<string, string> = {};
  if (chapterName !== undefined) {
    const result = validateChapterName(chapterName);
    if (!result.valid) {
      Object.assign(errors, result.errors);
    }
  }
  if (chapterNumber !== undefined) {
    if (
      !Number.isInteger(chapterNumber) ||
      chapterNumber < MIN_CHAPTER_NUMBER ||
      chapterNumber > MAX_CHAPTER_NUMBER
    ) {
      errors.chapterNumber = `Chapter number must be an integer between ${MIN_CHAPTER_NUMBER} and ${MAX_CHAPTER_NUMBER}`;
    }
  }
  if (Object.keys(errors).length > 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'One or more fields have validation errors',
      details: errors,
      retryable: false,
    };
  }

  // Verify the chapter exists (and get its book for the duplicate-number check).
  const existing = await deps.dbClient.getChapterById(chapterId);
  if (!existing) {
    return {
      statusCode: 404,
      errorCode: 'CHAPTER_NOT_FOUND',
      message: 'Chapter not found',
      retryable: false,
    };
  }

  // Guard against a duplicate chapter number within the same book (ignoring
  // this chapter's own current number).
  if (chapterNumber !== undefined && chapterNumber !== existing.chapterNumber) {
    const clash = await deps.dbClient.chapterNumberExistsExcluding(
      existing.bookId,
      chapterNumber,
      chapterId
    );
    if (clash) {
      return {
        statusCode: 409,
        errorCode: 'CHAPTER_NUMBER_TAKEN',
        message: `Chapter number ${chapterNumber} already exists in this book`,
        details: { chapterNumber: 'Choose a different chapter number' },
        retryable: false,
      };
    }
  }

  const updated = await deps.dbClient.updateChapter(chapterId, {
    chapterName,
    chapterNumber,
  });
  if (!updated) {
    return {
      statusCode: 404,
      errorCode: 'CHAPTER_NOT_FOUND',
      message: 'Chapter not found',
      retryable: false,
    };
  }

  return { success: true, chapter: updated };
}
