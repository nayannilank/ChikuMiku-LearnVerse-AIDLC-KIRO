/**
 * Neon-backed ManageLearnerRepository for the auth service.
 *
 * Concrete implementation of the `ManageLearnerRepository` port (see
 * handlers/manage-learners.ts) against the `learner` (and `subject`) tables,
 * using the shared @chikumiku/db pool.
 *
 * Subjects: `learner.subjects` is a denormalized JSONB array of `subject.id`
 * UUIDs (see services/auth NeonLearnerRepository.createLearner). The list
 * endpoint resolves those ids back to subject *names* for display (mirroring
 * the learning service's NeonLearningRepository), so the Manage Learners UI
 * shows "Maths" rather than a UUID. Legacy rows that still hold name strings
 * pass through unchanged.
 */

import { getPool, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  LearnerRecord,
  ManageLearnerRepository,
} from '../handlers/manage-learners';

/** Options for the Neon manage-learner repository (test seam). */
export interface NeonManageLearnerRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Matches a canonical UUID (any version) — tells a subject.id from a name. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LearnerManageRow {
  id: string;
  parent_id: string;
  username: string;
  name: string;
  gender: string;
  grade: string;
  school_name: string;
  subjects: unknown;
}

/** Parses the `learner.subjects` JSONB into a flat list of raw entries. */
function parseSubjectEntries(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const entries: string[] = [];
  for (const el of parsed) {
    if (typeof el === 'string' && el.length > 0) {
      entries.push(el);
    } else if (el && typeof el === 'object') {
      const obj = el as Record<string, unknown>;
      // Legacy object form {id,name}: prefer the id (resolvable), fall back to name.
      if (obj.id !== undefined) entries.push(String(obj.id));
      else if (obj.name !== undefined) entries.push(String(obj.name));
    }
  }
  return entries;
}

/** Manage-learners repository backed by Neon PostgreSQL. */
export class NeonManageLearnerRepository implements ManageLearnerRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonManageLearnerRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /**
   * Resolves a set of subject-enrollment entries (UUIDs and/or legacy names)
   * to display names. UUID entries are looked up in the `subject` table in a
   * single batched query; non-UUID entries are already names and kept as-is.
   */
  private async resolveSubjectNames(entries: string[]): Promise<string[]> {
    const uuidIds = entries.filter((e) => UUID_RE.test(e));
    if (uuidIds.length === 0) {
      return entries;
    }
    const db = await this.db();
    const result = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM subject WHERE id = ANY($1::uuid[])`,
      [uuidIds] as never[]
    );
    const nameById = new Map(result.rows.map((r) => [r.id, r.name]));
    return entries.map((e) => nameById.get(e) ?? e);
  }

  private async toLearnerRecord(row: LearnerManageRow): Promise<LearnerRecord> {
    const subjectNames = await this.resolveSubjectNames(
      parseSubjectEntries(row.subjects)
    );
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      gender: row.gender as LearnerRecord['gender'],
      grade: row.grade,
      schoolName: row.school_name,
      subjectIds: subjectNames,
      customSubjects: [],
    };
  }

  async findLearnersByParentId(parentId: string): Promise<LearnerRecord[]> {
    const db = await this.db();
    const result = await db.query<LearnerManageRow>(
      `SELECT id, parent_id, username, name, gender, grade, school_name, subjects
       FROM learner
       WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [parentId] as never[]
    );
    return Promise.all(result.rows.map((row) => this.toLearnerRecord(row)));
  }

  async findLearnerById(
    learnerId: string
  ): Promise<(LearnerRecord & { parentId: string }) | null> {
    const db = await this.db();
    const result = await db.query<LearnerManageRow>(
      `SELECT id, parent_id, username, name, gender, grade, school_name, subjects
       FROM learner
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [learnerId] as never[]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const record = await this.toLearnerRecord(row);
    return { ...record, parentId: row.parent_id };
  }

  async updateLearner(
    learnerId: string,
    data: Partial<Pick<LearnerRecord, 'name' | 'grade' | 'schoolName' | 'subjectIds'>>
  ): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (data.name !== undefined) {
      sets.push(`name = $${i++}`);
      params.push(data.name);
    }
    if (data.grade !== undefined) {
      sets.push(`grade = $${i++}`);
      params.push(data.grade);
    }
    if (data.schoolName !== undefined) {
      sets.push(`school_name = $${i++}`);
      params.push(data.schoolName);
    }
    if (data.subjectIds !== undefined) {
      sets.push(`subjects = $${i++}::jsonb`);
      params.push(JSON.stringify(data.subjectIds));
    }
    if (sets.length === 0) {
      return;
    }
    params.push(learnerId);
    const db = await this.db();
    await db.query(
      `UPDATE learner SET ${sets.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL`,
      params as never[]
    );
  }

  async updateLearnerPassword(learnerId: string, passwordHash: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE learner SET password_hash = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [passwordHash, learnerId] as never[]
    );
  }

  async softDeleteLearner(learnerId: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE learner SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [learnerId] as never[]
    );
  }
}
