/**
 * Streak Calculator — shared client + server logic.
 *
 * Streak rules (Requirements 5.1, 5.2, 5.3):
 *  - A day with qualifying activity increments the streak by 1.
 *  - Missing exactly 1 day does NOT reset the streak (grace-day rule).
 *  - Missing 2 or more consecutive days resets the streak to 0.
 */

/**
 * Returns the number of days between two ISO date strings (YYYY-MM-DD).
 * The result is always a non-negative integer (absolute difference).
 */
function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.round(Math.abs(b - a) / msPerDay);
}

/**
 * Compute the current streak from an ordered array of active day strings.
 *
 * @param activityDays - Chronologically ordered ISO date strings (YYYY-MM-DD)
 *                       representing days on which qualifying activity occurred.
 *                       Duplicate dates are treated as a single active day.
 * @returns The current streak count.
 *
 * Algorithm:
 *  Walk the deduplicated, sorted date array from the end (most recent).
 *  Build the streak going backwards: if the gap to the previous day is 1
 *  (consecutive) or 2 (single gap / grace day), the streak continues;
 *  otherwise (gap ≥ 3) the streak ends.
 *
 * NOTE: A "streak" counts active days, not calendar days spanning them.
 *  e.g. [Mon, Tue, Thu] → streak = 3 because each active day counts even
 *  though Wed was skipped (single gap).
 */
export function calculateStreak(activityDays: string[]): number {
  if (activityDays.length === 0) return 0;

  // Deduplicate and sort ascending
  const unique = [...new Set(activityDays)].sort();

  let streak = 1; // the most-recent day always contributes 1

  // Walk backwards from the last day
  for (let i = unique.length - 1; i > 0; i--) {
    const gap = daysBetween(unique[i - 1], unique[i]);
    if (gap <= 2) {
      // 1 = consecutive day, 2 = single gap (grace day) — both allowed
      streak += 1;
    } else {
      // Gap of 3+ days: streak is broken; stop accumulating
      break;
    }
  }

  return streak;
}

/**
 * Determine whether the streak should be reset to 0.
 *
 * Returns `true` when the gap between `lastActiveDate` and `currentDate` is
 * 2 or more consecutive calendar days without activity (Requirement 5.2).
 *
 * @param lastActiveDate - ISO date string of the last day with activity.
 * @param currentDate    - ISO date string of the day being evaluated.
 */
export function shouldReset(lastActiveDate: string, currentDate: string): boolean {
  const gap = daysBetween(lastActiveDate, currentDate);
  // gap == 0 → same day (no reset)
  // gap == 1 → next consecutive day (no reset)
  // gap == 2 → single missed day, grace period (no reset per Req 5.3)
  // gap >= 3 → 2+ consecutive days without activity → reset
  return gap >= 3;
}

/**
 * Determine whether `currentDate` should increment the streak.
 *
 * Returns `true` when:
 *  1. `currentDate` is not already in `activityDays` (new day), AND
 *  2. The current date is within the grace window of the last active day —
 *     i.e., the gap is 1 (consecutive) or 2 (single grace day), OR there are
 *     no prior activity days at all (first ever activity starts a streak).
 *
 * @param activityDays - Chronologically ordered ISO date strings.
 * @param currentDate  - ISO date string of the day being evaluated.
 */
export function shouldIncrement(activityDays: string[], currentDate: string): boolean {
  // If the day is already recorded, it cannot increment again
  if (activityDays.includes(currentDate)) return false;

  // First ever activity — always starts a streak of 1
  if (activityDays.length === 0) return true;

  const sorted = [...new Set(activityDays)].sort();
  const lastActiveDate = sorted[sorted.length - 1];

  const gap = daysBetween(lastActiveDate, currentDate);

  // Only increment if within the grace window (consecutive or single gap)
  // and currentDate is actually after lastActiveDate
  return gap >= 1 && gap <= 2 && currentDate > lastActiveDate;
}
