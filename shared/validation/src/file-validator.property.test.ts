/**
 * Property-based tests for file upload validation.
 * Feature: chikumiku-learnverse, Property 3: File Upload Validation
 *
 * **Validates: Requirements 7.2, 7.3**
 *
 * For any format string and file size, the validator SHALL accept the upload
 * if and only if format ∈ {jpeg, png, heic} (case-insensitive) AND size ≤ 10,485,760 bytes,
 * and reject it with the correct rejection reason(s) otherwise.
 */
import * as fc from 'fast-check';
import { validateFileUpload } from './file-validator';

const MAX_FILE_SIZE = 10_485_760;
const ACCEPTED_FORMATS = ['jpeg', 'png', 'heic'];

// --- Arbitraries ---

/** Valid format: one of jpeg, png, heic with random case variation */
const validFormatArb = fc
  .constantFrom(...ACCEPTED_FORMATS)
  .chain((fmt) =>
    fc.array(fc.boolean(), { minLength: fmt.length, maxLength: fmt.length }).map((bools) =>
      fmt
        .split('')
        .map((ch, i) => (bools[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(''),
    ),
  );

/** Invalid format: a string that is NOT in the accepted set (case-insensitive) */
const invalidFormatArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !ACCEPTED_FORMATS.includes(s.toLowerCase()));

/** Valid size: 0 to MAX_FILE_SIZE (inclusive) */
const validSizeArb = fc.integer({ min: 0, max: MAX_FILE_SIZE });

/** Invalid size: greater than MAX_FILE_SIZE */
const invalidSizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 });

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 3: File Upload Validation', () => {
  it('accepts all valid uploads (accepted format + size ≤ 10 MB)', () => {
    fc.assert(
      fc.property(validFormatArb, validSizeArb, (format: string, size: number) => {
        const result = validateFileUpload(format, size);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 200 },
    );
  });

  it('rejects invalid format with valid size, returning format error', () => {
    fc.assert(
      fc.property(invalidFormatArb, validSizeArb, (format: string, size: number) => {
        const result = validateFileUpload(format, size);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('format');
        expect(result.errors['format']).toContain('Unsupported format');
      }),
      { numRuns: 200 },
    );
  });

  it('rejects valid format with invalid size, returning size error', () => {
    fc.assert(
      fc.property(validFormatArb, invalidSizeArb, (format: string, size: number) => {
        const result = validateFileUpload(format, size);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('size');
        expect(result.errors['size']).toContain('File too large');
      }),
      { numRuns: 200 },
    );
  });

  it('rejects both invalid format and invalid size, returning both errors', () => {
    fc.assert(
      fc.property(invalidFormatArb, invalidSizeArb, (format: string, size: number) => {
        const result = validateFileUpload(format, size);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveProperty('format');
        expect(result.errors).toHaveProperty('size');
        expect(result.errors['format']).toContain('Unsupported format');
        expect(result.errors['size']).toContain('File too large');
      }),
      { numRuns: 200 },
    );
  });

  it('returns correct rejection reason content in error messages', () => {
    fc.assert(
      fc.property(invalidFormatArb, invalidSizeArb, (format: string, size: number) => {
        const result = validateFileUpload(format, size);
        expect(result.errors['format']).toBe(
          'Unsupported format. Accepted formats: JPEG, PNG, HEIC',
        );
        expect(result.errors['size']).toBe('File too large. Maximum file size is 10 MB');
      }),
      { numRuns: 200 },
    );
  });
});
