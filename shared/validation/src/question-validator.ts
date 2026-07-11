import { ValidationResult } from '@chikumiku/types';

const MAX_QUESTION_LENGTH = 500;

/**
 * Validates question length before AI processing.
 * Rejects empty questions or questions exceeding 500 characters.
 */
export function validateQuestionLength(question: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (question.length === 0) {
    errors['question'] = 'Question is required';
  } else if (question.length > MAX_QUESTION_LENGTH) {
    errors['question'] = `Question must not exceed ${MAX_QUESTION_LENGTH} characters`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
