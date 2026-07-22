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
      {/* Navigation Bar */}
      <nav className={styles.navbar} aria-label="Main navigation">
        <div className={styles.navLogo}>
          <span className={styles.navLogoIcon} aria-hidden="true">📖</span>
          <span className={styles.navLogoText}>ChikuMiku LearnVerse</span>
        </div>
        <div className={styles.navButtons}>
          <Link to="/login" className={styles.navBtnOutline}>Login</Link>
          <Link to="/register" className={styles.navBtnFilled}>Register</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Where Curiosity<br />Comes Alive ✨
          </h1>
          <p className={styles.heroSubtitle}>
            A complete learning platform for LKG to 12th grade students.<br />
            7 subjects • Pronunciation practice • Textbook scanning • Interactive quizzes
          </p>
          <div className={styles.heroButtons}>
            <Link to="/register" className={styles.heroBtnPrimary}>
              <span aria-hidden="true">👤</span> Get Started — Register
            </Link>
            <Link to="/login" className={styles.heroBtnSecondary}>
              <span aria-hidden="true">🔑</span> Login
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroIconCircle}>🎓</div>
        </div>
      </div>

      {/* Features Section */}
      <div className={styles.featuresSection}>
        <h2 className={styles.featuresTitle}>Everything Your Child Needs to Excel</h2>

        <div className={styles.featuresGrid} role="list" aria-label="Feature highlights">
          <div className={styles.featureCard} role="listitem">
            <div className={`${styles.featureIconCircle} ${styles.featureIconPink}`} aria-hidden="true">
              📚
            </div>
            <div className={styles.featureCardTitle}>7 Subjects</div>
            <div className={styles.featureCardDesc}>English, Hindi, Kannada, Maths, Science, Computers, EVS</div>
          </div>

          <div className={styles.featureCard} role="listitem">
            <div className={`${styles.featureIconCircle} ${styles.featureIconPurple}`} aria-hidden="true">
              🎙️
            </div>
            <div className={styles.featureCardTitle}>Pronunciation</div>
            <div className={styles.featureCardDesc}>Speak aloud, get instant accuracy scores &amp; feedback</div>
          </div>

          <div className={styles.featureCard} role="listitem">
            <div className={`${styles.featureIconCircle} ${styles.featureIconBlue}`} aria-hidden="true">
              📷
            </div>
            <div className={styles.featureCardTitle}>Scan Textbooks</div>
            <div className={styles.featureCardDesc}>Photograph pages, auto-extract text, get explanations</div>
          </div>

          <div className={styles.featureCard} role="listitem">
            <div className={`${styles.featureIconCircle} ${styles.featureIconGold}`} aria-hidden="true">
              🏆
            </div>
            <div className={styles.featureCardTitle}>Quizzes &amp; Revision</div>
            <div className={styles.featureCardDesc}>MCQ, fill-in-blank, timed tests with progress tracking</div>
          </div>
        </div>

        {/* Subject Pills */}
        <div className={styles.subjectPills} aria-label="Available subjects">
          <span className={`${styles.pill} ${styles.pillPink}`}>English</span>
          <span className={`${styles.pill} ${styles.pillPurple}`}>Hindi</span>
          <span className={`${styles.pill} ${styles.pillBlue}`}>Kannada</span>
          <span className={`${styles.pill} ${styles.pillGold}`}>Maths</span>
          <span className={`${styles.pill} ${styles.pillGreen}`}>Science</span>
          <span className={`${styles.pill} ${styles.pillIndigo}`}>Computers</span>
          <span className={`${styles.pill} ${styles.pillOrange}`}>EVS</span>
        </div>

        {/* Bottom Info */}
        <div className={styles.bottomInfo}>
          <div className={styles.bottomInfoItem}>
            <div className={styles.bottomInfoIcon} aria-hidden="true" style={{ color: '#9B59B6' }}>📱</div>
            <div className={styles.bottomInfoLabel}>Android App</div>
          </div>
          <div className={styles.bottomInfoItem}>
            <div className={styles.bottomInfoIcon} aria-hidden="true" style={{ color: '#5DADE2' }}>🌐</div>
            <div className={styles.bottomInfoLabel}>Web Access</div>
          </div>
          <div className={styles.bottomInfoItem}>
            <div className={styles.bottomInfoIcon} aria-hidden="true" style={{ color: '#27AE60' }}>🛡️</div>
            <div className={styles.bottomInfoLabel}>Parent Controls</div>
          </div>
          <div className={styles.bottomInfoItem}>
            <div className={styles.bottomInfoIcon} aria-hidden="true" style={{ color: '#F7C948' }}>👧</div>
            <div className={styles.bottomInfoLabel}>LKG – 12th</div>
          </div>
        </div>
      </div>
    </section>
  );
}
