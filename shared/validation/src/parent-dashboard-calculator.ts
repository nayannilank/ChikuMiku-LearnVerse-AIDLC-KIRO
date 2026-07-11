/**
 * Parent Dashboard completion calculators.
 *
 * Calculates chapter reading completion and exercise completion percentages
 * for the Parent Dashboard display.
 *
 * Validates: Requirement 14.1
 */

/**
 * Calculates chapter completion percentage as floor((pagesRead / totalPages) × 100).
 * Returns 0 if totalPages <= 0 (defensive).
 * Clamps pagesRead to [0, totalPages].
 */
export function calculateParentCompletion(
  pagesRead: number,
  totalPages: number
): number {
  if (totalPages <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(pagesRead, totalPages));
  return Math.floor((clamped / totalPages) * 100);
}

/**
 * Calculates exercise completion percentage as floor((correct / total) × 100).
 * Returns 0 if total <= 0 (defensive).
 * Clamps correct to [0, total].
 */
export function calculateExerciseCompletion(
  correct: number,
  total: number
): number {
  if (total <= 0) {
    return 0;
  }

  const clamped = Math.max(0, Math.min(correct, total));
  return Math.floor((clamped / total) * 100);
}
