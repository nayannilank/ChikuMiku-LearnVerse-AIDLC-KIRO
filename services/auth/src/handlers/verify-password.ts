/**
 * Verify password endpoint handler for re-authentication before sensitive actions.
 * POST /auth/verify-password
 *
 * Requires an authenticated parent context. Verifies the parent's password
 * and returns a verification result valid for 5 minutes.
 *
 * Requirements: 20.4
 */

import type { APIError } from '@chikumiku/types';

/** Authenticated context from JWT middleware. */
export interface AuthContext {
  userId: string;
  username: string;
  role: 'parent' | 'learner';
}

/** Repository for looking up parent password hashes. */
export interface ParentRepository {
  findPasswordHashByUserId(userId: string): Promise<string | null>;
}

/** Interface for password comparison (dependency injection). */
export interface PasswordHasher {
  compare(plaintext: string, hash: string): Promise<boolean>;
}

/** Request body for verify-password endpoint. */
export interface VerifyPasswordRequest {
  password: string;
}

/** Successful verification response. */
export interface VerifyPasswordSuccessResponse {
  verified: true;
  expiresIn: number; // seconds until verification expires
  verifiedAt: string; // ISO timestamp of verification
}

/** Dependencies required by the verify-password handler. */
export interface VerifyPasswordDeps {
  parentRepository: ParentRepository;
  passwordHasher: PasswordHasher;
}

/**
 * Validates the verify-password request body.
 * Returns an APIError if invalid, or null if valid.
 */
export function validateVerifyPasswordRequest(body: unknown): APIError | null {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { password } = body as Partial<VerifyPasswordRequest>;

  if (!password || typeof password !== 'string' || password.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Password is required',
      details: { password: 'password is required' },
      retryable: false,
    };
  }

  return null;
}

/**
 * Handles the verify-password request.
 *
 * Flow:
 * 1. Validate request body
 * 2. Ensure authenticated context is a parent
 * 3. Look up parent's stored password hash
 * 4. Compare provided password against stored hash
 * 5. Return verification result with 5-minute expiry
 */
export async function handleVerifyPassword(
  body: unknown,
  authContext: AuthContext,
  deps: VerifyPasswordDeps,
  now: Date = new Date()
): Promise<VerifyPasswordSuccessResponse | APIError> {
  // Step 1: Validate request body
  const validationError = validateVerifyPasswordRequest(body);
  if (validationError) {
    return validationError;
  }

  // Step 2: Ensure caller is a parent
  if (authContext.role !== 'parent') {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Only parent accounts can verify password for sensitive actions',
      retryable: false,
    };
  }

  // Step 3: Look up parent's password hash
  const passwordHash = await deps.parentRepository.findPasswordHashByUserId(authContext.userId);

  if (!passwordHash) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'Parent account not found',
      retryable: false,
    };
  }

  // Step 4: Compare password
  const { password } = body as VerifyPasswordRequest;
  const isValid = await deps.passwordHasher.compare(password, passwordHash);

  if (!isValid) {
    return {
      statusCode: 401,
      errorCode: 'AUTH_FAILED',
      message: 'Password verification failed',
      retryable: false,
    };
  }

  // Step 5: Return verification result (valid for 5 minutes = 300 seconds)
  return {
    verified: true,
    expiresIn: 300,
    verifiedAt: now.toISOString(),
  };
}
