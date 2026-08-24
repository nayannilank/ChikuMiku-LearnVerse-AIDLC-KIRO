/**
 * Neon-backed implementation of IChapterRepository.
 *
 * Reads a chapter's stored academic year for access-mode determination.
 * Uses the shared @chikumiku/db pool.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type { IChapterRepository } from '../handlers/chapter-access-mode';

/** Options for the Neon chapter repository (test seam). */
export interface NeonChapterRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface AcademicYearRow {
  academic_year: string;
}

/**
 * Chapter repository backed by Neon PostgreSQL.
 */
export class NeonChapterRepository implements IChapterRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonChapterRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getChapterAcademicYear(chapterId: string): Promise<string | null> {
    const db = await this.db();
    const result = await db.query<AcademicYearRow>(
      `SELECT academic_year FROM chapter WHERE id = $1`,
      [chapterId] as never[]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].academic_year;
  }
}
