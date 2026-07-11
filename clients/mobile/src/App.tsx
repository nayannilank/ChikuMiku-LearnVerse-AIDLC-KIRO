/**
 * App.tsx — Root component for ChikuMiku LearnVerse Android App
 *
 * Sets up:
 * - Authentication context provider
 * - Network connectivity context provider
 * - Background sync on reconnection
 * - Navigation container with React Navigation
 * - Theme configuration
 *
 * Validates: Requirements 21.3, 22.1, 22.4, 23.1, 23.2, 23.3, 23.4, 20.3, 21.6
 */
import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { OfflineBanner } from './components/OfflineBanner';
import { SyncIndicator } from './components/SyncIndicator';
import { useSyncOnReconnect } from './hooks/useSyncOnReconnect';
import {
  RootNavigator,
  DEFAULT_SCREEN_OPTIONS,
} from './navigation/RootNavigator';

/** API server base URL — injected via environment config. */
const API_BASE_URL = '__API_BASE_URL__';

/**
 * Inner component that uses the sync hook.
 * Must be inside NetworkProvider for context access.
 */
function AppContent(): React.ReactElement {
  const syncState = useSyncOnReconnect(API_BASE_URL);

  return (
    <>
      <OfflineBanner />
      <SyncIndicator syncState={syncState} />
      <RootNavigator />
    </>
  );
}

/**
 * Root application component.
 *
 * Wraps the entire app in:
 * 1. AuthProvider — manages JWT token lifecycle and user session
 * 2. NetworkProvider — monitors connectivity and exposes offline state
 * 3. AppContent — renders navigation and sync indicator
 *
 * The NavigationContainer and SafeAreaProvider are React Native native components
 * that require the full native build environment. This file is structured to
 * compile with TypeScript in the monorepo for type validation.
 */
export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <NetworkProvider>
        <AppContent />
      </NetworkProvider>
    </AuthProvider>
  );
}
