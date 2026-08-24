/**
 * AI Service Client — routes gateway requests to concrete external clients.
 *
 * Implements `IAIServiceClient` (see gateway.ts). The gateway calls
 * `invoke(serviceType, payload, apiKey, options)` after resolving the correct
 * API key from Secrets Manager; this adapter dispatches to the matching
 * service implementation.
 *
 * Currently wired end-to-end:
 *   - ocr  -> handleOCRRequest (Google Vision + S3 image fetcher)
 *   - tts  -> GoogleTTSClient.synthesize (+ optional S3 upload)
 *
 * The OpenAI-backed services (explain, qa, grammar, revision, embed) and
 * Whisper STT are not yet implemented and throw a clear, non-retryable error.
 *
 * Requirements: 8.1, 9.1, 10.2, 25.6
 */

import type { AIRequest, QARequest } from '@chikumiku/types';
import type { IAIServiceClient } from './gateway';
import type { IS3Client, ILLMClient, ITTSClient } from '../services/explanation';
import { GoogleVisionClient, type ImageByteFetcher } from '../clients/google-vision';
import { GoogleTTSClient } from '../clients/google-tts';
import { handleOCRRequest, type OCRRequestPayload } from '../services/ocr';
import {
  handleExplanationRequest,
  type ExplanationRequest,
} from '../services/explanation';
import {
  handleGrammarGeneration,
  type GrammarGenerationRequest,
} from '../services/grammar';
import {
  handleRevisionGeneration,
  type RevisionGenerationRequest,
} from '../services/revision';
import {
  handleEmbeddingRequest,
  type EmbeddingRequest,
  type IEmbeddingClient,
  type IEmbeddingRepository,
} from '../services/embedding';
import { handleQARequest, isQAError, type IQASessionRepository } from '../services/qa';
import {
  handlePronunciationScoreRequest,
  type IWhisperClient,
} from '../services/pronunciation';
import { OpenAILLMClient, OpenAIEmbeddingClient } from '../clients/openai';
import { OpenAIWhisperClient } from '../clients/openai-whisper';

/** Dependencies for the AI service client adapter. */
export interface AIServiceClientDeps {
  /** Reads page image bytes from S3 for OCR. */
  imageFetcher: ImageByteFetcher;
  /** Uploads generated audio; optional — when omitted, TTS returns base64. */
  s3Client?: IS3Client;
  /** Per-page OCR timeout override (ms). */
  ocrTimeoutMs?: number;
  /**
   * TTS client used by the explanation flow to synthesize summary audio.
   *
   * The gateway resolves a single API key per request based on the request
   * type — for `explain` that is the OpenAI key. The explanation flow, however,
   * also needs the Google TTS key. So the TTS client must be pre-constructed
   * (with the TTS key resolved at Lambda init) and injected here, rather than
   * built from the per-call `apiKey`. Required to serve `explain`.
   */
  ttsClient?: ITTSClient;
  /**
   * Uploader for explanation audio. Defaults to `s3Client` when omitted.
   * Required (via `s3Client` or this) to serve `explain`.
   */
  explanationS3Client?: IS3Client;
  /** Optional override of the LLM client factory (for testing). */
  llmClientFactory?: (apiKey: string) => ILLMClient;
  /**
   * pgvector-backed embedding store/search. Required to serve `embed` and `qa`
   * (Q&A retrieves RAG context through it). Injected so the Neon repository can
   * be swapped for a fake in tests.
   */
  embeddingRepo?: IEmbeddingRepository;
  /**
   * Factory for a learner-scoped Q&A session repository. Required to serve
   * `qa`. A factory (rather than an instance) because the repository needs the
   * request's learnerId at construction to satisfy the qa_session row.
   */
  sessionRepoFactory?: (learnerId: string) => IQASessionRepository;
  /** Optional override of the embedding client factory (for testing). */
  embeddingClientFactory?: (apiKey: string) => IEmbeddingClient;
  /** Optional override of the Whisper client factory (for testing). */
  whisperClientFactory?: (apiKey: string) => IWhisperClient;
}

/** Payload shape for an stt (pronunciation scoring) request. */
interface SttInvokePayload {
  expectedText: string;
  /** Base64-encoded audio recording (JSON transport can't carry a raw Buffer). */
  audioBase64: string;
  durationSeconds: number;
  language?: string;
}

/** Payload shape for an embed request routed through the gateway. */
interface EmbedInvokePayload extends EmbeddingRequest {}

/** Payload shape for a Q&A request routed through the gateway. */
interface QAInvokePayload extends QARequest {
  /** Session id for follow-up context; a chapter-scoped id when omitted. */
  sessionId?: string;
  /** Learner issuing the question (owns the qa_session row). */
  learnerId: string;
}

/** Payload shape for a TTS request routed through the gateway. */
interface TTSInvokePayload {
  text: string;
  language?: string;
  /** Optional S3 key to store the audio under. */
  s3Key?: string;
}

/**
 * Concrete `IAIServiceClient` that dispatches to Google Vision (OCR) and
 * Google TTS. The API key is supplied per-call by the gateway (already
 * resolved from Secrets Manager for the request type).
 */
export class AIServiceClient implements IAIServiceClient {
  private readonly deps: AIServiceClientDeps;

  constructor(deps: AIServiceClientDeps) {
    this.deps = deps;
  }

  async invoke(
    serviceType: AIRequest['type'],
    payload: Record<string, unknown>,
    apiKey: string,
    _options?: { gradeLevel?: string; chapterId?: string }
  ): Promise<unknown> {
    switch (serviceType) {
      case 'ocr':
        return this.invokeOcr(payload, apiKey);
      case 'tts':
        return this.invokeTts(payload, apiKey);
      case 'explain':
        return this.invokeExplain(payload, apiKey);
      case 'grammar':
        return this.invokeGrammar(payload, apiKey);
      case 'revision':
        return this.invokeRevision(payload, apiKey);
      case 'embed':
        return this.invokeEmbed(payload, apiKey);
      case 'qa':
        return this.invokeQa(payload, apiKey);
      case 'stt':
        return this.invokeStt(payload, apiKey);
      default:
        throw new Error(`Unknown AI service type: ${serviceType}`);
    }
  }

  /** Runs OCR over the requested page image S3 keys via Google Vision. */
  private async invokeOcr(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const ocrPayload = payload as unknown as OCRRequestPayload;

    if (!Array.isArray(ocrPayload.imageS3Keys)) {
      throw new Error('OCR payload requires "imageS3Keys" (string[])');
    }

    const visionClient = new GoogleVisionClient({
      imageFetcher: this.deps.imageFetcher,
    });

    return handleOCRRequest(ocrPayload, {
      visionClient,
      apiKey,
      timeoutMs: this.deps.ocrTimeoutMs,
    });
  }

  /** Synthesizes speech via Google TTS; optionally persists it to S3. */
  private async invokeTts(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const ttsPayload = payload as unknown as TTSInvokePayload;

    if (!ttsPayload.text || typeof ttsPayload.text !== 'string') {
      throw new Error('TTS payload requires "text" (string)');
    }

    const ttsClient = new GoogleTTSClient({ apiKey });
    const audioBuffer = await ttsClient.synthesize(
      ttsPayload.text,
      ttsPayload.language ?? 'en'
    );

    // Persist to S3 when both an uploader and a key are available.
    if (this.deps.s3Client && ttsPayload.s3Key) {
      const audioUrl = await this.deps.s3Client.upload(
        ttsPayload.s3Key,
        audioBuffer,
        'audio/mpeg'
      );
      return { audioUrl };
    }

    // Otherwise return the audio inline as base64 for the caller to handle.
    return { audioBase64: audioBuffer.toString('base64'), encoding: 'mp3' };
  }

  /** Builds an OpenAI LLM client for the given key (overridable for tests). */
  private makeLlmClient(apiKey: string): ILLMClient {
    if (this.deps.llmClientFactory) {
      return this.deps.llmClientFactory(apiKey);
    }
    return new OpenAILLMClient({ apiKey });
  }

  /** Generates page explanations (GPT-5 Mini) with TTS audio for summaries. */
  private async invokeExplain(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as ExplanationRequest;

    if (!Array.isArray(request.pages)) {
      throw new Error('Explanation payload requires "pages" (array)');
    }

    const s3Client = this.deps.explanationS3Client ?? this.deps.s3Client;
    if (!this.deps.ttsClient || !s3Client) {
      throw new Error(
        'Explanation requires a configured TTS client and S3 uploader'
      );
    }

    return handleExplanationRequest(request, {
      llmClient: this.makeLlmClient(apiKey),
      ttsClient: this.deps.ttsClient,
      s3Client,
    });
  }

  /** Generates grammar exercises (GPT-5 Mini). */
  private async invokeGrammar(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as GrammarGenerationRequest;

    if (!request.transcript || typeof request.transcript !== 'string') {
      throw new Error('Grammar payload requires "transcript" (string)');
    }

    return handleGrammarGeneration(request, {
      llmClient: this.makeLlmClient(apiKey),
    });
  }

  /** Generates a revision quiz (GPT-5 Mini). */
  private async invokeRevision(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as RevisionGenerationRequest;

    if (!request.transcript || typeof request.transcript !== 'string') {
      throw new Error('Revision payload requires "transcript" (string)');
    }

    return handleRevisionGeneration(request, {
      llmClient: this.makeLlmClient(apiKey),
    });
  }

  /** Builds an OpenAI embedding client for the given key (overridable). */
  private makeEmbeddingClient(apiKey: string): IEmbeddingClient {
    if (this.deps.embeddingClientFactory) {
      return this.deps.embeddingClientFactory(apiKey);
    }
    return new OpenAIEmbeddingClient({ apiKey });
  }

  /** Chunks + embeds a chapter transcript and stores vectors in pgvector. */
  private async invokeEmbed(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as EmbedInvokePayload;

    if (!Array.isArray(request.pages)) {
      throw new Error('Embed payload requires "pages" (array)');
    }
    if (!this.deps.embeddingRepo) {
      throw new Error('Embedding requires a configured embedding repository');
    }

    return handleEmbeddingRequest(request, {
      embeddingClient: this.makeEmbeddingClient(apiKey),
      embeddingRepo: this.deps.embeddingRepo,
    });
  }

  /** Answers a chapter question using RAG (pgvector) + GPT-5 Mini. */
  private async invokeQa(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as QAInvokePayload;

    if (!request.question || typeof request.question !== 'string') {
      throw new Error('Q&A payload requires "question" (string)');
    }
    if (!request.learnerId || typeof request.learnerId !== 'string') {
      throw new Error('Q&A payload requires "learnerId" (string)');
    }
    if (!this.deps.embeddingRepo || !this.deps.sessionRepoFactory) {
      throw new Error(
        'Q&A requires a configured embedding repository and session repository factory'
      );
    }

    // A stable session id enables follow-up context; default to a
    // chapter+learner-scoped id when the caller does not supply one.
    const sessionId =
      request.sessionId ?? `${request.learnerId}:${request.chapterId}`;

    const result = await handleQARequest(request, sessionId, {
      llmClient: this.makeLlmClient(apiKey),
      embeddingDeps: {
        embeddingClient: this.makeEmbeddingClient(apiKey),
        embeddingRepo: this.deps.embeddingRepo,
      },
      sessionRepo: this.deps.sessionRepoFactory(request.learnerId),
    });

    // The handler returns a structured QAError for expected failures (no
    // content, generation failure); surface it as an error so the gateway maps
    // it to a non-2xx response rather than caching an error body.
    if (isQAError(result)) {
      throw new Error(`Q&A failed (${result.code}): ${result.message}`);
    }

    return result;
  }

  /** Builds an OpenAI Whisper client for the given key (overridable). */
  private makeWhisperClient(apiKey: string): IWhisperClient {
    if (this.deps.whisperClientFactory) {
      return this.deps.whisperClientFactory(apiKey);
    }
    return new OpenAIWhisperClient({ apiKey });
  }

  /** Transcribes a learner recording (Whisper) and scores pronunciation. */
  private async invokeStt(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<unknown> {
    const request = payload as unknown as SttInvokePayload;

    if (!request.expectedText || typeof request.expectedText !== 'string') {
      throw new Error('Pronunciation scoring requires "expectedText" (string)');
    }
    if (!request.audioBase64 || typeof request.audioBase64 !== 'string') {
      throw new Error(
        'Pronunciation scoring requires "audioBase64" (base64-encoded audio)'
      );
    }
    if (typeof request.durationSeconds !== 'number') {
      throw new Error('Pronunciation scoring requires "durationSeconds" (number)');
    }

    const audioBuffer = Buffer.from(request.audioBase64, 'base64');

    return handlePronunciationScoreRequest(
      {
        expectedText: request.expectedText,
        audioBuffer,
        durationSeconds: request.durationSeconds,
        language: request.language,
      },
      { whisperClient: this.makeWhisperClient(apiKey) }
    );
  }
}
