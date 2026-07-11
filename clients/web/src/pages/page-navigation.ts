/**
 * Page Navigation Boundary Controls
 *
 * Pure function that determines the enabled/disabled state of Previous and
 * Next navigation buttons based on total pages and current page position.
 *
 * Validates: Requirements 9.5
 */

export interface NavigationState {
  previousDisabled: boolean;
  nextDisabled: boolean;
}

/**
 * Computes the navigation button state for page-by-page chapter explanation.
 *
 * Rules (Requirement 9.5):
 * - Previous is disabled if and only if currentPage is 1 (first page).
 * - Next is disabled if and only if currentPage equals totalPages (last page).
 *
 * @param totalPages - Total number of pages in the chapter (must be ≥ 1)
 * @param currentPage - The current page index (1-based, 1 ≤ currentPage ≤ totalPages)
 * @returns NavigationState indicating which buttons are disabled
 */
export function getNavigationState(totalPages: number, currentPage: number): NavigationState {
  return {
    previousDisabled: currentPage === 1,
    nextDisabled: currentPage === totalPages,
  };
}
