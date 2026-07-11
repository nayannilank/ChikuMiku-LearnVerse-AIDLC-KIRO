/**
 * Property-based tests for account lockout logic.
 * Feature: chikumiku-learnverse, Property 19: Account Lockout Logic
 *
 * **Validates: Requirements 3.5**
 *
 * Generate attempt counts 1-10, verify lockout iff attempts ≥ 5,
 * and authentication remains available for 1-4 attempts.
 */
import * as fc from 'fast-check';
import {
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  isAccountLocked,
  recordFailedAttempt,
  resetAttempts,
} from './lockout-manager';

// --- Arbitraries ---

/** Attempt counts below lockout threshold (1-4) */
const belowThresholdAttemptsArb = fc.integer({ min: 1, max: MAX_ATTEMPTS - 1 });

/** Attempt counts at or above lockout threshold (5-10) */
const atOrAboveThresholdAttemptsArb = fc.integer({ min: MAX_ATTEMPTS, max: 10 });

/** Any attempt count from 1-10 */
const anyAttemptCountArb = fc.integer({ min: 1, max: 10 });

/**
 * Generate a lastFailedAt timestamp and a "now" timestamp within the lockout window.
 * Ensures now > lastFailedAt and elapsed < LOCKOUT_DURATION_MS.
 */
const withinLockoutWindowArb = fc
  .tuple(
    fc.integer({ min: 1_000_000_000_000, max: 1_800_000_000_000 }), // base timestamp (ms)
    fc.integer({ min: 1, max: LOCKOUT_DURATION_MS - 1 }), // elapsed ms (strictly within window)
  )
  .map(([baseMs, elapsedMs]) => ({
    lastFailedAt: new Date(baseMs),
    now: new Date(baseMs + elapsedMs),
  }));

/**
 * Generate a lastFailedAt timestamp and a "now" timestamp beyond the lockout window.
 * Ensures now > lastFailedAt and elapsed >= LOCKOUT_DURATION_MS.
 */
const beyondLockoutWindowArb = fc
  .tuple(
    fc.integer({ min: 1_000_000_000_000, max: 1_800_000_000_000 }), // base timestamp (ms)
    fc.integer({ min: LOCKOUT_DURATION_MS, max: LOCKOUT_DURATION_MS * 3 }), // elapsed ms (beyond window)
  )
  .map(([baseMs, elapsedMs]) => ({
    lastFailedAt: new Date(baseMs),
    now: new Date(baseMs + elapsedMs),
  }));

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 19: Account Lockout Logic', () => {
  it('accounts with 1-4 attempts are never locked regardless of timing', () => {
    fc.assert(
      fc.property(
        belowThresholdAttemptsArb,
        withinLockoutWindowArb,
        (attempts, { lastFailedAt, now }) => {
          const locked = isAccountLocked(attempts, lastFailedAt, now);
          expect(locked).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accounts with 5-10 attempts are locked when within 15-minute window', () => {
    fc.assert(
      fc.property(
        atOrAboveThresholdAttemptsArb,
        withinLockoutWindowArb,
        (attempts, { lastFailedAt, now }) => {
          const locked = isAccountLocked(attempts, lastFailedAt, now);
          expect(locked).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accounts with 5-10 attempts are unlocked when beyond 15-minute window', () => {
    fc.assert(
      fc.property(
        atOrAboveThresholdAttemptsArb,
        beyondLockoutWindowArb,
        (attempts, { lastFailedAt, now }) => {
          const locked = isAccountLocked(attempts, lastFailedAt, now);
          expect(locked).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('recordFailedAttempt always returns currentAttempts + 1', () => {
    fc.assert(
      fc.property(anyAttemptCountArb, (attempts) => {
        const result = recordFailedAttempt(attempts);
        expect(result).toBe(attempts + 1);
      }),
      { numRuns: 100 },
    );
  });

  it('resetAttempts always returns 0', () => {
    fc.assert(
      fc.property(anyAttemptCountArb, () => {
        const result = resetAttempts();
        expect(result).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
