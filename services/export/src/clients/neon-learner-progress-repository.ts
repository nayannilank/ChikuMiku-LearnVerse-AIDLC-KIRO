/**
 * Neon-backed LearnerProgressRepository for the export service.
 *
 * Concrete implementation of `LearnerProgressRepository` (see
 * ../handlers/export-report.ts) against the ChikuMiku LearnVerse schema
 * (infra/migrations/002_create_tables.sql). Uses the shared @chikumiku/db
 * connection pool and follows the same conventions as the auth NeonDBClient:
 * a `pool` test seam, a private `db()` accessor, parameterized queries, and
 * explicit snake_case -> camelCase mapping.
 *
 * ── Aggregation model ──────────────────────────────────────────────────────
 * A learner's subjects are derived from the books they own:
 *   learner ──< book >── subject          (book.learner_id, book.subject_id)
 *   book    ──< chapter                    (chapter.book_id)
 *   chapter ──< quiz_attempt               (quiz_attempt.chapter_id + learner_id)
 *
 * Per (learner, subject):
 *   - totalChapters       = distinct chapters across that subject's books
 *   - chaptersCompleted   = distinct chapters that have >= 1 quiz_attempt by
 *                           the learner. The schema has no explicit "chapter
 *                           completed" flag, so a completed quiz attempt is
 *                           treated as the completion signal (documented
 *                           assumption).
 *   - averageScore        = AVG(quiz_attempt.score_percentage) across that
 *                           subject's chapters for the learner (0 when none)
 *   - completionPercentage = round(chaptersCompleted / totalChapters * 100)
 *
 * overallCompletion is computed in-process as the ratio of total completed
 * chapters to total chapters across all of the learner's subjects.
 *
 * Activity history comes from activity_log, joined out to chapter/book/subject
 * for display names. Fields not present as columns (score, durationMinutes)
 * are read from the metadata JSONB payload with documented defaults.
 */

import {
  getPool,
  toIso,
  toNumber,
  type Pool,
  type PoolClient,
} from '@chikumiku/db';
import type {
  LearnerProgressRepository,
  LearnerProgressData,
  SubjectProgress,
  ActivityEntry,
} from '../handlers/export-report';

/** Options for the Neon learner-progress repository (test seam). */
export interface NeonLearnerProgressRepositoryOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Row shape for the learner-name lookup. */
interface LearnerNameRow {
  id: string;
  name: string;
}

/** Row shape for the per-subject aggregation query. */
interface SubjectAggRow {
  learner_id: string;
  subject_name: string;
  total_chapters: number | string;
  chapters_completed: number | string;
  /** AVG returns null (no attempts) or a numeric string. */
  average_score: number | string | null;
}

/** Row shape for the activity-history query. */
interface ActivityRow {
  learner_id: string;
  activity_type: string;
  local_date: Date | string;
  activity_timestamp: Date | string;
  metadata: Record<string, unknown> | null;
  chapter_name: string | null;
  subject_name: string | null;
}

/**
 * Maps a raw `activity_log.activity_type` string to the constrained
 * `ActivityEntry['type']` union. The schema stores activity_type as a free
 * VARCHAR(30), so we normalize case and accept a few reasonable synonyms.
 * Anything unrecognized falls back to `'reading'` (the most generic content
 * interaction) — documented default.
 */
function mapActivityType(raw: string): ActivityEntry['type'] {
  const normalized = (raw ?? '').toLowerCase();
  if (normalized.includes('quiz')) return 'quiz';
  if (normalized.includes('pronunc')) return 'pronunciation';
  if (normalized.includes('grammar')) return 'grammar';
  if (
    normalized.includes('qa') ||
    normalized.includes('question') ||
    normalized.includes('answer')
  ) {
    return 'qa';
  }
  // 'reading', 'read', 'explanation', or anything else.
  return 'reading';
}

/**
 * Reads an optional numeric field from an activity_log metadata JSONB object.
 * Returns undefined when the key is absent or non-numeric.
 */
function readMetadataNumber(
  metadata: Record<string, unknown> | null,
  key: string
): number | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Export-service repository for learner progress, backed by Neon PostgreSQL.
 */
export class NeonLearnerProgressRepository
  implements LearnerProgressRepository
{
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonLearnerProgressRepositoryOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  async getLearnerIdsByParent(parentId: string): Promise<string[]> {
    const db = await this.db();
    // Only active (non-deleted) learners linked to the parent.
    const result = await db.query<{ id: string }>(
      `SELECT id FROM learner WHERE parent_id = $1 AND deleted_at IS NULL`,
      [parentId] as never[]
    );
    return result.rows.map((row) => row.id);
  }

  async getProgressForLearners(
    learnerIds: string[]
  ): Promise<LearnerProgressData[]> {
    // Nothing to fetch — avoid issuing empty ANY($1) queries.
    if (learnerIds.length === 0) {
      return [];
    }

    const db = await this.db();

    // 1. Learner display names. Preserves the requested id ordering below.
    const learnerResult = await db.query<LearnerNameRow>(
      `SELECT id, name FROM learner WHERE id = ANY($1) AND deleted_at IS NULL`,
      [learnerIds] as never[]
    );
    const learnerNameById = new Map<string, string>();
    for (const row of learnerResult.rows) {
      learnerNameById.set(row.id, row.name);
    }

    // 2. Per-subject aggregation: learner -> book -> subject -> chapter, with
    //    quiz_attempt joined for scores and completion. LEFT JOINs keep
    //    subjects/chapters with no attempts (averageScore -> 0).
    const subjectResult = await db.query<SubjectAggRow>(
      `SELECT
         b.learner_id AS learner_id,
         s.name AS subject_name,
         COUNT(DISTINCT c.id) AS total_chapters,
         COUNT(DISTINCT qa.chapter_id) AS chapters_completed,
         AVG(qa.score_percentage) AS average_score
       FROM book b
       JOIN subject s ON s.id = b.subject_id
       LEFT JOIN chapter c ON c.book_id = b.id
       LEFT JOIN quiz_attempt qa
         ON qa.chapter_id = c.id AND qa.learner_id = b.learner_id
       WHERE b.learner_id = ANY($1)
       GROUP BY b.learner_id, s.id, s.name
       ORDER BY b.learner_id, s.name`,
      [learnerIds] as never[]
    );

    // 3. Activity history from activity_log, most-recent first. chapter_id may
    //    be NULL (ON DELETE SET NULL), so chapter/subject joins are LEFT.
    const activityResult = await db.query<ActivityRow>(
      `SELECT
         al.learner_id AS learner_id,
         al.activity_type AS activity_type,
         al.local_date AS local_date,
         al."timestamp" AS activity_timestamp,
         al.metadata AS metadata,
         c.chapter_name AS chapter_name,
         s.name AS subject_name
       FROM activity_log al
       LEFT JOIN chapter c ON c.id = al.chapter_id
       LEFT JOIN book b ON b.id = c.book_id
       LEFT JOIN subject s ON s.id = b.subject_id
       WHERE al.learner_id = ANY($1)
       ORDER BY al.learner_id, al."timestamp" DESC`,
      [learnerIds] as never[]
    );

    // ── Group aggregation rows by learner ────────────────────────────────
    const subjectsByLearner = new Map<string, SubjectProgress[]>();
    // Running totals for overallCompletion (across all subjects).
    const chapterTotalsByLearner = new Map<
      string,
      { completed: number; total: number }
    >();

    for (const row of subjectResult.rows) {
      const totalChapters = toNumber(row.total_chapters);
      const chaptersCompleted = toNumber(row.chapters_completed);
      // AVG is null when the learner has no attempts in the subject.
      const averageScore =
        row.average_score === null ? 0 : Math.round(toNumber(row.average_score));
      const completionPercentage =
        totalChapters > 0
          ? Math.round((chaptersCompleted / totalChapters) * 100)
          : 0;

      const subject: SubjectProgress = {
        subjectName: row.subject_name,
        averageScore,
        completionPercentage,
        chaptersCompleted,
        totalChapters,
      };

      const list = subjectsByLearner.get(row.learner_id) ?? [];
      list.push(subject);
      subjectsByLearner.set(row.learner_id, list);

      const totals =
        chapterTotalsByLearner.get(row.learner_id) ?? { completed: 0, total: 0 };
      totals.completed += chaptersCompleted;
      totals.total += totalChapters;
      chapterTotalsByLearner.set(row.learner_id, totals);
    }

    // ── Group activity rows by learner ───────────────────────────────────
    const activitiesByLearner = new Map<string, ActivityEntry[]>();
    for (const row of activityResult.rows) {
      const entry: ActivityEntry = {
        // Use the full ISO timestamp for a precise, sortable date string.
        // (local_date is also available if a calendar-day value is needed.)
        date: toIso(row.activity_timestamp),
        type: mapActivityType(row.activity_type),
        subjectName: row.subject_name ?? '',
        chapterName: row.chapter_name ?? '',
        // score/durationMinutes are not columns; read them from metadata.
        // durationMinutes defaults to 0 when the activity did not record one.
        score: readMetadataNumber(row.metadata, 'score'),
        durationMinutes: readMetadataNumber(row.metadata, 'durationMinutes') ?? 0,
      };

      const list = activitiesByLearner.get(row.learner_id) ?? [];
      list.push(entry);
      activitiesByLearner.set(row.learner_id, list);
    }

    // ── Assemble results, one per requested learner id (order preserved) ──
    return learnerIds
      .filter((id) => learnerNameById.has(id))
      .map((learnerId) => {
        const totals = chapterTotalsByLearner.get(learnerId);
        const overallCompletion =
          totals && totals.total > 0
            ? Math.round((totals.completed / totals.total) * 100)
            : 0;

        return {
          learnerId,
          learnerName: learnerNameById.get(learnerId) ?? '',
          subjects: subjectsByLearner.get(learnerId) ?? [],
          overallCompletion,
          activityHistory: activitiesByLearner.get(learnerId) ?? [],
        };
      });
  }
}
