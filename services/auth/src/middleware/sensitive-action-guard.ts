/**
 * Sensitive action guard middleware.
 *
 * Blocks sensitive actions (account deletion, data export, learner removal)
 * unless the parent has recently re-authenticated by verifying their password.
 *
 * Requirements: 20.4
 */

/** Verification window: 5 minutes in milliseconds. */
export const VERIFICATION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Determines whether a sensitive action is authorized based on
 * the timestamp of the last successful password verification.
 *
 * @param lastVerifiedAt - Timestamp of the last successful password verification, or null if never verified.
 * @param now - The current time to compare against.
 * @returns true if the verification is still valid (within 5-minute window), false otherwise.
 */
export function isSensitiveActionAuthorized(
  lastVerifiedAt: Date | null,
  now: Date
): boolean {
  if (lastVerifiedAt === null) {
    return false;
  }

  const elapsed = now.getTime() - lastVerifiedAt.getTime();
  return elapsed >= 0 && elapsed < VERIFICATION_WINDOW_MS;
}
