/**
 * Unit tests for Academic Year Content Organization module.
 *
 * Requirements: 21.4, 21.5
 */

import {
  determineAcademicYear,
  getAcademicYearForGrade,
  getAccessMode,
  isCurrentYear,
} from './index';

describe('determineAcademicYear', () => {
  it('returns previous-current year for January', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    expect(determineAcademicYear(date)).toBe('2024-2025');
  });

  it('returns previous-current year for February', () => {
    const date = new Date(2025, 1, 28); // Feb 28, 2025
    expect(determineAcademicYear(date)).toBe('2024-2025');
  });

  it('returns previous-current year for March', () => {
    const date = new Date(2025, 2, 31); // Mar 31, 2025
    expect(determineAcademicYear(date)).toBe('2024-2025');
  });

  it('returns current-next year for April', () => {
    const date = new Date(2025, 3, 1); // Apr 1, 2025
    expect(determineAcademicYear(date)).toBe('2025-2026');
  });

  it('returns current-next year for June', () => {
    const date = new Date(2024, 5, 15); // Jun 15, 2024
    expect(determineAcademicYear(date)).toBe('2024-2025');
  });

  it('returns current-next year for December', () => {
    const date = new Date(2024, 11, 31); // Dec 31, 2024
    expect(determineAcademicYear(date)).toBe('2024-2025');
  });

  it('handles year boundary correctly (Dec 31 → Jan 1)', () => {
    const dec31 = new Date(2024, 11, 31);
    const jan1 = new Date(2025, 0, 1);
    // Both should be in the same academic year 2024-2025
    expect(determineAcademicYear(dec31)).toBe('2024-2025');
    expect(determineAcademicYear(jan1)).toBe('2024-2025');
  });

  it('handles academic year transition at March/April boundary', () => {
    const mar31 = new Date(2025, 2, 31);
    const apr1 = new Date(2025, 3, 1);
    // Mar 31 2025 → 2024-2025, Apr 1 2025 → 2025-2026
    expect(determineAcademicYear(mar31)).toBe('2024-2025');
    expect(determineAcademicYear(apr1)).toBe('2025-2026');
  });
});

describe('getAcademicYearForGrade', () => {
  it('returns academic year based on creation date, not grade value', () => {
    const creationDate = new Date(2024, 5, 10); // Jun 10, 2024
    expect(getAcademicYearForGrade('5th', creationDate)).toBe('2024-2025');
    expect(getAcademicYearForGrade('12th', creationDate)).toBe('2024-2025');
    expect(getAcademicYearForGrade('LKG', creationDate)).toBe('2024-2025');
  });

  it('handles chapter created in Jan-Mar correctly', () => {
    const creationDate = new Date(2025, 1, 15); // Feb 15, 2025
    expect(getAcademicYearForGrade('3rd', creationDate)).toBe('2024-2025');
  });

  it('handles chapter created in Apr-Dec correctly', () => {
    const creationDate = new Date(2025, 3, 1); // Apr 1, 2025
    expect(getAcademicYearForGrade('3rd', creationDate)).toBe('2025-2026');
  });
});

describe('getAccessMode', () => {
  it('returns read-write when chapter year matches current year', () => {
    expect(getAccessMode('2024-2025', '2024-2025')).toBe('read-write');
  });

  it('returns read-only when chapter year is before current year', () => {
    expect(getAccessMode('2023-2024', '2024-2025')).toBe('read-only');
  });

  it('returns read-only when chapter year is two years prior', () => {
    expect(getAccessMode('2022-2023', '2024-2025')).toBe('read-only');
  });

  it('returns read-only when chapter year is three years prior', () => {
    expect(getAccessMode('2021-2022', '2024-2025')).toBe('read-only');
  });

  it('returns read-only for future academic year (edge case)', () => {
    // A future year would also not match current, so it's read-only
    expect(getAccessMode('2025-2026', '2024-2025')).toBe('read-only');
  });
});

describe('isCurrentYear', () => {
  it('returns true when the academic year matches the current date academic year', () => {
    const date = new Date(2024, 8, 1); // Sep 1, 2024 → academic year 2024-2025
    expect(isCurrentYear('2024-2025', date)).toBe(true);
  });

  it('returns false when the academic year does not match', () => {
    const date = new Date(2024, 8, 1); // Sep 1, 2024 → academic year 2024-2025
    expect(isCurrentYear('2023-2024', date)).toBe(false);
  });

  it('returns true for Jan-Mar dates within the same academic year', () => {
    const date = new Date(2025, 1, 15); // Feb 15, 2025 → academic year 2024-2025
    expect(isCurrentYear('2024-2025', date)).toBe(true);
  });

  it('returns false for Jan-Mar dates compared to the next academic year', () => {
    const date = new Date(2025, 1, 15); // Feb 15, 2025 → academic year 2024-2025
    expect(isCurrentYear('2025-2026', date)).toBe(false);
  });
});
