/**
 * AI Gateway type definitions.
 * Covers AI requests, caching, explanations, pronunciation, Q&A, and RAG.
 */

/** Unified AI request routed through the AI Gateway. */
export interface AIRequest {
  type: 'ocr' | 'explain' | 'qa' | 'grammar' | 'revision' | 'tts' | 'stt' | 'embed';
  chapterId: string;
  payload: Record<string, unknown>;
  learnerId: string;
  gradeLevel: string;
}

/** Result of checking the AI response cache. */
export interface CacheCheckResult {
  cached: boolean;
  data?: unknown;
  cacheKey: string;
}

/** AI-generated explanation for a content page. */
export interface ExplanationResult {
  pageNumber: number;
  /** Max 200 words */
  summary: string;
  /** 3-10 items */
  keywords: string[];
  /** 1-5 items */
  concepts: string[];
  /** S3 pre-signed URL */
  audioUrl?: string;
}

/** Pronunciation scoring result. */
export interface PronunciationScore {
  /** 0-100 */
  overallScore: number;
  syllables: SyllableResult[];
}

/** Individual syllable scoring within a pronunciation assessment. */
export interface SyllableResult {
  text: string;
  /** 0-100 */
  accuracy: number;
  /** >=80 green, 40-79 yellow, <40 red */
  color: 'green' | 'yellow' | 'red';
}

/** Q&A request with chapter context and session history. */
export interface QARequest {
  chapterId: string;
  /** 1-500 chars */
  question: string;
  /** Up to 20 prior Q&A pairs */
  sessionContext: string[];
  gradeLevel: string;
}

/** RAG retrieval context for Q&A answers. */
export interface RAGContext {
  /** Top 5 relevant paragraphs */
  paragraphs: string[];
  similarity_scores: number[];
}
