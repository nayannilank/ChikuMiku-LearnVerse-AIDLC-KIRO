/**
 * AppHeader — Persistent navigation header with logo and nav links.
 * Shown on all pages except LandingPage (which has its own navbar).
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

export function AppHeader() {
  const navigate = useNavigate();
  const { isAuthenticated, role, logout } = useAuth();

  return (
    <nav style={styles.navbar}>
      <div style={styles.navLogo} onClick={() => navigate('/')} role="button" tabIndex={0}>
        <img src="/logo.png" alt="ChikuMiku LearnVerse" style={{ height: 26, marginRight: 8 }} />
        <span style={styles.navLogoText}>ChikuMiku LearnVerse</span>
      </div>
      <div style={styles.navRight}>
        {isAuthenticated ? (
          <>
            <button
              style={styles.navLink}
              onClick={() => navigate(role === 'parent' ? '/parent/dashboard' : '/learner/dashboard')}
            >
              <i className="fas fa-home" style={{ marginRight: 4 }} /> Dashboard
            </button>
            <button style={styles.navBtnOutline} onClick={() => { logout(); navigate('/'); }}>
              Logout
            </button>
          </>
        ) : (
          <>
            <button style={styles.navBtnOutline} onClick={() => navigate('/login')}>Login</button>
            <button style={styles.navBtnFilled} onClick={() => navigate('/register/parent')}>Register</button>
          </>
        )}
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 24px',
    backgroundColor: theme.colors.white,
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  navLogo: { display: 'flex', alignItems: 'center', cursor: 'pointer' },
  navLogoText: { fontSize: 15, fontWeight: '800' as const, color: theme.colors.dark },
  navRight: { display: 'flex', alignItems: 'center', gap: 10 },
  navLink: {
    background: 'none',
    border: 'none',
    color: theme.colors.dark,
    fontSize: 13,
    fontWeight: '600' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  navBtnOutline: {
    padding: '7px 16px',
    border: `2px solid ${theme.colors.purple}`,
    borderRadius: 18,
    background: 'transparent',
    color: theme.colors.purple,
    fontSize: 12,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  navBtnFilled: {
    padding: '7px 16px',
    border: 'none',
    borderRadius: 18,
    background: theme.gradients.primary,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
};
