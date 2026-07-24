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
        <ActivityIndicator size="large" color={'#E94F9B'} />
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
                  placeholderTextColor={'#999999'}
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
                    <ActivityIndicator size="small" color={'#FFFFFF'} />
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
    backgroundColor: '#F8F5FF',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#777777',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2341',
    textAlign: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  limitedBanner: {
    backgroundColor: '#F7C948',
    borderRadius: 10,
    padding: 8,
    marginBottom: 16,
  },
  limitedText: {
    fontSize: 13,
    color: '#2C2341',
    textAlign: 'center',
  },
  scoreSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0D8EC',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  scoreSubtext: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0D8EC',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  exerciseNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E94F9B',
  },
  exerciseType: {
    fontSize: 12,
    color: '#999999',
    textTransform: 'capitalize',
  },
  questionText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 16,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#E0D8EC',
    borderRadius: 8,
    padding: 16,
    fontSize: 15,
    color: '#333333',
    backgroundColor: '#F8F5FF',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackContainer: {
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  feedbackCorrect: {
    backgroundColor: '#E8F8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  feedbackIncorrect: {
    backgroundColor: '#FDEDEC',
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  feedbackStatus: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  correctAnswer: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    marginBottom: 4,
  },
  feedbackExplanation: {
    fontSize: 14,
    color: '#777777',
    lineHeight: 20,
    marginBottom: 8,
  },
  grammarRuleBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 8,
  },
  grammarRuleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
    marginBottom: 4,
  },
  grammarRuleText: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 18,
  },
});
