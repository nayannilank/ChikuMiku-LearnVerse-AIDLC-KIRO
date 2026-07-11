/**
 * Get Streak Handler
 * GET /learn/streak/:learnerId
 *
 * Returns the current streak, last active date, and longest streak
 * for a given learner.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { StreakData, APIError } from '@chikumiku/types';
import type { ILearnerRepository } from './record-activity';

/** Dependencies for the get-streak handler. */
export interface GetStreakDeps {
  learnerRepository: ILearnerRepository;
}

/** Successful response for streak retrieval. */
export interface GetStreakResponse {
  success: true;
  streakData: StreakData;
}

/**
 * Handles retrieving streak data for a learner.
 *
 * Returns the denormalized streak fields from the Learner record,
 * or an APIError if the learner is not found.
 */
export async function handleGetStreak(
  learnerId: string,
  deps: GetStreakDeps
): Promise<GetStreakResponse | APIError> {
  if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'learnerId is required',
      retryable: false,
    };
  }

  const streakRecord = await deps.learnerRepository.getStreakData(learnerId);

  if (streakRecord === null) {
    return {
      statusCode: 404,
      errorCode: 'LEARNER_NOT_FOUND',
      message: 'Learner not found',
      retryable: false,
    };
  }

  return {
    success: true,
    streakData: {
      currentStreak: streakRecord.currentStreak,
      lastActiveDate: streakRecord.lastActiveDate ?? '',
      longestStreak: streakRecord.longestStreak,
    },
  };
}
