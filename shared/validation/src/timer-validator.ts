import { ValidationResult } from '@chikumiku/types';

/**
 * Validates a timer duration in minutes.
 * Valid iff: multiple of 5 AND 5 ≤ minutes ≤ 120.
 */
export function validateTimer(minutes: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (
    !Number.isFinite(minutes) ||
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > 120 ||
    minutes % 5 !== 0
  ) {
    errors.timer = 'Timer must be a multiple of 5 between 5 and 120 minutes';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
