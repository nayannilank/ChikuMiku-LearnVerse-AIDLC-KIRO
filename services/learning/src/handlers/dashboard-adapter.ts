/**
 * Dashboard response adapter.
 *
 * The dashboard handlers (`handleParentDashboard` / `handleLearnerDashboard`)
 * return a generic `DashboardTreeNode[]` hierarchy. The web client, however,
 * consumes a flatter, view-specific shape (see
 * clients/web/src/services/dashboardApi.ts):
 *   - parent  -> { learners: DashboardLearner[] }
 *   - learner -> { learnerName, streak, subjects: DashboardSubject[] }
 *
 * This module converts the tree into those client shapes without touching the
 * handlers, the repositories, or @chikumiku/types.
 *
 * Tree layout produced by the handlers:
 *   parent:  learner -> subject -> book -> chapter -> exercise -> quiz
 *   learner:            subject -> book -> chapter -> exercise -> quiz
 * A chapter node carries the reading completion in `completionPercentage`; its
 * single `exercise` child carries the exercise completion; that exercise's
 * single `quiz` child carries the highest quiz score.
 *
 * Fields the client wants that the tree does NOT carry are filled with sensible
 * defaults and marked with `// TODO(dashboard)`:
 *   - subject icon/color/bgColor  -> looked up from the subject name (mirrors
 *     the client's own theme/uiTheme.ts SUBJECTS map); unknown subjects fall
 *     back to a neutral style.
 *   - learner grade               -> not present in the tree; defaulted to ''.
 *   - subject quizzes {completed,total} -> the tree has no explicit attempt
 *     count, so this is derived from the quiz nodes (see adaptSubject).
 *   - chapter pagesRead/pagesTotal -> optional in the client; omitted because
 *     the tree does not expose page counts.
 * Completion percentages are copied straight from the tree — never recomputed —
 * so the adapter does not change their meaning.
 */

import type { DashboardTreeNode } from '@chikumiku/types';

// ─── Client-facing shapes ──────────────────────────────────────────────────
// These mirror clients/web/src/services/dashboardApi.ts. They are duplicated
// (not imported) because the web client is not a build dependency of this
// service; keep them in sync with that file.

export interface DashboardChapter {
  id: string;
  name: string;
  progress: number;
  exerciseProgress: number;
  pagesRead?: number;
  pagesTotal?: number;
}

export interface DashboardBook {
  id: string;
  name: string;
  chapters: DashboardChapter[];
}

export interface DashboardSubject {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  books: DashboardBook[];
  quizzes: { completed: number; total: number };
}

export interface DashboardLearner {
  id: string;
  name: string;
  grade: string;
  subjects: DashboardSubject[];
}

export interface ParentDashboardClientResponse {
  learners: DashboardLearner[];
}

export interface LearnerDashboardClientResponse {
  learnerName: string;
  streak: number;
  subjects: DashboardSubject[];
}

// ─── Subject styling ────────────────────────────────────────────────────────
// Mirrors the SUBJECTS map in clients/web/src/theme/uiTheme.ts (icon = Font
// Awesome name, color/bg = resolved theme hex). Keyed case-insensitively so
// "maths"/"Maths" both resolve.

interface SubjectStyle {
  icon: string;
  color: string;
  bgColor: string;
}

const SUBJECT_STYLES: Record<string, SubjectStyle> = {
  maths: { icon: 'calculator', color: '#E94F9B', bgColor: '#FDE8F4' },
  math: { icon: 'calculator', color: '#E94F9B', bgColor: '#FDE8F4' },
  science: { icon: 'flask', color: '#27AE60', bgColor: '#E8F8EE' },
  english: { icon: 'spell-check', color: '#5DADE2', bgColor: '#E8F6FD' },
  hindi: { icon: 'om', color: '#E5A100', bgColor: '#FFF8E1' },
  kannada: { icon: 'language', color: '#9B59B6', bgColor: '#F3E8F9' },
  computers: { icon: 'laptop-code', color: '#4A6CF7', bgColor: '#EBF0FF' },
  evs: { icon: 'leaf', color: '#E67E22', bgColor: '#FFF0E0' },
};

// Neutral fallback for subjects not in the lookup above.
// TODO(dashboard): the tree carries no styling; unknown subjects render with
// this neutral style until styling is modeled server-side or the client maps
// it by name.
const DEFAULT_SUBJECT_STYLE: SubjectStyle = {
  icon: 'book',
  color: '#9B59B6',
  bgColor: '#F3E8F9',
};

function styleForSubject(name: string): SubjectStyle {
  return SUBJECT_STYLES[name.trim().toLowerCase()] ?? DEFAULT_SUBJECT_STYLE;
}

// ─── Node helpers ─────────────────────────────────────────────────────────

/** Returns the children of a node, or an empty array when absent. */
function childrenOf(node: DashboardTreeNode): DashboardTreeNode[] {
  return node.children ?? [];
}

/** Finds the first child of the given type, if any. */
function firstChildOfType(
  node: DashboardTreeNode,
  type: DashboardTreeNode['type']
): DashboardTreeNode | undefined {
  return childrenOf(node).find((child) => child.type === type);
}

/**
 * Maps a `chapter` node to a client chapter.
 * `progress` is the chapter's own completion; `exerciseProgress` comes from the
 * chapter's `exercise` child (0 when the chapter has no exercise node).
 */
function adaptChapter(chapterNode: DashboardTreeNode): DashboardChapter {
  const exerciseNode = firstChildOfType(chapterNode, 'exercise');
  return {
    id: chapterNode.id,
    name: chapterNode.name,
    progress: chapterNode.completionPercentage,
    exerciseProgress: exerciseNode ? exerciseNode.completionPercentage : 0,
    // pagesRead / pagesTotal intentionally omitted (optional on the client):
    // TODO(dashboard): the tree does not expose page counts.
  };
}

/** Maps a `book` node to a client book. */
function adaptBook(bookNode: DashboardTreeNode): DashboardBook {
  return {
    id: bookNode.id,
    name: bookNode.name,
    chapters: childrenOf(bookNode)
      .filter((child) => child.type === 'chapter')
      .map(adaptChapter),
  };
}

/**
 * Derives the subject-level quiz summary from the tree.
 *
 * TODO(dashboard): the tree carries one `quiz` node per chapter whose
 * `completionPercentage` is the highest score (0 when there is no attempt). It
 * has no explicit attempt count, so we approximate: `total` = number of quiz
 * nodes under the subject, `completed` = those with a score > 0. A genuine
 * attempt with a 0% score is indistinguishable from "not attempted" here.
 */
function summarizeQuizzes(subjectNode: DashboardTreeNode): {
  completed: number;
  total: number;
} {
  let total = 0;
  let completed = 0;
  for (const bookNode of childrenOf(subjectNode)) {
    for (const chapterNode of childrenOf(bookNode)) {
      const exerciseNode = firstChildOfType(chapterNode, 'exercise');
      const quizNode = exerciseNode && firstChildOfType(exerciseNode, 'quiz');
      if (quizNode) {
        total += 1;
        if (quizNode.completionPercentage > 0) {
          completed += 1;
        }
      }
    }
  }
  return { completed, total };
}

/** Maps a `subject` node to a client subject, filling styling defaults. */
function adaptSubject(subjectNode: DashboardTreeNode): DashboardSubject {
  const style = styleForSubject(subjectNode.name);
  return {
    id: subjectNode.id,
    name: subjectNode.name,
    icon: style.icon,
    color: style.color,
    bgColor: style.bgColor,
    books: childrenOf(subjectNode)
      .filter((child) => child.type === 'book')
      .map(adaptBook),
    quizzes: summarizeQuizzes(subjectNode),
  };
}

/** Maps a `learner` node to a client learner. */
function adaptLearner(learnerNode: DashboardTreeNode): DashboardLearner {
  return {
    id: learnerNode.id,
    name: learnerNode.name,
    // TODO(dashboard): the tree does not carry the learner's grade; default to
    // '' until the handler/tree exposes it.
    grade: '',
    subjects: childrenOf(learnerNode)
      .filter((child) => child.type === 'subject')
      .map(adaptSubject),
  };
}

// ─── Public adapters ─────────────────────────────────────────────────────

/**
 * Converts the parent dashboard tree (top-level `learner` nodes) into the
 * client's `{ learners }` shape. An empty tree yields `{ learners: [] }`.
 */
export function adaptParentTree(
  tree: DashboardTreeNode[]
): ParentDashboardClientResponse {
  return {
    learners: tree
      .filter((node) => node.type === 'learner')
      .map(adaptLearner),
  };
}

/**
 * Converts the learner dashboard tree (top-level `subject` nodes) into the
 * client's `{ learnerName, streak, subjects }` shape. `learnerName` and
 * `streak` are sourced by the caller (not present in the tree). An empty tree
 * yields `subjects: []`.
 */
export function adaptLearnerTree(
  tree: DashboardTreeNode[],
  learnerName: string,
  streak: number
): LearnerDashboardClientResponse {
  return {
    learnerName,
    streak,
    subjects: tree
      .filter((node) => node.type === 'subject')
      .map(adaptSubject),
  };
}
