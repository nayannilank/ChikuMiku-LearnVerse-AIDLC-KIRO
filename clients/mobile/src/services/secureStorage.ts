/**
 * Platform-secure storage for JWT tokens
 *
 * Uses react-native-encrypted-storage which leverages:
 * - Android: EncryptedSharedPreferences (AES-256 via Android Keystore)
 * - iOS: Keychain Services (future phase)
 *
 * Tokens are stored encrypted at rest and only accessible to this app.
 *
 * Validates: Requirements 20.3
 */

// Type declarations for react-native-encrypted-storage
// The actual module is a native dependency; we provide an interface here
// for TypeScript compilation in the monorepo without native binaries.

interface EncryptedStorageModule {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Lazy-loaded reference to the encrypted storage module.
 * This pattern allows TypeScript to compile without the native module present.
 */
function getStorage(): EncryptedStorageModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-encrypted-storage').default as EncryptedStorageModule;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@chikumiku/access_token',
  REFRESH_TOKEN: '@chikumiku/refresh_token',
  USER_SESSION: '@chikumiku/user_session',
} as const;

export interface UserSession {
  username: string;
  role: 'parent' | 'learner';
  grade?: string;
}

/**
 * Store the JWT access token in platform-secure storage.
 */
export async function storeAccessToken(token: string): Promise<void> {
  await getStorage().setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

/**
 * Retrieve the JWT access token from platform-secure storage.
 * Returns null if no token is stored or storage is empty.
 */
export async function getAccessToken(): Promise<string | null> {
  return getStorage().getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Store the refresh token in platform-secure storage.
 */
export async function storeRefreshToken(token: string): Promise<void> {
  await getStorage().setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
}

/**
 * Retrieve the refresh token from platform-secure storage.
 */
export async function getRefreshToken(): Promise<string | null> {
  return getStorage().getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Store the user session data (role, username, grade) in secure storage.
 */
export async function storeUserSession(session: UserSession): Promise<void> {
  await getStorage().setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
}

/**
 * Retrieve the stored user session data.
 */
export async function getUserSession(): Promise<UserSession | null> {
  const data = await getStorage().getItem(STORAGE_KEYS.USER_SESSION);
  if (!data) return null;
  return JSON.parse(data) as UserSession;
}

/**
 * Clear all stored authentication data.
 * Called on logout to remove tokens and session from secure storage.
 */
export async function clearAuthStorage(): Promise<void> {
  const storage = getStorage();
  await storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  await storage.removeItem(STORAGE_KEYS.USER_SESSION);
}
