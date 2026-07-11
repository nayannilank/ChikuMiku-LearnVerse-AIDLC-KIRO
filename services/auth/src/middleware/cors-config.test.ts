/**
 * Unit tests for CORS configuration utility.
 * Validates: Requirements 20.1, 20.3
 */

import {
  DEFAULT_CORS_CONFIG,
  DEV_CORS_CONFIG,
  isOriginAllowed,
  buildCorsHeaders,
  buildPreflightResponse,
} from './cors-config';

describe('isOriginAllowed', () => {
  it('returns true for an allowed production origin', () => {
    expect(isOriginAllowed('https://learnverse.chikumiku.com', DEFAULT_CORS_CONFIG)).toBe(true);
  });

  it('returns true for the app domain', () => {
    expect(isOriginAllowed('https://app.chikumiku.com', DEFAULT_CORS_CONFIG)).toBe(true);
  });

  it('returns false for an unknown origin', () => {
    expect(isOriginAllowed('https://evil.com', DEFAULT_CORS_CONFIG)).toBe(false);
  });

  it('returns false for null origin', () => {
    expect(isOriginAllowed(null, DEFAULT_CORS_CONFIG)).toBe(false);
  });

  it('returns false for undefined origin', () => {
    expect(isOriginAllowed(undefined, DEFAULT_CORS_CONFIG)).toBe(false);
  });

  it('returns false for localhost in production config', () => {
    expect(isOriginAllowed('http://localhost:3000', DEFAULT_CORS_CONFIG)).toBe(false);
  });

  it('returns true for localhost in dev config', () => {
    expect(isOriginAllowed('http://localhost:3000', DEV_CORS_CONFIG)).toBe(true);
  });
});

describe('buildCorsHeaders', () => {
  it('returns CORS headers for an allowed origin', () => {
    const headers = buildCorsHeaders('https://learnverse.chikumiku.com');

    expect(headers['Access-Control-Allow-Origin']).toBe('https://learnverse.chikumiku.com');
    expect(headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('returns empty object for a disallowed origin', () => {
    const headers = buildCorsHeaders('https://evil.com');
    expect(Object.keys(headers).length).toBe(0);
  });

  it('returns empty object for null origin', () => {
    const headers = buildCorsHeaders(null);
    expect(Object.keys(headers).length).toBe(0);
  });

  it('includes max-age header', () => {
    const headers = buildCorsHeaders('https://learnverse.chikumiku.com');
    expect(headers['Access-Control-Max-Age']).toBe('86400');
  });

  it('exposes rate limit headers', () => {
    const headers = buildCorsHeaders('https://learnverse.chikumiku.com');
    expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Remaining');
  });
});

describe('buildPreflightResponse', () => {
  it('returns 204 with CORS headers for allowed origin', () => {
    const response = buildPreflightResponse('https://learnverse.chikumiku.com');

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://learnverse.chikumiku.com');
  });

  it('returns 403 with no headers for disallowed origin', () => {
    const response = buildPreflightResponse('https://evil.com');

    expect(response.statusCode).toBe(403);
    expect(Object.keys(response.headers).length).toBe(0);
  });
});

describe('DEV_CORS_CONFIG', () => {
  it('includes localhost origins', () => {
    expect(DEV_CORS_CONFIG.allowedOrigins).toContain('http://localhost:3000');
    expect(DEV_CORS_CONFIG.allowedOrigins).toContain('http://localhost:5173');
  });

  it('also includes production origins', () => {
    expect(DEV_CORS_CONFIG.allowedOrigins).toContain('https://learnverse.chikumiku.com');
  });
});
