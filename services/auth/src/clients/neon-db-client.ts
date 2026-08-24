/**
 * Neon-backed DBClient for the auth service.
 *
 * Concrete implementation of `DBClient` (see db-client.ts) against the `parent`
 * table. Uses the shared @chikumiku/db connection pool.
 */

import { getPool, toIso, type Pool, type PoolClient } from '@chikumiku/db';
import type { DBClient, ParentRecord } from './db-client';

/** Options for the Neon auth DB client (test seam). */
export interface NeonDBClientOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface ParentRow {
  id: string;
  username: string;
  full_name: string;
  phone: string;
  email: string;
  password_hash: string;
  created_at: Date | string;
}

/**
 * Auth service database client backed by Neon PostgreSQL.
 */
export class NeonDBClient implements DBClient {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonDBClientOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async parentUsernameExists(username: string): Promise<boolean> {
    const db = await this.db();
    // Only active (non-deleted) parents count as taking a username.
    const result = await db.query(
      `SELECT 1 FROM parent WHERE username = $1 AND deleted_at IS NULL LIMIT 1`,
      [username] as never[]
    );
    return result.rows.length > 0;
  }

  async createParent(
    parent: Omit<ParentRecord, 'createdAt'>
  ): Promise<ParentRecord> {
    const db = await this.db();
    const result = await db.query<ParentRow>(
      `INSERT INTO parent (id, username, full_name, phone, email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, full_name, phone, email, password_hash, created_at`,
      [
        parent.id,
        parent.username,
        parent.fullName,
        parent.phone,
        parent.email,
        parent.passwordHash,
      ] as never[]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: toIso(row.created_at),
    };
  }
}
