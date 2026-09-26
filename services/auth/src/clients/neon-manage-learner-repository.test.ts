/**
 * Unit tests for NeonManageLearnerRepository.
 * Mocks the pg pool's query() via an injected pool — no real database.
 */

jest.mock('@chikumiku/db', () => {
  const actual = jest.requireActual('@chikumiku/db');
  return {
    ...actual,
    getPool: jest.fn(),
    withTransaction: jest.fn(),
  };
});

import { withTransaction } from '@chikumiku/db';
import { NeonManageLearnerRepository } from './neon-manage-learner-repository';
import type { Pool } from '@chikumiku/db';

const mockedWithTransaction = withTransaction as unknown as jest.Mock;

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

/** A fake transaction client whose query() is a jest.fn. */
function fakeClient(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as { query: jest.Mock };
}

beforeEach(() => {
  mockedWithTransaction.mockReset();
});

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

  describe('updateLearner (non-subject fields)', () => {
    it('updates only provided fields with a single statement', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });

      await repo.updateLearner('l-1', { grade: '2nd', schoolName: 'New School' });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE learner');
      expect(sql).toContain('grade = $1');
      expect(sql).toContain('school_name = $2');
      expect(params).toEqual(['2nd', 'New School', 'l-1']);
      // No transaction when subjects are not being changed.
      expect(mockedWithTransaction).not.toHaveBeenCalled();
    });

    it('issues no query when nothing is provided', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonManageLearnerRepository({ pool: mockPool(query) });
      await repo.updateLearner('l-1', {});
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('updateLearner (subjects)', () => {
    it('resolves subject names to subject.ids in a transaction, creating custom rows as needed', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ parent_id: 'p-1' }] }) // learner -> parent lookup
        .mockResolvedValueOnce({ rows: [{ id: MATHS_ID }] }) // resolve "Maths" (default)
        .mockResolvedValueOnce({ rows: [] }) // resolve "Art" (no match)
        .mockResolvedValueOnce({ rows: [{ id: 'art-uuid' }] }) // insert custom "Art"
        .mockResolvedValueOnce({ rows: [] }); // final UPDATE learner
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      const repo = new NeonManageLearnerRepository();
      await repo.updateLearner('l-1', { grade: '3rd', subjectIds: ['Maths', 'Art'] });

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      // Final UPDATE stores the RESOLVED ids, not the names.
      const [updateSql, updateParams] = clientQuery.mock.calls[4];
      expect(updateSql).toContain('UPDATE learner');
      expect(updateSql).toContain('subjects = ');
      // params: grade, subjects-json, learnerId
      expect(updateParams[0]).toBe('3rd');
      expect(updateParams[1]).toBe(JSON.stringify([MATHS_ID, 'art-uuid']));
      expect(updateParams[2]).toBe('l-1');
    });

    it('passes UUID subject values through unchanged', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ parent_id: 'p-1' }] }) // learner -> parent
        .mockResolvedValueOnce({ rows: [] }); // final UPDATE (no resolution queries for UUIDs)
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      const repo = new NeonManageLearnerRepository();
      await repo.updateLearner('l-1', { subjectIds: [MATHS_ID, SCI_ID] });

      const updateParams = clientQuery.mock.calls[1][1];
      expect(updateParams[0]).toBe(JSON.stringify([MATHS_ID, SCI_ID]));
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
