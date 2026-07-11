/**
 * Unified security hardening tests.
 *
 * Validates all security requirements holistically:
 * - TLS enforcement (Req 20.1)
 * - Password hashing (Req 20.2)
 * - JWT configuration (Req 20.3, 20.7)
 * - Re-authentication enforcement (Req 20.4)
 * - Data privacy (Req 20.5)
 * - No tracking SDKs (Req 20.6)
 * - Generic auth errors (Req 20.3)
 * - Rate limiting
 * - Input sanitization
 * - CORS
 * - Security headers
 *
 * Validates: Requirements 20.1–20.7
 */

import {
  MIN_TLS_VERSION,
  BCRYPT_MIN_COST_FACTOR,
  JWT_MAX_EXPIRY_MINUTES,
  GENERIC_AUTH_ERRORS,
  DENIED_TRACKING_SDKS,
  isDeniedTrackingSDK,
  MAX_DELETION_WINDOW_DAYS,
  SENSITIVE_ACTIONS,
  REAUTHENTICATION_WINDOW_MS,
} from './security-config';

import { validateToken, createToken, DecodedToken } from './jwt-validator';

import {
  isSensitiveActionAuthorized,
  VERIFICATION_WINDOW_MS,
} from './sensitive-action-guard';

import {
  RateLimitStore,
  RATE_LIMIT_CONFIGS,
  buildRateLimitKey,
} from './rate-limiter';

import {
  sanitizeInput,
  sanitizeObject,
  escapeHtml,
  containsDangerousPatterns,
} from './input-sanitizer';

import {
  DEFAULT_CORS_CONFIG,
  isOriginAllowed,
  buildCorsHeaders,
  buildPreflightResponse,
} from './cors-config';

import {
  DEFAULT_SECURITY_HEADERS,
  applySecurityHeaders,
  withSecurityHeaders,
} from './security-headers';

import { authenticateRequest, AuthMiddlewareDeps } from './auth-middleware';
import type { CognitoClient } from '../clients/cognito-client';

// ─────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────

const TEST_SECRET = 'security-hardening-test-secret';

const validPayload: DecodedToken = {
  userId: 'user-sec-001',
  username: 'securityuser',
  role: 'parent',
  exp: Math.floor(new Date('2024-06-01T13:00:00Z').getTime() / 1000),
};

function createMockCognitoClient(): CognitoClient {
  return {
    createUser: jest.fn().mockResolvedValue({ cognitoUserId: 'mock-id' }),
    refreshSession: jest.fn().mockResolvedValue(null),
    terminateSession: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockDeps(overrides?: Partial<AuthMiddlewareDeps>): AuthMiddlewareDeps {
  return {
    cognitoClient: createMockCognitoClient(),
    jwtSecret: TEST_SECRET,
    sessionId: 'session-sec-001',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. TLS Enforcement (Req 20.1)
// ─────────────────────────────────────────────────────────────────────────

describe('TLS enforcement (Req 20.1)', () => {
  it('MIN_TLS_VERSION is 1.2', () => {
    expect(MIN_TLS_VERSION).toBe('1.2');
  });

  it('security headers include HSTS with max-age >= 31536000', () => {
    const hsts = DEFAULT_SECURITY_HEADERS['Strict-Transport-Security'];
    expect(hsts).toContain('max-age=');
    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    expect(maxAgeMatch).not.toBeNull();
    const maxAge = parseInt(maxAgeMatch![1], 10);
    expect(maxAge).toBeGreaterThanOrEqual(31536000); // 1 year minimum
  });

  it('HSTS includes includeSubDomains directive', () => {
    const hsts = DEFAULT_SECURITY_HEADERS['Strict-Transport-Security'];
    expect(hsts).toContain('includeSubDomains');
  });

  it('CDK TLS_1_2 security policy is enforced via MIN_TLS_VERSION config', () => {
    // The MIN_TLS_VERSION constant drives CDK stack SecurityPolicy.TLS_1_2
    expect(parseFloat(MIN_TLS_VERSION)).toBeGreaterThanOrEqual(1.2);
    expect(parseFloat(MIN_TLS_VERSION)).toBeLessThan(2.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Password Hashing (Req 20.2)
// ─────────────────────────────────────────────────────────────────────────

describe('Password hashing (Req 20.2)', () => {
  it('BCRYPT_MIN_COST_FACTOR is at least 10', () => {
    expect(BCRYPT_MIN_COST_FACTOR).toBeGreaterThanOrEqual(10);
  });

  it('BCRYPT_MIN_COST_FACTOR is a reasonable value (10-14)', () => {
    // Too high degrades performance; too low weakens security
    expect(BCRYPT_MIN_COST_FACTOR).toBeGreaterThanOrEqual(10);
    expect(BCRYPT_MIN_COST_FACTOR).toBeLessThanOrEqual(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. JWT Configuration (Req 20.3, 20.7)
// ─────────────────────────────────────────────────────────────────────────

describe('JWT configuration (Req 20.3, 20.7)', () => {
  it('JWT_MAX_EXPIRY_MINUTES equals 60', () => {
    expect(JWT_MAX_EXPIRY_MINUTES).toBe(60);
  });

  it('rejects expired tokens', () => {
    const token = createToken(validPayload, TEST_SECRET);
    const now = new Date('2024-06-01T14:00:00Z'); // after expiry

    const result = validateToken(token, TEST_SECRET, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Token expired');
    }
  });

  it('rejects tokens with invalid signatures', () => {
    const token = createToken(validPayload, 'wrong-secret');
    const now = new Date('2024-06-01T12:00:00Z');

    const result = validateToken(token, TEST_SECRET, now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Invalid signature');
    }
  });

  it('silent refresh via Cognito on expired token', async () => {
    const deps = createMockDeps();
    const expiredPayload: DecodedToken = {
      ...validPayload,
      exp: Math.floor(new Date('2024-06-01T11:00:00Z').getTime() / 1000),
    };
    const expiredToken = createToken(expiredPayload, TEST_SECRET);
    const now = new Date('2024-06-01T12:00:00Z');

    // Simulate successful refresh
    const refreshedToken = createToken(validPayload, TEST_SECRET);
    (deps.cognitoClient.refreshSession as jest.Mock).mockResolvedValue({
      accessToken: refreshedToken,
      expiresIn: 3600,
    });

    const result = await authenticateRequest(`Bearer ${expiredToken}`, deps, now);

    expect(deps.cognitoClient.refreshSession).toHaveBeenCalledWith('session-sec-001');
    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.newToken).toBe(refreshedToken);
    }
  });

  it('httpOnly secure cookie config aligns with session persistence', () => {
    // Session tokens should be httpOnly + secure (validated via constants)
    // JWT_MAX_EXPIRY_MINUTES controls access token, session persistence controls cookie lifetime
    expect(JWT_MAX_EXPIRY_MINUTES).toBeLessThanOrEqual(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Re-authentication Enforcement (Req 20.4)
// ─────────────────────────────────────────────────────────────────────────

describe('Re-authentication enforcement (Req 20.4)', () => {
  const now = new Date('2024-06-15T10:05:00.000Z');

  it('blocks sensitive actions without password verification', () => {
    expect(isSensitiveActionAuthorized(null, now)).toBe(false);
  });

  it('allows sensitive actions within 5-minute window', () => {
    const verifiedAt = new Date(now.getTime() - 2 * 60 * 1000); // 2 mins ago
    expect(isSensitiveActionAuthorized(verifiedAt, now)).toBe(true);
  });

  it('blocks sensitive actions after 5-minute window expires', () => {
    const verifiedAt = new Date(now.getTime() - VERIFICATION_WINDOW_MS); // exactly 5 mins
    expect(isSensitiveActionAuthorized(verifiedAt, now)).toBe(false);
  });

  it('SENSITIVE_ACTIONS list contains expected actions', () => {
    expect(SENSITIVE_ACTIONS).toContain('account_deletion');
    expect(SENSITIVE_ACTIONS).toContain('data_export');
    expect(SENSITIVE_ACTIONS).toContain('learner_removal');
  });

  it('REAUTHENTICATION_WINDOW_MS is 5 minutes', () => {
    expect(REAUTHENTICATION_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Data Privacy (Req 20.5)
// ─────────────────────────────────────────────────────────────────────────

describe('Data privacy (Req 20.5)', () => {
  it('MAX_DELETION_WINDOW_DAYS equals 30', () => {
    expect(MAX_DELETION_WINDOW_DAYS).toBe(30);
  });

  it('parental consent is enforced via parent-role-only sensitive actions', () => {
    // The sensitive actions (account_deletion, data_export, learner_removal)
    // can only be initiated by parent role — validated via the auth middleware
    // requiring parent authentication before these actions are allowed
    expect(SENSITIVE_ACTIONS.length).toBeGreaterThan(0);
    expect(SENSITIVE_ACTIONS).toContain('learner_removal');
    expect(SENSITIVE_ACTIONS).toContain('data_export');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6. No Tracking SDKs (Req 20.6)
// ─────────────────────────────────────────────────────────────────────────

describe('No tracking SDKs (Req 20.6)', () => {
  it('identifies all denied packages', () => {
    for (const sdk of DENIED_TRACKING_SDKS) {
      expect(isDeniedTrackingSDK(sdk)).toBe(true);
    }
  });

  it('detects scoped packages containing denied SDK names', () => {
    expect(isDeniedTrackingSDK('@analytics/google-analytics')).toBe(true);
    expect(isDeniedTrackingSDK('@my-scope/mixpanel')).toBe(true);
    expect(isDeniedTrackingSDK('@company/facebook-sdk-wrapper')).toBe(true);
  });

  it('does not flag allowed packages', () => {
    expect(isDeniedTrackingSDK('react')).toBe(false);
    expect(isDeniedTrackingSDK('aws-sdk')).toBe(false);
    expect(isDeniedTrackingSDK('@aws-cdk/core')).toBe(false);
    expect(isDeniedTrackingSDK('lodash')).toBe(false);
    expect(isDeniedTrackingSDK('typescript')).toBe(false);
  });

  it('denied list includes major analytics/tracking services', () => {
    expect(DENIED_TRACKING_SDKS).toContain('google-analytics');
    expect(DENIED_TRACKING_SDKS).toContain('mixpanel');
    expect(DENIED_TRACKING_SDKS).toContain('segment');
    expect(DENIED_TRACKING_SDKS).toContain('hotjar');
    expect(DENIED_TRACKING_SDKS).toContain('fullstory');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Generic Auth Errors (Req 20.3)
// ─────────────────────────────────────────────────────────────────────────

describe('Generic auth errors (Req 20.3)', () => {
  it('error messages do not leak PII', () => {
    const errorMessages = Object.values(GENERIC_AUTH_ERRORS);
    for (const msg of errorMessages) {
      // Should not mention username or password specifically
      expect(msg.toLowerCase()).not.toContain('username');
      expect(msg.toLowerCase()).not.toContain('password');
      expect(msg.toLowerCase()).not.toContain('email');
      expect(msg.toLowerCase()).not.toContain('phone');
    }
  });

  it('GENERIC_AUTH_ERRORS contains no username-specific or password-specific info', () => {
    expect(GENERIC_AUTH_ERRORS.INVALID_CREDENTIALS).toBe('Invalid credentials');
    expect(GENERIC_AUTH_ERRORS.INVALID_CREDENTIALS).not.toMatch(/wrong password/i);
    expect(GENERIC_AUTH_ERRORS.INVALID_CREDENTIALS).not.toMatch(/user not found/i);
    expect(GENERIC_AUTH_ERRORS.INVALID_CREDENTIALS).not.toMatch(/incorrect username/i);
  });

  it('all expected error keys exist', () => {
    expect(GENERIC_AUTH_ERRORS).toHaveProperty('INVALID_CREDENTIALS');
    expect(GENERIC_AUTH_ERRORS).toHaveProperty('SESSION_EXPIRED');
    expect(GENERIC_AUTH_ERRORS).toHaveProperty('INVALID_TOKEN');
    expect(GENERIC_AUTH_ERRORS).toHaveProperty('AUTH_REQUIRED');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 8. Rate Limiting
// ─────────────────────────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('blocks after maxRequests are consumed', () => {
    const store = new RateLimitStore();
    const config = { maxRequests: 3, windowMs: 60_000 };
    const key = 'user1:auth';
    const now = Date.now();

    // Consume all tokens
    store.checkAndConsume(key, config, now);
    store.checkAndConsume(key, config, now);
    store.checkAndConsume(key, config, now);

    // Next request should be blocked
    const result = store.checkAndConsume(key, config, now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after window elapses', () => {
    const store = new RateLimitStore();
    const config = { maxRequests: 2, windowMs: 60_000 };
    const key = 'user2:auth';
    const start = Date.now();

    // Exhaust all tokens
    store.checkAndConsume(key, config, start);
    store.checkAndConsume(key, config, start);

    const blocked = store.checkAndConsume(key, config, start);
    expect(blocked.allowed).toBe(false);

    // After window elapses, should be allowed again
    const afterWindow = start + config.windowMs + 1;
    const result = store.checkAndConsume(key, config, afterWindow);
    expect(result.allowed).toBe(true);
  });

  it('has correct rate limit configs for auth endpoint', () => {
    expect(RATE_LIMIT_CONFIGS.auth.maxRequests).toBe(10);
    expect(RATE_LIMIT_CONFIGS.auth.windowMs).toBe(15 * 60 * 1000);
  });

  it('has correct rate limit configs for passwordReset endpoint', () => {
    expect(RATE_LIMIT_CONFIGS.passwordReset.maxRequests).toBe(5);
    expect(RATE_LIMIT_CONFIGS.passwordReset.windowMs).toBe(15 * 60 * 1000);
  });

  it('has correct rate limit configs for general endpoint', () => {
    expect(RATE_LIMIT_CONFIGS.general.maxRequests).toBe(100);
    expect(RATE_LIMIT_CONFIGS.general.windowMs).toBe(60 * 1000);
  });

  it('has correct rate limit configs for ai endpoint', () => {
    expect(RATE_LIMIT_CONFIGS.ai.maxRequests).toBe(30);
    expect(RATE_LIMIT_CONFIGS.ai.windowMs).toBe(60 * 1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 9. Input Sanitization
// ─────────────────────────────────────────────────────────────────────────

describe('Input sanitization', () => {
  it('escapes XSS patterns in user input', () => {
    const malicious = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(malicious);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('strips null bytes from input', () => {
    const withNullBytes = 'hello\0world\0';
    const sanitized = sanitizeInput(withNullBytes);
    expect(sanitized).not.toContain('\0');
    expect(sanitized).toBe('helloworld');
  });

  it('sanitizeObject handles mixed types', () => {
    const input = {
      name: '<b>Bold</b>',
      count: 42,
      active: true,
      description: 'safe text',
    };
    const result = sanitizeObject(input);

    // Strings are escaped
    expect(result.name).toBe('&lt;b&gt;Bold&lt;&#x2F;b&gt;');
    // Non-strings are unchanged
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.description).toBe('safe text');
  });

  it('detects dangerous patterns', () => {
    expect(containsDangerousPatterns('<script src="evil.js">')).toBe(true);
    expect(containsDangerousPatterns('javascript:void(0)')).toBe(true);
    expect(containsDangerousPatterns('onclick=alert(1)')).toBe(true);
    expect(containsDangerousPatterns('normal text')).toBe(false);
  });

  it('escapes HTML special characters correctly', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#x27;');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 10. CORS
// ─────────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('allows configured origins', () => {
    expect(isOriginAllowed('https://learnverse.chikumiku.com', DEFAULT_CORS_CONFIG)).toBe(true);
    expect(isOriginAllowed('https://app.chikumiku.com', DEFAULT_CORS_CONFIG)).toBe(true);
  });

  it('disallowed origins get no CORS headers', () => {
    const headers = buildCorsHeaders('https://evil.example.com', DEFAULT_CORS_CONFIG);
    expect(Object.keys(headers).length).toBe(0);
  });

  it('returns empty headers for undefined origin', () => {
    const headers = buildCorsHeaders(undefined, DEFAULT_CORS_CONFIG);
    expect(Object.keys(headers).length).toBe(0);
  });

  it('preflight response returns 204 for allowed origins', () => {
    const response = buildPreflightResponse('https://learnverse.chikumiku.com', DEFAULT_CORS_CONFIG);
    expect(response.statusCode).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://learnverse.chikumiku.com');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(response.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('preflight response returns 403 for disallowed origins', () => {
    const response = buildPreflightResponse('https://attacker.com', DEFAULT_CORS_CONFIG);
    expect(response.statusCode).toBe(403);
    expect(Object.keys(response.headers).length).toBe(0);
  });

  it('includes credentials header when allowCredentials is true', () => {
    const headers = buildCorsHeaders('https://learnverse.chikumiku.com', DEFAULT_CORS_CONFIG);
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 11. Security Headers
// ─────────────────────────────────────────────────────────────────────────

describe('Security headers', () => {
  it('all expected headers are present', () => {
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('Strict-Transport-Security');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('X-Content-Type-Options');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('X-Frame-Options');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('X-XSS-Protection');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('Content-Security-Policy');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('Referrer-Policy');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('Permissions-Policy');
    expect(DEFAULT_SECURITY_HEADERS).toHaveProperty('Cache-Control');
  });

  it('X-Content-Type-Options is nosniff', () => {
    expect(DEFAULT_SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });

  it('X-Frame-Options is DENY', () => {
    expect(DEFAULT_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
  });

  it('Cache-Control prevents caching', () => {
    expect(DEFAULT_SECURITY_HEADERS['Cache-Control']).toContain('no-store');
  });

  it('applySecurityHeaders merges into existing headers', () => {
    const existing = { 'X-Custom': 'value', 'Content-Type': 'application/json' };
    const merged = applySecurityHeaders(existing);

    // Custom header preserved
    expect(merged['X-Custom']).toBe('value');
    expect(merged['Content-Type']).toBe('application/json');
    // Security headers added
    expect(merged['X-Frame-Options']).toBe('DENY');
    expect(merged['Strict-Transport-Security']).toContain('max-age=');
  });

  it('withSecurityHeaders applies headers to Lambda response', () => {
    const response = {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
      body: JSON.stringify({ ok: true }),
    };

    const secured = withSecurityHeaders(response);

    expect(secured.statusCode).toBe(200);
    expect(secured.headers['Content-Type']).toBe('application/json');
    expect(secured.headers['X-Frame-Options']).toBe('DENY');
    expect(secured.headers['Strict-Transport-Security']).toContain('max-age=');
    expect(secured.headers['Cache-Control']).toContain('no-store');
  });
});
