/**
 * Circuit Breaker Module.
 * Implements the circuit breaker pattern with exponential backoff
 * to protect against cascading failures from external AI services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Blocking all requests (service is considered down)
 * - HALF_OPEN: Testing recovery with a single request
 *
 * Uses exponential backoff: delay = baseDelay * 2^attempt (with jitter)
 * Max retries: 3
 *
 * Requirements: 25.6
 */

/** Circuit breaker states. */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Configuration for the circuit breaker. */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 3 */
  failureThreshold: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN. Default: 30000 */
  resetTimeoutMs: number;
  /** Base delay in ms for exponential backoff. Default: 1000 */
  baseDelayMs: number;
  /** Maximum retries per request. Default: 3 */
  maxRetries: number;
  /** Maximum jitter in ms added to backoff delay. Default: 500 */
  maxJitterMs: number;
}

/** Internal state of a circuit breaker instance. */
export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  consecutiveSuccesses: number;
}

/** Result of executing a function through the circuit breaker. */
export type CircuitBreakerResult<T> =
  | { success: true; data: T; attempts: number }
  | { success: false; error: Error; attempts: number; circuitOpen: boolean };

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  baseDelayMs: 1_000,
  maxRetries: 3,
  maxJitterMs: 500,
};

/**
 * Circuit Breaker implementation.
 * One instance per external AI service (Google Vision, GPT-5 Mini, etc.).
 */
export class CircuitBreaker {
  private internalState: CircuitBreakerState;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.internalState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      consecutiveSuccesses: 0,
    };
  }

  /** Returns the current circuit state. */
  get state(): CircuitState {
    return this.getEffectiveState();
  }

  /** Returns the current failure count. */
  get failureCount(): number {
    return this.internalState.failureCount;
  }

  /**
   * Determines the effective state, transitioning OPEN → HALF_OPEN
   * when the reset timeout has elapsed.
   */
  private getEffectiveState(): CircuitState {
    if (this.internalState.state === 'OPEN') {
      const elapsed = Date.now() - this.internalState.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.internalState.state = 'HALF_OPEN';
      }
    }
    return this.internalState.state;
  }

  /**
   * Executes an async function through the circuit breaker with retries.
   * Uses exponential backoff with jitter on failures.
   */
  async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
    const effectiveState = this.getEffectiveState();

    // If circuit is OPEN, reject immediately
    if (effectiveState === 'OPEN') {
      return {
        success: false,
        error: new Error('Circuit breaker is OPEN — service unavailable'),
        attempts: 0,
        circuitOpen: true,
      };
    }

    // Attempt execution with retries
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Apply backoff delay for retries (not the first attempt)
        if (attempt > 0) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }

        const result = await fn();

        // Success — reset failure state
        this.onSuccess();

        return {
          success: true,
          data: result,
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.onFailure();

        // If circuit just opened, stop retrying
        if (this.internalState.state === 'OPEN') {
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            circuitOpen: true,
          };
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError,
      attempts: this.config.maxRetries,
      circuitOpen: this.internalState.state === 'OPEN',
    };
  }

  /**
   * Records a successful call. Transitions HALF_OPEN → CLOSED
   * and resets failure counters.
   */
  private onSuccess(): void {
    this.internalState.failureCount = 0;
    this.internalState.consecutiveSuccesses += 1;

    if (this.internalState.state === 'HALF_OPEN') {
      this.internalState.state = 'CLOSED';
    }
  }

  /**
   * Records a failed call. If failures reach the threshold,
   * transitions to OPEN state.
   */
  private onFailure(): void {
    this.internalState.failureCount += 1;
    this.internalState.lastFailureTime = Date.now();
    this.internalState.consecutiveSuccesses = 0;

    if (this.internalState.failureCount >= this.config.failureThreshold) {
      this.internalState.state = 'OPEN';
    }
  }

  /**
   * Calculates the backoff delay for a given attempt.
   * Formula: baseDelay * 2^attempt + random jitter
   */
  calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * this.config.maxJitterMs;
    return exponentialDelay + jitter;
  }

  /** Resets the circuit breaker to its initial CLOSED state. */
  reset(): void {
    this.internalState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      consecutiveSuccesses: 0,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Creates a map of circuit breakers for each AI service type.
 */
export function createServiceCircuitBreakers(
  config?: Partial<CircuitBreakerConfig>
): Record<string, CircuitBreaker> {
  const services = ['ocr', 'explain', 'qa', 'grammar', 'revision', 'tts', 'stt', 'embed'];
  const breakers: Record<string, CircuitBreaker> = {};

  for (const service of services) {
    breakers[service] = new CircuitBreaker(config);
  }

  return breakers;
}
