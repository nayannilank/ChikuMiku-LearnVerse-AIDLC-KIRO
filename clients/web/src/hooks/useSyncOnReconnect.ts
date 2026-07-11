/**
 * useSyncOnReconnect — Triggers background sync when connectivity transitions
 * from offline to online.
 *
 * Detects reconnection, automatically calls syncProgress within 30 seconds,
 * exposes isSyncing state for UI indicators, and queues failed syncs for retry.
 *
 * Validates: Requirements 21.3
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { webOfflineStore } from '../services/offlineStorage';

/** Maximum delay before sync must start after reconnection (ms). */
const SYNC_DELAY_MS = 5000;

/** Retry delay for failed sync attempts (ms). */
const RETRY_DELAY_MS = 15000;

/** Maximum retry attempts before giving up until next reconnection. */
const MAX_RETRIES = 3;

export interface SyncState {
  /** Whether a sync operation is currently in progress. */
  isSyncing: boolean;
  /** The last sync error message, if any. */
  lastError: string | null;
  /** Number of queued retry attempts remaining. */
  pendingRetries: number;
  /** Timestamp of the last successful sync. */
  lastSyncedAt: string | null;
}

/**
 * Hook that monitors network connectivity and triggers progress sync
 * when the device transitions from offline to online.
 *
 * @param serverUrl - The base URL of the API server
 * @returns SyncState with current sync status
 */
export function useSyncOnReconnect(serverUrl: string): SyncState {
  const { isOnline } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pendingRetries, setPendingRetries] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Track previous online state to detect transitions
  const wasOnlineRef = useRef(isOnline);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const performSync = useCallback(async () => {
    setIsSyncing(true);
    setLastError(null);

    try {
      const result = await webOfflineStore.syncProgress(serverUrl);

      if (result.success) {
        setLastSyncedAt(result.timestamp);
        setPendingRetries(0);
        retryCountRef.current = 0;
      } else {
        // Some chapters failed — queue for retry
        const errorMsg = `Sync partially failed: ${result.failedChapterIds.length} chapter(s) could not be synced`;
        setLastError(errorMsg);
        queueRetry();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      setLastError(errorMsg);
      queueRetry();
    } finally {
      setIsSyncing(false);
    }
  }, [serverUrl]);

  const queueRetry = useCallback(() => {
    retryCountRef.current += 1;
    if (retryCountRef.current <= MAX_RETRIES) {
      setPendingRetries(MAX_RETRIES - retryCountRef.current);
      retryTimerRef.current = setTimeout(() => {
        void performSync();
      }, RETRY_DELAY_MS);
    } else {
      // Max retries exceeded — will retry on next reconnection
      setPendingRetries(0);
      retryCountRef.current = 0;
    }
  }, [performSync]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    // Detect offline → online transition
    if (!wasOnline && isOnline) {
      // Clear any existing timers
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      // Reset retry count for new reconnection
      retryCountRef.current = 0;

      // Trigger sync within the 30-second window (use a short delay to
      // allow network to stabilize)
      syncTimerRef.current = setTimeout(() => {
        void performSync();
      }, SYNC_DELAY_MS);
    }
  }, [isOnline, performSync]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  return { isSyncing, lastError, pendingRetries, lastSyncedAt };
}
