/**
 * Secure cookie configuration for web session tokens.
 *
 * Tokens are stored in httpOnly secure cookies that are NOT accessible
 * to client-side JavaScript, preventing XSS token theft.
 *
 * Requirements: 20.3
 */

/** Cookie configuration for the access token. */
export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number; // seconds
  domain?: string;
}

/** Default cookie options for access token (60-minute expiry). */
export const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 60 * 60, // 60 minutes in seconds (matches JWT expiry)
};

/** Default cookie options for refresh token (30-day session persistence). */
export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth', // Only sent to auth endpoints for refresh
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};

/**
 * Serializes cookie options into a Set-Cookie header value.
 *
 * @param name - The cookie name
 * @param value - The cookie value (token)
 * @param options - Cookie security options
 * @returns Formatted Set-Cookie header string
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions
): string {
  const parts: string[] = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
  ];

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  parts.push(`SameSite=${capitalize(options.sameSite)}`);
  parts.push(`Path=${options.path}`);
  parts.push(`Max-Age=${options.maxAge}`);

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  return parts.join('; ');
}

/**
 * Creates a Set-Cookie header to clear (expire) a cookie.
 *
 * @param name - The cookie name to clear
 * @param path - The cookie path
 */
export function serializeClearCookie(name: string, path: string = '/'): string {
  return `${encodeURIComponent(name)}=; HttpOnly; Secure; SameSite=Strict; Path=${path}; Max-Age=0`;
}

/**
 * Builds Set-Cookie headers for a successful login response (web client).
 * Sets both access token and refresh token as httpOnly secure cookies.
 */
export function buildLoginCookieHeaders(
  accessToken: string,
  refreshToken: string,
  domain?: string
): string[] {
  const accessOptions: CookieOptions = {
    ...ACCESS_TOKEN_COOKIE_OPTIONS,
    ...(domain ? { domain } : {}),
  };

  const refreshOptions: CookieOptions = {
    ...REFRESH_TOKEN_COOKIE_OPTIONS,
    ...(domain ? { domain } : {}),
  };

  return [
    serializeCookie('access_token', accessToken, accessOptions),
    serializeCookie('refresh_token', refreshToken, refreshOptions),
  ];
}

/**
 * Builds Set-Cookie headers to clear tokens on logout.
 */
export function buildLogoutCookieHeaders(): string[] {
  return [
    serializeClearCookie('access_token', '/'),
    serializeClearCookie('refresh_token', '/auth'),
  ];
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
