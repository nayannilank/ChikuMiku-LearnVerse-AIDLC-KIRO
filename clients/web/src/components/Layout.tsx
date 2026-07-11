/**
 * Layout — responsive wrapper with watermark and high contrast toggle.
 *
 * Validates: Requirements 23.4, 23.5, 22.2
 */
import type { ReactNode } from 'react';
import { useTheme } from '../theme';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isHighContrast, toggleHighContrast } = useTheme();

  return (
    <>
      {/* Logo watermark — Requirement 23.5: 75% width, 7-10% opacity */}
      <div className="watermark" aria-hidden="true">
        <svg
          viewBox="0 0 200 60"
          fill="currentColor"
          style={{ width: '100%', height: 'auto', color: 'var(--color-primary)' }}
        >
          <text x="100" y="40" textAnchor="middle" fontSize="24" fontWeight="700">
            ChikuMiku
          </text>
        </svg>
      </div>

      {/* Main content area */}
      <div className="app-container">
        {/* Accessibility toolbar */}
        <header
          role="banner"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 'var(--space-sm) 0',
          }}
        >
          <button
            className="btn-secondary"
            onClick={toggleHighContrast}
            aria-pressed={isHighContrast}
            aria-label="Toggle high contrast mode"
            style={{ fontSize: '0.875rem', padding: '8px 16px' }}
          >
            {isHighContrast ? '◐ Standard' : '◑ High Contrast'}
          </button>
        </header>

        {/* Page content */}
        <main role="main" id="main-content">
          {children}
        </main>
      </div>
    </>
  );
}
