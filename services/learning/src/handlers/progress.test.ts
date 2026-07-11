/**
 * Tests for GET /learn/progress/:learnerId handler.
 *
 * Requirements: 13.9, 13.10, 14.1, 14.2, 14.3, 15.1, 15.2
 */

import { handleGetProgress, IProgressRepository, ChapterProgressRecord } from './progress';

function createMockRepository(overrides: Partial<IProgressRepository> = {}): IProgressRepository {
  return {
    learnerExists: jest.fn().mockResolvedValue(true),
    getChapterProgressForLearner: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('handleGetProgress', () => {
  describe('validation', () => {
    it('returns 400 when learnerId is empty', async () => {
      const deps = { progressRepository: createMockRepository() };
      const result = await handleGetProgress('', deps);

      expect(result).toEqual({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Learner ID is required',
        retryable: false,
      });
    });

    it('returns 400 when learnerId is whitespace only', async () => {
      const deps = { progressRepository: createMockRepository() };
      const result = await handleGetProgress('   ', deps);

      expect(result).toEqual({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Learner ID is required',
        retryable: false,
      });
    });

    it('returns 404 when learner does not exist', async () => {
      const deps = {
        progressRepository: createMockRepository({
          learnerExists: jest.fn().mockResolvedValue(false),
        }),
      };
      const result = await handleGetProgress('non-existent-id', deps);

      expect(result).toEqual({
        statusCode: 404,
        errorCode: 'LEARNER_NOT_FOUND',
        message: 'Learner not found',
        details: { learnerId: 'No learner exists with the provided ID' },
        retryable: false,
      });
    });
  });

  describe('progress summary calculation', () => {
    it('returns empty chapters array when learner has no chapters', async () => {
      const deps = { progressRepository: createMockRepository() };
      const result = await handleGetProgress('learner-1', deps);

      expect(result).toEqual({
        success: true,
        learnerId: 'learner-1',
        chapters: [],
      });
    });

    it('calculates reading progress using both parent and learner formulas', async () => {
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Maths',
          totalContentPages: 10,
          pagesRead: 7,
          totalExercises: 5,
          exercisesCorrect: 3,
          quizAttempts: [],
          lastActivityAt: '2024-01-15T10:00:00Z',
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      expect('success' in result && result.success).toBe(true);
      if ('chapters' in result) {
        const chapter = result.chapters[0];
        // Parent: floor(7/10 * 100) = 70
        expect(chapter.reading.parentCompletionPercentage).toBe(70);
        // Learner: round(7/10 * 100) = 70
        expect(chapter.reading.learnerCompletionPercentage).toBe(70);
        expect(chapter.reading.pagesRead).toBe(7);
        expect(chapter.reading.totalPages).toBe(10);
        expect(chapter.reading.pagesLeft).toBe(3);
      }
    });

    it('correctly differentiates floor vs round for edge cases', async () => {
      // 1/3 = 33.33... → floor = 33, round = 33
      // 2/3 = 66.66... → floor = 66, round = 67
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'English',
          totalContentPages: 3,
          pagesRead: 2,
          totalExercises: 0,
          exercisesCorrect: 0,
          quizAttempts: [],
          lastActivityAt: null,
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      if ('chapters' in result) {
        const chapter = result.chapters[0];
        // floor(2/3 * 100) = floor(66.66) = 66
        expect(chapter.reading.parentCompletionPercentage).toBe(66);
        // round(2/3 * 100) = round(66.66) = 67
        expect(chapter.reading.learnerCompletionPercentage).toBe(67);
        expect(chapter.reading.pagesLeft).toBe(1);
      }
    });

    it('calculates exercise completion using floor', async () => {
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Science',
          totalContentPages: 5,
          pagesRead: 5,
          totalExercises: 3,
          exercisesCorrect: 2,
          quizAttempts: [],
          lastActivityAt: '2024-01-15T10:00:00Z',
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      if ('chapters' in result) {
        const chapter = result.chapters[0];
        // floor(2/3 * 100) = floor(66.66) = 66
        expect(chapter.exercises.completionPercentage).toBe(66);
        expect(chapter.exercises.correct).toBe(2);
        expect(chapter.exercises.total).toBe(3);
      }
    });

    it('aggregates quiz attempts correctly', async () => {
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Maths',
          totalContentPages: 10,
          pagesRead: 10,
          totalExercises: 5,
          exercisesCorrect: 5,
          quizAttempts: [
            { scorePercentage: 60, completedAt: '2024-01-10T10:00:00Z' },
            { scorePercentage: 80, completedAt: '2024-01-12T10:00:00Z' },
            { scorePercentage: 75, completedAt: '2024-01-14T10:00:00Z' },
          ],
          lastActivityAt: '2024-01-14T10:00:00Z',
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      if ('chapters' in result) {
        const chapter = result.chapters[0];
        expect(chapter.quizzes.attemptCount).toBe(3);
        expect(chapter.quizzes.highestScore).toBe(80);
        expect(chapter.quizzes.mostRecentScore).toBe(75);
      }
    });

    it('returns zero quiz stats when no attempts exist', async () => {
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Hindi',
          totalContentPages: 5,
          pagesRead: 2,
          totalExercises: 0,
          exercisesCorrect: 0,
          quizAttempts: [],
          lastActivityAt: null,
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      if ('chapters' in result) {
        const chapter = result.chapters[0];
        expect(chapter.quizzes.attemptCount).toBe(0);
        expect(chapter.quizzes.highestScore).toBe(0);
        expect(chapter.quizzes.mostRecentScore).toBe(0);
      }
    });

    it('handles multiple chapters', async () => {
      const records: ChapterProgressRecord[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Maths',
          totalContentPages: 10,
          pagesRead: 5,
          totalExercises: 10,
          exercisesCorrect: 8,
          quizAttempts: [{ scorePercentage: 90, completedAt: '2024-01-10T10:00:00Z' }],
          lastActivityAt: '2024-01-10T10:00:00Z',
        },
        {
          chapterId: 'ch-2',
          chapterName: 'Chapter 2',
          bookName: 'Book A',
          subjectName: 'Maths',
          totalContentPages: 20,
          pagesRead: 0,
          totalExercises: 0,
          exercisesCorrect: 0,
          quizAttempts: [],
          lastActivityAt: null,
        },
      ];

      const deps = {
        progressRepository: createMockRepository({
          getChapterProgressForLearner: jest.fn().mockResolvedValue(records),
        }),
      };

      const result = await handleGetProgress('learner-1', deps);

      if ('chapters' in result) {
        expect(result.chapters).toHaveLength(2);
        expect(result.chapters[0].chapterId).toBe('ch-1');
        expect(result.chapters[1].chapterId).toBe('ch-2');
        expect(result.chapters[1].reading.parentCompletionPercentage).toBe(0);
        expect(result.chapters[1].reading.pagesLeft).toBe(20);
      }
    });
  });
});
