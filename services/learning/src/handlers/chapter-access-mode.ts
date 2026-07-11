/**
 * Chapter Access Mode Handler
 * GET /learn/chapters/:chapterId/access-mode
 *
 * Returns the access mode for a chapter based on its academic year
 * vs the current academic year.
 *
 * Requirements: 21.4, 21.5
 */

import type { APIError } from '@chikumiku/types';
import { determineAcademicYear, getAccessMode } from '../academic-year';

/** Repository interface for fetching chapter data. */
export interface IChapterRepository {
  getChapterAcademicYear(chapterId: string): Promise<string | null>;
}

/** Dependencies for the chapter-access-mode handler. */
export interface ChapterAccessModeDeps {
  chapterRepository: IChapterRepository;
  /** Allows injecting the current date for testability. Defaults to new Date(). */
  now?: () => Date;
}

/** Successful response for chapter access mode. */
export interface ChapterAccessModeResponse {
  success: true;
  chapterId: string;
  academicYear: string;
  currentAcademicYear: string;
  accessMode: 'read-write' | 'read-only';
}

/**
 * Handles retrieving the access mode for a chapter.
 *
 * Compares the chapter's stored academic year against the current academic year.
 * Current year → read-write, prior years → read-only archive.
 */
export async function handleGetChapterAccessMode(
  chapterId: string,
  deps: ChapterAccessModeDeps
): Promise<ChapterAccessModeResponse | APIError> {
  if (!chapterId || typeof chapterId !== 'string' || chapterId.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'chapterId is required',
      retryable: false,
    };
  }

  const chapterAcademicYear = await deps.chapterRepository.getChapterAcademicYear(chapterId);

  if (chapterAcademicYear === null) {
    return {
      statusCode: 404,
      errorCode: 'CHAPTER_NOT_FOUND',
      message: 'Chapter not found',
      retryable: false,
    };
  }

  const currentDate = deps.now ? deps.now() : new Date();
  const currentAcademicYear = determineAcademicYear(currentDate);
  const accessMode = getAccessMode(chapterAcademicYear, currentAcademicYear);

  return {
    success: true,
    chapterId,
    academicYear: chapterAcademicYear,
    currentAcademicYear,
    accessMode,
  };
}
