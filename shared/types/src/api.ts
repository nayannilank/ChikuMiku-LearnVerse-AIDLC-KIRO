/**
 * API-level type definitions shared across services.
 */

/** Standardized API error response. */
export interface APIError {
  statusCode: number;
  errorCode: string;
  message: string;
  details?: Record<string, string>;
  retryable: boolean;
  retryAfterSeconds?: number;
}
