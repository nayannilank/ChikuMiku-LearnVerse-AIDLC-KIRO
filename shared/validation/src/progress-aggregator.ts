/**
 * Progress aggregation utilities for tracking revision progress
 * across multiple quiz attempts per chapter.
 */

/** A single quiz attempt with score and timestamp. */
export interface QuizAttempt {
  scorePercentage: number;
  /** ISO timestamp for ordering */
  completedAt: string;
}

/** Aggregated progress summary for a chapter. */
export interface ProgressSummary {
  attemptCount: number;
  highestScore: number;
  mostRecentScore: number;
}

/**
 * Aggregates quiz attempts into a progress summary.
 * Tracks attempt count, highest score, and most recent score.
 *
 * @param attempts - Array of quiz attempts for a chapter
 * @returns Aggregated progress summary
 */
export function aggregateProgress(attempts: QuizAttempt[]): ProgressSummary {
  if (attempts.length === 0) {
    return { attemptCount: 0, highestScore: 0, mostRecentScore: 0 };
  }

  const highestScore = Math.max(...attempts.map((a) => a.scorePercentage));

  const mostRecent = attempts.reduce((latest, current) =>
    current.completedAt > latest.completedAt ? current : latest
  );

  return {
    attemptCount: attempts.length,
    highestScore,
    mostRecentScore: mostRecent.scorePercentage,
  };
}
