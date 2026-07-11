/**
 * @chikumiku/types - Shared type definitions for ChikuMiku LearnVerse
 *
 * Re-exports all domain types from a single entry point.
 */

export type {
  ParentRegistrationRequest,
  LearnerRegistrationRequest,
  LoginRequest,
  ValidationResult,
} from './auth.js';

export type { APIError } from './api.js';

export type {
  ChapterCreateRequest,
  PageUpload,
  TranscriptPage,
} from './content.js';

export type {
  AIRequest,
  CacheCheckResult,
  ExplanationResult,
  PronunciationScore,
  SyllableResult,
  QARequest,
  RAGContext,
} from './ai.js';

export type {
  StreakData,
  ProgressPercentage,
  DashboardTreeNode,
  ActivityRecord,
} from './learning.js';

export type {
  ExportRequest,
  NotificationPayload,
} from './export.js';

export type {
  OfflineExerciseQuestion,
  OfflineExplanation,
  ChapterProgressData,
  ChapterData,
  SyncResult,
  PersistenceError,
  OfflineStore,
} from './offline.js';
