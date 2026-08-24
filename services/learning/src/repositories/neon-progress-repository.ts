/**
 * Neon-backed implementation of IProgressRepository.
 *
 * Returns per-chapter progress records for a learner and checks learner
 * existence. Delegates the per-chapter aggregation to the shared
 * fetchChapterLearnerStats helper. Uses the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  IProgressRepository,
  ChapterProgressRecord,
} from '../handlers/progress';
import {
  fetchChapterLearnerStats,
  learnerExistsQuery,
} from './chapter-learner-stats';

/** Options for the Neon progress repository (test seam). */
export interface NeonProgressRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/**
 * Progress repository backed by Neon PostgreSQL.
 */
export class NeonProgressRepository implements IProgressRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonProgressRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getChapterProgressForLearner(
    learnerId: string
  ): Promise<ChapterProgressRecord[]> {
    const db = await this.db();
    // ChapterProgressRecord is structurally the ChapterLearnerStats shape.
    return fetchChapterLearnerStats(db, learnerId);
  }

  async learnerExists(learnerId: string): Promise<boolean> {
    const db = await this.db();
    return learnerExistsQuery(db, learnerId);
  }
}
