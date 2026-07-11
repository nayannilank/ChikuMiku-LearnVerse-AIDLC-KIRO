/**
 * Secure session adapter for mobile clients.
 *
 * Bridges the platform-secure storage module with the auth middleware's
 * session token pattern. Provides a unified interface for:
 * - Storing tokens received from login responses
 * - Retrieving tokens for API requests (Authorization header)
 * - Handling token refresh (Cognito silent refresh)
 * - Clearing tokens on logout
 *
 * Web clients use httpOnly secure cookies (cookie-config.ts).
 * Mobile clients use this adapter + encrypted storage (secureStorage.ts).
 *
 * Requirements: 20.3
 */

import {
  storeAccessToken,
  storeRefreshToken,
  getAccessToken,
  getRefreshToken,
  storeUserSession,
  getUserSession,
  clearAuthStorage,
  type UserSession,
} from './secureStorage';

export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  user: UserSession;
}

export interface TokenRefreshResult {
  accessToken: string;
  expiresInMs: number;
}

export interface SecureSessionAdapter {
  /** Store tokens and session after successful login. */
  persistLoginSession(tokens: LoginTokens): Promise<void>;
  /** Get current access token for API Authorization header. */
  getAuthorizationToken(): Promise<string | null>;
  /** Get refresh token for silent refresh. */
  getSessionRefreshToken(): Promise<string | null>;
  /** Get the stored user session metadata. */
  getSession(): Promise<UserSession | null>;
  /** Update access token after a successful refresh. */
  updateAccessToken(newToken: string): Promise<void>;
  /** Clear all session data on logout. */
  clearSession(): Promise<void>;
  /** Check if a valid session exists (tokens present in storage). */
  hasActiveSession(): Promise<boolean>;
}

/**
 * Creates the secure session adapter using platform-encrypted storage.
 *
 * This adapter ensures tokens are always stored in platform-secure
 * storage (Android Keystore-backed EncryptedSharedPreferences) and
 * never exposed to insecure storage mechanisms.
 */
export function createSecureSessionAdapter(): SecureSessionAdapter {
  return {
    async persistLoginSession(tokens: LoginTokens): Promise<void> {
      // Store tokens in parallel for efficiency
      await Promise.all([
        storeAccessToken(tokens.accessToken),
        storeRefreshToken(tokens.refreshToken),
        storeUserSession(tokens.user),
      ]);
    },

    async getAuthorizationToken(): Promise<string | null> {
      return getAccessToken();
    },

    async getSessionRefreshToken(): Promise<string | null> {
      return getRefreshToken();
    },

    async getSession(): Promise<UserSession | null> {
      return getUserSession();
    },

    async updateAccessToken(newToken: string): Promise<void> {
      await storeAccessToken(newToken);
    },

    async clearSession(): Promise<void> {
      await clearAuthStorage();
    },

    async hasActiveSession(): Promise<boolean> {
      const token = await getAccessToken();
      return token !== null;
    },
  };
}

/**
 * Builds an Authorization header value from the stored access token.
 * Returns null if no token is available (user not logged in).
 */
export async function buildAuthorizationHeader(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return `Bearer ${token}`;
}
