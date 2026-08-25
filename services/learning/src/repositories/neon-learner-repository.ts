/**
 * Neon-backed implementation of ILearnerRepository.
 *
 * Reads and writes the denormalized streak fields
 * (current_streak / last_active_date / longest_streak) on the learner record.
 * Uses the shared @chikumiku/db pool.
 */

import { getPool, toNumber, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  ILearnerRepository,
  LearnerStreakRecord,
} from '../handlers/record-activity';

/** Options for the Neon learner repository (test seam). */
export interface NeonLearnerRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface StreakRow {
  current_streak: number | string;
  last_active_date: Date | string | null;
  longest_streak: number | string;
}

/** Formats a pg DATE value as 'YYYY-MM-DD', preserving null. */
function toDateStringOrNull(value: Date | string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return value.slice(0, 10);
}

/**
 * Learner streak repository backed by Neon PostgreSQL.
 */
export class NeonLearnerRepository implements ILearnerRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonLearnerRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /**
   * Returns the learner's display name (learner.name), or null when no active
   * learner has that id. Used by the learner dashboard so it shows the real
   * name rather than the Cognito username.
   */
  async getName(learnerId: string): Promise<string | null> {
    const db = await this.db();
    const result = await db.query<{ name: string }>(
      `SELECT name FROM learner WHERE id = $1 AND deleted_at IS NULL`,
      [learnerId] as never[]
    );
    return result.rows.length > 0 ? result.rows[0].name : null;
  }

  async getStreakData(learnerId: string): Promise<LearnerStreakRecord | null> {
    const db = await this.db();
    const result = await db.query<StreakRow>(
      `SELECT current_streak, last_active_date, longest_streak
       FROM learner
       WHERE id = $1 AND deleted_at IS NULL`,
      [learnerId] as never[]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      currentStreak: toNumber(row.current_streak),
      lastActiveDate: toDateStringOrNull(row.last_active_date),
      longestStreak: toNumber(row.longest_streak),
    };
  }

  async updateStreakData(
    learnerId: string,
    data: LearnerStreakRecord
  ): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE learner
       SET current_streak = $1,
           last_active_date = $2,
           longest_streak = $3
       WHERE id = $4 AND deleted_at IS NULL`,
      [
        data.currentStreak,
        data.lastActiveDate,
        data.longestStreak,
        learnerId,
      ] as never[]
    );
  }
}
