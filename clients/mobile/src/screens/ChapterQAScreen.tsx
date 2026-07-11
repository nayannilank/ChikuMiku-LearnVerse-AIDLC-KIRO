/**
 * ChapterQAScreen — AI-powered Q&A chat interface
 *
 * Chat-like interface for asking questions about chapter content.
 * Input limited to 500 characters, supports up to 20 follow-up questions per session.
 * Answers adapted to grade level with multi-step numbered breakdowns.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
import React, { useState, useCallback, useRef } from 'react';
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

interface QAPair {
  id: string;
  question: string;
  answer: string;
  steps?: string[];
}

interface QAResponse {
  answer: string;
  steps?: string[];
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

const MAX_QUESTION_LENGTH = 500;
const MAX_FOLLOW_UPS = 20;

/* --- Component --- */

export function ChapterQAScreen({ route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const questionCount = qaPairs.length;
  const canAskMore = questionCount < MAX_FOLLOW_UPS;

  /* --- Handle text change (enforce 500 char limit) --- */

  const handleTextChange = useCallback((text: string) => {
    // Req 12.6: reject > 500 chars before submission
    if (text.length <= MAX_QUESTION_LENGTH) {
      setQuestionText(text);
    }
  }, []);

  /* --- Submit question --- */

  const handleSubmit = useCallback(async () => {
    const trimmed = questionText.trim();
    if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH) return;
    if (!canAskMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<QAResponse>('/ai/qa', {
        chapterId,
        question: trimmed,
        sessionHistory: qaPairs.map((p) => ({ question: p.question, answer: p.answer })),
      });

      const newPair: QAPair = {
        id: `qa-${Date.now()}`,
        question: trimmed,
        answer: response.data.answer,
        steps: response.data.steps,
      };

      setQaPairs((prev) => [...prev, newPair]);
      setQuestionText('');

      // Auto-scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      if (apiErr.message?.includes('no relevant content')) {
        setError('No relevant content found for this question.');
      } else {
        setError('Failed to get an answer. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [questionText, chapterId, qaPairs, canAskMore]);

  /* --- Render --- */

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chapter Q&A</Text>

      {/* Chat area */}
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
      >
        {qaPairs.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Ask any question about this chapter. I&apos;ll explain it at your level!
            </Text>
          </View>
        )}

        {qaPairs.map((pair) => (
          <View key={pair.id} style={styles.qaPairContainer}>
            {/* Question bubble */}
            <View style={styles.questionBubble}>
              <Text style={styles.questionBubbleText}>{pair.question}</Text>
            </View>

            {/* Answer bubble */}
            <View style={styles.answerBubble}>
              <Text style={styles.answerText}>{pair.answer}</Text>

              {/* Multi-step breakdown (Req 12.4) */}
              {pair.steps && pair.steps.length > 0 && (
                <View style={styles.stepsContainer}>
                  {pair.steps.map((step, idx) => (
                    <View key={idx} style={styles.stepRow}>
                      <Text style={styles.stepNumber}>{idx + 1}.</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBubble}>
            <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Input area */}
      <View style={styles.inputArea}>
        {!canAskMore && (
          <Text style={styles.limitReached}>
            Maximum {MAX_FOLLOW_UPS} questions reached for this session.
          </Text>
        )}

        <View style={styles.inputRow}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={questionText}
              onChangeText={handleTextChange}
              placeholder={canAskMore ? 'Ask a question...' : 'Session limit reached'}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              editable={canAskMore && !isLoading}
              accessibilityLabel="Question input"
            />
            {/* Character counter */}
            <Text
              style={[
                styles.charCounter,
                questionText.length >= MAX_QUESTION_LENGTH && styles.charCounterLimit,
              ]}
            >
              {questionText.length}/{MAX_QUESTION_LENGTH}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!questionText.trim() || isLoading || !canAskMore) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!questionText.trim() || isLoading || !canAskMore}
            accessibilityRole="button"
            accessibilityLabel="Send question"
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  qaPairContainer: {
    marginBottom: spacing.md,
  },
  questionBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: borderRadii.card,
    borderBottomRightRadius: borderRadii.small,
    padding: spacing.md,
    maxWidth: '80%',
    marginBottom: spacing.sm,
  },
  questionBubbleText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
  },
  answerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    borderBottomLeftRadius: borderRadii.small,
    padding: spacing.md,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  answerText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  stepsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    width: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDEDEC',
    borderRadius: borderRadii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    padding: spacing.sm,
  },
  limitReached: {
    fontSize: 12,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadii.input,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
    minHeight: 48,
  },
  charCounter: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  charCounterLimit: {
    color: colors.error,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
