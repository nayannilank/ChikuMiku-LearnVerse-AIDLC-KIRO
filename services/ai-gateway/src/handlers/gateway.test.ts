/**
 * Unit tests for the AI Gateway handler.
 * Tests the full request pipeline: validation, rate limiting,
 * caching, circuit breaking, and cost tracking.
 */

import type { AIRequest } from '@chikumiku/types';
import type { ICacheRepository, CacheEntry } from '../cache';
import type { IRateLimitRepository, RateLimitRecord } from '../rate-limiter';
import type { ICostRepository, CostRecord } from '../cost-tracker';
import type { ISecretsManagerClient, SecretName } from '../clients/secrets-manager';
import type { IAIServiceClient, GatewayHandlerDeps } from './gateway';
import { handleAIRequest, validateAIRequest } from './gateway';
import { CircuitBreaker, createServiceCircuitBreakers } from '../circuit-breaker';

// --- Test helpers ---

function createMockCacheRepo(existingEntries: Map<string, CacheEntry> = new Map()): ICacheRepository {
  return {
    async get(cacheKey: string) {
      return existingEntries.get(cacheKey) ?? null;
    },
    async set(entry: CacheEntry) {
      existingEntries.set(entry.cacheKey, entry);
    },
    async invalidateByChapter(_chapterId: string) {
      // no-op in tests
    },
  };
}

function createMockRateLimitRepo(shouldLimit = false): IRateLimitRepository {
  return {
    async getRecord(_key: string) {
      return null;
    },
    async incrementOrCreate(key: string, windowSeconds: number): Promise<RateLimitRecord> {
      return {
        key,
        requestCount: shouldLimit ? 999 : 1,
        windowStart: new Date().toISOString(),
      };
    },
  };
}

function createMockCostRepo(): ICostRepository & { records: CostRecord[] } {
  const records: CostRecord[] = [];
  return {
    records,
    async record(entry: CostRecord) {
      records.push(entry);
    },
    async getSummary() {
      return {
        totalCostUsd: 0,
        totalRequests: 0,
        cacheHitRate: 0,
        costByType: {},
      };
    },
  };
}

function createMockSecretsManager(): ISecretsManagerClient {
  return {
    async getSecret(_name: SecretName) {
      return 'test-api-key-12345';
    },
  };
}

function createMockAIServiceClient(response: unknown = { result: 'test-data' }): IAIServiceClient {
  return {
    async invoke(_type, _payload, _apiKey, _options) {
      return response;
    },
  };
}

function createValidRequest(): AIRequest {
  return {
    type: 'explain',
    chapterId: 'chapter-123',
    payload: { pageNumber: 1, text: 'Sample content' },
    learnerId: 'learner-456',
    gradeLevel: '5th',
  };
}

function createDeps(overrides?: Partial<GatewayHandlerDeps>): GatewayHandlerDeps {
  return {
    cacheRepo: createMockCacheRepo(),
    rateLimitRepo: createMockRateLimitRepo(),
    costRepo: createMockCostRepo(),
    secretsManager: createMockSecretsManager(),
    aiServiceClient: createMockAIServiceClient(),
    circuitBreakers: createServiceCircuitBreakers({ maxRetries: 3 }),
    ...overrides,
  };
}

// --- Tests ---

describe('validateAIRequest', () => {
  it('returns null for a valid request', () => {
    const result = validateAIRequest(createValidRequest());
    expect(result).toBeNull();
  });

  it('rejects null body', () => {
    const result = validateAIRequest(null);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing type', () => {
    const result = validateAIRequest({ chapterId: 'ch-1', learnerId: 'l-1', payload: {}, gradeLevel: '5' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('Invalid request type');
  });

  it('rejects invalid type', () => {
    const result = validateAIRequest({ ...createValidRequest(), type: 'invalid' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('Invalid request type');
  });

  it('rejects missing chapterId', () => {
    const req = createValidRequest();
    (req as any).chapterId = '';
    const result = validateAIRequest(req);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('chapterId');
  });

  it('rejects missing learnerId', () => {
    const req = createValidRequest();
    (req as any).learnerId = '';
    const result = validateAIRequest(req);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('learnerId');
  });

  it('rejects missing payload', () => {
    const req = createValidRequest();
    (req as any).payload = null;
    const result = validateAIRequest(req);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('payload');
  });

  it('rejects missing gradeLevel', () => {
    const req = createValidRequest();
    (req as any).gradeLevel = '';
    const result = validateAIRequest(req);
    expect(result).not.toBeNull();
    expect(result!.message).toContain('gradeLevel');
  });
});

describe('handleAIRequest', () => {
  describe('validation', () => {
    it('returns VALIDATION_ERROR for invalid request', async () => {
      const deps = createDeps();
      const result = await handleAIRequest(null, deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.cacheHit).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('returns RATE_LIMITED when learner exceeds limit', async () => {
      const deps = createDeps({
        rateLimitRepo: createMockRateLimitRepo(true),
      });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMITED');
      expect(result.error?.retryable).toBe(true);
      expect(result.error?.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('cache hit flow', () => {
    it('returns cached data without calling external service', async () => {
      const cachedData = { summary: 'Cached explanation' };
      const request = createValidRequest();

      // Pre-populate cache with matching entry
      const cacheEntries = new Map<string, CacheEntry>();
      const { buildCacheKey } = require('../cache');
      const cacheKey = buildCacheKey(request);
      cacheEntries.set(cacheKey, {
        cacheKey,
        requestType: request.type,
        chapterId: request.chapterId,
        contentHash: 'test-hash',
        responseData: cachedData,
        createdAt: new Date().toISOString(),
      });

      let aiServiceCalled = false;
      const deps = createDeps({
        cacheRepo: createMockCacheRepo(cacheEntries),
        aiServiceClient: {
          async invoke() {
            aiServiceCalled = true;
            return {};
          },
        },
      });

      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(aiServiceCalled).toBe(false);
    });

    it('tracks cost as zero for cache hits', async () => {
      const request = createValidRequest();
      const cacheEntries = new Map<string, CacheEntry>();
      const { buildCacheKey } = require('../cache');
      const cacheKey = buildCacheKey(request);
      cacheEntries.set(cacheKey, {
        cacheKey,
        requestType: request.type,
        chapterId: request.chapterId,
        contentHash: 'test-hash',
        responseData: { data: 'cached' },
        createdAt: new Date().toISOString(),
      });

      const costRepo = createMockCostRepo();
      const deps = createDeps({
        cacheRepo: createMockCacheRepo(cacheEntries),
        costRepo,
      });

      await handleAIRequest(request, deps);

      expect(costRepo.records.length).toBe(1);
      expect(costRepo.records[0].cacheHit).toBe(true);
      expect(costRepo.records[0].estimatedCostUsd).toBe(0);
    });
  });

  describe('cache miss flow', () => {
    it('calls external service and stores result in cache', async () => {
      const aiResponse = { summary: 'Generated explanation', keywords: ['test'] };
      const cacheEntries = new Map<string, CacheEntry>();

      const deps = createDeps({
        cacheRepo: createMockCacheRepo(cacheEntries),
        aiServiceClient: createMockAIServiceClient(aiResponse),
      });

      const request = createValidRequest();
      const result = await handleAIRequest(request, deps);

      expect(result.success).toBe(true);
      expect(result.cacheHit).toBe(false);
      expect(result.data).toEqual(aiResponse);

      // Verify result was stored in cache
      expect(cacheEntries.size).toBe(1);
      const storedEntry = Array.from(cacheEntries.values())[0];
      expect(storedEntry.responseData).toEqual(aiResponse);
    });

    it('tracks non-zero cost for cache misses', async () => {
      const costRepo = createMockCostRepo();
      const deps = createDeps({ costRepo });

      await handleAIRequest(createValidRequest(), deps);

      expect(costRepo.records.length).toBe(1);
      expect(costRepo.records[0].cacheHit).toBe(false);
      expect(costRepo.records[0].estimatedCostUsd).toBeGreaterThan(0);
    });
  });

  describe('secrets manager failure', () => {
    it('returns INTERNAL_ERROR when secrets retrieval fails', async () => {
      const deps = createDeps({
        secretsManager: {
          async getSecret() {
            throw new Error('Secrets Manager unavailable');
          },
        },
      });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(result.error?.message).toContain('credentials');
    });
  });

  describe('circuit breaker', () => {
    it('returns SERVICE_UNAVAILABLE when circuit is open', async () => {
      const breakers = createServiceCircuitBreakers({
        failureThreshold: 1,
        maxRetries: 1,
        resetTimeoutMs: 60_000,
      });

      // Force the explain circuit breaker to OPEN state
      const failingClient: IAIServiceClient = {
        async invoke() {
          throw new Error('Service down');
        },
      };

      const deps = createDeps({
        circuitBreakers: breakers,
        aiServiceClient: failingClient,
      });

      // First call fails and opens circuit
      await handleAIRequest(createValidRequest(), deps);

      // Second call should be rejected because circuit is now OPEN
      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
      expect(result.error?.retryable).toBe(true);
    });

    it('retries on failure up to max retries', async () => {
      let callCount = 0;
      const deps = createDeps({
        aiServiceClient: {
          async invoke() {
            callCount++;
            if (callCount < 3) {
              throw new Error('Temporary failure');
            }
            return { result: 'success-after-retries' };
          },
        },
        circuitBreakers: createServiceCircuitBreakers({
          failureThreshold: 5,
          maxRetries: 3,
          baseDelayMs: 1,
          maxJitterMs: 1,
        }),
      });

      const result = await handleAIRequest(createValidRequest(), deps);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success-after-retries' });
      expect(callCount).toBe(3);
    });
  });
});
