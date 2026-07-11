/**
 * useNetworkStatus — Detects online/offline connectivity state.
 *
 * Uses navigator.onLine with online/offline event listeners to provide
 * real-time connectivity status across the web app.
 *
 * Validates: Requirements 21.2, 21.6
 */
import { useSyncExternalStore, useCallback } from 'react';

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  // During SSR, assume online
  return true;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export interface NetworkStatus {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Whether the device is currently offline (inverse of isOnline) */
  isOffline: boolean;
}

/**
 * Hook that provides real-time network connectivity status.
 *
 * Listens to browser online/offline events and exposes both
 * isOnline and isOffline flags for convenience.
 */
export function useNetworkStatus(): NetworkStatus {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}

/**
 * Actions that require server communication and should be disabled offline.
 */
export type ServerAction =
  | 'addChapter'
  | 'generateExercises'
  | 'pronunciationPractice'
  | 'generateExplanation'
  | 'chapterQA';

/**
 * Hook that checks whether a specific server-dependent action is available.
 *
 * When offline, actions that require server communication are disabled.
 * Read-mode access for locally saved chapters remains available.
 */
export function useOfflineGuard(): {
  isOffline: boolean;
  isActionDisabled: (action: ServerAction) => boolean;
  getDisabledReason: (action: ServerAction) => string | null;
} {
  const { isOffline } = useNetworkStatus();

  const isActionDisabled = useCallback(
    (action: ServerAction): boolean => {
      if (!isOffline) return false;
      // All server-dependent actions are disabled when offline
      const serverActions: ServerAction[] = [
        'addChapter',
        'generateExercises',
        'pronunciationPractice',
        'generateExplanation',
        'chapterQA',
      ];
      return serverActions.includes(action);
    },
    [isOffline]
  );

  const getDisabledReason = useCallback(
    (action: ServerAction): string | null => {
      if (!isActionDisabled(action)) return null;
      return "You're offline. This action requires an internet connection.";
    },
    [isActionDisabled]
  );

  return { isOffline, isActionDisabled, getDisabledReason };
}
