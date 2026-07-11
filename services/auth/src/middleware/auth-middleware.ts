/**
 * Authentication middleware for protecting API endpoints.
 * Extracts and validates JWT from Authorization header,
 * attempts silent refresh on expiry via Cognito.
 *
 * Requirements: 3.6, 20.3, 20.7
 */

import type { APIError } from '@chikumiku/types';
import type { CognitoClient } from '../clients/cognito-client';
import { validateToken, type DecodedToken } from './jwt-validator';

/** User context attached to authenticated requests. */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: 'parent' | 'learner';
}

/** Result of auth middleware processing. */
export type AuthMiddlewareResult =
  | { authenticated: true; user: AuthenticatedUser; newToken?: string }
  | { authenticated: false; error: APIError };

/** Dependencies for the auth middleware. */
export interface AuthMiddlewareDeps {
  cognitoClient: CognitoClient;
  jwtSecret: string;
  sessionId?: string; // Session ID for refresh attempts
}

/**
 * Extracts the Bearer token from the Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authorizationHeader: string | undefined | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authenticates a request by validating the JWT token from the Authorization header.
 * If the token is expired, attempts a silent refresh via Cognito.
 * If the token is invalid or refresh fails, returns a 401 APIError.
 *
 * @param authorizationHeader - The raw Authorization header value
 * @param deps - Injectable dependencies (Cognito client, JWT secret, session ID)
 * @param now - Current time (injectable for testing)
 */
export async function authenticateRequest(
  authorizationHeader: string | undefined | null,
  deps: AuthMiddlewareDeps,
  now: Date = new Date()
): Promise<AuthMiddlewareResult> {
  // Extract token from header
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    return {
      authenticated: false,
      error: {
        statusCode: 401,
        errorCode: 'AUTH_ERROR',
        message: 'Authorization header is required',
        retryable: false,
      },
    };
  }

  // Validate the token
  const validationResult = validateToken(token, deps.jwtSecret, now);

  if (validationResult.valid) {
    return {
      authenticated: true,
      user: {
        userId: validationResult.payload.userId,
        username: validationResult.payload.username,
        role: validationResult.payload.role,
      },
    };
  }

  // Token is invalid — check if it's just expired (eligible for refresh)
  if (validationResult.error === 'Token expired' && deps.sessionId) {
    // Attempt silent refresh via Cognito
    const refreshResult = await deps.cognitoClient.refreshSession(deps.sessionId);

    if (refreshResult) {
      // Re-validate the refreshed token
      const refreshedValidation = validateToken(refreshResult.accessToken, deps.jwtSecret, now);

      if (refreshedValidation.valid) {
        return {
          authenticated: true,
          user: {
            userId: refreshedValidation.payload.userId,
            username: refreshedValidation.payload.username,
            role: refreshedValidation.payload.role,
          },
          newToken: refreshResult.accessToken,
        };
      }
    }

    // Refresh failed — redirect to login
    return {
      authenticated: false,
      error: {
        statusCode: 401,
        errorCode: 'AUTH_ERROR',
        message: 'Session expired. Please log in again.',
        retryable: false,
      },
    };
  }

  // Token is invalid (malformed or bad signature)
  return {
    authenticated: false,
    error: {
      statusCode: 401,
      errorCode: 'AUTH_ERROR',
      message: 'Invalid authentication token',
      retryable: false,
    },
  };
}
