/**
 * Unit tests for the auth NeonDBClient.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonDBClient } from './neon-db-client';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('auth NeonDBClient', () => {
  describe('parentUsernameExists', () => {
    it('returns true when an active parent row is found', async () => {
      const pool = mockPool(jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }));
      const client = new NeonDBClient({ pool });

      expect(await client.parentUsernameExists('alice')).toBe(true);

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('FROM parent');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['alice']);
    });

    it('returns false when no row is found', async () => {
      const client = new NeonDBClient({ pool: mockPool() });
      expect(await client.parentUsernameExists('bob')).toBe(false);
    });
  });

  describe('createParent', () => {
    it('inserts and maps the returned row to a ParentRecord', async () => {
      const createdAt = new Date('2026-01-02T03:04:05.000Z');
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'p-1',
            username: 'alice',
            full_name: 'Alice A',
            phone: '1234567890',
            email: 'a@example.com',
            password_hash: 'hash',
            created_at: createdAt,
          },
        ],
      });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const record = await client.createParent({
        id: 'p-1',
        username: 'alice',
        fullName: 'Alice A',
        phone: '1234567890',
        email: 'a@example.com',
        passwordHash: 'hash',
      });

      expect(record).toEqual({
        id: 'p-1',
        username: 'alice',
        fullName: 'Alice A',
        phone: '1234567890',
        email: 'a@example.com',
        passwordHash: 'hash',
        createdAt: '2026-01-02T03:04:05.000Z',
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO parent');
      expect(sql).toContain('RETURNING');
      expect(params).toEqual([
        'p-1',
        'alice',
        'Alice A',
        '1234567890',
        'a@example.com',
        'hash',
      ]);
    });
  });
});
