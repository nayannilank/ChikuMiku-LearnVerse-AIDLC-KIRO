/**
 * RevisionQuizScreen — AI-generated revision quizzes
 *
 * Three phases: Setup (difficulty + timer), Quiz (questions with timer countdown),
 * Results (score %, time taken, per-question breakdown).
 *
 * Question types: MCQ, Fill-in-blank, True/False, Short Answer, Long Answer.
 * Auto-submits when timer expires.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { apiClient } from '../services/api';

/* --- Types --- */

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionType = 'mcq' | 'fill_in_blank' | 'true_false' | 'short_answer' | 'long_answer';
type Phase = 'setup' | 'quiz' | 'results';

interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // For MCQ
}

interface QuizResult {
  questionId: string;
  questionText: string;
  yourAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface SubmitResponse {
  totalScore: number;
  timeTaken: number;
  results: QuizResult[];
}

interface NavigationProp {
  goBack: () => void;
}

interface RouteProp {
  params: { chapterId: string };
}

interface Props {
  navigation: NavigationProp;
  route: RouteProp;
}

/* --- Constants --- */

const TIMER_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 5); // 5, 10, 15 ... 120
const SHORT_ANSWER_MAX = 100;
const LONG_ANSWER_MAX = 1000;

/* --- Component --- */

export function RevisionQuizScreen({ route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  // Phase
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup state
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0); // seconds
  const [startTime, setStartTime] = useState(0);

  // Results state
  const [submitResults, setSubmitResults] = useState<SubmitResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --- Timer countdown --- */

  useEffect(() => {
    if (phase !== 'quiz') return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-submit on expiry (Req 13.7)
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase]);

  /* --- Generate quiz --- */

  const handleStart = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await apiClient.post<QuizQuestion[]>('/ai/revision', {
        chapterId,
        difficulty,
        timerMinutes,
      });
      setQuestions(response.data);
      setTimeRemaining(timerMinutes * 60);
      setStartTime(Date.now());
      setCurrentQuestionIndex(0);
      setAnswers({});
      setPhase('quiz');
    } catch {
      setGenerateError('Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [chapterId, difficulty, timerMinutes]);

  /* --- Submit quiz --- */

  const submitQuiz = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<SubmitResponse>('/ai/revision/submit', {
        chapterId,
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        timeTaken: Math.round((Date.now() - startTime) / 1000),
      });
      setSubmitResults(response.data);
      setPhase('results');
    } catch {
      // On error, still show results phase with what we have
      setSubmitResults(null);
      setPhase('results');
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, chapterId, startTime]);

  const handleAutoSubmit = useCallback(() => {
    submitQuiz();
  }, [submitQuiz]);

  /* --- Answer handlers --- */

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  /* --- Navigation --- */

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  }, [questions.length]);

  /* --- Timer display --- */

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /* --- Render: Setup Phase --- */

  if (phase === 'setup') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Revision Quiz</Text>

        {/* Difficulty selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Difficulty</Text>
          <View style={styles.optionsRow}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.optionChip, difficulty === d && styles.optionChipActive]}
                onPress={() => setDifficulty(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: difficulty === d }}
                accessibilityLabel={`Difficulty ${d}`}
              >
                <Text
                  style={[styles.optionChipText, difficulty === d && styles.optionChipTextActive]}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Timer selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Timer: {timerMinutes} minutes
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.timerRow}>
              {TIMER_OPTIONS.map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.timerChip, timerMinutes === mins && styles.timerChipActive]}
                  onPress={() => setTimerMinutes(mins)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: timerMinutes === mins }}
                  accessibilityLabel={`${mins} minutes`}
                >
                  <Text
                    style={[
                      styles.timerChipText,
                      timerMinutes === mins && styles.timerChipTextActive,
                    ]}
                  >
                    {mins}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Error */}
        {generateError && (
          <Text style={styles.errorText} accessibilityRole="alert">{generateError}</Text>
        )}

        {/* Start button */}
        <TouchableOpacity
          style={[styles.startButton, isGenerating && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityLabel="Start quiz"
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.startButtonText}>Start Quiz</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  /* --- Render: Quiz Phase --- */

  if (phase === 'quiz') {
    const question = questions[currentQuestionIndex];
    const currentAnswer = answers[question?.id] || '';

    return (
      <View style={styles.container}>
        {/* Timer bar */}
        <View style={styles.timerBar}>
          <Text
            style={[styles.timerText, timeRemaining < 60 && styles.timerTextUrgent]}
          >
            ⏱ {formatTime(timeRemaining)}
          </Text>
          <Text style={styles.questionCounter}>
            {currentQuestionIndex + 1}/{questions.length}
          </Text>
        </View>

        {/* Question content */}
        <ScrollView style={styles.quizContent} contentContainerStyle={styles.quizContentInner}>
          {question && (
            <View>
              <Text style={styles.questionType}>
                {question.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <Text style={styles.questionText}>{question.text}</Text>

              {/* Answer input based on type */}
              {question.type === 'mcq' && question.options && (
                <View style={styles.mcqOptions}>
                  {question.options.map((option, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.mcqOption,
                        currentAnswer === option && styles.mcqOptionSelected,
                      ]}
                      onPress={() => setAnswer(question.id, option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: currentAnswer === option }}
                      accessibilityLabel={`Option ${String.fromCharCode(65 + idx)}: ${option}`}
                    >
                      <Text style={styles.mcqOptionLetter}>
                        {String.fromCharCode(65 + idx)}.
                      </Text>
                      <Text
                        style={[
                          styles.mcqOptionText,
                          currentAnswer === option && styles.mcqOptionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {question.type === 'true_false' && (
                <View style={styles.trueFalseRow}>
                  <TouchableOpacity
                    style={[
                      styles.trueFalseButton,
                      currentAnswer === 'True' && styles.trueFalseButtonSelected,
                    ]}
                    onPress={() => setAnswer(question.id, 'True')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: currentAnswer === 'True' }}
                    accessibilityLabel="True"
                  >
                    <Text
                      style={[
                        styles.trueFalseText,
                        currentAnswer === 'True' && styles.trueFalseTextSelected,
                      ]}
                    >
                      True
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.trueFalseButton,
                      currentAnswer === 'False' && styles.trueFalseButtonSelected,
                    ]}
                    onPress={() => setAnswer(question.id, 'False')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: currentAnswer === 'False' }}
                    accessibilityLabel="False"
                  >
                    <Text
                      style={[
                        styles.trueFalseText,
                        currentAnswer === 'False' && styles.trueFalseTextSelected,
                      ]}
                    >
                      False
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {question.type === 'fill_in_blank' && (
                <TextInput
                  style={styles.shortInput}
                  value={currentAnswer}
                  onChangeText={(text) => setAnswer(question.id, text)}
                  placeholder="Fill in the blank..."
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Fill in the blank answer"
                />
              )}

              {question.type === 'short_answer' && (
                <View>
                  <TextInput
                    style={styles.shortInput}
                    value={currentAnswer}
                    onChangeText={(text) => {
                      if (text.length <= SHORT_ANSWER_MAX) {
                        setAnswer(question.id, text);
                      }
                    }}
                    placeholder="Short answer (max 100 chars)..."
                    placeholderTextColor={colors.textMuted}
                    maxLength={SHORT_ANSWER_MAX}
                    accessibilityLabel="Short answer"
                  />
                  <Text style={styles.charHint}>
                    {currentAnswer.length}/{SHORT_ANSWER_MAX}
                  </Text>
                </View>
              )}

              {question.type === 'long_answer' && (
                <View>
                  <TextInput
                    style={styles.longInput}
                    value={currentAnswer}
                    onChangeText={(text) => {
                      if (text.length <= LONG_ANSWER_MAX) {
                        setAnswer(question.id, text);
                      }
                    }}
                    placeholder="Write your answer (max 1000 chars)..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={LONG_ANSWER_MAX}
                    textAlignVertical="top"
                    accessibilityLabel="Long answer"
                  />
                  <Text style={styles.charHint}>
                    {currentAnswer.length}/{LONG_ANSWER_MAX}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Navigation + Submit */}
        <View style={styles.quizNavRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentQuestionIndex <= 0 && styles.navBtnDisabled]}
            onPress={() => goToQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex <= 0}
            accessibilityRole="button"
            accessibilityLabel="Previous question"
          >
            <Text
              style={[styles.navBtnText, currentQuestionIndex <= 0 && styles.navBtnTextDisabled]}
            >
              ← Prev
            </Text>
          </TouchableOpacity>

          {currentQuestionIndex < questions.length - 1 ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => goToQuestion(currentQuestionIndex + 1)}
              accessibilityRole="button"
              accessibilityLabel="Next question"
            >
              <Text style={styles.navBtnText}>Next →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitQuizButton, isSubmitting && styles.submitQuizButtonDisabled]}
              onPress={submitQuiz}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Submit quiz"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.submitQuizText}>Submit Quiz</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  /* --- Render: Results Phase --- */

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Quiz Results</Text>

      {submitResults ? (
        <View>
          {/* Score summary */}
          <View style={styles.resultsSummary}>
            <Text style={styles.scorePercentage}>{submitResults.totalScore}%</Text>
            <Text style={styles.timeTaken}>
              Time taken: {Math.floor(submitResults.timeTaken / 60)}m{' '}
              {submitResults.timeTaken % 60}s
            </Text>
          </View>

          {/* Per-question breakdown */}
          {submitResults.results.map((result, idx) => (
            <View
              key={result.questionId}
              style={[
                styles.resultCard,
                result.isCorrect ? styles.resultCorrect : styles.resultIncorrect,
              ]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultNumber}>Q{idx + 1}</Text>
                <Text style={styles.resultIndicator}>
                  {result.isCorrect ? '✓' : '✗'}
                </Text>
              </View>
              <Text style={styles.resultQuestion}>{result.questionText}</Text>
              <Text style={styles.resultYourAnswer}>
                Your answer: {result.yourAnswer || '(not answered)'}
              </Text>
              {!result.isCorrect && (
                <Text style={styles.resultCorrectAnswer}>
                  Correct: {result.correctAnswer}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load results. Your quiz was submitted.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optionChipTextActive: {
    color: colors.white,
  },
  timerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timerChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadii.button,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timerChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  timerChipTextActive: {
    color: colors.white,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.md,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Quiz phase styles
  timerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timerTextUrgent: {
    color: colors.error,
  },
  questionCounter: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  quizContent: {
    flex: 1,
  },
  quizContentInner: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  questionType: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  mcqOptions: {
    gap: spacing.sm,
  },
  mcqOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  mcqOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FDF0F6',
  },
  mcqOptionLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginRight: spacing.sm,
    width: 24,
  },
  mcqOptionText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  mcqOptionTextSelected: {
    fontWeight: '600',
  },
  trueFalseRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trueFalseButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  trueFalseButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  trueFalseText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  trueFalseTextSelected: {
    color: colors.white,
  },
  shortInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadii.input,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  longInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadii.input,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 120,
  },
  charHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  quizNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  navBtn: {
    backgroundColor: colors.accent,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnDisabled: {
    backgroundColor: colors.border,
  },
  navBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  navBtnTextDisabled: {
    color: colors.textMuted,
  },
  submitQuizButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitQuizButtonDisabled: {
    opacity: 0.5,
  },
  submitQuizText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // Results phase styles
  resultsSummary: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scorePercentage: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  timeTaken: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  resultCard: {
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  resultCorrect: {
    backgroundColor: '#E8F8F0',
    borderLeftColor: colors.success,
  },
  resultIncorrect: {
    backgroundColor: '#FDEDEC',
    borderLeftColor: colors.error,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultIndicator: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultQuestion: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  resultYourAnswer: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  resultCorrectAnswer: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  errorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
});
