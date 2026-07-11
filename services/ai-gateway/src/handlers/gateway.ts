/**
 * AI Gateway Handler — Single Lambda Entry Point.
 * Routes all AI requests through unified caching, rate limiting,
 * cost tracking, and circuit breaker layers.
 *
 * Flow:
 * 1. Validate request
 * 2. Check rate limits (per-learner + per-service)
 * 3. Check cache
 * 4. If cache miss: retrieve API key, call external service via circuit breaker
 * 5. Store result in cache
 * 6. Track cost
 * 7. Return response
 *
 * Requirements: 25.1, 25.2, 25.3, 25.6
 */

import type { AIRequest, CacheCheckResult } from '@chikumiku/types';
import type { ICacheRepository } from '../cache';
import type { IRateLimitRepository } from '../rate-limiter';
import type { ICostRepository } from '../cost-tracker';
import type { ISecretsManagerClient, SecretName } from '../clients/secrets-manager';
import { checkCache, storeInCache } from '../cache';
import { checkRateLimit } from '../rate-limiter';
import { trackCost } from '../cost-tracker';
import { getSecretNameForService } from '../clients/secrets-manager';
import { CircuitBreaker } from '../circuit-breaker';

/** Response from the AI Gateway. */
export interface GatewayResponse {
  success: boolean;
  data?: unknown;
  cacheHit: boolean;
  error?: GatewayError;
}

/** Structured error from the gateway. */
export interface GatewayError {
  code: 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

/** Interface for external AI service calls (dependency injection). */
export interface IAIServiceClient {
  invoke(
    serviceType: AIRequest['type'],
    payload: Record<string, unknown>,
    apiKey: string,
    options?: { gradeLevel?: string; chapterId?: string }
  ): Promise<unknown>;
}

/** All dependencies required by the gateway handler. */
export interface GatewayHandlerDeps {
  cacheRepo: ICacheRepository;
  rateLimitRepo: IRateLimitRepository;
  costRepo: ICostRepository;
  secretsManager: ISecretsManagerClient;
  aiServiceClient: IAIServiceClient;
  circuitBreakers: Record<string, CircuitBreaker>;
}

/**
 * Validates an incoming AI request has all required fields.
 */
export function validateAIRequest(body: unknown): GatewayError | null {
  if (!body || typeof body !== 'object') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const request = body as Partial<AIRequest>;

  const validTypes = ['ocr', 'explain', 'qa', 'grammar', 'revision', 'tts', 'stt', 'embed'];

  if (!request.type || !validTypes.includes(request.type)) {
    return {
      code: 'VALIDATION_ERROR',
      message: `Invalid request type. Must be one of: ${validTypes.join(', ')}`,
      retryable: false,
    };
  }

  if (!request.chapterId || typeof request.chapterId !== 'string') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'chapterId is required',
      retryable: false,
    };
  }

  if (!request.learnerId || typeof request.learnerId !== 'string') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'learnerId is required',
      retryable: false,
    };
  }

  if (!request.payload || typeof request.payload !== 'object') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'payload is required and must be an object',
      retryable: false,
    };
  }

  if (!request.gradeLevel || typeof request.gradeLevel !== 'string') {
    return {
      code: 'VALIDATION_ERROR',
      message: 'gradeLevel is required',
      retryable: false,
    };
  }

  return null;
}

/**
 * Main gateway handler.
 * Routes an AI request through the full pipeline:
 * validation → rate limit → cache → external call → store → cost track
 */
export async function handleAIRequest(
  body: unknown,
  deps: GatewayHandlerDeps
): Promise<GatewayResponse> {
  // Step 1: Validate request
  const validationError = validateAIRequest(body);
  if (validationError) {
    return {
      success: false,
      cacheHit: false,
      error: validationError,
    };
  }

  const request = body as AIRequest;

  // Step 2: Check rate limits
  const rateLimitResult = await checkRateLimit(request, deps.rateLimitRepo);

  if (!rateLimitResult.allowed) {
    await trackCost(request, false, deps.costRepo);
    return {
      success: false,
      cacheHit: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please try again later.',
        retryable: true,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      },
    };
  }

  // Step 3: Check cache
  const cacheResult: CacheCheckResult = await checkCache(request, deps.cacheRepo);

  if (cacheResult.cached) {
    // Cache hit — serve stored result, track as zero-cost
    await trackCost(request, true, deps.costRepo);
    return {
      success: true,
      data: cacheResult.data,
      cacheHit: true,
    };
  }

  // Step 4: Cache miss — retrieve API key
  const secretName: SecretName = getSecretNameForService(request.type);
  let apiKey: string;

  try {
    apiKey = await deps.secretsManager.getSecret(secretName);
  } catch (error) {
    return {
      success: false,
      cacheHit: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve service credentials',
        retryable: true,
      },
    };
  }

  // Step 5: Call external AI service via circuit breaker
  const circuitBreaker = deps.circuitBreakers[request.type];

  if (!circuitBreaker) {
    return {
      success: false,
      cacheHit: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `No circuit breaker configured for service: ${request.type}`,
        retryable: false,
      },
    };
  }

  const serviceResult = await circuitBreaker.execute(() =>
    deps.aiServiceClient.invoke(request.type, request.payload, apiKey, {
      gradeLevel: request.gradeLevel,
      chapterId: request.chapterId,
    })
  );

  if (!serviceResult.success) {
    await trackCost(request, false, deps.costRepo);
    return {
      success: false,
      cacheHit: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: serviceResult.circuitOpen
          ? 'Service temporarily unavailable (circuit open). Please retry later.'
          : `External AI service failed after ${serviceResult.attempts} attempts: ${serviceResult.error.message}`,
        retryable: true,
      },
    };
  }

  // Step 6: Store result in cache
  await storeInCache(request, serviceResult.data, deps.cacheRepo);

  // Step 7: Track cost
  await trackCost(request, false, deps.costRepo);

  return {
    success: true,
    data: serviceResult.data,
    cacheHit: false,
  };
}
