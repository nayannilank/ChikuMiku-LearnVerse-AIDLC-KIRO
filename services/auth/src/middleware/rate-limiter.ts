/**
 * Application-layer rate limiting utility.
 *
 * Provides token-bucket rate limiting per client/endpoint combination.
 * This supplements API Gateway throttling with finer-grained control
 * (e.g., per-user limits on sensitive endpoints like password reset).
 *
 * Uses an in-memory store for single-instance Lambdas. For distributed
 * rate limiting across multiple Lambda instances, replace the store
 * with a DynamoDB-backed adapter (same interface).
 *
 * Requirements: 20.1, 20.4
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window. */
  maxRequests: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Number of remaining requests in the current window. */
  remaining: number;
  /** Milliseconds until the window resets. */
  retryAfterMs: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/** Default rate limit configurations for different endpoint categories. */
export const RATE_LIMIT_CONFIGS = {
  /** Login attempts: 10 per 15 minutes per IP/user */
  auth: { maxRequests: 10, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  /** OTP/password reset: 5 per 15 minutes per IP/user */
  passwordReset: { maxRequests: 5, windowMs: 15 * 60 * 1000 } satisfies RateLimitConfig,
  /** General API: 100 per minute per user */
  general: { maxRequests: 100, windowMs: 60 * 1000 } satisfies RateLimitConfig,
  /** AI-powered endpoints: 30 per minute per user */
  ai: { maxRequests: 30, windowMs: 60 * 1000 } satisfies RateLimitConfig,
} as const;

/**
 * In-memory rate limit store using token bucket algorithm.
 * Each key represents a unique client+endpoint combination.
 */
export class RateLimitStore {
  private buckets = new Map<string, TokenBucket>();

  /**
   * Check if a request is allowed and consume a token if so.
   *
   * @param key - Unique identifier for the rate limit bucket (e.g., "userId:endpoint")
   * @param config - Rate limit configuration for this endpoint
   * @param now - Current timestamp in ms (injectable for testing)
   * @returns RateLimitResult indicating whether the request is allowed
   */
  checkAndConsume(key: string, config: RateLimitConfig, now: number = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      // First request — create bucket with one token consumed
      this.buckets.set(key, { tokens: config.maxRequests - 1, lastRefill: now });
      return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
    }

    // Calculate token refill based on elapsed time
    const elapsed = now - bucket.lastRefill;

    if (elapsed >= config.windowMs) {
      // Window has fully elapsed — reset bucket
      bucket.tokens = config.maxRequests - 1;
      bucket.lastRefill = now;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
    }

    // Window still active — check remaining tokens
    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: bucket.tokens, retryAfterMs: 0 };
    }

    // No tokens remaining — request denied
    const retryAfterMs = config.windowMs - elapsed;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  /**
   * Reset a specific rate limit bucket (e.g., after successful authentication).
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Clean up expired buckets to prevent memory leaks.
   * Call periodically (e.g., every 5 minutes).
   */
  cleanup(now: number = Date.now()): void {
    const maxWindowMs = Math.max(
      ...Object.values(RATE_LIMIT_CONFIGS).map((c) => c.windowMs)
    );

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxWindowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Builds a rate limit key from user identifier and endpoint category.
 *
 * @param identifier - User ID, IP address, or combined identifier
 * @param endpoint - Endpoint category (e.g., 'auth', 'general')
 */
export function buildRateLimitKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`;
}
