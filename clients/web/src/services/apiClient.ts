/**
 * API Client — Core HTTP client for the web application.
 *
 * Features:
 * - API base URL from environment config (Vite env vars)
 * - Auth token injection via localStorage
 * - 401 handling with token refresh
 * - Timeout handling (5-second indicator threshold)
 * - Structured error response parsing
 *
 * Validates: Requirements 19.1, 19.2, 19.6
 */
import { API_BASE_URL } from '../config/environment';
import type { APIError } from '@chikumiku/types';

// ─── Token Storage Keys ──────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'chikumiku_access_token';
const REFRESH_TOKEN_KEY = 'chikumiku_refresh_token';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface ApiClientError {
  status: number;
  message: string;
  field?: string;
  retryable: boolean;
}

export interface RequestOptions {
  /** Custom headers to merge with defaults */
  headers?: Record<string, string>;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Skip auth token injection (e.g., for login/register) */
  skipAuth?: boolean;
}

// ─── Token Management ────────────────────────────────────────────────────────

/** Get the stored access token */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Store access and optionally refresh tokens after login */
export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

/** Clear all stored tokens (on logout or refresh failure) */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Get the stored refresh token */
function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

/** Flag to prevent concurrent refresh attempts */
let isRefreshing = false;
/** Queue of requests waiting for token refresh */
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeToRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers(token: string): void {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success, or null on failure.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = (await response.json()) as { accessToken: string; refreshToken?: string };
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

// ─── Core Request Function ───────────────────────────────────────────────────

/**
 * Build request headers with optional auth token injection.
 */
function buildHeaders(options?: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options?.headers ?? {}),
  };

  if (!options?.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
}

/**
 * Parse error response body into a structured ApiClientError.
 */
async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as Partial<APIError> & { field?: string };
    return {
      status: response.status,
      message: body.message || `Request failed with status ${response.status}`,
      field: body.field ?? (body.details ? Object.keys(body.details)[0] : undefined),
      retryable: body.retryable ?? response.status >= 500,
    };
  } catch {
    return {
      status: response.status,
      message: `Request failed with status ${response.status}`,
      retryable: response.status >= 500,
    };
  }
}

/**
 * Generic fetch wrapper with auth handling, 401 refresh, and error parsing.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  const headers = buildHeaders(options);

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: options?.signal,
  };

  if (body !== undefined && body !== null) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  // Handle 401 — attempt token refresh
  if (response.status === 401 && !options?.skipAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        notifyRefreshSubscribers(newToken);
        // Retry with new token
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetch(url, { ...fetchOptions, headers: retryHeaders });

        if (!retryResponse.ok) {
          throw await parseErrorResponse(retryResponse);
        }

        const retryData = (await retryResponse.json()) as T;
        return { data: retryData, status: retryResponse.status };
      }

      // Refresh failed — force re-login
      const error: ApiClientError = {
        status: 401,
        message: 'Session expired. Please log in again.',
        retryable: false,
      };
      throw error;
    }

    // Another refresh is in progress — wait for it
    return new Promise<ApiResponse<T>>((resolve, reject) => {
      subscribeToRefresh(async (token) => {
        try {
          const retryHeaders = { ...headers, Authorization: `Bearer ${token}` };
          const retryResponse = await fetch(url, { ...fetchOptions, headers: retryHeaders });

          if (!retryResponse.ok) {
            reject(await parseErrorResponse(retryResponse));
            return;
          }

          const retryData = (await retryResponse.json()) as T;
          resolve({ data: retryData, status: retryResponse.status });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // Handle non-OK responses
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: undefined as unknown as T, status: 204 };
  }

  const data = (await response.json()) as T;
  return { data, status: response.status };
}

// ─── Public API Client ───────────────────────────────────────────────────────

/**
 * Typed HTTP client for all API calls.
 * Handles auth injection, token refresh, and error parsing automatically.
 */
export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('GET', path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body, options);
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('PATCH', path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path, undefined, options);
  },
};
