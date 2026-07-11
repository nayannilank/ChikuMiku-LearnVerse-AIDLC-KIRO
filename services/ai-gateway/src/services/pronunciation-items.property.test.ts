/**
 * Property-Based Test: Practice Item Count Bounds (Property 8)
 *
 * Feature: chikumiku-learnverse, Property 8: Practice Item Count Bounds
 *
 * Validates: Requirements 10.3
 *
 * For any chapter with sufficient content, a pronunciation practice session
 * SHALL present between 5 and 20 words or sentences inclusive extracted from
 * the chapter content.
 */

import * as fc from 'fast-check';
import {
  extractPracticeItems,
  MIN_PRACTICE_ITEMS,
  MAX_PRACTICE_ITEMS,
} from './pronunciation';

// --- Arbitraries ---

/** Generates a single sentence suitable for pronunciation practice (2-100 chars, letters/spaces). */
const sentenceArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z ]{1,80}[a-zA-Z]$/);

/** Sentence delimiter characters. */
const delimiterArb = fc.constantFrom('.', '!', '?', ';', '\n');

/**
 * Generates a transcript with many sentences (sufficient content).
 * Ensures at least 25 sentences so there's plenty of content to extract from.
 */
const sufficientTranscriptArb = fc.tuple(
  fc.array(sentenceArb, { minLength: 25, maxLength: 60 }),
  fc.array(delimiterArb, { minLength: 25, maxLength: 60 }),
).map(([sentences, delimiters]) => {
  // Interleave sentences with delimiters
  return sentences
    .map((s, i) => s + (delimiters[i % delimiters.length] || '.'))
    .join(' ');
});

/**
 * Generates a count parameter that is within the valid clamping range [5, 20].
 */
const validCountArb = fc.integer({ min: MIN_PRACTICE_ITEMS, max: MAX_PRACTICE_ITEMS });

/**
 * Generates a count parameter that is below the minimum (will be clamped up to 5).
 */
const belowMinCountArb = fc.integer({ min: -100, max: MIN_PRACTICE_ITEMS - 1 });

/**
 * Generates a count parameter that is above the maximum (will be clamped down to 20).
 */
const aboveMaxCountArb = fc.integer({ min: MAX_PRACTICE_ITEMS + 1, max: 200 });

/**
 * Generates any count parameter (for general bounds testing).
 */
const anyCountArb = fc.integer({ min: -100, max: 200 });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 8: Practice Item Count Bounds', () => {
  /**
   * **Validates: Requirements 10.3**
   *
   * Property 8a: For transcripts with sufficient content (many sentences),
   * extracted items count is between 5 and 20 inclusive.
   */
  it('(a) extracted items count is between MIN_PRACTICE_ITEMS (5) and MAX_PRACTICE_ITEMS (20) for sufficient content', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, anyCountArb, (transcript, count) => {
        const items = extractPracticeItems(transcript, count);

        expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
        expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.3**
   *
   * Property 8b: Count parameter is always clamped to [5, 20].
   * Requesting below 5 still yields at least 5 items (if content is sufficient).
   * Requesting above 20 still yields at most 20 items.
   */
  it('(b) count parameter below minimum is clamped up to 5', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, belowMinCountArb, (transcript, count) => {
        const items = extractPracticeItems(transcript, count);

        // Even though count < 5, we get at least 5 items
        expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
        expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) count parameter above maximum is clamped down to 20', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, aboveMaxCountArb, (transcript, count) => {
        const items = extractPracticeItems(transcript, count);

        // Even though count > 20, we never exceed 20 items
        expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
        expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.3**
   *
   * Property 8c: Each extracted item has length >= 2 (filtering works correctly).
   */
  it('(c) each extracted item has length >= 2', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, validCountArb, (transcript, count) => {
        const items = extractPracticeItems(transcript, count);

        for (const item of items) {
          expect(item.length).toBeGreaterThanOrEqual(2);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.3**
   *
   * Property 8d: No more than MAX_PRACTICE_ITEMS (20) items are ever returned,
   * regardless of input.
   */
  it('(d) never returns more than MAX_PRACTICE_ITEMS (20) items', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, anyCountArb, (transcript, count) => {
        const items = extractPracticeItems(transcript, count);

        expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 10.3**
   *
   * Property 8 (supplementary): When count is not provided (undefined),
   * the default behavior still respects bounds.
   */
  it('respects bounds when count is undefined (defaults to 10)', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, (transcript) => {
        const items = extractPracticeItems(transcript);

        expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
        expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
      }),
      { numRuns: 100 },
    );
  });
});
