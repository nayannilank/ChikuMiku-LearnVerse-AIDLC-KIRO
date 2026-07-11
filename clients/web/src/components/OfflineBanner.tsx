/**
 * OfflineBanner — Visible indicator displayed when the device has no internet.
 *
 * Renders a persistent banner at the top of the viewport informing the user
 * that they are offline and certain actions are unavailable.
 *
 * Validates: Requirements 21.6
 */
import { useNetwork } from '../context/NetworkContext';

export function OfflineBanner() {
  const { isOffline } = useNetwork();

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="offline-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: '#F7C948',
        color: '#2C2341',
        fontWeight: 600,
        fontSize: '0.875rem',
        textAlign: 'center',
        borderBottom: '1px solid #E5A100',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>⚡</span>
      <span>
        You&apos;re offline — saved chapters are available in read mode.
        Some actions are disabled.
      </span>
    </div>
  );
}
