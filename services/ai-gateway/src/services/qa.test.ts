/**
 * Tests for Q&A Service with RAG (GPT-5 Mini + pgvector).
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 25.4
 */

import type { QARequest, RAGContext } from '@chikumiku/types';
import type { ILLMClient } from './explanation';
import type { IEmbeddingClient, IEmbeddingRepository, EmbeddingDeps } from './embedding';
import {
  validateQuestion,
  isMultiStepQuestion,
  buildQAPrompt,
  parseStepByStepResponse,
  handleQARequest,
  withGenerationTimeout,
  isQAError,
} from './qa';
import type { QADeps, QASession, IQASessionRepository } from './qa';

// --- Test Helpers ---

function createMockEmbeddingClient(): IEmbeddingClient {
  return {
    embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };
}

function createMockEmbeddingRepo(
  searchResults: { content: string; score: number }[] = []
): IEmbeddingRepository {
  return {
    store: jest.fn().mockResolvedValue(undefined),
    deleteByChapter: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue(searchResults),
  };
}

function createMockLLMClient(response: string = 'Test answer'): ILLMClient {
  return {
    generate: jest.fn().mockResolvedValue(response),
  };
}

function createMockSessionRepo(session: QASession | null = null): IQASessionRepository {
  return {
    getSession: jest.fn().mockResolvedValue(session),
    updateSession: jest.fn().mockResolvedValue(undefined),
  };
}

function createDeps(overrides?: {
  llmResponse?: string;
  searchResults?: { content: string; score: number }[];
  session?: QASession | null;
}): QADeps {
  const searchResults = overrides?.searchResults ?? [
    { content: 'Photosynthesis is the process by which plants convert sunlight.', score: 0.85 },
    { content: 'Plants use chlorophyll to absorb light energy.', score: 0.75 },
    { content: 'The process produces oxygen and glucose.', score: 0.70 },
  ];

  const embeddingDeps: EmbeddingDeps = {
    embeddingClient: createMockEmbeddingClient(),
    embeddingRepo: createMockEmbeddingRepo(searchResults),
  };

  return {
    llmClient: createMockLLMClient(overrides?.llmResponse ?? 'Plants use sunlight to make food.'),
    embeddingDeps,
    sessionRepo: createMockSessionRepo(overrides?.session ?? null),
  };
}

function createQARequest(overrides?: Partial<QARequest>): QARequest {
  return {
    chapterId: 'chapter-1',
    question: 'What is photosynthesis?',
    sessionContext: [],
    gradeLevel: '5th',
    ...overrides,
  };
}

// --- Tests ---

describe('Q&A Service', () => {
  describe('validateQuestion', () => {
    it('should return null for valid question within bounds', () => {
      expect(validateQuestion('What is photosynthesis?')).toBeNull();
    });

    it('should return null for a single character question', () => {
      expect(validateQuestion('A')).toBeNull();
    });

    it('should return null for exactly 500 character question', () => {
      const question = 'x'.repeat(500);
      expect(validateQuestion(question)).toBeNull();
    });

    it('should reject empty string', () => {
      const result = validateQuestion('');
      expect(result).not.toBeNull();
      expect(result!.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should reject whitespace-only string', () => {
      const result = validateQuestion('   ');
      expect(result).not.toBeNull();
      expect(result!.code).toBe('CONSTRAINT_VIOLATION');
    });

    it('should reject question exceeding 500 characters', () => {
      const question = 'x'.repeat(501);
      const result = validateQuestion(question);
      expect(result).not.toBeNull();
      expect(result!.code).toBe('CONSTRAINT_VIOLATION');
      expect(result!.message).toContain('500');
    });
  });

  describe('isMultiStepQuestion', () => {
    it('should detect "how to" questions', () => {
      expect(isMultiStepQuestion('How to solve a quadratic equation?')).toBe(true);
    });

    it('should detect "calculate" questions', () => {
      expect(isMultiStepQuestion('Calculate the area of a triangle')).toBe(true);
    });

    it('should detect "solve" questions', () => {
      expect(isMultiStepQuestion('Solve for x in 2x + 3 = 7')).toBe(true);
    });

    it('should detect "step by step" requests', () => {
      expect(isMultiStepQuestion('Show me steps to factor a polynomial')).toBe(true);
    });

    it('should detect "derive" questions', () => {
      expect(isMultiStepQuestion('Derive the formula for acceleration')).toBe(true);
    });

    it('should not flag simple factual questions', () => {
      expect(isMultiStepQuestion('What is the capital of France?')).toBe(false);
    });

    it('should not flag definition questions', () => {
      expect(isMultiStepQuestion('Define photosynthesis')).toBe(false);
    });
  });

  describe('buildQAPrompt', () => {
    it('should include grade-level adaptation for simple grades', () => {
      const context: RAGContext = {
        paragraphs: ['Plants make food from sunlight.'],
        similarity_scores: [0.9],
      };
      const prompt = buildQAPrompt('What do plants eat?', context, [], 'LKG');
      expect(prompt).toContain('simple words');
      expect(prompt).toContain('kindergartener');
    });

    it('should include grade-level adaptation for moderate grades', () => {
      const context: RAGContext = {
        paragraphs: ['Photosynthesis converts light energy.'],
        similarity_scores: [0.8],
      };
      const prompt = buildQAPrompt('What is photosynthesis?', context, [], '4th');
      expect(prompt).toContain('straightforward language');
    });

    it('should include grade-level adaptation for advanced grades', () => {
      const context: RAGContext = {
        paragraphs: ['Photosynthesis involves light-dependent reactions.'],
        similarity_scores: [0.85],
      };
      const prompt = buildQAPrompt('Explain the Calvin cycle', context, [], '10th');
      expect(prompt).toContain('academic language');
    });

    it('should include RAG context paragraphs', () => {
      const context: RAGContext = {
        paragraphs: ['Paragraph one content.', 'Paragraph two content.'],
        similarity_scores: [0.9, 0.8],
      };
      const prompt = buildQAPrompt('Test question?', context, [], '5th');
      expect(prompt).toContain('Paragraph one content.');
      expect(prompt).toContain('Paragraph two content.');
    });

    it('should include session history for follow-ups', () => {
      const context: RAGContext = { paragraphs: ['Content.'], similarity_scores: [0.9] };
      const history = ['Q: What is a cell?\nA: A cell is the basic unit of life.'];
      const prompt = buildQAPrompt('Tell me more about cells', context, history, '6th');
      expect(prompt).toContain('What is a cell?');
    });

    it('should add step-by-step instruction for multi-step questions', () => {
      const context: RAGContext = { paragraphs: ['Math content.'], similarity_scores: [0.9] };
      const prompt = buildQAPrompt('How to solve 2x + 3 = 7?', context, [], '7th');
      expect(prompt).toContain('step-by-step');
    });
  });

  describe('parseStepByStepResponse', () => {
    it('should extract numbered steps', () => {
      const response = '1. Subtract 3 from both sides\n2. Divide by 2\n3. x = 2';
      const result = parseStepByStepResponse(response);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0]).toContain('Subtract 3');
    });

    it('should return empty steps for non-step responses', () => {
      const response = 'The answer is 42.';
      const result = parseStepByStepResponse(response);
      expect(result.steps).toHaveLength(0);
      expect(result.plainAnswer).toBe('The answer is 42.');
    });

    it('should handle bullet point steps', () => {
      const response = '- First do this\n- Then do that\n- Finally finish';
      const result = parseStepByStepResponse(response);
      expect(result.steps).toHaveLength(3);
    });
  });

  describe('handleQARequest', () => {
    it('should reject question exceeding 500 characters', async () => {
      const deps = createDeps();
      const request = createQARequest({ question: 'x'.repeat(501) });

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should reject empty question', async () => {
      const deps = createDeps();
      const request = createQARequest({ question: '' });

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('CONSTRAINT_VIOLATION');
      }
    });

    it('should return NO_CONTENT when no relevant paragraphs found', async () => {
      const deps = createDeps({
        searchResults: [
          { content: 'Unrelated content.', score: 0.1 },
        ],
      });
      const request = createQARequest();

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('NO_CONTENT');
      }
    });

    it('should return NO_CONTENT when search returns empty results', async () => {
      const deps = createDeps({ searchResults: [] });
      const request = createQARequest();

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('NO_CONTENT');
      }
    });

    it('should generate a successful answer with RAG context', async () => {
      const deps = createDeps({
        llmResponse: 'Photosynthesis is how plants make food using sunlight.',
      });
      const request = createQARequest();

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(false);
      if (!isQAError(result)) {
        expect(result.answer).toContain('Photosynthesis');
        expect(result.contextUsed).toBeGreaterThan(0);
      }
    });

    it('should detect multi-step questions and parse steps', async () => {
      const deps = createDeps({
        llmResponse: '1. First subtract 3\n2. Then divide by 2\n3. The answer is x = 2',
      });
      const request = createQARequest({ question: 'How to solve 2x + 3 = 7?' });

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(false);
      if (!isQAError(result)) {
        expect(result.isStepByStep).toBe(true);
        expect(result.steps).toBeDefined();
        expect(result.steps!.length).toBeGreaterThan(1);
      }
    });

    it('should update session context after successful answer', async () => {
      const deps = createDeps();
      const request = createQARequest();

      await handleQARequest(request, 'session-1', deps);

      expect(deps.sessionRepo.updateSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          chapterId: 'chapter-1',
          questionCount: 1,
          contextHistory: expect.arrayContaining([expect.stringContaining('Q:')]),
        })
      );
    });

    it('should maintain session context up to 20 follow-ups', async () => {
      const existingHistory = Array.from(
        { length: 20 },
        (_, i) => `Q: Question ${i}\nA: Answer ${i}`
      );
      const deps = createDeps({
        session: {
          chapterId: 'chapter-1',
          questionCount: 20,
          contextHistory: existingHistory,
        },
      });
      const request = createQARequest({ question: 'Follow-up question?' });

      await handleQARequest(request, 'session-1', deps);

      const updateCall = (deps.sessionRepo.updateSession as jest.Mock).mock.calls[0];
      const updatedSession = updateCall[1] as QASession;
      expect(updatedSession.contextHistory.length).toBeLessThanOrEqual(20);
      expect(updatedSession.questionCount).toBe(21);
    });

    it('should return GENERATION_FAILED when LLM throws', async () => {
      const deps = createDeps();
      (deps.llmClient.generate as jest.Mock).mockRejectedValue(new Error('LLM error'));
      const request = createQARequest();

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('GENERATION_FAILED');
      }
    });

    it('should return GENERATION_FAILED when embedding search throws', async () => {
      const deps = createDeps();
      (deps.embeddingDeps.embeddingClient.embed as jest.Mock).mockRejectedValue(
        new Error('Embedding error')
      );
      const request = createQARequest();

      const result = await handleQARequest(request, 'session-1', deps);

      expect(isQAError(result)).toBe(true);
      if (isQAError(result)) {
        expect(result.code).toBe('GENERATION_FAILED');
      }
    });

    it('should adapt answer to grade level via prompt', async () => {
      const deps = createDeps();
      const request = createQARequest({ gradeLevel: 'LKG' });

      await handleQARequest(request, 'session-1', deps);

      const generateCall = (deps.llmClient.generate as jest.Mock).mock.calls[0];
      const prompt = generateCall[0] as string;
      expect(prompt).toContain('simple words');
    });
  });

  describe('withGenerationTimeout', () => {
    it('should resolve if promise completes before timeout', async () => {
      const result = await withGenerationTimeout(
        Promise.resolve('done'),
        1000
      );
      expect(result).toBe('done');
    });

    it('should reject if promise exceeds timeout', async () => {
      const slowPromise = new Promise<string>(resolve => {
        setTimeout(() => resolve('too late'), 200);
      });

      await expect(
        withGenerationTimeout(slowPromise, 50)
      ).rejects.toThrow('timed out');
    });

    it('should propagate original error if promise rejects before timeout', async () => {
      await expect(
        withGenerationTimeout(Promise.reject(new Error('original')), 1000)
      ).rejects.toThrow('original');
    });
  });

  describe('isQAError', () => {
    it('should identify QAError objects', () => {
      expect(isQAError({ code: 'NO_CONTENT', message: 'test' })).toBe(true);
    });

    it('should not identify QAResponse objects as errors', () => {
      expect(isQAError({ answer: 'test', isStepByStep: false, contextUsed: 3 })).toBe(false);
    });
  });
});
