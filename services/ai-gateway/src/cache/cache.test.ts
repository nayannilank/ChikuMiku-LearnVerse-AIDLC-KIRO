/**
 * Unit tests for the cache module.
 */

import type { AIRequest } from '@chikumiku/types';
import type { ICacheRepository, CacheEntry } from './index';
import {
  buildCacheKey,
  checkCache,
  storeInCache,
  invalidateChapterCache,
  computeContentHash,
} from './index';

function createTestRequest(overrides?: Partial<AIRequest>): AIRequest {
  return {
    type: 'explain',
    chapterId: 'chapter-001',
    payload: { pageNumber: 1, text: 'Hello world' },
    learnerId: 'learner-001',
    gradeLevel: '5th',
    ...overrides,
  };
}

function createMockCacheRepo(store: Map<string, CacheEntry> = new Map()): ICacheRepository {
  return {
    async get(cacheKey: string) {
      return store.get(cacheKey) ?? null;
    },
    async set(entry: CacheEntry) {
      store.set(entry.cacheKey, entry);
    },
    async invalidateByChapter(chapterId: string) {
      for (const [key, entry] of store.entries()) {
        if (entry.chapterId === chapterId) {
          store.delete(key);
        }
      }
    },
  };
}

describe('computeContentHash', () => {
  it('produces a deterministic hash for the same payload', () => {
    const payload = { text: 'hello', page: 1 };
    const hash1 = computeContentHash(payload);
    const hash2 = computeContentHash(payload);
    expect(hash1).toBe(hash2);
  });

  it('produces the same hash regardless of key order', () => {
    const payload1 = { a: 1, b: 2, c: 3 };
    const payload2 = { c: 3, a: 1, b: 2 };
    expect(computeContentHash(payload1)).toBe(computeContentHash(payload2));
  });

  it('produces different hashes for different payloads', () => {
    const hash1 = computeContentHash({ text: 'hello' });
    const hash2 = computeContentHash({ text: 'world' });
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 16-character hex string', () => {
    const hash = computeContentHash({ data: 'test' });
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe('buildCacheKey', () => {
  it('builds key in format type:chapterId:contentHash', () => {
    const request = createTestRequest();
    const key = buildCacheKey(request);

    expect(key).toMatch(/^explain:chapter-001:[a-f0-9]{16}$/);
  });

  it('produces different keys for different request types', () => {
    const req1 = createTestRequest({ type: 'explain' });
    const req2 = createTestRequest({ type: 'qa' });

    expect(buildCacheKey(req1)).not.toBe(buildCacheKey(req2));
  });

  it('produces different keys for different chapters', () => {
    const req1 = createTestRequest({ chapterId: 'ch-1' });
    const req2 = createTestRequest({ chapterId: 'ch-2' });

    expect(buildCacheKey(req1)).not.toBe(buildCacheKey(req2));
  });

  it('produces different keys for different payloads', () => {
    const req1 = createTestRequest({ payload: { text: 'abc' } });
    const req2 = createTestRequest({ payload: { text: 'xyz' } });

    expect(buildCacheKey(req1)).not.toBe(buildCacheKey(req2));
  });
});

describe('checkCache', () => {
  it('returns cached=false for cache miss', async () => {
    const repo = createMockCacheRepo();
    const request = createTestRequest();

    const result = await checkCache(request, repo);

    expect(result.cached).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.cacheKey).toBeDefined();
  });

  it('returns cached=true with data for cache hit', async () => {
    const store = new Map<string, CacheEntry>();
    const request = createTestRequest();
    const cacheKey = buildCacheKey(request);
    const responseData = { summary: 'test explanation' };

    store.set(cacheKey, {
      cacheKey,
      requestType: 'explain',
      chapterId: 'chapter-001',
      contentHash: 'hash',
      responseData,
      createdAt: new Date().toISOString(),
    });

    const repo = createMockCacheRepo(store);
    const result = await checkCache(request, repo);

    expect(result.cached).toBe(true);
    expect(result.data).toEqual(responseData);
    expect(result.cacheKey).toBe(cacheKey);
  });
});

describe('storeInCache', () => {
  it('stores the response data with correct metadata', async () => {
    const store = new Map<string, CacheEntry>();
    const repo = createMockCacheRepo(store);
    const request = createTestRequest();
    const responseData = { summary: 'new explanation' };

    await storeInCache(request, responseData, repo);

    expect(store.size).toBe(1);
    const entry = Array.from(store.values())[0];
    expect(entry.requestType).toBe('explain');
    expect(entry.chapterId).toBe('chapter-001');
    expect(entry.responseData).toEqual(responseData);
    expect(entry.createdAt).toBeDefined();
  });

  it('subsequent reads return the stored data', async () => {
    const store = new Map<string, CacheEntry>();
    const repo = createMockCacheRepo(store);
    const request = createTestRequest();
    const responseData = { summary: 'stored' };

    await storeInCache(request, responseData, repo);
    const result = await checkCache(request, repo);

    expect(result.cached).toBe(true);
    expect(result.data).toEqual(responseData);
  });
});

describe('invalidateChapterCache', () => {
  it('removes all entries for the given chapter', async () => {
    const store = new Map<string, CacheEntry>();
    store.set('explain:ch-1:hash1', {
      cacheKey: 'explain:ch-1:hash1',
      requestType: 'explain',
      chapterId: 'ch-1',
      contentHash: 'hash1',
      responseData: { data: 1 },
      createdAt: new Date().toISOString(),
    });
    store.set('qa:ch-1:hash2', {
      cacheKey: 'qa:ch-1:hash2',
      requestType: 'qa',
      chapterId: 'ch-1',
      contentHash: 'hash2',
      responseData: { data: 2 },
      createdAt: new Date().toISOString(),
    });
    store.set('explain:ch-2:hash3', {
      cacheKey: 'explain:ch-2:hash3',
      requestType: 'explain',
      chapterId: 'ch-2',
      contentHash: 'hash3',
      responseData: { data: 3 },
      createdAt: new Date().toISOString(),
    });

    const repo = createMockCacheRepo(store);
    await invalidateChapterCache('ch-1', repo);

    expect(store.size).toBe(1);
    expect(store.has('explain:ch-2:hash3')).toBe(true);
  });
});
