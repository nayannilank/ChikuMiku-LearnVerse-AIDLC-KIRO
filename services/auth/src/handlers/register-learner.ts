/**
 * Learner Registration Handler
 * POST /auth/register/learner (authenticated parent only)
 *
 * Validates all fields, enforces business rules (unique username,
 * max 10 learners per parent, min 1 subject, max 5 custom subjects),
 * hashes password with bcrypt, and stores the learner profile.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { LearnerRegistrationRequest, ValidationResult, APIError } from '@chikumiku/types';
import {
  validateUsername,
  validateFullName,
  validatePassword,
  validateSchoolName,
  validateSubjectName,
} from '@chikumiku/validation';
import { requireParentalConsent, type ConsentRepository } from './parental-consent';

// --- Valid domain values ---

export const VALID_GENDERS = ['male', 'female', 'other'] as const;
export const VALID_RELATIONSHIPS = ['son', 'daughter', 'other'] as const;
export const VALID_GRADES = [
  'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th',
  '6th', '7th', '8th', '9th', '10th',
  '11th', '12th',
] as const;

export const MAX_LEARNERS_PER_PARENT = 10;
export const MAX_CUSTOM_SUBJECTS = 5;
export const MIN_SUBJECTS = 1;
export const BCRYPT_COST_FACTOR = 10;

// --- Dependency interfaces (injectable for testing) ---

/** Interface for database operations needed by this handler. */
export interface LearnerRepository {
  /** Check if a learner username already exists. */
  isUsernameTaken(username: string): Promise<boolean>;
  /** Count learners currently registered under a parent. */
  countLearnersByParent(parentUsername: string): Promise<number>;
  /** Create a new learner record. Returns the created learner ID. */
  createLearner(data: CreateLearnerData): Promise<string>;
}

/** Data passed to the repository for learner creation. */
export interface CreateLearnerData {
  parentUsername: string;
  username: string;
  name: string;
  passwordHash: string;
  gender: string;
  relationship: string;
  grade: string;
  schoolName: string;
  subjectIds: string[];
  customSubjects: string[];
}

/** Interface for password hashing. */
export interface PasswordHasher {
  /** Hash a plaintext password with bcrypt (cost factor ≥ 10). */
  hash(password: string): Promise<string>;
}

/** Authenticated request context (extracted from JWT by middleware). */
export interface AuthContext {
  parentUsername: string;
  parentId: string;
}

/** Dependencies for the register learner handler. */
export interface RegisterLearnerDeps {
  repository: LearnerRepository;
  passwordHasher: PasswordHasher;
  consentRepository: ConsentRepository;
}

/** Result from the handler: either success or error. */
export type RegisterLearnerResult =
  | { success: true; learnerId: string; message: string }
  | { success: false; error: APIError };

// --- Validation logic ---

/**
 * Validates all fields on a learner registration request.
 * Returns a ValidationResult with field-specific errors.
 */
export function validateLearnerRegistration(
  request: LearnerRegistrationRequest
): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate username
  const usernameResult = validateUsername(request.username);
  if (!usernameResult.valid) {
    errors.username = usernameResult.errors.username;
  }

  // Validate name (using fullName validator since same rules apply)
  const nameResult = validateFullName(request.name);
  if (!nameResult.valid) {
    // Map the error key from 'fullName' to 'name'
    errors.name = nameResult.errors.fullName;
  }

  // Validate password
  const passwordResult = validatePassword(request.password);
  if (!passwordResult.valid) {
    errors.password = passwordResult.errors.password;
  }

  // Validate gender
  if (!VALID_GENDERS.includes(request.gender as typeof VALID_GENDERS[number])) {
    errors.gender = 'Gender must be one of: male, female, other';
  }

  // Validate relationship
  if (!VALID_RELATIONSHIPS.includes(request.relationship as typeof VALID_RELATIONSHIPS[number])) {
    errors.relationship = 'Relationship must be one of: son, daughter, other';
  }

  // Validate grade
  if (!VALID_GRADES.includes(request.grade as typeof VALID_GRADES[number])) {
    errors.grade = 'Grade must be a valid value from LKG to 12th';
  }

  // Validate school name
  const schoolResult = validateSchoolName(request.schoolName);
  if (!schoolResult.valid) {
    errors.schoolName = schoolResult.errors.schoolName;
  }

  // Validate subjects - minimum 1 required
  if (!request.subjectIds || request.subjectIds.length < MIN_SUBJECTS) {
    errors.subjectIds = 'At least 1 subject must be selected';
  }

  // Validate custom subjects (optional, but if present must be valid)
  if (request.customSubjects && request.customSubjects.length > 0) {
    if (request.customSubjects.length > MAX_CUSTOM_SUBJECTS) {
      errors.customSubjects = `Maximum ${MAX_CUSTOM_SUBJECTS} custom subjects allowed per learner`;
    } else {
      // Validate each custom subject name
      for (let i = 0; i < request.customSubjects.length; i++) {
        const subjectResult = validateSubjectName(request.customSubjects[i]);
        if (!subjectResult.valid) {
          errors.customSubjects = `Custom subject at position ${i + 1}: ${subjectResult.errors.subjectName}`;
          break;
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// --- Handler ---

/**
 * Handles learner registration.
 * Must be called with authenticated parent context.
 * Requires parental consent before storing any learner data (Req 20.5).
 */
export async function handleRegisterLearner(
  request: LearnerRegistrationRequest,
  authContext: AuthContext,
  deps: RegisterLearnerDeps
): Promise<RegisterLearnerResult> {
  // Step 0: Verify parental consent (Req 20.5)
  const consentError = await requireParentalConsent(
    authContext.parentId,
    deps.consentRepository
  );
  if (consentError) {
    return { success: false, error: consentError };
  }

  // Pre-fill parent username from authenticated session
  const enrichedRequest: LearnerRegistrationRequest = {
    ...request,
    parentUsername: authContext.parentUsername,
  };

  // Step 1: Field-level validation
  const validationResult = validateLearnerRegistration(enrichedRequest);
  if (!validationResult.valid) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'One or more fields have validation errors',
        details: validationResult.errors,
        retryable: false,
      },
    };
  }

  // Step 2: Business rule - max 10 learners per parent
  const learnerCount = await deps.repository.countLearnersByParent(authContext.parentUsername);
  if (learnerCount >= MAX_LEARNERS_PER_PARENT) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'MAX_LEARNERS_EXCEEDED',
        message: `Maximum of ${MAX_LEARNERS_PER_PARENT} learner profiles allowed per parent account`,
        retryable: false,
      },
    };
  }

  // Step 3: Business rule - unique learner username
  const usernameTaken = await deps.repository.isUsernameTaken(enrichedRequest.username);
  if (usernameTaken) {
    return {
      success: false,
      error: {
        statusCode: 409,
        errorCode: 'USERNAME_TAKEN',
        message: 'The learner username is already in use',
        details: { username: 'This username is unavailable' },
        retryable: false,
      },
    };
  }

  // Step 4: Hash password with bcrypt (cost factor ≥ 10)
  const passwordHash = await deps.passwordHasher.hash(enrichedRequest.password);

  // Step 5: Create learner record
  const learnerId = await deps.repository.createLearner({
    parentUsername: authContext.parentUsername,
    username: enrichedRequest.username,
    name: enrichedRequest.name,
    passwordHash,
    gender: enrichedRequest.gender,
    relationship: enrichedRequest.relationship,
    grade: enrichedRequest.grade,
    schoolName: enrichedRequest.schoolName,
    subjectIds: enrichedRequest.subjectIds,
    customSubjects: enrichedRequest.customSubjects ?? [],
  });

  return {
    success: true,
    learnerId,
    message: 'Learner profile created successfully',
  };
}
