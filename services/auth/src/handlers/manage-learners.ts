/**
 * Manage Learners Handlers
 * Provides CRUD operations for parent-managed learner profiles.
 *
 * - GET    /learners           → handleListLearners
 * - PUT    /learners/:id       → handleEditLearner
 * - POST   /learners/:id/reset-password → handleResetLearnerPassword
 * - DELETE  /learners/:id       → handleDeleteLearner
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */

import type { APIError, ValidationResult } from '@chikumiku/types';
import {
  validateFullName,
  validateSchoolName,
  validatePassword,
} from '@chikumiku/validation';
import { VALID_GRADES } from './register-learner';

// --- Constants ---

const MIN_SUBJECTS = 1;
const BCRYPT_COST_FACTOR = 10;

// --- Types ---

/** Learner record as returned from the list endpoint. */
export interface LearnerRecord {
  id: string;
  username: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  grade: string;
  schoolName: string;
  subjectIds: string[];
  customSubjects: string[];
}

/** Request body for editing a learner profile. */
export interface EditLearnerRequest {
  name?: string;
  grade?: string;
  schoolName?: string;
  subjectIds?: string[];
}

/** Request body for resetting a learner password. */
export interface ResetLearnerPasswordRequest {
  newPassword: string;
}

// --- Dependency Interfaces ---

/** Repository interface for manage-learners operations. */
export interface ManageLearnerRepository {
  /** Fetch all learners belonging to a parent. */
  findLearnersByParentId(parentId: string): Promise<LearnerRecord[]>;
  /** Find a learner by ID. Returns null if not found. */
  findLearnerById(learnerId: string): Promise<(LearnerRecord & { parentId: string }) | null>;
  /** Update editable fields on a learner record. */
  updateLearner(learnerId: string, data: Partial<Pick<LearnerRecord, 'name' | 'grade' | 'schoolName' | 'subjectIds'>>): Promise<void>;
  /** Update the password hash for a learner. */
  updateLearnerPassword(learnerId: string, passwordHash: string): Promise<void>;
  /** Soft-delete a learner (set deleted_at timestamp). Atomic operation. */
  softDeleteLearner(learnerId: string): Promise<void>;
}

/** Password hasher interface for bcrypt operations. */
export interface ManageLearnerPasswordHasher {
  hash(password: string, costFactor: number): Promise<string>;
}

/** Dependencies injected into manage-learner handlers. */
export interface ManageLearnerDeps {
  repository: ManageLearnerRepository;
  passwordHasher: ManageLearnerPasswordHasher;
}

// --- Result Types ---

export type ListLearnersResult = { success: true; learners: LearnerRecord[] } | APIError;
export type EditLearnerResult = { success: true; message: string } | APIError;
export type ResetPasswordResult = { success: true; message: string } | APIError;
export type DeleteLearnerResult = { success: true; message: string } | APIError;

// --- Validation ---

/**
 * Validates editable fields on an edit-learner request.
 * Only validates fields that are present in the request body.
 * Enforces min 1 subject when subjectIds is provided.
 */
export function validateEditLearnerRequest(body: EditLearnerRequest): ValidationResult {
  const errors: Record<string, string> = {};

  if (body.name !== undefined) {
    const nameResult = validateFullName(body.name);
    if (!nameResult.valid) {
      errors.name = nameResult.errors.fullName;
    }
  }

  if (body.grade !== undefined) {
    if (!VALID_GRADES.includes(body.grade as typeof VALID_GRADES[number])) {
      errors.grade = 'Grade must be a valid value from LKG to 12th';
    }
  }

  if (body.schoolName !== undefined) {
    const schoolResult = validateSchoolName(body.schoolName);
    if (!schoolResult.valid) {
      errors.schoolName = schoolResult.errors.schoolName;
    }
  }

  if (body.subjectIds !== undefined) {
    if (!Array.isArray(body.subjectIds) || body.subjectIds.length < MIN_SUBJECTS) {
      errors.subjectIds = 'At least 1 subject must be selected';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// --- Handlers ---

/**
 * List all learners under a parent account.
 * GET /learners
 *
 * Requirement 16.1: Display list of all learners showing name, gender, grade, subjects.
 */
export async function handleListLearners(
  parentId: string,
  deps: ManageLearnerDeps
): Promise<ListLearnersResult> {
  const learners = await deps.repository.findLearnersByParentId(parentId);

  return {
    success: true,
    learners,
  };
}

/**
 * Edit a learner's name, grade, school, or subjects.
 * PUT /learners/:id
 *
 * Requirement 16.2: Edit name, grade, school, subjects with same constraints as registration.
 * Enforces min 1 subject.
 */
export async function handleEditLearner(
  learnerId: string,
  parentId: string,
  body: EditLearnerRequest,
  deps: ManageLearnerDeps
): Promise<EditLearnerResult> {
  // Step 1: Validate request body
  const validation = validateEditLearnerRequest(body);
  if (!validation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'One or more fields have validation errors',
      details: validation.errors,
      retryable: false,
    };
  }

  // Step 2: Verify learner exists and belongs to this parent
  const learner = await deps.repository.findLearnerById(learnerId);
  if (!learner) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Learner not found',
      retryable: false,
    };
  }

  if (learner.parentId !== parentId) {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'You do not have permission to edit this learner',
      retryable: false,
    };
  }

  // Step 3: Build update payload (only include provided fields)
  const updateData: Partial<Pick<LearnerRecord, 'name' | 'grade' | 'schoolName' | 'subjectIds'>> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.grade !== undefined) updateData.grade = body.grade;
  if (body.schoolName !== undefined) updateData.schoolName = body.schoolName;
  if (body.subjectIds !== undefined) updateData.subjectIds = body.subjectIds;

  // Step 4: Perform update
  await deps.repository.updateLearner(learnerId, updateData);

  return {
    success: true,
    message: 'Learner profile updated successfully',
  };
}

/**
 * Reset a learner's password.
 * POST /learners/:id/reset-password
 *
 * Requirement 16.3: New password must meet password policy.
 * Returns a generic validation error if password is invalid.
 */
export async function handleResetLearnerPassword(
  learnerId: string,
  parentId: string,
  body: ResetLearnerPasswordRequest,
  deps: ManageLearnerDeps
): Promise<ResetPasswordResult> {
  // Step 1: Validate new password using shared validator
  if (!body.newPassword) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'New password does not meet the password policy requirements',
      retryable: false,
    };
  }

  const passwordResult = validatePassword(body.newPassword);
  if (!passwordResult.valid) {
    // Requirement 16.3: generic validation error message
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'New password does not meet the password policy requirements',
      retryable: false,
    };
  }

  // Step 2: Verify learner exists and belongs to this parent
  const learner = await deps.repository.findLearnerById(learnerId);
  if (!learner) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Learner not found',
      retryable: false,
    };
  }

  if (learner.parentId !== parentId) {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'You do not have permission to reset this learner\'s password',
      retryable: false,
    };
  }

  // Step 3: Hash new password with bcrypt (cost factor ≥ 10)
  const passwordHash = await deps.passwordHasher.hash(body.newPassword, BCRYPT_COST_FACTOR);

  // Step 4: Update password in repository
  await deps.repository.updateLearnerPassword(learnerId, passwordHash);

  return {
    success: true,
    message: 'Learner password has been reset successfully',
  };
}

/**
 * Soft-delete a learner profile.
 * DELETE /learners/:id
 *
 * Requirements 16.4, 16.5: Soft delete as atomic operation (all-or-nothing).
 * The confirmation dialog is handled client-side; this endpoint performs the deletion.
 */
export async function handleDeleteLearner(
  learnerId: string,
  parentId: string,
  deps: ManageLearnerDeps
): Promise<DeleteLearnerResult> {
  // Step 1: Verify learner exists and belongs to this parent
  const learner = await deps.repository.findLearnerById(learnerId);
  if (!learner) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Learner not found',
      retryable: false,
    };
  }

  if (learner.parentId !== parentId) {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'You do not have permission to remove this learner',
      retryable: false,
    };
  }

  // Step 2: Perform soft deletion (atomic — all or nothing)
  await deps.repository.softDeleteLearner(learnerId);

  return {
    success: true,
    message: 'Learner profile has been removed successfully',
  };
}
