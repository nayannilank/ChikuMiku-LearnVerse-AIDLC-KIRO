/**
 * Property-based tests for streak calculation.
 * Feature: chikumiku-learnverse, Property 2: Streak Calculation Consistency
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * For any ordered sequence of calendar dates representing learner activity days,
 * the streak calculator SHALL produce a streak count that:
 * (a) increments by exactly 1 for each consecutive active day or single-gap day,
 * (b) resets to 0 when 2 or more consecutive calendar days have no activity, and
 * (c) never decreases during a run of consecutive active days.
 */
import * as fc from 'fast-check';
import { calculateStreak, shouldReset, shouldIncrement } from './streak-calculator';

// --- Helpers ---

/** Format a Date as YYYY-MM-DD */
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Add days to a date */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// --- Arbitraries ---

/** Base date as epoch day offset — avoids NaN issues with fc.date() shrinking */
const baseDayArb = fc.integer({ min: 18262, max: 19723 }); // 2020-01-01 to 2024-01-01 in days since epoch

/** Convert epoch day to a Date */
function fromEpochDay(day: number): Date {
  return new Date(day * 24 * 60 * 60 * 1000);
}

/**
 * Generate an ordered sequence of unique dates with controlled gaps.
 * Gaps between consecutive dates are 1 (consecutive) or 2 (single-gap / grace day).
 * This produces a sequence where the streak should equal the total number of active days.
 */
const consecutiveOrGraceDateSeqArb = fc
  .integer({ min: 2, max: 30 })
  .chain((length) =>
    fc
      .tuple(
        baseDayArb,
        fc.array(fc.integer({ min: 1, max: 2 }), { minLength: length - 1, maxLength: length - 1 }),
      )
      .map(([startDay, gaps]) => {
        const startDate = fromEpochDay(startDay);
        const dates: string[] = [toISO(startDate)];
        let current = startDate;
        for (const gap of gaps) {
          current = addDays(current, gap);
          dates.push(toISO(current));
        }
        return dates;
      }),
  );

/**
 * Generate an ordered date sequence that contains at least one large gap (≥ 3 days).
 * This tests the reset behavior.
 */
const dateSeqWithResetArb = fc
  .tuple(
    baseDayArb,
    fc.array(fc.integer({ min: 1, max: 2 }), { minLength: 1, maxLength: 10 }),
    fc.integer({ min: 3, max: 10 }), // the large gap that resets the streak
    fc.array(fc.integer({ min: 1, max: 2 }), { minLength: 1, maxLength: 10 }),
  )
  .map(([startDay, preGaps, resetGap, postGaps]) => {
    const startDate = fromEpochDay(startDay);
    const dates: string[] = [toISO(startDate)];
    let current = startDate;

    // Build pre-reset segment
    for (const gap of preGaps) {
      current = addDays(current, gap);
      dates.push(toISO(current));
    }

    // Add the reset gap
    current = addDays(current, resetGap);
    dates.push(toISO(current));

    // Build post-reset segment
    for (const gap of postGaps) {
      current = addDays(current, gap);
      dates.push(toISO(current));
    }

    return { dates, postResetLength: postGaps.length + 1 };
  });

/**
 * Generate a pair of dates with a specific gap for shouldReset testing.
 */
const datePairWithGapArb = fc
  .tuple(baseDayArb, fc.integer({ min: 0, max: 15 }))
  .map(([startDay, gap]) => ({
    lastActive: toISO(fromEpochDay(startDay)),
    current: toISO(addDays(fromEpochDay(startDay), gap)),
    gap,
  }));

/**
 * Generate an ordered date sequence with only consecutive (gap=1) days
 * for testing monotonic non-decrease property.
 */
const strictlyConsecutiveDateSeqArb = fc
  .tuple(baseDayArb, fc.integer({ min: 3, max: 20 }))
  .map(([startDay, length]) => {
    const startDate = fromEpochDay(startDay);
    const dates: string[] = [];
    for (let i = 0; i < length; i++) {
      dates.push(toISO(addDays(startDate, i)));
    }
    return dates;
  });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 2: Streak Calculation Consistency', () => {
  it('(a) streak increments by exactly 1 for each consecutive or single-gap day', () => {
    fc.assert(
      fc.property(consecutiveOrGraceDateSeqArb, (dates: string[]) => {
        const streak = calculateStreak(dates);
        // When all gaps are ≤ 2, every active day contributes to the streak.
        // The streak should equal the number of unique active days.
        expect(streak).toBe(dates.length);
      }),
      { numRuns: 200 },
    );
  });

  it('(b) streak resets to 0 on 2+ day gap (gap ≥ 3 between dates)', () => {
    fc.assert(
      fc.property(dateSeqWithResetArb, ({ dates, postResetLength }) => {
        const streak = calculateStreak(dates);
        // After a gap of 3+ days, only the post-reset segment contributes to the streak.
        // The streak should equal the number of days in the post-reset segment.
        expect(streak).toBe(postResetLength);
      }),
      { numRuns: 200 },
    );
  });

  it('(c) streak never decreases during consecutive active days', () => {
    fc.assert(
      fc.property(strictlyConsecutiveDateSeqArb, (dates: string[]) => {
        // Build up the streak incrementally and verify it never decreases
        let previousStreak = 0;
        for (let i = 1; i <= dates.length; i++) {
          const currentStreak = calculateStreak(dates.slice(0, i));
          expect(currentStreak).toBeGreaterThanOrEqual(previousStreak);
          previousStreak = currentStreak;
        }
      }),
      { numRuns: 200 },
    );
  });

  it('shouldReset returns true iff gap is ≥ 3', () => {
    fc.assert(
      fc.property(datePairWithGapArb, ({ lastActive, current, gap }) => {
        const result = shouldReset(lastActive, current);
        if (gap >= 3) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('shouldIncrement returns true for new date within grace window (gap 1-2)', () => {
    fc.assert(
      fc.property(
        fc.tuple(baseDayArb, fc.integer({ min: 1, max: 2 })),
        ([startDay, gap]) => {
          const startDate = fromEpochDay(startDay);
          const lastActive = toISO(startDate);
          const currentDate = toISO(addDays(startDate, gap));
          const activityDays = [lastActive];

          const result = shouldIncrement(activityDays, currentDate);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('shouldIncrement returns false for already-recorded date', () => {
    fc.assert(
      fc.property(
        consecutiveOrGraceDateSeqArb,
        fc.integer({ min: 0, max: 29 }),
        (dates: string[], indexRaw: number) => {
          const index = indexRaw % dates.length;
          const existingDate = dates[index];
          const result = shouldIncrement(dates, existingDate);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('empty activity array gives streak of 0', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const streak = calculateStreak([]);
        expect(streak).toBe(0);
      }),
      { numRuns: 200 },
    );
  });
});
