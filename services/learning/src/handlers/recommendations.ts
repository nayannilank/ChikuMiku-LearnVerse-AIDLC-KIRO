/**
 * Recommendations Handler
 * GET /learn/recommendations/:learnerId
 *
 * Returns rule-based suggestions for learner improvement.
 * Uses deterministic rules — NO LLM involvement (Requirement 25.5).
 *
 * Rules:
 * - Chapters with low quiz scores (< 50%) → suggest re-reading
 * - Chapters with high reading but low exercise completion → suggest exercises
 * - Long-inactive chapters (> 14 days) → suggest revisiting
 * - Chapters with declining scores → suggest focused review
 *
 * Requirements: 25.5
 */

import type { APIError } from '@chikumiku/types';
import type { QuizAttempt } from '@chikumiku/validation';
import {
  aggregateProgress,
  calculateLearnerCompletion,
  calculateExerciseCompletion,
} from '@chikumiku/validation';

/** Chapter data needed for recommendation rules. */
export interface ChapterRecommendationData {
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

/** Repository interface for recommendation data access (dependency injection). */
export interface IRecommendationRepository {
  getChapterDataForLearner(learnerId: string): Promise<ChapterRecommendationData[]>;
  learnerExists(learnerId: string): Promise<boolean>;
}

/** Types of recommendations the rule engine can produce. */
export type RecommendationType =
  | 'reread_chapter'
  | 'take_exercises'
  | 'revisit_chapter'
  | 'focused_review';

/** A single recommendation. */
export interface Recommendation {
  type: RecommendationType;
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

/** Successful recommendations response. */
export interface RecommendationsResponse {
  success: true;
  learnerId: string;
  recommendations: Recommendation[];
}

/** Dependencies required by the recommendations handler. */
export interface RecommendationsHandlerDeps {
  recommendationRepository: IRecommendationRepository;
}

/** Threshold constants for rule-based detection. */
const LOW_SCORE_THRESHOLD = 50;
const HIGH_READING_THRESHOLD = 70;
const LOW_EXERCISE_THRESHOLD = 30;
const INACTIVITY_DAYS = 14;

/**
 * Determines if quiz scores are declining by comparing the most recent
 * score to the average of earlier attempts.
 */
export function hasDeclineInScores(attempts: QuizAttempt[]): boolean {
  if (attempts.length < 3) {
    return false;
  }

  // Sort by completedAt ascending
  const sorted = [...attempts].sort(
    (a, b) => a.completedAt.localeCompare(b.completedAt)
  );

  const mostRecent = sorted[sorted.length - 1];
  const previousAttempts = sorted.slice(0, -1);
  const previousAvg =
    previousAttempts.reduce((sum, a) => sum + a.scorePercentage, 0) /
    previousAttempts.length;

  // Declining if most recent is at least 10 points below prior average
  return mostRecent.scorePercentage < previousAvg - 10;
}

/**
 * Calculates days since a given ISO timestamp.
 * Returns Infinity if lastActivityAt is null.
 */
export function daysSinceActivity(
  lastActivityAt: string | null,
  now: Date = new Date()
): number {
  if (!lastActivityAt) {
    return Infinity;
  }
  const lastDate = new Date(lastActivityAt);
  const diffMs = now.getTime() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generates rule-based recommendations for a set of chapter data.
 * Pure function — deterministic, no LLM involvement.
 */
export function generateRecommendations(
  chapters: ChapterRecommendationData[],
  now: Date = new Date()
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const chapter of chapters) {
    const progress = aggregateProgress(chapter.quizAttempts);
    const readingPct = calculateLearnerCompletion(
      chapter.pagesRead,
      chapter.totalContentPages
    );
    const exercisePct = calculateExerciseCompletion(
      chapter.exercisesCorrect,
      chapter.totalExercises
    );
    const inactiveDays = daysSinceActivity(chapter.lastActivityAt, now);

    // Rule 1: Low quiz scores → suggest re-reading
    if (progress.attemptCount > 0 && progress.highestScore < LOW_SCORE_THRESHOLD) {
      recommendations.push({
        type: 'reread_chapter',
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        bookName: chapter.bookName,
        subjectName: chapter.subjectName,
        reason: `Quiz scores are below ${LOW_SCORE_THRESHOLD}%. Re-reading the chapter may help strengthen understanding.`,
        priority: 'high',
      });
    }

    // Rule 2: High reading, low exercise → suggest exercises
    if (readingPct >= HIGH_READING_THRESHOLD && exercisePct < LOW_EXERCISE_THRESHOLD) {
      recommendations.push({
        type: 'take_exercises',
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        bookName: chapter.bookName,
        subjectName: chapter.subjectName,
        reason: `You've read ${readingPct}% of this chapter but exercise completion is only ${exercisePct}%. Try some exercises to reinforce your learning.`,
        priority: 'medium',
      });
    }

    // Rule 3: Long-inactive chapters → suggest revisiting
    if (inactiveDays >= INACTIVITY_DAYS && chapter.pagesRead > 0) {
      recommendations.push({
        type: 'revisit_chapter',
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        bookName: chapter.bookName,
        subjectName: chapter.subjectName,
        reason: `It's been ${inactiveDays} days since you last visited this chapter. A quick review can help retain what you've learned.`,
        priority: 'low',
      });
    }

    // Rule 4: Declining scores → suggest focused review
    if (hasDeclineInScores(chapter.quizAttempts)) {
      recommendations.push({
        type: 'focused_review',
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        bookName: chapter.bookName,
        subjectName: chapter.subjectName,
        reason: 'Your recent quiz scores are declining. A focused review of key concepts may help.',
        priority: 'high',
      });
    }
  }

  // Sort by priority: high > medium > low
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return recommendations;
}

/**
 * Handle GET /learn/recommendations/:learnerId request.
 * Returns rule-based recommendations or an API error.
 */
export async function handleGetRecommendations(
  learnerId: string,
  deps: RecommendationsHandlerDeps
): Promise<RecommendationsResponse | APIError> {
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
  const exists = await deps.recommendationRepository.learnerExists(learnerId);
  if (!exists) {
    return {
      statusCode: 404,
      errorCode: 'LEARNER_NOT_FOUND',
      message: 'Learner not found',
      details: { learnerId: 'No learner exists with the provided ID' },
      retryable: false,
    };
  }

  // 3. Fetch chapter data
  const chapters = await deps.recommendationRepository.getChapterDataForLearner(learnerId);

  // 4. Generate rule-based recommendations (no LLM)
  const recommendations = generateRecommendations(chapters);

  return {
    success: true,
    learnerId,
    recommendations,
  };
}
