/**
 * Record Activity Handler
 * POST /learn/activity
 *
 * Records a qualifying learning activity and updates streak data
 * on the learner record when appropriate.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { ActivityRecord, APIError, StreakData } from '@chikumiku/types';
import { shouldIncrement, shouldReset } from '@chikumiku/validation';

/** Valid qualifying activity types. */
const VALID_ACTIVITY_TYPES: ActivityRecord['activityType'][] = [
  'read',
  'exercise',
  'quiz',
  'pronunciation',
];

/** Learner streak fields stored on the Learner record (denormalized). */
export interface LearnerStreakRecord {
  currentStreak: number;
  lastActiveDate: string | null;
  longestStreak: number;
}

/** Repository for activity log persistence. */
export interface IActivityRepository {
  /** Save a new activity record. */
  saveActivity(activity: ActivityRecord): Promise<void>;
  /** Get all distinct active dates for a learner, sorted ascending. */
  getActivityDates(learnerId: string): Promise<string[]>;
}

/** Repository for learner streak data. */
export interface ILearnerRepository {
  /** Get the denormalized streak fields from the Learner record. */
  getStreakData(learnerId: string): Promise<LearnerStreakRecord | null>;
  /** Update the denormalized streak fields on the Learner record. */
  updateStreakData(learnerId: string, data: LearnerStreakRecord): Promise<void>;
}

/** Dependencies for the record-activity handler. */
export interface RecordActivityDeps {
  activityRepository: IActivityRepository;
  learnerRepository: ILearnerRepository;
}

/** Successful response from recording an activity. */
export interface RecordActivityResponse {
  success: true;
  streakData: StreakData;
}

/**
 * Validates the incoming activity record body.
 * Returns an APIError if validation fails, or null if valid.
 */
export function validateActivityRecord(body: unknown): APIError | null {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { learnerId, activityType, chapterId, timestamp, localDate } =
    body as Partial<ActivityRecord>;

  const missingFields: string[] = [];

  if (!learnerId || typeof learnerId !== 'string' || learnerId.trim() === '') {
    missingFields.push('learnerId');
  }
  if (
    !activityType ||
    !VALID_ACTIVITY_TYPES.includes(activityType as ActivityRecord['activityType'])
  ) {
    missingFields.push('activityType');
  }
  if (!chapterId || typeof chapterId !== 'string' || chapterId.trim() === '') {
    missingFields.push('chapterId');
  }
  if (!timestamp || typeof timestamp !== 'string' || timestamp.trim() === '') {
    missingFields.push('timestamp');
  }
  if (
    !localDate ||
    typeof localDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
  ) {
    missingFields.push('localDate');
  }

  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Missing or invalid required fields',
      details: Object.fromEntries(
        missingFields.map((field) => [field, `${field} is required`])
      ),
      retryable: false,
    };
  }

  return null;
}

/**
 * Handles recording a qualifying learning activity.
 *
 * - Saves the activity record
 * - Checks if the streak should increment (first activity of a new day)
 * - Updates denormalized streak fields on the Learner record
 *
 * Returns either a success response with current streak data, or an APIError.
 */
export async function handleRecordActivity(
  body: unknown,
  deps: RecordActivityDeps
): Promise<RecordActivityResponse | APIError> {
  // 1. Validate input
  const validationError = validateActivityRecord(body);
  if (validationError) {
    return validationError;
  }

  const activity = body as ActivityRecord;

  // 2. Verify the learner exists
  const existingStreak = await deps.learnerRepository.getStreakData(activity.learnerId);
  if (existingStreak === null) {
    return {
      statusCode: 404,
      errorCode: 'LEARNER_NOT_FOUND',
      message: 'Learner not found',
      retryable: false,
    };
  }

  // 3. Get all activity dates BEFORE saving (to check if this is a new day)
  const activityDatesBeforeSave = await deps.activityRepository.getActivityDates(activity.learnerId);

  // 4. Save the activity record
  await deps.activityRepository.saveActivity(activity);

  // 5. Determine streak updates using shared streak logic
  let { currentStreak, lastActiveDate, longestStreak } = existingStreak;

  if (lastActiveDate === null) {
    // Very first activity ever for this learner
    currentStreak = 1;
    lastActiveDate = activity.localDate;
    longestStreak = 1;
  } else if (shouldReset(lastActiveDate, activity.localDate)) {
    // Gap of 3+ calendar days since last activity — reset streak, start fresh
    currentStreak = 1;
    lastActiveDate = activity.localDate;
  } else if (shouldIncrement(activityDatesBeforeSave, activity.localDate)) {
    // First activity of a new calendar day within grace window
    currentStreak += 1;
    lastActiveDate = activity.localDate;
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  }
  // else: same day activity already recorded — no streak change

  // 6. Update the Learner record with denormalized streak fields
  const updatedStreak: LearnerStreakRecord = {
    currentStreak,
    lastActiveDate: lastActiveDate ?? activity.localDate,
    longestStreak,
  };
  await deps.learnerRepository.updateStreakData(activity.learnerId, updatedStreak);

  return {
    success: true,
    streakData: {
      currentStreak: updatedStreak.currentStreak,
      lastActiveDate: updatedStreak.lastActiveDate ?? '',
      longestStreak: updatedStreak.longestStreak,
    },
  };
}
