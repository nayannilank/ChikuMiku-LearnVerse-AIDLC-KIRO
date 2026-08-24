/**
 * Unit tests for NeonQuizSessionRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonQuizSessionRepository } from './neon-quiz-session-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonQuizSessionRepository', () => {
  describe('chapterHasQuestions', () => {
    it('returns true when a revision_question row exists', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const repo = new NeonQuizSessionRepository({ pool: mockPool(query) });

      expect(await repo.chapterHasQuestions('c-1')).toBe(true);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM revision_question');
      expect(sql).toContain('chapter_id = $1');
      expect(sql).toContain('LIMIT 1');
      expect(params).toEqual(['c-1']);
    });

    it('returns false when no questions exist', async () => {
      const repo = new NeonQuizSessionRepository({ pool: mockPool() });
      expect(await repo.chapterHasQuestions('c-1')).toBe(false);
    });
  });
});
