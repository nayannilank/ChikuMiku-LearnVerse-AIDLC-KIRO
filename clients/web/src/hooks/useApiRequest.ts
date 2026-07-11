/**
 * useApiRequest — Reusable hook for API calls with timeout indication and retry support.
 *
 * Features:
 * - Tracks loading, timeout, error, and data states
 * - After 5 seconds of loading, sets `timedOut` flag (does NOT abort the request)
 * - Caches request parameters so user can retry without data loss
 * - Exposes `retry()` to re-invoke the same request with cached params
 *
 * Validates: Requirements 19.1, 19.2, 19.6
 */
import { useState, useRef, useCallback } from 'react';

export interface UseApiRequestState<T> {
  data: T | null;
  loading: boolean;
  timedOut: boolean;
  error: string | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

const TIMEOUT_THRESHOLD_MS = 5000;

/**
 * Generic hook that wraps any async API function with timeout indication and retry.
 *
 * @param apiFn - The async function to wrap (e.g., `authApi.registerParent`)
 * @returns State object with data, loading, timedOut, error, execute, retry, reset
 */
export function useApiRequest<T>(
  apiFn: (...args: unknown[]) => Promise<T>,
): UseApiRequestState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache the last args so we can retry without data loss
  const cachedArgsRef = useRef<unknown[]>([]);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      // Cache params for retry
      cachedArgsRef.current = args;

      // Reset state
      setLoading(true);
      setTimedOut(false);
      setError(null);
      setData(null);

      // Start 5-second timeout indicator
      clearTimeoutTimer();
      timeoutIdRef.current = setTimeout(() => {
        setTimedOut(true);
      }, TIMEOUT_THRESHOLD_MS);

      try {
        const result = await apiFn(...args);
        setData(result);
        return result;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'An unexpected error occurred. Please try again.';
        setError(message);
        return null;
      } finally {
        clearTimeoutTimer();
        setLoading(false);
      }
    },
    [apiFn, clearTimeoutTimer],
  );

  const retry = useCallback(async (): Promise<T | null> => {
    return execute(...cachedArgsRef.current);
  }, [execute]);

  const reset = useCallback(() => {
    clearTimeoutTimer();
    setData(null);
    setLoading(false);
    setTimedOut(false);
    setError(null);
  }, [clearTimeoutTimer]);

  return { data, loading, timedOut, error, execute, retry, reset };
}
