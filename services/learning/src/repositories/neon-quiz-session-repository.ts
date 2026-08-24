/**
 * Neon-backed implementation of the quiz-session existence check.
 *
 * SCOPE: this repository implements only `chapterHasQuestions` from
 * IQuizSessionRepository. The remaining IQuizSessionRepository methods
 * (createSession/getSessionById/saveAttemptResult/getAttemptById/
 * getAttemptsForChapter/getQuestionsForChapter) require persistence that the
 * current schema does not model — there is no `quiz_session` table, and
 * `quiz_attempt` stores no session id or per-question breakdown. Rather than
 * invent columns/tables (explicitly out of scope), we implement the one method
 * in scope and type the class against `Pick<IQuizSessionRepository,
 * 'chapterHasQuestions'>` so the signature stays contract-accurate.
 *
 * Backed by the revision_question table via the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type { IQuizSessionRepository } from '../handlers/quiz-session';

/** Options for the Neon quiz-session repository (test seam). */
export interface NeonQuizSessionRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/**
 * Quiz-session existence checks backed by Neon PostgreSQL.
 */
export class NeonQuizSessionRepository
  implements Pick<IQuizSessionRepository, 'chapterHasQuestions'>
{
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonQuizSessionRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async chapterHasQuestions(chapterId: string): Promise<boolean> {
    const db = await this.db();
    // A chapter "has questions" if at least one generated revision_question
    // row exists for it.
    const result = await db.query(
      `SELECT 1 FROM revision_question WHERE chapter_id = $1 LIMIT 1`,
      [chapterId] as never[]
    );
    return result.rows.length > 0;
  }
}
