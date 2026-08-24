/**
 * Shared query helper for per-chapter, per-learner statistics.
 *
 * Both the progress handler (ChapterProgressRecord) and the recommendations
 * handler (ChapterRecommendationData) require an identical per-chapter shape:
 * chapter/book/subject names, content-page counts, read progress, exercise
 * aggregates, quiz attempts, and last activity time. This helper produces that
 * shape once so NeonProgressRepository and NeonRecommendationRepository stay in
 * sync. Uses the shared @chikumiku/db pool.
 */

import { toIsoOrNull, toNumber, type Pool, type PoolClient } from '@chikumiku/db';
import type { QuizAttempt } from '@chikumiku/validation';

/** Per-chapter, per-learner statistics (superset used by both handlers). */
export interface ChapterLearnerStats {
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectName: string;
  totalContentPages: number;
  pagesRead: number;
  totalExercises: number;
  exercisesCorrect: number;
  quizAttempts: QuizAttempt[];
  lastActivityAt: string | null;
}

interface ChapterStatsRow {
  chapter_id: string;
  chapter_name: string;
  book_name: string;
  subject_name: string;
  total_content_pages: number | string;
  pages_read: number | string;
  total_exercises: number | string;
  exercises_correct: number | string;
  last_activity_at: Date | string | null;
}

interface QuizAttemptRow {
  chapter_id: string;
  score_percentage: number | string;
  completed_at: Date | string;
}

/**
 * Fetches per-chapter statistics for every chapter belonging to a learner
 * (joined chapter -> book -> subject, scoped by book.learner_id).
 *
 * ASSUMPTIONS (documented, since the schema has no direct columns for these):
 * - pagesRead: derived as the count of 'read' entries in activity_log for the
 *   chapter+learner. There is no page-level read-tracking column, so this
 *   counts read activities as a proxy for reading progress.
 * - totalExercises / exercisesCorrect: aggregated (summed) from quiz_attempt
 *   for the chapter+learner. No exercise-attempt table records per-question
 *   grammar-exercise correctness, so quiz_attempt totals are the only
 *   per-learner correctness signal available.
 */
export async function fetchChapterLearnerStats(
  db: Pool | PoolClient,
  learnerId: string
): Promise<ChapterLearnerStats[]> {
  const statsResult = await db.query<ChapterStatsRow>(
    `SELECT c.id AS chapter_id,
            c.chapter_name AS chapter_name,
            b.name AS book_name,
            s.name AS subject_name,
            (SELECT COUNT(*) FROM page p
             WHERE p.chapter_id = c.id AND p.classification = 'content')
              AS total_content_pages,
            (SELECT COUNT(*) FROM activity_log a
             WHERE a.chapter_id = c.id AND a.learner_id = b.learner_id
               AND a.activity_type = 'read')
              AS pages_read,
            (SELECT COALESCE(SUM(qa.total_questions), 0) FROM quiz_attempt qa
             WHERE qa.chapter_id = c.id AND qa.learner_id = b.learner_id)
              AS total_exercises,
            (SELECT COALESCE(SUM(qa.correct_answers), 0) FROM quiz_attempt qa
             WHERE qa.chapter_id = c.id AND qa.learner_id = b.learner_id)
              AS exercises_correct,
            (SELECT MAX(a."timestamp") FROM activity_log a
             WHERE a.chapter_id = c.id AND a.learner_id = b.learner_id)
              AS last_activity_at
     FROM chapter c
     JOIN book b ON b.id = c.book_id
     JOIN subject s ON s.id = b.subject_id
     WHERE b.learner_id = $1
     ORDER BY s.name, b.name, c.chapter_number`,
    [learnerId] as never[]
  );

  // Fetch all quiz attempts for the learner in one query and group by chapter.
  const attemptsResult = await db.query<QuizAttemptRow>(
    `SELECT chapter_id, score_percentage, completed_at
     FROM quiz_attempt
     WHERE learner_id = $1
     ORDER BY completed_at ASC`,
    [learnerId] as never[]
  );

  const attemptsByChapter = new Map<string, QuizAttempt[]>();
  for (const row of attemptsResult.rows) {
    const attempts = attemptsByChapter.get(row.chapter_id) ?? [];
    attempts.push({
      scorePercentage: toNumber(row.score_percentage),
      completedAt: toIsoOrNull(row.completed_at) ?? '',
    });
    attemptsByChapter.set(row.chapter_id, attempts);
  }

  return statsResult.rows.map((row) => ({
    chapterId: row.chapter_id,
    chapterName: row.chapter_name,
    bookName: row.book_name,
    subjectName: row.subject_name,
    totalContentPages: toNumber(row.total_content_pages),
    pagesRead: toNumber(row.pages_read),
    totalExercises: toNumber(row.total_exercises),
    exercisesCorrect: toNumber(row.exercises_correct),
    quizAttempts: attemptsByChapter.get(row.chapter_id) ?? [],
    lastActivityAt: toIsoOrNull(row.last_activity_at),
  }));
}

/** Shared learnerExists check: an active (non-deleted) learner row exists. */
export async function learnerExistsQuery(
  db: Pool | PoolClient,
  learnerId: string
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM learner WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [learnerId] as never[]
  );
  return result.rows.length > 0;
}
