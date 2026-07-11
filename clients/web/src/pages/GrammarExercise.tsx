/**
 * GrammarExercise — Grammar exercise screen for a chapter.
 *
 * Displays 5-10 exercises from chapter content with types:
 * sentence building, fill-in-the-blank, word reordering, error correction.
 * Submit answer → feedback within 3 seconds (correct/incorrect + explanation + grammar rule).
 * No proactive explanations before submission.
 * Tracks: exercises completed, correct answers, score percentage (floor-based).
 * Handles insufficient content (limited exercises message for 2-4 count).
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Types (Req 11.4) ---

type ExerciseType = 'sentence-building' | 'fill-in-blank' | 'word-reordering' | 'error-correction';

interface BaseExercise {
  id: string;
  type: ExerciseType;
  question: string;
  correctAnswer: string;
  explanation: string;
  grammarRule: string;
}

interface SentenceBuildingExercise extends BaseExercise {
  type: 'sentence-building';
  words: string[];
}

interface FillInBlankExercise extends BaseExercise {
  type: 'fill-in-blank';
  options: string[];
}

interface WordReorderingExercise extends BaseExercise {
  type: 'word-reordering';
  words: string[];
}

interface ErrorCorrectionExercise extends BaseExercise {
  type: 'error-correction';
  sentence: string;
}

type Exercise = SentenceBuildingExercise | FillInBlankExercise | WordReorderingExercise | ErrorCorrectionExercise;

interface FeedbackState {
  isCorrect: boolean;
  explanation: string;
  grammarRule: string;
}

// --- Mock Data (Req 11.3, 11.4) ---

const MOCK_EXERCISES: Exercise[] = [
  {
    id: 'ex-1',
    type: 'sentence-building',
    question: 'Arrange the words to form a correct sentence:',
    words: ['the', 'cat', 'sat', 'on', 'the', 'mat'],
    correctAnswer: 'the cat sat on the mat',
    explanation: 'The subject "the cat" comes first, followed by the verb "sat" and the prepositional phrase "on the mat".',
    grammarRule: 'Subject-Verb-Object (SVO) sentence structure',
  },
  {
    id: 'ex-2',
    type: 'fill-in-blank',
    question: 'She ___ to the market every morning.',
    options: ['go', 'goes', 'going', 'gone'],
    correctAnswer: 'goes',
    explanation: '"Goes" is correct because the subject "She" is third person singular, requiring the verb to take the "-es" form in simple present tense.',
    grammarRule: 'Subject-verb agreement: third person singular takes -s/-es in present tense',
  },
  {
    id: 'ex-3',
    type: 'word-reordering',
    question: 'Reorder the words to make a meaningful sentence:',
    words: ['playing', 'children', 'are', 'the', 'park', 'in', 'the'],
    correctAnswer: 'the children are playing in the park',
    explanation: 'The sentence follows present continuous tense structure: Subject + auxiliary verb (are) + main verb (-ing form) + location.',
    grammarRule: 'Present continuous tense: Subject + am/is/are + verb(-ing)',
  },
  {
    id: 'ex-4',
    type: 'error-correction',
    question: 'Find and correct the error in this sentence:',
    sentence: 'He have been waiting for two hours.',
    correctAnswer: 'He has been waiting for two hours.',
    explanation: '"Have" should be "has" because the subject "He" is third person singular. In present perfect continuous, we use "has been" with he/she/it.',
    grammarRule: 'Present perfect continuous: He/She/It + has been + verb(-ing)',
  },
  {
    id: 'ex-5',
    type: 'fill-in-blank',
    question: 'If I ___ rich, I would travel the world.',
    options: ['am', 'was', 'were', 'be'],
    correctAnswer: 'were',
    explanation: '"Were" is used in the second conditional for hypothetical situations, regardless of whether the subject is singular or plural.',
    grammarRule: 'Second conditional: If + subject + were/past tense, subject + would + base verb',
  },
  {
    id: 'ex-6',
    type: 'sentence-building',
    question: 'Arrange the words to form a correct question:',
    words: ['you', 'have', 'finished', 'homework', 'your', '?'],
    correctAnswer: 'have you finished your homework ?',
    explanation: 'In question formation with present perfect, the auxiliary "have" comes before the subject "you".',
    grammarRule: 'Question formation: Auxiliary verb + Subject + main verb + object?',
  },
  {
    id: 'ex-7',
    type: 'error-correction',
    question: 'Find and correct the error in this sentence:',
    sentence: 'Neither the students nor the teacher were present.',
    correctAnswer: 'Neither the students nor the teacher was present.',
    explanation: 'With "neither...nor", the verb agrees with the subject closest to it. Since "the teacher" is singular, we use "was".',
    grammarRule: 'Neither...nor: verb agrees with the nearest subject (proximity rule)',
  },
];

// --- Component ---

export function GrammarExercise() {
  const { theme } = useTheme();
  const { id: chapterId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const exercises = MOCK_EXERCISES;
  const totalExercises = exercises.length;
  const currentExercise = exercises[currentIndex] || null;
  const isLimitedContent = totalExercises >= 2 && totalExercises <= 4;

  // Score calculation (floor-based, Req 11.6)
  const scorePercentage = completedCount > 0 ? Math.floor((correctCount / completedCount) * 100) : 0;

  // Check if user answer matches correct answer
  const checkAnswer = useCallback((exercise: Exercise, answer: string): boolean => {
    const normalizedAnswer = answer.trim().toLowerCase().replace(/\s+/g, ' ');
    const normalizedCorrect = exercise.correctAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalizedAnswer === normalizedCorrect;
  }, []);

  // Submit answer (Req 11.5 — feedback within 3 seconds, 1-second simulated delay)
  const handleSubmit = useCallback(() => {
    if (!currentExercise || isSubmitting || feedback) return;

    let answer = userAnswer;
    if (currentExercise.type === 'sentence-building' || currentExercise.type === 'word-reordering') {
      answer = selectedWords.join(' ');
    }

    if (!answer.trim()) return;

    setIsSubmitting(true);

    // Simulate 1-second processing delay (within 3-second requirement)
    setTimeout(() => {
      const isCorrect = checkAnswer(currentExercise, answer);
      setFeedback({
        isCorrect,
        explanation: currentExercise.explanation,
        grammarRule: currentExercise.grammarRule,
      });
      setCompletedCount((prev) => prev + 1);
      if (isCorrect) {
        setCorrectCount((prev) => prev + 1);
      }
      setIsSubmitting(false);
    }, 1000);
  }, [currentExercise, userAnswer, selectedWords, isSubmitting, feedback, checkAnswer]);

  // Move to next exercise
  const handleNext = useCallback(() => {
    if (currentIndex < totalExercises - 1) {
      setCurrentIndex((prev) => prev + 1);
      setUserAnswer('');
      setSelectedWords([]);
      setFeedback(null);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, totalExercises]);

  // Word selection for sentence-building and word-reordering
  const handleWordSelect = useCallback((word: string, index: number) => {
    setSelectedWords((prev) => [...prev, `${word}`]);
    // Track word usage by index to handle duplicate words
  }, []);

  const handleWordRemove = useCallback((removeIndex: number) => {
    setSelectedWords((prev) => prev.filter((_, idx) => idx !== removeIndex));
  }, []);

  // Navigate back
  const handleBackToDashboard = useCallback(() => {
    navigate('/learner/dashboard');
  }, [navigate]);

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
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      background: theme.colors.background,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      fontSize: '0.8125rem',
      fontWeight: theme.typography.weight.medium,
      color: theme.colors.textSecondary,
    },
    card: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.lg,
    },
    limitedMessage: {
      background: '#FEF9E7',
      border: `1px solid ${theme.colors.warning}`,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: '0.8125rem',
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    exerciseType: {
      display: 'inline-block',
      background: theme.colors.background,
      color: theme.colors.secondary,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      fontSize: '0.75rem',
      fontWeight: theme.typography.weight.semibold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      marginBottom: theme.spacing.md,
    },
    question: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    sentence: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: theme.colors.textPrimary,
      fontStyle: 'italic' as const,
      background: theme.colors.background,
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      marginBottom: theme.spacing.md,
    },
    wordBank: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    wordChip: (disabled: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.button,
      border: `1px solid ${disabled ? theme.colors.border : theme.colors.primary}`,
      background: disabled ? theme.colors.border : theme.colors.white,
      color: disabled ? theme.colors.textMuted : theme.colors.primary,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '0.875rem',
      fontWeight: theme.typography.weight.medium,
      transition: 'all 0.2s',
    }),
    selectedArea: {
      minHeight: '48px',
      padding: theme.spacing.md,
      border: `2px dashed ${theme.colors.border}`,
      borderRadius: theme.radii.input,
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      alignItems: 'center',
    },
    selectedWord: {
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      borderRadius: theme.radii.badge,
      background: theme.colors.primary,
      color: theme.colors.white,
      fontSize: '0.8125rem',
      fontWeight: theme.typography.weight.medium,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    optionsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    optionButton: (selected: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.input,
      border: `2px solid ${selected ? theme.colors.primary : theme.colors.border}`,
      background: selected ? `${theme.colors.primary}15` : theme.colors.white,
      color: selected ? theme.colors.primary : theme.colors.textPrimary,
      cursor: 'pointer',
      fontSize: '0.9375rem',
      fontWeight: selected ? theme.typography.weight.semibold : theme.typography.weight.regular,
      textAlign: 'left' as const,
      transition: 'all 0.2s',
      minHeight: '44px',
    }),
    textInput: {
      width: '100%',
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      border: `2px solid ${theme.colors.border}`,
      fontSize: '1rem',
      color: theme.colors.textPrimary,
      outline: 'none',
      boxSizing: 'border-box' as const,
      marginBottom: theme.spacing.md,
    },
    submitButton: (disabled: boolean) => ({
      width: '100%',
      padding: `${theme.spacing.md}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '1rem',
      background: disabled ? theme.colors.border : theme.colors.primary,
      color: disabled ? theme.colors.textMuted : theme.colors.white,
      opacity: disabled ? 0.6 : 1,
      minHeight: '48px',
      transition: 'background 0.2s, opacity 0.2s',
    }),
    feedbackCard: (isCorrect: boolean) => ({
      background: isCorrect ? '#E8F8F0' : '#FDEDEC',
      border: `2px solid ${isCorrect ? theme.colors.success : theme.colors.error}`,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.md,
    }),
    feedbackIcon: {
      fontSize: '2rem',
      marginBottom: theme.spacing.sm,
    },
    feedbackTitle: (isCorrect: boolean) => ({
      fontSize: '1.125rem',
      fontWeight: theme.typography.weight.bold,
      color: isCorrect ? theme.colors.success : theme.colors.error,
      marginBottom: theme.spacing.sm,
    }),
    feedbackExplanation: {
      fontSize: '0.9375rem',
      lineHeight: 1.5,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    feedbackRule: {
      fontSize: '0.8125rem',
      color: theme.colors.textSecondary,
      fontStyle: 'italic' as const,
      background: theme.colors.background,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.badge,
      display: 'inline-block',
    },
    nextButton: {
      marginTop: theme.spacing.md,
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: theme.colors.secondary,
      color: theme.colors.white,
      minHeight: '44px',
    },
    summaryCard: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.xl,
      border: `1px solid ${theme.colors.border}`,
      textAlign: 'center' as const,
    },
    summaryTitle: {
      fontSize: '1.5rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    summaryStatsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    summaryStat: {
      background: theme.colors.background,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
    },
    summaryStatValue: {
      fontSize: '2rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.primary,
    },
    summaryStatLabel: {
      fontSize: '0.75rem',
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    backButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: theme.colors.primary,
      color: theme.colors.white,
      minHeight: '48px',
    },
    progressBar: {
      width: '100%',
      height: '8px',
      background: theme.colors.border,
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: theme.spacing.lg,
    },
  };

  // --- Exercise Type Label ---

  function getTypeLabel(type: ExerciseType): string {
    switch (type) {
      case 'sentence-building': return 'Sentence Building';
      case 'fill-in-blank': return 'Fill in the Blank';
      case 'word-reordering': return 'Word Reordering';
      case 'error-correction': return 'Error Correction';
    }
  }

  // --- Render Exercise Input ---

  function renderExerciseInput() {
    if (!currentExercise) return null;

    switch (currentExercise.type) {
      case 'sentence-building':
      case 'word-reordering': {
        const availableWords = currentExercise.words;
        // Track which word indices have been used
        const usedIndices = new Set<number>();
        selectedWords.forEach((selectedWord) => {
          for (let i = 0; i < availableWords.length; i++) {
            if (!usedIndices.has(i) && availableWords[i] === selectedWord) {
              usedIndices.add(i);
              break;
            }
          }
        });

        return (
          <div>
            {/* Selected words area */}
            <div
              style={styles.selectedArea}
              aria-label="Selected words in order"
            >
              {selectedWords.length === 0 && (
                <span style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>
                  Click words below to build your answer
                </span>
              )}
              {selectedWords.map((word, idx) => (
                <span
                  key={`selected-${idx}`}
                  style={styles.selectedWord}
                  onClick={() => handleWordRemove(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleWordRemove(idx); }}
                  aria-label={`Remove word: ${word}`}
                >
                  {word} ✕
                </span>
              ))}
            </div>

            {/* Word bank */}
            <div style={styles.wordBank} aria-label="Available words">
              {availableWords.map((word, idx) => {
                const isUsed = usedIndices.has(idx);
                return (
                  <button
                    key={`word-${idx}`}
                    style={styles.wordChip(isUsed)}
                    onClick={() => !isUsed && handleWordSelect(word, idx)}
                    disabled={isUsed || !!feedback}
                    aria-label={isUsed ? `Word "${word}" already used` : `Select word: ${word}`}
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'fill-in-blank': {
        return (
          <div style={styles.optionsGrid}>
            {currentExercise.options.map((option) => (
              <button
                key={option}
                style={styles.optionButton(userAnswer === option)}
                onClick={() => !feedback && setUserAnswer(option)}
                disabled={!!feedback}
                aria-label={`Option: ${option}`}
                aria-pressed={userAnswer === option}
              >
                {option}
              </button>
            ))}
          </div>
        );
      }

      case 'error-correction': {
        return (
          <div>
            <div style={styles.sentence}>
              &ldquo;{currentExercise.sentence}&rdquo;
            </div>
            <input
              type="text"
              style={styles.textInput}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type the corrected sentence here…"
              disabled={!!feedback}
              aria-label="Corrected sentence"
            />
          </div>
        );
      }
    }
  }

  // --- Render Feedback (Req 11.5) ---

  function renderFeedback() {
    if (!feedback) return null;

    return (
      <div style={styles.feedbackCard(feedback.isCorrect)} role="alert" aria-live="polite">
        <div style={styles.feedbackIcon} aria-hidden="true">
          {feedback.isCorrect ? '✅' : '❌'}
        </div>
        <div style={styles.feedbackTitle(feedback.isCorrect)}>
          {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
        </div>
        <p style={styles.feedbackExplanation}>{feedback.explanation}</p>
        <span style={styles.feedbackRule}>📐 Rule: {feedback.grammarRule}</span>

        <div style={{ marginTop: theme.spacing.md }}>
          <button
            style={styles.nextButton}
            onClick={handleNext}
            aria-label={currentIndex < totalExercises - 1 ? 'Next exercise' : 'View summary'}
          >
            {currentIndex < totalExercises - 1 ? 'Next Exercise →' : 'View Summary'}
          </button>
        </div>
      </div>
    );
  }

  // --- Summary Screen (Req 11.6) ---

  if (isFinished) {
    const finalScore = completedCount > 0 ? Math.floor((correctCount / completedCount) * 100) : 0;

    return (
      <div style={styles.container}>
        <div style={styles.summaryCard as React.CSSProperties}>
          <div style={{ fontSize: '3rem', marginBottom: theme.spacing.md }} aria-hidden="true">
            🎉
          </div>
          <h1 style={styles.summaryTitle}>Exercise Complete!</h1>

          <div style={styles.summaryStatsGrid}>
            <div style={styles.summaryStat}>
              <div style={styles.summaryStatValue}>{completedCount}</div>
              <div style={styles.summaryStatLabel}>Exercises Completed</div>
            </div>
            <div style={styles.summaryStat}>
              <div style={{ ...styles.summaryStatValue, color: theme.colors.success }}>
                {correctCount}
              </div>
              <div style={styles.summaryStatLabel}>Correct Answers</div>
            </div>
            <div style={styles.summaryStat}>
              <div style={{ ...styles.summaryStatValue, color: theme.colors.secondary }}>
                {finalScore}%
              </div>
              <div style={styles.summaryStatLabel}>Score</div>
            </div>
          </div>

          <button
            style={styles.backButton}
            onClick={handleBackToDashboard}
            aria-label="Back to dashboard"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- Main Render ---

  const hasAnswer = currentExercise?.type === 'sentence-building' || currentExercise?.type === 'word-reordering'
    ? selectedWords.length > 0
    : userAnswer.trim().length > 0;

  const progressPercent = totalExercises > 0
    ? Math.round(((currentIndex) / totalExercises) * 100)
    : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Grammar Exercise</h1>
          <p style={styles.subtitle}>
            Chapter {chapterId} — Question {currentIndex + 1} of {totalExercises}
          </p>
        </div>
        <div style={styles.progressBadge} aria-label={`Score: ${scorePercentage}%`}>
          ✅ {correctCount}/{completedCount} ({scorePercentage}%)
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={styles.progressBar}
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Exercise progress"
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Limited content message (Req 11.7) */}
      {isLimitedContent && (
        <div style={styles.limitedMessage} role="status">
          <span aria-hidden="true">⚠️</span>
          Limited exercises available due to limited chapter content.
        </div>
      )}

      {/* Exercise Card */}
      {currentExercise && (
        <div style={styles.card}>
          {/* Exercise type badge */}
          <span style={styles.exerciseType}>
            {getTypeLabel(currentExercise.type)}
          </span>

          {/* Question */}
          <p style={styles.question}>{currentExercise.question}</p>

          {/* Exercise input area */}
          {renderExerciseInput()}

          {/* Submit button (Req 11.5 — no proactive explanations before submission) */}
          {!feedback && (
            <button
              style={styles.submitButton(!hasAnswer || isSubmitting)}
              onClick={handleSubmit}
              disabled={!hasAnswer || isSubmitting}
              aria-label={isSubmitting ? 'Checking answer…' : 'Submit answer'}
            >
              {isSubmitting ? 'Checking…' : 'Submit Answer'}
            </button>
          )}

          {/* Feedback */}
          {renderFeedback()}
        </div>
      )}
    </div>
  );
}
