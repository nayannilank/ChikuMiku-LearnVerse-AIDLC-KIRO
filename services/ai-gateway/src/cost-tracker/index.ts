/**
 * Cost Tracker Module.
 * Tracks AI usage costs per request type for monitoring and budgeting.
 *
 * Records each AI call with estimated cost based on service pricing.
 * Requirements: 25.1, 25.6
 */

import type { AIRequest } from '@chikumiku/types';

/** Cost record for a single AI request. */
export interface CostRecord {
  id?: string;
  requestType: AIRequest['type'];
  learnerId: string;
  chapterId: string;
  /** Estimated cost in USD (micro-cents for precision). */
  estimatedCostUsd: number;
  /** Whether the response was served from cache (no external cost). */
  cacheHit: boolean;
  timestamp: string;
  /** Number of input tokens (if applicable). */
  inputTokens?: number;
  /** Number of output tokens (if applicable). */
  outputTokens?: number;
}

/** Aggregated cost summary for reporting. */
export interface CostSummary {
  totalCostUsd: number;
  totalRequests: number;
  cacheHitRate: number;
  costByType: Record<string, { cost: number; count: number }>;
}

/** Interface for cost tracking storage (dependency injection). */
export interface ICostRepository {
  record(entry: CostRecord): Promise<void>;
  getSummary(startDate: string, endDate: string): Promise<CostSummary>;
}

/** Estimated cost per request type in USD. */
const COST_PER_REQUEST: Record<AIRequest['type'], number> = {
  ocr: 0.0015,      // Google Vision: ~$1.50 per 1000 pages
  explain: 0.003,   // GPT-5 Mini: ~$0.003 per explanation
  qa: 0.004,        // GPT-5 Mini + RAG: ~$0.004 per Q&A
  grammar: 0.003,   // GPT-5 Mini: ~$0.003 per grammar set
  revision: 0.005,  // GPT-5 Mini: ~$0.005 per revision set
  tts: 0.001,       // Google TTS: ~$0.001 per audio clip
  stt: 0.002,       // Whisper: ~$0.002 per pronunciation check
  embed: 0.0001,    // OpenAI Embeddings: ~$0.0001 per chunk
};

/**
 * Tracks the cost of an AI request.
 * If the result was served from cache, cost is recorded as 0.
 */
export async function trackCost(
  request: AIRequest,
  cacheHit: boolean,
  costRepo: ICostRepository,
  options?: { inputTokens?: number; outputTokens?: number }
): Promise<CostRecord> {
  const estimatedCostUsd = cacheHit ? 0 : getEstimatedCost(request.type);

  const record: CostRecord = {
    requestType: request.type,
    learnerId: request.learnerId,
    chapterId: request.chapterId,
    estimatedCostUsd,
    cacheHit,
    timestamp: new Date().toISOString(),
    inputTokens: options?.inputTokens,
    outputTokens: options?.outputTokens,
  };

  await costRepo.record(record);

  return record;
}

/**
 * Returns the estimated cost in USD for a given request type.
 */
export function getEstimatedCost(requestType: AIRequest['type']): number {
  return COST_PER_REQUEST[requestType] ?? 0;
}

export { COST_PER_REQUEST };
