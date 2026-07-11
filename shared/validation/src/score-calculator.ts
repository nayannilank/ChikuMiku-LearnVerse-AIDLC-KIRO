/**
 * Calculates the score as a floored percentage.
 *
 * @param correct - Number of correct answers (0 ≤ correct ≤ total)
 * @param total - Total number of questions (must be ≥ 1)
 * @returns Floor of (correct / total) × 100, or 0 if total is invalid
 */
export function calculateScorePercentage(correct: number, total: number): number {
  if (
    !Number.isFinite(total) ||
    !Number.isInteger(total) ||
    total <= 0
  ) {
    return 0;
  }

  if (
    !Number.isFinite(correct) ||
    correct < 0
  ) {
    return 0;
  }

  return Math.floor((correct / total) * 100);
}
