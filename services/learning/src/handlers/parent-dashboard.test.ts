/**
 * Unit tests for Parent Dashboard Handler.
 * Tests tree construction with floor-based completion percentages.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { handleParentDashboard, ParentDashboardDeps } from './parent-dashboard';
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

describe('handleParentDashboard', () => {
  it('returns validation error when parentId is empty', async () => {
    const deps: ParentDashboardDeps = {
      learningRepository: createMockRepository(),
    };

    const result = await handleParentDashboard('', deps);
    expect((result as APIError).statusCode).toBe(400);
    expect((result as APIError).errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns empty tree when parent has no learners', async () => {
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([]),
    });
    const deps: ParentDashboardDeps = { learningRepository: repo };

    const result = await handleParentDashboard('parent-1', deps);
    expect(result).toEqual({ success: true, tree: [] });
  });

  it('builds full tree with correct structure and floor-based percentages', async () => {
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([
        { id: 'learner-1', name: 'Alice', grade: '5th', subjects: [] },
      ]),
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'English Textbook' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'chapter-1',
          bookId: 'book-1',
          chapterNumber: 1,
          chapterName: 'Chapter 1',
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
        totalAttempts: 2,
        highestScore: 85,
        mostRecentScore: 80,
      }),
    });

    const deps: ParentDashboardDeps = { learningRepository: repo };
    const result = await handleParentDashboard('parent-1', deps);

    expect('success' in result && result.success).toBe(true);
    if (!('success' in result)) return;

    const tree = result.tree;
    expect(tree).toHaveLength(1);

    // Learner node
    const learnerNode = tree[0];
    expect(learnerNode.type).toBe('learner');
    expect(learnerNode.name).toBe('Alice');

    // Subject node
    const subjectNode = learnerNode.children![0];
    expect(subjectNode.type).toBe('subject');
    expect(subjectNode.name).toBe('English');

    // Book node
    const bookNode = subjectNode.children![0];
    expect(bookNode.type).toBe('book');
    expect(bookNode.name).toBe('English Textbook');

    // Chapter node - floor(7/10 * 100) = 70
    const chapterNode = bookNode.children![0];
    expect(chapterNode.type).toBe('chapter');
    expect(chapterNode.name).toBe('Chapter 1');
    expect(chapterNode.completionPercentage).toBe(70);

    // Exercise node - floor(2/3 * 100) = 66
    const exerciseNode = chapterNode.children![0];
    expect(exerciseNode.type).toBe('exercise');
    expect(exerciseNode.completionPercentage).toBe(66);

    // Quiz node
    const quizNode = exerciseNode.children![0];
    expect(quizNode.type).toBe('quiz');
    expect(quizNode.completionPercentage).toBe(85);
  });

  it('uses floor-based percentage (not round) for chapter completion', async () => {
    // 1 page read out of 3 = floor(33.33) = 33
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([
        { id: 'learner-1', name: 'Bob', grade: '3rd', subjects: [] },
      ]),
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'Maths' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([
        { id: 'book-1', subjectId: 'subject-1', name: 'Maths Book' },
      ]),
      getChaptersByBookId: jest.fn().mockResolvedValue([
        {
          id: 'chapter-1',
          bookId: 'book-1',
          chapterNumber: 1,
          chapterName: 'Fractions',
          totalContentPages: 3,
          pagesRead: 1,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue(null),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    });

    const deps: ParentDashboardDeps = { learningRepository: repo };
    const result = await handleParentDashboard('parent-1', deps);

    if (!('success' in result)) return;
    const chapterNode = result.tree[0].children![0].children![0].children![0];
    expect(chapterNode.completionPercentage).toBe(33); // floor, not round(33.33)=33
  });

  it('handles empty state for subjects with no books', async () => {
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([
        { id: 'learner-1', name: 'Carol', grade: 'LKG', subjects: [] },
      ]),
      getSubjectsByLearnerId: jest.fn().mockResolvedValue([
        { id: 'subject-1', name: 'English' },
        { id: 'subject-2', name: 'Hindi' },
      ]),
      getBooksBySubjectAndLearner: jest.fn().mockResolvedValue([]),
    });

    const deps: ParentDashboardDeps = { learningRepository: repo };
    const result = await handleParentDashboard('parent-1', deps);

    if (!('success' in result)) return;
    const learnerNode = result.tree[0];
    expect(learnerNode.children).toHaveLength(2);
    expect(learnerNode.children![0].completionPercentage).toBe(0);
    expect(learnerNode.children![0].children).toEqual([]);
    expect(learnerNode.children![1].completionPercentage).toBe(0);
    expect(learnerNode.children![1].children).toEqual([]);
  });

  it('returns 0% for exercises and quizzes when no data exists', async () => {
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([
        { id: 'learner-1', name: 'Dave', grade: '7th', subjects: [] },
      ]),
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
          chapterName: 'Motion',
          totalContentPages: 5,
          pagesRead: 0,
        },
      ]),
      getExerciseByChapterId: jest.fn().mockResolvedValue(null),
      getQuizAttemptsByChapterId: jest.fn().mockResolvedValue(null),
    });

    const deps: ParentDashboardDeps = { learningRepository: repo };
    const result = await handleParentDashboard('parent-1', deps);

    if (!('success' in result)) return;
    const chapterNode = result.tree[0].children![0].children![0].children![0];
    expect(chapterNode.completionPercentage).toBe(0);

    const exerciseNode = chapterNode.children![0];
    expect(exerciseNode.completionPercentage).toBe(0);

    const quizNode = exerciseNode.children![0];
    expect(quizNode.completionPercentage).toBe(0);
  });

  it('aggregates completion percentages up the tree correctly', async () => {
    const repo = createMockRepository({
      getLearnersByParentId: jest.fn().mockResolvedValue([
        { id: 'learner-1', name: 'Eve', grade: '5th', subjects: [] },
      ]),
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

    const deps: ParentDashboardDeps = { learningRepository: repo };
    const result = await handleParentDashboard('parent-1', deps);

    if (!('success' in result)) return;
    // Ch1: floor(10/10*100) = 100, Ch2: floor(5/10*100) = 50
    // Book avg: floor((100 + 50) / 2) = floor(75) = 75
    const bookNode = result.tree[0].children![0].children![0];
    expect(bookNode.completionPercentage).toBe(75);
  });
});
