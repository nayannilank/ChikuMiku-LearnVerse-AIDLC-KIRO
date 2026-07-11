/**
 * Get Chapter Handler
 * GET /content/chapters/:id
 *
 * Returns chapter details including pages and AI asset generation status.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
import { APIError } from '@chikumiku/types';
import { DBClient, ChapterWithPages } from '../clients/db-client';

export interface GetChapterResponse {
  success: true;
  chapter: {
    id: string;
    bookId: string;
    bookName: string;
    subjectId: string;
    chapterNumber: number;
    chapterName: string;
    aiAssetsGenerated: boolean;
    academicYear: string;
    createdAt: string;
    updatedAt: string;
    pages: {
      id: string;
      pageNumber: number;
      classification: 'content' | 'exercise';
      ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
      hasTranscript: boolean;
      detectedLanguage: string | null;
    }[];
    totalContentPages: number;
    totalExercisePages: number;
  };
}

export interface GetChapterDependencies {
  dbClient: DBClient;
}

/**
 * Handle get chapter request.
 * Returns chapter details with pages and AI status, or an API error.
 */
export async function handleGetChapter(
  chapterId: string,
  deps: GetChapterDependencies
): Promise<GetChapterResponse | APIError> {
  // 1. Validate chapter ID presence
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  // 2. Fetch chapter with pages
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

  // 3. Build response with page summaries and counts
  const contentPages = chapter.pages.filter(p => p.classification === 'content');
  const exercisePages = chapter.pages.filter(p => p.classification === 'exercise');

  return {
    success: true,
    chapter: {
      id: chapter.id,
      bookId: chapter.bookId,
      bookName: chapter.bookName,
      subjectId: chapter.subjectId,
      chapterNumber: chapter.chapterNumber,
      chapterName: chapter.chapterName,
      aiAssetsGenerated: chapter.aiAssetsGenerated,
      academicYear: chapter.academicYear,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      pages: chapter.pages.map(p => ({
        id: p.id,
        pageNumber: p.pageNumber,
        classification: p.classification,
        ocrStatus: p.ocrStatus,
        hasTranscript: p.transcriptText !== null && p.transcriptText.length > 0,
        detectedLanguage: p.detectedLanguage,
      })),
      totalContentPages: contentPages.length,
      totalExercisePages: exercisePages.length,
    },
  };
}
