/**
 * Unit tests for security headers middleware.
 * Validates: Requirements 20.1, 20.3
 */

import {
  DEFAULT_SECURITY_HEADERS,
  applySecurityHeaders,
  withSecurityHeaders,
} from './security-headers';

describe('DEFAULT_SECURITY_HEADERS', () => {
  it('includes HSTS with 1 year max-age', () => {
    expect(DEFAULT_SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(DEFAULT_SECURITY_HEADERS['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('includes nosniff content type options', () => {
    expect(DEFAULT_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('includes DENY for X-Frame-Options', () => {
    expect(DEFAULT_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('includes XSS protection in block mode', () => {
    expect(DEFAULT_SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block');
  });

  it('includes Content-Security-Policy with frame-ancestors none', () => {
    expect(DEFAULT_SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('includes strict-origin-when-cross-origin referrer policy', () => {
    expect(DEFAULT_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('includes permissions policy disabling geolocation and payment', () => {
    expect(DEFAULT_SECURITY_HEADERS['Permissions-Policy']).toContain('geolocation=()');
    expect(DEFAULT_SECURITY_HEADERS['Permissions-Policy']).toContain('payment=()');
  });

  it('includes no-store cache control', () => {
    expect(DEFAULT_SECURITY_HEADERS['Cache-Control']).toContain('no-store');
  });
});

describe('applySecurityHeaders', () => {
  it('returns security headers when given empty object', () => {
    const headers = applySecurityHeaders({});
    expect(headers['Strict-Transport-Security']).toBeDefined();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('merges with existing headers', () => {
    const existing = { 'Content-Type': 'application/json' };
    const headers = applySecurityHeaders(existing);

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('security headers override existing headers with same name', () => {
    const existing = { 'X-Frame-Options': 'SAMEORIGIN' };
    const headers = applySecurityHeaders(existing);

    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('returns security headers when called with no argument', () => {
    const headers = applySecurityHeaders();
    expect(Object.keys(headers).length).toBe(8);
  });
});

describe('withSecurityHeaders', () => {
  it('wraps a Lambda response with security headers', () => {
    const response = {
      statusCode: 200,
      body: JSON.stringify({ message: 'ok' }),
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
    };

    const result = withSecurityHeaders(response);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(response.body);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('adds headers property when response has none', () => {
    const response = { statusCode: 204, body: '', headers: undefined as Record<string, string> | undefined };

    const result = withSecurityHeaders(response);

    expect(result.headers!['X-Content-Type-Options']).toBe('nosniff');
  });
});
