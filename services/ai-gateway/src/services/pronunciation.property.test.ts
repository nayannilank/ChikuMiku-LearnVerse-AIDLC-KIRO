/**
 * Property-based tests for pronunciation scoring and color classification.
 * Feature: chikumiku-learnverse, Property 7: Pronunciation Scoring and Color Classification
 *
 * **Validates: Requirements 10.4, 10.5**
 *
 * For any pair of (expected text, transcribed text), the pronunciation scorer
 * SHALL produce: (a) an overall accuracy score between 0 and 100 inclusive,
 * (b) per-syllable accuracy values between 0 and 100 inclusive, and
 * (c) per-syllable color codes where green is assigned for accuracy >= 80,
 * yellow for accuracy in [40, 79], and red for accuracy < 40.
 */
import * as fc from 'fast-check';
import { scorePronunciation, classifyColor } from './pronunciation';

// --- Arbitraries ---

/** Generate a single word (1-15 characters, letters only) */
const wordArb = fc.stringMatching(/^[a-zA-Z]{1,15}$/);

/** Generate a sentence (1-8 words separated by spaces) */
const sentenceArb = fc.array(wordArb, { minLength: 1, maxLength: 8 }).map((words) => words.join(' '));

/** Generate pairs of (expected, transcribed) sentences */
const textPairArb = fc.tuple(sentenceArb, sentenceArb);

/** Generate accuracy values in [0, 100] for classifyColor testing */
const accuracyArb = fc.integer({ min: 0, max: 100 });

/** Generate accuracy in the green range [80, 100] */
const greenAccuracyArb = fc.integer({ min: 80, max: 100 });

/** Generate accuracy in the yellow range [40, 79] */
const yellowAccuracyArb = fc.integer({ min: 40, max: 79 });

/** Generate accuracy in the red range [0, 39] */
const redAccuracyArb = fc.integer({ min: 0, max: 39 });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 7: Pronunciation Scoring and Color Classification', () => {
  it('overall score is always in [0, 100] for any text pair', () => {
    fc.assert(
      fc.property(textPairArb, ([expected, transcribed]) => {
        const result = scorePronunciation(expected, transcribed);
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 },
    );
  });

  it('each syllable accuracy is in [0, 100] for any text pair', () => {
    fc.assert(
      fc.property(textPairArb, ([expected, transcribed]) => {
        const result = scorePronunciation(expected, transcribed);
        for (const syllable of result.syllables) {
          expect(syllable.accuracy).toBeGreaterThanOrEqual(0);
          expect(syllable.accuracy).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('each syllable color correctly classifies its accuracy value', () => {
    fc.assert(
      fc.property(textPairArb, ([expected, transcribed]) => {
        const result = scorePronunciation(expected, transcribed);
        for (const syllable of result.syllables) {
          if (syllable.accuracy >= 80) {
            expect(syllable.color).toBe('green');
          } else if (syllable.accuracy >= 40) {
            expect(syllable.color).toBe('yellow');
          } else {
            expect(syllable.color).toBe('red');
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('classifyColor returns green for accuracy >= 80', () => {
    fc.assert(
      fc.property(greenAccuracyArb, (accuracy) => {
        expect(classifyColor(accuracy)).toBe('green');
      }),
      { numRuns: 200 },
    );
  });

  it('classifyColor returns yellow for accuracy in [40, 79]', () => {
    fc.assert(
      fc.property(yellowAccuracyArb, (accuracy) => {
        expect(classifyColor(accuracy)).toBe('yellow');
      }),
      { numRuns: 200 },
    );
  });

  it('classifyColor returns red for accuracy < 40', () => {
    fc.assert(
      fc.property(redAccuracyArb, (accuracy) => {
        expect(classifyColor(accuracy)).toBe('red');
      }),
      { numRuns: 200 },
    );
  });

  it('classifyColor is deterministic: same input always yields same output', () => {
    fc.assert(
      fc.property(accuracyArb, (accuracy) => {
        const first = classifyColor(accuracy);
        const second = classifyColor(accuracy);
        expect(first).toBe(second);
      }),
      { numRuns: 200 },
    );
  });

  it('overall score equals 0 and syllables is empty when expected text is empty', () => {
    fc.assert(
      fc.property(sentenceArb, (transcribed) => {
        const result = scorePronunciation('', transcribed);
        expect(result.overallScore).toBe(0);
        expect(result.syllables).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('overall score is 100 when expected equals transcribed (identical text)', () => {
    fc.assert(
      fc.property(sentenceArb, (text) => {
        const result = scorePronunciation(text, text);
        expect(result.overallScore).toBe(100);
        for (const syllable of result.syllables) {
          expect(syllable.accuracy).toBe(100);
          expect(syllable.color).toBe('green');
        }
      }),
      { numRuns: 200 },
    );
  });
});
