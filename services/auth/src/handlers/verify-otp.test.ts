/**
 * Unit tests for the verify OTP handler.
 * Tests valid OTP, invalid OTP, expired OTP, max attempts, already invalidated.
 * Validates: Requirements 4.1, 4.4, 4.5
 */

import { handleVerifyOTP, OTPRepository } from './verify-otp';
import { OTPRecord } from '../otp/otp-manager';

// --- Test helpers ---

function createMockOTPRepository(): OTPRepository {
  return {
    findLatestByUsername: jest.fn().mockResolvedValue(null),
    updateAttempts: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };
}

function createValidOTPRecord(overrides?: Partial<OTPRecord>): OTPRecord {
  return {
    code: '123456',
    createdAt: new Date('2024-01-01T12:00:00Z'),
    attempts: 0,
    username: 'testuser',
    invalidated: false,
    ...overrides,
  };
}

// --- Tests ---

describe('handleVerifyOTP', () => {
  describe('input validation', () => {
    it('returns error when username is empty', async () => {
      const otpRepository = createMockOTPRepository();
      const result = await handleVerifyOTP(
        { username: '', otp: '123456' },
        { otpRepository }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
        expect(result.error.message).toBe('Username is required');
      }
    });

    it('returns error when OTP is empty', async () => {
      const otpRepository = createMockOTPRepository();
      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '' },
        { otpRepository }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
        expect(result.error.message).toBe('OTP is required');
      }
    });

    it('returns error when OTP is whitespace only', async () => {
      const otpRepository = createMockOTPRepository();
      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '   ' },
        { otpRepository }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
      }
    });
  });

  describe('OTP not found', () => {
    it('returns OTP_NOT_FOUND when no OTP record exists', async () => {
      const otpRepository = createMockOTPRepository();
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(null);

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_NOT_FOUND');
      }
    });
  });

  describe('successful verification', () => {
    it('returns verified true with reset token for valid OTP', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord();
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      // Use a time within 5 minutes of creation
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(true);
        expect(result.data.resetToken).toBeDefined();
        expect(result.data.resetToken).toContain('rst_');
      }
    });

    it('invalidates OTP after successful verification (single use)', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord();
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(otpRepository.invalidate).toHaveBeenCalledWith('testuser');
    });
  });

  describe('invalid OTP code', () => {
    it('returns OTP_INVALID for wrong code', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord();
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '999999' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_INVALID');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('increments attempts on wrong code', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord({ attempts: 1 });
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      await handleVerifyOTP(
        { username: 'testuser', otp: '999999' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(otpRepository.updateAttempts).toHaveBeenCalledWith('testuser', 2);
    });

    it('returns OTP_MAX_ATTEMPTS and invalidates when 3rd attempt fails', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord({ attempts: 2 }); // This is the 3rd attempt
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '999999' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_MAX_ATTEMPTS');
        expect(result.error.retryable).toBe(false);
      }
      expect(otpRepository.invalidate).toHaveBeenCalledWith('testuser');
    });
  });

  describe('expired OTP', () => {
    it('returns OTP_EXPIRED when OTP is older than 5 minutes', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord({
        createdAt: new Date('2024-01-01T12:00:00Z'),
      });
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:06:00Z')); // 6 minutes later

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_EXPIRED');
        expect(result.error.retryable).toBe(false);
      }
    });
  });

  describe('already invalidated OTP', () => {
    it('returns OTP_INVALIDATED for previously invalidated OTP', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord({ invalidated: true });
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_INVALIDATED');
      }
    });
  });

  describe('max attempts already exceeded', () => {
    it('returns OTP_MAX_ATTEMPTS when attempts already at max', async () => {
      const otpRepository = createMockOTPRepository();
      const record = createValidOTPRecord({ attempts: 3 });
      (otpRepository.findLatestByUsername as jest.Mock).mockResolvedValue(record);

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T12:03:00Z'));

      const result = await handleVerifyOTP(
        { username: 'testuser', otp: '123456' },
        { otpRepository }
      );

      jest.useRealTimers();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('OTP_MAX_ATTEMPTS');
      }
    });
  });
});
