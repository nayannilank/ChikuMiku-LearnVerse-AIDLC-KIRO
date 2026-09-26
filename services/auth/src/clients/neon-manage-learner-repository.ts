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

import { getPool, withTransaction, type Pool, type PoolClient } from '@chikumiku/db';
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

/**
 * Resolves a list of subject NAMES (as sent by the edit/registration UI) to
 * real `subject.id` UUIDs, using the same rules as learner registration:
 *   1. an existing default subject (is_default = TRUE, parent_id NULL), or
 *   2. an existing custom subject owned by this parent, or
 *   3. a newly created custom subject owned by this parent.
 * Values that are already UUIDs pass through unchanged (idempotent — lets the
 * edit form round-trip ids too). De-duplicated case-insensitively. Runs on the
 * provided transaction client so any custom-subject inserts commit atomically
 * with the learner update.
 */
async function resolveSubjectIds(
  client: PoolClient,
  parentId: string,
  names: string[]
): Promise<string[]> {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const value = String(raw).trim();
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Already a real subject id — keep as-is.
    if (UUID_RE.test(value)) {
      resolved.push(value);
      continue;
    }

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM subject
       WHERE LOWER(name) = LOWER($1)
         AND (is_default = TRUE OR parent_id = $2)
       ORDER BY is_default DESC
       LIMIT 1`,
      [value, parentId] as never[]
    );
    if (existing.rows[0]?.id) {
      resolved.push(existing.rows[0].id);
      continue;
    }

    const created = await client.query<{ id: string }>(
      `INSERT INTO subject (name, is_default, parent_id)
       VALUES ($1, FALSE, $2)
       RETURNING id`,
      [value, parentId] as never[]
    );
    resolved.push(created.rows[0].id);
  }
  return resolved;
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
    const hasSubjectUpdate = data.subjectIds !== undefined;

    // Subjects need name->subject.id resolution (the edit UI sends subject
    // *names*, matching registration), which requires the learner's parent id
    // and may create custom subject rows — so run the whole update in a
    // transaction when subjects change. Non-subject updates take the simple
    // single-statement path below.
    if (hasSubjectUpdate) {
      await withTransaction(async (client) => {
        const parentResult = await client.query<{ parent_id: string }>(
          `SELECT parent_id FROM learner WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
          [learnerId] as never[]
        );
        const parentId = parentResult.rows[0]?.parent_id;
        if (!parentId) {
          throw new Error(`Learner not found: ${learnerId}`);
        }

        const resolvedIds = await resolveSubjectIds(
          client,
          parentId,
          data.subjectIds as string[]
        );

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
        sets.push(`subjects = $${i++}::jsonb`);
        params.push(JSON.stringify(resolvedIds));
        params.push(learnerId);
        await client.query(
          `UPDATE learner SET ${sets.join(', ')}
           WHERE id = $${i} AND deleted_at IS NULL`,
          params as never[]
        );
      });
      return;
    }

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
