/**
 * Parent Registration Handler
 * POST /auth/register/parent
 *
 * Validates input fields using shared validators, hashes password with bcrypt,
 * checks username uniqueness, creates the parent in the database, and
 * creates a Cognito user for session management.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 20.2
 */
import * as bcrypt from 'bcrypt';
import {
  ParentRegistrationRequest,
  ValidationResult,
  APIError,
} from '@chikumiku/types';
import {
  validateUsername,
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
} from '@chikumiku/validation';
import { DBClient } from '../clients/db-client';
import { CognitoClient } from '../clients/cognito-client';

/** Minimum bcrypt cost factor per security requirements */
const BCRYPT_COST_FACTOR = 10;

/** Auto-redirect countdown time in seconds */
const REDIRECT_COUNTDOWN_SECONDS = 5;

export interface RegisterParentResponse {
  success: true;
  message: string;
  redirectTo: string;
  redirectCountdownSeconds: number;
}

export interface RegisterParentDependencies {
  dbClient: DBClient;
  cognitoClient: CognitoClient;
  generateId: () => string;
}

/**
 * Validate all fields of the parent registration request.
 * Returns a combined ValidationResult with all field errors.
 */
export function validateParentRegistration(
  request: ParentRegistrationRequest
): ValidationResult {
  const errors: Record<string, string> = {};

  const usernameResult = validateUsername(request.username);
  const fullNameResult = validateFullName(request.fullName);
  const phoneResult = validatePhone(request.phone);
  const emailResult = validateEmail(request.email);
  const passwordResult = validatePassword(request.password);

  Object.assign(errors, usernameResult.errors);
  Object.assign(errors, fullNameResult.errors);
  Object.assign(errors, phoneResult.errors);
  Object.assign(errors, emailResult.errors);
  Object.assign(errors, passwordResult.errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Handle parent registration request.
 * Returns either a success response or an API error.
 */
export async function handleRegisterParent(
  request: ParentRegistrationRequest,
  deps: RegisterParentDependencies
): Promise<RegisterParentResponse | APIError> {
  // 1. Server-side validation using shared validators (Req 1.1, 1.3)
  const validation = validateParentRegistration(request);
  if (!validation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Registration form contains invalid field values',
      details: validation.errors,
      retryable: false,
    };
  }

  // 2. Check unique username constraint (Req 1.4, 1.5)
  const usernameExists = await deps.dbClient.parentUsernameExists(request.username);
  if (usernameExists) {
    return {
      statusCode: 409,
      errorCode: 'USERNAME_TAKEN',
      message: 'Username is already in use',
      details: { username: 'This username is already registered. Please choose a different one.' },
      retryable: false,
    };
  }

  // 3. Hash password with bcrypt (cost factor ≥ 10) (Req 20.2)
  const passwordHash = await bcrypt.hash(request.password, BCRYPT_COST_FACTOR);

  // 4. Create parent record in the database
  const parentId = deps.generateId();
  await deps.dbClient.createParent({
    id: parentId,
    username: request.username,
    fullName: request.fullName,
    phone: request.phone,
    email: request.email,
    passwordHash,
  });

  // 5. Create Cognito user for session management (Req 20.2)
  await deps.cognitoClient.createUser({
    username: request.username,
    email: request.email,
    phone: request.phone,
    role: 'parent',
  });

  // 6. Return success response with auto-redirect countdown (Req 1.2)
  return {
    success: true,
    message: 'Registration is complete. You will be redirected to the login page.',
    redirectTo: '/login',
    redirectCountdownSeconds: REDIRECT_COUNTDOWN_SECONDS,
  };
}
