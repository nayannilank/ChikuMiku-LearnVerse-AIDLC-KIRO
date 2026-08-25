/**
 * Unit tests for the dashboard response adapter.
 *
 * Verifies the DashboardTreeNode[] -> web-client-shape conversion for both the
 * parent and learner views, including the empty-tree case and the
 * default-filled client fields (subject styling, grade, quiz summary).
 */

import type { DashboardTreeNode } from '@chikumiku/types';
import { adaptParentTree, adaptLearnerTree } from './dashboard-adapter';

/** Builds a chapter -> exercise -> quiz sub-tree with explicit percentages. */
function buildChapter(
  id: string,
  name: string,
  chapterPct: number,
  exercisePct: number,
  quizPct: number
): DashboardTreeNode {
  return {
    id,
    type: 'chapter',
    name,
    completionPercentage: chapterPct,
    children: [
      {
        id: `${id}-exercise`,
        type: 'exercise',
        name: 'Exercises',
        completionPercentage: exercisePct,
        children: [
          {
            id: `${id}-quiz`,
            type: 'quiz',
            name: 'Quizzes',
            completionPercentage: quizPct,
            children: [],
          },
        ],
      },
    ],
  };
}

function buildSubject(
  id: string,
  name: string,
  pct: number,
  chapters: DashboardTreeNode[]
): DashboardTreeNode {
  return {
    id,
    type: 'subject',
    name,
    completionPercentage: pct,
    children: [
      {
        id: `${id}-book`,
        type: 'book',
        name: `${name} Book`,
        completionPercentage: pct,
        children: chapters,
      },
    ],
  };
}

describe('adaptParentTree', () => {
  it('returns an empty learners array for an empty tree', () => {
    expect(adaptParentTree([])).toEqual({ learners: [] });
  });

  it('maps a full learner -> subject -> book -> chapter tree to the client shape', () => {
    const tree: DashboardTreeNode[] = [
      {
        id: 'learner-1',
        type: 'learner',
        name: 'Ava',
        completionPercentage: 60,
        children: [
          buildSubject('subj-math', 'Maths', 55, [
            buildChapter('ch-1', 'Chapter 1', 80, 50, 90),
            buildChapter('ch-2', 'Chapter 2', 30, 0, 0),
          ]),
        ],
      },
    ];

    const result = adaptParentTree(tree);

    expect(result.learners).toHaveLength(1);
    const learner = result.learners[0];
    expect(learner.id).toBe('learner-1');
    expect(learner.name).toBe('Ava');
    // grade is not carried by the tree -> default-filled empty string.
    expect(learner.grade).toBe('');

    expect(learner.subjects).toHaveLength(1);
    const subject = learner.subjects[0];
    expect(subject.id).toBe('subj-math');
    expect(subject.name).toBe('Maths');
    // Styling default-filled from the subject-name lookup (mirrors client theme).
    expect(subject.icon).toBe('calculator');
    expect(subject.color).toBe('#E94F9B');
    expect(subject.bgColor).toBe('#FDE8F4');

    // Quiz summary derived from quiz nodes: 2 quizzes, 1 with score > 0.
    expect(subject.quizzes).toEqual({ completed: 1, total: 2 });

    expect(subject.books).toHaveLength(1);
    const book = subject.books[0];
    expect(book.id).toBe('subj-math-book');
    expect(book.chapters).toHaveLength(2);

    // progress = chapter completion; exerciseProgress = exercise child completion.
    expect(book.chapters[0]).toEqual({
      id: 'ch-1',
      name: 'Chapter 1',
      progress: 80,
      exerciseProgress: 50,
    });
    expect(book.chapters[1]).toEqual({
      id: 'ch-2',
      name: 'Chapter 2',
      progress: 30,
      exerciseProgress: 0,
    });
    // Optional page fields are omitted (not present in the tree).
    expect(book.chapters[0].pagesRead).toBeUndefined();
    expect(book.chapters[0].pagesTotal).toBeUndefined();
  });

  it('falls back to a neutral style for unknown subject names', () => {
    const tree: DashboardTreeNode[] = [
      {
        id: 'learner-1',
        type: 'learner',
        name: 'Ben',
        completionPercentage: 0,
        children: [buildSubject('subj-x', 'Astrophysics', 0, [])],
      },
    ];

    const subject = adaptParentTree(tree).learners[0].subjects[0];
    expect(subject.icon).toBe('book');
    expect(subject.color).toBe('#9B59B6');
    expect(subject.bgColor).toBe('#F3E8F9');
    // No chapters -> no quizzes.
    expect(subject.quizzes).toEqual({ completed: 0, total: 0 });
    expect(subject.books[0].chapters).toEqual([]);
  });

  it('handles a learner with no subjects (empty children)', () => {
    const tree: DashboardTreeNode[] = [
      {
        id: 'learner-1',
        type: 'learner',
        name: 'Cara',
        completionPercentage: 0,
        children: [],
      },
    ];

    const learner = adaptParentTree(tree).learners[0];
    expect(learner.subjects).toEqual([]);
  });

  it('resolves subject styling case-insensitively', () => {
    const tree: DashboardTreeNode[] = [
      {
        id: 'learner-1',
        type: 'learner',
        name: 'Dee',
        completionPercentage: 0,
        children: [buildSubject('subj-sci', 'science', 0, [])],
      },
    ];

    const subject = adaptParentTree(tree).learners[0].subjects[0];
    expect(subject.icon).toBe('flask');
    expect(subject.color).toBe('#27AE60');
  });
});

describe('adaptLearnerTree', () => {
  it('returns the provided name/streak and empty subjects for an empty tree', () => {
    expect(adaptLearnerTree([], 'Ava', 5)).toEqual({
      learnerName: 'Ava',
      streak: 5,
      subjects: [],
    });
  });

  it('maps top-level subject nodes and preserves name/streak', () => {
    const tree: DashboardTreeNode[] = [
      buildSubject('subj-eng', 'English', 72, [
        buildChapter('ch-1', 'Chapter 1', 100, 100, 100),
      ]),
    ];

    const result = adaptLearnerTree(tree, 'Ava', 9);

    expect(result.learnerName).toBe('Ava');
    expect(result.streak).toBe(9);
    expect(result.subjects).toHaveLength(1);

    const subject = result.subjects[0];
    expect(subject.name).toBe('English');
    expect(subject.icon).toBe('spell-check');
    expect(subject.color).toBe('#5DADE2');
    expect(subject.quizzes).toEqual({ completed: 1, total: 1 });
    expect(subject.books[0].chapters[0]).toEqual({
      id: 'ch-1',
      name: 'Chapter 1',
      progress: 100,
      exerciseProgress: 100,
    });
  });

  it('treats a chapter with no exercise child as 0 exerciseProgress', () => {
    const tree: DashboardTreeNode[] = [
      {
        id: 'subj-eng',
        type: 'subject',
        name: 'English',
        completionPercentage: 40,
        children: [
          {
            id: 'subj-eng-book',
            type: 'book',
            name: 'English Book',
            completionPercentage: 40,
            children: [
              {
                id: 'ch-1',
                type: 'chapter',
                name: 'Chapter 1',
                completionPercentage: 40,
                // No exercise/quiz children.
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const subject = adaptLearnerTree(tree, 'Ben', 0).subjects[0];
    expect(subject.books[0].chapters[0].exerciseProgress).toBe(0);
    // No quiz node -> nothing counted.
    expect(subject.quizzes).toEqual({ completed: 0, total: 0 });
  });
});
