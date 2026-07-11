/**
 * Property-based tests for question length constraint validation.
 * Feature: chikumiku-learnverse, Property 11: Question Length Constraint Validation
 *
 * **Validates: Requirements 12.6**
 *
 * For any question string, the validator SHALL accept if 1 ≤ length ≤ 500,
 * reject with "Question is required" if length = 0,
 * and reject with "Question must not exceed 500 characters" if length > 500.
 */
import * as fc from 'fast-check';
import { validateQuestionLength } from './question-validator';

const MAX_QUESTION_LENGTH = 500;

// --- Arbitraries ---

/** Valid question: a string with length between 1 and 500 (inclusive) */
const validQuestionArb = fc.string({ minLength: 1, maxLength: MAX_QUESTION_LENGTH });

/** Invalid question (too long): a string with length > 500 */
const tooLongQuestionArb = fc.string({ minLength: MAX_QUESTION_LENGTH + 1, maxLength: MAX_QUESTION_LENGTH * 3 });

/** Empty question: always the empty string */
const emptyQuestionArb = fc.constant('');

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 11: Question Length Constraint Validation', () => {
  it('accepts all questions with length between 1 and 500 characters', () => {
    fc.assert(
      fc.property(validQuestionArb, (question: string) => {
        const result = validateQuestionLength(question);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 200 },
    );
  });

  it('rejects questions exceeding 500 characters with appropriate error message', () => {
    fc.assert(
      fc.property(tooLongQuestionArb, (question: string) => {
        const result = validateQuestionLength(question);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('question');
        expect(result.errors['question']).toBe('Question must not exceed 500 characters');
      }),
      { numRuns: 200 },
    );
  });

  it('rejects empty questions with "Question is required" error', () => {
    fc.assert(
      fc.property(emptyQuestionArb, (question: string) => {
        const result = validateQuestionLength(question);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('question');
        expect(result.errors['question']).toBe('Question is required');
      }),
      { numRuns: 200 },
    );
  });

  it('validates boundary: exactly 500 chars is valid, 501 chars is invalid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }),
        (char: string) => {
          const boundary = char.repeat(MAX_QUESTION_LENGTH);
          const overBoundary = char.repeat(MAX_QUESTION_LENGTH + 1);

          const validResult = validateQuestionLength(boundary);
          expect(validResult.valid).toBe(true);
          expect(validResult.errors).toEqual({});

          const invalidResult = validateQuestionLength(overBoundary);
          expect(invalidResult.valid).toBe(false);
          expect(invalidResult.errors['question']).toBe('Question must not exceed 500 characters');
        },
      ),
      { numRuns: 200 },
    );
  });
});
