/**
 * Neon-backed LearnerRepository for the auth service.
 *
 * Concrete implementation of the `LearnerRepository` port used by the learner
 * registration handler, against the `learner` and `subject` tables. Uses the
 * shared @chikumiku/db connection pool and transaction helper.
 *
 * Parent identity: the handler passes a `parentUsername` (from the
 * authenticated session), while the `learner`/`subject` tables reference the
 * parent by `parent.id`. This repository resolves username -> id at query
 * time (a JOIN for the count, a lookup inside the create transaction).
 */

import {
  getPool,
  withTransaction,
  type Pool,
  type PoolClient,
} from '@chikumiku/db';
import type {
  CreateLearnerData,
  LearnerRepository,
} from '../handlers/register-learner';

/** Options for the Neon learner repository (test seam). */
export interface NeonLearnerRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Learner repository backed by Neon PostgreSQL. */
export class NeonLearnerRepository implements LearnerRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonLearnerRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    const db = await this.db();
    // Only active (non-deleted) learners hold a username.
    const result = await db.query(
      `SELECT 1 FROM learner WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
      [username] as never[]
    );
    return result.rows.length > 0;
  }

  async countLearnersByParent(parentUsername: string): Promise<number> {
    const db = await this.db();
    // Resolve the parent by username via JOIN; count only active learners.
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM learner l
       JOIN parent p ON p.id = l.parent_id
       WHERE p.username = $1
         AND p.deleted_at IS NULL
         AND l.deleted_at IS NULL`,
      [parentUsername] as never[]
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async createLearner(data: CreateLearnerData): Promise<string> {
    // The parent lookup, custom-subject inserts, and learner insert all commit
    // together (or roll back together) so we never leave orphan subject rows
    // behind if the learner insert fails.
    return withTransaction(async (client) => {
      // Resolve the parent username to its id (scoped to active parents).
      const parentResult = await client.query<{ id: string }>(
        `SELECT id FROM parent WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
        [data.parentUsername] as never[]
      );
      const parentId = parentResult.rows[0]?.id;
      if (!parentId) {
        throw new Error(`Parent not found for username: ${data.parentUsername}`);
      }

      // Create a subject row per custom subject name and collect their ids.
      const customSubjectIds: string[] = [];
      for (const name of data.customSubjects) {
        const subjectResult = await client.query<{ id: string }>(
          `INSERT INTO subject (name, is_default, parent_id)
           VALUES ($1, FALSE, $2)
           RETURNING id`,
          [name, parentId] as never[]
        );
        customSubjectIds.push(subjectResult.rows[0].id);
      }

      // The learner's enrolled subjects are the selected default/existing
      // subject ids plus the newly created custom subject ids.
      const subjectIds = [...data.subjectIds, ...customSubjectIds];

      const learnerResult = await client.query<{ id: string }>(
        `INSERT INTO learner
           (parent_id, username, name, password_hash, gender, relationship,
            grade, school_name, subjects)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id`,
        [
          parentId,
          data.username,
          data.name,
          data.passwordHash,
          data.gender,
          data.relationship,
          data.grade,
          data.schoolName,
          JSON.stringify(subjectIds),
        ] as never[]
      );

      return learnerResult.rows[0].id;
    });
  }
}
