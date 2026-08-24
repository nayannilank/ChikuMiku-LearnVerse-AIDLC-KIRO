/**
 * Neon-backed Q&A session repository.
 *
 * Concrete `IQASessionRepository` (see services/qa.ts) backed by the
 * `qa_session` table.
 *
 * The `QASession` type carries only { chapterId, questionCount, contextHistory }
 * — it has no learnerId — but the `qa_session` row requires `learner_id NOT
 * NULL`. Since the gateway knows the learner for the current request, the
 * learnerId is supplied at construction and used when a session row must be
 * created. `updateSession` therefore upserts by primary key `id`.
 *
 * Requirements: 25.4
 */

import type { Pool, PoolClient } from 'pg';
import type { IQASessionRepository, QASession } from '../services/qa';
import { getPool } from '@chikumiku/db';

/** Options for the Neon Q&A session repository. */
export interface NeonQASessionRepositoryOptions {
  /**
   * Learner that owns sessions created via this repository. Required so an
   * upsert can satisfy `qa_session.learner_id NOT NULL`.
   */
  learnerId: string;
  /** Inject a pool/client for testing; defaults to the shared Neon pool. */
  pool?: Pool | PoolClient;
}

interface QASessionRow {
  chapter_id: string;
  question_count: number;
  context_history: string[];
}

/**
 * qa_session-backed session persistence for the Q&A flow.
 */
export class NeonQASessionRepository implements IQASessionRepository {
  private readonly learnerId: string;
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options: NeonQASessionRepositoryOptions) {
    this.learnerId = options.learnerId;
    this.injectedPool = options.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getSession(sessionId: string): Promise<QASession | null> {
    const db = await this.db();
    const result = await db.query<QASessionRow>(
      `SELECT chapter_id, question_count, context_history
       FROM qa_session
       WHERE id = $1`,
      [sessionId] as never[]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      chapterId: row.chapter_id,
      questionCount: row.question_count,
      // context_history is stored as JSONB; pg returns it already parsed.
      contextHistory: Array.isArray(row.context_history) ? row.context_history : [],
    };
  }

  async updateSession(sessionId: string, session: QASession): Promise<void> {
    // Upsert by primary key. On first write the row is created with the
    // construction-time learnerId; subsequent writes update the mutable fields.
    const db = await this.db();
    await db.query(
      `INSERT INTO qa_session
         (id, learner_id, chapter_id, question_count, context_history, last_active_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         question_count = EXCLUDED.question_count,
         context_history = EXCLUDED.context_history,
         last_active_at = NOW()`,
      [
        sessionId,
        this.learnerId,
        session.chapterId,
        session.questionCount,
        JSON.stringify(session.contextHistory),
      ] as never[]
    );
  }
}
