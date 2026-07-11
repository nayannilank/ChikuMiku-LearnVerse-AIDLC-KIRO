/**
 * API client configuration for ChikuMiku LearnVerse Mobile
 *
 * Provides a configured HTTP client that:
 * - Attaches JWT access tokens from secure storage to all requests
 * - Handles token refresh on 401 responses
 * - Provides typed request/response helpers
 *
 * Validates: Requirements 20.3
 */

import { getAccessToken, storeAccessToken, clearAuthStorage } from './secureStorage';
import { API_BASE_URL } from '../config/environment';

export interface ApiError {
  status: number;
  message: string;
  field?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Creates request headers with the JWT access token attached.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Handles 401 responses by attempting a token refresh.
 * On refresh failure, clears stored tokens (forces re-login).
 */
async function handleUnauthorized(): Promise<boolean> {
  // In a full implementation, this would call the refresh token endpoint.
  // For now, clear auth and signal that re-authentication is required.
  await clearAuthStorage();
  return false;
}

/**
 * Generic fetch wrapper with auth header injection and error handling.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    const refreshed = await handleUnauthorized();
    if (!refreshed) {
      const error: ApiError = {
        status: 401,
        message: 'Session expired. Please log in again.',
      };
      throw error;
    }
    // Retry with new token
    const retryHeaders = await getAuthHeaders();
    const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
    const retryData = await retryResponse.json() as T;
    return { data: retryData, status: retryResponse.status };
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
    const error: ApiError = {
      status: response.status,
      message: (errorBody['message'] as string) || 'An unexpected error occurred',
      field: errorBody['field'] as string | undefined,
    };
    throw error;
  }

  const data = await response.json() as T;
  return { data, status: response.status };
}

/**
 * API client with typed HTTP methods.
 */
export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('GET', path);
  },

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body);
  },

  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body);
  },

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path);
  },
};

/**
 * Store a new access token (used after login/refresh).
 */
export async function setAccessToken(token: string): Promise<void> {
  await storeAccessToken(token);
}
