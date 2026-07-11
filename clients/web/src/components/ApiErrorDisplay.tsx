/**
 * ApiErrorDisplay — Shows API errors with user-friendly messages and a retry option.
 *
 * Features:
 * - Displays error message in a styled card
 * - Includes a "Try Again" button that invokes the retry callback
 * - Preserves original request data via the parent hook (no data loss on retry)
 *
 * Validates: Requirements 19.1, 19.2
 */
import React from 'react';

export interface ApiErrorDisplayProps {
  /** The error message to display */
  error: string | null;
  /** Callback to retry the original request */
  onRetry: () => void;
  /** Whether a retry is currently in progress */
  loading?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: '16px',
    backgroundColor: '#FEF2F2',
    border: '1px solid var(--color-error)',
    textAlign: 'center',
  },
  icon: {
    fontSize: '1.5rem',
  },
  message: {
    color: 'var(--color-error)',
    fontSize: '0.875rem',
    fontWeight: 500,
    margin: 0,
  },
  retryButton: {
    borderRadius: 'var(--radius-button)',
    border: 'none',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-white)',
    padding: '8px 24px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '40px',
  },
};

export const ApiErrorDisplay: React.FC<ApiErrorDisplayProps> = ({
  error,
  onRetry,
  loading = false,
}) => {
  if (!error) {
    return null;
  }

  return (
    <div style={styles.container} role="alert" aria-live="assertive">
      <span style={styles.icon} aria-hidden="true">⚠️</span>
      <p style={styles.message}>{error}</p>
      <button
        type="button"
        style={styles.retryButton}
        onClick={onRetry}
        disabled={loading}
        aria-label="Try again"
      >
        Try Again
      </button>
    </div>
  );
};
