/**
 * Unit tests for JWT validator.
 * Tests token structure, signature verification, expiration, and createToken helper.
 * Validates: Requirements 20.3, 20.7
 */

import { validateToken, createToken, DecodedToken } from './jwt-validator';

// --- Test constants ---

const TEST_SECRET = 'test-secret-key-for-jwt-validation';
const WRONG_SECRET = 'wrong-secret-key';

const validPayload: DecodedToken = {
  userId: 'user-123',
  username: 'testuser',
  role: 'parent',
  exp: Math.floor(new Date('2024-01-01T13:00:00Z').getTime() / 1000), // 1pm
};

// --- Tests ---

describe('createToken', () => {
  it('creates a token with 3 dot-separated parts', () => {
    const token = createToken(validPayload, TEST_SECRET);
    const parts = token.split('.');
    expect(parts.length).toBe(3);
  });

  it('encodes the payload correctly', () => {
    const token = createToken(validPayload, TEST_SECRET);
    const parts = token.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    expect(decoded.userId).toBe('user-123');
    expect(decoded.username).toBe('testuser');
    expect(decoded.role).toBe('parent');
    expect(decoded.exp).toBe(validPayload.exp);
  });

  it('produces different tokens for different secrets', () => {
    const token1 = createToken(validPayload, TEST_SECRET);
    const token2 = createToken(validPayload, WRONG_SECRET);
    expect(token1).not.toBe(token2);
  });
});

describe('validateToken', () => {
  describe('valid tokens', () => {
    it('returns valid result for a properly signed, non-expired token', () => {
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z'); // before expiry

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.userId).toBe('user-123');
        expect(result.payload.username).toBe('testuser');
        expect(result.payload.role).toBe('parent');
        expect(result.payload.exp).toBe(validPayload.exp);
      }
    });

    it('validates learner role tokens', () => {
      const learnerPayload: DecodedToken = {
        ...validPayload,
        role: 'learner',
        userId: 'learner-789',
      };
      const token = createToken(learnerPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.role).toBe('learner');
      }
    });
  });

  describe('malformed tokens', () => {
    it('rejects token with fewer than 3 parts', () => {
      const result = validateToken('only.two', TEST_SECRET, new Date());

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Malformed token');
      }
    });

    it('rejects token with more than 3 parts', () => {
      const result = validateToken('a.b.c.d', TEST_SECRET, new Date());

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Malformed token');
      }
    });

    it('rejects empty string', () => {
      const result = validateToken('', TEST_SECRET, new Date());

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Malformed token');
      }
    });

    it('rejects token with invalid base64url payload', () => {
      // Create a valid token, then corrupt the payload
      const token = createToken(validPayload, TEST_SECRET);
      const parts = token.split('.');
      const corruptedToken = `${parts[0]}.!!!invalid!!!.${parts[2]}`;

      const result = validateToken(corruptedToken, TEST_SECRET, new Date());

      expect(result.valid).toBe(false);
    });
  });

  describe('signature verification', () => {
    it('rejects token signed with wrong secret', () => {
      const token = createToken(validPayload, WRONG_SECRET);
      const now = new Date('2024-01-01T12:00:00Z');

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid signature');
      }
    });

    it('rejects token with tampered payload', () => {
      const token = createToken(validPayload, TEST_SECRET);
      const parts = token.split('.');

      // Tamper with the payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...validPayload, role: 'admin' })
      ).toString('base64url');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const now = new Date('2024-01-01T12:00:00Z');

      const result = validateToken(tamperedToken, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid signature');
      }
    });
  });

  describe('token expiration', () => {
    it('rejects expired token', () => {
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T14:00:00Z'); // after expiry (1pm)

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Token expired');
      }
    });

    it('rejects token at exact expiry time', () => {
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T13:00:00Z'); // exactly at exp

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Token expired');
      }
    });

    it('accepts token one second before expiry', () => {
      const token = createToken(validPayload, TEST_SECRET);
      const now = new Date('2024-01-01T12:59:59Z'); // 1 second before exp

      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(true);
    });
  });

  describe('payload validation', () => {
    it('rejects token with missing userId', () => {
      const payload = { username: 'test', role: 'parent', exp: validPayload.exp };
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${body}`).digest('base64url');
      const token = `${header}.${body}.${sig}`;

      const now = new Date('2024-01-01T12:00:00Z');
      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Malformed token');
      }
    });

    it('rejects token with invalid role value', () => {
      const payload = { userId: 'u1', username: 'test', role: 'admin', exp: validPayload.exp };
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${body}`).digest('base64url');
      const token = `${header}.${body}.${sig}`;

      const now = new Date('2024-01-01T12:00:00Z');
      const result = validateToken(token, TEST_SECRET, now);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Malformed token');
      }
    });
  });
});
