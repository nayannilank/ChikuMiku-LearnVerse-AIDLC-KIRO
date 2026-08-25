/**
 * Neon-backed ConsentRepository for the auth service.
 *
 * Concrete implementation of the `ConsentRepository` port (see
 * parental-consent.ts) against the `parental_consent` table. Active consent is
 * a row whose `revoked_at` is NULL. Uses the shared @chikumiku/db pool.
 *
 * Requirements: 20.5
 */

import { getPool, toIso, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  ConsentRecord,
  ConsentRepository,
  ConsentStatus,
} from '../handlers/parental-consent';

/** Options for the Neon consent repository (test seam). */
export interface NeonConsentRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface ConsentRow {
  consent_version: string;
  granted_at: Date | string;
}

/** Consent repository backed by Neon PostgreSQL. */
export class NeonConsentRepository implements ConsentRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonConsentRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async hasActiveConsent(parentId: string): Promise<boolean> {
    const db = await this.db();
    const result = await db.query(
      `SELECT 1 FROM parental_consent
       WHERE parent_id = $1 AND revoked_at IS NULL
       LIMIT 1`,
      [parentId] as never[]
    );
    return result.rows.length > 0;
  }

  async getConsentStatus(parentId: string): Promise<ConsentStatus> {
    const db = await this.db();
    const result = await db.query<ConsentRow>(
      `SELECT consent_version, granted_at
       FROM parental_consent
       WHERE parent_id = $1 AND revoked_at IS NULL
       ORDER BY granted_at DESC
       LIMIT 1`,
      [parentId] as never[]
    );

    const row = result.rows[0];
    if (!row) {
      return { hasConsented: false, consentedAt: null, consentVersion: null };
    }

    return {
      hasConsented: true,
      consentedAt: toIso(row.granted_at),
      consentVersion: row.consent_version,
    };
  }

  async storeConsent(record: ConsentRecord): Promise<void> {
    const db = await this.db();
    // The table tracks parent_id, consent_version, and granted_at; the record's
    // consentedAt timestamp is honored so callers control the grant time.
    await db.query(
      `INSERT INTO parental_consent (parent_id, consent_version, granted_at)
       VALUES ($1, $2, $3)`,
      [record.parentId, record.consentVersion, record.consentedAt] as never[]
    );
  }
}
