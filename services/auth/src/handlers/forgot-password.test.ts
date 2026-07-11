/**
 * Unit tests for the forgot password handler.
 * Tests generic response behavior and OTP generation flow.
 * Validates: Requirements 4.1, 4.6
 */

import {
  handleForgotPassword,
  UserRepository,
  OTPRepository,
  NotificationService,
  ForgotPasswordRequest,
} from './forgot-password';

// --- Test helpers ---

function createMockDeps() {
  const userRepository: UserRepository = {
    findByUsername: jest.fn().mockResolvedValue(null),
  };

  const otpRepository: OTPRepository = {
    invalidateExisting: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
  };

  const notificationService: NotificationService = {
    sendOTP: jest.fn().mockResolvedValue(undefined),
  };

  return { userRepository, otpRepository, notificationService };
}

// --- Tests ---

describe('handleForgotPassword', () => {
  describe('input validation', () => {
    it('returns error when username is empty', async () => {
      const deps = createMockDeps();
      const result = await handleForgotPassword({ username: '' }, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
        expect(result.error.message).toBe('Username is required');
      }
    });

    it('returns error when username is whitespace only', async () => {
      const deps = createMockDeps();
      const result = await handleForgotPassword({ username: '   ' }, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
      }
    });

    it('returns error when username is undefined-like', async () => {
      const deps = createMockDeps();
      const result = await handleForgotPassword({ username: '' }, deps);

      expect(result.success).toBe(false);
    });
  });

  describe('generic response (security - prevents username enumeration)', () => {
    it('returns generic success message when user does NOT exist', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue(null);

      const result = await handleForgotPassword({ username: 'nonexistent' }, deps);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('If the username exists, an OTP has been sent');
      }
    });

    it('returns same generic message when user DOES exist', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'existinguser',
        email: 'user@example.com',
        phone: '+1234567890',
      });

      const result = await handleForgotPassword({ username: 'existinguser' }, deps);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe('If the username exists, an OTP has been sent');
      }
    });

    it('returns identical response for existing and non-existing users', async () => {
      const deps = createMockDeps();

      // Non-existing user
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue(null);
      const result1 = await handleForgotPassword({ username: 'nouser' }, deps);

      // Existing user
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'realuser',
        email: 'user@example.com',
        phone: '+1234567890',
      });
      const result2 = await handleForgotPassword({ username: 'realuser' }, deps);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.message).toBe(result2.data.message);
      }
    });
  });

  describe('OTP generation flow (when user exists)', () => {
    it('invalidates existing OTPs before generating new one', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        phone: '+1234567890',
      });

      await handleForgotPassword({ username: 'testuser' }, deps);

      expect(deps.otpRepository.invalidateExisting).toHaveBeenCalledWith('testuser');
    });

    it('stores a new OTP record', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        phone: '+1234567890',
      });

      await handleForgotPassword({ username: 'testuser' }, deps);

      expect(deps.otpRepository.store).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          attempts: 0,
          invalidated: false,
        })
      );
    });

    it('stores OTP with a 6-digit code', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        phone: '+1234567890',
      });

      await handleForgotPassword({ username: 'testuser' }, deps);

      const storedRecord = (deps.otpRepository.store as jest.Mock).mock.calls[0][0];
      expect(storedRecord.code).toMatch(/^\d{6}$/);
    });

    it('sends OTP to user email and phone', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
        email: 'test@example.com',
        phone: '+1234567890',
      });

      await handleForgotPassword({ username: 'testuser' }, deps);

      expect(deps.notificationService.sendOTP).toHaveBeenCalledWith(
        { email: 'test@example.com', phone: '+1234567890' },
        expect.stringMatching(/^\d{6}$/)
      );
    });

    it('does NOT send OTP when user does not exist', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue(null);

      await handleForgotPassword({ username: 'nonexistent' }, deps);

      expect(deps.notificationService.sendOTP).not.toHaveBeenCalled();
      expect(deps.otpRepository.store).not.toHaveBeenCalled();
    });

    it('trims username before lookup', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue(null);

      await handleForgotPassword({ username: '  testuser  ' }, deps);

      expect(deps.userRepository.findByUsername).toHaveBeenCalledWith('testuser');
    });
  });
});
