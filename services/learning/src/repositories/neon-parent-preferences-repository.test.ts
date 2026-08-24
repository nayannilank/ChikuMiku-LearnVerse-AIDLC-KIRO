/**
 * Unit tests for NeonParentPreferencesRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonParentPreferencesRepository } from './neon-parent-preferences-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonParentPreferencesRepository', () => {
  describe('getPreferences', () => {
    it('maps the notification preference flags', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { progress_alerts_enabled: true, streak_reminders_enabled: false },
        ],
      });
      const repo = new NeonParentPreferencesRepository({ pool: mockPool(query) });

      const prefs = await repo.getPreferences('p-1');
      expect(prefs).toEqual({
        progressAlertsEnabled: true,
        streakRemindersEnabled: false,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('progress_alerts_enabled');
      expect(sql).toContain('streak_reminders_enabled');
      expect(sql).toContain('FROM parent');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['p-1']);
    });

    it('returns null when the parent does not exist', async () => {
      const repo = new NeonParentPreferencesRepository({ pool: mockPool() });
      expect(await repo.getPreferences('missing')).toBeNull();
    });
  });
});
