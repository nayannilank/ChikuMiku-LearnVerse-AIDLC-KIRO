/**
 * Security configuration constants and enforcement utilities.
 *
 * Centralizes security policy enforcement across all services:
 * - TLS 1.2+ enforcement (via API Gateway — see CDK stack)
 * - Password hashing: bcrypt cost ≥ 10
 * - Session tokens: httpOnly secure cookies (web), encrypted storage (mobile)
 * - JWT: 60-minute expiry, silent refresh via Cognito
 * - No PII leakage in error messages (generic auth errors)
 * - Parental consent collection before learner data storage
 * - No third-party tracking SDKs
 * - Sensitive actions blocked until re-authentication
 * - Data deletion within 30 days of parent request
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 */

// ─────────────────────────────────────────────────────────────────────────
// Password Hashing (Req 20.2)
// ─────────────────────────────────────────────────────────────────────────

/** Minimum bcrypt cost factor. Must be ≥ 10 per security requirements. */
export const BCRYPT_MIN_COST_FACTOR = 10;

// ─────────────────────────────────────────────────────────────────────────
// JWT Configuration (Req 20.3, 20.7)
// ─────────────────────────────────────────────────────────────────────────

/** Maximum JWT access token lifetime in minutes. */
export const JWT_MAX_EXPIRY_MINUTES = 60;

/** Refresh token lifetime in days (session persistence). */
export const SESSION_PERSISTENCE_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────
// TLS Configuration (Req 20.1)
// ─────────────────────────────────────────────────────────────────────────

/** Minimum TLS version allowed. Connections using older protocols are rejected. */
export const MIN_TLS_VERSION = '1.2';

// ─────────────────────────────────────────────────────────────────────────
// Error Message Policy (Req 20.3, 20.4)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generic authentication error messages that do NOT leak PII or reveal
 * whether the issue is with the username, password, or role.
 */
export const GENERIC_AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  SESSION_EXPIRED: 'Session expired. Please log in again.',
  INVALID_TOKEN: 'Invalid authentication token',
  AUTH_REQUIRED: 'Authorization header is required',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Third-Party Tracking Policy (Req 20.6)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Denied third-party SDKs and tracking services.
 * These MUST NOT be included in any client build.
 *
 * This list is used for automated compliance checks in CI/CD.
 */
export const DENIED_TRACKING_SDKS = [
  'google-analytics',
  'firebase-analytics',
  'facebook-sdk',
  'facebook-pixel',
  'amplitude',
  'mixpanel',
  'segment',
  'hotjar',
  'fullstory',
  'appsflyer',
  'adjust',
  'branch',
  'clevertap',
  'moengage',
  'onesignal', // Use AWS SNS instead
  'sentry', // Use CloudWatch instead
  'crashlytics',
  'flurry',
  'apptentive',
  'localytics',
] as const;

/**
 * Checks if a package name is a denied third-party tracking SDK.
 * Used in CI/CD to prevent accidental inclusion of tracking libraries.
 *
 * @param packageName - npm package name to check
 * @returns true if the package is denied
 */
export function isDeniedTrackingSDK(packageName: string): boolean {
  const normalized = packageName.toLowerCase().replace(/@[^/]+\//, '');
  return DENIED_TRACKING_SDKS.some(
    (denied) => normalized.includes(denied)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Data Deletion Policy (Req 20.5)
// ─────────────────────────────────────────────────────────────────────────

/** Maximum days allowed from parent deletion request to permanent data removal. */
export const MAX_DELETION_WINDOW_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────
// Re-authentication Policy (Req 20.4)
// ─────────────────────────────────────────────────────────────────────────

/** Actions that require re-authentication before proceeding. */
export const SENSITIVE_ACTIONS = [
  'account_deletion',
  'data_export',
  'learner_removal',
] as const;

/** Time window (ms) after re-authentication during which sensitive actions are allowed. */
export const REAUTHENTICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
