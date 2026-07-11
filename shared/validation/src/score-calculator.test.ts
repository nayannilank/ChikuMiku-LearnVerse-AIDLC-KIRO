import * as fc from 'fast-check';
import { calculateScorePercentage } from './score-calculator';

describe('calculateScorePercentage', () => {
  describe('typical usage', () => {
    it.each([
      [0, 10, 0],
      [1, 10, 10],
      [5, 10, 50],
      [9, 10, 90],
      [10, 10, 100],
      [1, 3, 33],   // floor(33.33...) = 33
      [2, 3, 66],   // floor(66.66...) = 66
      [3, 3, 100],
      [1, 1, 100],
      [7, 20, 35],
    ])('returns %d%% for %d correct out of %d', (correct, total, expected) => {
      expect(calculateScorePercentage(correct, total)).toBe(expected);
    });
  });

  describe('floor behaviour', () => {
    it('floors the result (does not round)', () => {
      // 1/3 = 33.33... -> floor = 33, not 34
      expect(calculateScorePercentage(1, 3)).toBe(33);
      // 2/3 = 66.66... -> floor = 66, not 67
      expect(calculateScorePercentage(2, 3)).toBe(66);
    });
  });

  describe('edge cases – invalid total', () => {
    it('returns 0 when total is 0', () => {
      expect(calculateScorePercentage(0, 0)).toBe(0);
    });

    it('returns 0 when total is negative', () => {
      expect(calculateScorePercentage(0, -1)).toBe(0);
    });

    it('returns 0 when total is a non-integer', () => {
      expect(calculateScorePercentage(1, 2.5)).toBe(0);
    });

    it('returns 0 when total is NaN', () => {
      expect(calculateScorePercentage(0, NaN)).toBe(0);
    });

    it('returns 0 when total is Infinity', () => {
      expect(calculateScorePercentage(0, Infinity)).toBe(0);
    });
  });

  describe('edge cases – invalid correct', () => {
    it('returns 0 when correct is NaN', () => {
      expect(calculateScorePercentage(NaN, 10)).toBe(0);
    });

    it('returns 0 when correct is -Infinity', () => {
      expect(calculateScorePercentage(-Infinity, 10)).toBe(0);
    });

    it('returns 0 when correct is negative', () => {
      expect(calculateScorePercentage(-1, 10)).toBe(0);
    });
  });

  describe('boundary values', () => {
    it('returns 0 for 0 correct out of 1', () => {
      expect(calculateScorePercentage(0, 1)).toBe(0);
    });

    it('returns 100 for 1 correct out of 1', () => {
      expect(calculateScorePercentage(1, 1)).toBe(100);
    });
  });

  /**
   * Property-based tests
   * Validates: Requirements 11.6, 13.9
   */
  describe('properties', () => {
    it('result is always an integer in [0, 100] for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }).chain((total) =>
            fc.tuple(fc.integer({ min: 0, max: total }), fc.constant(total))
          ),
          ([correct, total]) => {
            const result = calculateScorePercentage(correct, total);
            expect(Number.isInteger(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThanOrEqual(100);
          }
        )
      );
    });

    it('result is monotonically non-decreasing as correct increases (same total)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }).chain((total) =>
            fc.tuple(
              fc.integer({ min: 0, max: total }),
              fc.integer({ min: 0, max: total }),
              fc.constant(total)
            )
          ),
          ([a, b, total]) => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            expect(calculateScorePercentage(lo, total)).toBeLessThanOrEqual(
              calculateScorePercentage(hi, total)
            );
          }
        )
      );
    });

    it('returns 0 for any non-positive or non-integer total', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000, max: 0 }),          // non-positive integers
            fc.float({ min: Math.fround(0.001), max: Math.fround(1000), noNaN: true, noDefaultInfinity: true })
              .filter((n) => !Number.isInteger(n))       // fractional positives
          ),
          (total) => {
            expect(calculateScorePercentage(0, total)).toBe(0);
          }
        )
      );
    });

    it('result equals floor((correct / total) * 100) for valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }).chain((total) =>
            fc.tuple(fc.integer({ min: 0, max: total }), fc.constant(total))
          ),
          ([correct, total]) => {
            const expected = Math.floor((correct / total) * 100);
            expect(calculateScorePercentage(correct, total)).toBe(expected);
          }
        )
      );
    });
  });
});
