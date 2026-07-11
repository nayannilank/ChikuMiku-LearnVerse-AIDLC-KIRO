import {
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  isAccountLocked,
  recordFailedAttempt,
  resetAttempts,
  getLockoutMessage,
  getLockoutRemainingSeconds,
} from './lockout-manager';

describe('Lockout Manager', () => {
  describe('constants', () => {
    it('MAX_ATTEMPTS is 5', () => {
      expect(MAX_ATTEMPTS).toBe(5);
    });

    it('LOCKOUT_DURATION_MS is 15 minutes', () => {
      expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('isAccountLocked', () => {
    const now = new Date('2024-06-01T12:00:00Z');

    it('returns false when failedAttempts < 5', () => {
      const lastFailed = new Date('2024-06-01T11:59:00Z');
      expect(isAccountLocked(0, lastFailed, now)).toBe(false);
      expect(isAccountLocked(1, lastFailed, now)).toBe(false);
      expect(isAccountLocked(4, lastFailed, now)).toBe(false);
    });

    it('returns true when failedAttempts >= 5 and within lockout window', () => {
      const lastFailed = new Date('2024-06-01T11:50:00Z'); // 10 min ago
      expect(isAccountLocked(5, lastFailed, now)).toBe(true);
      expect(isAccountLocked(10, lastFailed, now)).toBe(true);
    });

    it('returns false when failedAttempts >= 5 but lockout has expired', () => {
      const lastFailed = new Date('2024-06-01T11:44:59Z'); // >15 min ago
      expect(isAccountLocked(5, lastFailed, now)).toBe(false);
    });

    it('returns false when failedAttempts >= 5 and exactly 15 minutes have passed', () => {
      const lastFailed = new Date('2024-06-01T11:45:00Z'); // exactly 15 min ago
      expect(isAccountLocked(5, lastFailed, now)).toBe(false);
    });

    it('returns false when lastFailedAt is null', () => {
      expect(isAccountLocked(5, null, now)).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('increments the attempt counter by 1', () => {
      expect(recordFailedAttempt(0)).toBe(1);
      expect(recordFailedAttempt(1)).toBe(2);
      expect(recordFailedAttempt(4)).toBe(5);
      expect(recordFailedAttempt(9)).toBe(10);
    });
  });

  describe('resetAttempts', () => {
    it('returns 0', () => {
      expect(resetAttempts()).toBe(0);
    });
  });

  describe('getLockoutMessage', () => {
    it('returns a generic message without revealing which field is wrong', () => {
      const message = getLockoutMessage();
      expect(message).toBe('Account is temporarily locked. Please try again later.');
      // Ensure the message does not leak information
      expect(message.toLowerCase()).not.toContain('username');
      expect(message.toLowerCase()).not.toContain('password');
    });
  });

  describe('getLockoutRemainingSeconds', () => {
    it('returns remaining seconds when within lockout window', () => {
      const now = new Date('2024-06-01T12:00:00Z');
      const lastFailed = new Date('2024-06-01T11:50:00Z'); // 10 min ago
      // 15 min - 10 min = 5 min = 300 seconds
      expect(getLockoutRemainingSeconds(lastFailed, now)).toBe(300);
    });

    it('returns 0 when lockout has expired', () => {
      const now = new Date('2024-06-01T12:00:00Z');
      const lastFailed = new Date('2024-06-01T11:44:00Z'); // 16 min ago
      expect(getLockoutRemainingSeconds(lastFailed, now)).toBe(0);
    });

    it('returns 0 when exactly 15 minutes have passed', () => {
      const now = new Date('2024-06-01T12:00:00Z');
      const lastFailed = new Date('2024-06-01T11:45:00Z'); // exactly 15 min
      expect(getLockoutRemainingSeconds(lastFailed, now)).toBe(0);
    });

    it('floors fractional seconds', () => {
      const now = new Date('2024-06-01T12:00:00.500Z');
      const lastFailed = new Date('2024-06-01T11:50:00Z'); // 10 min 0.5s ago
      // remaining = 15*60*1000 - 600500 = 299500ms => 299 seconds
      expect(getLockoutRemainingSeconds(lastFailed, now)).toBe(299);
    });

    it('returns full lockout duration when lastFailed equals now', () => {
      const now = new Date('2024-06-01T12:00:00Z');
      // 900000ms / 1000 = 900 seconds
      expect(getLockoutRemainingSeconds(now, now)).toBe(900);
    });
  });
});
