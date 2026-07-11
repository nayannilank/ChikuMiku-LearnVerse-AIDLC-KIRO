import { calculateStreak, shouldReset, shouldIncrement } from './streak-calculator';

describe('calculateStreak', () => {
  it('returns 0 for an empty array', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('returns 1 for a single active day', () => {
    expect(calculateStreak(['2024-01-15'])).toBe(1);
  });

  it('returns count of consecutive active days', () => {
    expect(calculateStreak(['2024-01-01', '2024-01-02', '2024-01-03'])).toBe(3);
  });

  it('maintains streak across a single-gap day (grace day)', () => {
    // Active on Day 1, skip Day 2, active on Day 3
    expect(calculateStreak(['2024-01-01', '2024-01-03'])).toBe(2);
  });

  it('resets streak on 2+ consecutive missed days', () => {
    // Active Day 1, miss Day 2 + Day 3, active Day 4
    // Gap from Jan 1 to Jan 4 is 3 days → streak broken
    expect(calculateStreak(['2024-01-01', '2024-01-04'])).toBe(1);
  });

  it('counts only the current (latest) streak segment', () => {
    // Two segments: [Jan 1, Jan 2] and then gap of 3 → [Jan 5, Jan 6, Jan 7]
    const days = ['2024-01-01', '2024-01-02', '2024-01-05', '2024-01-06', '2024-01-07'];
    expect(calculateStreak(days)).toBe(3);
  });

  it('handles mixed consecutive and grace days in one streak', () => {
    // Jan 1, Jan 2, (skip Jan 3), Jan 4, Jan 5
    const days = ['2024-01-01', '2024-01-02', '2024-01-04', '2024-01-05'];
    expect(calculateStreak(days)).toBe(4);
  });

  it('deduplicates repeated dates', () => {
    expect(calculateStreak(['2024-01-01', '2024-01-01', '2024-01-02'])).toBe(2);
  });
});

describe('shouldReset', () => {
  it('returns false for same day', () => {
    expect(shouldReset('2024-01-10', '2024-01-10')).toBe(false);
  });

  it('returns false for next consecutive day (gap=1)', () => {
    expect(shouldReset('2024-01-10', '2024-01-11')).toBe(false);
  });

  it('returns false for single grace day (gap=2)', () => {
    expect(shouldReset('2024-01-10', '2024-01-12')).toBe(false);
  });

  it('returns true for 2 missed consecutive days (gap=3)', () => {
    // Last active Jan 10, no activity Jan 11 & 12, now is Jan 13
    expect(shouldReset('2024-01-10', '2024-01-13')).toBe(true);
  });

  it('returns true for larger gaps', () => {
    expect(shouldReset('2024-01-01', '2024-01-10')).toBe(true);
  });
});

describe('shouldIncrement', () => {
  it('returns true for first ever activity (empty array)', () => {
    expect(shouldIncrement([], '2024-01-15')).toBe(true);
  });

  it('returns true for the next consecutive day', () => {
    expect(shouldIncrement(['2024-01-10'], '2024-01-11')).toBe(true);
  });

  it('returns true for a day after single grace gap', () => {
    // Last active Jan 10, skip Jan 11, now Jan 12
    expect(shouldIncrement(['2024-01-10'], '2024-01-12')).toBe(true);
  });

  it('returns false for same day already recorded', () => {
    expect(shouldIncrement(['2024-01-10'], '2024-01-10')).toBe(false);
  });

  it('returns false when gap is 3+ days (streak broken)', () => {
    expect(shouldIncrement(['2024-01-10'], '2024-01-13')).toBe(false);
  });

  it('returns false for a date before the last active date', () => {
    expect(shouldIncrement(['2024-01-10'], '2024-01-09')).toBe(false);
  });

  it('returns true when currentDate extends a multi-day array', () => {
    const days = ['2024-01-08', '2024-01-09', '2024-01-10'];
    expect(shouldIncrement(days, '2024-01-11')).toBe(true);
  });
});
