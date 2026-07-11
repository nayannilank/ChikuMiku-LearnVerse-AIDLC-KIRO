/**
 * SyncIndicator — Subtle UI indicator shown while background sync is in progress.
 *
 * Displays a small, non-intrusive spinner with status text when offline
 * progress data is being synchronized to the server after reconnection.
 *
 * Validates: Requirements 21.3
 */
import type { SyncState } from '../hooks/useSyncOnReconnect';

interface SyncIndicatorProps {
  syncState: SyncState;
}

export function SyncIndicator({ syncState }: SyncIndicatorProps) {
  const { isSyncing, lastError, pendingRetries } = syncState;

  if (!isSyncing && !lastError) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isSyncing ? 'Syncing progress data' : 'Sync error'}
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '8px',
        backgroundColor: isSyncing ? '#EEF2FF' : '#FEF2F2',
        border: `1px solid ${isSyncing ? '#C7D2FE' : '#FECACA'}`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        fontSize: '0.8rem',
        fontWeight: 500,
        color: isSyncing ? '#4338CA' : '#DC2626',
        maxWidth: '280px',
      }}
    >
      {isSyncing && (
        <>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid #C7D2FE',
              borderTopColor: '#4338CA',
              borderRadius: '50%',
              animation: 'sync-spin 0.8s linear infinite',
            }}
          />
          <span>Syncing progress...</span>
        </>
      )}
      {!isSyncing && lastError && (
        <>
          <span aria-hidden="true" style={{ fontSize: '0.9rem' }}>⚠️</span>
          <span>
            {pendingRetries > 0
              ? `Sync failed — retrying (${pendingRetries} left)`
              : 'Sync failed — will retry on reconnection'}
          </span>
        </>
      )}
      <style>{`
        @keyframes sync-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
