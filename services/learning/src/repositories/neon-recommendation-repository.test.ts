/**
 * Unit tests for NeonRecommendationRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonRecommendationRepository } from './neon-recommendation-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonRecommendationRepository', () => {
  describe('getChapterDataForLearner', () => {
    it('returns per-chapter recommendation data with grouped quiz attempts', async () => {
      const completedAt = new Date('2026-02-01T09:00:00.000Z');
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              chapter_id: 'c-1',
              chapter_name: 'Nouns',
              book_name: 'Grammar',
              subject_name: 'English',
              total_content_pages: '8',
              pages_read: '8',
              total_exercises: '10',
              exercises_correct: '2',
              last_activity_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { chapter_id: 'c-1', score_percentage: '40', completed_at: completedAt },
          ],
        });
      const repo = new NeonRecommendationRepository({ pool: mockPool(query) });

      const data = await repo.getChapterDataForLearner('l-1');
      expect(data).toEqual([
        {
          chapterId: 'c-1',
          chapterName: 'Nouns',
          bookName: 'Grammar',
          subjectName: 'English',
          totalContentPages: 8,
          pagesRead: 8,
          totalExercises: 10,
          exercisesCorrect: 2,
          quizAttempts: [
            { scorePercentage: 40, completedAt: '2026-02-01T09:00:00.000Z' },
          ],
          lastActivityAt: null,
        },
      ]);

      const [statsSql, statsParams] = query.mock.calls[0];
      expect(statsSql).toContain('FROM chapter c');
      expect(statsSql).toContain('b.learner_id = $1');
      expect(statsParams).toEqual(['l-1']);
    });
  });

  describe('learnerExists', () => {
    it('returns true when an active learner row exists', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const repo = new NeonRecommendationRepository({ pool: mockPool(query) });
      expect(await repo.learnerExists('l-1')).toBe(true);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['l-1']);
    });

    it('returns false when no learner row exists', async () => {
      const repo = new NeonRecommendationRepository({ pool: mockPool() });
      expect(await repo.learnerExists('missing')).toBe(false);
    });
  });
});
