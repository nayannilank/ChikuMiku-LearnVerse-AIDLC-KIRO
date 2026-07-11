/**
 * Academic Year Content Organization
 *
 * Indian academic year runs April to March.
 * - If the current date is Jan–Mar, academic year is (prevYear)-(currentYear)
 * - If the current date is Apr–Dec, academic year is (currentYear)-(nextYear)
 *
 * Current year chapters → read-write mode
 * Prior year chapters → read-only archive mode
 * Historical progress retained for 3+ academic years (no data deletion).
 *
 * Requirements: 21.4, 21.5
 */

/**
 * Determines the Indian academic year string for a given date.
 *
 * Indian academic year runs April to March:
 * - Jan–Mar → (prevYear)-(currentYear), e.g., Jan 2025 → "2024-2025"
 * - Apr–Dec → (currentYear)-(nextYear), e.g., Sep 2024 → "2024-2025"
 */
export function determineAcademicYear(currentDate: Date): string {
  const month = currentDate.getMonth(); // 0-indexed: 0=Jan, 3=Apr, 11=Dec
  const year = currentDate.getFullYear();

  if (month < 3) {
    // Jan (0), Feb (1), Mar (2) → previous year to current year
    return `${year - 1}-${year}`;
  }
  // Apr (3) through Dec (11) → current year to next year
  return `${year}-${year + 1}`;
}

/**
 * Returns the academic year for a chapter based on the learner's grade
 * and the chapter creation date.
 *
 * Academic year determination is based on the date the chapter was created.
 * The grade is captured for context but the year calculation uses creationDate.
 */
export function getAcademicYearForGrade(grade: string, creationDate: Date): string {
  // Academic year is determined by the creation date, not the grade itself.
  // Grade is retained for metadata/context (e.g., which grade the learner was in
  // when the chapter was created), but the year calculation is date-based.
  return determineAcademicYear(creationDate);
}

/**
 * Determines the access mode for a chapter based on its academic year
 * compared to the current academic year.
 *
 * - Current year → 'read-write'
 * - Any prior year → 'read-only'
 */
export function getAccessMode(
  chapterAcademicYear: string,
  currentAcademicYear: string
): 'read-write' | 'read-only' {
  if (chapterAcademicYear === currentAcademicYear) {
    return 'read-write';
  }
  return 'read-only';
}

/**
 * Checks whether the given academic year string matches the current academic year
 * for the provided date.
 */
export function isCurrentYear(academicYear: string, currentDate: Date): boolean {
  return academicYear === determineAcademicYear(currentDate);
}

/**
 * Minimum number of academic years for which historical progress data
 * (scores, completion percentages, activity logs) must be retained.
 *
 * Requirements: 21.5
 */
export const MINIMUM_RETENTION_YEARS = 3;

/**
 * Determines whether progress data for a given academic year should be retained.
 *
 * Returns true if the academic year falls within the retention window
 * (current year and at least MINIMUM_RETENTION_YEARS prior years).
 * In practice, data is never deleted — this function provides a formal contract
 * that can gate any future archival or cleanup logic.
 *
 * @param dataAcademicYear - The academic year of the progress data (e.g., "2021-2022")
 * @param currentDate - The reference date to determine the current academic year
 * @returns true if data must be retained; false if it may be archived (though deletion is not implemented)
 */
export function shouldRetainProgressData(
  dataAcademicYear: string,
  currentDate: Date
): boolean {
  const currentAcademicYear = determineAcademicYear(currentDate);

  // Parse start years from the "YYYY-YYYY" format
  const dataStartYear = parseInt(dataAcademicYear.split('-')[0], 10);
  const currentStartYear = parseInt(currentAcademicYear.split('-')[0], 10);

  if (isNaN(dataStartYear) || isNaN(currentStartYear)) {
    // If parsing fails, retain data as a safety default
    return true;
  }

  const yearDifference = currentStartYear - dataStartYear;

  // Retain if within the minimum retention window (current year + N prior years)
  return yearDifference <= MINIMUM_RETENTION_YEARS;
}
