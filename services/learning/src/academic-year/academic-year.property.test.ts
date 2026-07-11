/**
 * Property-Based Test: Academic Year Content Organization (Property 20)
 *
 * Feature: chikumiku-learnverse, Property 20: Academic Year Content Organization
 *
 * Validates: Requirements 21.4
 *
 * For any learner with a given grade, all chapters created during the current
 * academic year SHALL be accessible in read-write mode, and all chapters from
 * prior academic years SHALL be accessible only in read-only archive mode.
 */

import * as fc from 'fast-check';
import {
  determineAcademicYear,
  getAcademicYearForGrade,
  getAccessMode,
} from './index';

// --- Arbitraries ---

/** Generates a valid Date within a reasonable range (2000–2099). */
const dateArb = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
}).filter(d => !isNaN(d.getTime()));

/** Generates a grade string representative of Indian school grades. */
const gradeArb = fc.oneof(
  fc.constantFrom('LKG', 'UKG'),
  fc.integer({ min: 1, max: 12 }).map(n => {
    const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
  }),
);

/**
 * Generates a valid academic year string in "YYYY-YYYY" format
 * where the second year is exactly one more than the first.
 */
const academicYearArb = fc.integer({ min: 2000, max: 2098 }).map(
  startYear => `${startYear}-${startYear + 1}`,
);

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 20: Academic Year Content Organization', () => {
  /**
   * **Validates: Requirements 21.4**
   *
   * Property 20a: determineAcademicYear always produces a valid "YYYY-YYYY" format
   * where the second year is exactly one more than the first, and the mapping
   * follows the Indian academic year rule (Jan-Mar = prev-current, Apr-Dec = current-next).
   */
  it('determineAcademicYear produces correct "YYYY-YYYY" format for any date', () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = determineAcademicYear(date);

        // Must match "YYYY-YYYY" format
        const match = result.match(/^(\d{4})-(\d{4})$/);
        expect(match).not.toBeNull();

        const startYear = parseInt(match![1], 10);
        const endYear = parseInt(match![2], 10);

        // End year must be exactly start year + 1
        expect(endYear).toBe(startYear + 1);

        // Verify Indian academic year logic:
        // Jan(0), Feb(1), Mar(2) → year belongs to (prevYear)-(currentYear)
        // Apr(3) through Dec(11) → year belongs to (currentYear)-(nextYear)
        const month = date.getMonth();
        const calendarYear = date.getFullYear();

        if (month < 3) {
          // Jan-Mar: academic year starts in the previous calendar year
          expect(startYear).toBe(calendarYear - 1);
          expect(endYear).toBe(calendarYear);
        } else {
          // Apr-Dec: academic year starts in the current calendar year
          expect(startYear).toBe(calendarYear);
          expect(endYear).toBe(calendarYear + 1);
        }
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 21.4**
   *
   * Property 20b: getAcademicYearForGrade always returns the same result
   * as determineAcademicYear for the given creation date, regardless of grade.
   */
  it('getAcademicYearForGrade matches determineAcademicYear for any grade and creation date', () => {
    fc.assert(
      fc.property(gradeArb, dateArb, (grade, creationDate) => {
        const fromGradeFunction = getAcademicYearForGrade(grade, creationDate);
        const fromDateFunction = determineAcademicYear(creationDate);

        // Must always match — grade does not affect academic year determination
        expect(fromGradeFunction).toBe(fromDateFunction);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 21.4**
   *
   * Property 20c: getAccessMode returns 'read-write' when chapter academic year
   * matches the current academic year, and 'read-only' for any other year.
   */
  it('getAccessMode returns read-write for current year and read-only for any other year', () => {
    fc.assert(
      fc.property(
        academicYearArb,
        academicYearArb,
        (chapterYear, currentYear) => {
          const mode = getAccessMode(chapterYear, currentYear);

          if (chapterYear === currentYear) {
            expect(mode).toBe('read-write');
          } else {
            expect(mode).toBe('read-only');
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 21.4**
   *
   * Property 20d: For the same date used as both the chapter creation date
   * and the "current" date, the chapter must always be in read-write mode
   * (a chapter created "now" is always in the current academic year).
   */
  it('a chapter created at the current date is always accessible in read-write mode', () => {
    fc.assert(
      fc.property(gradeArb, dateArb, (grade, now) => {
        const chapterYear = getAcademicYearForGrade(grade, now);
        const currentYear = determineAcademicYear(now);
        const mode = getAccessMode(chapterYear, currentYear);

        expect(mode).toBe('read-write');
      }),
      { numRuns: 200 },
    );
  });
});
