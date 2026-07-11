/**
 * NetworkContext — Provides global network connectivity state.
 *
 * Wraps the useNetworkStatus hook in a context so that deeply nested
 * components can access offline state without prop-drilling.
 *
 * Validates: Requirements 21.2, 21.6
 */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useNetworkStatus, type NetworkStatus } from '../hooks/useNetworkStatus';

const NetworkContext = createContext<NetworkStatus | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const status = useNetworkStatus();

  return (
    <NetworkContext.Provider value={status}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * Access network connectivity state from context.
 * Must be used within a NetworkProvider.
 */
export function useNetwork(): NetworkStatus {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
