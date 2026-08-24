/**
 * Neon-backed implementation of IActivityRepository.
 *
 * Persists learning activities to the activity_log table and reads distinct
 * active dates for streak computation. Uses the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type { ActivityRecord } from '@chikumiku/types';
import type { IActivityRepository } from '../handlers/record-activity';

/** Options for the Neon activity repository (test seam). */
export interface NeonActivityRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface ActivityDateRow {
  local_date: Date | string;
}

/**
 * Formats a pg DATE value as a 'YYYY-MM-DD' string. pg may return DATE columns
 * as a `Date` (local midnight) or as a string depending on driver config.
 */
function toDateString(value: Date | string): string {
  if (value instanceof Date) {
    // Use local components so a DATE returned as local-midnight Date does not
    // shift a day when the machine is behind UTC.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // String form: take the leading date portion (handles 'YYYY-MM-DD' and
  // 'YYYY-MM-DDT...').
  return value.slice(0, 10);
}

/**
 * Activity log repository backed by Neon PostgreSQL.
 */
export class NeonActivityRepository implements IActivityRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonActivityRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async saveActivity(activity: ActivityRecord): Promise<void> {
    const db = await this.db();
    // ActivityRecord carries no metadata field; the metadata column stays NULL.
    await db.query(
      `INSERT INTO activity_log
         (learner_id, chapter_id, activity_type, local_date, "timestamp")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        activity.learnerId,
        activity.chapterId,
        activity.activityType,
        activity.localDate,
        activity.timestamp,
      ] as never[]
    );
  }

  async getActivityDates(learnerId: string): Promise<string[]> {
    const db = await this.db();
    const result = await db.query<ActivityDateRow>(
      `SELECT DISTINCT local_date
       FROM activity_log
       WHERE learner_id = $1
       ORDER BY local_date ASC`,
      [learnerId] as never[]
    );
    return result.rows.map((row) => toDateString(row.local_date));
  }
}
