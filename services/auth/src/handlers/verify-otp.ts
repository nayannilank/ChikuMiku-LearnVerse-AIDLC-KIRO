/**
 * Verify OTP Handler
 * POST /auth/verify-otp
 *
 * Validates the OTP code within the 5-minute window, max 3 attempts.
 * Invalidates OTP after 3 failed attempts or expiry.
 *
 * Validates: Requirements 4.1, 4.4, 4.5
 */
import { APIError } from '@chikumiku/types';
import {
  OTPRecord,
  isOTPValid,
  incrementAttempts,
  hasExceededMaxAttempts,
} from '../otp/otp-manager';

/** Interface for OTP storage (dependency injection). */
export interface OTPRepository {
  findLatestByUsername(username: string): Promise<OTPRecord | null>;
  updateAttempts(username: string, attempts: number): Promise<void>;
  invalidate(username: string): Promise<void>;
}

/** Request body for verify OTP. */
export interface VerifyOTPRequest {
  username: string;
  otp: string;
}

/** Response for successful OTP verification. */
export interface VerifyOTPResponse {
  verified: boolean;
  message: string;
  /** Token to authorize password reset (used in reset-password step). */
  resetToken?: string;
}

/**
 * Generates a simple reset token for authorizing the password reset step.
 */
function generateResetToken(): string {
  return `rst_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handles the OTP verification request.
 */
export async function handleVerifyOTP(
  request: VerifyOTPRequest,
  deps: {
    otpRepository: OTPRepository;
  }
): Promise<{ success: true; data: VerifyOTPResponse } | { success: false; error: APIError }> {
  const { username, otp } = request;

  // Validate input
  if (!username || username.trim().length === 0) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Username is required',
        retryable: false,
      },
    };
  }

  if (!otp || otp.trim().length === 0) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'OTP is required',
        retryable: false,
      },
    };
  }

  // Look up the latest OTP record
  const otpRecord = await deps.otpRepository.findLatestByUsername(username.trim());

  if (!otpRecord) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'OTP_NOT_FOUND',
        message: 'No OTP found. Please initiate a new password reset request.',
        retryable: false,
      },
    };
  }

  // Validate OTP
  const now = new Date();
  const validationResult = isOTPValid(otpRecord, otp.trim(), now);

  if (!validationResult.valid) {
    // Increment attempts if the reason is an invalid code
    if (validationResult.reason === 'Invalid OTP code') {
      const newAttempts = incrementAttempts(otpRecord.attempts);
      await deps.otpRepository.updateAttempts(username.trim(), newAttempts);

      // If max attempts reached after this failure, invalidate
      if (hasExceededMaxAttempts(newAttempts)) {
        await deps.otpRepository.invalidate(username.trim());
        return {
          success: false,
          error: {
            statusCode: 400,
            errorCode: 'OTP_MAX_ATTEMPTS',
            message: 'Maximum OTP attempts exceeded. Please initiate a new password reset request.',
            retryable: false,
          },
        };
      }

      return {
        success: false,
        error: {
          statusCode: 400,
          errorCode: 'OTP_INVALID',
          message: 'Invalid OTP. Please try again.',
          retryable: true,
        },
      };
    }

    // For expired or already invalidated OTPs
    const errorCode = validationResult.reason === 'OTP has expired'
      ? 'OTP_EXPIRED'
      : validationResult.reason === 'Maximum OTP attempts exceeded'
        ? 'OTP_MAX_ATTEMPTS'
        : 'OTP_INVALIDATED';

    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode,
        message: `${validationResult.reason}. Please initiate a new password reset request.`,
        retryable: false,
      },
    };
  }

  // OTP is valid - generate reset token and invalidate OTP (single use)
  await deps.otpRepository.invalidate(username.trim());
  const resetToken = generateResetToken();

  return {
    success: true,
    data: {
      verified: true,
      message: 'OTP verified successfully. You may now reset your password.',
      resetToken,
    },
  };
}
