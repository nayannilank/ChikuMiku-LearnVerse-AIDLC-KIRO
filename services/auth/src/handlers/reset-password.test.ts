/**
 * Unit tests for the reset password handler.
 * Tests password validation, reset token verification, and hash update.
 * Validates: Requirements 4.2, 4.3
 */

import {
  handleResetPassword,
  UserRepository,
  ResetTokenRepository,
  ResetPasswordRequest,
} from './reset-password';

// --- Test helpers ---

function createMockDeps() {
  const userRepository: UserRepository = {
    findByUsername: jest.fn().mockResolvedValue(null),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };

  const resetTokenRepository: ResetTokenRepository = {
    isValid: jest.fn().mockResolvedValue(false),
    invalidate: jest.fn().mockResolvedValue(undefined),
  };

  return { userRepository, resetTokenRepository };
}

const validRequest: ResetPasswordRequest = {
  username: 'testuser',
  resetToken: 'rst_12345_abc',
  newPassword: 'NewPass1!',
};

// --- Tests ---

describe('handleResetPassword', () => {
  describe('input validation', () => {
    it('returns error when username is empty', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, username: '' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toBe('Username is required');
      }
    });

    it('returns error when resetToken is empty', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, resetToken: '' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toBe('Reset token is required');
      }
    });

    it('returns error when newPassword is empty', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, newPassword: '' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toBe('New password is required');
      }
    });
  });

  describe('password validation', () => {
    it('returns error for weak password (no uppercase)', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, newPassword: 'weakpass1!' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
      }
    });

    it('returns error for password without special character', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, newPassword: 'NoSpecial1' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
      }
    });

    it('returns error for too short password', async () => {
      const deps = createMockDeps();
      const result = await handleResetPassword(
        { ...validRequest, newPassword: 'Ab1!' },
        deps
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('reset token verification', () => {
    it('returns error when reset token is invalid', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(false);

      const result = await handleResetPassword(validRequest, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('INVALID_RESET_TOKEN');
      }
    });

    it('checks token validity with trimmed username', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(false);

      await handleResetPassword(
        { ...validRequest, username: '  testuser  ' },
        deps
      );

      expect(deps.resetTokenRepository.isValid).toHaveBeenCalledWith(
        'testuser',
        expect.any(String)
      );
    });
  });

  describe('user not found', () => {
    it('returns error when user does not exist', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(true);
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue(null);

      const result = await handleResetPassword(validRequest, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errorCode).toBe('USER_NOT_FOUND');
      }
    });
  });

  describe('successful password reset', () => {
    it('returns success message on valid reset', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(true);
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
      });

      const result = await handleResetPassword(validRequest, deps);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain('reset successfully');
      }
    });

    it('updates password with a bcrypt hash', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(true);
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
      });

      await handleResetPassword(validRequest, deps);

      expect(deps.userRepository.updatePassword).toHaveBeenCalledWith(
        'testuser',
        expect.stringMatching(/^\$2[aby]\$/)
      );
    });

    it('invalidates reset token after use (single use)', async () => {
      const deps = createMockDeps();
      (deps.resetTokenRepository.isValid as jest.Mock).mockResolvedValue(true);
      (deps.userRepository.findByUsername as jest.Mock).mockResolvedValue({
        username: 'testuser',
      });

      await handleResetPassword(validRequest, deps);

      expect(deps.resetTokenRepository.invalidate).toHaveBeenCalledWith(
        'testuser',
        'rst_12345_abc'
      );
    });
  });
});
