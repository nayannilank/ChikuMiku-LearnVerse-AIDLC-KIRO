/**
 * Property Test: Page Navigation Boundary Controls
 * Feature: chikumiku-learnverse, Property 6: Page Navigation Boundary Controls
 *
 * Validates: Requirements 9.5
 *
 * For any chapter with N pages (N ≥ 1) and current page index P (1 ≤ P ≤ N):
 * - The "Previous" button SHALL be disabled if and only if P = 1
 * - The "Next" button SHALL be disabled if and only if P = N
 */
import * as fc from 'fast-check';
import { getNavigationState } from './page-navigation';

describe('Property 6: Page Navigation Boundary Controls', () => {
  /**
   * **Validates: Requirements 9.5**
   *
   * Previous button is disabled if and only if the current page is the first page.
   */
  it('Previous is disabled iff currentPage = 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }).chain((totalPages) =>
          fc.tuple(
            fc.constant(totalPages),
            fc.integer({ min: 1, max: totalPages }),
          )
        ),
        ([totalPages, currentPage]) => {
          const state = getNavigationState(totalPages, currentPage);
          expect(state.previousDisabled).toBe(currentPage === 1);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 9.5**
   *
   * Next button is disabled if and only if the current page is the last page.
   */
  it('Next is disabled iff currentPage = totalPages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }).chain((totalPages) =>
          fc.tuple(
            fc.constant(totalPages),
            fc.integer({ min: 1, max: totalPages }),
          )
        ),
        ([totalPages, currentPage]) => {
          const state = getNavigationState(totalPages, currentPage);
          expect(state.nextDisabled).toBe(currentPage === totalPages);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 9.5**
   *
   * When there is only one page (N = 1), both Previous and Next are disabled.
   */
  it('single page chapter has both buttons disabled', () => {
    fc.assert(
      fc.property(fc.constant(1), (totalPages) => {
        const state = getNavigationState(totalPages, 1);
        expect(state.previousDisabled).toBe(true);
        expect(state.nextDisabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 9.5**
   *
   * For any page in the middle (1 < P < N), neither button is disabled.
   */
  it('middle pages have both buttons enabled', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }).chain((totalPages) =>
          fc.tuple(
            fc.constant(totalPages),
            fc.integer({ min: 2, max: totalPages - 1 }),
          )
        ),
        ([totalPages, currentPage]) => {
          const state = getNavigationState(totalPages, currentPage);
          expect(state.previousDisabled).toBe(false);
          expect(state.nextDisabled).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
