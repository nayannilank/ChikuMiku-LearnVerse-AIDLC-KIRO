/**
 * Revision Quiz Session Management Handler
 *
 * POST /learn/quiz/start       — Start a quiz session with timer config and difficulty
 * POST /learn/quiz/submit      — Submit quiz answers (manual or auto on timer expiry)
 * GET  /learn/quiz/results/:attemptId — Get results for a completed attempt
 * GET  /learn/quiz/attempts/:chapterId/:learnerId — Get all attempt summaries for a chapter
 *
 * Requirements: 13.3, 13.9, 13.10
 */

import type { APIError } from '@chikumiku/types';
import type { QuizAttempt, ProgressSummary } from '@chikumiku/validation';
import { validateTimer, calculateScorePercentage, aggregateProgress } from '@chikumiku/validation';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Difficulty levels for revision quizzes. */
export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

/** Request to start a new quiz session. */
export interface StartQuizRequest {
  chapterId: string;
  learnerId: string;
  difficulty: QuizDifficulty;
  timerMinutes: number;
}

/** A question included in the quiz session. */
export interface QuizQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  options?: string[];
  correctAnswer: string;
}

/** A persisted quiz session record. */
export interface QuizSessionRecord {
  sessionId: string;
  chapterId: string;
  learnerId: string;
  difficulty: QuizDifficulty;
  timerMinutes: number;
  questions: QuizQuestion[];
  startedAt: string;
}

/** A single answer submitted by the learner. */
export interface QuizAnswer {
  questionId: string;
  learnerAnswer: string;
}

/** Request to submit quiz answers. */
export interface SubmitQuizRequest {
  sessionId: string;
  learnerId: string;
  answers: QuizAnswer[];
  /** When true, indicates auto-submit triggered by timer expiry. */
  auto: boolean;
}

/** Per-question breakdown in the results. */
export interface QuestionBreakdown {
  questionId: string;
  questionText: string;
  learnerAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

/** Quiz attempt result record. */
export interface QuizAttemptResult {
  attemptId: string;
  sessionId: string;
  chapterId: string;
  learnerId: string;
  difficulty: QuizDifficulty;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  timeTakenSeconds: number;
  breakdown: QuestionBreakdown[];
  completedAt: string;
}

/** Response from starting a quiz. */
export interface StartQuizResponse {
  success: true;
  sessionId: string;
  chapterId: string;
  difficulty: QuizDifficulty;
  timerMinutes: number;
  questions: Omit<QuizQuestion, 'correctAnswer'>[];
  startedAt: string;
}

/** Response from submitting a quiz. */
export interface SubmitQuizResponse {
  success: true;
  attemptId: string;
  scorePercentage: number;
  timeTakenSeconds: number;
  totalQuestions: number;
  correctAnswers: number;
  breakdown: QuestionBreakdown[];
}

/** Response from getting quiz results. */
export interface QuizResultsResponse {
  success: true;
  attempt: QuizAttemptResult;
}

/** Response from getting attempt summaries for a chapter. */
export interface QuizAttemptsResponse {
  success: true;
  chapterId: string;
  learnerId: string;
  progress: ProgressSummary;
  attempts: Array<{
    attemptId: string;
    difficulty: QuizDifficulty;
    scorePercentage: number;
    timeTakenSeconds: number;
    completedAt: string;
  }>;
}

// ─── Repository Interface ────────────────────────────────────────────────────

/** Repository interface for quiz session data access (dependency injection). */
export interface IQuizSessionRepository {
  /** Check if a chapter exists and has generated questions. */
  chapterHasQuestions(chapterId: string): Promise<boolean>;

  /** Fetch quiz questions for a chapter at a given difficulty. */
  getQuestionsForChapter(chapterId: string, difficulty: QuizDifficulty): Promise<QuizQuestion[]>;

  /** Persist a new quiz session and return the session ID. */
  createSession(session: Omit<QuizSessionRecord, 'sessionId'>): Promise<string>;

  /** Retrieve a quiz session by ID. */
  getSessionById(sessionId: string): Promise<QuizSessionRecord | null>;

  /** Persist a quiz attempt result and return the attempt ID. */
  saveAttemptResult(result: Omit<QuizAttemptResult, 'attemptId'>): Promise<string>;

  /** Retrieve a quiz attempt result by ID. */
  getAttemptById(attemptId: string): Promise<QuizAttemptResult | null>;

  /** Retrieve all quiz attempts for a learner on a specific chapter. */
  getAttemptsForChapter(chapterId: string, learnerId: string): Promise<QuizAttemptResult[]>;
}

/** Dependencies required by quiz session handlers. */
export interface QuizSessionDeps {
  quizSessionRepository: IQuizSessionRepository;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Handle POST /learn/quiz/start
 * Starts a new quiz session with timer configuration and difficulty selection.
 */
export async function handleStartQuiz(
  request: StartQuizRequest,
  deps: QuizSessionDeps
): Promise<StartQuizResponse | APIError> {
  // 1. Validate required fields
  if (!request.chapterId || request.chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  if (!request.learnerId || request.learnerId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Learner ID is required',
      retryable: false,
    };
  }

  // 2. Validate difficulty
  const validDifficulties: QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];
  if (!validDifficulties.includes(request.difficulty)) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Difficulty must be one of: Easy, Medium, Hard',
      details: { difficulty: 'Invalid difficulty level' },
      retryable: false,
    };
  }

  // 3. Validate timer using shared validator
  const timerValidation = validateTimer(request.timerMinutes);
  if (!timerValidation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Invalid timer configuration',
      details: timerValidation.errors,
      retryable: false,
    };
  }

  // 4. Check chapter has available questions
  const hasQuestions = await deps.quizSessionRepository.chapterHasQuestions(request.chapterId);
  if (!hasQuestions) {
    return {
      statusCode: 404,
      errorCode: 'NO_QUESTIONS_AVAILABLE',
      message: 'No quiz questions available for this chapter. Ensure the chapter has a saved transcript and questions have been generated.',
      retryable: false,
    };
  }

  // 5. Fetch questions for the chapter at selected difficulty
  const questions = await deps.quizSessionRepository.getQuestionsForChapter(
    request.chapterId,
    request.difficulty
  );

  if (questions.length === 0) {
    return {
      statusCode: 404,
      errorCode: 'NO_QUESTIONS_AVAILABLE',
      message: `No questions available at ${request.difficulty} difficulty for this chapter`,
      retryable: false,
    };
  }

  // 6. Create session record
  const startedAt = new Date().toISOString();
  const sessionId = await deps.quizSessionRepository.createSession({
    chapterId: request.chapterId,
    learnerId: request.learnerId,
    difficulty: request.difficulty,
    timerMinutes: request.timerMinutes,
    questions,
    startedAt,
  });

  // 7. Return questions without correct answers
  const questionsWithoutAnswers = questions.map(({ correctAnswer, ...q }) => q);

  return {
    success: true,
    sessionId,
    chapterId: request.chapterId,
    difficulty: request.difficulty,
    timerMinutes: request.timerMinutes,
    questions: questionsWithoutAnswers,
    startedAt,
  };
}

/**
 * Handle POST /learn/quiz/submit
 * Submits quiz answers (manual submission or auto-submit on timer expiry).
 */
export async function handleSubmitQuiz(
  request: SubmitQuizRequest,
  deps: QuizSessionDeps
): Promise<SubmitQuizResponse | APIError> {
  // 1. Validate required fields
  if (!request.sessionId || request.sessionId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Session ID is required',
      retryable: false,
    };
  }

  if (!request.learnerId || request.learnerId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Learner ID is required',
      retryable: false,
    };
  }

  if (!Array.isArray(request.answers)) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Answers must be an array',
      retryable: false,
    };
  }

  // 2. Retrieve the session
  const session = await deps.quizSessionRepository.getSessionById(request.sessionId);
  if (!session) {
    return {
      statusCode: 404,
      errorCode: 'SESSION_NOT_FOUND',
      message: 'Quiz session not found',
      retryable: false,
    };
  }

  // 3. Verify session belongs to the learner
  if (session.learnerId !== request.learnerId) {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'This quiz session does not belong to the specified learner',
      retryable: false,
    };
  }

  // 4. Calculate time taken (in seconds)
  const startTime = new Date(session.startedAt).getTime();
  const submitTime = Date.now();
  const timeTakenSeconds = Math.floor((submitTime - startTime) / 1000);

  // 5. Grade answers — build per-question breakdown
  const breakdown: QuestionBreakdown[] = session.questions.map((question) => {
    const answer = request.answers.find((a) => a.questionId === question.questionId);
    const learnerAnswer = answer?.learnerAnswer ?? '';
    const isCorrect = learnerAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

    return {
      questionId: question.questionId,
      questionText: question.questionText,
      learnerAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
    };
  });

  // 6. Calculate score using shared calculator
  const totalQuestions = session.questions.length;
  const correctAnswers = breakdown.filter((b) => b.isCorrect).length;
  const scorePercentage = calculateScorePercentage(correctAnswers, totalQuestions);

  // 7. Persist attempt result
  const completedAt = new Date().toISOString();
  const attemptId = await deps.quizSessionRepository.saveAttemptResult({
    sessionId: request.sessionId,
    chapterId: session.chapterId,
    learnerId: request.learnerId,
    difficulty: session.difficulty,
    totalQuestions,
    correctAnswers,
    scorePercentage,
    timeTakenSeconds,
    breakdown,
    completedAt,
  });

  return {
    success: true,
    attemptId,
    scorePercentage,
    timeTakenSeconds,
    totalQuestions,
    correctAnswers,
    breakdown,
  };
}

/**
 * Handle GET /learn/quiz/results/:attemptId
 * Returns the full results for a completed quiz attempt.
 */
export async function handleGetQuizResults(
  attemptId: string,
  deps: QuizSessionDeps
): Promise<QuizResultsResponse | APIError> {
  if (!attemptId || attemptId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Attempt ID is required',
      retryable: false,
    };
  }

  const attempt = await deps.quizSessionRepository.getAttemptById(attemptId);
  if (!attempt) {
    return {
      statusCode: 404,
      errorCode: 'ATTEMPT_NOT_FOUND',
      message: 'Quiz attempt not found',
      retryable: false,
    };
  }

  return {
    success: true,
    attempt,
  };
}

/**
 * Handle GET /learn/quiz/attempts/:chapterId/:learnerId
 * Returns all attempt summaries for a chapter, with aggregated progress.
 */
export async function handleGetQuizAttempts(
  chapterId: string,
  learnerId: string,
  deps: QuizSessionDeps
): Promise<QuizAttemptsResponse | APIError> {
  if (!chapterId || chapterId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter ID is required',
      retryable: false,
    };
  }

  if (!learnerId || learnerId.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Learner ID is required',
      retryable: false,
    };
  }

  const allAttempts = await deps.quizSessionRepository.getAttemptsForChapter(chapterId, learnerId);

  // Build progress using shared aggregateProgress utility
  const quizAttempts: QuizAttempt[] = allAttempts.map((a) => ({
    scorePercentage: a.scorePercentage,
    completedAt: a.completedAt,
  }));
  const progress = aggregateProgress(quizAttempts);

  // Map to summary items
  const attempts = allAttempts.map((a) => ({
    attemptId: a.attemptId,
    difficulty: a.difficulty,
    scorePercentage: a.scorePercentage,
    timeTakenSeconds: a.timeTakenSeconds,
    completedAt: a.completedAt,
  }));

  return {
    success: true,
    chapterId,
    learnerId,
    progress,
    attempts,
  };
}
