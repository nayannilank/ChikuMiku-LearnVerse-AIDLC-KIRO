/**
 * Neon-backed ResetTokenRepository for the password-reset flow.
 *
 * Concrete implementation of the `ResetTokenRepository` port used by the
 * reset-password handler (`isValid`, `invalidate`), backed by the
 * `password_reset_token` table. Also exposes `store`, used by the lambda route
 * to persist the reset token that verify-otp returns.
 *
 * The verify-otp handler generates the reset token string but does NOT persist
 * it (it has no repository dependency for tokens). So the lambda route calls
 * `store` after a successful verification, giving the token a bounded lifetime
 * (see RESET_TOKEN_TTL_MINUTES in lambda.ts) so reset-password can validate it.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';

/** Options for the Neon reset-token repository (test seam). */
export interface NeonResetTokenRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Reset-token repository backed by Neon PostgreSQL. */
export class NeonResetTokenRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonResetTokenRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /**
   * Persists a freshly issued reset token with an absolute expiry. Called by
   * the lambda route after verify-otp succeeds.
   */
  async store(username: string, token: string, expiresAt: Date): Promise<void> {
    const db = await this.db();
    await db.query(
      `INSERT INTO password_reset_token (username, token, used, expires_at)
       VALUES ($1, $2, FALSE, $3)`,
      [username, token, expiresAt] as never[]
    );
  }

  /**
   * Returns true when an unused, unexpired token exists for the user.
   */
  async isValid(username: string, token: string): Promise<boolean> {
    const db = await this.db();
    const result = await db.query(
      `SELECT 1
       FROM password_reset_token
       WHERE username = $1 AND token = $2 AND used = FALSE AND expires_at > NOW()
       LIMIT 1`,
      [username, token] as never[]
    );
    return result.rows.length > 0;
  }

  /** Marks the token as used (single-use). */
  async invalidate(username: string, token: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE password_reset_token
       SET used = TRUE
       WHERE username = $1 AND token = $2`,
      [username, token] as never[]
    );
  }
}
