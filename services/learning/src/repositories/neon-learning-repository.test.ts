/**
 * Unit tests for NeonLearningRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonLearningRepository } from './neon-learning-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('NeonLearningRepository', () => {
  describe('getLearnersByParentId', () => {
    it('queries active learners and parses subjects JSONB', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'l-1',
            name: 'Kiki',
            grade: 'Grade 3',
            subjects: [
              { id: 's-1', name: 'Math' },
              { id: 's-2', name: 'English' },
            ],
          },
        ],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const learners = await repo.getLearnersByParentId('p-1');

      expect(learners).toEqual([
        {
          id: 'l-1',
          name: 'Kiki',
          grade: 'Grade 3',
          subjects: [
            { id: 's-1', name: 'Math' },
            { id: 's-2', name: 'English' },
          ],
        },
      ]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM learner');
      expect(sql).toContain('parent_id = $1');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['p-1']);
    });

    it('parses subjects when JSONB arrives as a raw string', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'l-1',
            name: 'Kiki',
            grade: 'Grade 3',
            subjects: '[{"id":"s-1","name":"Math"}]',
          },
        ],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const learners = await repo.getLearnersByParentId('p-1');
      expect(learners[0].subjects).toEqual([{ id: 's-1', name: 'Math' }]);
    });
  });

  describe('getSubjectsByLearnerId', () => {
    it('reads and parses the learner subjects JSONB', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ subjects: [{ id: 's-1', name: 'Math' }] }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const subjects = await repo.getSubjectsByLearnerId('l-1');
      expect(subjects).toEqual([{ id: 's-1', name: 'Math' }]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT subjects');
      expect(sql).toContain('FROM learner');
      expect(params).toEqual(['l-1']);
    });

    it('returns [] when the learner does not exist', async () => {
      const repo = new NeonLearningRepository({ pool: mockPool() });
      expect(await repo.getSubjectsByLearnerId('missing')).toEqual([]);
    });
  });

  describe('getBooksBySubjectAndLearner', () => {
    it('maps book rows and passes both params', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ id: 'b-1', subject_id: 's-1', name: 'Algebra' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const books = await repo.getBooksBySubjectAndLearner('s-1', 'l-1');
      expect(books).toEqual([{ id: 'b-1', subjectId: 's-1', name: 'Algebra' }]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM book');
      expect(sql).toContain('subject_id = $1');
      expect(sql).toContain('learner_id = $2');
      expect(params).toEqual(['s-1', 'l-1']);
    });
  });

  describe('getChaptersByBookId', () => {
    it('counts content pages and coerces numeric columns; pagesRead defaults to 0', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'c-1',
            book_id: 'b-1',
            chapter_number: '2',
            chapter_name: 'Fractions',
            total_content_pages: '10',
          },
        ],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const chapters = await repo.getChaptersByBookId('b-1');
      expect(chapters).toEqual([
        {
          id: 'c-1',
          bookId: 'b-1',
          chapterNumber: 2,
          chapterName: 'Fractions',
          totalContentPages: 10,
          pagesRead: 0,
        },
      ]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM chapter');
      expect(sql).toContain("classification = 'content'");
      expect(sql).toContain('book_id = $1');
      expect(params).toEqual(['b-1']);
    });
  });

  describe('getExerciseByChapterId', () => {
    it('aggregates question totals from quiz_attempt', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ attempts: '3', total_questions: '30', correct_answers: '21' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const exercise = await repo.getExerciseByChapterId('c-1');
      expect(exercise).toEqual({
        chapterId: 'c-1',
        totalQuestions: 30,
        correctAnswers: 21,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM quiz_attempt');
      expect(sql).toContain('SUM(total_questions)');
      expect(sql).toContain('SUM(correct_answers)');
      expect(params).toEqual(['c-1']);
    });

    it('returns null when there are no attempts', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ attempts: '0', total_questions: '0', correct_answers: '0' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });
      expect(await repo.getExerciseByChapterId('c-1')).toBeNull();
    });
  });

  describe('getQuizAttemptsByChapterId', () => {
    it('returns count, highest and most-recent score', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          { total_attempts: '4', highest_score: '95', most_recent_score: '80' },
        ],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const summary = await repo.getQuizAttemptsByChapterId('c-1');
      expect(summary).toEqual({
        chapterId: 'c-1',
        totalAttempts: 4,
        highestScore: 95,
        mostRecentScore: 80,
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM quiz_attempt');
      expect(sql).toContain('MAX(score_percentage)');
      expect(sql).toContain('ORDER BY completed_at DESC');
      expect(params).toEqual(['c-1']);
    });

    it('returns null when there are no attempts', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            total_attempts: '0',
            highest_score: null,
            most_recent_score: null,
          },
        ],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });
      expect(await repo.getQuizAttemptsByChapterId('c-1')).toBeNull();
    });
  });
});
