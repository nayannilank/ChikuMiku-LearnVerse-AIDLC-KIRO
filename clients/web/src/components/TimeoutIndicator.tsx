/**
 * TimeoutIndicator — Displays a message when an API request exceeds 5 seconds.
 *
 * Shows:
 * - "This is taking longer than expected..." message
 * - A "Retry" button (pill-shaped, secondary style)
 * - A "Keep Waiting" option to dismiss the indicator
 *
 * Validates: Requirements 19.1, 19.2
 */
import React, { useState } from 'react';

export interface TimeoutIndicatorProps {
  /** Whether the request has timed out (exceeded 5s) */
  visible: boolean;
  /** Callback to retry the request */
  onRetry: () => void;
  /** Whether the request is still in-flight (controls Retry button state) */
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
    backgroundColor: 'var(--color-white)',
    border: '1px solid var(--color-border)',
    textAlign: 'center',
    animation: 'fadeIn 0.2s ease-out',
  },
  message: {
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    margin: 0,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  retryButton: {
    borderRadius: 'var(--radius-button)',
    border: '2px solid var(--color-secondary)',
    backgroundColor: 'transparent',
    color: 'var(--color-secondary)',
    padding: '8px 24px',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '40px',
  },
  keepWaitingButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '8px',
    minHeight: '40px',
    minWidth: 'auto',
  },
};

export const TimeoutIndicator: React.FC<TimeoutIndicatorProps> = ({
  visible,
  onRetry,
  loading = false,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) {
    return null;
  }

  return (
    <div style={styles.container} role="status" aria-live="polite">
      <p style={styles.message}>This is taking longer than expected...</p>
      <div style={styles.actions}>
        <button
          type="button"
          style={styles.retryButton}
          onClick={onRetry}
          disabled={loading}
          aria-label="Retry request"
        >
          Retry
        </button>
        <button
          type="button"
          style={styles.keepWaitingButton}
          onClick={() => setDismissed(true)}
          aria-label="Keep waiting for the request to complete"
        >
          Keep Waiting
        </button>
      </div>
    </div>
  );
};
