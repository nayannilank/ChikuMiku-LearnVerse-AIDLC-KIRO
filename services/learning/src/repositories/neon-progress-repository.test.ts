/**
 * Unit tests for NeonProgressRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonProgressRepository } from './neon-progress-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonProgressRepository', () => {
  describe('getChapterProgressForLearner', () => {
    it('joins chapter/book/subject, aggregates stats, and groups quiz attempts', async () => {
      const completedAt = new Date('2026-01-02T10:00:00.000Z');
      const lastActivity = new Date('2026-01-05T12:00:00.000Z');
      const query = jest
        .fn()
        // First call: per-chapter stats
        .mockResolvedValueOnce({
          rows: [
            {
              chapter_id: 'c-1',
              chapter_name: 'Fractions',
              book_name: 'Math Book',
              subject_name: 'Math',
              total_content_pages: '10',
              pages_read: '4',
              total_exercises: '20',
              exercises_correct: '15',
              last_activity_at: lastActivity,
            },
          ],
        })
        // Second call: quiz attempts for the learner
        .mockResolvedValueOnce({
          rows: [
            { chapter_id: 'c-1', score_percentage: '80', completed_at: completedAt },
          ],
        });
      const repo = new NeonProgressRepository({ pool: mockPool(query) });

      const records = await repo.getChapterProgressForLearner('l-1');

      expect(records).toEqual([
        {
          chapterId: 'c-1',
          chapterName: 'Fractions',
          bookName: 'Math Book',
          subjectName: 'Math',
          totalContentPages: 10,
          pagesRead: 4,
          totalExercises: 20,
          exercisesCorrect: 15,
          quizAttempts: [
            { scorePercentage: 80, completedAt: '2026-01-02T10:00:00.000Z' },
          ],
          lastActivityAt: '2026-01-05T12:00:00.000Z',
        },
      ]);

      const [statsSql, statsParams] = query.mock.calls[0];
      expect(statsSql).toContain('FROM chapter c');
      expect(statsSql).toContain('JOIN book b');
      expect(statsSql).toContain('JOIN subject s');
      expect(statsSql).toContain('b.learner_id = $1');
      expect(statsSql).toContain("classification = 'content'");
      expect(statsSql).toContain("activity_type = 'read'");
      expect(statsParams).toEqual(['l-1']);

      const [attemptsSql, attemptsParams] = query.mock.calls[1];
      expect(attemptsSql).toContain('FROM quiz_attempt');
      expect(attemptsSql).toContain('learner_id = $1');
      expect(attemptsParams).toEqual(['l-1']);
    });

    it('returns an empty quizAttempts array for chapters with no attempts', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              chapter_id: 'c-1',
              chapter_name: 'Ch1',
              book_name: 'B',
              subject_name: 'S',
              total_content_pages: '5',
              pages_read: '0',
              total_exercises: '0',
              exercises_correct: '0',
              last_activity_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });
      const repo = new NeonProgressRepository({ pool: mockPool(query) });

      const records = await repo.getChapterProgressForLearner('l-1');
      expect(records[0].quizAttempts).toEqual([]);
      expect(records[0].lastActivityAt).toBeNull();
    });
  });

  describe('learnerExists', () => {
    it('returns true when an active learner row exists', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const repo = new NeonProgressRepository({ pool: mockPool(query) });

      expect(await repo.learnerExists('l-1')).toBe(true);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['l-1']);
    });

    it('returns false when no learner row exists', async () => {
      const repo = new NeonProgressRepository({ pool: mockPool() });
      expect(await repo.learnerExists('missing')).toBe(false);
    });
  });
});
