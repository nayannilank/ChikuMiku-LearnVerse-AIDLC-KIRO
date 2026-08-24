/**
 * In-memory repository implementations for the AI Gateway pipeline.
 *
 * These are PLACEHOLDERS that keep caching, rate limiting, and cost tracking
 * functional until the Neon (PostgreSQL) -backed repositories are implemented.
 *
 * Important limitations:
 *   - State lives only in the current Lambda execution environment. It is lost
 *     on cold start and NOT shared across concurrent Lambda containers.
 *   - Rate limits are therefore per-container, not global — effective limits
 *     are looser under concurrency.
 *   - The cache is best-effort: a cache miss just means the external API is
 *     called again (correct, if less efficient).
 *
 * Replace these with Neon-backed repositories for durable, cross-invocation
 * behavior. The interfaces (ICacheRepository, IRateLimitRepository,
 * ICostRepository) are unchanged, so swapping is a one-line wiring change.
 */

import type { ICacheRepository, CacheEntry } from '../cache';
import type { IRateLimitRepository, RateLimitRecord } from '../rate-limiter';
import type { ICostRepository, CostRecord, CostSummary } from '../cost-tracker';

/** Process-scoped cache repository. */
export class InMemoryCacheRepository implements ICacheRepository {
  private readonly entries = new Map<string, CacheEntry>();

  async get(cacheKey: string): Promise<CacheEntry | null> {
    const entry = this.entries.get(cacheKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
      this.entries.delete(cacheKey);
      return null;
    }
    return entry;
  }

  async set(entry: CacheEntry): Promise<void> {
    this.entries.set(entry.cacheKey, entry);
  }

  async invalidateByChapter(chapterId: string): Promise<void> {
    for (const [key, entry] of this.entries) {
      if (entry.chapterId === chapterId) {
        this.entries.delete(key);
      }
    }
  }
}

/** Process-scoped sliding-window rate limit repository. */
export class InMemoryRateLimitRepository implements IRateLimitRepository {
  private readonly records = new Map<string, RateLimitRecord>();

  async getRecord(key: string): Promise<RateLimitRecord | null> {
    return this.records.get(key) ?? null;
  }

  async incrementOrCreate(
    key: string,
    windowSeconds: number
  ): Promise<RateLimitRecord> {
    const now = Date.now();
    const existing = this.records.get(key);

    if (existing) {
      const windowStartMs = new Date(existing.windowStart).getTime();
      const windowActive = now - windowStartMs < windowSeconds * 1000;

      if (windowActive) {
        const updated: RateLimitRecord = {
          ...existing,
          requestCount: existing.requestCount + 1,
        };
        this.records.set(key, updated);
        return updated;
      }
    }

    // No record, or the window has expired — start a fresh window.
    const fresh: RateLimitRecord = {
      key,
      requestCount: 1,
      windowStart: new Date(now).toISOString(),
    };
    this.records.set(key, fresh);
    return fresh;
  }
}

/** Process-scoped cost record repository. */
export class InMemoryCostRepository implements ICostRepository {
  private readonly records: CostRecord[] = [];

  async record(entry: CostRecord): Promise<void> {
    this.records.push(entry);
  }

  async getSummary(startDate: string, endDate: string): Promise<CostSummary> {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    const inRange = this.records.filter((r) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });

    const costByType: Record<string, { cost: number; count: number }> = {};
    let totalCostUsd = 0;
    let cacheHits = 0;

    for (const r of inRange) {
      totalCostUsd += r.estimatedCostUsd;
      if (r.cacheHit) {
        cacheHits++;
      }
      const bucket = costByType[r.requestType] ?? { cost: 0, count: 0 };
      bucket.cost += r.estimatedCostUsd;
      bucket.count += 1;
      costByType[r.requestType] = bucket;
    }

    return {
      totalCostUsd,
      totalRequests: inRange.length,
      cacheHitRate: inRange.length === 0 ? 0 : cacheHits / inRange.length,
      costByType,
    };
  }
}
