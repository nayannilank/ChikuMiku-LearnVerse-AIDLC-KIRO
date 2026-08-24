/**
 * Unit tests for NeonActivityRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonActivityRepository } from './neon-activity-repository';
import type { Pool } from '@chikumiku/db';
import type { ActivityRecord } from '@chikumiku/types';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonActivityRepository', () => {
  describe('saveActivity', () => {
    it('inserts into activity_log with mapped params', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonActivityRepository({ pool: mockPool(query) });

      const activity: ActivityRecord = {
        learnerId: 'l-1',
        activityType: 'read',
        chapterId: 'c-1',
        timestamp: '2026-01-02T03:04:05.000Z',
        localDate: '2026-01-02',
      };
      await repo.saveActivity(activity);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO activity_log');
      expect(sql).toContain('activity_type');
      expect(sql).toContain('local_date');
      expect(params).toEqual([
        'l-1',
        'c-1',
        'read',
        '2026-01-02',
        '2026-01-02T03:04:05.000Z',
      ]);
    });
  });

  describe('getActivityDates', () => {
    it('selects distinct dates ascending and formats as YYYY-MM-DD', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { local_date: '2026-01-01' },
          { local_date: new Date(2026, 0, 3) }, // local Jan 3
        ],
      });
      const repo = new NeonActivityRepository({ pool: mockPool(query) });

      const dates = await repo.getActivityDates('l-1');
      expect(dates).toEqual(['2026-01-01', '2026-01-03']);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT DISTINCT local_date');
      expect(sql).toContain('FROM activity_log');
      expect(sql).toContain('ORDER BY local_date ASC');
      expect(params).toEqual(['l-1']);
    });

    it('returns [] when there are no activities', async () => {
      const repo = new NeonActivityRepository({ pool: mockPool() });
      expect(await repo.getActivityDates('l-1')).toEqual([]);
    });
  });
});
