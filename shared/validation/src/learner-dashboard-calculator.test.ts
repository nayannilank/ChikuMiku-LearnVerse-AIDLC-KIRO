import {
  calculateLearnerCompletion,
  calculatePagesLeft,
} from './learner-dashboard-calculator';

describe('calculateLearnerCompletion', () => {
  describe('normal cases', () => {
    it('returns 0 when no pages have been read', () => {
      expect(calculateLearnerCompletion(0, 100)).toBe(0);
    });

    it('returns 100 when all pages have been read', () => {
      expect(calculateLearnerCompletion(100, 100)).toBe(100);
    });

    it('returns 50 for half completion', () => {
      expect(calculateLearnerCompletion(5, 10)).toBe(50);
    });

    it('uses Math.round (rounds 0.5 up)', () => {
      // 1/2 = 50% — exact midpoint rounds up
      expect(calculateLearnerCompletion(1, 2)).toBe(50);
    });

    it('rounds up when fractional part >= 0.5', () => {
      // 2/3 ≈ 66.67 → rounds to 67
      expect(calculateLearnerCompletion(2, 3)).toBe(67);
    });

    it('rounds down when fractional part < 0.5', () => {
      // 1/3 ≈ 33.33 → rounds to 33
      expect(calculateLearnerCompletion(1, 3)).toBe(33);
    });

    it('differs from floor for midpoint values (key distinction from parent dashboard)', () => {
      // 1/4 = 25.0 — same for round and floor
      expect(calculateLearnerCompletion(1, 4)).toBe(25);
      // 3/4 = 75.0 — same for round and floor
      expect(calculateLearnerCompletion(3, 4)).toBe(75);
    });
  });

  describe('defensive: invalid totalPages', () => {
    it('returns 0 when totalPages is 0', () => {
      expect(calculateLearnerCompletion(5, 0)).toBe(0);
    });

    it('returns 0 when totalPages is negative', () => {
      expect(calculateLearnerCompletion(5, -10)).toBe(0);
    });
  });

  describe('clamping pagesRead', () => {
    it('clamps pagesRead above totalPages to totalPages (returns 100)', () => {
      expect(calculateLearnerCompletion(200, 100)).toBe(100);
    });

    it('clamps negative pagesRead to 0 (returns 0)', () => {
      expect(calculateLearnerCompletion(-5, 100)).toBe(0);
    });
  });

  describe('boundary values', () => {
    it('handles totalPages of 1 with 0 read', () => {
      expect(calculateLearnerCompletion(0, 1)).toBe(0);
    });

    it('handles totalPages of 1 with 1 read', () => {
      expect(calculateLearnerCompletion(1, 1)).toBe(100);
    });
  });
});

describe('calculatePagesLeft', () => {
  describe('normal cases', () => {
    it('returns totalPages when nothing has been read', () => {
      expect(calculatePagesLeft(100, 0)).toBe(100);
    });

    it('returns 0 when all pages have been read', () => {
      expect(calculatePagesLeft(100, 100)).toBe(0);
    });

    it('returns the correct pages left', () => {
      expect(calculatePagesLeft(50, 20)).toBe(30);
    });

    it('returns 1 when one page remains', () => {
      expect(calculatePagesLeft(10, 9)).toBe(1);
    });
  });

  describe('defensive: invalid totalPages', () => {
    it('returns 0 when totalPages is 0', () => {
      expect(calculatePagesLeft(0, 5)).toBe(0);
    });

    it('returns 0 when totalPages is negative', () => {
      expect(calculatePagesLeft(-10, 5)).toBe(0);
    });
  });

  describe('clamping pagesRead', () => {
    it('clamps pagesRead above totalPages — result is 0, never negative', () => {
      expect(calculatePagesLeft(100, 150)).toBe(0);
    });

    it('clamps negative pagesRead to 0 — result equals totalPages', () => {
      expect(calculatePagesLeft(100, -5)).toBe(100);
    });
  });

  describe('boundary values', () => {
    it('handles totalPages of 1 with 0 read', () => {
      expect(calculatePagesLeft(1, 0)).toBe(1);
    });

    it('handles totalPages of 1 with 1 read', () => {
      expect(calculatePagesLeft(1, 1)).toBe(0);
    });
  });
});
