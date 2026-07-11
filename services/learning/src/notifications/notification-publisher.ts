/**
 * Notification Publisher Utility
 *
 * High-level publisher that the Learning Lambda handlers use to send
 * streak alerts, progress updates, and streak reminders to parents.
 * Integrates with the notification service to respect parent preferences
 * before dispatching messages via SNS.
 *
 * Flow: Learning Lambda → NotificationPublisher → sendNotification → SNS → parent channel
 *
 * Requirements: 24.8, 17.4
 */

import { sendNotification } from './notification-service';
import type {
  NotificationServiceDeps,
  NotificationResult,
  NotificationSuppressedResult,
} from './notification-service';
import type { NotificationPayload, APIError } from '@chikumiku/types';

/**
 * Data for a streak alert notification.
 * Sent when a learner is at risk of losing their streak (1 day missed).
 */
export interface StreakAlertData {
  learnerId: string;
  learnerName: string;
  currentStreak: number;
  daysMissed: number;
}

/**
 * Data for a progress update notification.
 * Periodic updates about learner progress sent to parents.
 */
export interface ProgressUpdateData {
  learnerId: string;
  learnerName: string;
  subject: string;
  chapterName?: string;
  completionPercent: number;
  activitiesCompleted?: number;
}

/**
 * Data for a streak reminder notification.
 * Reminder to maintain streak before it resets.
 */
export interface StreakReminderData {
  learnerId: string;
  learnerName: string;
  currentStreak: number;
  daysInactive: number;
}

/** Configuration needed to initialize the notification publisher. */
export interface NotificationPublisherConfig {
  deps: NotificationServiceDeps;
  /** Default channel for notifications if not specified per call. */
  defaultChannel?: 'push' | 'email';
}

/** Result type from publisher methods. */
export type PublishResult = NotificationResult | NotificationSuppressedResult | APIError;

/**
 * Determines if a result indicates successful dispatch or suppression (not an error).
 */
export function isSuccessResult(
  result: PublishResult
): result is NotificationResult | NotificationSuppressedResult {
  return 'success' in result && result.success === true;
}

/**
 * Publishes a streak alert to the parent notification channel.
 *
 * Triggered when a learner has missed 1 day of activity and is at risk
 * of losing their streak. Respects the parent's streak_reminders_enabled flag.
 *
 * @param parentId - The parent recipient ID
 * @param data - Streak alert details
 * @param config - Publisher configuration with dependencies
 * @param channel - Optional override for notification channel
 */
export async function publishStreakAlert(
  parentId: string,
  data: StreakAlertData,
  config: NotificationPublisherConfig,
  channel?: 'push' | 'email'
): Promise<PublishResult> {
  const payload: NotificationPayload = {
    type: 'streak_alert',
    recipientId: parentId,
    channel: channel ?? config.defaultChannel ?? 'push',
    data: {
      learnerId: data.learnerId,
      learnerName: data.learnerName,
      currentStreak: data.currentStreak,
      daysMissed: data.daysMissed,
      message: `${data.learnerName} has missed ${data.daysMissed} day(s) of learning. ` +
        `Their current streak is ${data.currentStreak} days. Encourage them to continue!`,
    },
  };

  return sendNotification(payload, config.deps);
}

/**
 * Publishes a progress update to the parent notification channel.
 *
 * Sent periodically to inform parents about their child's learning progress.
 * Respects the parent's progress_alerts_enabled flag.
 *
 * @param parentId - The parent recipient ID
 * @param data - Progress update details
 * @param config - Publisher configuration with dependencies
 * @param channel - Optional override for notification channel
 */
export async function publishProgressUpdate(
  parentId: string,
  data: ProgressUpdateData,
  config: NotificationPublisherConfig,
  channel?: 'push' | 'email'
): Promise<PublishResult> {
  const payload: NotificationPayload = {
    type: 'progress_update',
    recipientId: parentId,
    channel: channel ?? config.defaultChannel ?? 'push',
    data: {
      learnerId: data.learnerId,
      learnerName: data.learnerName,
      subject: data.subject,
      chapterName: data.chapterName,
      completionPercent: data.completionPercent,
      activitiesCompleted: data.activitiesCompleted,
      message: `${data.learnerName} has completed ${data.completionPercent}% of ${data.subject}` +
        (data.chapterName ? ` - ${data.chapterName}` : '') + '.',
    },
  };

  return sendNotification(payload, config.deps);
}

/**
 * Publishes a streak reminder to the parent notification channel.
 *
 * Sent as a reminder to encourage the learner to maintain their streak
 * before it resets. Respects the parent's streak_reminders_enabled flag.
 *
 * @param parentId - The parent recipient ID
 * @param data - Streak reminder details
 * @param config - Publisher configuration with dependencies
 * @param channel - Optional override for notification channel
 */
export async function publishStreakReminder(
  parentId: string,
  data: StreakReminderData,
  config: NotificationPublisherConfig,
  channel?: 'push' | 'email'
): Promise<PublishResult> {
  const payload: NotificationPayload = {
    type: 'streak_reminder',
    recipientId: parentId,
    channel: channel ?? config.defaultChannel ?? 'push',
    data: {
      learnerId: data.learnerId,
      learnerName: data.learnerName,
      currentStreak: data.currentStreak,
      daysInactive: data.daysInactive,
      message: `Reminder: ${data.learnerName} hasn't practiced today. ` +
        `Their streak of ${data.currentStreak} days is at risk!`,
    },
  };

  return sendNotification(payload, config.deps);
}

/**
 * Creates a NotificationPublisherConfig from environment variables.
 *
 * Reads SNS topic ARNs from Lambda environment variables set by the CDK stack.
 * The SNS client and preferences repository must be provided by the caller.
 */
export function createPublisherConfigFromEnv(
  snsClient: NotificationServiceDeps['snsClient'],
  preferencesRepository: NotificationServiceDeps['preferencesRepository'],
  envOverrides?: Partial<Record<string, string>>
): NotificationPublisherConfig {
  const env = { ...process.env, ...envOverrides };

  const topicConfig = {
    streakAlert: env.STREAK_ALERTS_TOPIC_ARN ?? '',
    progressUpdate: env.PROGRESS_NOTIFICATIONS_TOPIC_ARN ?? '',
    streakReminder: env.STREAK_ALERTS_TOPIC_ARN ?? '', // streak reminders use the same topic as alerts
  };

  return {
    deps: {
      snsClient,
      preferencesRepository,
      topicConfig,
    },
    defaultChannel: 'push',
  };
}
