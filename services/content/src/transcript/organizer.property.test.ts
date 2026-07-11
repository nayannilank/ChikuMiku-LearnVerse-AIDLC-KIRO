/**
 * Property-based tests for transcript page organization.
 * Feature: chikumiku-learnverse, Property 4: Transcript Page Organization
 *
 * **Validates: Requirements 8.4**
 *
 * For any set of pages with page numbers and content/exercise classifications,
 * the transcript organizer SHALL produce output where:
 * (a) all pages have sequential page markers ("Page 1", "Page 2", ..., "Page N"),
 * (b) content pages are grouped separately from exercise pages with correct classifications,
 * (c) the original text content of each page is preserved exactly.
 */
import * as fc from 'fast-check';
import { organizeTranscript } from './organizer';
import { TranscriptPage } from '@chikumiku/types';

// --- Arbitraries ---

/** Arbitrary classification value */
const classificationArb = fc.constantFrom<'content' | 'exercise'>('content', 'exercise');

/** Arbitrary language string */
const languageArb = fc.constantFrom('en', 'hi', 'ta', 'te', 'kn', 'ml', 'bn', 'mr');

/** Arbitrary text content - use unicode string to test preservation of all characters */
const textArb = fc.string({ minLength: 0, maxLength: 500 });

/** Arbitrary single TranscriptPage */
const transcriptPageArb = fc.record({
  pageNumber: fc.integer({ min: 1, max: 9999 }),
  classification: classificationArb,
  text: textArb,
  language: languageArb,
});

/** Arbitrary array of TranscriptPages with unique page numbers */
const transcriptPagesArb = fc
  .uniqueArray(transcriptPageArb, {
    comparator: (a, b) => a.pageNumber === b.pageNumber,
    minLength: 0,
    maxLength: 50,
  });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 4: Transcript Page Organization', () => {
  it('(a) produces sequential markers "Page 1" through "Page N" for N input pages', () => {
    fc.assert(
      fc.property(transcriptPagesArb, (pages: TranscriptPage[]) => {
        const result = organizeTranscript(pages);

        // pageMarkers length must equal number of input pages
        expect(result.pageMarkers).toHaveLength(pages.length);

        // Each marker must be "Page i" for i = 1..N
        for (let i = 0; i < result.pageMarkers.length; i++) {
          expect(result.pageMarkers[i]).toBe(`Page ${i + 1}`);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('(b) separates content pages from exercise pages correctly', () => {
    fc.assert(
      fc.property(transcriptPagesArb, (pages: TranscriptPage[]) => {
        const result = organizeTranscript(pages);

        // All contentPages must have classification 'content'
        for (const page of result.contentPages) {
          expect(page.classification).toBe('content');
        }

        // All exercisePages must have classification 'exercise'
        for (const page of result.exercisePages) {
          expect(page.classification).toBe('exercise');
        }

        // The total count must equal the original count
        expect(result.contentPages.length + result.exercisePages.length).toBe(pages.length);

        // The union of page numbers in both groups must equal the set of input page numbers
        const resultPageNumbers = [
          ...result.contentPages.map(p => p.pageNumber),
          ...result.exercisePages.map(p => p.pageNumber),
        ].sort((a, b) => a - b);

        const inputPageNumbers = [...pages.map(p => p.pageNumber)].sort((a, b) => a - b);

        expect(resultPageNumbers).toEqual(inputPageNumbers);
      }),
      { numRuns: 200 },
    );
  });

  it('(c) preserves the original text content of each page exactly', () => {
    fc.assert(
      fc.property(transcriptPagesArb, (pages: TranscriptPage[]) => {
        const result = organizeTranscript(pages);

        // Build a map of pageNumber -> original text
        const originalTextByPage = new Map<number, string>();
        for (const page of pages) {
          originalTextByPage.set(page.pageNumber, page.text);
        }

        // Verify text is preserved in contentPages
        for (const page of result.contentPages) {
          expect(page.text).toBe(originalTextByPage.get(page.pageNumber));
        }

        // Verify text is preserved in exercisePages
        for (const page of result.exercisePages) {
          expect(page.text).toBe(originalTextByPage.get(page.pageNumber));
        }
      }),
      { numRuns: 200 },
    );
  });
});
