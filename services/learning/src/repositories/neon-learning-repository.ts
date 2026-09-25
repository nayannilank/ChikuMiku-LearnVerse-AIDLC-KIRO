/**
 * Neon-backed implementation of ILearningRepository.
 *
 * Concrete implementation against the learner/subject/book/chapter/page and
 * quiz_attempt tables using the shared @chikumiku/db connection pool.
 *
 * Follows the reference pattern in services/auth/src/clients/neon-db-client.ts:
 * - constructor accepts an injectable pool/client (test seam)
 * - `db()` returns the injected pool or the shared pool
 * - explicit snake_case -> camelCase mapping with `toNumber` coercions
 * - parameterized queries
 */

import { getPool, toNumber, type Pool, type PoolClient } from '@chikumiku/db';
import type {
  ILearningRepository,
  LearnerRecord,
  SubjectRecord,
  BookRecord,
  ChapterRecord,
  ExerciseRecord,
  QuizAttemptRecord,
} from './learning-repository';

/**
 * Matches a canonical UUID (any version). Used to tell a real `subject.id`
 * apart from a subject *name* carried by the denormalized enrollment list,
 * so a name is never passed into a UUID-typed column.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Options for the Neon learning repository (test seam). */
export interface NeonLearningRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

interface LearnerRow {
  id: string;
  name: string;
  grade: string;
  subjects: unknown;
}

interface SubjectRow {
  id: string;
  name: string;
}

interface BookRow {
  id: string;
  subject_id: string;
  name: string;
}

interface ChapterRow {
  id: string;
  book_id: string;
  chapter_number: number | string;
  chapter_name: string;
  total_content_pages: number | string;
}

interface ExerciseRow {
  attempts: number | string;
  total_questions: number | string | null;
  correct_answers: number | string | null;
}

interface QuizAttemptSummaryRow {
  total_attempts: number | string;
  highest_score: number | string | null;
  most_recent_score: number | string | null;
}

/**
 * Parses the denormalized `learner.subjects` JSONB column into raw enrollment
 * entries. The column is a JSONB array whose elements may be, in order of how
 * the data has evolved:
 *   - string (current):  a `subject.id` UUID, e.g. "11111111-...."
 *     (learner registration now resolves names to real subject ids and stores
 *     the UUIDs — see services/auth NeonLearnerRepository.createLearner).
 *   - string (legacy):   a subject *name*, e.g. "Maths" (older rows written
 *     before name->id resolution existed).
 *   - object (legacy):   `{ id, name }`.
 *
 * This returns each entry as `{ id, name }` WITHOUT touching the DB:
 *   - object form keeps its id and name,
 *   - string form uses the value as id, and (provisionally) as name too.
 * The provisional name is a placeholder: `resolveSubjectNames` below replaces
 * it with the real `subject.name` for entries whose id is a UUID. A legacy
 * name-string entry has no matching `subject.id`, so its provisional name (the
 * name itself) is kept — which is exactly right.
 *
 * pg returns JSONB already parsed, but we defensively handle a raw string.
 * Empty strings and malformed objects are skipped.
 */
function parseSubjectsJsonb(value: unknown): SubjectRecord[] {
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
  const subjects: SubjectRecord[] = [];
  for (const element of parsed) {
    if (typeof element === 'string') {
      if (element.length > 0) {
        subjects.push({ id: element, name: element });
      }
    } else if (element && typeof element === 'object') {
      const obj = element as Record<string, unknown>;
      if (obj.id !== undefined && obj.name !== undefined) {
        subjects.push({ id: String(obj.id), name: String(obj.name) });
      }
    }
  }
  return subjects;
}

/**
 * Learning service repository backed by Neon PostgreSQL.
 */
export class NeonLearningRepository implements ILearningRepository {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonLearningRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  /**
   * Replaces the provisional names on parsed enrollment entries with the real
   * `subject.name`, for every entry whose id is a UUID (a real `subject.id`).
   * Entries whose id is not a UUID (legacy name-string enrollments) keep their
   * provisional name, which already IS the name. A single batched query keeps
   * this O(1) round-trips regardless of subject count.
   */
  private async resolveSubjectNames(
    entries: SubjectRecord[]
  ): Promise<SubjectRecord[]> {
    const uuidIds = entries.filter((e) => UUID_RE.test(e.id)).map((e) => e.id);
    if (uuidIds.length === 0) {
      return entries;
    }
    const db = await this.db();
    const result = await db.query<{ id: string; name: string }>(
      `SELECT id, name FROM subject WHERE id = ANY($1::uuid[])`,
      [uuidIds] as never[]
    );
    const nameById = new Map(result.rows.map((r) => [r.id, r.name]));
    return entries.map((e) =>
      nameById.has(e.id) ? { id: e.id, name: nameById.get(e.id)! } : e
    );
  }

  async getLearnersByParentId(parentId: string): Promise<LearnerRecord[]> {
    const db = await this.db();
    // Only active (non-deleted) learners. `subjects` is the denormalized
    // per-learner enrollment JSONB (a list of subject.id UUIDs on current
    // data; see parseSubjectsJsonb for the legacy forms).
    const result = await db.query<LearnerRow>(
      `SELECT id, name, grade, subjects
       FROM learner
       WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [parentId] as never[]
    );
    return Promise.all(
      result.rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        grade: row.grade,
        subjects: await this.resolveSubjectNames(parseSubjectsJsonb(row.subjects)),
      }))
    );
  }

  async getSubjectsByLearnerId(learnerId: string): Promise<SubjectRecord[]> {
    const db = await this.db();
    // A learner's subjects come from the denormalized `learner.subjects` JSONB
    // column (the enrollment list of subject.id UUIDs on current data). The ids
    // are resolved to real subject names via the `subject` table.
    const result = await db.query<{ subjects: unknown }>(
      `SELECT subjects
       FROM learner
       WHERE id = $1 AND deleted_at IS NULL`,
      [learnerId] as never[]
    );
    if (result.rows.length === 0) {
      return [];
    }
    return this.resolveSubjectNames(parseSubjectsJsonb(result.rows[0].subjects));
  }

  async getBooksBySubjectAndLearner(
    subjectId: string,
    learnerId: string
  ): Promise<BookRecord[]> {
    const db = await this.db();
    // `subjectId` here is the id carried on the dashboard's subject tree node.
    // That node is built from the learner's denormalized `subjects` enrollment
    // list, which stores subject *names* (e.g. "Maths"), not `subject`-table
    // UUIDs — so the value may be either a real UUID (object-form enrollment /
    // future data) or a plain name (the string-form data written at
    // registration).
    //
    // `book.subject_id` is a UUID column, so passing a bare name straight into
    // it makes Postgres raise `invalid input syntax for type uuid`. We branch
    // on whether the value looks like a UUID:
    //   - UUID  -> match books directly by book.subject_id.
    //   - name  -> resolve via the `subject` table (name -> subject.id) scoped
    //              to this learner's books; casting book.subject_id to text
    //              avoids any UUID coercion of the literal.
    // A name with no matching `subject` row (e.g. a default subject that was
    // never inserted into the table) simply yields no books, which is correct:
    // there is no content for it yet.
    const isUuid = UUID_RE.test(subjectId);
    const result = isUuid
      ? await db.query<BookRow>(
          `SELECT id, subject_id, name
           FROM book
           WHERE subject_id = $1 AND learner_id = $2
           ORDER BY name`,
          [subjectId, learnerId] as never[]
        )
      : await db.query<BookRow>(
          `SELECT b.id, b.subject_id, b.name
           FROM book b
           JOIN subject s ON s.id = b.subject_id
           WHERE s.name = $1 AND b.learner_id = $2
           ORDER BY b.name`,
          [subjectId, learnerId] as never[]
        );
    return result.rows.map((row) => ({
      id: row.id,
      subjectId: row.subject_id,
      name: row.name,
    }));
  }

  async getChaptersByBookId(bookId: string): Promise<ChapterRecord[]> {
    const db = await this.db();
    // totalContentPages = number of pages classified as 'content' for the chapter.
    const result = await db.query<ChapterRow>(
      `SELECT c.id,
              c.book_id,
              c.chapter_number,
              c.chapter_name,
              COUNT(p.id) FILTER (WHERE p.classification = 'content') AS total_content_pages
       FROM chapter c
       LEFT JOIN page p ON p.chapter_id = c.id
       WHERE c.book_id = $1
       GROUP BY c.id, c.book_id, c.chapter_number, c.chapter_name
       ORDER BY c.chapter_number`,
      [bookId] as never[]
    );
    return result.rows.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      chapterNumber: toNumber(row.chapter_number),
      chapterName: row.chapter_name,
      totalContentPages: toNumber(row.total_content_pages),
      // ASSUMPTION: there is no page-level read-tracking column, and this
      // method has no learner context to attribute reads to. We therefore
      // report pagesRead = 0 here. Per-learner read progress is derived in
      // NeonProgressRepository from the activity_log instead.
      pagesRead: 0,
    }));
  }

  async getExerciseByChapterId(chapterId: string): Promise<ExerciseRecord | null> {
    const db = await this.db();
    // ASSUMPTION: there is no dedicated exercise-attempt table recording
    // per-question correctness for grammar_exercise. The only table with
    // question totals and correctness is quiz_attempt, so exercise totals are
    // aggregated (summed) across a chapter's quiz attempts.
    const result = await db.query<ExerciseRow>(
      `SELECT COUNT(*) AS attempts,
              COALESCE(SUM(total_questions), 0) AS total_questions,
              COALESCE(SUM(correct_answers), 0) AS correct_answers
       FROM quiz_attempt
       WHERE chapter_id = $1`,
      [chapterId] as never[]
    );
    const row = result.rows[0];
    if (!row || toNumber(row.attempts) === 0) {
      return null;
    }
    return {
      chapterId,
      totalQuestions: toNumber(row.total_questions),
      correctAnswers: toNumber(row.correct_answers),
    };
  }

  async getQuizAttemptsByChapterId(
    chapterId: string
  ): Promise<QuizAttemptRecord | null> {
    const db = await this.db();
    const result = await db.query<QuizAttemptSummaryRow>(
      `SELECT COUNT(*) AS total_attempts,
              MAX(score_percentage) AS highest_score,
              (SELECT score_percentage
               FROM quiz_attempt
               WHERE chapter_id = $1
               ORDER BY completed_at DESC
               LIMIT 1) AS most_recent_score
       FROM quiz_attempt
       WHERE chapter_id = $1`,
      [chapterId] as never[]
    );
    const row = result.rows[0];
    if (!row || toNumber(row.total_attempts) === 0) {
      return null;
    }
    return {
      chapterId,
      totalAttempts: toNumber(row.total_attempts),
      highestScore: toNumber(row.highest_score ?? 0),
      mostRecentScore: toNumber(row.most_recent_score ?? 0),
    };
  }
}
