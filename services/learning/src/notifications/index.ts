/**
 * Notification module exports.
 *
 * Provides the notification service for sending streak alerts,
 * progress updates, and streak reminders via SNS.
 */

export { sendNotification } from './notification-service';
export type {
  ParentNotificationPreferences,
  ISNSClient,
  IParentPreferencesRepository,
  NotificationTopicConfig,
  NotificationServiceDeps,
  NotificationResult,
  NotificationSuppressedResult,
} from './notification-service';

export {
  publishStreakAlert,
  publishProgressUpdate,
  publishStreakReminder,
  createPublisherConfigFromEnv,
  isSuccessResult,
} from './notification-publisher';

export type {
  StreakAlertData,
  ProgressUpdateData,
  StreakReminderData,
  NotificationPublisherConfig,
  PublishResult,
} from './notification-publisher';
