/**
 * Pure logic module for JWT token validation.
 * No external dependencies — fully testable as a pure function.
 *
 * Requirements: 20.3, 20.7
 */

import * as crypto from 'crypto';

/** Decoded token payload after successful validation. */
export interface DecodedToken {
  userId: string;
  username: string;
  role: 'parent' | 'learner';
  exp: number; // expiration timestamp (seconds since epoch)
}

/** Result of token validation — either valid with payload, or invalid with error reason. */
export type TokenValidationResult =
  | { valid: true; payload: DecodedToken }
  | { valid: false; error: string };

/**
 * Validates a JWT token structure, signature, and expiration.
 *
 * @param token - The raw JWT string (header.payload.signature)
 * @param secret - The HMAC secret used for signature verification
 * @param now - Current time for expiration comparison
 * @returns TokenValidationResult indicating success or failure with reason
 */
export function validateToken(token: string, secret: string, now: Date): TokenValidationResult {
  // Check token structure: must have exactly 3 dot-separated parts
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed token' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature using HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  if (signatureB64 !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' };
  }

  // Decode and parse the payload
  let payload: Record<string, unknown>;
  try {
    const decoded = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    payload = JSON.parse(decoded);
  } catch {
    return { valid: false, error: 'Malformed token' };
  }

  // Validate required fields
  if (
    typeof payload.userId !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { valid: false, error: 'Malformed token' };
  }

  if (payload.role !== 'parent' && payload.role !== 'learner') {
    return { valid: false, error: 'Malformed token' };
  }

  // Check expiration
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (payload.exp <= nowSeconds) {
    return { valid: false, error: 'Token expired' };
  }

  return {
    valid: true,
    payload: {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as 'parent' | 'learner',
      exp: payload.exp as number,
    },
  };
}

/**
 * Creates a JWT token (for testing/session creation purposes).
 * Uses HMAC-SHA256 signing.
 */
export function createToken(payload: DecodedToken, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}
