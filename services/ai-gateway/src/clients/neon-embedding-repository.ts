/**
 * Neon-backed embedding repository (pgvector).
 *
 * Concrete `IEmbeddingRepository` (see services/embedding.ts) backed by the
 * `embedding` table with a 1536-dim `vector` column and an HNSW cosine index.
 *
 * - store:          batch-inserts chunk rows for a chapter (one transaction)
 * - deleteByChapter: removes all chunks for a chapter (used on regeneration)
 * - search:         cosine nearest-neighbour within a chapter; score = 1 - distance
 *
 * Requirements: 25.4
 */

import type { Pool, PoolClient } from 'pg';
import type { IEmbeddingRepository, EmbeddingResult } from '../services/embedding';
import { getPool, toVector } from '@chikumiku/db';

/** Options for the Neon embedding repository (test seam). */
export interface NeonEmbeddingRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared Neon pool. */
  pool?: Pool | PoolClient;
}

/**
 * pgvector-backed embedding storage and similarity search.
 */
export class NeonEmbeddingRepository implements IEmbeddingRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonEmbeddingRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async store(chapterId: string, embeddings: EmbeddingResult[]): Promise<void> {
    if (embeddings.length === 0) {
      return;
    }

    // Build a single multi-row INSERT. Parameters per row:
    //   chapter_id, page_number, chunk_index, content, embedding
    const valuesSql: string[] = [];
    const params: unknown[] = [];

    embeddings.forEach((e, i) => {
      const base = i * 5;
      valuesSql.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`
      );
      params.push(
        chapterId,
        e.pageNumber,
        e.chunkIndex,
        e.content,
        toVector(e.embedding)
      );
    });

    const sql = `
      INSERT INTO embedding (chapter_id, page_number, chunk_index, content, embedding)
      VALUES ${valuesSql.join(', ')}
    `;

    const db = await this.db();
    await db.query(sql, params as never[]);
  }

  async deleteByChapter(chapterId: string): Promise<void> {
    const db = await this.db();
    await db.query('DELETE FROM embedding WHERE chapter_id = $1', [chapterId] as never[]);
  }

  async search(
    embedding: number[],
    chapterId: string,
    topK: number
  ): Promise<{ content: string; score: number }[]> {
    // `<=>` is pgvector's cosine distance (0 = identical, 2 = opposite).
    // Similarity score = 1 - distance, clamped to [0, 1] for callers.
    const sql = `
      SELECT content, (embedding <=> $1::vector) AS distance
      FROM embedding
      WHERE chapter_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const db = await this.db();
    const result = await db.query<{ content: string; distance: string | number }>(
      sql,
      [toVector(embedding), chapterId, topK] as never[]
    );

    return result.rows.map((row) => {
      const distance =
        typeof row.distance === 'string' ? parseFloat(row.distance) : row.distance;
      const score = Math.min(1, Math.max(0, 1 - distance));
      return { content: row.content, score };
    });
  }
}
