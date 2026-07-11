/**
 * Forgot Password Handler
 * POST /auth/forgot-password
 *
 * Sends a 6-digit OTP to the registered email/phone for a given username.
 * Returns a generic message regardless of whether the username exists (security).
 *
 * Validates: Requirements 4.1, 4.6
 */
import { APIError } from '@chikumiku/types';
import { generateOTP, OTPRecord } from '../otp/otp-manager';

/** Interface for user lookup in the database. */
export interface UserRecord {
  username: string;
  email: string;
  phone: string;
}

/** Interface for the user repository (dependency injection). */
export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
}

/** Interface for OTP storage (dependency injection). */
export interface OTPRepository {
  /** Invalidates any existing OTPs for the user before storing a new one. */
  invalidateExisting(username: string): Promise<void>;
  store(record: OTPRecord): Promise<void>;
}

/** Interface for the notification service (dependency injection). */
export interface NotificationService {
  sendOTP(recipient: { email: string; phone: string }, otp: string): Promise<void>;
}

/** Request body for forgot password. */
export interface ForgotPasswordRequest {
  username: string;
}

/** Response for forgot password (always generic). */
export interface ForgotPasswordResponse {
  message: string;
}

/**
 * Handles the forgot password request.
 * Always returns a generic message to prevent username enumeration.
 */
export async function handleForgotPassword(
  request: ForgotPasswordRequest,
  deps: {
    userRepository: UserRepository;
    otpRepository: OTPRepository;
    notificationService: NotificationService;
  }
): Promise<{ success: true; data: ForgotPasswordResponse } | { success: false; error: APIError }> {
  const { username } = request;

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

  const genericMessage = 'If the username exists, an OTP has been sent';

  // Look up user - if not found, return generic message (no info leakage)
  const user = await deps.userRepository.findByUsername(username.trim());

  if (!user) {
    return {
      success: true,
      data: { message: genericMessage },
    };
  }

  // Invalidate any existing OTPs for this user
  await deps.otpRepository.invalidateExisting(username.trim());

  // Generate and store new OTP
  const otpCode = generateOTP();
  const otpRecord: OTPRecord = {
    code: otpCode,
    createdAt: new Date(),
    attempts: 0,
    username: username.trim(),
    invalidated: false,
  };

  await deps.otpRepository.store(otpRecord);

  // Send OTP via email/phone (mock in implementation)
  await deps.notificationService.sendOTP(
    { email: user.email, phone: user.phone },
    otpCode
  );

  return {
    success: true,
    data: { message: genericMessage },
  };
}
