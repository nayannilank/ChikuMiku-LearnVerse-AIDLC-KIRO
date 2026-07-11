/**
 * Tests for GET /learn/recommendations/:learnerId handler.
 *
 * Requirements: 25.5
 */

import {
  handleGetRecommendations,
  generateRecommendations,
  hasDeclineInScores,
  daysSinceActivity,
  IRecommendationRepository,
  ChapterRecommendationData,
} from './recommendations';

function createMockRepository(
  overrides: Partial<IRecommendationRepository> = {}
): IRecommendationRepository {
  return {
    learnerExists: jest.fn().mockResolvedValue(true),
    getChapterDataForLearner: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('handleGetRecommendations', () => {
  describe('validation', () => {
    it('returns 400 when learnerId is empty', async () => {
      const deps = { recommendationRepository: createMockRepository() };
      const result = await handleGetRecommendations('', deps);

      expect(result).toEqual({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Learner ID is required',
        retryable: false,
      });
    });

    it('returns 404 when learner does not exist', async () => {
      const deps = {
        recommendationRepository: createMockRepository({
          learnerExists: jest.fn().mockResolvedValue(false),
        }),
      };
      const result = await handleGetRecommendations('non-existent-id', deps);

      expect(result).toEqual({
        statusCode: 404,
        errorCode: 'LEARNER_NOT_FOUND',
        message: 'Learner not found',
        details: { learnerId: 'No learner exists with the provided ID' },
        retryable: false,
      });
    });
  });

  describe('successful response', () => {
    it('returns empty recommendations when learner has no chapters', async () => {
      const deps = { recommendationRepository: createMockRepository() };
      const result = await handleGetRecommendations('learner-1', deps);

      expect(result).toEqual({
        success: true,
        learnerId: 'learner-1',
        recommendations: [],
      });
    });

    it('returns recommendations based on rule engine', async () => {
      const chapters: ChapterRecommendationData[] = [
        {
          chapterId: 'ch-1',
          chapterName: 'Chapter 1',
          bookName: 'Book A',
          subjectName: 'Maths',
          totalContentPages: 10,
          pagesRead: 10,
          totalExercises: 10,
          exercisesCorrect: 1,
          quizAttempts: [{ scorePercentage: 30, completedAt: '2024-01-10T10:00:00Z' }],
          lastActivityAt: '2024-01-10T10:00:00Z',
        },
      ];

      const deps = {
        recommendationRepository: createMockRepository({
          getChapterDataForLearner: jest.fn().mockResolvedValue(chapters),
        }),
      };
      const result = await handleGetRecommendations('learner-1', deps);

      if ('recommendations' in result) {
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations[0].type).toBe('reread_chapter');
      }
    });
  });
});

describe('generateRecommendations', () => {
  const now = new Date('2024-02-01T12:00:00Z');

  it('returns empty array for no chapters', () => {
    expect(generateRecommendations([], now)).toEqual([]);
  });

  it('recommends re-reading for low quiz scores (< 50%)', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-1',
        chapterName: 'Chapter 1',
        bookName: 'Book A',
        subjectName: 'Science',
        totalContentPages: 10,
        pagesRead: 10,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [{ scorePercentage: 40, completedAt: '2024-01-30T10:00:00Z' }],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('reread_chapter');
    expect(result[0].priority).toBe('high');
    expect(result[0].chapterId).toBe('ch-1');
  });

  it('does not recommend re-reading when highest score >= 50%', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-1',
        chapterName: 'Chapter 1',
        bookName: 'Book A',
        subjectName: 'Science',
        totalContentPages: 10,
        pagesRead: 10,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [
          { scorePercentage: 30, completedAt: '2024-01-10T10:00:00Z' },
          { scorePercentage: 50, completedAt: '2024-01-30T10:00:00Z' },
        ],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);
    const rereadRecs = result.filter(r => r.type === 'reread_chapter');
    expect(rereadRecs).toHaveLength(0);
  });

  it('recommends exercises when high reading but low exercise completion', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-2',
        chapterName: 'Chapter 2',
        bookName: 'Book B',
        subjectName: 'Hindi',
        totalContentPages: 10,
        pagesRead: 8, // 80% read
        totalExercises: 10,
        exercisesCorrect: 2, // 20% exercises
        quizAttempts: [],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('take_exercises');
    expect(result[0].priority).toBe('medium');
  });

  it('does not recommend exercises when exercise completion >= 30%', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-2',
        chapterName: 'Chapter 2',
        bookName: 'Book B',
        subjectName: 'Hindi',
        totalContentPages: 10,
        pagesRead: 8,
        totalExercises: 10,
        exercisesCorrect: 3, // 30% — not below threshold
        quizAttempts: [],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);
    const exerciseRecs = result.filter(r => r.type === 'take_exercises');
    expect(exerciseRecs).toHaveLength(0);
  });

  it('recommends revisiting for long-inactive chapters (>= 14 days)', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-3',
        chapterName: 'Chapter 3',
        bookName: 'Book C',
        subjectName: 'English',
        totalContentPages: 10,
        pagesRead: 5,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [{ scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' }],
        lastActivityAt: '2024-01-15T10:00:00Z', // 17 days ago from now
      },
    ];

    const result = generateRecommendations(chapters, now);
    const revisitRecs = result.filter(r => r.type === 'revisit_chapter');

    expect(revisitRecs).toHaveLength(1);
    expect(revisitRecs[0].priority).toBe('low');
  });

  it('does not recommend revisiting if last activity is recent', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-3',
        chapterName: 'Chapter 3',
        bookName: 'Book C',
        subjectName: 'English',
        totalContentPages: 10,
        pagesRead: 5,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [{ scorePercentage: 80, completedAt: '2024-01-30T10:00:00Z' }],
        lastActivityAt: '2024-01-30T10:00:00Z', // 2 days ago
      },
    ];

    const result = generateRecommendations(chapters, now);
    const revisitRecs = result.filter(r => r.type === 'revisit_chapter');
    expect(revisitRecs).toHaveLength(0);
  });

  it('does not recommend revisiting chapters with 0 pages read', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-3',
        chapterName: 'Chapter 3',
        bookName: 'Book C',
        subjectName: 'English',
        totalContentPages: 10,
        pagesRead: 0,
        totalExercises: 0,
        exercisesCorrect: 0,
        quizAttempts: [],
        lastActivityAt: '2024-01-01T10:00:00Z', // 31 days ago
      },
    ];

    const result = generateRecommendations(chapters, now);
    const revisitRecs = result.filter(r => r.type === 'revisit_chapter');
    expect(revisitRecs).toHaveLength(0);
  });

  it('recommends focused review for declining scores', () => {
    const chapters: ChapterRecommendationData[] = [
      {
        chapterId: 'ch-4',
        chapterName: 'Chapter 4',
        bookName: 'Book D',
        subjectName: 'Maths',
        totalContentPages: 10,
        pagesRead: 10,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [
          { scorePercentage: 80, completedAt: '2024-01-10T10:00:00Z' },
          { scorePercentage: 75, completedAt: '2024-01-15T10:00:00Z' },
          { scorePercentage: 50, completedAt: '2024-01-30T10:00:00Z' }, // decline > 10pts below avg(80,75)
        ],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);
    const focusedRecs = result.filter(r => r.type === 'focused_review');

    expect(focusedRecs).toHaveLength(1);
    expect(focusedRecs[0].priority).toBe('high');
  });

  it('sorts recommendations by priority (high > medium > low)', () => {
    const chapters: ChapterRecommendationData[] = [
      // Low exercise → medium
      {
        chapterId: 'ch-1',
        chapterName: 'Chapter 1',
        bookName: 'Book A',
        subjectName: 'Maths',
        totalContentPages: 10,
        pagesRead: 8,
        totalExercises: 10,
        exercisesCorrect: 2,
        quizAttempts: [],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
      // Inactive → low
      {
        chapterId: 'ch-2',
        chapterName: 'Chapter 2',
        bookName: 'Book A',
        subjectName: 'Maths',
        totalContentPages: 10,
        pagesRead: 5,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [{ scorePercentage: 90, completedAt: '2024-01-10T10:00:00Z' }],
        lastActivityAt: '2024-01-10T10:00:00Z', // 22 days ago
      },
      // Low scores → high
      {
        chapterId: 'ch-3',
        chapterName: 'Chapter 3',
        bookName: 'Book A',
        subjectName: 'Maths',
        totalContentPages: 10,
        pagesRead: 10,
        totalExercises: 5,
        exercisesCorrect: 5,
        quizAttempts: [{ scorePercentage: 30, completedAt: '2024-01-30T10:00:00Z' }],
        lastActivityAt: '2024-01-30T10:00:00Z',
      },
    ];

    const result = generateRecommendations(chapters, now);

    expect(result[0].priority).toBe('high');
    expect(result[result.length - 1].priority).toBe('low');
  });
});

describe('hasDeclineInScores', () => {
  it('returns false for fewer than 3 attempts', () => {
    expect(hasDeclineInScores([])).toBe(false);
    expect(
      hasDeclineInScores([{ scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' }])
    ).toBe(false);
    expect(
      hasDeclineInScores([
        { scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' },
        { scorePercentage: 70, completedAt: '2024-01-02T10:00:00Z' },
      ])
    ).toBe(false);
  });

  it('returns true when most recent score is > 10 pts below prior average', () => {
    const attempts = [
      { scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' },
      { scorePercentage: 75, completedAt: '2024-01-05T10:00:00Z' },
      { scorePercentage: 50, completedAt: '2024-01-10T10:00:00Z' },
    ];
    // Previous avg = (80+75)/2 = 77.5; 50 < 77.5 - 10 = 67.5 → true
    expect(hasDeclineInScores(attempts)).toBe(true);
  });

  it('returns false when most recent score is within 10 pts of prior average', () => {
    const attempts = [
      { scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' },
      { scorePercentage: 75, completedAt: '2024-01-05T10:00:00Z' },
      { scorePercentage: 70, completedAt: '2024-01-10T10:00:00Z' },
    ];
    // Previous avg = (80+75)/2 = 77.5; 70 >= 77.5 - 10 = 67.5 → false
    expect(hasDeclineInScores(attempts)).toBe(false);
  });

  it('handles unsorted attempts correctly by sorting them', () => {
    const attempts = [
      { scorePercentage: 50, completedAt: '2024-01-10T10:00:00Z' }, // most recent
      { scorePercentage: 80, completedAt: '2024-01-01T10:00:00Z' },
      { scorePercentage: 75, completedAt: '2024-01-05T10:00:00Z' },
    ];
    expect(hasDeclineInScores(attempts)).toBe(true);
  });
});

describe('daysSinceActivity', () => {
  const now = new Date('2024-02-01T12:00:00Z');

  it('returns Infinity when lastActivityAt is null', () => {
    expect(daysSinceActivity(null, now)).toBe(Infinity);
  });

  it('returns 0 for same-day activity', () => {
    expect(daysSinceActivity('2024-02-01T08:00:00Z', now)).toBe(0);
  });

  it('returns correct number of days', () => {
    expect(daysSinceActivity('2024-01-25T12:00:00Z', now)).toBe(7);
  });

  it('returns correct value for exactly 14 days', () => {
    expect(daysSinceActivity('2024-01-18T12:00:00Z', now)).toBe(14);
  });
});
