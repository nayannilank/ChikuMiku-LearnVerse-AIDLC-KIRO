/**
 * Property-based tests for progress tracking aggregation.
 * Feature: chikumiku-learnverse, Property 13: Progress Tracking Aggregation
 *
 * **Validates: Requirements 13.10, 14.3**
 *
 * Generate sequences of quiz attempts, verify:
 * (a) attempt count = total attempts
 * (b) highest = max score
 * (c) most recent = last attempt's score (chronologically latest)
 */
import * as fc from 'fast-check';
import { aggregateProgress, QuizAttempt } from './progress-aggregator';

// --- Arbitraries ---

/** Generate a QuizAttempt with a score in [0, 100] and a distinct ISO timestamp */
const quizAttemptArb = (baseTime: number, index: number): fc.Arbitrary<QuizAttempt> =>
  fc.integer({ min: 0, max: 100 }).map((scorePercentage) => ({
    scorePercentage,
    completedAt: new Date(baseTime + index * 1000).toISOString(),
  }));

/**
 * Generate a non-empty array of QuizAttempts with distinct timestamps.
 * Shuffles order to ensure aggregation does not depend on input ordering.
 */
const quizAttemptsArb = fc
  .integer({ min: 1, max: 50 })
  .chain((length) =>
    fc
      .integer({ min: 0, max: 1_000_000_000_000 })
      .chain((baseTime) =>
        fc
          .tuple(...Array.from({ length }, (_, i) => quizAttemptArb(baseTime, i)))
          .chain((attempts) =>
            fc.shuffledSubarray(attempts, { minLength: attempts.length, maxLength: attempts.length }),
          ),
      ),
  );

/** Generate a single QuizAttempt for single-element tests */
const singleAttemptArb = fc
  .tuple(
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 946684800000, max: 1924905600000 }), // 2000-01-01 to 2030-12-31 in ms
  )
  .map(([scorePercentage, timestamp]) => ({
    scorePercentage,
    completedAt: new Date(timestamp).toISOString(),
  }));

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 13: Progress Tracking Aggregation', () => {
  it('attemptCount always equals the length of the input array', () => {
    fc.assert(
      fc.property(quizAttemptsArb, (attempts) => {
        const result = aggregateProgress(attempts);
        expect(result.attemptCount).toBe(attempts.length);
      }),
      { numRuns: 200 },
    );
  });

  it('highestScore equals the maximum scorePercentage across all attempts', () => {
    fc.assert(
      fc.property(quizAttemptsArb, (attempts) => {
        const result = aggregateProgress(attempts);
        const expected = Math.max(...attempts.map((a) => a.scorePercentage));
        expect(result.highestScore).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('mostRecentScore equals the scorePercentage of the attempt with the chronologically latest completedAt', () => {
    fc.assert(
      fc.property(quizAttemptsArb, (attempts) => {
        const result = aggregateProgress(attempts);
        const mostRecent = attempts.reduce((latest, current) =>
          current.completedAt > latest.completedAt ? current : latest,
        );
        expect(result.mostRecentScore).toBe(mostRecent.scorePercentage);
      }),
      { numRuns: 200 },
    );
  });

  it('highestScore >= mostRecentScore (always true since highest is the max)', () => {
    fc.assert(
      fc.property(quizAttemptsArb, (attempts) => {
        const result = aggregateProgress(attempts);
        expect(result.highestScore).toBeGreaterThanOrEqual(result.mostRecentScore);
      }),
      { numRuns: 200 },
    );
  });

  it('for single-element arrays: attemptCount=1, highestScore=mostRecentScore=that element score', () => {
    fc.assert(
      fc.property(singleAttemptArb, (attempt) => {
        const result = aggregateProgress([attempt]);
        expect(result.attemptCount).toBe(1);
        expect(result.highestScore).toBe(attempt.scorePercentage);
        expect(result.mostRecentScore).toBe(attempt.scorePercentage);
      }),
      { numRuns: 200 },
    );
  });

  it('for empty arrays: returns zeroed summary', () => {
    const result = aggregateProgress([]);
    expect(result.attemptCount).toBe(0);
    expect(result.highestScore).toBe(0);
    expect(result.mostRecentScore).toBe(0);
  });
});
