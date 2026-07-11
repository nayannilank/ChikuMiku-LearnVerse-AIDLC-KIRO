/**
 * Cognito client interface for the auth service.
 * Abstracts Cognito user pool operations for testability.
 */

export interface CognitoClient {
  /**
   * Create a user in the Cognito User Pool for session management.
   * This enables JWT-based authentication and session persistence.
   */
  createUser(params: {
    username: string;
    email: string;
    phone: string;
    role: 'parent' | 'learner';
  }): Promise<{ cognitoUserId: string }>;

  /**
   * Attempt a silent token refresh using the session ID.
   * Returns a new access token and expiry, or null if refresh fails.
   */
  refreshSession(sessionId: string): Promise<{ accessToken: string; expiresIn: number } | null>;

  /**
   * Terminate a user session, invalidating all associated tokens.
   */
  terminateSession(sessionId: string): Promise<void>;
}
