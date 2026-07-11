/**
 * RevisionQuiz — Revision quiz screen with difficulty selection, timer,
 * multiple question types, and results display.
 *
 * Phases: Setup → Quiz → Results
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Types ---

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type QuizPhase = 'setup' | 'quiz' | 'results';

type QuestionType =
  | 'mcq'
  | 'fill-in-blank'
  | 'true-false'
  | 'short-answer'
  | 'long-answer'
  | 'word-meaning'
  | 'sentence-forming'
  | 'maths-problem'
  | 'code-lab'
  | 'diagram-based';

interface QuestionBase {
  id: number;
  type: QuestionType;
  question: string;
  correctAnswer: string;
}

interface McqQuestion extends QuestionBase {
  type: 'mcq';
  options: string[];
}

interface TrueFalseQuestion extends QuestionBase {
  type: 'true-false';
}

interface FillInBlankQuestion extends QuestionBase {
  type: 'fill-in-blank';
}

interface ShortAnswerQuestion extends QuestionBase {
  type: 'short-answer';
}

interface LongAnswerQuestion extends QuestionBase {
  type: 'long-answer';
}

interface WordMeaningQuestion extends QuestionBase {
  type: 'word-meaning';
}

interface SentenceFormingQuestion extends QuestionBase {
  type: 'sentence-forming';
}

interface MathsProblemQuestion extends QuestionBase {
  type: 'maths-problem';
}

interface CodeLabQuestion extends QuestionBase {
  type: 'code-lab';
}

interface DiagramBasedQuestion extends QuestionBase {
  type: 'diagram-based';
}

type Question =
  | McqQuestion
  | TrueFalseQuestion
  | FillInBlankQuestion
  | ShortAnswerQuestion
  | LongAnswerQuestion
  | WordMeaningQuestion
  | SentenceFormingQuestion
  | MathsProblemQuestion
  | CodeLabQuestion
  | DiagramBasedQuestion;

interface AttemptRecord {
  count: number;
  highestScore: number | null;
  mostRecentScore: number | null;
}

// --- Mock Questions (10 questions of different types) ---

const MOCK_QUESTIONS: Question[] = [
  {
    id: 1,
    type: 'mcq',
    question: 'What is the capital of France?',
    options: ['London', 'Paris', 'Berlin', 'Madrid'],
    correctAnswer: 'Paris',
  },
  {
    id: 2,
    type: 'true-false',
    question: 'The Earth revolves around the Sun.',
    correctAnswer: 'True',
  },
  {
    id: 3,
    type: 'fill-in-blank',
    question: 'Water boils at ___ degrees Celsius at sea level.',
    correctAnswer: '100',
  },
  {
    id: 4,
    type: 'short-answer',
    question: 'Name the process by which plants make food using sunlight.',
    correctAnswer: 'Photosynthesis',
  },
  {
    id: 5,
    type: 'long-answer',
    question: 'Explain the water cycle and its importance to the ecosystem.',
    correctAnswer: 'The water cycle involves evaporation, condensation, and precipitation.',
  },
  {
    id: 6,
    type: 'word-meaning',
    question: 'What is the meaning of "benevolent"?',
    correctAnswer: 'Kind and generous',
  },
  {
    id: 7,
    type: 'sentence-forming',
    question: 'Form a meaningful sentence using: "although", "rain", "played".',
    correctAnswer: 'Although it was raining, the children played outside.',
  },
  {
    id: 8,
    type: 'maths-problem',
    question: 'A shopkeeper buys 50 pens at ₹10 each and sells them at ₹12 each. What is the total profit?',
    correctAnswer: '100',
  },
  {
    id: 9,
    type: 'code-lab',
    question: 'What will be the output of: console.log(2 + "2")?',
    correctAnswer: '22',
  },
  {
    id: 10,
    type: 'diagram-based',
    question: 'Label the parts of a flower: The colourful part that attracts insects is called ___.',
    correctAnswer: 'Petal',
  },
];

// --- Timer options (5-120 min in 5-min increments) ---

const TIMER_OPTIONS: number[] = [];
for (let i = 5; i <= 120; i += 5) {
  TIMER_OPTIONS.push(i);
}

// --- Helper: format seconds to mm:ss ---

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// --- Helper: get question type label ---

function getQuestionTypeLabel(type: QuestionType): string {
  const labels: Record<QuestionType, string> = {
    'mcq': 'Multiple Choice',
    'fill-in-blank': 'Fill in the Blank',
    'true-false': 'True / False',
    'short-answer': 'Short Answer',
    'long-answer': 'Long Answer',
    'word-meaning': 'Word Meaning (Language)',
    'sentence-forming': 'Sentence Forming (Language)',
    'maths-problem': 'Problem Based (Maths)',
    'code-lab': 'Lab Style (Computers)',
    'diagram-based': 'Diagram Based (Science/EVS)',
  };
  return labels[type];
}

// --- Component ---

export function RevisionQuiz() {
  const { theme } = useTheme();
  const { id: chapterId } = useParams<{ id: string }>();

  // Phase state
  const [phase, setPhase] = useState<QuizPhase>('setup');

  // Setup state
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [timerMinutes, setTimerMinutes] = useState<number>(15);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results state
  const [timeTaken, setTimeTaken] = useState(0);

  // Attempt tracking (Req 13.10)
  const [attempts, setAttempts] = useState<AttemptRecord>({
    count: 0,
    highestScore: null,
    mostRecentScore: null,
  });

  const questions = MOCK_QUESTIONS;
  const currentQuestion = questions[currentQuestionIndex];

  // --- Timer effect ---

  useEffect(() => {
    if (phase !== 'quiz') return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-submit on timer expiry
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // --- Handlers ---

  const handleStartQuiz = useCallback(() => {
    setPhase('quiz');
    setTimeRemaining(timerMinutes * 60);
    setStartTime(Date.now());
    setCurrentQuestionIndex(0);
    setAnswers({});
  }, [timerMinutes]);

  const handleSubmitQuiz = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    setTimeTaken(elapsed);

    // Calculate score
    let correct = 0;
    questions.forEach((q) => {
      const userAnswer = answers[q.id]?.trim().toLowerCase() || '';
      const correctAnswer = q.correctAnswer.trim().toLowerCase();
      if (userAnswer === correctAnswer) correct++;
    });
    const scorePercent = Math.round((correct / questions.length) * 100);

    // Update attempts (Req 13.10)
    setAttempts((prev) => ({
      count: prev.count + 1,
      highestScore:
        prev.highestScore === null
          ? scorePercent
          : Math.max(prev.highestScore, scorePercent),
      mostRecentScore: scorePercent,
    }));

    setPhase('results');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, answers, questions]);

  const handleAnswerChange = useCallback((questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handlePrevQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1));
  }, [questions.length]);

  const handleRetakeQuiz = useCallback(() => {
    setPhase('setup');
    setAnswers({});
    setCurrentQuestionIndex(0);
  }, []);

  // --- Styles ---

  const styles = {
    container: {
      maxWidth: '720px',
      margin: '0 auto',
    },
    card: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.lg,
    },
    title: {
      margin: 0,
      fontSize: '1.5rem',
      color: theme.colors.textPrimary,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.lg,
    },
    subtitle: {
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
      textAlign: 'center' as const,
      marginBottom: theme.spacing.lg,
    },
    difficultyContainer: {
      display: 'flex',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      marginBottom: theme.spacing.lg,
    },
    difficultyButton: (active: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: active ? `2px solid ${theme.colors.primary}` : `2px solid ${theme.colors.border}`,
      background: active ? theme.colors.primary : 'transparent',
      color: active ? theme.colors.white : theme.colors.textSecondary,
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      minHeight: '44px',
      minWidth: '80px',
    }),
    timerSelect: {
      display: 'block',
      margin: '0 auto',
      marginBottom: theme.spacing.lg,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      fontSize: '1rem',
      minHeight: '44px',
    },
    startButton: {
      display: 'block',
      margin: '0 auto',
      padding: `${theme.spacing.md} ${theme.spacing.xl}`,
      borderRadius: theme.radii.button,
      border: 'none',
      background: theme.colors.primary,
      color: theme.colors.white,
      cursor: 'pointer',
      fontWeight: theme.typography.weight.bold,
      fontSize: '1rem',
      minHeight: '48px',
    },
    timerDisplay: {
      textAlign: 'center' as const,
      fontSize: '1.25rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.primary,
      marginBottom: theme.spacing.md,
    },
    timerWarning: {
      color: theme.colors.error,
    },
    questionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    questionNumber: {
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
      fontWeight: theme.typography.weight.medium,
    },
    questionTypeLabel: {
      fontSize: '0.75rem',
      color: theme.colors.secondary,
      background: theme.colors.background,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      borderRadius: theme.radii.badge,
      fontWeight: theme.typography.weight.medium,
    },
    questionText: {
      fontSize: '1.125rem',
      color: theme.colors.textPrimary,
      lineHeight: 1.6,
      marginBottom: theme.spacing.lg,
    },
    optionLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.sm,
      cursor: 'pointer',
      fontSize: '1rem',
      transition: 'border-color 0.2s',
    },
    optionLabelSelected: {
      borderColor: theme.colors.primary,
      background: `${theme.colors.primary}10`,
    },
    textInput: {
      width: '100%',
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      fontSize: '1rem',
      boxSizing: 'border-box' as const,
    },
    textarea: {
      width: '100%',
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      fontSize: '1rem',
      minHeight: '120px',
      resize: 'vertical' as const,
      boxSizing: 'border-box' as const,
    },
    navigation: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.lg,
    },
    navButton: (disabled: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: disabled ? theme.colors.border : theme.colors.secondary,
      color: disabled ? theme.colors.textMuted : theme.colors.white,
      opacity: disabled ? 0.6 : 1,
      minHeight: '44px',
    }),
    submitButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.bold,
      fontSize: '0.875rem',
      background: theme.colors.success,
      color: theme.colors.white,
      minHeight: '44px',
    },
    resultScore: {
      textAlign: 'center' as const,
      fontSize: '2.5rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.primary,
      marginBottom: theme.spacing.sm,
    },
    resultTime: {
      textAlign: 'center' as const,
      fontSize: '1rem',
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.lg,
    },
    attemptInfo: {
      textAlign: 'center' as const,
      fontSize: '0.875rem',
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
    },
    breakdownItem: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.sm,
    },
    correctIndicator: {
      color: theme.colors.success,
      fontWeight: theme.typography.weight.semibold,
    },
    incorrectIndicator: {
      color: theme.colors.error,
      fontWeight: theme.typography.weight.semibold,
    },
    label: {
      display: 'block',
      marginBottom: theme.spacing.xs,
      fontWeight: theme.typography.weight.medium,
      fontSize: '0.875rem',
      color: theme.colors.textSecondary,
    },
  };

  // --- Render: Setup Phase ---

  function renderSetup() {
    return (
      <div style={styles.card}>
        <h1 style={styles.title}>Revision Quiz</h1>
        <p style={styles.subtitle}>
          Chapter {chapterId} — Select difficulty and time to begin
        </p>

        {/* Attempt tracking display (Req 13.10) */}
        <div style={styles.attemptInfo}>
          <p>
            Attempt {attempts.count + 1} | Highest:{' '}
            {attempts.highestScore !== null ? `${attempts.highestScore}%` : 'N/A'} | Most
            Recent: {attempts.mostRecentScore !== null ? `${attempts.mostRecentScore}%` : 'N/A'}
          </p>
        </div>

        {/* Difficulty selector (Req 13.2) */}
        <label style={styles.label}>Difficulty</label>
        <div
          style={styles.difficultyContainer}
          role="radiogroup"
          aria-label="Select difficulty"
        >
          {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              style={styles.difficultyButton(difficulty === d)}
              onClick={() => setDifficulty(d)}
              role="radio"
              aria-checked={difficulty === d}
              aria-label={`${d} difficulty`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Timer selector (Req 13.3) */}
        <label htmlFor="timer-select" style={styles.label}>
          Timer (minutes)
        </label>
        <select
          id="timer-select"
          value={timerMinutes}
          onChange={(e) => setTimerMinutes(Number(e.target.value))}
          style={styles.timerSelect}
          aria-label="Select timer duration"
        >
          {TIMER_OPTIONS.map((min) => (
            <option key={min} value={min}>
              {min} minutes
            </option>
          ))}
        </select>

        {/* Start button */}
        <button
          type="button"
          style={styles.startButton}
          onClick={handleStartQuiz}
          aria-label="Start quiz"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // --- Render: Question Input ---

  function renderQuestionInput() {
    if (!currentQuestion) return null;
    const answer = answers[currentQuestion.id] || '';

    switch (currentQuestion.type) {
      case 'mcq': {
        const mcq = currentQuestion as McqQuestion;
        return (
          <div role="radiogroup" aria-label="Answer options">
            {mcq.options.map((option) => (
              <label
                key={option}
                style={{
                  ...styles.optionLabel,
                  ...(answer === option ? styles.optionLabelSelected : {}),
                }}
              >
                <input
                  type="radio"
                  name={`question-${mcq.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={() => handleAnswerChange(mcq.id, option)}
                  aria-label={option}
                />
                {option}
              </label>
            ))}
          </div>
        );
      }

      case 'true-false':
        return (
          <div role="radiogroup" aria-label="True or False">
            {['True', 'False'].map((option) => (
              <label
                key={option}
                style={{
                  ...styles.optionLabel,
                  ...(answer === option ? styles.optionLabelSelected : {}),
                }}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={() => handleAnswerChange(currentQuestion.id, option)}
                  aria-label={option}
                />
                {option}
              </label>
            ))}
          </div>
        );

      case 'fill-in-blank':
      case 'short-answer':
      case 'word-meaning':
      case 'maths-problem':
      case 'code-lab':
      case 'diagram-based':
        return (
          <input
            type="text"
            value={answer}
            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
            placeholder={
              currentQuestion.type === 'short-answer'
                ? 'Type your answer (max 100 characters)'
                : 'Type your answer'
            }
            maxLength={currentQuestion.type === 'short-answer' ? 100 : undefined}
            style={styles.textInput}
            aria-label="Your answer"
          />
        );

      case 'long-answer':
      case 'sentence-forming':
        return (
          <textarea
            value={answer}
            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
            placeholder={
              currentQuestion.type === 'long-answer'
                ? 'Type your answer (max 1000 characters)'
                : 'Form a sentence using the given words'
            }
            maxLength={currentQuestion.type === 'long-answer' ? 1000 : undefined}
            style={styles.textarea}
            aria-label="Your answer"
          />
        );

      default:
        return null;
    }
  }

  // --- Render: Quiz Phase ---

  function renderQuiz() {
    const isTimeLow = timeRemaining <= 60;

    return (
      <div style={styles.container}>
        {/* Timer display */}
        <div style={{ ...styles.timerDisplay, ...(isTimeLow ? styles.timerWarning : {}) }}>
          ⏱ {formatTime(timeRemaining)}
        </div>

        <div style={styles.card}>
          {/* Question header */}
          <div style={styles.questionHeader}>
            <span style={styles.questionNumber}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span style={styles.questionTypeLabel}>
              {getQuestionTypeLabel(currentQuestion.type)}
            </span>
          </div>

          {/* Question text */}
          <p style={styles.questionText}>{currentQuestion.question}</p>

          {/* Answer input */}
          {renderQuestionInput()}

          {/* Navigation */}
          <div style={styles.navigation}>
            <button
              type="button"
              style={styles.navButton(currentQuestionIndex === 0)}
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              aria-label="Previous question"
            >
              ← Previous
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                type="button"
                style={styles.submitButton}
                onClick={handleSubmitQuiz}
                aria-label="Submit all answers"
              >
                Submit All
              </button>
            ) : (
              <button
                type="button"
                style={styles.navButton(false)}
                onClick={handleNextQuestion}
                aria-label="Next question"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Results Phase (Req 13.9) ---

  function renderResults() {
    let correct = 0;
    questions.forEach((q) => {
      const userAnswer = answers[q.id]?.trim().toLowerCase() || '';
      const correctAnswer = q.correctAnswer.trim().toLowerCase();
      if (userAnswer === correctAnswer) correct++;
    });
    const scorePercent = Math.round((correct / questions.length) * 100);

    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Quiz Results</h1>

          {/* Score */}
          <div style={styles.resultScore}>{scorePercent}%</div>
          <p style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
            {correct} of {questions.length} correct
          </p>

          {/* Time taken */}
          <p style={styles.resultTime}>
            Time taken: {formatTime(timeTaken)}
          </p>

          {/* Attempt tracking (Req 13.10) */}
          <div style={styles.attemptInfo}>
            <p>
              Attempt {attempts.count} | Highest: {attempts.highestScore}% | Most Recent:{' '}
              {attempts.mostRecentScore}%
            </p>
          </div>

          {/* Per-question breakdown (Req 13.9) */}
          <h2 style={{ fontSize: '1rem', color: theme.colors.textPrimary, marginBottom: theme.spacing.md }}>
            Question Breakdown
          </h2>

          {questions.map((q, idx) => {
            const userAnswer = answers[q.id]?.trim() || '(no answer)';
            const isCorrect =
              userAnswer.toLowerCase() === q.correctAnswer.trim().toLowerCase();
            return (
              <div key={q.id} style={styles.breakdownItem}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                  <span style={{ fontWeight: theme.typography.weight.medium, fontSize: '0.875rem' }}>
                    Q{idx + 1}: {getQuestionTypeLabel(q.type)}
                  </span>
                  <span style={isCorrect ? styles.correctIndicator : styles.incorrectIndicator}>
                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0` }}>
                  {q.question}
                </p>
                <div style={{ fontSize: '0.8125rem', color: theme.colors.textMuted }}>
                  <span>Your answer: <strong>{userAnswer}</strong></span>
                  {!isCorrect && (
                    <span style={{ marginLeft: theme.spacing.md }}>
                      Correct answer: <strong style={{ color: theme.colors.success }}>{q.correctAnswer}</strong>
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Retake button */}
          <button
            type="button"
            style={{ ...styles.startButton, marginTop: theme.spacing.lg }}
            onClick={handleRetakeQuiz}
            aria-label="Retake quiz"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // --- Main Render ---

  return (
    <div style={styles.container}>
      {phase === 'setup' && renderSetup()}
      {phase === 'quiz' && renderQuiz()}
      {phase === 'results' && renderResults()}
    </div>
  );
}
