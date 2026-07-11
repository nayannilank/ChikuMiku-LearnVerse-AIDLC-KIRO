/**
 * Input sanitization utility to prevent XSS attacks.
 *
 * Sanitizes user-provided strings by escaping HTML special characters
 * and stripping dangerous patterns. Used before storing or rendering
 * user input (chapter names, book names, custom subjects, etc.).
 *
 * Requirements: 20.1, 20.3
 */

/**
 * HTML special characters that must be escaped to prevent XSS.
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

const HTML_ESCAPE_REGEX = /[&<>"'/`]/g;

/**
 * Patterns commonly used in XSS injection attempts.
 */
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:\s*text\/html/i,
  /vbscript:/i,
  /expression\s*\(/i,
  /url\s*\(/i,
] as const;

/**
 * Escapes HTML special characters in a string to prevent XSS injection.
 *
 * @param input - Raw user input
 * @returns Escaped string safe for HTML rendering
 */
export function escapeHtml(input: string): string {
  return input.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Strips HTML tags from a string entirely.
 * Use when the output should contain no markup at all.
 *
 * @param input - Raw user input that may contain HTML
 * @returns String with all HTML tags removed
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Checks if a string contains potentially dangerous XSS patterns.
 *
 * @param input - String to check
 * @returns true if the string contains a suspicious pattern
 */
export function containsDangerousPatterns(input: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitizes user input for safe storage and display.
 * This is the primary function to call on any user-provided text field.
 *
 * Steps:
 * 1. Trim whitespace
 * 2. Strip null bytes (prevents null-byte injection)
 * 3. Escape HTML special characters
 *
 * @param input - Raw user input
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  const withoutNullBytes = input.replace(/\0/g, '');

  // Trim whitespace
  const trimmed = withoutNullBytes.trim();

  // Escape HTML special characters
  return escapeHtml(trimmed);
}

/**
 * Sanitizes all string values in an object (shallow, one level deep).
 * Non-string values are passed through unchanged.
 *
 * @param obj - Object with string values to sanitize
 * @returns New object with all string values sanitized
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    const value = result[key as keyof T];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    }
  }

  return result;
}
