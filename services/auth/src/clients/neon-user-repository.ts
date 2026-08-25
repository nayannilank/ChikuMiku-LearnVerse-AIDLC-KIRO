/**
 * Neon-backed UserRepository for the password-reset flow.
 *
 * Concrete implementation of the `UserRepository` port used by BOTH the
 * forgot-password handler (needs `findByUsername -> {username,email,phone}`)
 * and the reset-password handler (needs `findByUsername -> {username}` plus
 * `updatePassword`). The two handler interfaces are structurally compatible:
 * the richer `{username,email,phone}` record is assignable to the leaner
 * `{username}` record, so a single class satisfies both.
 *
 * A username can belong to either the `parent` table (which has email/phone
 * columns) or the `learner` table (which does NOT). This repository searches
 * `parent` first, then `learner`. For a learner there is no contact info, so
 * email/phone are returned as empty strings — the notification service treats
 * an empty email/phone as "no channel" and skips that send. Only active
 * (non-deleted) rows are considered.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';

/** Options for the Neon user repository (test seam). */
export interface NeonUserRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Row shape when reading a parent (has contact columns). */
interface ParentContactRow {
  username: string;
  email: string;
  phone: string;
}

/** Row shape when reading a learner (no contact columns). */
interface LearnerRow {
  username: string;
}

/**
 * User repository backed by Neon PostgreSQL, spanning the parent and learner
 * tables. Satisfies the `UserRepository` interfaces of both the forgot-password
 * and reset-password handlers.
 */
export class NeonUserRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonUserRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /**
   * Looks up a user by username, searching parent first then learner. Returns
   * `{username, email, phone}` (email/phone empty for a learner) or null when
   * no active user holds the username.
   */
  async findByUsername(
    username: string
  ): Promise<{ username: string; email: string; phone: string } | null> {
    const db = await this.db();

    // Parent owns email/phone — prefer it.
    const parentResult = await db.query<ParentContactRow>(
      `SELECT username, email, phone
       FROM parent
       WHERE username = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [username] as never[]
    );
    if (parentResult.rows.length > 0) {
      const row = parentResult.rows[0];
      return { username: row.username, email: row.email, phone: row.phone };
    }

    // Learner has no contact columns; surface empty strings so the record stays
    // structurally compatible with the {username,email,phone} shape.
    const learnerResult = await db.query<LearnerRow>(
      `SELECT username
       FROM learner
       WHERE username = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [username] as never[]
    );
    if (learnerResult.rows.length > 0) {
      return { username: learnerResult.rows[0].username, email: '', phone: '' };
    }

    return null;
  }

  /**
   * Updates the password hash for whichever table owns the username. Tries
   * parent first; if no active parent row matched, updates learner.
   */
  async updatePassword(username: string, passwordHash: string): Promise<void> {
    const db = await this.db();

    const parentResult = await db.query(
      `UPDATE parent
       SET password_hash = $2
       WHERE username = $1 AND deleted_at IS NULL`,
      [username, passwordHash] as never[]
    );
    if ((parentResult.rowCount ?? 0) > 0) {
      return;
    }

    await db.query(
      `UPDATE learner
       SET password_hash = $2
       WHERE username = $1 AND deleted_at IS NULL`,
      [username, passwordHash] as never[]
    );
  }
}
