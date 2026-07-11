/**
 * ChapterQA — Q&A chat screen for chapter-specific questions.
 *
 * Chat-like interface with question/answer pairs in a scrollable area.
 * Text input at bottom with character counter (X/500).
 * Submit disabled when empty or > 500 chars.
 * Mock AI answers with step-by-step breakdowns for multi-step problems.
 * Supports up to 20 follow-up questions per session with context maintained.
 * Grade-adapted vocabulary and complexity.
 * Error states: constraint violations, no relevant content, generation failure.
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Constants ---

const MAX_QUESTION_LENGTH = 500;
const MAX_QUESTIONS_PER_SESSION = 20;
const MOCK_RESPONSE_DELAY_MIN = 1000;
const MOCK_RESPONSE_DELAY_MAX = 2000;

// --- Types ---

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStepByStep: boolean;
  steps?: string[];
  isError: boolean;
  errorType?: 'no-relevant-content' | 'generation-failure';
  timestamp: number;
}

// --- Mock answer generation (Req 12.2, 12.3, 12.5) ---

const NO_RELEVANT_KEYWORDS = ['aliens', 'cryptocurrency', 'blockchain', 'stock market'];
const GENERATION_FAILURE_KEYWORD = 'crash_test_error';

function generateMockAnswer(question: string): ChatMessage {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lowerQuestion = question.toLowerCase();

  // Check for no relevant content (Req 12.5 error)
  if (NO_RELEVANT_KEYWORDS.some((kw) => lowerQuestion.includes(kw))) {
    return {
      id,
      role: 'assistant',
      content: 'No relevant content found for your question. Please ask something related to this chapter.',
      isStepByStep: false,
      isError: true,
      errorType: 'no-relevant-content',
      timestamp: Date.now(),
    };
  }

  // Check for generation failure mock
  if (lowerQuestion.includes(GENERATION_FAILURE_KEYWORD)) {
    return {
      id,
      role: 'assistant',
      content: 'Something went wrong while generating an answer. Please try again.',
      isStepByStep: false,
      isError: true,
      errorType: 'generation-failure',
      timestamp: Date.now(),
    };
  }

  // Multi-step problem detection (Req 12.3)
  const multiStepKeywords = ['how to', 'steps', 'solve', 'calculate', 'explain how', 'process', 'method'];
  const isMultiStep = multiStepKeywords.some((kw) => lowerQuestion.includes(kw));

  if (isMultiStep) {
    const steps = [
      'Read and understand the problem statement carefully.',
      'Identify the key information and what is being asked.',
      'Choose the appropriate method or formula to apply.',
      'Work through the solution step by step, showing your work.',
      'Check your answer by reviewing each step for accuracy.',
    ];

    return {
      id,
      role: 'assistant',
      content: 'Here is a step-by-step breakdown:',
      isStepByStep: true,
      steps,
      isError: false,
      timestamp: Date.now(),
    };
  }

  // Regular answer (Req 12.2, 12.5 — grade-adapted vocabulary)
  const regularAnswers = [
    'This is a great question! The concept relates to the main ideas covered in this chapter. The key thing to remember is that understanding the fundamentals helps you build stronger knowledge over time.',
    'Good thinking! Based on what we covered in this chapter, the answer involves connecting the ideas from the earlier sections. Take note of how each concept builds upon the previous one.',
    'That is an important topic in this chapter. The main idea is that these concepts work together as a system. Each part has a specific role that contributes to the whole.',
  ];

  const answer = regularAnswers[Math.floor(Math.random() * regularAnswers.length)];

  return {
    id,
    role: 'assistant',
    content: answer,
    isStepByStep: false,
    isError: false,
    timestamp: Date.now(),
  };
}

// --- Component ---

export function ChapterQA() {
  const { theme } = useTheme();
  const { id: chapterId } = useParams<{ id: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isOverLimit = inputValue.length > MAX_QUESTION_LENGTH;
  const isEmpty = inputValue.trim().length === 0;
  const isSessionExhausted = questionCount >= MAX_QUESTIONS_PER_SESSION;
  const isSubmitDisabled = isEmpty || isOverLimit || isThinking || isSessionExhausted;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  // Handle submit (Req 12.2, 12.6)
  const handleSubmit = useCallback(() => {
    if (isSubmitDisabled) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue.trim(),
      isStepByStep: false,
      isError: false,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsThinking(true);
    setQuestionCount((prev) => prev + 1);

    // Simulate AI response delay (Req 12.2 — within 10 seconds)
    const delay = MOCK_RESPONSE_DELAY_MIN + Math.random() * (MOCK_RESPONSE_DELAY_MAX - MOCK_RESPONSE_DELAY_MIN);
    setTimeout(() => {
      const answer = generateMockAnswer(userMessage.content);
      setMessages((prev) => [...prev, answer]);
      setIsThinking(false);
    }, delay);
  }, [inputValue, isSubmitDisabled]);

  // Handle Enter key (submit on Enter, newline on Shift+Enter)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // --- Styles ---

  const styles = {
    container: {
      maxWidth: '720px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column' as const,
      height: 'calc(100vh - 160px)',
      minHeight: '500px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
      flexShrink: 0,
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
    questionCounter: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      background: theme.colors.background,
      color: theme.colors.textSecondary,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      fontWeight: theme.typography.weight.medium,
      fontSize: '0.8125rem',
    },
    chatArea: {
      flex: 1,
      overflowY: 'auto' as const,
      background: theme.colors.background,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      border: `1px solid ${theme.colors.border}`,
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center' as const,
      color: theme.colors.textMuted,
    },
    emptyIcon: {
      fontSize: '2.5rem',
      marginBottom: theme.spacing.md,
    },
    messageBubble: (isUser: boolean) => ({
      maxWidth: '80%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.card,
      marginBottom: theme.spacing.md,
      marginLeft: isUser ? 'auto' : '0',
      marginRight: isUser ? '0' : 'auto',
      background: isUser ? theme.colors.primary : theme.colors.white,
      color: isUser ? theme.colors.white : theme.colors.textPrimary,
      border: isUser ? 'none' : `1px solid ${theme.colors.border}`,
      fontSize: '0.9375rem',
      lineHeight: '1.5',
      wordBreak: 'break-word' as const,
    }),
    errorBubble: {
      maxWidth: '80%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.card,
      marginBottom: theme.spacing.md,
      marginLeft: '0',
      marginRight: 'auto',
      background: '#FFF5F5',
      color: theme.colors.error,
      border: `1px solid ${theme.colors.error}`,
      fontSize: '0.9375rem',
      lineHeight: '1.5',
    },
    stepsList: {
      listStyle: 'none',
      padding: 0,
      margin: `${theme.spacing.sm} 0 0`,
    },
    stepItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      fontSize: '0.9375rem',
      lineHeight: '1.5',
    },
    stepNumber: {
      flexShrink: 0,
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      background: theme.colors.accent,
      color: theme.colors.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
      fontWeight: theme.typography.weight.semibold,
    },
    thinkingIndicator: {
      maxWidth: '80%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      borderRadius: theme.radii.card,
      marginBottom: theme.spacing.md,
      background: theme.colors.white,
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.textMuted,
      fontSize: '0.875rem',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    inputArea: {
      flexShrink: 0,
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      border: `1px solid ${isOverLimit ? theme.colors.error : theme.colors.border}`,
    },
    textInput: {
      width: '100%',
      minHeight: '56px',
      maxHeight: '120px',
      resize: 'vertical' as const,
      border: 'none',
      outline: 'none',
      fontSize: '0.9375rem',
      fontFamily: theme.typography.fontFamily,
      lineHeight: '1.5',
      color: theme.colors.textPrimary,
      background: 'transparent',
    },
    inputFooter: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    charCounter: (isOver: boolean) => ({
      fontSize: '0.75rem',
      color: isOver ? theme.colors.error : theme.colors.textMuted,
      fontWeight: isOver ? theme.typography.weight.semibold : theme.typography.weight.regular,
    }),
    submitButton: (disabled: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: disabled ? theme.colors.border : theme.colors.primary,
      color: disabled ? theme.colors.textMuted : theme.colors.white,
      opacity: disabled ? 0.6 : 1,
      minHeight: '40px',
      transition: 'background 0.2s, opacity 0.2s',
    }),
    errorText: {
      color: theme.colors.error,
      fontSize: '0.75rem',
      marginTop: theme.spacing.xs,
    },
    sessionExhaustedBanner: {
      textAlign: 'center' as const,
      padding: theme.spacing.md,
      background: '#FFF8E1',
      color: theme.colors.textSecondary,
      borderRadius: theme.radii.input,
      fontSize: '0.875rem',
      fontWeight: theme.typography.weight.medium,
    },
  };

  // --- Render Messages ---

  function renderMessage(message: ChatMessage) {
    if (message.isError) {
      return (
        <div key={message.id} style={styles.errorBubble} role="alert">
          <span aria-hidden="true">⚠️ </span>
          {message.content}
        </div>
      );
    }

    if (message.role === 'assistant' && message.isStepByStep) {
      return (
        <div key={message.id} style={styles.messageBubble(false)}>
          <p style={{ margin: 0, marginBottom: theme.spacing.sm }}>{message.content}</p>
          <ol style={styles.stepsList}>
            {message.steps?.map((step, idx) => (
              <li key={idx} style={styles.stepItem}>
                <span style={styles.stepNumber}>{idx + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    }

    return (
      <div key={message.id} style={styles.messageBubble(message.role === 'user')}>
        {message.content}
      </div>
    );
  }

  // --- Main Render ---

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Ask a Question</h1>
          <p style={styles.subtitle}>Chapter {chapterId} — Q&A</p>
        </div>
        <div style={styles.questionCounter} aria-label={`Question ${questionCount} of ${MAX_QUESTIONS_PER_SESSION}`}>
          Question {questionCount} of {MAX_QUESTIONS_PER_SESSION}
        </div>
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea} role="log" aria-label="Chat messages" aria-live="polite">
        {messages.length === 0 && !isThinking && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon} aria-hidden="true">💬</div>
            <p style={{ margin: 0, fontSize: '1rem' }}>Ask anything about this chapter</p>
            <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: '0.8125rem' }}>
              Type your question below and get an instant answer.
            </p>
          </div>
        )}

        {messages.map(renderMessage)}

        {/* Thinking indicator (Req 12.2) */}
        {isThinking && (
          <div style={styles.thinkingIndicator} aria-label="Generating answer">
            <span aria-hidden="true">⏳</span>
            Thinking…
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      {isSessionExhausted ? (
        <div style={styles.sessionExhaustedBanner} role="status">
          Maximum {MAX_QUESTIONS_PER_SESSION} questions per session reached. Start a new session to ask more questions.
        </div>
      ) : (
        <div style={styles.inputArea}>
          <textarea
            ref={inputRef}
            style={styles.textInput}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here…"
            aria-label="Question input"
            aria-describedby="char-counter-hint"
            disabled={isThinking}
            rows={2}
          />

          {/* Constraint violation error (Req 12.6) */}
          {isOverLimit && (
            <p style={styles.errorText} role="alert" id="char-limit-error">
              Question cannot exceed {MAX_QUESTION_LENGTH} characters
            </p>
          )}

          <div style={styles.inputFooter}>
            <span
              id="char-counter-hint"
              style={styles.charCounter(isOverLimit)}
              aria-live="polite"
            >
              {inputValue.length}/{MAX_QUESTION_LENGTH}
            </span>
            <button
              style={styles.submitButton(isSubmitDisabled)}
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              aria-label="Send question"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
