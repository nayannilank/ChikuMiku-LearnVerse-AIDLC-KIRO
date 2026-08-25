/**
 * Unit tests for NeonUserRepository.
 * Verifies findByUsername spans parent then learner, and updatePassword
 * targets the correct table. Uses an injected fake pool (no real DB).
 */

import type { Pool } from '@chikumiku/db';
import { NeonUserRepository } from './neon-user-repository';

function makeRepo() {
  const query = jest.fn();
  const repo = new NeonUserRepository({ pool: { query } as unknown as Pool });
  return { repo, query };
}

describe('NeonUserRepository.findByUsername', () => {
  it('returns the parent record (with email/phone) and does not query learner', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({
      rows: [{ username: 'alice', email: 'a@example.com', phone: '9990001111' }],
    });

    const result = await repo.findByUsername('alice');

    expect(result).toEqual({ username: 'alice', email: 'a@example.com', phone: '9990001111' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/FROM parent/);
  });

  it('falls through to learner and returns empty email/phone', async () => {
    const { repo, query } = makeRepo();
    query
      .mockResolvedValueOnce({ rows: [] }) // parent miss
      .mockResolvedValueOnce({ rows: [{ username: 'kiddo' }] }); // learner hit

    const result = await repo.findByUsername('kiddo');

    expect(result).toEqual({ username: 'kiddo', email: '', phone: '' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/FROM learner/);
  });

  it('returns null when neither parent nor learner has the username', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    expect(await repo.findByUsername('nobody')).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe('NeonUserRepository.updatePassword', () => {
  it('updates parent when a parent row matches and does not touch learner', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await repo.updatePassword('alice', 'hash123');

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/UPDATE parent/);
    expect(query.mock.calls[0][1]).toEqual(['alice', 'hash123']);
  });

  it('falls through to learner when no parent row matched', async () => {
    const { repo, query } = makeRepo();
    query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // parent update: no match
      .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // learner update

    await repo.updatePassword('kiddo', 'hash456');

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toMatch(/UPDATE learner/);
    expect(query.mock.calls[1][1]).toEqual(['kiddo', 'hash456']);
  });
});
