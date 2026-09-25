/**
 * Neon-backed ParentProfileRepository for the auth service.
 *
 * Concrete implementation of the `ParentProfileRepository` port (see
 * handlers/parent-profile.ts) against the `parent` table, using the shared
 * @chikumiku/db pool.
 *
 * Schema note: the `parent` table (see infra/migrations/neon-init.sql) has
 * columns username, full_name, phone, email, password_hash,
 * progress_alerts_enabled, streak_reminders_enabled, created_at, deleted_at.
 * There is NO `relationship` column and NO dedicated deletion-schedule column:
 *   - `relationship` is a *learner* attribute, not a parent one; the profile
 *     handler carries an optional `relationship`, but there is nowhere to
 *     persist it here, so it is always read back as undefined and silently
 *     ignored on update. (Surfaced honestly rather than faked.)
 *   - account-deletion scheduling maps to the existing `deleted_at` soft-delete
 *     timestamp (set to the future deletion date).
 */

import { getPool, toIso, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  ParentProfile,
  ParentProfileRepository,
} from '../handlers/parent-profile';

/** Options for the Neon parent-profile repository (test seam). */
export interface NeonParentProfileRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface ParentProfileRow {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  progress_alerts_enabled: boolean;
  streak_reminders_enabled: boolean;
  deleted_at: Date | string | null;
}

/** Parent profile repository backed by Neon PostgreSQL. */
export class NeonParentProfileRepository implements ParentProfileRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonParentProfileRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async findById(parentId: string): Promise<ParentProfile | null> {
    const db = await this.db();
    // Only active (non-deleted) parents. `relationship` is not a column on the
    // parent table, so it is intentionally omitted (returned as undefined).
    const result = await db.query<ParentProfileRow>(
      `SELECT id, username, full_name, phone, email,
              progress_alerts_enabled, streak_reminders_enabled, deleted_at
       FROM parent
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [parentId] as never[]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      // relationship is not stored for parents (see file header).
      relationship: undefined,
      progressAlertsEnabled: row.progress_alerts_enabled,
      streakRemindersEnabled: row.streak_reminders_enabled,
      deletionScheduledAt: row.deleted_at ? toIso(row.deleted_at) : null,
    };
  }

  async updateProfile(
    parentId: string,
    fields: { fullName?: string; phone?: string; email?: string; relationship?: string }
  ): Promise<void> {
    // Build a dynamic SET clause from only the provided, persistable fields.
    // `relationship` has no column and is ignored (see file header).
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (fields.fullName !== undefined) {
      sets.push(`full_name = $${i++}`);
      params.push(fields.fullName);
    }
    if (fields.phone !== undefined) {
      sets.push(`phone = $${i++}`);
      params.push(fields.phone);
    }
    if (fields.email !== undefined) {
      sets.push(`email = $${i++}`);
      params.push(fields.email);
    }
    if (sets.length === 0) {
      return; // nothing persistable to update
    }
    params.push(parentId);
    const db = await this.db();
    await db.query(
      `UPDATE parent SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL`,
      params as never[]
    );
  }

  async updatePasswordHash(parentId: string, newHash: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE parent SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [newHash, parentId] as never[]
    );
  }

  async updateNotifications(
    parentId: string,
    settings: { progressAlertsEnabled?: boolean; streakRemindersEnabled?: boolean }
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (settings.progressAlertsEnabled !== undefined) {
      sets.push(`progress_alerts_enabled = $${i++}`);
      params.push(settings.progressAlertsEnabled);
    }
    if (settings.streakRemindersEnabled !== undefined) {
      sets.push(`streak_reminders_enabled = $${i++}`);
      params.push(settings.streakRemindersEnabled);
    }
    if (sets.length === 0) {
      return;
    }
    params.push(parentId);
    const db = await this.db();
    await db.query(
      `UPDATE parent SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL`,
      params as never[]
    );
  }

  async scheduleDeletion(parentId: string, deletionDate: string): Promise<void> {
    // Maps to the soft-delete timestamp (set to the future deletion date).
    const db = await this.db();
    await db.query(
      `UPDATE parent SET deleted_at = $1 WHERE id = $2`,
      [deletionDate, parentId] as never[]
    );
  }

  async findPasswordHashByUserId(userId: string): Promise<string | null> {
    const db = await this.db();
    const result = await db.query<{ password_hash: string }>(
      `SELECT password_hash FROM parent WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId] as never[]
    );
    return result.rows[0]?.password_hash ?? null;
  }
}
