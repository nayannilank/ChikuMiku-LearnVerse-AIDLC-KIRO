/**
 * Unit tests for NeonManageLearnerRepository.
 * Mocks the pg pool's query() via an injected pool — no real database.
 */

import { NeonManageLearnerRepository } from './neon-manage-learner-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

const MATHS_ID = '11111111-2222-4333-8444-555555555555';
const SCI_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';

describe('NeonManageLearnerRepository', () => {
  describe('findLearnersByParentId', () => {
    it('maps rows and resolves subject UUIDs to names', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'l-1',
              parent_id: 'p-1',
              username: 'kiddo',
              name: 'Kid One',
              gender: 'female',
              grade: '1st',
              school_name: 'School of India',
              subjects: [MATHS_ID, SCI_ID],
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { id: MATHS_ID, name: 'Maths' },
            { id: SCI_ID, name: 'Science' },
          ],
        });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      const learners = await repo.findLearnersByParentId('p-1');
      expect(learners).toEqual([
        {
          id: 'l-1',
          username: 'kiddo',
          name: 'Kid One',
          gender: 'female',
          grade: '1st',
          schoolName: 'School of India',
          subjectIds: ['Maths', 'Science'],
          customSubjects: [],
        },
      ]);

      const [listSql, listParams] = query.mock.calls[0];
      expect(listSql).toContain('FROM learner');
      expect(listSql).toContain('deleted_at IS NULL');
      expect(listParams).toEqual(['p-1']);
    });

    it('keeps legacy name-string subjects and skips the subject lookup', async () => {
      const query = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'l-1',
            parent_id: 'p-1',
            username: 'kiddo',
            name: 'Kid One',
            gender: 'male',
            grade: '2nd',
            school_name: 'ABC School',
            subjects: ['Maths', 'English'],
          },
        ],
      });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      const learners = await repo.findLearnersByParentId('p-1');
      expect(learners[0].subjectIds).toEqual(['Maths', 'English']);
      // No UUIDs -> no second (subject-resolution) query.
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('findLearnerById', () => {
    it('returns the record with parentId, or null when missing', async () => {
      const query = jest.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'l-1',
            parent_id: 'p-1',
            username: 'kiddo',
            name: 'Kid One',
            gender: 'other',
            grade: 'LKG',
            school_name: 'ABC School',
            subjects: [],
          },
        ],
      });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      const learner = await repo.findLearnerById('l-1');
      expect(learner?.parentId).toBe('p-1');
      expect(learner?.id).toBe('l-1');
    });

    it('returns null when no active learner row is found', async () => {
      const repo = new NeonManageLearnerRepository({ pool: mockPool() });
      expect(await repo.findLearnerById('missing')).toBeNull();
    });
  });

  describe('updateLearner', () => {
    it('updates only provided fields and serializes subjects as JSONB', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      await repo.updateLearner('l-1', { name: 'New Name', subjectIds: ['s-a', 's-b'] });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE learner');
      expect(sql).toContain('name = $1');
      expect(sql).toContain('subjects = $2::jsonb');
      expect(params).toEqual(['New Name', JSON.stringify(['s-a', 's-b']), 'l-1']);
    });

    it('issues no query when nothing is provided', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });
      await repo.updateLearner('l-1', {});
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteLearner', () => {
    it('sets deleted_at on the active row', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      await repo.softDeleteLearner('l-1');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE learner SET deleted_at = NOW()');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['l-1']);
    });
  });
});
