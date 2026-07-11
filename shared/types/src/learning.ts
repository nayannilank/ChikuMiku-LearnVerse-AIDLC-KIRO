/**
 * Learning service type definitions.
 * Covers streaks, progress, dashboard trees, and activity records.
 */

/** Streak tracking data for a learner. */
export interface StreakData {
  currentStreak: number;
  /** ISO date (device-local) */
  lastActiveDate: string;
  longestStreak: number;
}

/** Completion progress percentages. */
export interface ProgressPercentage {
  /** (pagesRead / totalPages) * 100 */
  chapterCompletion: number;
  /** (answered / total) * 100 */
  exerciseCompletion: number;
}

/** Recursive tree node for parent/learner dashboard views. */
export interface DashboardTreeNode {
  id: string;
  type: 'learner' | 'subject' | 'book' | 'chapter' | 'exercise' | 'quiz';
  name: string;
  completionPercentage: number;
  children?: DashboardTreeNode[];
}

/** Record of a qualifying learning activity. */
export interface ActivityRecord {
  learnerId: string;
  activityType: 'read' | 'exercise' | 'quiz' | 'pronunciation';
  chapterId: string;
  timestamp: string;
  /** Learner's device-local date */
  localDate: string;
}
