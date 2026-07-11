/**
 * Property-Based Test: AI Content Caching Logic (Property 18)
 *
 * Feature: chikumiku-learnverse, Property 18: AI Content Caching Logic
 *
 * Validates: Requirements 25.1, 25.2, 25.3
 *
 * For any chapter, the system SHALL:
 * (a) generate AI assets when the chapter transcript is first saved and
 *     `ai_assets_generated` is false
 * (b) serve cached assets without LLM invocation when `ai_assets_generated`
 *     is true and the transcript has not been modified
 * (c) regenerate all AI assets and update the cache when a transcript is
 *     edited after assets were previously generated
 */

import * as fc from 'fast-check';
import type { AIRequest } from '@chikumiku/types';
import type { ICacheRepository, CacheEntry } from './index';
import {
  buildCacheKey,
  checkCache,
  storeInCache,
  invalidateChapterCache,
  computeContentHash,
} from './index';

// --- Helpers ---

/** Represents the state of a chapter for caching decision purposes. */
interface ChapterCacheState {
  chapterId: string;
  aiAssetsGenerated: boolean;
  transcriptModified: boolean;
  originalTranscript: string;
  currentTranscript: string;
}

/** Possible caching decisions. */
type CacheDecision = 'generate' | 'serve-cached' | 'regenerate';

/**
 * Determines the caching decision based on chapter state.
 * This models the caching logic defined by Requirements 25.1, 25.2, 25.3.
 */
function determineCacheDecision(state: ChapterCacheState): CacheDecision {
  if (!state.aiAssetsGenerated) {
    // Requirement 25.1: Generate when first saved and no assets exist
    return 'generate';
  }

  if (state.aiAssetsGenerated && !state.transcriptModified) {
    // Requirement 25.3: Serve cached when assets exist and transcript unchanged
    return 'serve-cached';
  }

  // Requirement 25.2: Regenerate when transcript edited after generation
  return 'regenerate';
}

/** Creates an AIRequest for a given chapter and transcript content. */
function createRequest(chapterId: string, transcript: string): AIRequest {
  return {
    type: 'explain',
    chapterId,
    payload: { text: transcript },
    learnerId: 'learner-test',
    gradeLevel: '5th',
  };
}

/** Creates an in-memory ICacheRepository backed by a Map. */
function createInMemoryCacheRepo(store: Map<string, CacheEntry> = new Map()): ICacheRepository {
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

// --- Arbitraries ---

const chapterIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);
const transcriptArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

/** Generates a chapter state where assets have NOT been generated. */
const notGeneratedStateArb: fc.Arbitrary<ChapterCacheState> = fc.record({
  chapterId: chapterIdArb,
  aiAssetsGenerated: fc.constant(false),
  transcriptModified: fc.constant(false),
  originalTranscript: transcriptArb,
  currentTranscript: transcriptArb,
}).map(state => ({ ...state, currentTranscript: state.originalTranscript }));

/** Generates a chapter state where assets ARE generated and transcript is unmodified. */
const cachedUnmodifiedStateArb: fc.Arbitrary<ChapterCacheState> = fc.record({
  chapterId: chapterIdArb,
  aiAssetsGenerated: fc.constant(true),
  transcriptModified: fc.constant(false),
  originalTranscript: transcriptArb,
  currentTranscript: transcriptArb,
}).map(state => ({ ...state, currentTranscript: state.originalTranscript }));

/** Generates a chapter state where assets ARE generated but transcript was modified. */
const cachedModifiedStateArb: fc.Arbitrary<ChapterCacheState> = fc.tuple(
  chapterIdArb,
  transcriptArb,
  transcriptArb,
).filter(([, orig, modified]) => orig !== modified)
  .map(([chapterId, originalTranscript, currentTranscript]) => ({
    chapterId,
    aiAssetsGenerated: true,
    transcriptModified: true,
    originalTranscript,
    currentTranscript,
  }));

// --- Property Tests ---

describe('Feature: chikumiku-learnverse, Property 18: AI Content Caching Logic', () => {
  /**
   * **Validates: Requirements 25.1**
   *
   * Property 18a: When ai_assets_generated is false, the system must generate
   * AI assets (cache miss expected).
   */
  it('(a) must generate when first saved and ai_assets_generated is false', async () => {
    await fc.assert(
      fc.asyncProperty(notGeneratedStateArb, async (state) => {
        const store = new Map<string, CacheEntry>();
        const repo = createInMemoryCacheRepo(store);

        // Decision logic says: generate
        const decision = determineCacheDecision(state);
        expect(decision).toBe('generate');

        // Verify via cache module: no cached entry exists → cache miss
        const request = createRequest(state.chapterId, state.currentTranscript);
        const cacheResult = await checkCache(request, repo);

        expect(cacheResult.cached).toBe(false);
        expect(cacheResult.data).toBeUndefined();

        // After generation, we store the result
        const generatedData = { summary: `Generated for ${state.chapterId}` };
        await storeInCache(request, generatedData, repo);

        // Verify it's now stored
        const afterStore = await checkCache(request, repo);
        expect(afterStore.cached).toBe(true);
        expect(afterStore.data).toEqual(generatedData);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 25.3**
   *
   * Property 18b: When ai_assets_generated is true and transcript is unmodified,
   * serve from cache without LLM invocation (cache hit expected).
   */
  it('(b) must serve cached when ai_assets_generated is true and transcript unmodified', async () => {
    await fc.assert(
      fc.asyncProperty(cachedUnmodifiedStateArb, async (state) => {
        const store = new Map<string, CacheEntry>();
        const repo = createInMemoryCacheRepo(store);

        // Decision logic says: serve from cache
        const decision = determineCacheDecision(state);
        expect(decision).toBe('serve-cached');

        // Simulate: assets were previously generated and stored
        const request = createRequest(state.chapterId, state.originalTranscript);
        const cachedData = { summary: `Cached content for ${state.chapterId}` };
        await storeInCache(request, cachedData, repo);

        // Verify: same request returns cached data (no LLM call needed)
        const cacheResult = await checkCache(request, repo);
        expect(cacheResult.cached).toBe(true);
        expect(cacheResult.data).toEqual(cachedData);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 25.2**
   *
   * Property 18c: When ai_assets_generated is true and transcript was edited
   * after generation, must regenerate (invalidate old cache + generate new).
   */
  it('(c) must regenerate when transcript edited after assets were generated', async () => {
    await fc.assert(
      fc.asyncProperty(cachedModifiedStateArb, async (state) => {
        const store = new Map<string, CacheEntry>();
        const repo = createInMemoryCacheRepo(store);

        // Decision logic says: regenerate
        const decision = determineCacheDecision(state);
        expect(decision).toBe('regenerate');

        // Simulate: assets were previously generated with original transcript
        const originalRequest = createRequest(state.chapterId, state.originalTranscript);
        const originalData = { summary: `Original for ${state.chapterId}` };
        await storeInCache(originalRequest, originalData, repo);

        // Verify old cache exists
        const beforeInvalidate = await checkCache(originalRequest, repo);
        expect(beforeInvalidate.cached).toBe(true);

        // Step 1: Invalidate all cached assets for this chapter
        await invalidateChapterCache(state.chapterId, repo);

        // Verify old cache is removed
        const afterInvalidate = await checkCache(originalRequest, repo);
        expect(afterInvalidate.cached).toBe(false);

        // Step 2: Generate with new transcript content
        const newRequest = createRequest(state.chapterId, state.currentTranscript);
        const newData = { summary: `Regenerated for ${state.chapterId}` };
        await storeInCache(newRequest, newData, repo);

        // Verify new cache entry is present
        const afterRegenerate = await checkCache(newRequest, repo);
        expect(afterRegenerate.cached).toBe(true);
        expect(afterRegenerate.data).toEqual(newData);

        // Verify content hash differs (since transcript changed)
        const originalHash = computeContentHash(originalRequest.payload);
        const newHash = computeContentHash(newRequest.payload);
        expect(originalHash).not.toBe(newHash);
      }),
      { numRuns: 100 },
    );
  });
});
