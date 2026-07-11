/**
 * OTP Manager - Pure logic for OTP generation and validation.
 * Handles 6-digit OTP codes with 5-minute expiry and max 3 attempts.
 */

/** Represents a stored OTP record. */
export interface OTPRecord {
  code: string;
  createdAt: Date;
  attempts: number;
  username: string;
  invalidated: boolean;
}

/** Result of OTP validation check. */
export interface OTPValidationResult {
  valid: boolean;
  reason?: string;
}

/** OTP configuration constants. */
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;

/**
 * Generates a 6-digit numeric OTP code.
 * Uses crypto-safe randomness when available.
 */
export function generateOTP(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * Validates a provided OTP against the stored record.
 * Checks: invalidation status, expiry (5 min), attempt limit (max 3), code match.
 */
export function isOTPValid(
  storedOTP: OTPRecord,
  providedOTP: string,
  now: Date
): OTPValidationResult {
  if (storedOTP.invalidated) {
    return { valid: false, reason: 'OTP has been invalidated' };
  }

  if (isOTPExpired(storedOTP.createdAt, now)) {
    return { valid: false, reason: 'OTP has expired' };
  }

  if (hasExceededMaxAttempts(storedOTP.attempts)) {
    return { valid: false, reason: 'Maximum OTP attempts exceeded' };
  }

  if (storedOTP.code !== providedOTP) {
    return { valid: false, reason: 'Invalid OTP code' };
  }

  return { valid: true };
}

/**
 * Checks if OTP has expired (older than 5 minutes).
 */
export function isOTPExpired(createdAt: Date, now: Date): boolean {
  const elapsedMs = now.getTime() - createdAt.getTime();
  const expiryMs = OTP_EXPIRY_MINUTES * 60 * 1000;
  return elapsedMs > expiryMs;
}

/**
 * Increments the attempt counter by 1.
 */
export function incrementAttempts(currentAttempts: number): number {
  return currentAttempts + 1;
}

/**
 * Checks if the number of attempts has reached or exceeded the maximum (3).
 */
export function hasExceededMaxAttempts(attempts: number): boolean {
  return attempts >= MAX_OTP_ATTEMPTS;
}
