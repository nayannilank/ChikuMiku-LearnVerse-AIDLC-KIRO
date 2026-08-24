/**
 * AI Gateway Lambda entrypoint.
 *
 * Constructs the gateway dependency graph once per execution environment
 * (warm-container reuse), then routes each HTTP request through the unified
 * `handleAIRequest` pipeline (validation → rate limit → cache → external call
 * → cache store → cost tracking).
 *
 * Currently wired end-to-end: OCR (Google Vision) and TTS (Google). Other
 * service types return a structured "not implemented" error from the adapter.
 *
 * Environment variables (provided by the AI Gateway CDK stack):
 *   API_KEYS_SECRET_ARN  — Secrets Manager ARN of the third-party API keys blob
 *   AUDIO_ASSETS_BUCKET  — S3 bucket for generated audio (TTS)
 *   PAGE_IMAGES_BUCKET   — S3 bucket holding page images for OCR (optional)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { AIRequest } from '@chikumiku/types';

import { handleAIRequest, type GatewayHandlerDeps } from './handlers/gateway';
import { AIServiceClient } from './handlers/ai-service-client';
import { CachingSecretsManager, type ISecretsManagerClient } from './clients/secrets-manager';
import { AwsSecretsManagerClient } from './clients/aws-secrets-manager';
import { S3ImageByteFetcher } from './clients/s3-image-fetcher';
import { S3UploadClient } from './clients/s3-upload-client';
import { GoogleTTSClient } from './clients/google-tts';
import { NeonEmbeddingRepository } from './clients/neon-embedding-repository';
import { NeonQASessionRepository } from './clients/neon-qa-session-repository';
import type { ITTSClient } from './services/explanation';
import {
  InMemoryCacheRepository,
  InMemoryRateLimitRepository,
  InMemoryCostRepository,
} from './clients/in-memory-repos';
import { createServiceCircuitBreakers } from './circuit-breaker';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

/** Maps an HTTP path to the AIRequest service type it drives. */
const PATH_TO_SERVICE_TYPE: Record<string, AIRequest['type']> = {
  '/ai/ocr': 'ocr',
  '/ai/explain': 'explain',
  '/ai/qa': 'qa',
  '/ai/grammar': 'grammar',
  '/ai/revision': 'revision',
  '/ai/tts': 'tts',
  '/ai/pronunciation/audio': 'tts',
  '/ai/pronunciation/score': 'stt',
  '/ai/embed': 'embed',
};

/**
 * Builds the gateway dependency graph. Called once at module load and reused
 * across warm invocations. Reads configuration from environment variables.
 */
function buildDeps(): GatewayHandlerDeps {
  const apiKeysSecretArn = requireEnv('API_KEYS_SECRET_ARN');
  const audioBucket = process.env.AUDIO_ASSETS_BUCKET;
  const pageImagesBucket = process.env.PAGE_IMAGES_BUCKET ?? audioBucket ?? '';

  const secretsManager = new CachingSecretsManager(
    new AwsSecretsManagerClient({ apiKeysSecretId: apiKeysSecretArn })
  );

  const imageFetcher = new S3ImageByteFetcher({ bucket: pageImagesBucket });
  const s3Client = audioBucket
    ? new S3UploadClient({ bucket: audioBucket })
    : undefined;

  // TTS client for the explanation flow. It needs the Google TTS key, which is
  // resolved lazily (on first synthesize) so buildDeps stays synchronous and
  // no Secrets Manager call happens at cold start unless an explain/tts request
  // actually arrives.
  const ttsClient = new LazyGoogleTTSClient(secretsManager);

  // Neon pgvector repositories. The embedding repo is stateless and shared; the
  // Q&A session repo is learner-scoped, so it's built per request via a factory.
  const embeddingRepo = new NeonEmbeddingRepository();
  const sessionRepoFactory = (learnerId: string) =>
    new NeonQASessionRepository({ learnerId });

  const aiServiceClient = new AIServiceClient({
    imageFetcher,
    s3Client,
    ttsClient,
    embeddingRepo,
    sessionRepoFactory,
  });

  return {
    cacheRepo: new InMemoryCacheRepository(),
    rateLimitRepo: new InMemoryRateLimitRepository(),
    costRepo: new InMemoryCostRepository(),
    secretsManager,
    aiServiceClient,
    circuitBreakers: createServiceCircuitBreakers(),
  };
}

/**
 * TTS client that resolves the Google TTS API key from Secrets Manager on
 * first use, then delegates to a cached GoogleTTSClient. Lets us inject a TTS
 * client without an async cold-start secret fetch.
 */
class LazyGoogleTTSClient implements ITTSClient {
  private delegate: GoogleTTSClient | null = null;

  constructor(private readonly secretsManager: ISecretsManagerClient) {}

  async synthesize(text: string, language: string): Promise<Buffer> {
    if (!this.delegate) {
      const apiKey = await this.secretsManager.getSecret('google-tts-api-key');
      this.delegate = new GoogleTTSClient({ apiKey });
    }
    return this.delegate.synthesize(text, language);
  }
}

/** Reads a required environment variable or throws a clear error. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Lazily initialized so a missing env var surfaces as a 500 per-request rather
// than crashing the module load (which would fail every invocation opaquely).
let cachedDeps: GatewayHandlerDeps | null = null;

function getDeps(): GatewayHandlerDeps {
  if (!cachedDeps) {
    cachedDeps = buildDeps();
  }
  return cachedDeps;
}

/** Maps a GatewayResponse error code to an HTTP status. */
function statusForErrorCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'RATE_LIMITED':
      return 429;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    default:
      return 500;
  }
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed', path, method: httpMethod }),
    };
  }

  const serviceType = PATH_TO_SERVICE_TYPE[path];
  if (!serviceType) {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Not found', path, method: httpMethod }),
    };
  }

  // Parse the request body.
  let body: Record<string, unknown>;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body must be valid JSON' }),
    };
  }

  // Compose the unified AIRequest. The service type is derived from the route;
  // the rest comes from the request body.
  const aiRequest: AIRequest = {
    type: serviceType,
    chapterId: String(body.chapterId ?? ''),
    learnerId: String(body.learnerId ?? ''),
    gradeLevel: String(body.gradeLevel ?? ''),
    payload: (body.payload as Record<string, unknown>) ?? {},
  };

  try {
    const result = await handleAIRequest(aiRequest, getDeps());

    if (!result.success && result.error) {
      return {
        statusCode: statusForErrorCode(result.error.code),
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: result.error.message, code: result.error.code }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ data: result.data, cacheHit: result.cacheHit }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
}
