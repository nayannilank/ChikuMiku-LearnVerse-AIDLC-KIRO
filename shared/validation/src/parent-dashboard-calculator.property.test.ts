/**
 * Property-based tests for parent dashboard completion calculations.
 * Feature: chikumiku-learnverse, Property 14: Parent Dashboard Completion Percentage
 *
 * **Validates: Requirements 14.1**
 *
 * For any pagesRead R and totalPages T where 0 ≤ R ≤ T and T ≥ 1,
 * the completion percentage SHALL equal floor((R / T) × 100) and be an integer in [0, 100].
 * Similarly for exercise completion with correct answers A and total questions Q.
 */
import * as fc from 'fast-check';
import {
  calculateParentCompletion,
  calculateExerciseCompletion,
} from './parent-dashboard-calculator';

// --- Arbitraries ---

/** Generate a pair (R, T) where T ≥ 1 and 0 ≤ R ≤ T */
const chapterProgressArb = fc
  .integer({ min: 1, max: 10_000 })
  .chain((totalPages) =>
    fc.integer({ min: 0, max: totalPages }).map((pagesRead) => ({
      pagesRead,
      totalPages,
    })),
  );

/** Generate a pair (A, Q) where Q ≥ 1 and 0 ≤ A ≤ Q */
const exerciseProgressArb = fc
  .integer({ min: 1, max: 10_000 })
  .chain((totalQuestions) =>
    fc.integer({ min: 0, max: totalQuestions }).map((correct) => ({
      correct,
      totalQuestions,
    })),
  );

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 14: Parent Dashboard Completion Percentage', () => {
  it('chapter completion equals floor((pagesRead / totalPages) × 100)', () => {
    fc.assert(
      fc.property(chapterProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculateParentCompletion(pagesRead, totalPages);
        const expected = Math.floor((pagesRead / totalPages) * 100);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('chapter completion is always an integer in [0, 100]', () => {
    fc.assert(
      fc.property(chapterProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculateParentCompletion(pagesRead, totalPages);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });

  it('exercise completion equals floor((correct / totalQuestions) × 100)', () => {
    fc.assert(
      fc.property(exerciseProgressArb, ({ correct, totalQuestions }) => {
        const result = calculateExerciseCompletion(correct, totalQuestions);
        const expected = Math.floor((correct / totalQuestions) * 100);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('exercise completion is always an integer in [0, 100]', () => {
    fc.assert(
      fc.property(exerciseProgressArb, ({ correct, totalQuestions }) => {
        const result = calculateExerciseCompletion(correct, totalQuestions);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });
});
