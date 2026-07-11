/**
 * useNetworkStatus — Detects online/offline connectivity state on React Native.
 *
 * Uses @react-native-community/netinfo to provide real-time connectivity
 * status across the mobile app.
 *
 * Note: If @react-native-community/netinfo is not available, falls back to
 * a polling-based approach using fetch to detect connectivity.
 *
 * Validates: Requirements 21.2, 21.6
 */
import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export interface NetworkStatus {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Whether the device is currently offline (inverse of isOnline) */
  isOffline: boolean;
  /** Whether the connectivity state is still being determined */
  isLoading: boolean;
}

/**
 * Hook that provides real-time network connectivity status for React Native.
 *
 * Uses a combination of AppState changes and periodic connectivity checks
 * to determine network availability. This avoids requiring the NetInfo
 * native module, which may not be linked in all setups.
 *
 * For production, consider replacing with @react-native-community/netinfo
 * for more reliable detection.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkConnectivity = useCallback(async () => {
    try {
      // Attempt a lightweight fetch to verify connectivity
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(response.ok || response.status === 204);
    } catch {
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial check
    void checkConnectivity();

    // Re-check when app becomes active
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void checkConnectivity();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      void checkConnectivity();
    }, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  return {
    isOnline,
    isOffline: !isOnline,
    isLoading,
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
