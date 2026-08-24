/**
 * Unit tests for the export NeonLearnerProgressRepository.
 * Mocks the pg pool's query() — no real database.
 */

import { NeonLearnerProgressRepository } from './neon-learner-progress-repository';
import type { Pool } from '@chikumiku/db';

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

describe('export NeonLearnerProgressRepository', () => {
  describe('getLearnerIdsByParent', () => {
    it('selects active learner ids for the parent and maps rows to ids', async () => {
      const query = jest
        .fn()
        .mockResolvedValue({ rows: [{ id: 'l-1' }, { id: 'l-2' }] });
      const repo = new NeonLearnerProgressRepository({ pool: mockPool(query) });

      const ids = await repo.getLearnerIdsByParent('parent-1');

      expect(ids).toEqual(['l-1', 'l-2']);

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT id FROM learner');
      expect(sql).toContain('parent_id = $1');
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual(['parent-1']);
    });

    it('returns an empty array when no learners exist', async () => {
      const repo = new NeonLearnerProgressRepository({ pool: mockPool() });
      expect(await repo.getLearnerIdsByParent('parent-x')).toEqual([]);
    });
  });

  describe('getProgressForLearners', () => {
    it('short-circuits without querying when the id list is empty', async () => {
      const query = jest.fn();
      const repo = new NeonLearnerProgressRepository({ pool: mockPool(query) });

      const result = await repo.getProgressForLearners([]);

      expect(result).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });

    it('uses ANY($1) for the id-list queries and aggregates progress', async () => {
      // Three sequential queries: learner names, subject agg, activity history.
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'l-1', name: 'Ada' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              learner_id: 'l-1',
              subject_name: 'Math',
              total_chapters: 4,
              chapters_completed: 2,
              average_score: '80.5',
            },
            {
              learner_id: 'l-1',
              subject_name: 'Science',
              total_chapters: 2,
              chapters_completed: 0,
              average_score: null,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              learner_id: 'l-1',
              activity_type: 'quiz_attempt',
              local_date: '2026-02-01',
              activity_timestamp: new Date('2026-02-01T10:00:00.000Z'),
              metadata: { score: 90, durationMinutes: 12 },
              chapter_name: 'Fractions',
              subject_name: 'Math',
            },
            {
              learner_id: 'l-1',
              activity_type: 'reading',
              local_date: '2026-02-02',
              activity_timestamp: new Date('2026-02-02T09:00:00.000Z'),
              metadata: null,
              chapter_name: null,
              subject_name: null,
            },
          ],
        });

      const repo = new NeonLearnerProgressRepository({ pool: mockPool(query) });
      const result = await repo.getProgressForLearners(['l-1']);

      // Verify id-list queries use ANY($1) and pass the array param.
      const [namesSql, namesParams] = query.mock.calls[0];
      expect(namesSql).toContain('= ANY($1)');
      expect(namesParams).toEqual([['l-1']]);

      const [aggSql, aggParams] = query.mock.calls[1];
      expect(aggSql).toContain('FROM book');
      expect(aggSql).toContain('JOIN subject');
      expect(aggSql).toContain('LEFT JOIN chapter');
      expect(aggSql).toContain('LEFT JOIN quiz_attempt');
      expect(aggSql).toContain('AVG(qa.score_percentage)');
      expect(aggSql).toContain('= ANY($1)');
      expect(aggParams).toEqual([['l-1']]);

      const [activitySql, activityParams] = query.mock.calls[2];
      expect(activitySql).toContain('FROM activity_log');
      expect(activitySql).toContain('= ANY($1)');
      expect(activityParams).toEqual([['l-1']]);

      // Verify the assembled result.
      expect(result).toHaveLength(1);
      const learner = result[0];
      expect(learner.learnerId).toBe('l-1');
      expect(learner.learnerName).toBe('Ada');

      expect(learner.subjects).toEqual([
        {
          subjectName: 'Math',
          averageScore: 81, // round(80.5)
          completionPercentage: 50, // 2/4
          chaptersCompleted: 2,
          totalChapters: 4,
        },
        {
          subjectName: 'Science',
          averageScore: 0, // AVG null -> 0
          completionPercentage: 0,
          chaptersCompleted: 0,
          totalChapters: 2,
        },
      ]);

      // overallCompletion = (2 + 0) completed / (4 + 2) total = 33%.
      expect(learner.overallCompletion).toBe(33);

      expect(learner.activityHistory).toEqual([
        {
          date: '2026-02-01T10:00:00.000Z',
          type: 'quiz',
          subjectName: 'Math',
          chapterName: 'Fractions',
          score: 90,
          durationMinutes: 12,
        },
        {
          date: '2026-02-02T09:00:00.000Z',
          type: 'reading',
          subjectName: '', // null -> ''
          chapterName: '', // null -> ''
          score: undefined, // absent in metadata
          durationMinutes: 0, // default when metadata null
        },
      ]);
    });

    it('maps activity_type variants to the constrained union', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'l-1', name: 'Ben' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            row('pronunciation_practice'),
            row('grammar_exercise'),
            row('qa_session'),
            row('something_unknown'),
          ],
        });

      const repo = new NeonLearnerProgressRepository({ pool: mockPool(query) });
      const [learner] = await repo.getProgressForLearners(['l-1']);

      expect(learner.activityHistory.map((a) => a.type)).toEqual([
        'pronunciation',
        'grammar',
        'qa',
        'reading', // unknown -> default
      ]);
    });

    it('omits learners not returned by the name lookup', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'l-1', name: 'Ada' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const repo = new NeonLearnerProgressRepository({ pool: mockPool(query) });
      const result = await repo.getProgressForLearners(['l-1', 'l-missing']);

      expect(result.map((r) => r.learnerId)).toEqual(['l-1']);
    });
  });
});

/** Builds a minimal activity_log row for the given activity_type. */
function row(activityType: string) {
  return {
    learner_id: 'l-1',
    activity_type: activityType,
    local_date: '2026-02-01',
    activity_timestamp: new Date('2026-02-01T10:00:00.000Z'),
    metadata: null,
    chapter_name: 'Ch',
    subject_name: 'Subj',
  };
}
