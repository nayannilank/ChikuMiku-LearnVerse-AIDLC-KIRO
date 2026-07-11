import { aggregateProgress, QuizAttempt } from './progress-aggregator';

describe('aggregateProgress', () => {
  describe('empty attempts', () => {
    it('returns zeroed summary for empty array', () => {
      const result = aggregateProgress([]);
      expect(result).toEqual({
        attemptCount: 0,
        highestScore: 0,
        mostRecentScore: 0,
      });
    });
  });

  describe('single attempt', () => {
    it('returns the single attempt as both highest and most recent', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 75, completedAt: '2024-06-01T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result).toEqual({
        attemptCount: 1,
        highestScore: 75,
        mostRecentScore: 75,
      });
    });
  });

  describe('multiple attempts', () => {
    it('tracks attempt count correctly', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 60, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 80, completedAt: '2024-06-02T10:00:00Z' },
        { scorePercentage: 70, completedAt: '2024-06-03T10:00:00Z' },
      ];
      expect(aggregateProgress(attempts).attemptCount).toBe(3);
    });

    it('finds highest score across attempts', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 60, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 95, completedAt: '2024-06-02T10:00:00Z' },
        { scorePercentage: 70, completedAt: '2024-06-03T10:00:00Z' },
      ];
      expect(aggregateProgress(attempts).highestScore).toBe(95);
    });

    it('identifies most recent score by completedAt timestamp', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 95, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 60, completedAt: '2024-06-03T10:00:00Z' },
        { scorePercentage: 80, completedAt: '2024-06-02T10:00:00Z' },
      ];
      expect(aggregateProgress(attempts).mostRecentScore).toBe(60);
    });

    it('handles case where highest and most recent are different', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 100, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 50, completedAt: '2024-06-10T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result.highestScore).toBe(100);
      expect(result.mostRecentScore).toBe(50);
    });

    it('handles case where highest and most recent are the same', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 50, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 100, completedAt: '2024-06-10T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result.highestScore).toBe(100);
      expect(result.mostRecentScore).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('handles zero scores', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 0, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 0, completedAt: '2024-06-02T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result).toEqual({
        attemptCount: 2,
        highestScore: 0,
        mostRecentScore: 0,
      });
    });

    it('handles 100% scores', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 100, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 100, completedAt: '2024-06-02T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result).toEqual({
        attemptCount: 2,
        highestScore: 100,
        mostRecentScore: 100,
      });
    });

    it('handles attempts not in chronological order', () => {
      const attempts: QuizAttempt[] = [
        { scorePercentage: 70, completedAt: '2024-06-05T10:00:00Z' },
        { scorePercentage: 90, completedAt: '2024-06-01T10:00:00Z' },
        { scorePercentage: 80, completedAt: '2024-06-10T10:00:00Z' },
      ];
      const result = aggregateProgress(attempts);
      expect(result.attemptCount).toBe(3);
      expect(result.highestScore).toBe(90);
      expect(result.mostRecentScore).toBe(80);
    });
  });
});
