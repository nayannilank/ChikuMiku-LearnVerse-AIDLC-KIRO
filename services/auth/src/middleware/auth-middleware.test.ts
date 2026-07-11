/**
 * Unit tests for auth middleware.
 * Tests token extraction, validation, silent refresh, and 401 errors.
 * Validates: Requirements 3.6, 20.3, 20.7
 */

import {
  extractBearerToken,
  authenticateRequest,
  AuthMiddlewareDeps,
} from './auth-middleware';
import { createToken, DecodedToken } from './jwt-validator';
import type { CognitoClient } from '../clients/cognito-client';

// --- Test constants ---

const TEST_SECRET = 'test-auth-middleware-secret';

const validPayload: DecodedToken = {
  userId: 'user-123',
  username: 'testuser',
  role: 'parent',
  exp: Math.floor(new Date('2024-01-01T13:00:00Z').getTime() / 1000),
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
    sessionId: 'session-123',
    ...overrides,
  };
}

// --- extractBearerToken tests ---

describe('extractBearerToken', () => {
  it('extracts token from valid Bearer header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns null for undefined header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for null header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('returns null for header without Bearer prefix', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('returns null for Bearer without token', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
  });

  it('returns null for header with extra spaces', () => {
    expect(extractBearerToken('Bearer token extra')).toBeNull();
  });
});

// --- authenticateRequest tests ---

describe('authenticateRequest', () => {
  describe('missing authorization header', () => {
    it('returns 401 when header is undefined', async () => {
      const deps = createMockDeps();
      const result = await authenticateRequest(undefined, deps);

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toBe('Authorization header is required');
      }
    });

    it('returns 401 when header is null', async () => {
      const deps = createMockDeps();
      const result = await authenticateRequest(null, deps);

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.statusCode).toBe(401);
      }
    });

    it('returns 401 when header is empty', async () => {
      const deps = createMockDeps();
      const result = await authenticateRequest('', deps);

      expect(result.authenticated).toBe(false);
    });
  });

  describe('valid token', () => {
    it('returns authenticated user for valid token', async () => {
      const deps = createMockDeps();
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.user.userId).toBe('user-123');
        expect(result.user.username).toBe('testuser');
        expect(result.user.role).toBe('parent');
      }
    });

    it('does not include newToken when original token is valid', async () => {
      const deps = createMockDeps();
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.newToken).toBeUndefined();
      }
    });
  });

  describe('invalid token (malformed or bad signature)', () => {
    it('returns 401 for malformed token', async () => {
      const deps = createMockDeps();
      const result = await authenticateRequest('Bearer not.a.valid-token', deps);

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toBe('Invalid authentication token');
      }
    });

    it('returns 401 for token signed with wrong secret', async () => {
      const deps = createMockDeps();
      const token = createToken(validPayload, 'wrong-secret');
      const now = new Date('2024-01-01T12:00:00Z');

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toBe('Invalid authentication token');
      }
    });
  });

  describe('expired token with silent refresh', () => {
    it('attempts refresh when token expired and sessionId present', async () => {
      const deps = createMockDeps();
      const expiredPayload: DecodedToken = {
        ...validPayload,
        exp: Math.floor(new Date('2024-01-01T11:00:00Z').getTime() / 1000),
      };
      const token = createToken(expiredPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      // Refresh returns a new valid token
      const newToken = createToken(validPayload, TEST_SECRET);
      (deps.cognitoClient.refreshSession as jest.Mock).mockResolvedValue({
        accessToken: newToken,
        expiresIn: 3600,
      });

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(deps.cognitoClient.refreshSession).toHaveBeenCalledWith('session-123');
      expect(result.authenticated).toBe(true);
      if (result.authenticated) {
        expect(result.newToken).toBe(newToken);
        expect(result.user.userId).toBe('user-123');
      }
    });

    it('returns 401 when refresh fails (returns null)', async () => {
      const deps = createMockDeps();
      const expiredPayload: DecodedToken = {
        ...validPayload,
        exp: Math.floor(new Date('2024-01-01T11:00:00Z').getTime() / 1000),
      };
      const token = createToken(expiredPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      (deps.cognitoClient.refreshSession as jest.Mock).mockResolvedValue(null);

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toContain('Session expired');
      }
    });

    it('does not attempt refresh when sessionId is missing', async () => {
      const deps = createMockDeps({ sessionId: undefined });
      const expiredPayload: DecodedToken = {
        ...validPayload,
        exp: Math.floor(new Date('2024-01-01T11:00:00Z').getTime() / 1000),
      };
      const token = createToken(expiredPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = await authenticateRequest(`Bearer ${token}`, deps, now);

      expect(deps.cognitoClient.refreshSession).not.toHaveBeenCalled();
      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.error.message).toBe('Invalid authentication token');
      }
    });
  });
});
