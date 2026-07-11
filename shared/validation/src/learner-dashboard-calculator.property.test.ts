/**
 * Property-based tests for learner dashboard completion calculations.
 * Feature: chikumiku-learnverse, Property 15: Learner Dashboard Completion Percentage
 *
 * **Validates: Requirements 15.1, 15.2**
 *
 * For any pagesRead R and totalPages T where 0 ≤ R ≤ T and T ≥ 1,
 * the completion percentage SHALL equal round((R / T) × 100) and be an integer in [0, 100].
 * Pages left SHALL equal T - R and be an integer in [0, T].
 */
import * as fc from 'fast-check';
import {
  calculateLearnerCompletion,
  calculatePagesLeft,
} from './learner-dashboard-calculator';

// --- Arbitraries ---

/** Generate a pair (R, T) where T ≥ 1 and 0 ≤ R ≤ T */
const learnerProgressArb = fc
  .integer({ min: 1, max: 10_000 })
  .chain((totalPages) =>
    fc.integer({ min: 0, max: totalPages }).map((pagesRead) => ({
      pagesRead,
      totalPages,
    })),
  );

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 15: Learner Dashboard Completion Percentage', () => {
  it('completion equals round((pagesRead / totalPages) × 100)', () => {
    fc.assert(
      fc.property(learnerProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculateLearnerCompletion(pagesRead, totalPages);
        const expected = Math.round((pagesRead / totalPages) * 100);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('completion is always an integer in [0, 100]', () => {
    fc.assert(
      fc.property(learnerProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculateLearnerCompletion(pagesRead, totalPages);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });

  it('pages left equals totalPages - pagesRead', () => {
    fc.assert(
      fc.property(learnerProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculatePagesLeft(totalPages, pagesRead);
        const expected = totalPages - pagesRead;
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('pages left is always an integer in [0, totalPages]', () => {
    fc.assert(
      fc.property(learnerProgressArb, ({ pagesRead, totalPages }) => {
        const result = calculatePagesLeft(totalPages, pagesRead);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(totalPages);
      }),
      { numRuns: 200 },
    );
  });
});
