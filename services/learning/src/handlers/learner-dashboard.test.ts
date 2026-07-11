/**
 * Unit tests for Learner Dashboard Handler.
 * Tests tree construction with round-based completion percentages.
 *
 * Requirements: 15.1, 15.2, 15.6
 */

import { handleLearnerDashboard, LearnerDashboardDeps } from './learner-dashboard';
import type { ILearningRepository } from '../repositories/learning-repository';
import type { APIError } from '@chikumiku/types';

function createMockRepository(overrides: Partial<ILearningRepository> = {}): ILearningRepository {
  return {
    getLearnersByParentId: jest.fn().mockResolvedValue([]),
    getSubjectsByLearnerId: jest.fn().mockResolvedValue([]),
    getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([]),
    getChaptersByBookId: jest.fn().mockResolvedValue([]),
    getExerciseByChapterId: jest.fn().mockResolvedValue(null),
    getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('handleLearnerDashboard', () => {
  it('returns validation error when learnerId is empty', async () => {
    const deps: LearnerDashboardDeps = {
      learningRepository: createMockRepository(),
    };

    const result = await handleLearnerDashboard('', deps);
    expect((result as APIError).statusCode).toBe(400);
    expect((result as APIError).errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns empty tree with subjects listed when learner has no content (Req 15.6)', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
        { id: 'subject-2', name: 'Hindi' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([]),
    });
    const deps: LearnerDashboardDeps = { learningRepository: repo };

    const result = await handleLearnerDashboard('learner-1', deps);

    if (!('success' in result)) return;
    expect(result.success).toBe(true);
    expect(result.tree).toHaveLength(2);
    expect(result.tree[0].type).toBe('subject');
    expect(result.tree[0].name).toBe('English');
    expect(result.tree[0].completionPercentage).toBe(0);
    expect(result.tree[0].children).toEqual([]);
    expect(result.tree[1].name).toBe('Hindi');
  });

  it('builds full tree with round-based completion percentages', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'Grammar Book' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'chapter-1',
          bookId: 'book-1',
          chapterNumber: 1,
          chapterName: 'Nouns',
          totalContentPages: 10,
          pagesRead: 7,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue({
        chapterId: 'chapter-1',
        totalQuestions: 3,
        correctAnswers: 2,
      }),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue({
        chapterId: 'chapter-1',
        totalAttempts: 1,
        highestScore: 90,
        mostRecentScore: 90,
      }),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    const tree = result.tree;
    expect(tree).toHaveLength(1);

    // Subject node
    const subjectNode = tree[0];
    expect(subjectNode.type).toBe('subject');
    expect(subjectNode.name).toBe('English');

    // Book node
    const bookNode = subjectNode.children![0];
    expect(bookNode.type).toBe('book');
    expect(bookNode.name).toBe('Grammar Book');

    // Chapter node - round(7/10 * 100) = 70
    const chapterNode = bookNode.children![0];
    expect(chapterNode.type).toBe('chapter');
    expect(chapterNode.completionPercentage).toBe(70);

    // Exercise node - round(2/3 * 100) = round(66.67) = 67
    const exerciseNode = chapterNode.children![0];
    expect(exerciseNode.type).toBe('exercise');
    expect(exerciseNode.completionPercentage).toBe(67);

    // Quiz node
    const quizNode = exerciseNode.children![0];
    expect(quizNode.type).toBe('quiz');
    expect(quizNode.completionPercentage).toBe(90);
  });

  it('uses round-based percentage (not floor) for chapter completion', async () => {
    // 1 page read out of 3 = round(33.33) = 33
    // 2 pages read out of 3 = round(66.67) = 67
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'Maths' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'Algebra' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'chapter-1',
          bookId: 'book-1',
          chapterNumber: 1,
          chapterName: 'Equations',
          totalContentPages: 3,
          pagesRead: 2,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue(null),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    if (!('success' in result)) return;
    const chapterNode = result.tree[0].children![0].children![0];
    // round(2/3 * 100) = round(66.67) = 67 (not floor which would give 66)
    expect(chapterNode.completionPercentage).toBe(67);
  });

  it('handles chapters with 0 pages read', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'Science' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'Physics' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'chapter-1',
          bookId: 'book-1',
          chapterNumber: 1,
          chapterName: 'Forces',
          totalContentPages: 8,
          pagesRead: 0,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue(null),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    if (!('success' in result)) return;
    const chapterNode = result.tree[0].children![0].children![0];
    expect(chapterNode.completionPercentage).toBe(0);
    expect(chapterNode.children![0].completionPercentage).toBe(0);
    expect(chapterNode.children![0].children![0].completionPercentage).toBe(0);
  });

  it('does not include learner node at root (only subjects)', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([]),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    if (!('success' in result)) return;
    // Root of tree should be subjects, NOT a learner node
    expect(result.tree[0].type).toBe('subject');
  });

  it('returns empty tree when learner has no subjects', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([]),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    expect(result).toEqual({ success: true, tree: [] });
  });

  it('aggregates completion percentages correctly with multiple chapters', async () => {
    const repo = createMockRepository({
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'Book A' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'ch-1', bookId: 'book-1', chapterNumber: 1,
          chapterName: 'Ch 1', totalContentPages: 10, pagesRead: 10,
        },
        {
          id: 'ch-2', bookId: 'book-1', chapterNumber: 2,
          chapterName: 'Ch 2', totalContentPages: 10, pagesRead: 5,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue(null),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    });

    const deps: LearnerDashboardDeps = { learningRepository: repo };
    const result = await handleLearnerDashboard('learner-1', deps);

    if (!('success' in result)) return;
    // Ch1: round(10/10*100) = 100, Ch2: round(5/10*100) = 50
    // Book avg: round((100 + 50) / 2) = round(75) = 75
    const bookNode = result.tree[0].children![0];
    expect(bookNode.completionPercentage).toBe(75);
  });
});
