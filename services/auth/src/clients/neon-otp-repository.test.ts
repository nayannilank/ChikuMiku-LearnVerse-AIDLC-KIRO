/**
 * Unit tests for NeonOTPRepository.
 * Uses an injected fake pool (no real DB).
 */

import type { Pool } from '@chikumiku/db';
import { NeonOTPRepository } from './neon-otp-repository';
import type { OTPRecord } from '../otp/otp-manager';

function makeRepo() {
  const query = jest.fn();
  const repo = new NeonOTPRepository({ pool: { query } as unknown as Pool });
  return { repo, query };
}

describe('NeonOTPRepository', () => {
  it('store inserts the OTP record fields in order', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const record: OTPRecord = {
      username: 'alice',
      code: '123456',
      attempts: 0,
      invalidated: false,
      createdAt,
    };

    await repo.store(record);

    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO otp_record/);
    expect(query.mock.calls[0][1]).toEqual(['alice', '123456', 0, false, createdAt]);
  });

  it('invalidateExisting marks non-invalidated rows for the user', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    await repo.invalidateExisting('alice');

    expect(query.mock.calls[0][0]).toMatch(/UPDATE otp_record\s+SET invalidated = TRUE/);
    expect(query.mock.calls[0][1]).toEqual(['alice']);
  });

  it('findLatestByUsername maps a row to an OTPRecord with a Date createdAt', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({
      rows: [
        {
          username: 'alice',
          code: '654321',
          attempts: 2,
          invalidated: false,
          created_at: '2024-05-01T12:00:00Z',
        },
      ],
    });

    const record = await repo.findLatestByUsername('alice');

    expect(record).not.toBeNull();
    expect(record?.code).toBe('654321');
    expect(record?.attempts).toBe(2);
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(record?.createdAt.toISOString()).toBe('2024-05-01T12:00:00.000Z');
  });

  it('findLatestByUsername returns null when no rows', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    expect(await repo.findLatestByUsername('alice')).toBeNull();
  });

  it('updateAttempts updates the latest non-invalidated row', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    await repo.updateAttempts('alice', 3);

    expect(query.mock.calls[0][0]).toMatch(/UPDATE otp_record\s+SET attempts = \$2/);
    expect(query.mock.calls[0][1]).toEqual(['alice', 3]);
  });

  it('invalidate marks non-invalidated rows for the user', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    await repo.invalidate('alice');

    expect(query.mock.calls[0][1]).toEqual(['alice']);
  });

  it('getMostRecentCreatedAt returns a Date from the latest row', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [{ created_at: '2024-06-01T08:00:00Z' }] });

    const at = await repo.getMostRecentCreatedAt('alice');

    expect(at).toBeInstanceOf(Date);
    expect(at?.toISOString()).toBe('2024-06-01T08:00:00.000Z');
    // Must consider ALL rows (no invalidated filter) for rate limiting.
    expect(query.mock.calls[0][0]).not.toMatch(/invalidated/);
  });

  it('getMostRecentCreatedAt returns null when the user has no records', async () => {
    const { repo, query } = makeRepo();
    query.mockResolvedValueOnce({ rows: [] });

    expect(await repo.getMostRecentCreatedAt('alice')).toBeNull();
  });
});
