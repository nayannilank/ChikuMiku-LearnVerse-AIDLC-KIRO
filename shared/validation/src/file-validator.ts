import { ValidationResult } from '@chikumiku/types';

/** Maximum file size: 10 MB in bytes */
const MAX_FILE_SIZE_BYTES = 10_485_760;

/** Accepted image formats (case-insensitive) */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'heic']);

/**
 * Validates a file upload based on format and size constraints.
 * Accepts JPEG, PNG, or HEIC images up to 10 MB.
 *
 * @param format - The file format string (case-insensitive, e.g. "jpeg", "PNG", "heic")
 * @param sizeBytes - The file size in bytes
 * @returns ValidationResult with errors keyed by 'format' and/or 'size'
 */
export function validateFileUpload(format: string, sizeBytes: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (!ACCEPTED_FORMATS.has(format.toLowerCase())) {
    errors['format'] = 'Unsupported format. Accepted formats: JPEG, PNG, HEIC';
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    errors['size'] = 'File too large. Maximum file size is 10 MB';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
