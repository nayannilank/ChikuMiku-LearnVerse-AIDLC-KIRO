export { validateToken, createToken } from './jwt-validator';
export type { DecodedToken, TokenValidationResult } from './jwt-validator';

export { authenticateRequest, extractBearerToken } from './auth-middleware';
export type { AuthenticatedUser, AuthMiddlewareResult, AuthMiddlewareDeps } from './auth-middleware';

export { isSensitiveActionAuthorized, VERIFICATION_WINDOW_MS } from './sensitive-action-guard';

export {
  serializeCookie,
  serializeClearCookie,
  buildLoginCookieHeaders,
  buildLogoutCookieHeaders,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} from './cookie-config';
export type { CookieOptions } from './cookie-config';

export {
  BCRYPT_MIN_COST_FACTOR,
  JWT_MAX_EXPIRY_MINUTES,
  SESSION_PERSISTENCE_DAYS,
  MIN_TLS_VERSION,
  GENERIC_AUTH_ERRORS,
  DENIED_TRACKING_SDKS,
  isDeniedTrackingSDK,
  MAX_DELETION_WINDOW_DAYS,
  SENSITIVE_ACTIONS,
  REAUTHENTICATION_WINDOW_MS,
} from './security-config';

export {
  DEFAULT_SECURITY_HEADERS,
  applySecurityHeaders,
  withSecurityHeaders,
} from './security-headers';
export type { SecurityHeaders } from './security-headers';

export {
  escapeHtml,
  stripHtmlTags,
  containsDangerousPatterns,
  sanitizeInput,
  sanitizeObject,
} from './input-sanitizer';

export {
  RateLimitStore,
  RATE_LIMIT_CONFIGS,
  buildRateLimitKey,
} from './rate-limiter';
export type { RateLimitConfig, RateLimitResult } from './rate-limiter';

export {
  DEFAULT_CORS_CONFIG,
  DEV_CORS_CONFIG,
  isOriginAllowed,
  buildCorsHeaders,
  buildPreflightResponse,
} from './cors-config';
export type { CorsConfig } from './cors-config';
