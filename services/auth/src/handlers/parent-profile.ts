/**
 * Parent Profile & Settings Handlers
 * Covers profile display, editing, password change, notifications, custom subjects,
 * and account deletion scheduling.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
import type { APIError, ValidationResult } from '@chikumiku/types';
import {
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateSubjectName,
} from '@chikumiku/validation';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Stored parent profile data. */
export interface ParentProfile {
  id: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  relationship?: string;
  progressAlertsEnabled: boolean;
  streakRemindersEnabled: boolean;
  deletionScheduledAt?: string | null;
}

/** Request body for updating profile fields. */
export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string;
  email?: string;
  relationship?: string;
}

/** Request body for changing password. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Request body for updating notification preferences. */
export interface UpdateNotificationsRequest {
  progressAlertsEnabled?: boolean;
  streakRemindersEnabled?: boolean;
}

/** Request body for adding a custom subject. */
export interface AddCustomSubjectRequest {
  name: string;
}

/** Request body for deleting account. */
export interface DeleteProfileRequest {
  password: string;
}

/** Successful profile response. */
export interface GetProfileResponse {
  username: string;
  fullName: string;
  phone: string;
  email: string;
  relationship?: string;
  progressAlertsEnabled: boolean;
  streakRemindersEnabled: boolean;
}

/** Successful update response. */
export interface UpdateProfileResponse {
  success: true;
  message: string;
}

/** Successful change password response. */
export interface ChangePasswordResponse {
  success: true;
  message: string;
}

/** Successful notifications update response. */
export interface UpdateNotificationsResponse {
  success: true;
  progressAlertsEnabled: boolean;
  streakRemindersEnabled: boolean;
}

/** Successful custom subject response. */
export interface AddCustomSubjectResponse {
  success: true;
  subjectId: string;
  name: string;
}

/** Successful delete profile response. */
export interface DeleteProfileResponse {
  success: true;
  message: string;
  deletionScheduledAt: string;
  warningDays: number;
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

/** Repository interface for parent profile operations. */
export interface ParentProfileRepository {
  findById(parentId: string): Promise<ParentProfile | null>;
  updateProfile(
    parentId: string,
    fields: { fullName?: string; phone?: string; email?: string; relationship?: string }
  ): Promise<void>;
  updatePasswordHash(parentId: string, newHash: string): Promise<void>;
  updateNotifications(
    parentId: string,
    settings: { progressAlertsEnabled?: boolean; streakRemindersEnabled?: boolean }
  ): Promise<void>;
  scheduleDeletion(parentId: string, deletionDate: string): Promise<void>;
  findPasswordHashByUserId(userId: string): Promise<string | null>;
}

/** Repository interface for custom subjects. */
export interface SubjectRepository {
  countByParentId(parentId: string): Promise<number>;
  addSubject(parentId: string, name: string): Promise<{ id: string; name: string }>;
}

/** Password hashing dependency. */
export interface ProfilePasswordHasher {
  compare(plaintext: string, hash: string): Promise<boolean>;
  hash(plaintext: string, rounds: number): Promise<string>;
}

/** Combined dependencies for profile handlers. */
export interface ParentProfileDeps {
  parentProfileRepository: ParentProfileRepository;
  subjectRepository: SubjectRepository;
  passwordHasher: ProfilePasswordHasher;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_COST_FACTOR = 10;
const ACCOUNT_DELETION_DAYS = 30;
const MAX_CUSTOM_SUBJECTS_PER_ACCOUNT = 10;

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /profile - Returns the parent's profile data.
 * Username is read-only (not editable).
 * Requirement: 17.1
 */
export async function handleGetProfile(
  parentId: string,
  deps: ParentProfileDeps
): Promise<GetProfileResponse | APIError> {
  const profile = await deps.parentProfileRepository.findById(parentId);

  if (!profile) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Parent profile not found',
      retryable: false,
    };
  }

  return {
    username: profile.username,
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    relationship: profile.relationship,
    progressAlertsEnabled: profile.progressAlertsEnabled,
    streakRemindersEnabled: profile.streakRemindersEnabled,
  };
}

/**
 * PUT /profile - Updates editable profile fields.
 * Uses the same validation as registration for name, phone, email.
 * Requirement: 17.2
 */
export async function handleUpdateProfile(
  parentId: string,
  body: unknown,
  deps: ParentProfileDeps
): Promise<UpdateProfileResponse | APIError> {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { fullName, phone, email, relationship } = body as UpdateProfileRequest;

  // At least one field must be provided
  if (!fullName && !phone && !email && relationship === undefined) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'At least one field must be provided for update',
      retryable: false,
    };
  }

  const errors: Record<string, string> = {};

  if (fullName !== undefined) {
    const result = validateFullName(fullName);
    Object.assign(errors, result.errors);
  }

  if (phone !== undefined) {
    const result = validatePhone(phone);
    Object.assign(errors, result.errors);
  }

  if (email !== undefined) {
    const result = validateEmail(email);
    Object.assign(errors, result.errors);
  }

  if (relationship !== undefined) {
    const validRelationships = ['father', 'mother', 'guardian', 'other'];
    if (!validRelationships.includes(relationship)) {
      errors.relationship = 'Relationship must be one of: father, mother, guardian, other';
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Profile update contains invalid field values',
      details: errors,
      retryable: false,
    };
  }

  const updateFields: Record<string, string> = {};
  if (fullName !== undefined) updateFields.fullName = fullName;
  if (phone !== undefined) updateFields.phone = phone;
  if (email !== undefined) updateFields.email = email;
  if (relationship !== undefined) updateFields.relationship = relationship;

  await deps.parentProfileRepository.updateProfile(parentId, updateFields);

  return {
    success: true,
    message: 'Profile updated successfully',
  };
}

/**
 * POST /profile/change-password - Changes the parent's password.
 * Requires current password verification, validates new password format.
 * Requirement: 17.3
 */
export async function handleChangePassword(
  parentId: string,
  body: unknown,
  deps: ParentProfileDeps
): Promise<ChangePasswordResponse | APIError> {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { currentPassword, newPassword } = body as ChangePasswordRequest;

  if (!currentPassword || typeof currentPassword !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Current password is required',
      details: { currentPassword: 'Current password is required' },
      retryable: false,
    };
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'New password is required',
      details: { newPassword: 'New password is required' },
      retryable: false,
    };
  }

  // Validate new password format
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'New password does not meet requirements',
      details: passwordValidation.errors,
      retryable: false,
    };
  }

  // Verify current password
  const storedHash = await deps.parentProfileRepository.findPasswordHashByUserId(parentId);
  if (!storedHash) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Parent account not found',
      retryable: false,
    };
  }

  const isCurrentValid = await deps.passwordHasher.compare(currentPassword, storedHash);
  if (!isCurrentValid) {
    return {
      statusCode: 401,
      errorCode: 'AUTH_FAILED',
      message: 'Current password is incorrect',
      retryable: false,
    };
  }

  // Hash and store new password
  const newHash = await deps.passwordHasher.hash(newPassword, BCRYPT_COST_FACTOR);
  await deps.parentProfileRepository.updatePasswordHash(parentId, newHash);

  return {
    success: true,
    message: 'Password changed successfully',
  };
}

/**
 * PUT /profile/notifications - Toggle notification preferences.
 * Requirement: 17.4
 */
export async function handleUpdateNotifications(
  parentId: string,
  body: unknown,
  deps: ParentProfileDeps
): Promise<UpdateNotificationsResponse | APIError> {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { progressAlertsEnabled, streakRemindersEnabled } = body as UpdateNotificationsRequest;

  if (progressAlertsEnabled === undefined && streakRemindersEnabled === undefined) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'At least one notification preference must be provided',
      retryable: false,
    };
  }

  if (progressAlertsEnabled !== undefined && typeof progressAlertsEnabled !== 'boolean') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'progressAlertsEnabled must be a boolean',
      details: { progressAlertsEnabled: 'Must be true or false' },
      retryable: false,
    };
  }

  if (streakRemindersEnabled !== undefined && typeof streakRemindersEnabled !== 'boolean') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'streakRemindersEnabled must be a boolean',
      details: { streakRemindersEnabled: 'Must be true or false' },
      retryable: false,
    };
  }

  const settings: { progressAlertsEnabled?: boolean; streakRemindersEnabled?: boolean } = {};
  if (progressAlertsEnabled !== undefined) settings.progressAlertsEnabled = progressAlertsEnabled;
  if (streakRemindersEnabled !== undefined) settings.streakRemindersEnabled = streakRemindersEnabled;

  await deps.parentProfileRepository.updateNotifications(parentId, settings);

  // Return the resulting state - fetch current profile to get full state
  const profile = await deps.parentProfileRepository.findById(parentId);
  if (!profile) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Parent profile not found',
      retryable: false,
    };
  }

  return {
    success: true,
    progressAlertsEnabled: profile.progressAlertsEnabled,
    streakRemindersEnabled: profile.streakRemindersEnabled,
  };
}

/**
 * POST /profile/custom-subjects - Add a custom subject.
 * Validates name (1-50 chars) and enforces max 10 per account.
 * Requirement: 17.7
 */
export async function handleAddCustomSubject(
  parentId: string,
  body: unknown,
  deps: ParentProfileDeps
): Promise<AddCustomSubjectResponse | APIError> {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { name } = body as AddCustomSubjectRequest;

  if (!name || typeof name !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Subject name is required',
      details: { name: 'Subject name is required' },
      retryable: false,
    };
  }

  // Validate subject name (1-50 chars)
  const nameValidation = validateSubjectName(name);
  if (!nameValidation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Invalid subject name',
      details: nameValidation.errors,
      retryable: false,
    };
  }

  // Check max 10 custom subjects per account
  const currentCount = await deps.subjectRepository.countByParentId(parentId);
  if (currentCount >= MAX_CUSTOM_SUBJECTS_PER_ACCOUNT) {
    return {
      statusCode: 400,
      errorCode: 'LIMIT_EXCEEDED',
      message: `Maximum of ${MAX_CUSTOM_SUBJECTS_PER_ACCOUNT} custom subjects per account`,
      retryable: false,
    };
  }

  const subject = await deps.subjectRepository.addSubject(parentId, name);

  return {
    success: true,
    subjectId: subject.id,
    name: subject.name,
  };
}

/**
 * DELETE /profile - Schedule account deletion (30 days).
 * Requires password re-entry for confirmation.
 * Requirement: 17.6
 */
export async function handleDeleteProfile(
  parentId: string,
  body: unknown,
  deps: ParentProfileDeps,
  now: Date = new Date()
): Promise<DeleteProfileResponse | APIError> {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { password } = body as DeleteProfileRequest;

  if (!password || typeof password !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Password is required for account deletion',
      details: { password: 'Password re-entry is required to confirm deletion' },
      retryable: false,
    };
  }

  // Verify password
  const storedHash = await deps.parentProfileRepository.findPasswordHashByUserId(parentId);
  if (!storedHash) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Parent account not found',
      retryable: false,
    };
  }

  const isValid = await deps.passwordHasher.compare(password, storedHash);
  if (!isValid) {
    return {
      statusCode: 401,
      errorCode: 'AUTH_FAILED',
      message: 'Password verification failed',
      retryable: false,
    };
  }

  // Schedule deletion: now + 30 days
  const deletionDate = new Date(now.getTime() + ACCOUNT_DELETION_DAYS * 24 * 60 * 60 * 1000);
  const deletionDateISO = deletionDate.toISOString();

  await deps.parentProfileRepository.scheduleDeletion(parentId, deletionDateISO);

  return {
    success: true,
    message:
      'Account deletion has been scheduled. Your account and all associated data will be permanently deleted after 30 days. You can cancel this by logging in before the deletion date.',
    deletionScheduledAt: deletionDateISO,
    warningDays: ACCOUNT_DELETION_DAYS,
  };
}
