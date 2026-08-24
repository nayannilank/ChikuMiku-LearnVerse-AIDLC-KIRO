/**
 * Unit tests for NeonEmbeddingRepository.
 * Mocks the pg pool's query() to verify SQL params, vector formatting, and
 * score mapping — without a real database.
 */

import { NeonEmbeddingRepository } from './neon-embedding-repository';
import type { EmbeddingResult } from '../services/embedding';
import type { Pool } from 'pg';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonEmbeddingRepository', () => {
  describe('store', () => {
    it('does nothing for an empty batch', async () => {
      const pool = mockPool();
      const repo = new NeonEmbeddingRepository({ pool });
      await repo.store('chap-1', []);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('builds a multi-row insert with vector literals in order', async () => {
      const pool = mockPool();
      const repo = new NeonEmbeddingRepository({ pool });

      const rows: EmbeddingResult[] = [
        { pageNumber: 1, chunkIndex: 0, content: 'a', embedding: [0.1, 0.2] },
        { pageNumber: 1, chunkIndex: 1, content: 'b', embedding: [0.3, 0.4] },
      ];
      await repo.store('chap-1', rows);

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO embedding');
      expect(sql).toContain('$5::vector');
      expect(sql).toContain('$10::vector');

      // First row params.
      expect(params.slice(0, 5)).toEqual(['chap-1', 1, 0, 'a', '[0.1,0.2]']);
      // Second row params.
      expect(params.slice(5, 10)).toEqual(['chap-1', 1, 1, 'b', '[0.3,0.4]']);
    });
  });

  describe('deleteByChapter', () => {
    it('deletes all rows for a chapter', async () => {
      const pool = mockPool();
      const repo = new NeonEmbeddingRepository({ pool });
      await repo.deleteByChapter('chap-9');

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM embedding');
      expect(params).toEqual(['chap-9']);
    });
  });

  describe('search', () => {
    it('orders by cosine distance and maps score = 1 - distance', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { content: 'closest', distance: 0.1 },
          { content: 'farther', distance: 0.4 },
        ],
      });
      const pool = mockPool(query);
      const repo = new NeonEmbeddingRepository({ pool });

      const results = await repo.search([0.5, 0.6], 'chap-1', 5);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('embedding <=> $1::vector');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('LIMIT $3');
      expect(params).toEqual(['[0.5,0.6]', 'chap-1', 5]);

      expect(results).toEqual([
        { content: 'closest', score: 0.9 },
        { content: 'farther', score: expect.closeTo(0.6, 5) },
      ]);
    });

    it('parses string distances (pg numeric) and clamps score to [0,1]', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { content: 'x', distance: '0.0' }, // score 1
          { content: 'y', distance: '1.5' }, // score -0.5 -> clamped to 0
        ],
      });
      const repo = new NeonEmbeddingRepository({ pool: mockPool(query) });

      const results = await repo.search([1], 'c', 2);
      expect(results[0].score).toBe(1);
      expect(results[1].score).toBe(0);
    });

    it('returns an empty array when there are no matches', async () => {
      const repo = new NeonEmbeddingRepository({ pool: mockPool() });
      expect(await repo.search([1], 'c', 5)).toEqual([]);
    });
  });
});
