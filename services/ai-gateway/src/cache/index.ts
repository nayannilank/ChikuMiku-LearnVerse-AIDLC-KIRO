/**
 * AI Response Cache Module.
 * Implements generate-once-serve-forever caching for AI-generated assets.
 * Cache key: `${requestType}:${chapterId}:${contentHash}`
 *
 * Requirements: 25.1, 25.2, 25.3
 */

import type { AIRequest, CacheCheckResult } from '@chikumiku/types';
import { computeContentHash } from './hash';

/** Stored cache entry in Aurora. */
export interface CacheEntry {
  cacheKey: string;
  requestType: AIRequest['type'];
  chapterId: string;
  contentHash: string;
  responseData: unknown;
  createdAt: string;
  expiresAt?: string;
}

/** Interface for the cache repository (dependency injection). */
export interface ICacheRepository {
  get(cacheKey: string): Promise<CacheEntry | null>;
  set(entry: CacheEntry): Promise<void>;
  invalidateByChapter(chapterId: string): Promise<void>;
}

/**
 * Builds a deterministic cache key from the AI request.
 * Format: `${type}:${chapterId}:${contentHash}`
 */
export function buildCacheKey(request: AIRequest): string {
  const contentHash = computeContentHash(request.payload);
  return `${request.type}:${request.chapterId}:${contentHash}`;
}

/**
 * Checks the cache for a previously stored AI response.
 * Returns cached data if present, or indicates a cache miss.
 */
export async function checkCache(
  request: AIRequest,
  cacheRepo: ICacheRepository
): Promise<CacheCheckResult> {
  const cacheKey = buildCacheKey(request);

  const entry = await cacheRepo.get(cacheKey);

  if (entry) {
    return {
      cached: true,
      data: entry.responseData,
      cacheKey,
    };
  }

  return {
    cached: false,
    cacheKey,
  };
}

/**
 * Stores an AI response in the cache after a successful external call.
 */
export async function storeInCache(
  request: AIRequest,
  responseData: unknown,
  cacheRepo: ICacheRepository
): Promise<void> {
  const cacheKey = buildCacheKey(request);
  const contentHash = computeContentHash(request.payload);

  const entry: CacheEntry = {
    cacheKey,
    requestType: request.type,
    chapterId: request.chapterId,
    contentHash,
    responseData,
    createdAt: new Date().toISOString(),
  };

  await cacheRepo.set(entry);
}

/**
 * Invalidates all cached assets for a chapter.
 * Called when a chapter transcript is edited (Requirement 25.2).
 */
export async function invalidateChapterCache(
  chapterId: string,
  cacheRepo: ICacheRepository
): Promise<void> {
  await cacheRepo.invalidateByChapter(chapterId);
}

export { computeContentHash } from './hash';
