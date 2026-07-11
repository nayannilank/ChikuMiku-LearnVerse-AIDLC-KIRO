/**
 * Login endpoint handler with role selection.
 * POST /auth/login
 *
 * Validates credentials against database and creates a Cognito session
 * with 30-day persistence and a JWT with 60-minute expiry.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 20.3
 */

import type { LoginRequest, APIError } from '@chikumiku/types';

/** Database user record returned by lookup. */
export interface UserRecord {
  id: string;
  username: string;
  role: 'parent' | 'learner';
  passwordHash: string;
}

/** Interface for database client (dependency injection). */
export interface IUserRepository {
  findByUsernameAndRole(username: string, role: 'parent' | 'learner'): Promise<UserRecord | null>;
}

/** Session result from Cognito. */
export interface CognitoSessionResult {
  accessToken: string;
  expiresIn: number; // seconds
  sessionId: string;
}

/** Interface for Cognito client (dependency injection). */
export interface ICognitoClient {
  createSession(userId: string, role: 'parent' | 'learner', options: {
    sessionDurationDays: number;
    tokenExpiryMinutes: number;
  }): Promise<CognitoSessionResult>;
}

/** Interface for password comparison (dependency injection). */
export interface IPasswordHasher {
  compare(plaintext: string, hash: string): Promise<boolean>;
}

/** Successful login response. */
export interface LoginSuccessResponse {
  success: true;
  token: string;
  expiresIn: number;
  role: 'parent' | 'learner';
  userId: string;
}

/** Dependencies required by the login handler. */
export interface LoginHandlerDeps {
  userRepository: IUserRepository;
  cognitoClient: ICognitoClient;
  passwordHasher: IPasswordHasher;
}

/**
 * Validates that all required login fields are present and non-empty.
 * Returns an APIError if validation fails, or null if valid.
 */
export function validateLoginRequest(body: unknown): APIError | null {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { role, username, password } = body as Partial<LoginRequest>;

  const missingFields: string[] = [];

  if (!role || (role !== 'parent' && role !== 'learner')) {
    missingFields.push('role');
  }
  if (!username || typeof username !== 'string' || username.trim() === '') {
    missingFields.push('username');
  }
  if (!password || typeof password !== 'string' || password.trim() === '') {
    missingFields.push('password');
  }

  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Missing or invalid required fields',
      details: Object.fromEntries(
        missingFields.map(field => [field, `${field} is required`])
      ),
      retryable: false,
    };
  }

  return null;
}

/**
 * Handles the login request.
 * Returns either a LoginSuccessResponse or an APIError.
 *
 * Security: Uses a generic "Invalid credentials" message on any auth failure
 * to prevent information leakage about which field is wrong.
 */
export async function handleLogin(
  body: unknown,
  deps: LoginHandlerDeps
): Promise<LoginSuccessResponse | APIError> {
  // Step 1: Validate required fields
  const validationError = validateLoginRequest(body);
  if (validationError) {
    return validationError;
  }

  const { role, username, password } = body as LoginRequest;

  // Step 2: Look up user by username AND role
  const user = await deps.userRepository.findByUsernameAndRole(username, role);

  if (!user) {
    // Generic error — do not reveal whether username exists
    return {
      statusCode: 401,
      errorCode: 'AUTH_FAILED',
      message: 'Invalid credentials',
      retryable: false,
    };
  }

  // Step 3: Compare password hash with bcrypt
  const passwordValid = await deps.passwordHasher.compare(password, user.passwordHash);

  if (!passwordValid) {
    // Generic error — do not reveal that password specifically is wrong
    return {
      statusCode: 401,
      errorCode: 'AUTH_FAILED',
      message: 'Invalid credentials',
      retryable: false,
    };
  }

  // Step 4: Create Cognito session (30-day persistence, 60-min JWT expiry)
  const session = await deps.cognitoClient.createSession(user.id, role, {
    sessionDurationDays: 30,
    tokenExpiryMinutes: 60,
  });

  // Step 5: Return success with token
  return {
    success: true,
    token: session.accessToken,
    expiresIn: session.expiresIn,
    role,
    userId: user.id,
  };
}
