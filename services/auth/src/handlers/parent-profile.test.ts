import {
  handleGetProfile,
  handleUpdateProfile,
  handleChangePassword,
  handleUpdateNotifications,
  handleAddCustomSubject,
  handleDeleteProfile,
  type ParentProfileDeps,
  type ParentProfile,
  type GetProfileResponse,
  type UpdateProfileResponse,
  type ChangePasswordResponse,
  type UpdateNotificationsResponse,
  type AddCustomSubjectResponse,
  type DeleteProfileResponse,
} from './parent-profile';
import type { APIError } from '@chikumiku/types';

describe('parent-profile handlers', () => {
  const parentId = 'parent-abc-123';
  const fixedNow = new Date('2024-07-01T12:00:00.000Z');

  const mockProfile: ParentProfile = {
    id: parentId,
    username: 'testparent1',
    fullName: 'Test Parent',
    phone: '9876543210',
    email: 'test@example.com',
    relationship: 'father',
    progressAlertsEnabled: true,
    streakRemindersEnabled: true,
    deletionScheduledAt: null,
  };

  const createMockDeps = (): ParentProfileDeps => ({
    parentProfileRepository: {
      findById: jest.fn().mockResolvedValue(mockProfile),
      updateProfile: jest.fn().mockResolvedValue(undefined),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
      updateNotifications: jest.fn().mockResolvedValue(undefined),
      scheduleDeletion: jest.fn().mockResolvedValue(undefined),
      findPasswordHashByUserId: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
    },
    subjectRepository: {
      countByParentId: jest.fn().mockResolvedValue(3),
      addSubject: jest.fn().mockResolvedValue({ id: 'subj-new-1', name: 'Robotics' }),
    },
    passwordHasher: {
      compare: jest.fn().mockResolvedValue(true),
      hash: jest.fn().mockResolvedValue('$2b$10$newhashedpassword'),
    },
  });

  let deps: ParentProfileDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  // ─── handleGetProfile ─────────────────────────────────────────────────────

  describe('handleGetProfile', () => {
    it('should return profile data when parent exists', async () => {
      const result = await handleGetProfile(parentId, deps);
      const profile = result as GetProfileResponse;

      expect(profile.username).toBe('testparent1');
      expect(profile.fullName).toBe('Test Parent');
      expect(profile.phone).toBe('9876543210');
      expect(profile.email).toBe('test@example.com');
      expect(profile.relationship).toBe('father');
      expect(profile.progressAlertsEnabled).toBe(true);
      expect(profile.streakRemindersEnabled).toBe(true);
    });

    it('should return 404 when parent not found', async () => {
      (deps.parentProfileRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await handleGetProfile(parentId, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe('NOT_FOUND');
    });
  });

  // ─── handleUpdateProfile ──────────────────────────────────────────────────

  describe('handleUpdateProfile', () => {
    it('should update profile with valid fields', async () => {
      const body = { fullName: 'Updated Name', phone: '1234567890' };
      const result = await handleUpdateProfile(parentId, body, deps);
      const success = result as UpdateProfileResponse;

      expect(success.success).toBe(true);
      expect(success.message).toBe('Profile updated successfully');
      expect(deps.parentProfileRepository.updateProfile).toHaveBeenCalledWith(parentId, {
        fullName: 'Updated Name',
        phone: '1234567890',
      });
    });

    it('should return error when body is null', async () => {
      const result = await handleUpdateProfile(parentId, null, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return error when no fields provided', async () => {
      const result = await handleUpdateProfile(parentId, {}, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('At least one field must be provided for update');
    });

    it('should return validation error for invalid fullName', async () => {
      const body = { fullName: 'AB' }; // too short
      const result = await handleUpdateProfile(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.fullName).toBeDefined();
    });

    it('should return validation error for invalid phone', async () => {
      const body = { phone: '123' }; // not 10 digits
      const result = await handleUpdateProfile(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.phone).toBeDefined();
    });

    it('should return validation error for invalid email', async () => {
      const body = { email: 'not-an-email' };
      const result = await handleUpdateProfile(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.email).toBeDefined();
    });

    it('should return validation error for invalid relationship', async () => {
      const body = { relationship: 'invalid-value' };
      const result = await handleUpdateProfile(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.relationship).toBeDefined();
    });

    it('should accept valid relationship values', async () => {
      const body = { relationship: 'mother' };
      const result = await handleUpdateProfile(parentId, body, deps);
      const success = result as UpdateProfileResponse;

      expect(success.success).toBe(true);
    });

    it('should update only the provided fields', async () => {
      const body = { email: 'new@email.com' };
      const result = await handleUpdateProfile(parentId, body, deps);

      expect((result as UpdateProfileResponse).success).toBe(true);
      expect(deps.parentProfileRepository.updateProfile).toHaveBeenCalledWith(parentId, {
        email: 'new@email.com',
      });
    });
  });

  // ─── handleChangePassword ─────────────────────────────────────────────────

  describe('handleChangePassword', () => {
    it('should change password with valid current and new passwords', async () => {
      const body = { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss1!' };
      const result = await handleChangePassword(parentId, body, deps);
      const success = result as ChangePasswordResponse;

      expect(success.success).toBe(true);
      expect(success.message).toBe('Password changed successfully');
      expect(deps.passwordHasher.hash).toHaveBeenCalledWith('NewP@ss1!', 10);
      expect(deps.parentProfileRepository.updatePasswordHash).toHaveBeenCalledWith(
        parentId,
        '$2b$10$newhashedpassword'
      );
    });

    it('should return error when body is null', async () => {
      const result = await handleChangePassword(parentId, null, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
    });

    it('should return error when currentPassword is missing', async () => {
      const body = { newPassword: 'NewP@ss1!' };
      const result = await handleChangePassword(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.currentPassword).toBeDefined();
    });

    it('should return error when newPassword is missing', async () => {
      const body = { currentPassword: 'OldP@ss1' };
      const result = await handleChangePassword(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.newPassword).toBeDefined();
    });

    it('should return error when new password fails validation', async () => {
      const body = { currentPassword: 'OldP@ss1', newPassword: 'weak' };
      const result = await handleChangePassword(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('New password does not meet requirements');
    });

    it('should return 404 when parent not found', async () => {
      (deps.parentProfileRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue(null);

      const body = { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss1!' };
      const result = await handleChangePassword(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(404);
    });

    it('should return 401 when current password is incorrect', async () => {
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(false);

      const body = { currentPassword: 'WrongP@ss1', newPassword: 'NewP@ss1!' };
      const result = await handleChangePassword(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTH_FAILED');
    });
  });

  // ─── handleUpdateNotifications ────────────────────────────────────────────

  describe('handleUpdateNotifications', () => {
    it('should update progress alerts preference', async () => {
      const body = { progressAlertsEnabled: false };
      const updatedProfile = { ...mockProfile, progressAlertsEnabled: false };
      (deps.parentProfileRepository.findById as jest.Mock).mockResolvedValue(updatedProfile);

      const result = await handleUpdateNotifications(parentId, body, deps);
      const success = result as UpdateNotificationsResponse;

      expect(success.success).toBe(true);
      expect(success.progressAlertsEnabled).toBe(false);
      expect(deps.parentProfileRepository.updateNotifications).toHaveBeenCalledWith(parentId, {
        progressAlertsEnabled: false,
      });
    });

    it('should update streak reminders preference', async () => {
      const body = { streakRemindersEnabled: false };
      const updatedProfile = { ...mockProfile, streakRemindersEnabled: false };
      (deps.parentProfileRepository.findById as jest.Mock).mockResolvedValue(updatedProfile);

      const result = await handleUpdateNotifications(parentId, body, deps);
      const success = result as UpdateNotificationsResponse;

      expect(success.success).toBe(true);
      expect(success.streakRemindersEnabled).toBe(false);
    });

    it('should return error when body is null', async () => {
      const result = await handleUpdateNotifications(parentId, null, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
    });

    it('should return error when no preference provided', async () => {
      const result = await handleUpdateNotifications(parentId, {}, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('At least one notification preference must be provided');
    });

    it('should return error when progressAlertsEnabled is not a boolean', async () => {
      const body = { progressAlertsEnabled: 'yes' };
      const result = await handleUpdateNotifications(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('progressAlertsEnabled must be a boolean');
    });

    it('should return error when streakRemindersEnabled is not a boolean', async () => {
      const body = { streakRemindersEnabled: 1 };
      const result = await handleUpdateNotifications(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('streakRemindersEnabled must be a boolean');
    });
  });

  // ─── handleAddCustomSubject ───────────────────────────────────────────────

  describe('handleAddCustomSubject', () => {
    it('should add a valid custom subject', async () => {
      const body = { name: 'Robotics' };
      const result = await handleAddCustomSubject(parentId, body, deps);
      const success = result as AddCustomSubjectResponse;

      expect(success.success).toBe(true);
      expect(success.subjectId).toBe('subj-new-1');
      expect(success.name).toBe('Robotics');
    });

    it('should return error when body is null', async () => {
      const result = await handleAddCustomSubject(parentId, null, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
    });

    it('should return error when name is missing', async () => {
      const result = await handleAddCustomSubject(parentId, {}, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.name).toBe('Subject name is required');
    });

    it('should return error when subject name exceeds 50 chars', async () => {
      const body = { name: 'A'.repeat(51) };
      const result = await handleAddCustomSubject(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.subjectName).toBeDefined();
    });

    it('should return error when max 10 subjects reached', async () => {
      (deps.subjectRepository.countByParentId as jest.Mock).mockResolvedValue(10);

      const body = { name: 'New Subject' };
      const result = await handleAddCustomSubject(parentId, body, deps);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe('LIMIT_EXCEEDED');
    });

    it('should allow adding when under the limit', async () => {
      (deps.subjectRepository.countByParentId as jest.Mock).mockResolvedValue(9);

      const body = { name: 'New Subject' };
      const result = await handleAddCustomSubject(parentId, body, deps);
      const success = result as AddCustomSubjectResponse;

      expect(success.success).toBe(true);
    });
  });

  // ─── handleDeleteProfile ──────────────────────────────────────────────────

  describe('handleDeleteProfile', () => {
    it('should schedule account deletion with correct date', async () => {
      const body = { password: 'MyP@ss1!' };
      const result = await handleDeleteProfile(parentId, body, deps, fixedNow);
      const success = result as DeleteProfileResponse;

      expect(success.success).toBe(true);
      expect(success.warningDays).toBe(30);
      // 30 days from fixedNow
      const expectedDate = new Date('2024-07-31T12:00:00.000Z');
      expect(success.deletionScheduledAt).toBe(expectedDate.toISOString());
      expect(success.message).toContain('30 days');
    });

    it('should call scheduleDeletion on repository', async () => {
      const body = { password: 'MyP@ss1!' };
      await handleDeleteProfile(parentId, body, deps, fixedNow);

      const expectedDate = new Date('2024-07-31T12:00:00.000Z');
      expect(deps.parentProfileRepository.scheduleDeletion).toHaveBeenCalledWith(
        parentId,
        expectedDate.toISOString()
      );
    });

    it('should return error when body is null', async () => {
      const result = await handleDeleteProfile(parentId, null, deps, fixedNow);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
    });

    it('should return error when password is missing', async () => {
      const result = await handleDeleteProfile(parentId, {}, deps, fixedNow);
      const error = result as APIError;

      expect(error.statusCode).toBe(400);
      expect(error.details?.password).toBeDefined();
    });

    it('should return 404 when parent not found', async () => {
      (deps.parentProfileRepository.findPasswordHashByUserId as jest.Mock).mockResolvedValue(null);

      const body = { password: 'MyP@ss1!' };
      const result = await handleDeleteProfile(parentId, body, deps, fixedNow);
      const error = result as APIError;

      expect(error.statusCode).toBe(404);
    });

    it('should return 401 when password is incorrect', async () => {
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(false);

      const body = { password: 'WrongP@ss1!' };
      const result = await handleDeleteProfile(parentId, body, deps, fixedNow);
      const error = result as APIError;

      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('AUTH_FAILED');
    });
  });
});
