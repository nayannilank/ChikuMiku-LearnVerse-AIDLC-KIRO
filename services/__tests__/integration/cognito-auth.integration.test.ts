/**
 * Integration tests for Cognito authentication token flows.
 * Tests JWT issuance, validation, expiry, and refresh workflows.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import {
  validateToken,
  createToken,
  DecodedToken,
  TokenValidationResult,
} from '../../auth/src/middleware/jwt-validator';

// --- Mock Cognito Token Service ---

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

interface CognitoUser {
  userId: string;
  username: string;
  password: string;
  role: 'parent' | 'learner';
}

/**
 * Simulates Cognito token issuance and refresh behavior.
 * Uses the project's JWT validator for realistic token creation/validation.
 */
function createMockCognitoService(secret: string, tokenExpirySeconds: number = 3600) {
  const users: CognitoUser[] = [];
  const refreshTokens = new Map<string, { userId: string; username: string; role: 'parent' | 'learner'; issuedAt: number }>();
  const revokedTokens = new Set<string>();
  let refreshTokenCounter = 0;

  return {
    /** Register a user in the mock user pool. */
    registerUser(user: CognitoUser): void {
      users.push(user);
    },

    /** Simulate login — returns token pair on success. */
    login(username: string, password: string): TokenPair | { error: string } {
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        return { error: 'Invalid credentials' };
      }

      const now = Math.floor(Date.now() / 1000);
      const payload: DecodedToken = {
        userId: user.userId,
        username: user.username,
        role: user.role,
        exp: now + tokenExpirySeconds,
      };

      const accessToken = createToken(payload, secret);
      const refreshToken = `refresh-${++refreshTokenCounter}-${user.userId}`;
      refreshTokens.set(refreshToken, {
        userId: user.userId,
        username: user.username,
        role: user.role,
        issuedAt: now,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: tokenExpirySeconds,
      };
    },

    /** Simulate token refresh — issues new access token from refresh token. */
    refresh(refreshToken: string): TokenPair | { error: string } {
      if (revokedTokens.has(refreshToken)) {
        return { error: 'Refresh token revoked' };
      }

      const tokenData = refreshTokens.get(refreshToken);
      if (!tokenData) {
        return { error: 'Invalid refresh token' };
      }

      // Check refresh token validity (30-day expiry)
      const now = Math.floor(Date.now() / 1000);
      const refreshExpirySeconds = 30 * 24 * 3600;
      if (now - tokenData.issuedAt > refreshExpirySeconds) {
        return { error: 'Refresh token expired' };
      }

      const payload: DecodedToken = {
        userId: tokenData.userId,
        username: tokenData.username,
        role: tokenData.role,
        exp: now + tokenExpirySeconds,
      };

      const newAccessToken = createToken(payload, secret);
      const newRefreshToken = `refresh-${++refreshTokenCounter}-${tokenData.userId}`;

      // Revoke old refresh token and issue new one
      revokedTokens.add(refreshToken);
      refreshTokens.set(newRefreshToken, {
        userId: tokenData.userId,
        username: tokenData.username,
        role: tokenData.role,
        issuedAt: now,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: tokenExpirySeconds,
      };
    },

    /** Validate a token using the real validator. */
    validate(token: string): TokenValidationResult {
      return validateToken(token, secret, new Date());
    },

    /** Revoke a refresh token (e.g., on logout). */
    revokeRefreshToken(refreshToken: string): void {
      revokedTokens.add(refreshToken);
    },
  };
}

// --- Tests ---

describe('Cognito Auth Integration Tests', () => {
  const JWT_SECRET = 'cognito-integration-test-secret';
  const TOKEN_EXPIRY = 3600; // 1 hour

  let cognito: ReturnType<typeof createMockCognitoService>;

  beforeEach(() => {
    cognito = createMockCognitoService(JWT_SECRET, TOKEN_EXPIRY);
    cognito.registerUser({
      userId: 'parent-001',
      username: 'testparent',
      password: 'SecureP@ss1',
      role: 'parent',
    });
    cognito.registerUser({
      userId: 'learner-001',
      username: 'testlearner',
      password: 'LearnP@ss2',
      role: 'learner',
    });
  });

  describe('Token issuance on login', () => {
    it('issues valid token pair on successful parent login', () => {
      const result = cognito.login('testparent', 'SecureP@ss1');

      expect(result).not.toHaveProperty('error');
      const tokens = result as TokenPair;
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(TOKEN_EXPIRY);

      // Validate the issued access token
      const validation = cognito.validate(tokens.accessToken);
      expect(validation.valid).toBe(true);
      if (validation.valid) {
        expect(validation.payload.userId).toBe('parent-001');
        expect(validation.payload.username).toBe('testparent');
        expect(validation.payload.role).toBe('parent');
      }
    });

    it('issues valid token pair on successful learner login', () => {
      const result = cognito.login('testlearner', 'LearnP@ss2');

      expect(result).not.toHaveProperty('error');
      const tokens = result as TokenPair;

      const validation = cognito.validate(tokens.accessToken);
      expect(validation.valid).toBe(true);
      if (validation.valid) {
        expect(validation.payload.userId).toBe('learner-001');
        expect(validation.payload.role).toBe('learner');
      }
    });

    it('rejects login with invalid credentials', () => {
      const result = cognito.login('testparent', 'wrongpassword');

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Invalid credentials');
    });

    it('rejects login with non-existent username', () => {
      const result = cognito.login('nonexistent', 'anypassword');

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Invalid credentials');
    });
  });

  describe('JWT validation middleware', () => {
    it('accepts valid non-expired token', () => {
      const tokens = cognito.login('testparent', 'SecureP@ss1') as TokenPair;
      const validation = cognito.validate(tokens.accessToken);

      expect(validation.valid).toBe(true);
    });

    it('rejects expired token', () => {
      // Create a token that expired 1 second ago
      const expiredPayload: DecodedToken = {
        userId: 'parent-001',
        username: 'testparent',
        role: 'parent',
        exp: Math.floor(Date.now() / 1000) - 1,
      };
      const expiredToken = createToken(expiredPayload, JWT_SECRET);

      const validation = cognito.validate(expiredToken);

      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.error).toBe('Token expired');
      }
    });

    it('rejects token with invalid signature (tampered)', () => {
      const tokens = cognito.login('testparent', 'SecureP@ss1') as TokenPair;

      // Tamper with the token by creating one with a different secret
      const tamperedToken = createToken(
        {
          userId: 'parent-001',
          username: 'testparent',
          role: 'parent',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        'different-secret-key'
      );

      const validation = cognito.validate(tamperedToken);

      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.error).toBe('Invalid signature');
      }
    });

    it('rejects malformed token (wrong structure)', () => {
      const malformedTokens = [
        'not-a-jwt',
        'only.two.parts.here.extra',
        '',
        'a.b',
      ];

      for (const token of malformedTokens) {
        const validation = cognito.validate(token);
        expect(validation.valid).toBe(false);
      }
    });

    it('rejects token with missing required fields', () => {
      // Create a token manually with missing userId
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        username: 'test',
        role: 'parent',
        exp: Math.floor(Date.now() / 1000) + 3600,
        // Missing userId
      })).toString('base64url');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${payload}`)
        .digest('base64url');

      const token = `${header}.${payload}.${signature}`;
      const validation = cognito.validate(token);

      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.error).toBe('Malformed token');
      }
    });
  });

  describe('Token refresh flow', () => {
    it('issues new access token using valid refresh token', () => {
      const loginResult = cognito.login('testparent', 'SecureP@ss1') as TokenPair;
      const refreshResult = cognito.refresh(loginResult.refreshToken);

      expect(refreshResult).not.toHaveProperty('error');
      const newTokens = refreshResult as TokenPair;

      // New access token should be valid
      const validation = cognito.validate(newTokens.accessToken);
      expect(validation.valid).toBe(true);

      // New access token should have fresh expiry
      if (validation.valid) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        expect(validation.payload.exp).toBeGreaterThan(nowSeconds);
        expect(validation.payload.userId).toBe('parent-001');
      }
    });

    it('revokes old refresh token after successful refresh', () => {
      const loginResult = cognito.login('testparent', 'SecureP@ss1') as TokenPair;
      const refreshResult = cognito.refresh(loginResult.refreshToken) as TokenPair;

      // Old refresh token should be revoked
      const reuse = cognito.refresh(loginResult.refreshToken);
      expect(reuse).toHaveProperty('error');
      expect((reuse as { error: string }).error).toBe('Refresh token revoked');

      // New refresh token should work
      const secondRefresh = cognito.refresh(refreshResult.refreshToken);
      expect(secondRefresh).not.toHaveProperty('error');
    });

    it('rejects refresh with invalid refresh token', () => {
      const result = cognito.refresh('invalid-refresh-token');

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Invalid refresh token');
    });

    it('rejects refresh after logout (token revoked)', () => {
      const loginResult = cognito.login('testparent', 'SecureP@ss1') as TokenPair;

      // Simulate logout
      cognito.revokeRefreshToken(loginResult.refreshToken);

      const result = cognito.refresh(loginResult.refreshToken);
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toBe('Refresh token revoked');
    });
  });
});
