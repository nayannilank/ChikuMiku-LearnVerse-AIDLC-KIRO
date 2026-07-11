/**
 * Unit tests for the Circuit Breaker module.
 */

import { CircuitBreaker, createServiceCircuitBreakers } from './index';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.state).toBe('CLOSED');
  });

  it('remains CLOSED after successful calls', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, maxRetries: 1, baseDelayMs: 1, maxJitterMs: 0 });

    const result = await cb.execute(async () => 'ok');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('ok');
    }
    expect(cb.state).toBe('CLOSED');
  });

  it('transitions to OPEN after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      maxRetries: 1,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    const failing = async () => { throw new Error('fail'); };

    // Each execute = 1 attempt (maxRetries=1), each adds 1 failure
    await cb.execute(failing);
    expect(cb.state).toBe('CLOSED');

    await cb.execute(failing);
    expect(cb.state).toBe('CLOSED');

    await cb.execute(failing);
    expect(cb.state).toBe('OPEN');
  });

  it('rejects calls immediately when OPEN', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      maxRetries: 1,
      resetTimeoutMs: 60_000,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    // Open the circuit
    await cb.execute(async () => { throw new Error('fail'); });
    expect(cb.state).toBe('OPEN');

    let callMade = false;
    const result = await cb.execute(async () => {
      callMade = true;
      return 'should not reach';
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.circuitOpen).toBe(true);
      expect(result.attempts).toBe(0);
    }
    expect(callMade).toBe(false);
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      maxRetries: 1,
      resetTimeoutMs: 10, // 10ms for fast test
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    await cb.execute(async () => { throw new Error('fail'); });
    expect(cb.state).toBe('OPEN');

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 15));

    expect(cb.state).toBe('HALF_OPEN');
  });

  it('transitions HALF_OPEN to CLOSED on success', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      maxRetries: 1,
      resetTimeoutMs: 10,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    await cb.execute(async () => { throw new Error('fail'); });
    await new Promise(resolve => setTimeout(resolve, 15));
    expect(cb.state).toBe('HALF_OPEN');

    const result = await cb.execute(async () => 'recovered');

    expect(result.success).toBe(true);
    expect(cb.state).toBe('CLOSED');
  });

  it('retries with exponential backoff on failure', async () => {
    let attempts = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 10,
      maxRetries: 3,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    const result = await cb.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary');
      return 'success';
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
    }
  });

  it('returns failure result when all retries exhausted', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 10,
      maxRetries: 3,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    const result = await cb.execute(async () => {
      throw new Error('persistent failure');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.attempts).toBe(3);
      expect(result.error.message).toBe('persistent failure');
    }
  });

  it('calculates exponential backoff delay correctly', () => {
    const cb = new CircuitBreaker({ baseDelayMs: 100, maxJitterMs: 0 });

    // With 0 jitter, delay should be exactly baseDelay * 2^attempt
    const delay0 = cb.calculateBackoffDelay(0);
    const delay1 = cb.calculateBackoffDelay(1);
    const delay2 = cb.calculateBackoffDelay(2);

    expect(delay0).toBe(100);  // 100 * 2^0
    expect(delay1).toBe(200);  // 100 * 2^1
    expect(delay2).toBe(400);  // 100 * 2^2
  });

  it('reset returns to initial CLOSED state', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      maxRetries: 1,
      baseDelayMs: 1,
      maxJitterMs: 0,
    });

    await cb.execute(async () => { throw new Error('fail'); });
    expect(cb.state).toBe('OPEN');

    cb.reset();
    expect(cb.state).toBe('CLOSED');
    expect(cb.failureCount).toBe(0);
  });
});

describe('createServiceCircuitBreakers', () => {
  it('creates breakers for all AI service types', () => {
    const breakers = createServiceCircuitBreakers();

    expect(breakers).toHaveProperty('ocr');
    expect(breakers).toHaveProperty('explain');
    expect(breakers).toHaveProperty('qa');
    expect(breakers).toHaveProperty('grammar');
    expect(breakers).toHaveProperty('revision');
    expect(breakers).toHaveProperty('tts');
    expect(breakers).toHaveProperty('stt');
    expect(breakers).toHaveProperty('embed');
  });

  it('each breaker starts in CLOSED state', () => {
    const breakers = createServiceCircuitBreakers();

    for (const key of Object.keys(breakers)) {
      expect(breakers[key].state).toBe('CLOSED');
    }
  });
});
