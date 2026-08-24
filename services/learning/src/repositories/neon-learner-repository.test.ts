/**
 * Unit tests for NeonLearnerRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonLearnerRepository } from './neon-learner-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonLearnerRepository', () => {
  describe('getStreakData', () => {
    it('maps streak columns and formats last_active_date', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            current_streak: '5',
            last_active_date: '2026-01-02',
            longest_streak: '9',
          },
        ],
      });
      const repo = new NeonLearnerRepository({ pool: mockPool(query) });

      const streak = await repo.getStreakData('l-1');
      expect(streak).toEqual({
        currentStreak: 5,
        lastActiveDate: '2026-01-02',
        longestStreak: 9,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('current_streak');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['l-1']);
    });

    it('preserves a null last_active_date', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { current_streak: '0', last_active_date: null, longest_streak: '0' },
        ],
      });
      const repo = new NeonLearnerRepository({ pool: mockPool(query) });
      const streak = await repo.getStreakData('l-1');
      expect(streak?.lastActiveDate).toBeNull();
    });

    it('returns null when the learner does not exist', async () => {
      const repo = new NeonLearnerRepository({ pool: mockPool() });
      expect(await repo.getStreakData('missing')).toBeNull();
    });
  });

  describe('updateStreakData', () => {
    it('updates the denormalized streak fields with mapped params', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonLearnerRepository({ pool: mockPool(query) });

      await repo.updateStreakData('l-1', {
        currentStreak: 6,
        lastActiveDate: '2026-01-03',
        longestStreak: 9,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE learner');
      expect(sql).toContain('current_streak = $1');
      expect(sql).toContain('last_active_date = $2');
      expect(sql).toContain('longest_streak = $3');
      expect(params).toEqual([6, '2026-01-03', 9, 'l-1']);
    });
  });
});
