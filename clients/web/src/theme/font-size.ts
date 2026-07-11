/**
 * Grade-based Font Size Configuration
 *
 * Maps authenticated learner grade to appropriate font size for the platform.
 * Enforces a minimum rendered font size of 12px.
 *
 * Validates: Requirements 22.1, 23.2
 */
import { useMemo } from 'react';
import { typography } from './tokens';

export type Platform = 'web' | 'mobile';

export type GradeCategory = 'early' | 'middle' | 'senior';

const MINIMUM_FONT_SIZE_PX = 12;

/**
 * Normalizes a grade string to a canonical key for lookup.
 * Supports: 'LKG', 'UKG', '1st'–'12th', and word forms 'First'–'Twelfth'.
 * Case-insensitive.
 */
function normalizeGrade(grade: string): string {
  return grade.trim().toLowerCase();
}

/**
 * Mapping from normalized grade strings to their category.
 */
const GRADE_TO_CATEGORY: Record<string, GradeCategory> = {
  // Short forms
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
  return GRADE_TO_CATEGORY[normalizeGrade(grade)];
}

/**
 * Parses a CSS pixel value (e.g. '16px') to a number.
 */
function parsePx(value: string): number {
  return parseInt(value, 10);
}

/**
 * Ensures the font size is at least the minimum (12px).
 * Returns a CSS px string.
 */
function enforceMinimum(sizePx: number): string {
  return `${Math.max(sizePx, MINIMUM_FONT_SIZE_PX)}px`;
}

/**
 * Returns the appropriate font size for a learner's grade and platform.
 *
 * Grade mapping:
 * - LKG, UKG, 1st, 2nd → early (20px web / 18px mobile)
 * - 3rd, 4th, 5th → middle (18px web / 16px mobile)
 * - 6th–12th → senior (16px web / 14px mobile)
 *
 * Falls back to the body font size for the platform if the grade is unrecognized.
 * Enforces a minimum rendered font size of 12px.
 *
 * @param grade - The learner's grade (e.g. 'LKG', '3rd', 'Seventh')
 * @param platform - 'web' or 'mobile'
 * @returns CSS font size string (e.g. '20px')
 */
export function getFontSizeForGrade(grade: string, platform: Platform): string {
  const category = getGradeCategory(grade);

  if (category) {
    const sizePx = parsePx(typography.gradeFontSize[category][platform]);
    return enforceMinimum(sizePx);
  }

  // Fallback to body font size for unrecognized grades
  const fallbackPx = parsePx(typography.bodyFontSize[platform]);
  return enforceMinimum(fallbackPx);
}

/**
 * React hook that returns the font size for a learner's grade.
 *
 * @param grade - The authenticated learner's grade
 * @param platform - Defaults to 'web'
 * @returns CSS font size string
 */
export function useGradeFontSize(grade: string, platform: Platform = 'web'): string {
  return useMemo(() => getFontSizeForGrade(grade, platform), [grade, platform]);
}
