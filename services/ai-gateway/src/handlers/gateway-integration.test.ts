/**
 * Integration tests for the AI Gateway handler.
 * Tests end-to-end flows through the full pipeline:
 * validation → rate limit → cache → circuit breaker → external call → store → cost track
 *
 * Requirements: 25.1–25.6
 */

import type { AIRequest } from '@chikumiku/types';
import type { ICacheRepository, CacheEntry } from '../cache';
import type { IRateLimitRepository, RateLimitRecord } from '../rate-limiter';
import type { ICostRepository, CostRecord } from '../cost-tracker';
import type { ISecretsManagerClient, SecretName } from '../clients/secrets-manager';
import type { IAIServiceClient, GatewayHandlerDeps } from './gateway';
import { handleAIRequest } from './gateway';
import { CircuitBreaker, createServiceCircuitBreakers } from '../circuit-breaker';
import { buildCacheKey } from '../cache';

// --- Test infrastructure ---

/** Tracks all AI service invocations for assertions. */
interface AIServiceCall {
  type: AIRequest['type'];
  payload: Record<string, unknown>;
  apiKey: string;
  options?: { gradeLevel?: string; chapterId?: string };
}

/** Creates a mock cache repo that tracks all operations. */
function createTrackedCacheRepo(
  initialEntries: Map<string, CacheEntry> = new Map()
): ICacheRepository & { entries: Map<string, CacheEntry>; getCalls: string[]; setCalls: CacheEntry[] } {
  const entries = new Map(initialEntries);
  const getCalls: string[] = [];
  const setCalls: CacheEntry[] = [];

  return {
    entries,
    getCalls,
    setCalls,
    async get(cacheKey: string) {
      getCalls.push(cacheKey);
      return entries.get(cacheKey) ?? null;
    },
    async set(entry: CacheEntry) {
      setCalls.push(entry);
      entries.set(entry.cacheKey, entry);
    },
    async invalidateByChapter(_chapterId: string) {
      // no-op
    },
  };
}

/** Creates a rate limit repo with configurable per-key limits. */
function createConfigurableRateLimitRepo(config: {
  learnerCount?: number;
  serviceCount?: number;
  windowStart?: string;
}): IRateLimitRepository {
  const { learnerCount = 1, serviceCount = 1, windowStart = new Date().toISOString() } = config;

  return {
    async getRecord(_key: string) {
      return null;
    },
    async incrementOrCreate(key: string, _windowSeconds: number): Promise<RateLimitRecord> {
      const isLearnerKey = key.startsWith('learner:');
      return {
        key,
        requestCount: isLearnerKey ? learnerCount : serviceCount,
        windowStart,
      };
    },
  };
}

/** Creates a cost repo that tracks all recorded costs. */
function createTrackedCostRepo(): ICostRepository & { records: CostRecord[] } {
  const records: CostRecord[] = [];
  return {
    records,
    async record(entry: CostRecord) {
      records.push(entry);
    },
    async getSummary() {
      return { totalCostUsd: 0, totalRequests: 0, cacheHitRate: 0, costByType: {} };
    },
  };
}

/** Creates a tracked AI service client. */
function createTrackedAIClient(
  behavior: 'success' | 'fail-then-succeed' | 'always-fail' = 'success',
  response: unknown = { generated: 'ai-response-data' }
): IAIServiceClient & { calls: AIServiceCall[] } {
  const calls: AIServiceCall[] = [];
  let callCount = 0;

  return {
    calls,
    async invoke(type, payload, apiKey, options) {
      calls.push({ type, payload, apiKey, options });
      callCount++;

      if (behavior === 'always-fail') {
        throw new Error('External AI service unavailable');
      }
      if (behavior === 'fail-then-succeed' && callCount === 1) {
        throw new Error('Temporary external failure');
      }
      return response;
    },
  };
}

function createValidRequest(overrides?: Partial<AIRequest>): AIRequest {
  return {
    type: 'explain',
    chapterId: 'chapter-integration-001',
    payload: { pageNumber: 3, text: 'Photosynthesis is the process...' },
    learnerId: 'learner-integration-001',
    gradeLevel: '7th',
    ...overrides,
  };
}

function buildFullDeps(overrides?: Partial<GatewayHandlerDeps>): GatewayHandlerDeps {
  return {
    cacheRepo: createTrackedCacheRepo(),
    rateLimitRepo: createConfigurableRateLimitRepo({}),
    costRepo: createTrackedCostRepo(),
    secretsManager: {
      async getSecret(_name: SecretName) {
        return 'integration-test-api-key';
      },
    },
    aiServiceClient: createTrackedAIClient(),
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

// --- Integration Tests ---

describe('AI Gateway Integration Tests', () => {
  describe('Cache hit/miss flow', () => {
    it('returns cached data and skips external AI call on cache hit', async () => {
      const request = createValidRequest();
      const cachedData = { summary: 'Cached photosynthesis explanation', keywords: ['chlorophyll'] };
      const cacheKey = buildCacheKey(request);

      const cacheEntries = new Map<string, CacheEntry>();
      cacheEntries.set(cacheKey, {
        cacheKey,
        requestType: request.type,
        chapterId: request.chapterId,
        contentHash: 'hash-123',
        responseData: cachedData,
        createdAt: new Date().toISOString(),
      });

      const cacheRepo = createTrackedCacheRepo(cacheEntries);
      const aiClient = createTrackedAIClient();
      const costRepo = createTrackedCostRepo();

      const deps = buildFullDeps({ cacheRepo, aiServiceClient: aiClient, costRepo });
      const result = await handleAIRequest(request, deps);

      // Verify cache hit response
      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(true);
      expect(result.data).toEqual(cachedData);

      // Verify no external AI call was made
      expect(aiClient.calls).toHaveLength(0);

      // Verify cost tracked as 0 (cache hit)
      expect(costRepo.records).toHaveLength(1);
      expect(costRepo.records[0].cacheHit).toBe(true);
      expect(costRepo.records[0].estimatedCostUsd).toBe(0);
    });

    it('calls external service on cache miss, stores result, and tracks cost', async () => {
      const request = createValidRequest();
      const aiResponse = { summary: 'Fresh explanation of photosynthesis', concepts: ['energy'] };
      const aiClient = createTrackedAIClient('success', aiResponse);
      const cacheRepo = createTrackedCacheRepo();
      const costRepo = createTrackedCostRepo();

      const deps = buildFullDeps({ cacheRepo, aiServiceClient: aiClient, costRepo });
      const result = await handleAIRequest(request, deps);

      // Verify success response with fresh data
      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(false);
      expect(result.data).toEqual(aiResponse);

      // Verify external AI call was made with correct API key
      expect(aiClient.calls).toHaveLength(1);
      expect(aiClient.calls[0].type).toBe('explain');
      expect(aiClient.calls[0].apiKey).toBe('integration-test-api-key');
      expect(aiClient.calls[0].options).toEqual({
        gradeLevel: '7th',
        chapterId: 'chapter-integration-001',
      });

      // Verify result was stored in cache
      expect(cacheRepo.setCalls).toHaveLength(1);
      expect(cacheRepo.setCalls[0].responseData).toEqual(aiResponse);
      expect(cacheRepo.setCalls[0].requestType).toBe('explain');

      // Verify cost tracked (non-zero for cache miss)
      expect(costRepo.records).toHaveLength(1);
      expect(costRepo.records[0].cacheHit).toBe(false);
      expect(costRepo.records[0].estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('Circuit breaker behavior', () => {
    it('opens circuit after consecutive failures and rejects subsequent requests immediately', async () => {
      const aiClient = createTrackedAIClient('always-fail');
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 3,
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
        resetTimeoutMs: 10_000,
      });

      const deps = buildFullDeps({ aiServiceClient: aiClient, circuitBreakers });
      const request = createValidRequest();

      // First request exhausts retries and opens the circuit
      const firstResult = await handleAIRequest(request, deps);
      expect(firstResult.success).toBe(false);
      expect(firstResult.error?.code).toBe('SERVICE_UNAVAILABLE');

      // Circuit should now be OPEN
      expect(circuitBreakers['explain'].state).toBe('OPEN');

      // Second request should be rejected immediately (0 attempts)
      const aiClient2 = createTrackedAIClient('success');
      const deps2 = buildFullDeps({
        aiServiceClient: aiClient2,
        circuitBreakers,
      });
      const secondResult = await handleAIRequest(request, deps2);

      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe('SERVICE_UNAVAILABLE');
      expect(secondResult.error?.message).toContain('circuit open');
      // No calls should have been made because circuit is open
      expect(aiClient2.calls).toHaveLength(0);
    });

    it('transitions to HALF_OPEN after reset timeout and allows a test request', async () => {
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 3,
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
        resetTimeoutMs: 50, // 50ms for test speed
      });

      // Open the circuit by failing
      const failingClient = createTrackedAIClient('always-fail');
      const deps1 = buildFullDeps({ aiServiceClient: failingClient, circuitBreakers });
      await handleAIRequest(createValidRequest(), deps1);

      expect(circuitBreakers['explain'].state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 60));

      // Circuit should now be HALF_OPEN, allowing one test request
      const recoveryResponse = { summary: 'Service recovered!' };
      const successClient = createTrackedAIClient('success', recoveryResponse);
      const deps2 = buildFullDeps({ aiServiceClient: successClient, circuitBreakers });

      const result = await handleAIRequest(createValidRequest(), deps2);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(recoveryResponse);
      expect(circuitBreakers['explain'].state).toBe('CLOSED');
    });
  });

  describe('Rate limiting enforcement', () => {
    it('rejects request when per-learner limit is exceeded with retryAfterSeconds', async () => {
      const rateLimitRepo = createConfigurableRateLimitRepo({
        learnerCount: 999, // Exceeds 300/hr default
        serviceCount: 1,
        windowStart: new Date(Date.now() - 1000).toISOString(), // Window started 1s ago
      });

      const aiClient = createTrackedAIClient();
      const costRepo = createTrackedCostRepo();
      const deps = buildFullDeps({ rateLimitRepo, aiServiceClient: aiClient, costRepo });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.retryAfterSeconds).toBeGreaterThan(0);

      // Verify no external AI call was made
      expect(aiClient.calls).toHaveLength(0);
    });

    it('rejects request when per-service limit is exceeded but per-learner is OK', async () => {
      const rateLimitRepo = createConfigurableRateLimitRepo({
        learnerCount: 5, // Under 300/hr learner limit
        serviceCount: 999, // Exceeds per-service limit (e.g., explain is 30/hr)
        windowStart: new Date(Date.now() - 2000).toISOString(),
      });

      const aiClient = createTrackedAIClient();
      const deps = buildFullDeps({ rateLimitRepo, aiServiceClient: aiClient });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.retryAfterSeconds).toBeGreaterThan(0);

      // Verify no external call was made
      expect(aiClient.calls).toHaveLength(0);
    });
  });

  describe('Error handling', () => {
    it('returns INTERNAL_ERROR when secrets manager fails to retrieve API key', async () => {
      const secretsManager: ISecretsManagerClient = {
        async getSecret(_name: SecretName) {
          throw new Error('Secrets Manager access denied');
        },
      };

      const aiClient = createTrackedAIClient();
      const costRepo = createTrackedCostRepo();
      const deps = buildFullDeps({ secretsManager, aiServiceClient: aiClient, costRepo });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(result.error?.message).toContain('credentials');
      expect(result.error?.retryable).toBe(true);

      // External service should not be called
      expect(aiClient.calls).toHaveLength(0);
    });

    it('returns VALIDATION_ERROR for missing required fields', async () => {
      const deps = buildFullDeps();

      // Missing type
      const noType = await handleAIRequest(
        { chapterId: 'ch-1', learnerId: 'l-1', payload: { text: 'hi' }, gradeLevel: '5th' },
        deps
      );
      expect(noType.success).toBe(false);
      expect(noType.error?.code).toBe('VALIDATION_ERROR');
      expect(noType.error?.retryable).toBe(false);

      // Missing chapterId
      const noChapter = await handleAIRequest(
        { type: 'explain', chapterId: '', learnerId: 'l-1', payload: { text: 'hi' }, gradeLevel: '5th' },
        deps
      );
      expect(noChapter.success).toBe(false);
      expect(noChapter.error?.code).toBe('VALIDATION_ERROR');
      expect(noChapter.error?.message).toContain('chapterId');

      // Missing learnerId
      const noLearner = await handleAIRequest(
        { type: 'explain', chapterId: 'ch-1', learnerId: '', payload: { text: 'hi' }, gradeLevel: '5th' },
        deps
      );
      expect(noLearner.success).toBe(false);
      expect(noLearner.error?.code).toBe('VALIDATION_ERROR');
      expect(noLearner.error?.message).toContain('learnerId');

      // Missing payload
      const noPayload = await handleAIRequest(
        { type: 'explain', chapterId: 'ch-1', learnerId: 'l-1', payload: null, gradeLevel: '5th' },
        deps
      );
      expect(noPayload.success).toBe(false);
      expect(noPayload.error?.code).toBe('VALIDATION_ERROR');
      expect(noPayload.error?.message).toContain('payload');

      // Missing gradeLevel
      const noGrade = await handleAIRequest(
        { type: 'explain', chapterId: 'ch-1', learnerId: 'l-1', payload: { text: 'hi' }, gradeLevel: '' },
        deps
      );
      expect(noGrade.success).toBe(false);
      expect(noGrade.error?.code).toBe('VALIDATION_ERROR');
      expect(noGrade.error?.message).toContain('gradeLevel');
    });

    it('returns VALIDATION_ERROR for null/undefined request body', async () => {
      const deps = buildFullDeps();

      const nullResult = await handleAIRequest(null, deps);
      expect(nullResult.success).toBe(false);
      expect(nullResult.error?.code).toBe('VALIDATION_ERROR');

      const undefinedResult = await handleAIRequest(undefined, deps);
      expect(undefinedResult.success).toBe(false);
      expect(undefinedResult.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Retry logic', () => {
    it('succeeds after external call fails once then succeeds on retry', async () => {
      const aiResponse = { summary: 'Recovered explanation' };
      const aiClient = createTrackedAIClient('fail-then-succeed', aiResponse);
      const costRepo = createTrackedCostRepo();
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 5, // High threshold so circuit stays closed
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
      });

      const deps = buildFullDeps({
        aiServiceClient: aiClient,
        costRepo,
        circuitBreakers,
      });

      const result = await handleAIRequest(createValidRequest(), deps);

      // Request should succeed after retry
      expect(result.success).toBe(true);
      expect(result.data).toEqual(aiResponse);
      expect(result.cacheHit).toBe(false);

      // Verify the AI client was called twice (fail + succeed)
      expect(aiClient.calls).toHaveLength(2);

      // Cost should be tracked for the successful call
      expect(costRepo.records).toHaveLength(1);
      expect(costRepo.records[0].cacheHit).toBe(false);
    });

    it('fails when all retries are exhausted and tracks cost', async () => {
      const aiClient = createTrackedAIClient('always-fail');
      const costRepo = createTrackedCostRepo();
      const circuitBreakers = createServiceCircuitBreakers({
        failureThreshold: 5,
        maxRetries: 3,
        baseDelayMs: 1,
        maxJitterMs: 1,
      });

      const deps = buildFullDeps({
        aiServiceClient: aiClient,
        costRepo,
        circuitBreakers,
      });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
      expect(result.error?.retryable).toBe(true);

      // All 3 retries attempted
      expect(aiClient.calls).toHaveLength(3);

      // Cost tracked for failed request
      expect(costRepo.records).toHaveLength(1);
      expect(costRepo.records[0].cacheHit).toBe(false);
    });
  });
});
