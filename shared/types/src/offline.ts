/**
 * Offline storage type definitions.
 * Covers chapter data persistence, sync results, and offline store interface.
 *
 * Validates: Requirements 21.1
 */

import type { TranscriptPage } from './content.js';

/** Exercise question stored for offline access. */
export interface OfflineExerciseQuestion {
  id: string;
  pageNumber: number;
  question: string;
  options?: string[];
  correctAnswer: string;
  type: 'fill-in-blank' | 'multiple-choice' | 'short-answer';
}

/** Page explanation stored for offline access. */
export interface OfflineExplanation {
  pageNumber: number;
  summary: string;
  keywords: string[];
  concepts: string[];
}

/** Progress data associated with a chapter. */
export interface ChapterProgressData {
  readingPercentage: number;
  exerciseScores: Record<string, number>;
  quizResults: Record<string, number>;
  lastAccessedAt: string;
}

/**
 * Complete chapter data persisted for offline access.
 * All components (transcript, explanations, exercises, progress) are stored
 * as a single atomic unit.
 */
export interface ChapterData {
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectId: string;
  academicYear: number;
  transcript: TranscriptPage[];
  explanations: OfflineExplanation[];
  exercises: OfflineExerciseQuestion[];
  progress: ChapterProgressData;
  persistedAt: string;
}

/** Result of a progress sync operation. */
export interface SyncResult {
  success: boolean;
  syncedChapterIds: string[];
  failedChapterIds: string[];
  conflictsResolved: number;
  timestamp: string;
}

/** Error details when persistence fails. */
export interface PersistenceError {
  operation: 'persist' | 'retrieve' | 'sync';
  chapterId?: string;
  component?: 'transcript' | 'explanations' | 'exercises' | 'progress';
  message: string;
  timestamp: string;
}

/**
 * Offline store interface for client-side chapter persistence.
 * Implements atomic save (all-or-nothing) with 5-second timeout.
 */
export interface OfflineStore {
  /** Atomic save of chapter data. Fails entirely if any component cannot be saved. */
  persistChapter(chapter: ChapterData): Promise<void>;
  /** Retrieve all locally persisted chapters. */
  getOfflineChapters(): Promise<ChapterData[]>;
  /** Synchronize offline progress to server. */
  syncProgress(serverUrl: string): Promise<SyncResult>;
  /** Filter persisted chapters by academic year. */
  getAcademicYearContent(year: number): Promise<ChapterData[]>;
}
