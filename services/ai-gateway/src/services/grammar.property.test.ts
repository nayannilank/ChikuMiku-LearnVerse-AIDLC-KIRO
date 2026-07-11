/**
 * Property-based tests for grammar exercise generation bounds.
 * Feature: chikumiku-learnverse, Property 9: Grammar Exercise Generation Bounds
 *
 * **Validates: Requirements 11.3, 11.7**
 *
 * For any chapter transcript:
 * - ≥200 words → sufficient → exercise count bounds {5, 10}
 * - 50-199 words → limited → exercise count bounds {2, 4}, shows limited content message
 * - <50 words → minimal → exercise count bounds {1, 1}, no message
 *
 * getLimitedContentMessage returns limitedContent=true for counts 2-4,
 * limitedContent=false for count 1 and counts 5+.
 */
import * as fc from 'fast-check';
import {
  assessContentSufficiency,
  determineExerciseCount,
  getLimitedContentMessage,
  countWords,
} from './grammar';

// --- Arbitraries ---

/** Generate a single word (non-empty lowercase string) */
const wordArb = fc.stringMatching(/^[a-z]{1,8}$/);

/** Generate a transcript with exactly N words separated by spaces */
function transcriptWithWordCount(min: number, max: number): fc.Arbitrary<string> {
  return fc.array(wordArb, { minLength: min, maxLength: max }).map((words) => words.join(' '));
}

/** Transcript with ≥200 words (sufficient content) */
const sufficientTranscriptArb = transcriptWithWordCount(200, 500);

/** Transcript with 50-199 words (limited content) */
const limitedTranscriptArb = transcriptWithWordCount(50, 199);

/** Transcript with <50 words (minimal content) — at least 1 word to avoid empty string edge case */
const minimalTranscriptArb = transcriptWithWordCount(1, 49);

/** Exercise count in the limited range (2-4) */
const limitedExerciseCountArb = fc.integer({ min: 2, max: 4 });

/** Exercise count for exactly 1 (minimal) */
const minimalExerciseCountArb = fc.constant(1);

/** Exercise count in the sufficient range (5+) */
const sufficientExerciseCountArb = fc.integer({ min: 5, max: 50 });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 9: Grammar Exercise Generation Bounds', () => {
  it('(a) ≥200 words → assessContentSufficiency returns "sufficient" → exerciseCount is {5, 10}', () => {
    fc.assert(
      fc.property(sufficientTranscriptArb, (transcript) => {
        const sufficiency = assessContentSufficiency(transcript);
        expect(sufficiency).toBe('sufficient');

        const bounds = determineExerciseCount(sufficiency);
        expect(bounds.min).toBe(5);
        expect(bounds.max).toBe(10);
      }),
      { numRuns: 200 },
    );
  });

  it('(b) 50-199 words → assessContentSufficiency returns "limited" → exerciseCount is {2, 4}', () => {
    fc.assert(
      fc.property(limitedTranscriptArb, (transcript) => {
        const sufficiency = assessContentSufficiency(transcript);
        expect(sufficiency).toBe('limited');

        const bounds = determineExerciseCount(sufficiency);
        expect(bounds.min).toBe(2);
        expect(bounds.max).toBe(4);
      }),
      { numRuns: 200 },
    );
  });

  it('(c) <50 words → assessContentSufficiency returns "minimal" → exerciseCount is {1, 1}', () => {
    fc.assert(
      fc.property(minimalTranscriptArb, (transcript) => {
        const sufficiency = assessContentSufficiency(transcript);
        expect(sufficiency).toBe('minimal');

        const bounds = determineExerciseCount(sufficiency);
        expect(bounds.min).toBe(1);
        expect(bounds.max).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  it('(d) getLimitedContentMessage returns limitedContent=true for counts 2-4', () => {
    fc.assert(
      fc.property(limitedExerciseCountArb, (exerciseCount) => {
        const result = getLimitedContentMessage(exerciseCount);
        expect(result.limitedContent).toBe(true);
        expect(result.message).toBeDefined();
        expect(typeof result.message).toBe('string');
        expect(result.message!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('(e) getLimitedContentMessage returns limitedContent=false for count 1 (no message for minimal)', () => {
    fc.assert(
      fc.property(minimalExerciseCountArb, (exerciseCount) => {
        const result = getLimitedContentMessage(exerciseCount);
        expect(result.limitedContent).toBe(false);
        expect(result.message).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('(f) getLimitedContentMessage returns limitedContent=false for counts 5+ (sufficient content)', () => {
    fc.assert(
      fc.property(sufficientExerciseCountArb, (exerciseCount) => {
        const result = getLimitedContentMessage(exerciseCount);
        expect(result.limitedContent).toBe(false);
        expect(result.message).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
