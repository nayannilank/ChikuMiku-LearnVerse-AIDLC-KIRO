import {
  isSensitiveActionAuthorized,
  VERIFICATION_WINDOW_MS,
} from './sensitive-action-guard';

describe('sensitive-action-guard', () => {
  describe('VERIFICATION_WINDOW_MS', () => {
    it('should be 5 minutes in milliseconds', () => {
      expect(VERIFICATION_WINDOW_MS).toBe(5 * 60 * 1000);
      expect(VERIFICATION_WINDOW_MS).toBe(300_000);
    });
  });

  describe('isSensitiveActionAuthorized', () => {
    const now = new Date('2024-06-15T10:05:00.000Z');

    it('should return false when lastVerifiedAt is null', () => {
      expect(isSensitiveActionAuthorized(null, now)).toBe(false);
    });

    it('should return true when verified just now (0ms elapsed)', () => {
      const lastVerifiedAt = new Date(now.getTime());
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(true);
    });

    it('should return true when verified 1 minute ago', () => {
      const lastVerifiedAt = new Date(now.getTime() - 60_000);
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(true);
    });

    it('should return true when verified 4 minutes and 59 seconds ago', () => {
      const lastVerifiedAt = new Date(now.getTime() - (4 * 60_000 + 59_000));
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(true);
    });

    it('should return false when verified exactly 5 minutes ago', () => {
      const lastVerifiedAt = new Date(now.getTime() - VERIFICATION_WINDOW_MS);
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(false);
    });

    it('should return false when verified more than 5 minutes ago', () => {
      const lastVerifiedAt = new Date(now.getTime() - VERIFICATION_WINDOW_MS - 1);
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(false);
    });

    it('should return false when verified 10 minutes ago', () => {
      const lastVerifiedAt = new Date(now.getTime() - 10 * 60_000);
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(false);
    });

    it('should return false when lastVerifiedAt is in the future (negative elapsed)', () => {
      // Edge case: if lastVerifiedAt is ahead of now (clock skew), elapsed < 0
      const lastVerifiedAt = new Date(now.getTime() + 60_000);
      expect(isSensitiveActionAuthorized(lastVerifiedAt, now)).toBe(false);
    });
  });
});
