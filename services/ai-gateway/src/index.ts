/**
 * AI Gateway Service.
 * Single entry point for all external AI service interactions.
 * Provides unified caching, rate limiting, cost tracking,
 * and circuit breaker protection.
 *
 * Requirements: 25.1, 25.2, 25.3, 25.6
 */

// Cache module
export {
  checkCache,
  storeInCache,
  invalidateChapterCache,
  buildCacheKey,
  computeContentHash,
} from './cache';
export type { ICacheRepository, CacheEntry } from './cache';

// Rate limiter module
export {
  checkRateLimit,
  buildLearnerRateLimitKey,
  buildServiceRateLimitKey,
  DEFAULT_LIMITS,
  DEFAULT_LEARNER_LIMIT,
} from './rate-limiter';
export type {
  IRateLimitRepository,
  RateLimitConfig,
  RateLimitResult,
  RateLimitRecord,
} from './rate-limiter';

// Circuit breaker module
export {
  CircuitBreaker,
  createServiceCircuitBreakers,
} from './circuit-breaker';
export type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerResult,
} from './circuit-breaker';

// Cost tracker module
export {
  trackCost,
  getEstimatedCost,
  COST_PER_REQUEST,
} from './cost-tracker';
export type { ICostRepository, CostRecord, CostSummary } from './cost-tracker';

// Secrets manager client
export {
  CachingSecretsManager,
  getSecretNameForService,
} from './clients/secrets-manager';
export type { ISecretsManagerClient, SecretName } from './clients/secrets-manager';

// Google Cloud Vision OCR client
export { GoogleVisionClient, mapVisionResponse } from './clients/google-vision';
export type {
  ImageByteFetcher,
  GoogleVisionClientOptions,
} from './clients/google-vision';

// Google Text-to-Speech client
export {
  GoogleTTSClient,
  resolveVoice,
  DEFAULT_VOICE_MAP,
} from './clients/google-tts';
export type {
  GoogleTTSClientOptions,
  VoiceConfig,
} from './clients/google-tts';

// S3 image-byte fetcher (for Vision OCR)
export { S3ImageByteFetcher } from './clients/s3-image-fetcher';
export type { S3ImageByteFetcherOptions } from './clients/s3-image-fetcher';

// S3 upload client (for TTS audio)
export { S3UploadClient } from './clients/s3-upload-client';
export type { S3UploadClientOptions } from './clients/s3-upload-client';

// AWS Secrets Manager client (concrete)
export { AwsSecretsManagerClient, getRawSecret } from './clients/aws-secrets-manager';
export type { AwsSecretsManagerClientOptions } from './clients/aws-secrets-manager';

// In-memory repositories (placeholders pending Neon-backed repos)
export {
  InMemoryCacheRepository,
  InMemoryRateLimitRepository,
  InMemoryCostRepository,
} from './clients/in-memory-repos';

// OpenAI clients (GPT-5 Mini chat + text-embedding-3-small)
export {
  OpenAILLMClient,
  OpenAIEmbeddingClient,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
} from './clients/openai';
export type {
  OpenAILLMClientOptions,
  OpenAIEmbeddingClientOptions,
} from './clients/openai';

// OpenAI Whisper speech-to-text client
export {
  OpenAIWhisperClient,
  DEFAULT_WHISPER_MODEL,
  logprobToConfidence,
} from './clients/openai-whisper';
export type { OpenAIWhisperClientOptions } from './clients/openai-whisper';

// Neon PostgreSQL connection + pgvector repositories
export { getPool, query, withTransaction, toVector, closePool } from '@chikumiku/db';
export { NeonEmbeddingRepository } from './clients/neon-embedding-repository';
export type { NeonEmbeddingRepositoryOptions } from './clients/neon-embedding-repository';
export { NeonQASessionRepository } from './clients/neon-qa-session-repository';
export type { NeonQASessionRepositoryOptions } from './clients/neon-qa-session-repository';

// AI service client adapter (routes gateway requests to concrete clients)
export { AIServiceClient } from './handlers/ai-service-client';
export type { AIServiceClientDeps } from './handlers/ai-service-client';

// Gateway handler
export {
  handleAIRequest,
  validateAIRequest,
} from './handlers/gateway';
export type {
  GatewayResponse,
  GatewayError,
  IAIServiceClient,
  GatewayHandlerDeps,
} from './handlers/gateway';

// Explanation service
export {
  handleExplanationRequest,
  buildExplanationPrompt,
  parseLLMResponse,
  validateAndNormalizeExplanation,
  getComplexityLevel,
  buildAudioS3Key,
} from './services/explanation';
export type {
  ILLMClient,
  LLMOptions,
  ITTSClient,
  IS3Client,
  ExplanationDeps,
  ExplanationRequest,
  TranscriptPageInput,
  ParsedExplanation,
  ComplexityLevel,
} from './services/explanation';

// OCR service
export {
  handleOCRRequest,
  processPage,
  withTimeout,
  DEFAULT_PAGE_TIMEOUT_MS,
} from './services/ocr';
export type {
  OCRResult,
  OCRPageResult,
  OCRResponse,
  OCRRequestPayload,
  IGoogleVisionClient,
  OCRHandlerDeps,
} from './services/ocr';

// Embedding service (RAG)
export {
  estimateTokens,
  splitIntoChunks,
  handleEmbeddingRequest,
  handleEmbeddingRegeneration,
  searchSimilar,
} from './services/embedding';
export type {
  TextChunk,
  EmbeddingResult,
  EmbeddingRequest,
  IEmbeddingClient,
  IEmbeddingRepository,
  EmbeddingDeps,
} from './services/embedding';

// Pronunciation service
export {
  extractPracticeItems,
  handlePronunciationAudioRequest,
  handlePronunciationScoreRequest,
  scorePronunciation,
  classifyColor,
  calculateTokenAccuracy,
  levenshteinDistance,
  tokenize,
  buildPronunciationAudioS3Key,
  MAX_RECORDING_DURATION_SECONDS,
  MIN_PRACTICE_ITEMS,
  MAX_PRACTICE_ITEMS,
  DEFAULT_PRACTICE_ITEMS,
} from './services/pronunciation';
export type {
  IWhisperClient,
  TranscriptionResult,
  TranscriptionSegment,
  PronunciationAudioDeps,
  PronunciationScoreDeps,
  PronunciationAudioRequest,
  PronunciationAudioResponse,
  PracticeItem,
  PronunciationScoreRequest,
} from './services/pronunciation';

// Grammar service
export {
  handleGrammarGeneration,
  handleGrammarFeedback,
  assessContentSufficiency,
  determineExerciseCount,
  getLimitedContentMessage,
  buildGrammarPrompt,
  parseGrammarResponse,
  buildFeedbackPrompt,
  parseFeedbackResponse,
  getGradeInstructions,
  countWords,
} from './services/grammar';
export type {
  GrammarExerciseType,
  GrammarExercise,
  GrammarGenerationResult,
  GrammarFeedback,
  ContentSufficiency,
  GrammarDeps,
  GrammarGenerationRequest,
  GrammarFeedbackRequest,
} from './services/grammar';

// Q&A service (RAG + GPT-5 Mini)
export {
  handleQARequest,
  validateQuestion,
  isMultiStepQuestion,
  buildQAPrompt,
  parseStepByStepResponse,
  withGenerationTimeout,
  isQAError,
} from './services/qa';
export type {
  QAResponse,
  QASession,
  QAError,
  IQASessionRepository,
  QADeps,
} from './services/qa';

// Revision service
export {
  handleRevisionGeneration,
  getSubjectSpecificTypes,
  getDefaultQuestionCount,
  clampQuestionCount,
  buildRevisionPrompt,
  parseRevisionResponse,
} from './services/revision';
export type {
  DifficultyLevel,
  QuestionType,
  RevisionQuestion,
  RevisionGenerationRequest,
  RevisionGenerationResult,
  RevisionDeps,
} from './services/revision';
