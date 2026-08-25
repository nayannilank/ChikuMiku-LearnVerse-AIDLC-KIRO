/**
 * Neon-backed OTPRepository for the password-reset flow.
 *
 * Concrete implementation of the `OTPRepository` ports used by BOTH the
 * forgot-password handler (`invalidateExisting`, `store`) and the verify-otp
 * handler (`findLatestByUsername`, `updateAttempts`, `invalidate`). Backed by
 * the `otp_record` table. Also exposes `getMostRecentCreatedAt`, used by the
 * lambda route to enforce the per-user reset rate limit.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type { OTPRecord } from '../otp/otp-manager';

/** Options for the Neon OTP repository (test seam). */
export interface NeonOTPRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Raw row shape from otp_record. */
interface OtpRow {
  username: string;
  code: string;
  attempts: number;
  invalidated: boolean;
  created_at: Date | string;
}

/** OTP repository backed by Neon PostgreSQL. */
export class NeonOTPRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonOTPRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /** Marks every non-invalidated OTP for the user as invalidated. */
  async invalidateExisting(username: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE otp_record
       SET invalidated = TRUE
       WHERE username = $1 AND invalidated = FALSE`,
      [username] as never[]
    );
  }

  /** Inserts a new OTP record. */
  async store(record: OTPRecord): Promise<void> {
    const db = await this.db();
    await db.query(
      `INSERT INTO otp_record (username, code, attempts, invalidated, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        record.username,
        record.code,
        record.attempts,
        record.invalidated,
        record.createdAt,
      ] as never[]
    );
  }

  /**
   * Returns the latest non-invalidated OTP for the user (by created_at), or
   * null when none exists.
   */
  async findLatestByUsername(username: string): Promise<OTPRecord | null> {
    const db = await this.db();
    const result = await db.query<OtpRow>(
      `SELECT username, code, attempts, invalidated, created_at
       FROM otp_record
       WHERE username = $1 AND invalidated = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [username] as never[]
    );
    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      username: row.username,
      code: row.code,
      attempts: row.attempts,
      invalidated: row.invalidated,
      createdAt: new Date(row.created_at),
    };
  }

  /** Sets the attempt counter on the user's latest non-invalidated OTP. */
  async updateAttempts(username: string, attempts: number): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE otp_record
       SET attempts = $2
       WHERE id = (
         SELECT id FROM otp_record
         WHERE username = $1 AND invalidated = FALSE
         ORDER BY created_at DESC
         LIMIT 1
       )`,
      [username, attempts] as never[]
    );
  }

  /** Marks every non-invalidated OTP for the user as invalidated. */
  async invalidate(username: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE otp_record
       SET invalidated = TRUE
       WHERE username = $1 AND invalidated = FALSE`,
      [username] as never[]
    );
  }

  /**
   * Returns the created_at of the most recent OTP request for the user across
   * ALL records (invalidated or not), or null when the user has never
   * requested one. Used to enforce the per-user reset rate limit — it must see
   * even invalidated rows, since issuing a new OTP invalidates the prior one.
   */
  async getMostRecentCreatedAt(username: string): Promise<Date | null> {
    const db = await this.db();
    const result = await db.query<{ created_at: Date | string }>(
      `SELECT created_at
       FROM otp_record
       WHERE username = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [username] as never[]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return new Date(result.rows[0].created_at);
  }
}
