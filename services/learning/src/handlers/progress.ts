/**
 * Progress Tracking Handler
 * GET /learn/progress/:learnerId
 *
 * Returns per-chapter progress summary including pages read,
 * exercise scores, and quiz attempts (count, highest, most recent).
 *
 * Requirements: 13.9, 13.10, 14.1, 14.2, 14.3, 15.1, 15.2, 25.5
 */

import type { APIError } from '@chikumiku/types';
import type { QuizAttempt, ProgressSummary } from '@chikumiku/validation';
import {
  aggregateProgress,
  calculateParentCompletion,
  calculateExerciseCompletion,
  calculateLearnerCompletion,
  calculatePagesLeft,
} from '@chikumiku/validation';

/** Chapter progress data returned by the repository. */
export interface ChapterProgressRecord {
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectName: string;
  totalContentPages: number;
  pagesRead: number;
  totalExercises: number;
  exercisesCorrect: number;
  quizAttempts: QuizAttempt[];
  lastActivityAt: string | null;
}

/** Repository interface for progress data access (dependency injection). */
export interface IProgressRepository {
  getChapterProgressForLearner(learnerId: string): Promise<ChapterProgressRecord[]>;
  learnerExists(learnerId: string): Promise<boolean>;
}

/** Per-chapter progress summary in the response. */
export interface ChapterProgressSummary {
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectName: string;
  reading: {
    pagesRead: number;
    totalPages: number;
    parentCompletionPercentage: number;
    learnerCompletionPercentage: number;
    pagesLeft: number;
  };
  exercises: {
    correct: number;
    total: number;
    completionPercentage: number;
  };
  quizzes: ProgressSummary;
  lastActivityAt: string | null;
}

/** Successful progress response. */
export interface ProgressResponse {
  success: true;
  learnerId: string;
  chapters: ChapterProgressSummary[];
}

/** Dependencies required by the progress handler. */
export interface ProgressHandlerDeps {
  progressRepository: IProgressRepository;
}

/**
 * Handle GET /learn/progress/:learnerId request.
 * Returns per-chapter progress summary or an API error.
 */
export async function handleGetProgress(
  learnerId: string,
  deps: ProgressHandlerDeps
): Promise<ProgressResponse | APIError> {
  // 1. Validate learner ID
  if (!learnerId || learnerId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Learner ID is required',
      retryable: false,
    };
  }

  // 2. Check learner exists
  const exists = await deps.progressRepository.learnerExists(learnerId);
  if (!exists) {
    return {
      statusCode: 404,
      errorCode: 'LEARNER_NOT_FOUND',
      message: 'Learner not found',
      details: { learnerId: 'No learner exists with the provided ID' },
      retryable: false,
    };
  }

  // 3. Fetch chapter progress data
  const records = await deps.progressRepository.getChapterProgressForLearner(learnerId);

  // 4. Transform records into progress summaries using shared calculators
  const chapters: ChapterProgressSummary[] = records.map((record) => ({
    chapterId: record.chapterId,
    chapterName: record.chapterName,
    bookName: record.bookName,
    subjectName: record.subjectName,
    reading: {
      pagesRead: record.pagesRead,
      totalPages: record.totalContentPages,
      parentCompletionPercentage: calculateParentCompletion(
        record.pagesRead,
        record.totalContentPages
      ),
      learnerCompletionPercentage: calculateLearnerCompletion(
        record.pagesRead,
        record.totalContentPages
      ),
      pagesLeft: calculatePagesLeft(record.totalContentPages, record.pagesRead),
    },
    exercises: {
      correct: record.exercisesCorrect,
      total: record.totalExercises,
      completionPercentage: calculateExerciseCompletion(
        record.exercisesCorrect,
        record.totalExercises
      ),
    },
    quizzes: aggregateProgress(record.quizAttempts),
    lastActivityAt: record.lastActivityAt,
  }));

  return {
    success: true,
    learnerId,
    chapters,
  };
}
