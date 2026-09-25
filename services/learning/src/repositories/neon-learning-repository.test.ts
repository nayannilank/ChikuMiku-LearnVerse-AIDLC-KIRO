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

    it('resolves UUID subject ids to real names via the subject table', async () => {
      const mathsId = '11111111-2222-4333-8444-555555555555';
      const sciId = '66666666-7777-4888-8999-aaaaaaaaaaaa';
      const query = jest
        .fn()
        // learner row: enrollment is a list of subject.id UUIDs (current form)
        .mockResolvedValueOnce({
          rows: [
            { id: 'l-1', name: 'Kiki', grade: '5th', subjects: [mathsId, sciId] },
          ],
        })
        // resolveSubjectNames batched lookup
        .mockResolvedValueOnce({
          rows: [
            { id: mathsId, name: 'Maths' },
            { id: sciId, name: 'Science' },
          ],
        });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const learners = await repo.getLearnersByParentId('p-1');
      expect(learners[0].subjects).toEqual([
        { id: mathsId, name: 'Maths' },
        { id: sciId, name: 'Science' },
      ]);

      // Second query resolves names by id via the subject table.
      const [resolveSql, resolveParams] = query.mock.calls[1];
      expect(resolveSql).toContain('FROM subject');
      expect(resolveSql).toContain('id = ANY');
      expect(resolveParams).toEqual([[mathsId, sciId]]);
    });

    it('does not hit the subject table when there are no UUID enrollment ids', async () => {
      // Legacy name-string enrollment: no UUIDs -> no resolution query.
      const query = jest.fn().mockResolvedValueOnce({
        rows: [{ id: 'l-1', name: 'Kiki', grade: '5th', subjects: ['Maths'] }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const learners = await repo.getLearnersByParentId('p-1');
      expect(learners[0].subjects).toEqual([{ id: 'Maths', name: 'Maths' }]);
      expect(query).toHaveBeenCalledTimes(1);
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

    it('parses the string-array subjects form written at registration', async () => {
      // The learner registration handler stores subjects as a JSONB array of
      // names, e.g. ["Maths","Science"] — not {id,name} objects. Each name
      // becomes both id and display name.
      const query = jest.fn().mockResolvedValue({
        rows: [{ subjects: ['Maths', 'Science', 'English'] }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const subjects = await repo.getSubjectsByLearnerId('l-1');
      expect(subjects).toEqual([
        { id: 'Maths', name: 'Maths' },
        { id: 'Science', name: 'Science' },
        { id: 'English', name: 'English' },
      ]);
    });

    it('parses the string-array subjects form when it arrives as a raw JSON string', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ subjects: '["Maths","Science"]' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const subjects = await repo.getSubjectsByLearnerId('l-1');
      expect(subjects).toEqual([
        { id: 'Maths', name: 'Maths' },
        { id: 'Science', name: 'Science' },
      ]);
    });

    it('resolves UUID enrollment ids to real subject names', async () => {
      const mathsId = '11111111-2222-4333-8444-555555555555';
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ subjects: [mathsId] }] }) // learner enrollment
        .mockResolvedValueOnce({ rows: [{ id: mathsId, name: 'Maths' }] }); // name lookup
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const subjects = await repo.getSubjectsByLearnerId('l-1');
      expect(subjects).toEqual([{ id: mathsId, name: 'Maths' }]);
    });
  });

  describe('getBooksBySubjectAndLearner', () => {
    const SUBJECT_UUID = '11111111-2222-4333-8444-555555555555';

    it('matches books directly by subject_id when given a UUID', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ id: 'b-1', subject_id: SUBJECT_UUID, name: 'Algebra' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const books = await repo.getBooksBySubjectAndLearner(SUBJECT_UUID, 'l-1');
      expect(books).toEqual([{ id: 'b-1', subjectId: SUBJECT_UUID, name: 'Algebra' }]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM book');
      expect(sql).toContain('subject_id = $1');
      expect(sql).toContain('learner_id = $2');
      // No JOIN on the UUID path.
      expect(sql).not.toContain('JOIN subject');
      expect(params).toEqual([SUBJECT_UUID, 'l-1']);
    });

    it('resolves books via the subject table by NAME when given a non-UUID (enrollment) value', async () => {
      // The dashboard subject node id is a subject *name* ("Maths") for the
      // string-form enrollment list. It must never reach the UUID-typed
      // book.subject_id column (that raises "invalid input syntax for type
      // uuid"); instead we join through the subject table on its name.
      const query = jest.fn().mockResolvedValue({
        rows: [{ id: 'b-2', subject_id: SUBJECT_UUID, name: 'NCERT Maths' }],
      });
      const repo = new NeonLearningRepository({ pool: mockPool(query) });

      const books = await repo.getBooksBySubjectAndLearner('Maths', 'l-1');
      expect(books).toEqual([{ id: 'b-2', subjectId: SUBJECT_UUID, name: 'NCERT Maths' }]);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('JOIN subject');
      expect(sql).toContain('s.name = $1');
      expect(sql).toContain('b.learner_id = $2');
      expect(params).toEqual(['Maths', 'l-1']);
    });

    it('returns [] for an enrollment subject name with no matching content', async () => {
      const repo = new NeonLearningRepository({ pool: mockPool() });
      expect(await repo.getBooksBySubjectAndLearner('Maths', 'l-1')).toEqual([]);
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
