/**
 * Unit tests for NeonResetTokenRepository.
 * Uses an injected fake pool (no real DB).
 */

import type { Pool } from '@chikumiku/db';
import { NeonResetTokenRepository } from './neon-reset-token-repository';

function makeRepo() {
  const query = jest.fn();
  const repo = new NeonResetTokenRepository({ pool: { query } as unknown as Pool });
  return { repo, query };
}

describe('NeonResetTokenRepository', () => {
  it('store inserts username, token and expiry (unused)', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });
    const expiresAt = new Date('2024-01-01T00:15:00Z');

    await repo.store('alice', 'rst_abc', expiresAt);

    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO password_reset_token/);
    expect(query.mock.calls[0][1]).toEqual(['alice', 'rst_abc', expiresAt]);
  });

  it('isValid returns true when a matching unused, unexpired row exists', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    expect(await repo.isValid('alice', 'rst_abc')).toBe(true);
    expect(query.mock.calls[0][0]).toMatch(/used = FALSE AND expires_at > NOW\(\)/);
    expect(query.mock.calls[0][1]).toEqual(['alice', 'rst_abc']);
  });

  it('isValid returns false when no row matches', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    expect(await repo.isValid('alice', 'rst_abc')).toBe(false);
  });

  it('invalidate marks the token used', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    await repo.invalidate('alice', 'rst_abc');

    expect(query.mock.calls[0][0]).toMatch(/SET used = TRUE/);
    expect(query.mock.calls[0][1]).toEqual(['alice', 'rst_abc']);
  });
});
