/**
 * Grade-based font size configuration for mobile
 *
 * Maps learner grade to appropriate font size on Android.
 * Enforces a minimum rendered font size of 12dp.
 *
 * Grade mapping:
 * - LKG, UKG, 1st, 2nd → early (18dp)
 * - 3rd, 4th, 5th → middle (16dp)
 * - 6th–12th → senior (14dp)
 *
 * Validates: Requirements 22.1, 23.2
 */

export type GradeCategory = 'early' | 'middle' | 'senior';

const MINIMUM_FONT_SIZE = 12;

/** Grade-based font sizes in dp for mobile */
export const gradeFontSizes: Record<GradeCategory, number> = {
  early: 18,   // LKG to 2nd Grade
  middle: 16,  // 3rd to 5th Grade
  senior: 14,  // 6th to 12th Grade
};

/**
 * Mapping from normalized grade strings to their category.
 */
const GRADE_TO_CATEGORY: Record<string, GradeCategory> = {
  lkg: 'early',
  ukg: 'early',
  '1st': 'early',
  '2nd': 'early',
  '3rd': 'middle',
  '4th': 'middle',
  '5th': 'middle',
  '6th': 'senior',
  '7th': 'senior',
  '8th': 'senior',
  '9th': 'senior',
  '10th': 'senior',
  '11th': 'senior',
  '12th': 'senior',
  // Word forms
  first: 'early',
  second: 'early',
  third: 'middle',
  fourth: 'middle',
  fifth: 'middle',
  sixth: 'senior',
  seventh: 'senior',
  eighth: 'senior',
  ninth: 'senior',
  tenth: 'senior',
  eleventh: 'senior',
  twelfth: 'senior',
};

/**
 * Returns the grade category for a given grade string.
 * Returns undefined if the grade is not recognized.
 */
export function getGradeCategory(grade: string): GradeCategory | undefined {
  return GRADE_TO_CATEGORY[grade.trim().toLowerCase()];
}

/**
 * Returns the font size in dp for a learner's grade on mobile.
 * Falls back to 14dp (body font size) for unrecognized grades.
 * Enforces a minimum of 12dp.
 */
export function getFontSizeForGrade(grade: string): number {
  const category = getGradeCategory(grade);

  if (category) {
    return Math.max(gradeFontSizes[category], MINIMUM_FONT_SIZE);
  }

  // Fallback to body font size
  return Math.max(14, MINIMUM_FONT_SIZE);
}
