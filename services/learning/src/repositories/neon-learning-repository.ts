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
 * Parses the denormalized `learner.subjects` JSONB column into SubjectRecord[].
 *
 * ASSUMPTION: `learner.subjects` is a JSONB array whose elements are objects of
 * the shape `{ id, name }` (the per-learner subject enrollment list). pg returns
 * JSONB as an already-parsed JS value, but we defensively handle a raw string.
 * Elements that don't carry both `id` and `name` are skipped.
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
    if (element && typeof element === 'object') {
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

  async getLearnersByParentId(parentId: string): Promise<LearnerRecord[]> {
    const db = await this.db();
    // Only active (non-deleted) learners. `subjects` is the denormalized
    // per-learner enrollment JSONB (see parseSubjectsJsonb assumption).
    const result = await db.query<LearnerRow>(
      `SELECT id, name, grade, subjects
       FROM learner
       WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [parentId] as never[]
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      grade: row.grade,
      subjects: parseSubjectsJsonb(row.subjects),
    }));
  }

  async getSubjectsByLearnerId(learnerId: string): Promise<SubjectRecord[]> {
    const db = await this.db();
    // ASSUMPTION: a learner's subjects come from the denormalized
    // `learner.subjects` JSONB column (single source of truth), since the
    // `subject` table is keyed by parent, not learner.
    const result = await db.query<{ subjects: unknown }>(
      `SELECT subjects
       FROM learner
       WHERE id = $1 AND deleted_at IS NULL`,
      [learnerId] as never[]
    );
    if (result.rows.length === 0) {
      return [];
    }
    return parseSubjectsJsonb(result.rows[0].subjects);
  }

  async getBooksBySubjectAndLearner(
    subjectId: string,
    learnerId: string
  ): Promise<BookRecord[]> {
    const db = await this.db();
    const result = await db.query<BookRow>(
      `SELECT id, subject_id, name
       FROM book
       WHERE subject_id = $1 AND learner_id = $2
       ORDER BY name`,
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
