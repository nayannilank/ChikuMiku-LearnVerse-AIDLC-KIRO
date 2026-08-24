/**
 * Unit tests for NeonChapterRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonChapterRepository } from './neon-chapter-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonChapterRepository', () => {
  describe('getChapterAcademicYear', () => {
    it('returns the academic year for an existing chapter', async () => {
      const query = jest
        .fn()
        .mockResolvedValue({ rows: [{ academic_year: '2025-2026' }] });
      const repo = new NeonChapterRepository({ pool: mockPool(query) });

      expect(await repo.getChapterAcademicYear('c-1')).toBe('2025-2026');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT academic_year');
      expect(sql).toContain('FROM chapter');
      expect(sql).toContain('id = $1');
      expect(params).toEqual(['c-1']);
    });

    it('returns null when the chapter does not exist', async () => {
      const repo = new NeonChapterRepository({ pool: mockPool() });
      expect(await repo.getChapterAcademicYear('missing')).toBeNull();
    });
  });
});
