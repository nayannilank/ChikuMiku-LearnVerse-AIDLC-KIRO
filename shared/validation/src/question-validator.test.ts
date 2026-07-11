import { validateQuestionLength } from './question-validator';

describe('validateQuestionLength', () => {
  it('should return valid for a normal question', () => {
    const result = validateQuestionLength('What is photosynthesis?');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should return valid for a single character question', () => {
    const result = validateQuestionLength('?');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should return valid for exactly 500 characters', () => {
    const question = 'a'.repeat(500);
    const result = validateQuestionLength(question);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should reject an empty string', () => {
    const result = validateQuestionLength('');
    expect(result.valid).toBe(false);
    expect(result.errors['question']).toBe('Question is required');
  });

  it('should reject a question exceeding 500 characters', () => {
    const question = 'a'.repeat(501);
    const result = validateQuestionLength(question);
    expect(result.valid).toBe(false);
    expect(result.errors['question']).toBe('Question must not exceed 500 characters');
  });

  it('should reject a very long question', () => {
    const question = 'a'.repeat(1000);
    const result = validateQuestionLength(question);
    expect(result.valid).toBe(false);
    expect(result.errors['question']).toContain('500');
  });
});
