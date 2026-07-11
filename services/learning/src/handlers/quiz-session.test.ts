/**
 * Unit tests for Quiz Session Handler
 *
 * Tests quiz start, submit, get results, and get attempts handlers.
 * Requirements: 13.3, 13.9, 13.10
 */

import {
  handleStartQuiz,
  handleSubmitQuiz,
  handleGetQuizResults,
  handleGetQuizAttempts,
} from './quiz-session';
import type {
  IQuizSessionRepository,
  QuizSessionDeps,
  QuizQuestion,
  QuizSessionRecord,
  QuizAttemptResult,
  StartQuizRequest,
  SubmitQuizRequest,
} from './quiz-session';
import type { APIError } from '@chikumiku/types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function buildQuestions(count = 3): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    questionId: `q-${i + 1}`,
    questionText: `What is ${i + 1}+${i + 1}?`,
    questionType: 'multiple-choice',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
  }));
}

function buildSession(overrides?: Partial<QuizSessionRecord>): QuizSessionRecord {
  return {
    sessionId: 'session-001',
    chapterId: 'chapter-001',
    learnerId: 'learner-001',
    difficulty: 'Medium',
    timerMinutes: 15,
    questions: buildQuestions(),
    startedAt: '2024-06-15T10:00:00.000Z',
    ...overrides,
  };
}

function buildAttemptResult(overrides?: Partial<QuizAttemptResult>): QuizAttemptResult {
  return {
    attemptId: 'attempt-001',
    sessionId: 'session-001',
    chapterId: 'chapter-001',
    learnerId: 'learner-001',
    difficulty: 'Medium',
    totalQuestions: 3,
    correctAnswers: 2,
    scorePercentage: 66,
    timeTakenSeconds: 120,
    breakdown: [
      { questionId: 'q-1', questionText: 'Q1', learnerAnswer: 'B', correctAnswer: 'B', isCorrect: true },
      { questionId: 'q-2', questionText: 'Q2', learnerAnswer: 'B', correctAnswer: 'B', isCorrect: true },
      { questionId: 'q-3', questionText: 'Q3', learnerAnswer: 'A', correctAnswer: 'B', isCorrect: false },
    ],
    completedAt: '2024-06-15T10:02:00.000Z',
    ...overrides,
  };
}

function createMockRepository(overrides?: Partial<IQuizSessionRepository>): IQuizSessionRepository {
  return {
    chapterHasQuestions: jest.fn().mockResolvedValue(true),
    getQuestionsForChapter: jest.fn().mockResolvedValue(buildQuestions()),
    createSession: jest.fn().mockResolvedValue('session-001'),
    getSessionById: jest.fn().mockResolvedValue(buildSession()),
    saveAttemptResult: jest.fn().mockResolvedValue('attempt-001'),
    getAttemptById: jest.fn().mockResolvedValue(buildAttemptResult()),
    getAttemptsForChapter: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function createDeps(repoOverrides?: Partial<IQuizSessionRepository>): QuizSessionDeps {
  return { quizSessionRepository: createMockRepository(repoOverrides) };
}

function buildStartRequest(overrides?: Partial<StartQuizRequest>): StartQuizRequest {
  return {
    chapterId: 'chapter-001',
    learnerId: 'learner-001',
    difficulty: 'Medium',
    timerMinutes: 15,
    ...overrides,
  };
}

function buildSubmitRequest(overrides?: Partial<SubmitQuizRequest>): SubmitQuizRequest {
  return {
    sessionId: 'session-001',
    learnerId: 'learner-001',
    answers: [
      { questionId: 'q-1', learnerAnswer: 'B' },
      { questionId: 'q-2', learnerAnswer: 'B' },
      { questionId: 'q-3', learnerAnswer: 'A' },
    ],
    auto: false,
    ...overrides,
  };
}

// ─── handleStartQuiz ─────────────────────────────────────────────────────────

describe('handleStartQuiz', () => {
  describe('input validation', () => {
    it('returns 400 when chapterId is empty', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ chapterId: '' }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('Chapter ID');
    });

    it('returns 400 when learnerId is empty', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ learnerId: '' }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('Learner ID');
    });

    it('returns 400 for invalid difficulty', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ difficulty: 'Extreme' as any }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('Difficulty');
    });

    it('returns 400 for invalid timer (not multiple of 5)', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ timerMinutes: 7 }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('timer');
    });

    it('returns 400 for timer below minimum (< 5)', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ timerMinutes: 3 }), deps);
      expect((result as APIError).statusCode).toBe(400);
    });

    it('returns 400 for timer above maximum (> 120)', async () => {
      const deps = createDeps();
      const result = await handleStartQuiz(buildStartRequest({ timerMinutes: 125 }), deps);
      expect((result as APIError).statusCode).toBe(400);
    });
  });

  describe('chapter without questions', () => {
    it('returns 404 when chapter has no questions at all', async () => {
      const deps = createDeps({ chapterHasQuestions: jest.fn().mockResolvedValue(false) });
      const result = await handleStartQuiz(buildStartRequest(), deps);
      expect((result as APIError).statusCode).toBe(404);
      expect((result as APIError).errorCode).toBe('NO_QUESTIONS_AVAILABLE');
    });

    it('returns 404 when no questions exist at the selected difficulty', async () => {
      const deps = createDeps({
        chapterHasQuestions: jest.fn().mockResolvedValue(true),
        getQuestionsForChapter: jest.fn().mockResolvedValue([]),
      });
      const result = await handleStartQuiz(buildStartRequest(), deps);
      expect((result as APIError).statusCode).toBe(404);
      expect((result as APIError).errorCode).toBe('NO_QUESTIONS_AVAILABLE');
    });
  });

  describe('successful quiz start', () => {
    it('returns success with session details and questions without answers', async () => {
      const questions = buildQuestions(2);
      const deps = createDeps({
        getQuestionsForChapter: jest.fn().mockResolvedValue(questions),
        createSession: jest.fn().mockResolvedValue('session-xyz'),
      });

      const result = await handleStartQuiz(buildStartRequest({ difficulty: 'Easy', timerMinutes: 10 }), deps);

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;

      expect(result.sessionId).toBe('session-xyz');
      expect(result.difficulty).toBe('Easy');
      expect(result.timerMinutes).toBe(10);
      expect(result.questions).toHaveLength(2);
      // Ensure correctAnswer is not leaked
      result.questions.forEach((q) => {
        expect(q).not.toHaveProperty('correctAnswer');
        expect(q).toHaveProperty('questionId');
        expect(q).toHaveProperty('questionText');
      });
    });

    it('persists the session via the repository', async () => {
      const createSession = jest.fn().mockResolvedValue('session-new');
      const deps = createDeps({ createSession });

      await handleStartQuiz(buildStartRequest(), deps);

      expect(createSession).toHaveBeenCalledTimes(1);
      const arg = createSession.mock.calls[0][0];
      expect(arg.chapterId).toBe('chapter-001');
      expect(arg.learnerId).toBe('learner-001');
      expect(arg.difficulty).toBe('Medium');
      expect(arg.timerMinutes).toBe(15);
      expect(arg.questions).toHaveLength(3);
    });
  });
});

// ─── handleSubmitQuiz ────────────────────────────────────────────────────────

describe('handleSubmitQuiz', () => {
  describe('input validation', () => {
    it('returns 400 when sessionId is empty', async () => {
      const deps = createDeps();
      const result = await handleSubmitQuiz(buildSubmitRequest({ sessionId: '' }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('Session ID');
    });

    it('returns 400 when learnerId is empty', async () => {
      const deps = createDeps();
      const result = await handleSubmitQuiz(buildSubmitRequest({ learnerId: '' }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('Learner ID');
    });

    it('returns 400 when answers is not an array', async () => {
      const deps = createDeps();
      const result = await handleSubmitQuiz(buildSubmitRequest({ answers: 'not-array' as any }), deps);
      expect((result as APIError).statusCode).toBe(400);
      expect((result as APIError).message).toContain('array');
    });
  });

  describe('session lookup', () => {
    it('returns 404 when session is not found', async () => {
      const deps = createDeps({ getSessionById: jest.fn().mockResolvedValue(null) });
      const result = await handleSubmitQuiz(buildSubmitRequest(), deps);
      expect((result as APIError).statusCode).toBe(404);
      expect((result as APIError).errorCode).toBe('SESSION_NOT_FOUND');
    });

    it('returns 403 when session belongs to a different learner', async () => {
      const session = buildSession({ learnerId: 'learner-other' });
      const deps = createDeps({ getSessionById: jest.fn().mockResolvedValue(session) });
      const result = await handleSubmitQuiz(buildSubmitRequest({ learnerId: 'learner-001' }), deps);
      expect((result as APIError).statusCode).toBe(403);
      expect((result as APIError).errorCode).toBe('FORBIDDEN');
    });
  });

  describe('successful quiz submission', () => {
    it('calculates score correctly for fully correct answers', async () => {
      const questions = buildQuestions(3); // all have correctAnswer = 'B'
      const session = buildSession({ questions });
      const deps = createDeps({
        getSessionById: jest.fn().mockResolvedValue(session),
        saveAttemptResult: jest.fn().mockResolvedValue('attempt-100'),
      });

      const allCorrectAnswers = questions.map((q) => ({
        questionId: q.questionId,
        learnerAnswer: 'B',
      }));

      const result = await handleSubmitQuiz(
        buildSubmitRequest({ answers: allCorrectAnswers }),
        deps,
      );

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;

      expect(result.attemptId).toBe('attempt-100');
      expect(result.totalQuestions).toBe(3);
      expect(result.correctAnswers).toBe(3);
      expect(result.scorePercentage).toBe(100);
      expect(result.breakdown.every((b) => b.isCorrect)).toBe(true);
    });

    it('calculates floor-based score for partial answers', async () => {
      // 2 out of 3 correct = floor(66.66) = 66
      const questions = buildQuestions(3);
      const session = buildSession({ questions });
      const deps = createDeps({
        getSessionById: jest.fn().mockResolvedValue(session),
        saveAttemptResult: jest.fn().mockResolvedValue('attempt-200'),
      });

      const result = await handleSubmitQuiz(buildSubmitRequest(), deps);

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;

      expect(result.correctAnswers).toBe(2);
      expect(result.scorePercentage).toBe(66); // floor(2/3 * 100)
    });

    it('tracks time taken in seconds', async () => {
      const startTime = new Date('2024-06-15T10:00:00.000Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 90_000); // 90 seconds later

      const session = buildSession({ startedAt: '2024-06-15T10:00:00.000Z' });
      const deps = createDeps({
        getSessionById: jest.fn().mockResolvedValue(session),
        saveAttemptResult: jest.fn().mockResolvedValue('attempt-300'),
      });

      const result = await handleSubmitQuiz(buildSubmitRequest(), deps);

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;

      expect(result.timeTakenSeconds).toBe(90);

      jest.restoreAllMocks();
    });

    it('handles unanswered questions as empty string (marked incorrect)', async () => {
      const questions = buildQuestions(3);
      const session = buildSession({ questions });
      const deps = createDeps({
        getSessionById: jest.fn().mockResolvedValue(session),
        saveAttemptResult: jest.fn().mockResolvedValue('attempt-400'),
      });

      // Only answer one question, leave others unanswered
      const result = await handleSubmitQuiz(
        buildSubmitRequest({ answers: [{ questionId: 'q-1', learnerAnswer: 'B' }] }),
        deps,
      );

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;

      expect(result.correctAnswers).toBe(1);
      expect(result.totalQuestions).toBe(3);
      // Unanswered questions have learnerAnswer = '' and isCorrect = false
      const unanswered = result.breakdown.filter((b) => b.learnerAnswer === '');
      expect(unanswered).toHaveLength(2);
      expect(unanswered.every((b) => !b.isCorrect)).toBe(true);
    });
  });

  describe('auto-submit scenario', () => {
    it('processes auto-submit identically to manual submit', async () => {
      const session = buildSession();
      const saveAttemptResult = jest.fn().mockResolvedValue('attempt-auto');
      const deps = createDeps({
        getSessionById: jest.fn().mockResolvedValue(session),
        saveAttemptResult,
      });

      const result = await handleSubmitQuiz(
        buildSubmitRequest({ auto: true }),
        deps,
      );

      expect('success' in result && result.success).toBe(true);
      if (!('success' in result)) return;
      expect(result.attemptId).toBe('attempt-auto');
    });
  });
});

// ─── handleGetQuizResults ────────────────────────────────────────────────────

describe('handleGetQuizResults', () => {
  it('returns 400 when attemptId is empty', async () => {
    const deps = createDeps();
    const result = await handleGetQuizResults('', deps);
    expect((result as APIError).statusCode).toBe(400);
    expect((result as APIError).message).toContain('Attempt ID');
  });

  it('returns 404 when attempt is not found', async () => {
    const deps = createDeps({ getAttemptById: jest.fn().mockResolvedValue(null) });
    const result = await handleGetQuizResults('attempt-missing', deps);
    expect((result as APIError).statusCode).toBe(404);
    expect((result as APIError).errorCode).toBe('ATTEMPT_NOT_FOUND');
  });

  it('returns the full attempt result on success', async () => {
    const attempt = buildAttemptResult({ attemptId: 'attempt-xyz' });
    const deps = createDeps({ getAttemptById: jest.fn().mockResolvedValue(attempt) });

    const result = await handleGetQuizResults('attempt-xyz', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    expect(result.attempt.attemptId).toBe('attempt-xyz');
    expect(result.attempt.scorePercentage).toBe(66);
    expect(result.attempt.breakdown).toHaveLength(3);
  });
});

// ─── handleGetQuizAttempts ───────────────────────────────────────────────────

describe('handleGetQuizAttempts', () => {
  it('returns 400 when chapterId is empty', async () => {
    const deps = createDeps();
    const result = await handleGetQuizAttempts('', 'learner-001', deps);
    expect((result as APIError).statusCode).toBe(400);
    expect((result as APIError).message).toContain('Chapter ID');
  });

  it('returns 400 when learnerId is empty', async () => {
    const deps = createDeps();
    const result = await handleGetQuizAttempts('chapter-001', '', deps);
    expect((result as APIError).statusCode).toBe(400);
    expect((result as APIError).message).toContain('Learner ID');
  });

  it('returns empty progress when no attempts exist', async () => {
    const deps = createDeps({ getAttemptsForChapter: jest.fn().mockResolvedValue([]) });

    const result = await handleGetQuizAttempts('chapter-001', 'learner-001', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    expect(result.progress.attemptCount).toBe(0);
    expect(result.progress.highestScore).toBe(0);
    expect(result.progress.mostRecentScore).toBe(0);
    expect(result.attempts).toEqual([]);
  });

  it('aggregates progress correctly with multiple attempts', async () => {
    const attempts: QuizAttemptResult[] = [
      buildAttemptResult({
        attemptId: 'a-1',
        scorePercentage: 50,
        timeTakenSeconds: 60,
        completedAt: '2024-06-15T10:00:00Z',
      }),
      buildAttemptResult({
        attemptId: 'a-2',
        scorePercentage: 80,
        timeTakenSeconds: 90,
        completedAt: '2024-06-16T10:00:00Z',
      }),
      buildAttemptResult({
        attemptId: 'a-3',
        scorePercentage: 65,
        timeTakenSeconds: 75,
        completedAt: '2024-06-17T10:00:00Z',
      }),
    ];

    const deps = createDeps({ getAttemptsForChapter: jest.fn().mockResolvedValue(attempts) });

    const result = await handleGetQuizAttempts('chapter-001', 'learner-001', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    expect(result.progress.attemptCount).toBe(3);
    expect(result.progress.highestScore).toBe(80);
    expect(result.progress.mostRecentScore).toBe(65); // most recent by completedAt
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0].attemptId).toBe('a-1');
  });

  it('returns attempt summaries without breakdown details', async () => {
    const attempts = [buildAttemptResult({ attemptId: 'a-1', difficulty: 'Hard' })];
    const deps = createDeps({ getAttemptsForChapter: jest.fn().mockResolvedValue(attempts) });

    const result = await handleGetQuizAttempts('chapter-001', 'learner-001', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    const summary = result.attempts[0];
    expect(summary.attemptId).toBe('a-1');
    expect(summary.difficulty).toBe('Hard');
    expect(summary.scorePercentage).toBeDefined();
    expect(summary.timeTakenSeconds).toBeDefined();
    expect(summary.completedAt).toBeDefined();
    // Summaries should not include the full breakdown
    expect((summary as any).breakdown).toBeUndefined();
  });
});
