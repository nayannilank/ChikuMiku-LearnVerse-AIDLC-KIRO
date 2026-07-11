import {
  calculateParentCompletion,
  calculateExerciseCompletion,
} from './parent-dashboard-calculator';

describe('calculateParentCompletion', () => {
  describe('normal cases', () => {
    it('returns 0 when no pages read', () => {
      expect(calculateParentCompletion(0, 100)).toBe(0);
    });

    it('returns 50 for half pages read', () => {
      expect(calculateParentCompletion(50, 100)).toBe(50);
    });

    it('returns 100 when all pages read', () => {
      expect(calculateParentCompletion(100, 100)).toBe(100);
    });

    it('floors the result (rounds down)', () => {
      // 1/3 = 0.333... -> floor(33.33) = 33
      expect(calculateParentCompletion(1, 3)).toBe(33);
    });

    it('floors 99.9% down to 99', () => {
      // 99/100 = 99%, but 999/1000 = 99.9 -> 99
      expect(calculateParentCompletion(999, 1000)).toBe(99);
    });
  });

  describe('defensive: totalPages <= 0', () => {
    it('returns 0 when totalPages is 0', () => {
      expect(calculateParentCompletion(5, 0)).toBe(0);
    });

    it('returns 0 when totalPages is negative', () => {
      expect(calculateParentCompletion(5, -10)).toBe(0);
    });
  });

  describe('clamping pagesRead to [0, totalPages]', () => {
    it('clamps negative pagesRead to 0', () => {
      expect(calculateParentCompletion(-5, 100)).toBe(0);
    });

    it('clamps pagesRead exceeding totalPages', () => {
      expect(calculateParentCompletion(150, 100)).toBe(100);
    });
  });
});

describe('calculateExerciseCompletion', () => {
  describe('normal cases', () => {
    it('returns 0 when no correct answers', () => {
      expect(calculateExerciseCompletion(0, 10)).toBe(0);
    });

    it('returns 50 for half correct', () => {
      expect(calculateExerciseCompletion(5, 10)).toBe(50);
    });

    it('returns 100 when all correct', () => {
      expect(calculateExerciseCompletion(10, 10)).toBe(100);
    });

    it('floors the result (rounds down)', () => {
      // 2/3 = 0.666... -> floor(66.66) = 66
      expect(calculateExerciseCompletion(2, 3)).toBe(66);
    });
  });

  describe('defensive: total <= 0', () => {
    it('returns 0 when total is 0', () => {
      expect(calculateExerciseCompletion(5, 0)).toBe(0);
    });

    it('returns 0 when total is negative', () => {
      expect(calculateExerciseCompletion(5, -10)).toBe(0);
    });
  });

  describe('clamping correct to [0, total]', () => {
    it('clamps negative correct to 0', () => {
      expect(calculateExerciseCompletion(-3, 10)).toBe(0);
    });

    it('clamps correct exceeding total', () => {
      expect(calculateExerciseCompletion(15, 10)).toBe(100);
    });
  });
});
