/**
 * Unit tests for NeonLearnerRepository.
 *
 * Direct queries use an injected pool whose query() is a jest.fn. The
 * transactional createLearner() mocks withTransaction() (from @chikumiku/db) by
 * invoking its callback with a fake client. No real database is touched.
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
import type { Pool } from '@chikumiku/db';
import { NeonLearnerRepository } from './neon-learner-repository';
import type { CreateLearnerData } from '../handlers/register-learner';

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

function createData(overrides?: Partial<CreateLearnerData>): CreateLearnerData {
  return {
    parentUsername: 'parent-user',
    username: 'learner-01',
    name: 'Test Learner',
    passwordHash: '$2b$10$hash',
    gender: 'male',
    relationship: 'son',
    grade: '5th',
    schoolName: 'Delhi Public School',
    subjectIds: ['math-101'],
    customSubjects: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockedWithTransaction.mockReset();
});

describe('NeonLearnerRepository', () => {
  describe('isUsernameTaken', () => {
    it('returns true when an active learner row is found', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const repo = new NeonLearnerRepository({ pool: mockPool(query) });

      expect(await repo.isUsernameTaken('learner-01')).toBe(true);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['learner-01']);
    });

    it('returns false when no row is found', async () => {
      const repo = new NeonLearnerRepository({ pool: mockPool() });
      expect(await repo.isUsernameTaken('nobody')).toBe(false);
    });
  });

  describe('countLearnersByParent', () => {
    it('joins learner to parent by username and returns the count', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ count: 3 }] });
      const repo = new NeonLearnerRepository({ pool: mockPool(query) });

      expect(await repo.countLearnersByParent('parent-user')).toBe(3);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('JOIN parent');
      expect(sql).toContain('p.username = $1');
      expect(params).toEqual(['parent-user']);
    });

    it('returns 0 when no rows come back', async () => {
      const repo = new NeonLearnerRepository({ pool: mockPool() });
      expect(await repo.countLearnersByParent('parent-user')).toBe(0);
    });
  });

  describe('createLearner', () => {
    it('resolves the parent, inserts the learner, and returns the new id', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'parent-uuid' }] }) // parent lookup
        .mockResolvedValueOnce({ rows: [{ id: 'learner-uuid' }] }); // learner insert
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      const repo = new NeonLearnerRepository();
      const id = await repo.createLearner(createData());

      expect(id).toBe('learner-uuid');
      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledTimes(2);

      const [parentSql, parentParams] = clientQuery.mock.calls[0];
      expect(parentSql).toContain('FROM parent');
      expect(parentParams).toEqual(['parent-user']);

      const [learnerSql, learnerParams] = clientQuery.mock.calls[1];
      expect(learnerSql).toContain('INSERT INTO learner');
      expect(learnerSql).toContain('RETURNING id');
      // parent_id is the resolved id, and subjects JSONB holds the selected ids.
      expect(learnerParams[0]).toBe('parent-uuid');
      expect(learnerParams[learnerParams.length - 1]).toBe(
        JSON.stringify(['math-101'])
      );
    });

    it('creates a subject row per custom subject and includes their ids', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'parent-uuid' }] }) // parent lookup
        .mockResolvedValueOnce({ rows: [{ id: 'sub-a' }] }) // custom subject 1
        .mockResolvedValueOnce({ rows: [{ id: 'sub-b' }] }) // custom subject 2
        .mockResolvedValueOnce({ rows: [{ id: 'learner-uuid' }] }); // learner insert
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      const repo = new NeonLearnerRepository();
      const id = await repo.createLearner(
        createData({ subjectIds: ['math-101'], customSubjects: ['Art', 'Music'] })
      );

      expect(id).toBe('learner-uuid');
      expect(clientQuery).toHaveBeenCalledTimes(4);

      const [subjectSql, subjectParams] = clientQuery.mock.calls[1];
      expect(subjectSql).toContain('INSERT INTO subject');
      expect(subjectSql).toContain('FALSE');
      expect(subjectParams).toEqual(['Art', 'parent-uuid']);

      const learnerParams = clientQuery.mock.calls[3][1];
      expect(learnerParams[learnerParams.length - 1]).toBe(
        JSON.stringify(['math-101', 'sub-a', 'sub-b'])
      );
    });

    it('throws when the parent username cannot be resolved', async () => {
      const clientQuery = jest.fn().mockResolvedValueOnce({ rows: [] }); // no parent
      mockedWithTransaction.mockImplementation(async (fn: any) =>
        fn(fakeClient(clientQuery))
      );

      const repo = new NeonLearnerRepository();
      await expect(repo.createLearner(createData())).rejects.toThrow(
        /Parent not found/
      );
    });
  });
});
