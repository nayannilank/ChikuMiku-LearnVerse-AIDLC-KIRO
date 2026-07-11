/**
 * Account Lockout Manager
 *
 * Pure logic module for account lockout functionality.
 * Tracks consecutive failed login attempts and enforces a 15-minute lockout
 * after 5 consecutive failures. No DB access — the calling login handler
 * passes in attempt data.
 *
 * Validates: Requirements 3.5
 */

/** Maximum consecutive failed attempts before lockout. */
export const MAX_ATTEMPTS = 5;

/** Lockout duration in milliseconds (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Determines whether an account is currently locked.
 *
 * An account is locked when:
 * - The number of consecutive failed attempts is >= MAX_ATTEMPTS (5), AND
 * - Less than 15 minutes have elapsed since the last failed attempt.
 *
 * @param failedAttempts - The number of consecutive failed login attempts.
 * @param lastFailedAt - Timestamp of the most recent failed attempt, or null if none.
 * @param now - The current time.
 * @returns true if the account is locked, false otherwise.
 */
export function isAccountLocked(
  failedAttempts: number,
  lastFailedAt: Date | null,
  now: Date,
): boolean {
  if (failedAttempts < MAX_ATTEMPTS) {
    return false;
  }

  if (lastFailedAt === null) {
    return false;
  }

  const elapsedMs = now.getTime() - lastFailedAt.getTime();
  return elapsedMs < LOCKOUT_DURATION_MS;
}

/**
 * Records a failed login attempt by incrementing the attempt counter.
 *
 * @param currentAttempts - The current number of consecutive failed attempts.
 * @returns The new attempt count (currentAttempts + 1).
 */
export function recordFailedAttempt(currentAttempts: number): number {
  return currentAttempts + 1;
}

/**
 * Resets the failed attempt counter (called on successful login).
 *
 * @returns 0
 */
export function resetAttempts(): number {
  return 0;
}

/**
 * Returns a generic lockout message that does not reveal which field
 * (username or password) was incorrect — preventing information leakage.
 *
 * @returns A user-facing lockout message.
 */
export function getLockoutMessage(): string {
  return 'Account is temporarily locked. Please try again later.';
}

/**
 * Calculates the number of seconds remaining in the lockout period.
 *
 * @param lastFailedAt - Timestamp of the most recent failed attempt.
 * @param now - The current time.
 * @returns Seconds remaining (floored), or 0 if the lockout has expired.
 */
export function getLockoutRemainingSeconds(
  lastFailedAt: Date,
  now: Date,
): number {
  const elapsedMs = now.getTime() - lastFailedAt.getTime();
  const remainingMs = LOCKOUT_DURATION_MS - elapsedMs;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.floor(remainingMs / 1000);
}
