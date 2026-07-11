/**
 * Property-based tests for revision quiz timer validation.
 * Feature: chikumiku-learnverse, Property 12: Revision Quiz Timer Validation
 *
 * **Validates: Requirements 13.3**
 *
 * For any integer, the validator SHALL accept iff the value is divisible by 5
 * and within the range [5, 120]. All other values SHALL be rejected with
 * "Timer must be a multiple of 5 between 5 and 120 minutes".
 */
import * as fc from 'fast-check';
import { validateTimer } from './timer-validator';

const MIN_TIMER = 5;
const MAX_TIMER = 120;
const TIMER_STEP = 5;
const ERROR_MESSAGE = 'Timer must be a multiple of 5 between 5 and 120 minutes';

// --- Arbitraries ---

/** Valid timer: a multiple of 5 in [5, 120] */
const validTimerArb = fc.integer({ min: MIN_TIMER / TIMER_STEP, max: MAX_TIMER / TIMER_STEP }).map((n) => n * TIMER_STEP);

/** Invalid timer (not a multiple of 5 but within [5, 120]) */
const notMultipleOf5Arb = fc.integer({ min: MIN_TIMER, max: MAX_TIMER }).filter((n) => n % TIMER_STEP !== 0);

/** Invalid timer (below range): integers < 5 */
const belowRangeArb = fc.integer({ min: -1000, max: MIN_TIMER - 1 });

/** Invalid timer (above range): integers > 120 */
const aboveRangeArb = fc.integer({ min: MAX_TIMER + 1, max: 10000 });

/** Invalid timer (non-integer): floating-point numbers */
const nonIntegerArb = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }).filter((n) => !Number.isInteger(n));

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 12: Revision Quiz Timer Validation', () => {
  it('accepts all multiples of 5 within [5, 120]', () => {
    fc.assert(
      fc.property(validTimerArb, (minutes: number) => {
        const result = validateTimer(minutes);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 200 },
    );
  });

  it('rejects integers in [5, 120] that are not multiples of 5', () => {
    fc.assert(
      fc.property(notMultipleOf5Arb, (minutes: number) => {
        const result = validateTimer(minutes);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('timer');
        expect(result.errors['timer']).toBe(ERROR_MESSAGE);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects integers below the minimum (< 5)', () => {
    fc.assert(
      fc.property(belowRangeArb, (minutes: number) => {
        const result = validateTimer(minutes);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('timer');
        expect(result.errors['timer']).toBe(ERROR_MESSAGE);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects integers above the maximum (> 120)', () => {
    fc.assert(
      fc.property(aboveRangeArb, (minutes: number) => {
        const result = validateTimer(minutes);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('timer');
        expect(result.errors['timer']).toBe(ERROR_MESSAGE);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects non-integer (floating-point) values', () => {
    fc.assert(
      fc.property(nonIntegerArb, (minutes: number) => {
        const result = validateTimer(minutes);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('timer');
        expect(result.errors['timer']).toBe(ERROR_MESSAGE);
      }),
      { numRuns: 200 },
    );
  });

  it('validates boundaries: 5 and 120 are valid, 4 and 121 are invalid', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Lower boundary: 5 is valid
        const validLower = validateTimer(MIN_TIMER);
        expect(validLower.valid).toBe(true);
        expect(validLower.errors).toEqual({});

        // Upper boundary: 120 is valid
        const validUpper = validateTimer(MAX_TIMER);
        expect(validUpper.valid).toBe(true);
        expect(validUpper.errors).toEqual({});

        // Just below lower boundary: 4 is invalid
        const invalidLower = validateTimer(MIN_TIMER - 1);
        expect(invalidLower.valid).toBe(false);
        expect(invalidLower.errors['timer']).toBe(ERROR_MESSAGE);

        // Just above upper boundary: 121 is invalid
        const invalidUpper = validateTimer(MAX_TIMER + 1);
        expect(invalidUpper.valid).toBe(false);
        expect(invalidUpper.errors['timer']).toBe(ERROR_MESSAGE);
      }),
      { numRuns: 200 },
    );
  });
});
