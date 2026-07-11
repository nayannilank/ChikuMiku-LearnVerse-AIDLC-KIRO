/**
 * Learner Dashboard completion calculators.
 *
 * Calculates chapter reading completion percentage and pages left
 * for the Learner Dashboard display.
 *
 * Validates: Requirements 15.1, 15.2
 */

/**
 * Calculates chapter completion percentage as round((pagesRead / totalPages) × 100).
 * Returns 0 if totalPages <= 0 (defensive).
 * Clamps pagesRead to [0, totalPages].
 *
 * NOTE: Uses Math.round (not Math.floor like the parent dashboard calculator).
 */
export function calculateLearnerCompletion(
  pagesRead: number,
  totalPages: number
): number {
  if (totalPages <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(pagesRead, totalPages));
  return Math.round((clamped / totalPages) * 100);
}

/**
 * Calculates pages left as totalPages - pagesRead.
 * Clamps pagesRead to [0, totalPages] so result is always >= 0.
 * Returns 0 if totalPages <= 0 (defensive).
 */
export function calculatePagesLeft(
  totalPages: number,
  pagesRead: number
): number {
  if (totalPages <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(pagesRead, totalPages));
  return totalPages - clamped;
}
