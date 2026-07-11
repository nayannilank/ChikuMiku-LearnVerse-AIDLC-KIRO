/**
 * Property-based tests for exercise score calculation.
 * Feature: chikumiku-learnverse, Property 10: Exercise Score Calculation
 *
 * **Validates: Requirements 11.6**
 *
 * For any correct C and total N where 0 ≤ C ≤ N and N ≥ 1,
 * the score percentage SHALL equal floor((C / N) × 100) and be an integer in [0, 100].
 */
import * as fc from 'fast-check';
import { calculateScorePercentage } from './score-calculator';

// --- Arbitraries ---

/** Generate a pair (C, N) where N ≥ 1 and 0 ≤ C ≤ N */
const validScoreInputArb = fc
  .integer({ min: 1, max: 10_000 })
  .chain((total) =>
    fc.integer({ min: 0, max: total }).map((correct) => ({
      correct,
      total,
    })),
  );

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 10: Exercise Score Calculation', () => {
  it('result equals floor((C / N) × 100) for valid inputs', () => {
    fc.assert(
      fc.property(validScoreInputArb, ({ correct, total }) => {
        const result = calculateScorePercentage(correct, total);
        const expected = Math.floor((correct / total) * 100);
        expect(result).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('result is always an integer in [0, 100] for valid inputs', () => {
    fc.assert(
      fc.property(validScoreInputArb, ({ correct, total }) => {
        const result = calculateScorePercentage(correct, total);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });

  it('result is monotonically non-decreasing as C increases (with same N)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10_000 }),
        (total) => {
          let previousScore = -1;
          for (let c = 0; c <= total; c++) {
            const score = calculateScorePercentage(c, total);
            expect(score).toBeGreaterThanOrEqual(previousScore);
            previousScore = score;
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('when C = 0, result is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        (total) => {
          const result = calculateScorePercentage(0, total);
          expect(result).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('when C = N, result is 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        (total) => {
          const result = calculateScorePercentage(total, total);
          expect(result).toBe(100);
        },
      ),
      { numRuns: 200 },
    );
  });
});
