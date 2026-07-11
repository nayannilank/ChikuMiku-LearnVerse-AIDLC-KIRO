/**
 * Integration tests for AI Gateway ↔ external AI services.
 * Verifies the full pipeline with mocked external services:
 * request → cache check → circuit breaker → external call → response caching.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import type { AIRequest } from '@chikumiku/types';
import type { ICacheRepository, CacheEntry } from '../../ai-gateway/src/cache';
import type { IRateLimitRepository, RateLimitRecord } from '../../ai-gateway/src/rate-limiter';
import type { ICostRepository, CostRecord } from '../../ai-gateway/src/cost-tracker';
import type { ISecretsManagerClient, SecretName } from '../../ai-gateway/src/clients/secrets-manager';
import type { IAIServiceClient, GatewayHandlerDeps } from '../../ai-gateway/src/handlers/gateway';
import { handleAIRequest } from '../../ai-gateway/src/handlers/gateway';
import { createServiceCircuitBreakers } from '../../ai-gateway/src/circuit-breaker';
import { buildCacheKey } from '../../ai-gateway/src/cache';

// --- Mock Infrastructure ---

function createMockCacheRepo(
  initialEntries: Map<string, CacheEntry> = new Map()
): ICacheRepository & { setCalls: CacheEntry[] } {
  const entries = new Map(initialEntries);
  const setCalls: CacheEntry[] = [];

  return {
    setCalls,
    async get(cacheKey: string) {
      return entries.get(cacheKey) ?? null;
    },
    async set(entry: CacheEntry) {
      setCalls.push(entry);
      entries.set(entry.cacheKey, entry);
    },
    async invalidateByChapter() {},
  };
}

function createMockRateLimitRepo(): IRateLimitRepository {
  return {
    async getRecord() { return null; },
    async incrementOrCreate(key: string): Promise<RateLimitRecord> {
      return { key, requestCount: 1, windowStart: new Date().toISOString() };
    },
  };
}

function createMockCostRepo(): ICostRepository & { records: CostRecord[] } {
  const records: CostRecord[] = [];
  return {
    records,
    async record(entry: CostRecord) { records.push(entry); },
    async getSummary() {
      return { totalCostUsd: 0, totalRequests: 0, cacheHitRate: 0, costByType: {} };
    },
  };
}

function createMockSecretsManager(keys?: Record<string, string>): ISecretsManagerClient {
  const defaultKeys: Record<string, string> = {
    'google-vision-api-key': 'mock-google-vision-key',
    'openai-api-key': 'mock-openai-key',
    'google-tts-api-key': 'mock-google-tts-key',
    'whisper-api-key': 'mock-whisper-key',
  };
  const allKeys = { ...defaultKeys, ...keys };

  return {
    async getSecret(name: SecretName) {
      return allKeys[name] || 'mock-key';
    },
  };
}

interface AIServiceCall {
  type: AIRequest['type'];
  payload: Record<string, unknown>;
  apiKey: string;
  options?: { gradeLevel?: string; chapterId?: string };
}

function createMockAIClient(
  responses: Record<string, unknown> = {},
  behavior: 'success' | 'always-fail' = 'success'
): IAIServiceClient & { calls: AIServiceCall[] } {
  const calls: AIServiceCall[] = [];
  const defaultResponses: Record<string, unknown> = {
    ocr: { text: 'Extracted text from page image using Google Vision', confidence: 0.95 },
    explain: { summary: 'AI-generated explanation', keywords: ['concept1', 'concept2'], concepts: ['main idea'] },
    pronunciation: { score: 85, syllables: [{ text: 'pho', score: 90 }, { text: 'to', score: 80 }] },
    grammar: { exercises: [{ type: 'fill-in-blank', sentence: 'The ___ is green.', answer: 'grass' }] },
    revision: { questions: [{ type: 'mcq', question: 'What is photosynthesis?', options: ['A', 'B', 'C', 'D'], answer: 'A' }] },
    ...responses,
  };

  return {
    calls,
    async invoke(type, payload, apiKey, options) {
      calls.push({ type, payload, apiKey, options });
      if (behavior === 'always-fail') {
        throw new Error(`External AI service ${type} unavailable`);
      }
      return defaultResponses[type] || { result: 'ok' };
    },
  };
}

function createTestRequest(type: AIRequest['type'], overrides?: Partial<AIRequest>): AIRequest {
  return {
    type,
    chapterId: 'chapter-ext-001',
    payload: { text: 'Photosynthesis converts sunlight into chemical energy.' },
    learnerId: 'learner-ext-001',
    gradeLevel: '7th',
    ...overrides,
  };
}

function buildDeps(overrides?: Partial<GatewayHandlerDeps>): GatewayHandlerDeps {
  return {
    cacheRepo: createMockCacheRepo(),
    rateLimitRepo: createMockRateLimitRepo(),
    costRepo: createMockCostRepo(),
    secretsManager: createMockSecretsManager(),
    aiServiceClient: createMockAIClient(),
    circuitBreakers: createServiceCircuitBreakers({
      failureThreshold: 3,
      maxRetries: 3,
      baseDelayMs: 1,
      maxJitterMs: 1,
      resetTimeoutMs: 50,
    }),
    ...overrides,
  };
}

// --- Tests ---

describe('AI Gateway → External Services Integration Tests', () => {
  describe('Google Vision OCR processing pipeline', () => {
    it('processes OCR request through full pipeline and caches result', async () => {
      const cacheRepo = createMockCacheRepo();
      const aiClient = createMockAIClient({
        ocr: { text: 'Chapter 5: Cell Biology\nCells are the basic unit of life.', confidence: 0.97 },
      });
      const costRepo = createMockCostRepo();
      const deps = buildDeps({ cacheRepo, aiServiceClient: aiClient, costRepo });

      const request = createTestRequest('ocr', {
        payload: { imageS3Key: 'pages/ch-001/1_content.jpeg', pageNumber: 1 },
      });

      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(false);
      expect(result.data).toEqual({
        text: 'Chapter 5: Cell Biology\nCells are the basic unit of life.',
        confidence: 0.97,
      });

      // Verify correct API key was fetched
      expect(aiClient.calls).toHaveLength(1);
      expect(aiClient.calls[0].type).toBe('ocr');
      expect(aiClient.calls[0].apiKey).toBe('mock-google-vision-key');

      // Verify result was cached
      expect(cacheRepo.setCalls).toHaveLength(1);
      expect(cacheRepo.setCalls[0].requestType).toBe('ocr');
    });
  });

  describe('GPT-5 Mini explanation generation', () => {
    it('generates explanation with grade-level adaptation', async () => {
      const aiClient = createMockAIClient({
        explain: {
          summary: 'Simple explanation for 3rd grader',
          keywords: ['plant', 'sun', 'food'],
          concepts: ['Plants make food using sunlight'],
        },
      });
      const deps = buildDeps({ aiServiceClient: aiClient });

      const request = createTestRequest('explain', {
        gradeLevel: '3rd',
        payload: { text: 'Photosynthesis is the biochemical process...' },
      });

      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        summary: 'Simple explanation for 3rd grader',
        keywords: ['plant', 'sun', 'food'],
        concepts: ['Plants make food using sunlight'],
      });

      // Verify grade level was passed to the AI client
      expect(aiClient.calls[0].options?.gradeLevel).toBe('3rd');
      expect(aiClient.calls[0].options?.chapterId).toBe('chapter-ext-001');
    });
  });

  describe('Whisper STT pronunciation scoring', () => {
    it('processes pronunciation audio and returns syllable scores', async () => {
      const aiClient = createMockAIClient({
        stt: {
          score: 78,
          syllables: [
            { text: 'pho', score: 90, color: 'green' },
            { text: 'to', score: 65, color: 'yellow' },
            { text: 'syn', score: 70, color: 'yellow' },
            { text: 'the', score: 55, color: 'red' },
            { text: 'sis', score: 80, color: 'green' },
          ],
        },
      });
      const deps = buildDeps({ aiServiceClient: aiClient });

      const request = createTestRequest('stt', {
        payload: { audioData: 'base64-encoded-audio', word: 'photosynthesis' },
      });

      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect((result.data as Record<string, unknown>).score).toBe(78);
      expect((result.data as { syllables: unknown[] }).syllables).toHaveLength(5);
    });
  });

  describe('Cache behavior', () => {
    it('returns cached result without calling external service on cache hit', async () => {
      const request = createTestRequest('explain');
      const cachedData = { summary: 'Previously cached explanation', keywords: ['cached'] };
      const cacheKey = buildCacheKey(request);

      const entries = new Map<string, CacheEntry>();
      entries.set(cacheKey, {
        cacheKey,
        requestType: 'explain',
        chapterId: request.chapterId,
        contentHash: 'hash-cached',
        responseData: cachedData,
        createdAt: new Date().toISOString(),
      });

      const cacheRepo = createMockCacheRepo(entries);
      const aiClient = createMockAIClient();
      const deps = buildDeps({ cacheRepo, aiServiceClient: aiClient });

      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(true);
      expect(result.data).toEqual(cachedData);
      // No external call made
      expect(aiClient.calls).toHaveLength(0);
    });

    it('calls external service on cache miss and stores result', async () => {
      const cacheRepo = createMockCacheRepo();
      const aiClient = createMockAIClient();
      const deps = buildDeps({ cacheRepo, aiServiceClient: aiClient });

      const request = createTestRequest('explain');
      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(false);
      expect(aiClient.calls).toHaveLength(1);
      expect(cacheRepo.setCalls).toHaveLength(1);
    });
  });

  describe('Circuit breaker triggers after failures', () => {
    it('opens circuit after consecutive external service failures', async () => {
      const aiClient = createMockAIClient({}, 'always-fail');
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 3,
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
        resetTimeoutMs: 10_000,
      });

      const deps = buildDeps({ aiServiceClient: aiClient, circuitBreakers });
      const request = createTestRequest('explain');

      // First request fails after retries, opens circuit
      const firstResult = await handleAIRequest(request, deps);
      expect(firstResult.success).toBe(false);
      expect(firstResult.error?.code).toBe('SERVICE_UNAVAILABLE');

      // Circuit is now OPEN
      expect(circuitBreakers['explain'].state).toBe('OPEN');

      // Second request immediately rejected (circuit open)
      const freshClient = createMockAIClient();
      const deps2 = buildDeps({ aiServiceClient: freshClient, circuitBreakers });
      const secondResult = await handleAIRequest(request, deps2);

      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe('SERVICE_UNAVAILABLE');
      expect(secondResult.error?.message).toContain('circuit open');
      expect(freshClient.calls).toHaveLength(0);
    });

    it('recovers after reset timeout (HALF_OPEN → CLOSED)', async () => {
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 3,
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
        resetTimeoutMs: 50,
      });

      // Open the circuit
      const failingClient = createMockAIClient({}, 'always-fail');
      const deps1 = buildDeps({ aiServiceClient: failingClient, circuitBreakers });
      await handleAIRequest(createTestRequest('explain'), deps1);
      expect(circuitBreakers['explain'].state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Recovery attempt succeeds
      const recoveryClient = createMockAIClient({ explain: { summary: 'Recovered!' } });
      const deps2 = buildDeps({ aiServiceClient: recoveryClient, circuitBreakers });
      const result = await handleAIRequest(createTestRequest('explain'), deps2);

      expect(result.success).toBe(true);
      expect(circuitBreakers['explain'].state).toBe('CLOSED');
    });
  });
});
