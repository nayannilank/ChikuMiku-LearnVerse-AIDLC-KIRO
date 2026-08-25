/**
 * Cognito client interface for the auth service.
 * Abstracts Cognito user pool operations for testability.
 */

/** Cognito-issued tokens returned by a successful authentication. */
export interface AuthTokens {
  /** ID token — carries identity + custom claims; used by the API authorizer. */
  idToken: string;
  /** Access token — used for Cognito self-service ops (e.g. GlobalSignOut). */
  accessToken: string;
  /** Refresh token — used for silent session refresh. */
  refreshToken?: string;
  /** Access/ID token lifetime in seconds. */
  expiresIn: number;
}

export interface CognitoClient {
  /**
   * Create a user in the Cognito User Pool for session management.
   * This enables JWT-based authentication and session persistence.
   */
  createUser(params: {
    username: string;
    /** Optional — learners are username-only and have no email. */
    email?: string;
    /** Optional — learners are username-only and have no phone. */
    phone?: string;
    password: string;
    role: 'parent' | 'learner';
    /**
     * The database primary key for this user (parent.id or learner.id).
     * Stored as the `custom:appUserId` claim so the JWT authorizer surfaces a
     * stable link between the Cognito identity and the application record —
     * the Cognito-generated `sub` is NOT the same value as the DB id.
     */
    appUserId: string;
  }): Promise<{ cognitoUserId: string }>;

  /**
   * Authenticates a user with username + password and returns Cognito-issued
   * tokens. The ID token carries the pool's custom claims (custom:role,
   * custom:appUserId) and is what protected routes validate against the
   * Cognito authorizer. Returns null when credentials are invalid.
   */
  authenticate(
    username: string,
    password: string
  ): Promise<AuthTokens | null>;

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
