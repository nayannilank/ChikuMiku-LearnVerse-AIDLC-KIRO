/**
 * Auth API — Typed service layer for authentication endpoints.
 *
 * Connects login, registration, forgot-password, and OTP flows
 * to the backend Auth Lambda via the API client.
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 3.1, 4.1, 4.2, 4.3, 4.5, 19.1, 19.2
 */
import { apiClient, setTokens, clearTokens } from './apiClient';
import type {
  ParentRegistrationRequest,
  LearnerRegistrationRequest,
  LoginRequest,
} from '@chikumiku/types';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: 'parent' | 'learner';
  username: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  resetToken?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// ─── Auth API Service ────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Authenticate a parent or learner and store tokens.
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
      '/auth/login',
      request,
      { skipAuth: true },
    );
    // Store tokens for subsequent authenticated requests
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  /**
   * Register a new parent account.
   */
  async registerParent(request: ParentRegistrationRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>(
      '/auth/register/parent',
      request,
      { skipAuth: true },
    );
    return data;
  },

  /**
   * Register a learner profile under the authenticated parent.
   */
  async registerLearner(request: LearnerRegistrationRequest): Promise<RegisterResponse> {
    const { data } = await apiClient.post<RegisterResponse>(
      '/auth/register/learner',
      request,
    );
    return data;
  },

  /**
   * Request a password reset OTP for the given username.
   * Returns a generic response regardless of whether the username exists
   * to prevent information leakage (Req 4.2).
   */
  async forgotPassword(username: string): Promise<ForgotPasswordResponse> {
    const { data } = await apiClient.post<ForgotPasswordResponse>(
      '/auth/forgot-password',
      { username },
      { skipAuth: true },
    );
    return data;
  },

  /**
   * Verify the OTP code for password reset (Req 4.3).
   */
  async verifyOtp(username: string, otp: string): Promise<VerifyOtpResponse> {
    const { data } = await apiClient.post<VerifyOtpResponse>(
      '/auth/verify-otp',
      { username, otp },
      { skipAuth: true },
    );
    return data;
  },

  /**
   * Reset password with a new password after OTP verification (Req 4.5).
   */
  async resetPassword(
    username: string,
    newPassword: string,
    resetToken: string,
  ): Promise<ResetPasswordResponse> {
    const { data } = await apiClient.post<ResetPasswordResponse>(
      '/auth/reset-password',
      { username, newPassword, resetToken },
      { skipAuth: true },
    );
    return data;
  },

  /**
   * Log out and clear stored tokens.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearTokens();
    }
  },
};
