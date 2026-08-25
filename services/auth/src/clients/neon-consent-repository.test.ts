/**
 * Unit tests for NeonConsentRepository.
 * Mocks the pg pool's query() via an injected pool — no real database.
 */

import { NeonConsentRepository } from './neon-consent-repository';
import type { Pool } from '@chikumiku/db';
import type { ConsentRecord } from '../handlers/parental-consent';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonConsentRepository', () => {
  describe('hasActiveConsent', () => {
    it('returns true when an active consent row exists', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const repo = new NeonConsentRepository({ pool: mockPool(query) });

      expect(await repo.hasActiveConsent('parent-uuid')).toBe(true);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM parental_consent');
      expect(sql).toContain('revoked_at IS NULL');
      expect(params).toEqual(['parent-uuid']);
    });

    it('returns false when no active consent exists', async () => {
      const repo = new NeonConsentRepository({ pool: mockPool() });
      expect(await repo.hasActiveConsent('parent-uuid')).toBe(false);
    });
  });

  describe('getConsentStatus', () => {
    it('maps the latest active consent row', async () => {
      const grantedAt = new Date('2026-01-02T03:04:05.000Z');
      const query = jest.fn().mockResolvedValue({
        rows: [{ consent_version: '1.0', granted_at: grantedAt }],
      });
      const repo = new NeonConsentRepository({ pool: mockPool(query) });

      expect(await repo.getConsentStatus('parent-uuid')).toEqual({
        hasConsented: true,
        consentedAt: '2026-01-02T03:04:05.000Z',
        consentVersion: '1.0',
      });
    });

    it('reports no consent when no active row exists', async () => {
      const repo = new NeonConsentRepository({ pool: mockPool() });

      expect(await repo.getConsentStatus('parent-uuid')).toEqual({
        hasConsented: false,
        consentedAt: null,
        consentVersion: null,
      });
    });
  });

  describe('storeConsent', () => {
    it('inserts parent_id, consent_version, and granted_at', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const repo = new NeonConsentRepository({ pool: mockPool(query) });

      const record: ConsentRecord = {
        parentId: 'parent-uuid',
        learnerUsername: null,
        consentVersion: '1.0',
        consentedAt: '2026-01-02T03:04:05.000Z',
        consentText: 'I consent',
      };
      await repo.storeConsent(record);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO parental_consent');
      expect(params).toEqual([
        'parent-uuid',
        '1.0',
        '2026-01-02T03:04:05.000Z',
      ]);
    });
  });
});
