/**
 * PronunciationPractice — Pronunciation practice screen for language chapters.
 *
 * Displays 5-20 words/sentences from a chapter for pronunciation practice.
 * Records audio via microphone (max 30s), scores accuracy 0-100,
 * and shows syllable-by-syllable color-coded breakdown.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Types ---

interface SyllableResult {
  text: string;
  score: number; // 0-100
}

interface PracticeItem {
  id: number;
  text: string;
  language: string;
}

type PracticeState = 'idle' | 'recording' | 'processing' | 'result';
type ErrorType = 'permission_denied' | 'no_speech' | null;

// --- Mock Data (Req 10.3: 5-20 words/sentences per session) ---

const MOCK_PRACTICE_ITEMS: PracticeItem[] = [
  { id: 1, text: 'नमस्ते', language: 'Hindi' },
  { id: 2, text: 'मेरा नाम', language: 'Hindi' },
  { id: 3, text: 'आप कैसे हैं', language: 'Hindi' },
  { id: 4, text: 'धन्यवाद', language: 'Hindi' },
  { id: 5, text: 'शुभ प्रभात', language: 'Hindi' },
  { id: 6, text: 'कृपया', language: 'Hindi' },
  { id: 7, text: 'पुस्तक', language: 'Hindi' },
  { id: 8, text: 'विद्यालय', language: 'Hindi' },
  { id: 9, text: 'अध्यापक', language: 'Hindi' },
  { id: 10, text: 'परिवार', language: 'Hindi' },
];

// Mock syllable breakdown generator
function generateMockSyllables(text: string): SyllableResult[] {
  const syllables = text.split('').filter((ch) => ch.trim() !== '');
  // Group characters into syllable-like chunks
  const chunks: string[] = [];
  for (let i = 0; i < syllables.length; i += 2) {
    chunks.push(syllables.slice(i, i + 2).join(''));
  }
  return chunks.map((chunk) => ({
    text: chunk,
    score: Math.floor(Math.random() * 60) + 40, // 40-100 range for mock
  }));
}

// --- Constants ---

const MAX_RECORDING_SECONDS = 30;

// --- Component ---

export function PronunciationPractice() {
  const { theme } = useTheme();
  const { id: chapterId } = useParams<{ id: string }>();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [practiceState, setPracticeState] = useState<PracticeState>('idle');
  const [error, setError] = useState<ErrorType>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [overallScore, setOverallScore] = useState<number>(0);
  const [syllableResults, setSyllableResults] = useState<SyllableResult[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const items = MOCK_PRACTICE_ITEMS;
  const currentItem = items[currentIndex];
  const totalItems = items.length;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Auto-stop recording at max duration (Req 10.4: max 30s)
  useEffect(() => {
    if (recordingTime >= MAX_RECORDING_SECONDS && practiceState === 'recording') {
      stopRecording();
    }
  }, [recordingTime, practiceState]);

  // Start recording with microphone permission check (Req 10.7)
  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPracticeState('recording');
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      // Req 10.7: microphone unavailable or permission denied
      setPracticeState('idle');
      setError('permission_denied');
    }
  }, []);

  // Stop recording and process (Req 10.4: score within 5 seconds)
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // If recording time is too short, simulate "no speech" error (Req 10.8)
    if (recordingTime < 1) {
      setPracticeState('idle');
      setError('no_speech');
      return;
    }

    setPracticeState('processing');

    // Simulate scoring delay (within 5 seconds per Req 10.4)
    setTimeout(() => {
      const mockSyllables = generateMockSyllables(currentItem.text);
      const avgScore = Math.round(
        mockSyllables.reduce((sum, s) => sum + s.score, 0) / mockSyllables.length
      );

      setSyllableResults(mockSyllables);
      setOverallScore(avgScore);
      setPracticeState('result');
    }, 1500);
  }, [recordingTime, currentItem]);

  // Try Again (Req 10.6: unlimited retries)
  const handleTryAgain = useCallback(() => {
    setPracticeState('idle');
    setError(null);
    setRecordingTime(0);
    setSyllableResults([]);
    setOverallScore(0);
  }, []);

  // Navigate to next item
  const handleNext = useCallback(() => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
      handleTryAgain();
    }
  }, [currentIndex, totalItems, handleTryAgain]);

  // Navigate to previous item
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      handleTryAgain();
    }
  }, [currentIndex, handleTryAgain]);

  // Get syllable color based on score (Req 10.5)
  const getSyllableColor = (score: number): string => {
    if (score >= 80) return theme.colors.success; // green
    if (score >= 40) return theme.colors.warning; // yellow
    return theme.colors.error; // red
  };

  // Format seconds as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Styles ---

  const styles = {
    container: {
      maxWidth: '720px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    title: {
      margin: 0,
      fontSize: '1.25rem',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      margin: `${theme.spacing.xs} 0 0`,
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
    },
    progressBadge: {
      background: theme.colors.background,
      color: theme.colors.secondary,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.badge,
      fontSize: '0.8125rem',
      fontWeight: theme.typography.weight.semibold,
    },
    card: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.xl,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.lg,
      textAlign: 'center' as const,
    },
    practiceText: {
      fontSize: '2rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
      lineHeight: 1.4,
    },
    languageTag: {
      display: 'inline-block',
      background: theme.colors.background,
      color: theme.colors.accent,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.badge,
      fontSize: '0.75rem',
      fontWeight: theme.typography.weight.medium,
      marginBottom: theme.spacing.lg,
    },
    recordButton: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      background: theme.colors.primary,
      color: theme.colors.white,
      fontSize: '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      minWidth: '48px',
      minHeight: '48px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      boxShadow: `0 4px 12px ${theme.colors.primary}40`,
    },
    recordButtonRecording: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      background: theme.colors.error,
      color: theme.colors.white,
      fontSize: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      minWidth: '48px',
      minHeight: '48px',
      animation: 'pulse 1.5s infinite',
      boxShadow: `0 4px 12px ${theme.colors.error}40`,
    },
    timer: {
      fontSize: '1.5rem',
      fontWeight: theme.typography.weight.semibold,
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.md,
    },
    timerMax: {
      fontSize: '0.75rem',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
    },
    hint: {
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.md,
    },
    scoreContainer: {
      marginBottom: theme.spacing.lg,
    },
    scoreCircle: {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto',
      marginBottom: theme.spacing.md,
    },
    scoreValue: {
      fontSize: '2.5rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.white,
    },
    scoreLabel: {
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.lg,
    },
    syllableContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
    },
    syllable: (color: string) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.badge,
      background: `${color}20`,
      color: color,
      fontWeight: theme.typography.weight.semibold,
      fontSize: '1.125rem',
      border: `2px solid ${color}`,
    }),
    tryAgainButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '1rem',
      background: theme.colors.primary,
      color: theme.colors.white,
      minHeight: '48px',
    },
    errorContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    errorIcon: {
      fontSize: '2.5rem',
      marginBottom: theme.spacing.md,
    },
    errorMessage: {
      color: theme.colors.error,
      fontSize: '1rem',
      fontWeight: theme.typography.weight.medium,
      marginBottom: theme.spacing.md,
      textAlign: 'center' as const,
    },
    errorButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: theme.colors.error,
      color: theme.colors.white,
      minHeight: '44px',
    },
    navigation: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    navButton: (disabled: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: disabled ? theme.colors.border : theme.colors.primary,
      color: disabled ? theme.colors.textMuted : theme.colors.white,
      opacity: disabled ? 0.6 : 1,
      minHeight: '44px',
      transition: 'background 0.2s, opacity 0.2s',
    }),
    dots: {
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      justifyContent: 'center',
    },
    dot: (active: boolean) => ({
      width: active ? '10px' : '6px',
      height: active ? '10px' : '6px',
      borderRadius: '50%',
      background: active ? theme.colors.primary : theme.colors.border,
      transition: 'all 0.2s',
    }),
    processingContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: theme.spacing.xl,
    },
    processingText: {
      fontSize: '1rem',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.md,
    },
  };

  // Get score circle background color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return theme.colors.success;
    if (score >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  // --- Render States ---

  function renderIdleState() {
    return (
      <div>
        <p style={styles.hint}>Tap the microphone to start recording your pronunciation</p>
        <button
          style={styles.recordButton}
          onClick={startRecording}
          aria-label="Start recording pronunciation"
        >
          🎤
        </button>
        <p style={styles.timerMax}>Max {MAX_RECORDING_SECONDS} seconds</p>
      </div>
    );
  }

  function renderRecordingState() {
    return (
      <div>
        <p style={styles.hint}>Recording… Tap to stop</p>
        <button
          style={styles.recordButtonRecording}
          onClick={stopRecording}
          aria-label="Stop recording"
        >
          ⏹
        </button>
        <p style={styles.timer}>{formatTime(recordingTime)}</p>
        <p style={styles.timerMax}>
          {formatTime(MAX_RECORDING_SECONDS - recordingTime)} remaining
        </p>
      </div>
    );
  }

  function renderProcessingState() {
    return (
      <div style={styles.processingContainer}>
        <div style={{ fontSize: '2rem' }} aria-hidden="true">⏳</div>
        <p style={styles.processingText}>Analyzing pronunciation…</p>
      </div>
    );
  }

  function renderResultState() {
    return (
      <div style={styles.scoreContainer}>
        {/* Overall Score (Req 10.4) */}
        <div
          style={{
            ...styles.scoreCircle,
            background: getScoreColor(overallScore),
          }}
          aria-label={`Pronunciation accuracy score: ${overallScore} out of 100`}
        >
          <span style={styles.scoreValue}>{overallScore}</span>
        </div>
        <p style={styles.scoreLabel}>Accuracy Score</p>

        {/* Syllable Breakdown (Req 10.5) */}
        <div style={styles.syllableContainer} aria-label="Syllable breakdown">
          {syllableResults.map((syllable, idx) => (
            <span
              key={idx}
              style={styles.syllable(getSyllableColor(syllable.score))}
              title={`Score: ${syllable.score}%`}
              aria-label={`${syllable.text}: ${syllable.score}% accuracy`}
            >
              {syllable.text}
            </span>
          ))}
        </div>

        {/* Try Again Button (Req 10.6) */}
        <button
          style={styles.tryAgainButton}
          onClick={handleTryAgain}
          aria-label="Try again"
        >
          🔄 Try Again
        </button>
      </div>
    );
  }

  function renderError() {
    if (!error) return null;

    const errorMessages: Record<string, { icon: string; message: string }> = {
      permission_denied: {
        icon: '🚫',
        message:
          'Microphone is unavailable or permission was denied. Please enable microphone access in your browser settings and try again.',
      },
      no_speech: {
        icon: '🔇',
        message: 'No recognizable speech was detected. Please try again and speak clearly.',
      },
    };

    const { icon, message } = errorMessages[error];

    return (
      <div style={styles.errorContainer} role="alert">
        <div style={styles.errorIcon} aria-hidden="true">{icon}</div>
        <p style={styles.errorMessage}>{message}</p>
        <button
          style={styles.errorButton}
          onClick={handleTryAgain}
          aria-label="Try again"
        >
          Try Again
        </button>
      </div>
    );
  }

  function renderPracticeContent() {
    if (error) return renderError();

    switch (practiceState) {
      case 'idle':
        return renderIdleState();
      case 'recording':
        return renderRecordingState();
      case 'processing':
        return renderProcessingState();
      case 'result':
        return renderResultState();
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Pronunciation Practice</h1>
          <p style={styles.subtitle}>Chapter {chapterId}</p>
        </div>
        <span style={styles.progressBadge}>
          {currentIndex + 1} / {totalItems}
        </span>
      </div>

      {/* Practice Card */}
      <div style={styles.card}>
        {/* Language Tag (Req 10.1, 10.2) */}
        <span style={styles.languageTag}>{currentItem.language}</span>

        {/* Practice Word/Sentence (Req 10.3) */}
        <p style={styles.practiceText}>{currentItem.text}</p>

        {/* State-dependent content */}
        {renderPracticeContent()}
      </div>

      {/* Navigation */}
      <nav style={styles.navigation} aria-label="Practice item navigation">
        <button
          style={styles.navButton(currentIndex <= 0)}
          onClick={handlePrevious}
          disabled={currentIndex <= 0}
          aria-label="Previous item"
        >
          ← Previous
        </button>

        {/* Progress dots */}
        <div style={styles.dots} aria-label={`Item ${currentIndex + 1} of ${totalItems}`}>
          {items.map((_, idx) => (
            <span
              key={idx}
              style={styles.dot(idx === currentIndex)}
              aria-hidden="true"
            />
          ))}
        </div>

        <button
          style={styles.navButton(currentIndex >= totalItems - 1)}
          onClick={handleNext}
          disabled={currentIndex >= totalItems - 1}
          aria-label="Next item"
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
