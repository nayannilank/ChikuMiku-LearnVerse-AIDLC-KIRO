/**
 * Unit tests for rate limiting utility.
 * Validates: Requirements 20.1, 20.4
 */

import {
  RateLimitStore,
  RATE_LIMIT_CONFIGS,
  buildRateLimitKey,
  RateLimitConfig,
} from './rate-limiter';

describe('RateLimitStore', () => {
  let store: RateLimitStore;
  const config: RateLimitConfig = { maxRequests: 3, windowMs: 60000 };

  beforeEach(() => {
    store = new RateLimitStore();
  });

  it('allows the first request', () => {
    const result = store.checkAndConsume('user1:auth', config, 1000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfterMs).toBe(0);
  });

  it('decrements remaining tokens on each request', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    const result = store.checkAndConsume('user1:auth', config, 2000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('denies request when tokens are exhausted', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user1:auth', config, 2000);
    store.checkAndConsume('user1:auth', config, 3000);
    const result = store.checkAndConsume('user1:auth', config, 4000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('calculates correct retryAfterMs', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user1:auth', config, 2000);
    store.checkAndConsume('user1:auth', config, 3000);
    const result = store.checkAndConsume('user1:auth', config, 10000);

    expect(result.retryAfterMs).toBe(60000 - (10000 - 1000));
  });

  it('resets tokens after window elapses', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user1:auth', config, 2000);
    store.checkAndConsume('user1:auth', config, 3000);

    // Window fully elapsed
    const result = store.checkAndConsume('user1:auth', config, 62000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('isolates different keys', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user1:auth', config, 2000);
    store.checkAndConsume('user1:auth', config, 3000);

    // Different user still has full quota
    const result = store.checkAndConsume('user2:auth', config, 4000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('reset clears the bucket for a key', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user1:auth', config, 2000);
    store.checkAndConsume('user1:auth', config, 3000);

    store.reset('user1:auth');

    const result = store.checkAndConsume('user1:auth', config, 4000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('cleanup removes expired buckets', () => {
    store.checkAndConsume('user1:auth', config, 1000);
    store.checkAndConsume('user2:auth', config, 500000);

    // Clean up at a time well past the window for user1
    store.cleanup(2000000);

    // user1 bucket should be cleaned — new request acts as first
    const result = store.checkAndConsume('user1:auth', config, 2000000);
    expect(result.remaining).toBe(2);
  });
});

describe('RATE_LIMIT_CONFIGS', () => {
  it('auth config allows 10 requests per 15 minutes', () => {
    expect(RATE_LIMIT_CONFIGS.auth.maxRequests).toBe(10);
    expect(RATE_LIMIT_CONFIGS.auth.windowMs).toBe(15 * 60 * 1000);
  });

  it('passwordReset config allows 5 requests per 15 minutes', () => {
    expect(RATE_LIMIT_CONFIGS.passwordReset.maxRequests).toBe(5);
    expect(RATE_LIMIT_CONFIGS.passwordReset.windowMs).toBe(15 * 60 * 1000);
  });

  it('general config allows 100 requests per minute', () => {
    expect(RATE_LIMIT_CONFIGS.general.maxRequests).toBe(100);
    expect(RATE_LIMIT_CONFIGS.general.windowMs).toBe(60 * 1000);
  });

  it('ai config allows 30 requests per minute', () => {
    expect(RATE_LIMIT_CONFIGS.ai.maxRequests).toBe(30);
    expect(RATE_LIMIT_CONFIGS.ai.windowMs).toBe(60 * 1000);
  });
});

describe('buildRateLimitKey', () => {
  it('builds key from identifier and endpoint', () => {
    expect(buildRateLimitKey('user-123', 'auth')).toBe('user-123:auth');
  });

  it('handles IP addresses', () => {
    expect(buildRateLimitKey('192.168.1.1', 'general')).toBe('192.168.1.1:general');
  });
});
