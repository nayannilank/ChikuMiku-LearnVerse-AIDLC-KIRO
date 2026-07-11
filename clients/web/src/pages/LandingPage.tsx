/**
 * LandingPage — public-facing landing page for ChikuMiku LearnVerse.
 *
 * Displays product overview, feature highlights, CTAs, and trust indicators.
 * Accessible to both authenticated and unauthenticated users (no forced redirect).
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */
import { Link } from 'react-router-dom';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <section className={styles.landing} aria-label="ChikuMiku LearnVerse landing page">
      {/* Hero: Logo, Name, Tagline, Grade Range */}
      <div className={styles.hero}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon} aria-hidden="true">
            CM
          </div>
          <h1 className={styles.appName}>ChikuMiku LearnVerse</h1>
          <p className={styles.tagline}>Where Curiosity Comes Alive</p>
        </div>
        <span className={styles.gradeRange}>LKG to 12th Grade</span>
      </div>

      {/* Feature Highlights */}
      <div className={styles.features} role="list" aria-label="Feature highlights">
        <div className={`card ${styles.featureCard}`} role="listitem">
          <div className={styles.featureIcon} data-feature="subjects" aria-hidden="true">
            📚
          </div>
          <span className={styles.featureLabel}>7 Subjects</span>
        </div>

        <div className={`card ${styles.featureCard}`} role="listitem">
          <div className={styles.featureIcon} data-feature="pronunciation" aria-hidden="true">
            🎙️
          </div>
          <span className={styles.featureLabel}>Pronunciation</span>
        </div>

        <div className={`card ${styles.featureCard}`} role="listitem">
          <div className={styles.featureIcon} data-feature="scan" aria-hidden="true">
            📷
          </div>
          <span className={styles.featureLabel}>Scan &amp; Learn</span>
        </div>

        <div className={`card ${styles.featureCard}`} role="listitem">
          <div className={styles.featureIcon} data-feature="quizzes" aria-hidden="true">
            ✏️
          </div>
          <span className={styles.featureLabel}>Quizzes</span>
        </div>
      </div>

      {/* Call-to-Action Buttons */}
      <nav className={styles.ctaGroup} aria-label="Get started">
        <Link to="/register" className={`btn btn-primary ${styles.ctaPrimary}`}>
          Register Now
        </Link>
        <Link to="/login" className={`btn btn-secondary ${styles.ctaSecondary}`}>
          Login
        </Link>
      </nav>

      {/* Platform Indicators */}
      <div className={styles.platforms} aria-label="Available platforms">
        <div className={styles.platformItem}>
          <span className={styles.platformIcon} aria-hidden="true">📱</span>
          <span>Android App</span>
        </div>
        <div className={styles.platformItem}>
          <span className={styles.platformIcon} aria-hidden="true">🌐</span>
          <span>Web Access</span>
        </div>
      </div>

      {/* Safety Badge */}
      <div className={styles.safetyBadge} role="status">
        <span className={styles.safetyIcon} aria-hidden="true">🛡️</span>
        <span>Safe &amp; secure for children • Parent-monitored</span>
      </div>
    </section>
  );
}
