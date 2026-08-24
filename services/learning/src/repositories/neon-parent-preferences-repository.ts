/**
 * Neon-backed implementation of IParentPreferencesRepository.
 *
 * Reads a parent's notification preference flags from the parent table.
 * Uses the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  IParentPreferencesRepository,
  ParentNotificationPreferences,
} from '../notifications/notification-service';

/** Options for the Neon parent-preferences repository (test seam). */
export interface NeonParentPreferencesRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface PreferencesRow {
  progress_alerts_enabled: boolean;
  streak_reminders_enabled: boolean;
}

/**
 * Parent notification-preferences repository backed by Neon PostgreSQL.
 */
export class NeonParentPreferencesRepository
  implements IParentPreferencesRepository
{
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonParentPreferencesRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getPreferences(
    parentId: string
  ): Promise<ParentNotificationPreferences | null> {
    const db = await this.db();
    const result = await db.query<PreferencesRow>(
      `SELECT progress_alerts_enabled, streak_reminders_enabled
       FROM parent
       WHERE id = $1 AND deleted_at IS NULL`,
      [parentId] as never[]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      progressAlertsEnabled: row.progress_alerts_enabled,
      streakRemindersEnabled: row.streak_reminders_enabled,
    };
  }
}
