/**
 * Logout endpoint handler.
 * POST /auth/logout
 *
 * Terminates the user session via Cognito and returns redirect to login.
 *
 * Requirements: 3.6
 */

import type { APIError } from '@chikumiku/types';
import type { CognitoClient } from '../clients/cognito-client';

/** Request payload for logout. */
export interface LogoutRequest {
  sessionId: string;
}

/** Successful logout response. */
export interface LogoutSuccessResponse {
  success: true;
  message: string;
  redirectTo: string;
}

/** Dependencies required by the logout handler. */
export interface LogoutHandlerDeps {
  cognitoClient: CognitoClient;
}

/**
 * Validates that the logout request contains a session ID.
 * Returns an APIError if validation fails, or null if valid.
 */
export function validateLogoutRequest(body: unknown): APIError | null {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { sessionId } = body as Partial<LogoutRequest>;

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Session ID is required',
      details: { sessionId: 'sessionId is required' },
      retryable: false,
    };
  }

  return null;
}

/**
 * Handles the logout request.
 * Terminates the Cognito session and returns success with redirect info.
 */
export async function handleLogout(
  body: unknown,
  deps: LogoutHandlerDeps
): Promise<LogoutSuccessResponse | APIError> {
  // Validate the request
  const validationError = validateLogoutRequest(body);
  if (validationError) {
    return validationError;
  }

  const { sessionId } = body as LogoutRequest;

  try {
    // Terminate the session in Cognito
    await deps.cognitoClient.terminateSession(sessionId);
  } catch {
    // Even if session termination fails (e.g., already expired),
    // we still want to log the user out client-side
    return {
      success: true,
      message: 'Logged out successfully',
      redirectTo: '/login',
    };
  }

  return {
    success: true,
    message: 'Logged out successfully',
    redirectTo: '/login',
  };
}
