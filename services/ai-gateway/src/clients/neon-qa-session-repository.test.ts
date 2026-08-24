/**
 * Unit tests for NeonQASessionRepository.
 * Mocks the pg pool's query() to verify row mapping and the upsert.
 */

import { NeonQASessionRepository } from './neon-qa-session-repository';
import type { QASession } from '../services/qa';
import type { Pool } from 'pg';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonQASessionRepository', () => {
  describe('getSession', () => {
    it('maps a row to a QASession', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { chapter_id: 'chap-1', question_count: 3, context_history: ['Q1', 'Q2'] },
        ],
      });
      const repo = new NeonQASessionRepository({ learnerId: 'l1', pool: mockPool(query) });

      const session = await repo.getSession('sess-1');
      expect(session).toEqual({
        chapterId: 'chap-1',
        questionCount: 3,
        contextHistory: ['Q1', 'Q2'],
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM qa_session');
      expect(sql).toContain('WHERE id = $1');
      expect(params).toEqual(['sess-1']);
    });

    it('returns null when the session does not exist', async () => {
      const repo = new NeonQASessionRepository({ learnerId: 'l1', pool: mockPool() });
      expect(await repo.getSession('missing')).toBeNull();
    });

    it('defaults context_history to [] when not an array', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ chapter_id: 'c', question_count: 0, context_history: null }],
      });
      const repo = new NeonQASessionRepository({ learnerId: 'l1', pool: mockPool(query) });
      const session = await repo.getSession('s');
      expect(session?.contextHistory).toEqual([]);
    });
  });

  describe('updateSession', () => {
    it('upserts with the construction-time learnerId and serialized history', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonQASessionRepository({ learnerId: 'learner-42', pool: mockPool(query) });

      const session: QASession = {
        chapterId: 'chap-7',
        questionCount: 5,
        contextHistory: ['Q: a\nA: b'],
      };
      await repo.updateSession('sess-9', session);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO qa_session');
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
      expect(params).toEqual([
        'sess-9',
        'learner-42',
        'chap-7',
        5,
        JSON.stringify(['Q: a\nA: b']),
      ]);
    });
  });
});
