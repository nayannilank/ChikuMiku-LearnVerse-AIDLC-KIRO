/**
 * LandingPage — First screen shown to unauthenticated users.
 * Matches the design mock: navbar, split hero with gradient + watermark,
 * 4-column feature cards, subject pills, bottom platform indicators.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';

const FEATURES = [
  { icon: 'language', label: '7 Subjects', desc: 'English, Hindi, Kannada, Maths, Science, Computers, EVS', color: theme.colors.pink, bg: theme.colors.pinkLight },
  { icon: 'microphone', label: 'Pronunciation', desc: 'Speak aloud, get instant accuracy scores & feedback', color: theme.colors.purple, bg: theme.colors.purpleLight },
  { icon: 'camera', label: 'Scan Textbooks', desc: 'Photograph pages, auto-extract text, get explanations', color: theme.colors.blue, bg: theme.colors.blueLight },
  { icon: 'trophy', label: 'Quizzes & Revision', desc: 'MCQ, fill-in-blank, timed tests with progress tracking', color: theme.colors.gold, bg: theme.colors.goldLight },
];

const SUBJECT_PILLS = [
  { name: 'English', color: theme.colors.blue },
  { name: 'Hindi', color: theme.colors.hindi },
  { name: 'Kannada', color: theme.colors.purple },
  { name: 'Maths', color: theme.colors.pink },
  { name: 'Science', color: theme.colors.green },
  { name: 'Computers', color: theme.colors.computers },
  { name: 'EVS', color: theme.colors.evs },
];

const BOTTOM_INFO = [
  { icon: 'mobile-alt', label: 'Android App', color: theme.colors.purple },
  { icon: 'globe', label: 'Web Access', color: theme.colors.blue },
  { icon: 'shield-alt', label: 'Parent Controls', color: theme.colors.green },
  { icon: 'child', label: 'LKG – 12th', color: theme.colors.gold },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.page}>
      {/* ─── Navbar ─── */}
      <nav style={styles.navbar}>
        <div style={styles.navLogo}>
          <i className="fas fa-book-open-reader" style={{ color: theme.colors.pink, fontSize: 20, marginRight: 8 }} />
          <span style={styles.navLogoText}>ChikuMiku LearnVerse</span>
        </div>
        <div style={styles.navButtons}>
          <button style={styles.navBtnOutline} onClick={() => navigate('/login')}>Login</button>
          <button style={styles.navBtnFilled} onClick={() => navigate('/register/parent')}>Register</button>
        </div>
      </nav>

      {/* ─── Hero Section (split layout) ─── */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Where Curiosity{'\n'}Comes Alive ✨</h1>
          <p style={styles.heroSubtitle}>
            A complete learning platform for LKG to 12th grade learners.<br />
            7 subjects • Pronunciation practice • Textbook scanning • Interactive quizzes
          </p>
          <div style={styles.heroButtons}>
            <button style={styles.heroBtnPrimary} onClick={() => navigate('/register/parent')}>
              <i className="fas fa-user-plus" style={{ marginRight: 8 }} />
              Get Started — Register
            </button>
            <button style={styles.heroBtnSecondary} onClick={() => navigate('/login')}>
              <i className="fas fa-sign-in-alt" style={{ marginRight: 8 }} />
              Login
            </button>
          </div>
        </div>
        <div style={styles.heroVisual}>
          <div style={styles.heroIconCircle}>
            <i className="fas fa-graduation-cap" style={{ fontSize: 48, color: theme.colors.gold }} />
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>Everything Your Child Needs to Excel</h2>
        <div style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <div key={f.label} style={styles.featureCard}>
              <div style={{ ...styles.featureIconCircle, backgroundColor: f.bg }}>
                <i className={`fas fa-${f.icon}`} style={{ color: f.color, fontSize: 22 }} />
              </div>
              <div style={styles.featureLabel}>{f.label}</div>
              <div style={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Subject Pills */}
        <div style={styles.pillsRow}>
          {SUBJECT_PILLS.map((s) => (
            <span key={s.name} style={{ ...styles.pill, color: s.color }}>{s.name}</span>
          ))}
        </div>

        {/* Bottom Info Bar */}
        <div style={styles.bottomInfo}>
          {BOTTOM_INFO.map((item) => (
            <div key={item.label} style={styles.bottomInfoItem}>
              <i className={`fas fa-${item.icon}`} style={{ fontSize: 20, color: item.color, marginBottom: 4 }} />
              <div style={styles.bottomInfoLabel}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={styles.footer}>
        <i className="fas fa-shield-alt" style={{ color: theme.colors.green, marginRight: 6 }} />
        Safe & secure for children • Parent-monitored
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: theme.fonts.family,
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  /* Navbar */
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 32px',
    backgroundColor: theme.colors.white,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  navLogo: { display: 'flex', alignItems: 'center' },
  navLogoText: { fontSize: 16, fontWeight: '800' as const, color: theme.colors.dark },
  navButtons: { display: 'flex', gap: 10 },
  navBtnOutline: {
    padding: '8px 20px',
    border: `2px solid ${theme.colors.purple}`,
    borderRadius: 20,
    background: 'transparent',
    color: theme.colors.purple,
    fontSize: 13,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },
  navBtnFilled: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 20,
    background: theme.gradients.primary,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
    cursor: 'pointer',
  },

  /* Hero */
  hero: {
    display: 'flex',
    alignItems: 'center',
    padding: '48px 48px',
    background: `linear-gradient(135deg, ${theme.colors.dark}, #4A2068)`,
    minHeight: 280,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  heroContent: { flex: 1, paddingRight: 32, zIndex: 1 },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#fff',
    margin: '0 0 12px 0',
    lineHeight: 1.2,
    whiteSpace: 'pre-line' as const,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  heroButtons: { display: 'flex', gap: 12, flexWrap: 'wrap' as const },
  heroBtnPrimary: {
    padding: '14px 28px',
    border: 'none',
    borderRadius: 22,
    background: theme.gradients.primary,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
    cursor: 'pointer',
    boxShadow: theme.shadows.button,
    display: 'flex',
    alignItems: 'center',
  },
  heroBtnSecondary: {
    padding: '14px 28px',
    border: '2px solid rgba(255,255,255,0.5)',
    borderRadius: 22,
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  heroVisual: { flex: '0 0 200px', textAlign: 'center' as const, zIndex: 1 },
  heroIconCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },

  /* Features */
  featuresSection: { padding: '32px 32px', textAlign: 'center' as const, flex: 1 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: theme.colors.dark,
    marginBottom: 24,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    maxWidth: 900,
    margin: '0 auto 24px',
  },
  featureCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    textAlign: 'center' as const,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 10px',
  },
  featureLabel: { fontSize: 14, fontWeight: '700' as const, color: '#333', marginBottom: 4 },
  featureDesc: { fontSize: 12, color: '#777', lineHeight: 1.4 },

  /* Pills */
  pillsRow: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 28,
  },
  pill: { fontSize: 13, fontWeight: '600' as const },

  /* Bottom Info */
  bottomInfo: {
    display: 'flex',
    justifyContent: 'center',
    gap: 40,
    paddingTop: 24,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  bottomInfoItem: { textAlign: 'center' as const },
  bottomInfoLabel: { fontSize: 12, fontWeight: '600' as const, color: '#333', marginTop: 4 },

  /* Footer */
  footer: {
    textAlign: 'center' as const,
    padding: '16px',
    fontSize: 12,
    color: theme.colors.textLight,
    borderTop: `1px solid ${theme.colors.border}`,
  },
};
