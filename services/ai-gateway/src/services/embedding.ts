/**
 * Embedding Generation Service for RAG.
 * Splits chapter transcripts into ~500-token chunks, embeds with
 * text-embedding-3-small, and stores in Aurora pgvector.
 *
 * Supports:
 * - Initial embedding on first chapter transcript save
 * - Regeneration when transcript is edited
 * - Similarity search for Q&A RAG retrieval
 *
 * Requirements: 25.4
 */

import type { RAGContext } from '@chikumiku/types';

// --- Types ---

/** A chunk of text split from a page for embedding. */
export interface TextChunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
}

/** Result of embedding a text chunk. */
export interface EmbeddingResult {
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
  content: string;
}

/** Request payload for embedding generation. */
export interface EmbeddingRequest {
  chapterId: string;
  pages: { pageNumber: number; text: string }[];
}

// --- Interfaces (Dependency Injection) ---

/** Interface for embedding model client (text-embedding-3-small). */
export interface IEmbeddingClient {
  embed(texts: string[]): Promise<number[][]>;
}

/** Interface for embedding storage (Aurora pgvector). */
export interface IEmbeddingRepository {
  store(chapterId: string, embeddings: EmbeddingResult[]): Promise<void>;
  deleteByChapter(chapterId: string): Promise<void>;
  search(
    embedding: number[],
    chapterId: string,
    topK: number
  ): Promise<{ content: string; score: number }[]>;
}

/** Dependencies for embedding operations. */
export interface EmbeddingDeps {
  embeddingClient: IEmbeddingClient;
  embeddingRepo: IEmbeddingRepository;
}

// --- Constants ---

/** Target number of tokens per chunk. */
const DEFAULT_TARGET_TOKENS = 500;

/** Overlap tokens between consecutive chunks for context continuity. */
const OVERLAP_TOKENS = 50;

/** Approximate token-to-word ratio (1 token ≈ 0.75 words). */
const TOKEN_TO_WORD_RATIO = 0.75;

/** Number of top similar results to return for RAG. */
const DEFAULT_TOP_K = 5;

// --- Core Functions ---

/**
 * Estimates token count from text using word count × 0.75.
 */
export function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.ceil(wordCount * TOKEN_TO_WORD_RATIO);
}

/**
 * Splits text into chunks of approximately targetTokens tokens.
 * Prefers splitting on sentence boundaries.
 * Maintains ~50 token overlap between consecutive chunks for context continuity.
 */
export function splitIntoChunks(
  text: string,
  pageNumber: number,
  targetTokens: number = DEFAULT_TARGET_TOKENS
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const sentences = splitIntoSentences(text);

  if (sentences.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  // Target word count derived from token target
  const targetWords = Math.floor(targetTokens / TOKEN_TO_WORD_RATIO);
  const overlapWords = Math.floor(OVERLAP_TOKENS / TOKEN_TO_WORD_RATIO);

  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).filter(w => w.length > 0).length;
    const sentenceTokens = Math.ceil(sentenceWordCount * TOKEN_TO_WORD_RATIO);

    // If adding this sentence exceeds the target and we have content, finalize current chunk
    if (currentTokens + sentenceTokens > targetTokens && currentSentences.length > 0) {
      const content = currentSentences.join(' ').trim();
      chunks.push({
        pageNumber,
        chunkIndex,
        content,
        tokenEstimate: estimateTokens(content),
      });
      chunkIndex++;

      // Apply overlap: take trailing sentences that fit within overlap budget
      const overlapSentences = getOverlapSentences(currentSentences, overlapWords);
      currentSentences = overlapSentences;
      currentTokens = estimateTokens(currentSentences.join(' '));
    }

    currentSentences.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Flush remaining content
  if (currentSentences.length > 0) {
    const content = currentSentences.join(' ').trim();
    if (content.length > 0) {
      chunks.push({
        pageNumber,
        chunkIndex,
        content,
        tokenEstimate: estimateTokens(content),
      });
    }
  }

  return chunks;
}

/**
 * Splits text into sentences using common sentence terminators.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries (., !, ?) followed by space or end
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Gets trailing sentences that fit within the overlap word budget.
 */
function getOverlapSentences(sentences: string[], overlapWords: number): string[] {
  const result: string[] = [];
  let wordCount = 0;

  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentenceWords = sentences[i].split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount + sentenceWords > overlapWords) {
      break;
    }
    result.unshift(sentences[i]);
    wordCount += sentenceWords;
  }

  return result;
}

/**
 * Handles an embedding generation request.
 * Splits each page into chunks, embeds all chunks, and stores in repository.
 *
 * Called when a chapter transcript is first saved.
 */
export async function handleEmbeddingRequest(
  payload: EmbeddingRequest,
  deps: EmbeddingDeps
): Promise<{ chunksEmbedded: number }> {
  const { chapterId, pages } = payload;

  // Split all pages into chunks
  const allChunks: TextChunk[] = [];
  for (const page of pages) {
    const pageChunks = splitIntoChunks(page.text, page.pageNumber);
    allChunks.push(...pageChunks);
  }

  if (allChunks.length === 0) {
    return { chunksEmbedded: 0 };
  }

  // Batch embed all chunk content
  const texts = allChunks.map(c => c.content);
  const embeddings = await deps.embeddingClient.embed(texts);

  // Build EmbeddingResult array
  const results: EmbeddingResult[] = allChunks.map((chunk, idx) => ({
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    embedding: embeddings[idx],
    content: chunk.content,
  }));

  // Store in Aurora pgvector
  await deps.embeddingRepo.store(chapterId, results);

  return { chunksEmbedded: results.length };
}

/**
 * Handles embedding regeneration when a transcript is edited.
 * Deletes existing embeddings for the chapter, then re-generates all.
 */
export async function handleEmbeddingRegeneration(
  chapterId: string,
  pages: { pageNumber: number; text: string }[],
  deps: EmbeddingDeps
): Promise<{ chunksEmbedded: number }> {
  // Delete existing embeddings for this chapter
  await deps.embeddingRepo.deleteByChapter(chapterId);

  // Re-generate all embeddings
  return handleEmbeddingRequest({ chapterId, pages }, deps);
}

/**
 * Searches for similar content chunks given a query string.
 * Returns top-5 results as a RAGContext for Q&A.
 */
export async function searchSimilar(
  query: string,
  chapterId: string,
  deps: EmbeddingDeps,
  topK: number = DEFAULT_TOP_K
): Promise<RAGContext> {
  if (!query || query.trim().length === 0) {
    return { paragraphs: [], similarity_scores: [] };
  }

  // Embed the query
  const [queryEmbedding] = await deps.embeddingClient.embed([query]);

  // Search for similar chunks
  const results = await deps.embeddingRepo.search(queryEmbedding, chapterId, topK);

  return {
    paragraphs: results.map(r => r.content),
    similarity_scores: results.map(r => r.score),
  };
}
