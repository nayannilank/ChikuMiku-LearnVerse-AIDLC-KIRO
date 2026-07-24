/**
 * LandingPage — First screen shown to unauthenticated users.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';

const FEATURES = [
  { icon: 'language', label: '7 Subjects', desc: 'English, Hindi, Kannada & more', color: theme.colors.pink, bg: theme.colors.pinkLight },
  { icon: 'microphone', label: 'Pronunciation', desc: 'Speak & get instant feedback', color: theme.colors.purple, bg: theme.colors.purpleLight },
  { icon: 'camera', label: 'Scan & Learn', desc: 'Photo your textbook pages', color: theme.colors.blue, bg: theme.colors.blueLight },
  { icon: 'trophy', label: 'Revision & Quiz', desc: 'Test your knowledge', color: theme.colors.gold, bg: theme.colors.goldLight },
];

const SUBJECT_PILLS = [
  { name: 'English', color: theme.colors.blue, bg: theme.colors.blueLight },
  { name: 'Hindi', color: theme.colors.hindi, bg: theme.colors.goldLight },
  { name: 'Kannada', color: theme.colors.purple, bg: theme.colors.purpleLight },
  { name: 'Maths', color: theme.colors.pink, bg: theme.colors.pinkLight },
  { name: 'Science', color: theme.colors.green, bg: theme.colors.greenLight },
  { name: 'Computers', color: theme.colors.computers, bg: theme.colors.computersLight },
  { name: 'EVS', color: theme.colors.evs, bg: theme.colors.evsLight },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <div style={styles.logoCircle}>
          <i className="fas fa-book-open-reader" style={styles.logoIcon} />
        </div>
        <h1 style={styles.appName}>ChikuMiku LearnVerse</h1>
        <p style={styles.tagline}>Where Curiosity Comes Alive ✨</p>
        <p style={styles.heroDesc}>
          A complete learning platform for LKG to 12th grade learners.
          7 subjects • Pronunciation practice • Textbook scanning • Interactive quizzes
        </p>
      </div>

      <div style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>Everything Your Child Needs to Excel</h2>
        <div style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <div key={f.label} style={styles.featureCard}>
              <div style={{ ...styles.featureIconCircle, backgroundColor: f.bg }}>
                <i className={`fas fa-${f.icon}`} style={{ color: f.color, fontSize: 20 }} />
              </div>
              <div style={styles.featureLabel}>{f.label}</div>
              <div style={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.pillsRow}>
        {SUBJECT_PILLS.map((s) => (
          <span key={s.name} style={{ ...styles.pill, backgroundColor: s.bg, color: s.color }}>
            {s.name}
          </span>
        ))}
      </div>

      <div style={styles.gradeBadgeWrap}>
        <span style={styles.gradeBadge}>LKG to 12th Grade</span>
      </div>

      <div style={styles.ctaSection}>
        <button style={styles.primaryBtn} onClick={() => navigate('/register/parent')}>
          <i className="fas fa-user-plus" style={{ marginRight: 8 }} />
          Register Now
        </button>
        <button style={styles.secondaryBtn} onClick={() => navigate('/login')}>
          <i className="fas fa-sign-in-alt" style={{ marginRight: 8 }} />
          Login
        </button>
      </div>

      <div style={styles.safetyFooter}>
        <i className="fas fa-shield-alt" style={{ color: theme.colors.green, marginRight: 6 }} />
        Safe & secure for children • Parent-monitored
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 0 },
  hero: { background: `linear-gradient(180deg, ${theme.colors.dark} 0%, #4A2068 60%, ${theme.colors.bg} 100%)`, padding: '48px 24px 32px', textAlign: 'center' },
  logoCircle: { width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  logoIcon: { color: theme.colors.gold, fontSize: 34 },
  appName: { color: '#fff', fontSize: theme.fonts.sizes.hero, fontWeight: theme.fonts.weights.extrabold, margin: 0 },
  tagline: { color: theme.colors.gold, fontSize: theme.fonts.sizes.md, fontStyle: 'italic', margin: '4px 0 12px' },
  heroDesc: { color: 'rgba(255,255,255,0.8)', fontSize: theme.fonts.sizes.sm, lineHeight: 1.6, maxWidth: 440, margin: '0 auto' },
  featuresSection: { padding: '24px 16px', textAlign: 'center' },
  sectionTitle: { fontSize: theme.fonts.sizes.lg, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 16 },
  featuresGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, maxWidth: 600, margin: '0 auto' },
  featureCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 16, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  featureIconCircle: { width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' },
  featureLabel: { fontSize: theme.fonts.sizes.sm, fontWeight: theme.fonts.weights.bold, color: theme.colors.text },
  featureDesc: { fontSize: theme.fonts.sizes.xs, color: theme.colors.textLight, marginTop: 4 },
  pillsRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: '0 16px', marginTop: 16 },
  pill: { fontSize: 11, fontWeight: theme.fonts.weights.semibold, padding: '5px 12px', borderRadius: 12 },
  gradeBadgeWrap: { textAlign: 'center', margin: '16px 0' },
  gradeBadge: { background: theme.colors.blueLight, color: theme.colors.blue, fontSize: 12, fontWeight: theme.fonts.weights.semibold, padding: '6px 14px', borderRadius: 12 },
  ctaSection: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 24px', maxWidth: 360, margin: '0 auto' },
  primaryBtn: { width: '100%', padding: '14px', border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: theme.fonts.sizes.md, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', boxShadow: theme.shadows.button },
  secondaryBtn: { width: '100%', padding: '14px', border: `2px solid ${theme.colors.purple}`, borderRadius: theme.borderRadius.button, background: '#fff', color: theme.colors.purple, fontSize: theme.fonts.sizes.md, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' },
  safetyFooter: { textAlign: 'center', padding: '24px 16px', fontSize: 11, color: theme.colors.textLight },
};
