/**
 * Q&A Service with RAG (GPT-5 Mini + pgvector).
 * Accepts questions (1-500 chars), retrieves top-5 relevant paragraphs
 * via vector search, and generates grade-adapted answers.
 *
 * Supports:
 * - Step-by-step breakdown for multi-step problems
 * - Session context for up to 20 follow-up questions
 * - Error handling for no relevant content or generation failures
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 25.4
 */

import type { QARequest, RAGContext } from '@chikumiku/types';
import type { ILLMClient } from './explanation';
import type { EmbeddingDeps } from './embedding';
import { searchSimilar } from './embedding';
import { getComplexityLevel } from './explanation';

// --- Types ---

/** Response from the Q&A handler. */
export interface QAResponse {
  answer: string;
  isStepByStep: boolean;
  steps?: string[];
  contextUsed: number;
}

/** Session tracking for follow-up questions. */
export interface QASession {
  chapterId: string;
  questionCount: number;
  contextHistory: string[];
}

/** Error types returned by the Q&A handler. */
export interface QAError {
  code: 'NO_CONTENT' | 'GENERATION_FAILED' | 'CONSTRAINT_VIOLATION';
  message: string;
}

/** Repository interface for session persistence. */
export interface IQASessionRepository {
  getSession(sessionId: string): Promise<QASession | null>;
  updateSession(sessionId: string, session: QASession): Promise<void>;
}

/** Dependencies for the Q&A handler. */
export interface QADeps {
  llmClient: ILLMClient;
  embeddingDeps: EmbeddingDeps;
  sessionRepo: IQASessionRepository;
}

// --- Constants ---

/** Maximum allowed question length in characters. */
const MAX_QUESTION_LENGTH = 500;

/** Minimum allowed question length in characters. */
const MIN_QUESTION_LENGTH = 1;

/** Maximum number of follow-up questions per session. */
const MAX_SESSION_CONTEXT = 20;

/** Minimum similarity score threshold for relevant content. */
const SIMILARITY_THRESHOLD = 0.3;

/** Timeout for LLM generation in milliseconds (10 seconds). */
const GENERATION_TIMEOUT_MS = 10_000;

// --- Core Functions ---

/**
 * Validates a question string against length constraints.
 * Returns a QAError if invalid, or null if valid.
 */
export function validateQuestion(question: string): QAError | null {
  if (!question || question.trim().length < MIN_QUESTION_LENGTH) {
    return {
      code: 'CONSTRAINT_VIOLATION',
      message: `Question must be at least ${MIN_QUESTION_LENGTH} character(s).`,
    };
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return {
      code: 'CONSTRAINT_VIOLATION',
      message: `Question must not exceed ${MAX_QUESTION_LENGTH} characters.`,
    };
  }

  return null;
}

/**
 * Detects whether a question likely requires a multi-step answer.
 * Looks for patterns indicating procedural, computational, or sequential reasoning.
 */
export function isMultiStepQuestion(question: string): boolean {
  const multiStepPatterns = [
    /how\s+(do|can|to|would|should)\b/i,
    /step[s]?\s*(by|to)/i,
    /solve/i,
    /calculate/i,
    /find\s+the\s+(value|area|volume|sum|difference|product|quotient)/i,
    /what\s+are\s+the\s+steps/i,
    /explain\s+(how|the\s+process)/i,
    /procedure/i,
    /method\s+to/i,
    /derive/i,
    /prove/i,
    /simplify/i,
    /evaluate/i,
  ];

  return multiStepPatterns.some(pattern => pattern.test(question));
}

/**
 * Parses a step-by-step answer from the LLM response.
 * Extracts numbered steps if the response contains them.
 */
export function parseStepByStepResponse(response: string): { steps: string[]; plainAnswer: string } {
  // Match numbered steps like "1. ...", "Step 1: ...", "1) ..."
  const stepPatterns = [
    /(?:^|\n)\s*(?:step\s+)?\d+[.):\s]+(.+)/gi,
    /(?:^|\n)\s*[-•]\s+(.+)/gi,
  ];

  const steps: string[] = [];

  for (const pattern of stepPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(response)) !== null) {
      const step = match[1].trim();
      if (step.length > 0) {
        steps.push(step);
      }
    }
    if (steps.length > 0) break;
  }

  return {
    steps: steps.length > 1 ? steps : [],
    plainAnswer: response.trim(),
  };
}

/**
 * Builds the LLM prompt for Q&A, adapted to grade level.
 * Includes RAG context paragraphs and session conversation history.
 */
export function buildQAPrompt(
  question: string,
  context: RAGContext,
  sessionHistory: string[],
  gradeLevel: string
): string {
  const complexity = getComplexityLevel(gradeLevel);

  const complexityInstructions: Record<string, string> = {
    simple:
      'Use very simple words and short sentences suitable for young children (ages 4-7). ' +
      'Explain as if talking to a kindergartener. Use familiar everyday examples.',
    moderate:
      'Use clear and straightforward language suitable for children (ages 8-10). ' +
      'Explain concepts with relatable examples and keep vocabulary age-appropriate.',
    advanced:
      'Use precise academic language suitable for secondary school students (ages 11-17). ' +
      'Include relevant technical terms with brief definitions where needed.',
  };

  const contextSection = context.paragraphs.length > 0
    ? `\nRelevant content from the textbook:\n${context.paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n')}\n`
    : '';

  const historySection = sessionHistory.length > 0
    ? `\nPrevious conversation context:\n${sessionHistory.slice(-MAX_SESSION_CONTEXT).join('\n')}\n`
    : '';

  const multiStepInstruction = isMultiStepQuestion(question)
    ? '\nThis appears to be a multi-step problem. Provide a clear step-by-step breakdown with numbered steps.'
    : '';

  return `You are an educational Q&A assistant for a ${gradeLevel} grade student.
${complexityInstructions[complexity]}

Answer the student's question based on the provided textbook content. If the content does not contain enough information to answer, say so clearly.
${multiStepInstruction}
${contextSection}${historySection}
Student's question: ${question}

Provide a clear, helpful answer:`;
}

/**
 * Handles a Q&A request with RAG retrieval and GPT-5 Mini generation.
 *
 * Flow:
 * 1. Validate question length (1-500 chars)
 * 2. Retrieve top-5 relevant paragraphs via vector search
 * 3. Check for relevant content (reject if empty or below threshold)
 * 4. Build grade-adapted prompt with context and session history
 * 5. Generate answer via GPT-5 Mini (within 10s timeout)
 * 6. Detect multi-step problems and format as steps
 * 7. Update session context
 */
export async function handleQARequest(
  payload: QARequest,
  sessionId: string,
  deps: QADeps
): Promise<QAResponse | QAError> {
  // Step 1: Validate question
  const validationError = validateQuestion(payload.question);
  if (validationError) {
    return validationError;
  }

  // Step 2: Retrieve RAG context
  let ragContext: RAGContext;
  try {
    ragContext = await searchSimilar(
      payload.question,
      payload.chapterId,
      deps.embeddingDeps
    );
  } catch {
    return {
      code: 'GENERATION_FAILED',
      message: 'Failed to retrieve relevant content for the question.',
    };
  }

  // Step 3: Check for relevant content
  const relevantParagraphs = ragContext.paragraphs.filter(
    (_, idx) => ragContext.similarity_scores[idx] >= SIMILARITY_THRESHOLD
  );
  const relevantScores = ragContext.similarity_scores.filter(
    score => score >= SIMILARITY_THRESHOLD
  );

  if (relevantParagraphs.length === 0) {
    return {
      code: 'NO_CONTENT',
      message: 'No relevant content found for this question in the chapter.',
    };
  }

  const filteredContext: RAGContext = {
    paragraphs: relevantParagraphs,
    similarity_scores: relevantScores,
  };

  // Step 4: Get session history
  const session = await deps.sessionRepo.getSession(sessionId);
  const sessionHistory = session?.contextHistory ?? payload.sessionContext ?? [];

  // Step 5: Build prompt
  const prompt = buildQAPrompt(
    payload.question,
    filteredContext,
    sessionHistory,
    payload.gradeLevel
  );

  // Step 6: Generate answer with timeout
  let llmResponse: string;
  try {
    llmResponse = await withGenerationTimeout(
      deps.llmClient.generate(prompt, {
        temperature: 0.4,
        maxTokens: 1024,
        model: 'gpt-5-mini',
      }),
      GENERATION_TIMEOUT_MS
    );
  } catch {
    return {
      code: 'GENERATION_FAILED',
      message: 'Answer generation failed or timed out. Please try again.',
    };
  }

  // Step 7: Parse response for multi-step detection
  const isMultiStep = isMultiStepQuestion(payload.question);
  const parsed = isMultiStep
    ? parseStepByStepResponse(llmResponse)
    : { steps: [], plainAnswer: llmResponse.trim() };

  const response: QAResponse = {
    answer: parsed.plainAnswer,
    isStepByStep: isMultiStep && parsed.steps.length > 1,
    contextUsed: filteredContext.paragraphs.length,
  };

  if (isMultiStep && parsed.steps.length > 1) {
    response.steps = parsed.steps;
  }

  // Step 8: Update session context
  const updatedHistory = [
    ...sessionHistory.slice(-(MAX_SESSION_CONTEXT - 1)),
    `Q: ${payload.question}\nA: ${parsed.plainAnswer.slice(0, 200)}`,
  ];

  await deps.sessionRepo.updateSession(sessionId, {
    chapterId: payload.chapterId,
    questionCount: (session?.questionCount ?? 0) + 1,
    contextHistory: updatedHistory,
  });

  return response;
}

/**
 * Wraps an LLM generation promise with a timeout.
 * Rejects if generation takes longer than the specified timeout.
 */
export function withGenerationTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Generation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Type guard to distinguish QAError from QAResponse.
 */
export function isQAError(result: QAResponse | QAError): result is QAError {
  return 'code' in result && 'message' in result && !('answer' in result);
}
