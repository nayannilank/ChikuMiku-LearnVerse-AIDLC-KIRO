/**
 * GrammarExerciseScreen — AI-generated grammar exercises
 *
 * Generates 5-10 exercises from chapter content (sentence building, fill-in-the-blank,
 * word reordering, error correction). Provides feedback with correct/incorrect indicator,
 * explanation, and grammar rule. Shows score summary.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */
import React, { useState, useCallback, useEffect } from 'react';
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

interface Exercise {
  id: string;
  type: 'sentence_building' | 'fill_in_blank' | 'word_reordering' | 'error_correction';
  question: string;
}

interface Feedback {
  isCorrect: boolean;
  explanation: string;
  grammarRule: string;
  correctAnswer: string;
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

/* --- Component --- */

export function GrammarExerciseScreen({ route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitedContent, setLimitedContent] = useState(false);

  // Per-exercise state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  // Score tracking
  const [completed, setCompleted] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  /* --- Load exercises --- */

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<Exercise[]>('/ai/grammar', { chapterId });
        if (!cancelled) {
          setExercises(response.data);
          // Req 11.6: show "limited content" message if 2-4 exercises generated
          if (response.data.length >= 2 && response.data.length <= 4) {
            setLimitedContent(true);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Failed to generate grammar exercises. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [chapterId]);

  /* --- Handle answer change --- */

  const handleAnswerChange = useCallback((exerciseId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [exerciseId]: text }));
  }, []);

  /* --- Submit answer --- */

  const handleSubmit = useCallback(async (exerciseId: string) => {
    const answer = answers[exerciseId]?.trim();
    if (!answer) return;

    setSubmitting((prev) => ({ ...prev, [exerciseId]: true }));
    try {
      const response = await apiClient.post<Feedback>('/ai/grammar/evaluate', {
        chapterId,
        exerciseId,
        answer,
      });
      setFeedback((prev) => ({ ...prev, [exerciseId]: response.data }));
      setCompleted((prev) => prev + 1);
      if (response.data.isCorrect) {
        setCorrectCount((prev) => prev + 1);
      }
    } catch {
      // Show generic error in feedback
      setFeedback((prev) => ({
        ...prev,
        [exerciseId]: {
          isCorrect: false,
          explanation: 'Failed to evaluate answer. Please try again.',
          grammarRule: '',
          correctAnswer: '',
        },
      }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [exerciseId]: false }));
    }
  }, [answers, chapterId]);

  /* --- Render --- */

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating grammar exercises...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
      </View>
    );
  }

  const percentage = completed > 0 ? Math.round((correctCount / completed) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Grammar Exercises</Text>

      {/* Limited content notice (Req 11.6) */}
      {limitedContent && (
        <View style={styles.limitedBanner}>
          <Text style={styles.limitedText}>
            Limited content available — fewer exercises generated for this chapter.
          </Text>
        </View>
      )}

      {/* Score summary */}
      {completed > 0 && (
        <View style={styles.scoreSummary}>
          <Text style={styles.scoreText}>
            {correctCount}/{completed} correct ({percentage}%)
          </Text>
          <Text style={styles.scoreSubtext}>
            {exercises.length - completed} remaining
          </Text>
        </View>
      )}

      {/* Exercises */}
      {exercises.map((exercise, index) => {
        const fb = feedback[exercise.id];
        const isSubmitting = submitting[exercise.id] || false;
        const hasSubmitted = !!fb;

        return (
          <View key={exercise.id} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseNumber}>#{index + 1}</Text>
              <Text style={styles.exerciseType}>
                {exercise.type.replace(/_/g, ' ')}
              </Text>
            </View>

            <Text style={styles.questionText}>{exercise.question}</Text>

            {/* Answer input */}
            {!hasSubmitted && (
              <View>
                <TextInput
                  style={styles.answerInput}
                  value={answers[exercise.id] || ''}
                  onChangeText={(text) => handleAnswerChange(exercise.id, text)}
                  placeholder="Type your answer..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  accessibilityLabel={`Answer for exercise ${index + 1}`}
                />
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!answers[exercise.id]?.trim() || isSubmitting) && styles.submitButtonDisabled,
                  ]}
                  onPress={() => handleSubmit(exercise.id)}
                  disabled={!answers[exercise.id]?.trim() || isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Submit answer for exercise ${index + 1}`}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Feedback */}
            {hasSubmitted && (
              <View
                style={[
                  styles.feedbackContainer,
                  fb.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
                ]}
              >
                <Text style={styles.feedbackStatus}>
                  {fb.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                </Text>
                {fb.correctAnswer && !fb.isCorrect && (
                  <Text style={styles.correctAnswer}>
                    Correct answer: {fb.correctAnswer}
                  </Text>
                )}
                {fb.explanation && (
                  <Text style={styles.feedbackExplanation}>{fb.explanation}</Text>
                )}
                {fb.grammarRule && (
                  <View style={styles.grammarRuleBox}>
                    <Text style={styles.grammarRuleLabel}>Grammar Rule:</Text>
                    <Text style={styles.grammarRuleText}>{fb.grammarRule}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  limitedBanner: {
    backgroundColor: colors.warning,
    borderRadius: borderRadii.badge,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  limitedText: {
    fontSize: 13,
    color: colors.dark,
    textAlign: 'center',
  },
  scoreSummary: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scoreSubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  exerciseCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  exerciseNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  exerciseType: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  questionText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadii.input,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackContainer: {
    borderRadius: borderRadii.badge,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  feedbackCorrect: {
    backgroundColor: '#E8F8F0',
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  feedbackIncorrect: {
    backgroundColor: '#FDEDEC',
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  feedbackStatus: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  correctAnswer: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  feedbackExplanation: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  grammarRuleBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.small,
    padding: spacing.sm,
  },
  grammarRuleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  grammarRuleText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
