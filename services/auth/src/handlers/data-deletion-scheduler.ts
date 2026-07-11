/**
 * Data Deletion Scheduler
 *
 * Implements the 30-day data purge requirement:
 * - Parent requests account deletion → data scheduled for permanent deletion
 * - After 30 days, all learner data is permanently removed
 * - Parent can cancel by logging in before the deletion date
 *
 * This module provides the purge execution logic that runs on a schedule
 * (e.g., daily CloudWatch Events → Lambda trigger).
 *
 * Requirements: 20.5
 */

import type { APIError } from '@chikumiku/types';

/** Maximum number of days before permanent deletion. */
export const DELETION_WINDOW_DAYS = 30;

/** Record representing a scheduled deletion. */
export interface DeletionScheduleRecord {
  parentId: string;
  scheduledAt: string; // ISO timestamp when deletion was requested
  deleteAfter: string; // ISO timestamp when data should be permanently deleted
  status: 'pending' | 'completed' | 'cancelled';
}

/** Data categories that are permanently deleted. */
export interface DeletionManifest {
  parentId: string;
  learnerIds: string[];
  chapterIds: string[];
  progressRecords: number;
  exerciseRecords: number;
  quizRecords: number;
  consentRecords: number;
}

/** Repository interface for deletion scheduler operations. */
export interface DeletionRepository {
  /** Find all deletion records that are past their deleteAfter date and still pending. */
  findPendingDeletions(now: Date): Promise<DeletionScheduleRecord[]>;
  /** Get all learner IDs for a parent. */
  getLearnerIdsByParent(parentId: string): Promise<string[]>;
  /** Permanently delete all data for a parent and their learners. */
  permanentlyDeleteAllData(parentId: string, learnerIds: string[]): Promise<DeletionManifest>;
  /** Mark a deletion record as completed. */
  markDeletionCompleted(parentId: string): Promise<void>;
  /** Cancel a pending deletion (e.g., user logged in). */
  cancelDeletion(parentId: string): Promise<boolean>;
}

/** Dependencies for the deletion scheduler. */
export interface DeletionSchedulerDeps {
  deletionRepository: DeletionRepository;
  now?: Date;
}

/** Result of the purge execution. */
export interface PurgeResult {
  processed: number;
  deleted: DeletionManifest[];
  errors: Array<{ parentId: string; error: string }>;
}

/**
 * Execute the data purge process.
 * Runs periodically (e.g., daily) to permanently delete data
 * for accounts that have passed the 30-day window.
 *
 * This is designed to be invoked by a scheduled Lambda (CloudWatch Events).
 */
export async function executePurge(
  deps: DeletionSchedulerDeps
): Promise<PurgeResult> {
  const now = deps.now ?? new Date();

  // Find all pending deletions past the 30-day window
  const pendingDeletions = await deps.deletionRepository.findPendingDeletions(now);

  const result: PurgeResult = {
    processed: pendingDeletions.length,
    deleted: [],
    errors: [],
  };

  for (const record of pendingDeletions) {
    try {
      // Get all learner IDs for this parent
      const learnerIds = await deps.deletionRepository.getLearnerIdsByParent(record.parentId);

      // Permanently delete all data
      const manifest = await deps.deletionRepository.permanentlyDeleteAllData(
        record.parentId,
        learnerIds
      );

      // Mark the deletion as completed
      await deps.deletionRepository.markDeletionCompleted(record.parentId);

      result.deleted.push(manifest);
    } catch (error) {
      result.errors.push({
        parentId: record.parentId,
        error: error instanceof Error ? error.message : 'Unknown error during deletion',
      });
    }
  }

  return result;
}

/**
 * Cancel a scheduled deletion.
 * Called when a parent logs in before the 30-day window expires.
 */
export async function handleCancelDeletion(
  parentId: string,
  deps: DeletionSchedulerDeps
): Promise<{ success: true; message: string } | APIError> {
  if (!parentId || typeof parentId !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Parent identification is required',
      retryable: false,
    };
  }

  const cancelled = await deps.deletionRepository.cancelDeletion(parentId);

  if (!cancelled) {
    return {
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      message: 'No pending deletion found for this account',
      retryable: false,
    };
  }

  return {
    success: true,
    message: 'Account deletion has been cancelled. Your data will be preserved.',
  };
}

/**
 * Calculates the deletion date given a request timestamp.
 * Returns the date 30 days from now.
 */
export function calculateDeletionDate(requestedAt: Date): Date {
  const deletionDate = new Date(requestedAt);
  deletionDate.setDate(deletionDate.getDate() + DELETION_WINDOW_DAYS);
  return deletionDate;
}
