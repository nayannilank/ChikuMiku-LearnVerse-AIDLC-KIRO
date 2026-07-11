import {
  handleVerifyPassword,
  validateVerifyPasswordRequest,
  type AuthContext,
  type VerifyPasswordDeps,
  type VerifyPasswordSuccessResponse,
} from './verify-password';
import type { APIError } from '@chikumiku/types';

describe('verify-password handler', () => {
  const parentContext: AuthContext = {
    userId: 'parent-123',
    username: 'testparent',
    role: 'parent',
  };

  const learnerContext: AuthContext = {
    userId: 'learner-456',
    username: 'testlearner',
    role: 'learner',
  };

  const mockDeps: VerifyPasswordDeps = {
    parentRepository: {
      findPasswordHashByUserId: jest.fn(),
    },
    passwordHasher: {
      compare: jest.fn(),
    },
  };

  const fixedNow = new Date('2024-06-15T10:05:00.000Z');

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('validateVerifyPasswordRequest', () => {
    it('should return error when body is null', () => {
      const result = validateVerifyPasswordRequest(null);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
      expect(result!.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return error when body is undefined', () => {
      const result = validateVerifyPasswordRequest(undefined);
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
    });

    it('should return error when body is not an object', () => {
      const result = validateVerifyPasswordRequest('string');
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
    });

    it('should return error when password is missing', () => {
      const result = validateVerifyPasswordRequest({});
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
      expect(result!.message).toBe('Password is required');
    });

    it('should return error when password is empty string', () => {
      const result = validateVerifyPasswordRequest({ password: '' });
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
    });

    it('should return error when password is whitespace only', () => {
      const result = validateVerifyPasswordRequest({ password: '   ' });
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
    });

    it('should return error when password is not a string', () => {
      const result = validateVerifyPasswordRequest({ password: 12345 });
      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(400);
    });

    it('should return null for valid request', () => {
      const result = validateVerifyPasswordRequest({ password: 'MyP@ss1' });
      expect(result).toBeNull();
    });
  });

  describe('handleVerifyPassword', () => {
    it('should return validation error for invalid body', async () => {
      const result = await handleVerifyPassword(null, parentContext, mockDeps, fixedNow);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 403 when caller is a learner', async () => {
      const result = await handleVerifyPassword(
        { password: 'Test@123' },
        learnerContext,
        mockDeps,
        fixedNow
      );
      expect((result as APIError).statusCode).toBe(403);
      expect((result as APIError).errorCode).toBe('FORBIDDEN');
      expect((result as APIError).message).toContain('Only parent accounts');
    });

    it('should return 404 when parent account not found', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue(null);

      const result = await handleVerifyPassword(
        { password: 'Test@123' },
        parentContext,
        mockDeps,
        fixedNow
      );
      expect((result as APIError).statusCode).toBe(404);
      expect((result as APIError).errorCode).toBe('NOT_FOUND');
    });

    it('should return 401 when password does not match', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
      (mockDeps.passwordHasher.compare as jest.Mock).mockResolvedValue(false);

      const result = await handleVerifyPassword(
        { password: 'WrongP@ss1' },
        parentContext,
        mockDeps,
        fixedNow
      );
      expect((result as APIError).statusCode).toBe(401);
      expect((result as APIError).errorCode).toBe('AUTH_FAILED');
      expect((result as APIError).message).toBe('Password verification failed');
    });

    it('should return verification success when password matches', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
      (mockDeps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      const result = await handleVerifyPassword(
        { password: 'Correct@Pass1' },
        parentContext,
        mockDeps,
        fixedNow
      );

      const success = result as VerifyPasswordSuccessResponse;
      expect(success.verified).toBe(true);
      expect(success.expiresIn).toBe(300);
      expect(success.verifiedAt).toBe('2024-06-15T10:05:00.000Z');
    });

    it('should call parentRepository with the correct userId', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue('$2b$10$hash');
      (mockDeps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      await handleVerifyPassword(
        { password: 'Test@123' },
        parentContext,
        mockDeps,
        fixedNow
      );

      expect(mockDeps.parentRepository.findPasswordHashByUserId).toHaveBeenCalledWith('parent-123');
    });

    it('should call passwordHasher.compare with plaintext and hash', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue('$2b$10$storedhash');
      (mockDeps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      await handleVerifyPassword(
        { password: 'MySecret@1' },
        parentContext,
        mockDeps,
        fixedNow
      );

      expect(mockDeps.passwordHasher.compare).toHaveBeenCalledWith('MySecret@1', '$2b$10$storedhash');
    });

    it('should use current time when now is not provided', async () => {
      (mockDeps.parentRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue('$2b$10$hash');
      (mockDeps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      const before = new Date();
      const result = await handleVerifyPassword(
        { password: 'Test@123' },
        parentContext,
        mockDeps
      );
      const after = new Date();

      const success = result as VerifyPasswordSuccessResponse;
      const verifiedAt = new Date(success.verifiedAt);
      expect(verifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(verifiedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
