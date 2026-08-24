/**
 * Neon-backed implementation of IRecommendationRepository.
 *
 * Returns per-chapter data used by the deterministic recommendation rules and
 * checks learner existence. Delegates the per-chapter aggregation to the shared
 * fetchChapterLearnerStats helper (ChapterRecommendationData is structurally the
 * same shape as ChapterProgressRecord). Uses the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  IRecommendationRepository,
  ChapterRecommendationData,
} from '../handlers/recommendations';
import {
  fetchChapterLearnerStats,
  learnerExistsQuery,
} from './chapter-learner-stats';

/** Options for the Neon recommendation repository (test seam). */
export interface NeonRecommendationRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/**
 * Recommendation repository backed by Neon PostgreSQL.
 */
export class NeonRecommendationRepository implements IRecommendationRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonRecommendationRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getChapterDataForLearner(
    learnerId: string
  ): Promise<ChapterRecommendationData[]> {
    const db = await this.db();
    // ChapterRecommendationData is structurally the ChapterLearnerStats shape.
    return fetchChapterLearnerStats(db, learnerId);
  }

  async learnerExists(learnerId: string): Promise<boolean> {
    const db = await this.db();
    return learnerExistsQuery(db, learnerId);
  }
}
