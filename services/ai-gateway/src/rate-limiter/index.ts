/**
 * Rate Limiter Module.
 * Enforces per-learner and per-AI-service rate limits to prevent abuse
 * and control costs.
 *
 * Uses a sliding window approach stored in the database.
 * Requirements: 25.1, 25.6
 */

import type { AIRequest } from '@chikumiku/types';

/** Rate limit configuration per AI service type. */
export interface RateLimitConfig {
  /** Maximum requests allowed within the time window. */
  maxRequests: number;
  /** Time window in seconds. */
  windowSeconds: number;
}

/** Result of a rate limit check. */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/** Rate limit record stored in the database. */
export interface RateLimitRecord {
  key: string;
  requestCount: number;
  windowStart: string;
}

/** Interface for rate limit storage (dependency injection). */
export interface IRateLimitRepository {
  getRecord(key: string): Promise<RateLimitRecord | null>;
  incrementOrCreate(key: string, windowSeconds: number): Promise<RateLimitRecord>;
}

/** Default rate limits per service type. */
const DEFAULT_LIMITS: Record<AIRequest['type'], RateLimitConfig> = {
  ocr: { maxRequests: 50, windowSeconds: 3600 },       // 50/hour
  explain: { maxRequests: 30, windowSeconds: 3600 },    // 30/hour
  qa: { maxRequests: 60, windowSeconds: 3600 },         // 60/hour
  grammar: { maxRequests: 40, windowSeconds: 3600 },    // 40/hour
  revision: { maxRequests: 20, windowSeconds: 3600 },   // 20/hour
  tts: { maxRequests: 100, windowSeconds: 3600 },       // 100/hour
  stt: { maxRequests: 100, windowSeconds: 3600 },       // 100/hour
  embed: { maxRequests: 200, windowSeconds: 3600 },     // 200/hour
};

/** Default per-learner overall rate limit. */
const DEFAULT_LEARNER_LIMIT: RateLimitConfig = {
  maxRequests: 300,
  windowSeconds: 3600, // 300 total AI requests/hour per learner
};

/**
 * Builds the rate limit key for per-learner limiting.
 */
export function buildLearnerRateLimitKey(learnerId: string): string {
  return `learner:${learnerId}`;
}

/**
 * Builds the rate limit key for per-service limiting.
 */
export function buildServiceRateLimitKey(
  learnerId: string,
  serviceType: AIRequest['type']
): string {
  return `service:${learnerId}:${serviceType}`;
}

/**
 * Checks whether a request is allowed under both per-learner
 * and per-service rate limits.
 *
 * Returns the most restrictive result (if either limit is exceeded,
 * the request is denied).
 */
export async function checkRateLimit(
  request: AIRequest,
  rateLimitRepo: IRateLimitRepository,
  overrides?: {
    learnerLimit?: RateLimitConfig;
    serviceLimits?: Partial<Record<AIRequest['type'], RateLimitConfig>>;
  }
): Promise<RateLimitResult> {
  const learnerLimit = overrides?.learnerLimit ?? DEFAULT_LEARNER_LIMIT;
  const serviceLimit =
    overrides?.serviceLimits?.[request.type] ?? DEFAULT_LIMITS[request.type];

  // Check per-learner limit
  const learnerKey = buildLearnerRateLimitKey(request.learnerId);
  const learnerRecord = await rateLimitRepo.incrementOrCreate(
    learnerKey,
    learnerLimit.windowSeconds
  );

  if (learnerRecord.requestCount > learnerLimit.maxRequests) {
    const windowStart = new Date(learnerRecord.windowStart).getTime();
    const windowEnd = windowStart + learnerLimit.windowSeconds * 1000;
    const retryAfterSeconds = Math.ceil((windowEnd - Date.now()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
    };
  }

  // Check per-service limit
  const serviceKey = buildServiceRateLimitKey(request.learnerId, request.type);
  const serviceRecord = await rateLimitRepo.incrementOrCreate(
    serviceKey,
    serviceLimit.windowSeconds
  );

  if (serviceRecord.requestCount > serviceLimit.maxRequests) {
    const windowStart = new Date(serviceRecord.windowStart).getTime();
    const windowEnd = windowStart + serviceLimit.windowSeconds * 1000;
    const retryAfterSeconds = Math.ceil((windowEnd - Date.now()) / 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
    };
  }

  // Both limits OK
  const learnerRemaining = learnerLimit.maxRequests - learnerRecord.requestCount;
  const serviceRemaining = serviceLimit.maxRequests - serviceRecord.requestCount;

  return {
    allowed: true,
    remaining: Math.min(learnerRemaining, serviceRemaining),
  };
}

export { DEFAULT_LIMITS, DEFAULT_LEARNER_LIMIT };
