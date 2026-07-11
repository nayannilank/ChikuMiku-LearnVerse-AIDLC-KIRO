/**
 * Property Test: Grade-Based Font Size Selection
 * Feature: chikumiku-learnverse, Property 17: Grade-Based Font Size Selection
 *
 * Validates: Requirements 22.1
 *
 * Verifies that getFontSizeForGrade returns the correct font size for each
 * grade/platform combination, that all returned values meet the 12px minimum,
 * and that getGradeCategory correctly categorizes each grade.
 */
import * as fc from 'fast-check';
import { getFontSizeForGrade, getGradeCategory, Platform, GradeCategory } from './font-size';

// --- Grade definitions grouped by category ---

const EARLY_GRADES = ['LKG', 'UKG', '1st', '2nd', 'First', 'Second'];
const MIDDLE_GRADES = ['3rd', '4th', '5th', 'Third', 'Fourth', 'Fifth'];
const SENIOR_GRADES = ['6th', '7th', '8th', '9th', '10th', '11th', '12th',
  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];

const ALL_VALID_GRADES = [...EARLY_GRADES, ...MIDDLE_GRADES, ...SENIOR_GRADES];

// --- Expected font sizes per category and platform ---

const EXPECTED_SIZES: Record<GradeCategory, Record<Platform, string>> = {
  early: { web: '20px', mobile: '18px' },
  middle: { web: '18px', mobile: '16px' },
  senior: { web: '16px', mobile: '14px' },
};

const EXPECTED_CATEGORY: Record<string, GradeCategory> = {};
for (const g of EARLY_GRADES) EXPECTED_CATEGORY[g] = 'early';
for (const g of MIDDLE_GRADES) EXPECTED_CATEGORY[g] = 'middle';
for (const g of SENIOR_GRADES) EXPECTED_CATEGORY[g] = 'senior';

// --- Arbitraries ---

const gradeArb = fc.constantFrom(...ALL_VALID_GRADES);
const platformArb: fc.Arbitrary<Platform> = fc.constantFrom('web', 'mobile');

// --- Property Tests ---

describe('Property 17: Grade-Based Font Size Selection', () => {
  /**
   * **Validates: Requirements 22.1**
   *
   * For every valid grade and platform combination, getFontSizeForGrade
   * must return the exact expected font size based on the grade's category.
   */
  it('returns the correct font size for every grade and platform', () => {
    fc.assert(
      fc.property(gradeArb, platformArb, (grade, platform) => {
        const category = EXPECTED_CATEGORY[grade];
        const expected = EXPECTED_SIZES[category][platform];
        const actual = getFontSizeForGrade(grade, platform);
        expect(actual).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 22.1**
   *
   * All font sizes returned by getFontSizeForGrade must be at least 12px.
   */
  it('never returns a font size below the 12px minimum', () => {
    fc.assert(
      fc.property(gradeArb, platformArb, (grade, platform) => {
        const result = getFontSizeForGrade(grade, platform);
        const numericValue = parseInt(result, 10);
        expect(numericValue).toBeGreaterThanOrEqual(12);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 22.1**
   *
   * getGradeCategory must return the correct category for every valid grade.
   */
  it('getGradeCategory returns the correct category for all valid grades', () => {
    fc.assert(
      fc.property(gradeArb, (grade) => {
        const expected = EXPECTED_CATEGORY[grade];
        const actual = getGradeCategory(grade);
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 22.1**
   *
   * getGradeCategory must return undefined for unrecognized grade strings.
   */
  it('getGradeCategory returns undefined for unrecognized grades', () => {
    const invalidGradeArb = fc.string({ minLength: 1, maxLength: 10 })
      .filter((s) => !ALL_VALID_GRADES.map(g => g.toLowerCase()).includes(s.trim().toLowerCase()));

    fc.assert(
      fc.property(invalidGradeArb, (grade) => {
        const result = getGradeCategory(grade);
        expect(result).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
