/**
 * Unit tests for OTP Manager.
 * Tests OTP generation, validation, expiry, and attempt tracking.
 * Validates: Requirements 4.1, 4.4, 4.5
 */

import {
  generateOTP,
  isOTPValid,
  isOTPExpired,
  incrementAttempts,
  hasExceededMaxAttempts,
  OTPRecord,
} from './otp-manager';

// --- generateOTP tests ---

describe('generateOTP', () => {
  it('generates a 6-digit string', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('generates numeric-only codes', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOTP();
      expect(Number(otp)).not.toBeNaN();
      expect(otp.length).toBe(6);
    }
  });

  it('generates codes >= 100000 (no leading zeros lost)', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOTP();
      expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(otp, 10)).toBeLessThanOrEqual(999999);
    }
  });
});

// --- isOTPExpired tests ---

describe('isOTPExpired', () => {
  it('returns false when OTP was just created', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const createdAt = new Date('2024-01-01T12:00:00Z');
    expect(isOTPExpired(createdAt, now)).toBe(false);
  });

  it('returns false when OTP is 4 minutes old', () => {
    const createdAt = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T12:04:00Z');
    expect(isOTPExpired(createdAt, now)).toBe(false);
  });

  it('returns false when OTP is exactly 5 minutes old', () => {
    const createdAt = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T12:05:00Z');
    expect(isOTPExpired(createdAt, now)).toBe(false);
  });

  it('returns true when OTP is older than 5 minutes', () => {
    const createdAt = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T12:05:01Z');
    expect(isOTPExpired(createdAt, now)).toBe(true);
  });

  it('returns true when OTP is much older than 5 minutes', () => {
    const createdAt = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T13:00:00Z');
    expect(isOTPExpired(createdAt, now)).toBe(true);
  });
});

// --- isOTPValid tests ---

describe('isOTPValid', () => {
  const baseRecord: OTPRecord = {
    code: '123456',
    createdAt: new Date('2024-01-01T12:00:00Z'),
    attempts: 0,
    username: 'testuser',
    invalidated: false,
  };

  it('returns valid for correct code within time and attempts', () => {
    const now = new Date('2024-01-01T12:03:00Z');
    const result = isOTPValid(baseRecord, '123456', now);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns invalid when OTP is invalidated', () => {
    const record = { ...baseRecord, invalidated: true };
    const now = new Date('2024-01-01T12:01:00Z');
    const result = isOTPValid(record, '123456', now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('OTP has been invalidated');
  });

  it('returns invalid when OTP has expired', () => {
    const now = new Date('2024-01-01T12:06:00Z');
    const result = isOTPValid(baseRecord, '123456', now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('OTP has expired');
  });

  it('returns invalid when max attempts exceeded', () => {
    const record = { ...baseRecord, attempts: 3 };
    const now = new Date('2024-01-01T12:01:00Z');
    const result = isOTPValid(record, '123456', now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Maximum OTP attempts exceeded');
  });

  it('returns invalid when code does not match', () => {
    const now = new Date('2024-01-01T12:01:00Z');
    const result = isOTPValid(baseRecord, '999999', now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Invalid OTP code');
  });

  it('checks invalidation before expiry', () => {
    const record = { ...baseRecord, invalidated: true };
    const now = new Date('2024-01-01T12:10:00Z'); // expired too
    const result = isOTPValid(record, '123456', now);
    expect(result.reason).toBe('OTP has been invalidated');
  });

  it('checks expiry before max attempts', () => {
    const record = { ...baseRecord, attempts: 5 };
    const now = new Date('2024-01-01T12:10:00Z'); // expired
    const result = isOTPValid(record, '123456', now);
    expect(result.reason).toBe('OTP has expired');
  });
});

// --- incrementAttempts tests ---

describe('incrementAttempts', () => {
  it('increments from 0 to 1', () => {
    expect(incrementAttempts(0)).toBe(1);
  });

  it('increments from 2 to 3', () => {
    expect(incrementAttempts(2)).toBe(3);
  });
});

// --- hasExceededMaxAttempts tests ---

describe('hasExceededMaxAttempts', () => {
  it('returns false for 0 attempts', () => {
    expect(hasExceededMaxAttempts(0)).toBe(false);
  });

  it('returns false for 2 attempts', () => {
    expect(hasExceededMaxAttempts(2)).toBe(false);
  });

  it('returns true for 3 attempts (max)', () => {
    expect(hasExceededMaxAttempts(3)).toBe(true);
  });

  it('returns true for attempts exceeding max', () => {
    expect(hasExceededMaxAttempts(5)).toBe(true);
  });
});
