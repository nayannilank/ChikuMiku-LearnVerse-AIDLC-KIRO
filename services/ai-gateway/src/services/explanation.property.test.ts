/**
 * Property-based tests for explanation structure constraints.
 * Feature: chikumiku-learnverse, Property 5: Explanation Structure Constraints
 *
 * **Validates: Requirements 9.1**
 *
 * For any generated explanation, after validation and normalization the output SHALL:
 * (a) contain a summary of at most 200 words,
 * (b) contain between 3 and 10 keywords inclusive, and
 * (c) contain between 1 and 5 concepts inclusive.
 */
import * as fc from 'fast-check';
import { validateAndNormalizeExplanation, ParsedExplanation } from './explanation';

const MAX_SUMMARY_WORDS = 200;
const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 10;
const MIN_CONCEPTS = 1;
const MAX_CONCEPTS = 5;

// --- Arbitraries ---

/** Generate a word (non-empty string without whitespace) */
const wordArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0 && !s.includes(' '));

/** Generate a summary with a variable number of words (0-500) */
const summaryArb = fc.array(wordArb, { minLength: 0, maxLength: 500 }).map((words) => words.join(' '));

/** Generate a keyword string (non-empty) */
const keywordArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

/** Generate a concept string (non-empty) */
const conceptArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/** Generate a keywords array with varying lengths (0-20) */
const keywordsArb: fc.Arbitrary<string[]> = fc.array(keywordArb, { minLength: 0, maxLength: 20 });

/** Generate a concepts array with varying lengths (0-10) */
const conceptsArb: fc.Arbitrary<string[]> = fc.array(conceptArb, { minLength: 0, maxLength: 10 });

/** Full ParsedExplanation arbitrary */
const parsedExplanationArb: fc.Arbitrary<ParsedExplanation> = fc
  .tuple(summaryArb, keywordsArb, conceptsArb)
  .map(([summary, keywords, concepts]) => ({ summary, keywords, concepts }));

// --- Helper ---

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 5: Explanation Structure Constraints', () => {
  it('(a) output summary always has at most 200 words', () => {
    fc.assert(
      fc.property(parsedExplanationArb, (input: ParsedExplanation) => {
        const result = validateAndNormalizeExplanation(input);
        const wordCount = countWords(result.summary);
        expect(wordCount).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);
      }),
      { numRuns: 200 },
    );
  });

  it('(b) output keywords always has between 3 and 10 items inclusive', () => {
    fc.assert(
      fc.property(parsedExplanationArb, (input: ParsedExplanation) => {
        const result = validateAndNormalizeExplanation(input);
        expect(result.keywords.length).toBeGreaterThanOrEqual(MIN_KEYWORDS);
        expect(result.keywords.length).toBeLessThanOrEqual(MAX_KEYWORDS);
      }),
      { numRuns: 200 },
    );
  });

  it('(c) output concepts always has between 1 and 5 items inclusive', () => {
    fc.assert(
      fc.property(parsedExplanationArb, (input: ParsedExplanation) => {
        const result = validateAndNormalizeExplanation(input);
        expect(result.concepts.length).toBeGreaterThanOrEqual(MIN_CONCEPTS);
        expect(result.concepts.length).toBeLessThanOrEqual(MAX_CONCEPTS);
      }),
      { numRuns: 200 },
    );
  });

  it('all three constraints hold simultaneously for any input', () => {
    fc.assert(
      fc.property(parsedExplanationArb, (input: ParsedExplanation) => {
        const result = validateAndNormalizeExplanation(input);

        // (a) summary ≤ 200 words
        const wordCount = countWords(result.summary);
        expect(wordCount).toBeLessThanOrEqual(MAX_SUMMARY_WORDS);

        // (b) keywords between 3 and 10
        expect(result.keywords.length).toBeGreaterThanOrEqual(MIN_KEYWORDS);
        expect(result.keywords.length).toBeLessThanOrEqual(MAX_KEYWORDS);

        // (c) concepts between 1 and 5
        expect(result.concepts.length).toBeGreaterThanOrEqual(MIN_CONCEPTS);
        expect(result.concepts.length).toBeLessThanOrEqual(MAX_CONCEPTS);
      }),
      { numRuns: 200 },
    );
  });
});
