/**
 * Unit tests for NeonParentProfileRepository.
 * Mocks the pg pool's query() via an injected pool — no real database.
 */

import { NeonParentProfileRepository } from './neon-parent-profile-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonParentProfileRepository', () => {
  describe('findById', () => {
    it('maps a parent row to a ParentProfile (relationship omitted)', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'parent-uuid',
            username: 'alice',
            full_name: 'Alice Anderson',
            phone: '9876543210',
            email: 'alice@example.com',
            progress_alerts_enabled: true,
            streak_reminders_enabled: false,
            deleted_at: null,
          },
        ],
      });
      const repo = new NeonParentProfileRepository({ pool: mockPool(query) });

      const profile = await repo.findById('parent-uuid');
      expect(profile).toEqual({
        id: 'parent-uuid',
        username: 'alice',
        fullName: 'Alice Anderson',
        phone: '9876543210',
        email: 'alice@example.com',
        relationship: undefined,
        progressAlertsEnabled: true,
        streakRemindersEnabled: false,
        deletionScheduledAt: null,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM parent');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['parent-uuid']);
    });

    it('returns null when no active parent row is found', async () => {
      const repo = new NeonParentProfileRepository({ pool: mockPool() });
      expect(await repo.findById('missing')).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates only the provided persistable fields (ignores relationship)', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonParentProfileRepository({ pool: mockPool(query) });

      await repo.updateProfile('parent-uuid', {
        fullName: 'New Name',
        email: 'new@example.com',
        relationship: 'father', // not a parent column -> ignored
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE parent');
      expect(sql).toContain('full_name = $1');
      expect(sql).toContain('email = $2');
      expect(sql).not.toContain('relationship');
      // Params: full_name, email, then parentId.
      expect(params).toEqual(['New Name', 'new@example.com', 'parent-uuid']);
    });

    it('does not issue a query when only non-persistable fields are provided', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonParentProfileRepository({ pool: mockPool(query) });

      await repo.updateProfile('parent-uuid', { relationship: 'mother' });
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('findPasswordHashByUserId', () => {
    it('returns the stored hash', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ password_hash: '$2b$10$hash' }],
      });
      const repo = new NeonParentProfileRepository({ pool: mockPool(query) });
      expect(await repo.findPasswordHashByUserId('parent-uuid')).toBe('$2b$10$hash');
    });

    it('returns null when no row is found', async () => {
      const repo = new NeonParentProfileRepository({ pool: mockPool() });
      expect(await repo.findPasswordHashByUserId('missing')).toBeNull();
    });
  });
});
