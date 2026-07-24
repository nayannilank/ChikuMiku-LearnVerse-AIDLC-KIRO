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
            <ActivityIndicator size="small" color={'#E94F9B'} />
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
              placeholderTextColor={'#999999'}
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
    backgroundColor: '#F8F5FF',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingTop: 44,
    paddingBottom: 14,
    backgroundColor: '#2C2341',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: '#777777',
    textAlign: 'center',
    lineHeight: 22,
  },
  qaPairContainer: {
    marginBottom: 16,
  },
  questionBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#E94F9B',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 16,
    maxWidth: '80%',
    marginBottom: 8,
  },
  questionBubbleText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  answerBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 16,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#E0D8EC',
  },
  answerText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  stepsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0D8EC',
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E94F9B',
    width: 24,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E0D8EC',
  },
  loadingText: {
    fontSize: 14,
    color: '#777777',
  },
  errorBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FDEDEC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: '#E0D8EC',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  limitReached: {
    fontSize: 12,
    color: '#F7C948',
    textAlign: 'center',
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0D8EC',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    color: '#333333',
    maxHeight: 100,
    minHeight: 48,
  },
  charCounter: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  charCounterLimit: {
    color: '#E74C3C',
  },
  sendButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
