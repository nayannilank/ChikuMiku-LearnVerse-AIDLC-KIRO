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

/** Result of a successful silent token refresh. */
export interface RefreshedTokens {
  /** Fresh ID token — use as the bearer credential for protected routes. */
  idToken: string;
  /** Fresh access token — use for Cognito session termination (logout). */
  accessToken: string;
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
   * Attempts a silent token refresh using the Cognito refresh token. Returns
   * a fresh ID token (the bearer credential for protected routes) and access
   * token (for session termination), or null if the refresh token is
   * invalid/expired. Cognito does not rotate the refresh token by default, so
   * the original one remains valid and is not returned again.
   */
  refreshSession(refreshToken: string): Promise<RefreshedTokens | null>;

  /**
   * Terminate a user session, invalidating all associated tokens.
   */
  terminateSession(sessionId: string): Promise<void>;
}
