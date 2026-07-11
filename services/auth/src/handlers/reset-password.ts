/**
 * Reset Password Handler
 * POST /auth/reset-password
 *
 * Sets a new password after successful OTP verification.
 * Validates the new password using shared validation rules.
 *
 * Validates: Requirements 4.2, 4.3
 */
import { APIError } from '@chikumiku/types';
import { validatePassword } from '@chikumiku/validation';
import bcrypt from 'bcrypt';

/** Interface for the user repository (dependency injection). */
export interface UserRepository {
  findByUsername(username: string): Promise<{ username: string } | null>;
  updatePassword(username: string, passwordHash: string): Promise<void>;
}

/** Interface for reset token verification (dependency injection). */
export interface ResetTokenRepository {
  /** Validates the reset token is valid and not expired. */
  isValid(username: string, token: string): Promise<boolean>;
  /** Invalidates the token after use. */
  invalidate(username: string, token: string): Promise<void>;
}

/** Request body for reset password. */
export interface ResetPasswordRequest {
  username: string;
  resetToken: string;
  newPassword: string;
}

/** Response for successful password reset. */
export interface ResetPasswordResponse {
  message: string;
}

/** bcrypt cost factor per security requirements (Requirement 20.2). */
const BCRYPT_ROUNDS = 10;

/**
 * Handles the password reset request.
 * Validates the new password format, verifies the reset token,
 * then hashes and stores the new password.
 */
export async function handleResetPassword(
  request: ResetPasswordRequest,
  deps: {
    userRepository: UserRepository;
    resetTokenRepository: ResetTokenRepository;
  }
): Promise<{ success: true; data: ResetPasswordResponse } | { success: false; error: APIError }> {
  const { username, resetToken, newPassword } = request;

  // Validate required fields
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

  if (!resetToken || resetToken.trim().length === 0) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Reset token is required',
        retryable: false,
      },
    };
  }

  if (!newPassword) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'New password is required',
        retryable: false,
      },
    };
  }

  // Validate new password format using shared validation rules
  // Per Requirement 4.2: always validate password format regardless of OTP validity
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    const errorMessage = Object.values(passwordValidation.errors)[0] ||
      'Password does not meet requirements';
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: errorMessage,
        details: passwordValidation.errors,
        retryable: false,
      },
    };
  }

  // Verify reset token is valid
  const tokenValid = await deps.resetTokenRepository.isValid(username.trim(), resetToken.trim());
  if (!tokenValid) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'INVALID_RESET_TOKEN',
        message: 'Reset token is invalid or expired. Please initiate a new password reset.',
        retryable: false,
      },
    };
  }

  // Verify user exists
  const user = await deps.userRepository.findByUsername(username.trim());
  if (!user) {
    return {
      success: false,
      error: {
        statusCode: 400,
        errorCode: 'USER_NOT_FOUND',
        message: 'Unable to process request.',
        retryable: false,
      },
    };
  }

  // Hash the new password with bcrypt (Requirement 20.2)
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password in database
  await deps.userRepository.updatePassword(username.trim(), passwordHash);

  // Invalidate the reset token (single use)
  await deps.resetTokenRepository.invalidate(username.trim(), resetToken.trim());

  return {
    success: true,
    data: {
      message: 'Password has been reset successfully. Please log in with your new password.',
    },
  };
}
