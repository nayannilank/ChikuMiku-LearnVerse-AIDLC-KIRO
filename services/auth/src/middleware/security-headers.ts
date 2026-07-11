/**
 * Security headers middleware for Lambda responses.
 *
 * Adds recommended security headers to all HTTP responses:
 * - Strict-Transport-Security (HSTS): enforce HTTPS for 1 year
 * - X-Content-Type-Options: prevent MIME type sniffing
 * - X-Frame-Options: prevent clickjacking
 * - X-XSS-Protection: legacy XSS filter (still useful for older browsers)
 * - Content-Security-Policy: restrict resource loading
 * - Referrer-Policy: limit referrer leakage
 * - Permissions-Policy: disable unnecessary browser features
 * - Cache-Control: prevent caching of authenticated responses
 *
 * Requirements: 20.1, 20.3
 */

export interface SecurityHeaders {
  'Strict-Transport-Security': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Content-Security-Policy': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Cache-Control': string;
}

/**
 * Default security headers applied to all Lambda responses.
 * HSTS max-age is set to 1 year (31536000 seconds) with includeSubDomains.
 */
export const DEFAULT_SECURITY_HEADERS: SecurityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.amazonaws.com; frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=()',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

/**
 * Merges security headers into an existing headers object.
 * Security headers take precedence over any existing headers with the same name.
 *
 * @param existingHeaders - Headers already set on the response
 * @returns Merged headers with security headers applied
 */
export function applySecurityHeaders(
  existingHeaders: Record<string, string> = {}
): Record<string, string> {
  return {
    ...existingHeaders,
    ...DEFAULT_SECURITY_HEADERS,
  };
}

/**
 * Wraps a Lambda response object with security headers.
 * Use this to wrap the return value of any Lambda handler.
 *
 * @param response - The Lambda response object
 * @returns Response with security headers applied
 */
export function withSecurityHeaders<T extends { headers?: Record<string, string> }>(
  response: T
): T {
  return {
    ...response,
    headers: applySecurityHeaders(response.headers),
  };
}
