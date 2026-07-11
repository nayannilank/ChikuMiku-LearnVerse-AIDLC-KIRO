import { validateTimer } from './timer-validator';

describe('validateTimer', () => {
  describe('valid timers (multiples of 5, between 5 and 120)', () => {
    it.each([5, 10, 15, 30, 60, 90, 120])('accepts %d minutes', (minutes) => {
      const result = validateTimer(minutes);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual({});
    });
  });

  describe('invalid timers', () => {
    it('rejects 0', () => {
      const result = validateTimer(0);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBe(
        'Timer must be a multiple of 5 between 5 and 120 minutes'
      );
    });

    it('rejects values below 5', () => {
      const result = validateTimer(3);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects values above 120', () => {
      const result = validateTimer(125);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects non-multiples of 5', () => {
      const result = validateTimer(7);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects negative numbers', () => {
      const result = validateTimer(-5);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects NaN', () => {
      const result = validateTimer(NaN);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects Infinity', () => {
      const result = validateTimer(Infinity);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects non-integer values', () => {
      const result = validateTimer(10.5);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });

    it('rejects negative Infinity', () => {
      const result = validateTimer(-Infinity);
      expect(result.valid).toBe(false);
      expect(result.errors.timer).toBeDefined();
    });
  });

  describe('boundary values', () => {
    it('accepts minimum valid value (5)', () => {
      expect(validateTimer(5).valid).toBe(true);
    });

    it('accepts maximum valid value (120)', () => {
      expect(validateTimer(120).valid).toBe(true);
    });

    it('rejects just below minimum (4)', () => {
      expect(validateTimer(4).valid).toBe(false);
    });

    it('rejects just above maximum (121)', () => {
      expect(validateTimer(121).valid).toBe(false);
    });
  });
});
