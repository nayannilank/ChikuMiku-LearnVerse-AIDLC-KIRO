/**
 * Notification Service (SNS Integration)
 *
 * Sends streak alerts, progress updates, and streak reminders to parents
 * via push or email channels. Respects parent notification preferences
 * before dispatching messages through SNS.
 *
 * Requirements: 17.4
 */

import type { NotificationPayload, APIError } from '@chikumiku/types';

/** Parent notification preferences controlling which alerts they receive. */
export interface ParentNotificationPreferences {
  progressAlertsEnabled: boolean;
  streakRemindersEnabled: boolean;
}

/** SNS client interface for publishing messages to topics. */
export interface ISNSClient {
  publish(params: {
    topicArn: string;
    message: string;
    subject?: string;
    messageAttributes?: Record<string, { DataType: string; StringValue: string }>;
  }): Promise<{ messageId: string }>;
}

/** Repository interface for retrieving parent notification preferences. */
export interface IParentPreferencesRepository {
  getPreferences(parentId: string): Promise<ParentNotificationPreferences | null>;
}

/** Configuration for SNS topic ARNs based on notification type. */
export interface NotificationTopicConfig {
  streakAlert: string;
  progressUpdate: string;
  streakReminder: string;
}

/** Dependencies for the notification service. */
export interface NotificationServiceDeps {
  snsClient: ISNSClient;
  preferencesRepository: IParentPreferencesRepository;
  topicConfig: NotificationTopicConfig;
}

/** Successful notification dispatch result. */
export interface NotificationResult {
  success: true;
  messageId: string;
  notificationType: NotificationPayload['type'];
  channel: NotificationPayload['channel'];
}

/** Result indicating notification was suppressed due to preferences. */
export interface NotificationSuppressedResult {
  success: true;
  suppressed: true;
  reason: string;
}

/**
 * Maps notification type to the corresponding preference check.
 */
function isNotificationEnabled(
  type: NotificationPayload['type'],
  preferences: ParentNotificationPreferences
): boolean {
  switch (type) {
    case 'progress_update':
      return preferences.progressAlertsEnabled;
    case 'streak_alert':
    case 'streak_reminder':
      return preferences.streakRemindersEnabled;
    default:
      return false;
  }
}

/**
 * Returns the SNS topic ARN for the given notification type.
 */
function getTopicArn(
  type: NotificationPayload['type'],
  config: NotificationTopicConfig
): string {
  switch (type) {
    case 'streak_alert':
      return config.streakAlert;
    case 'progress_update':
      return config.progressUpdate;
    case 'streak_reminder':
      return config.streakReminder;
  }
}

/**
 * Sends a notification to a parent, respecting their preferences.
 *
 * - Validates the payload
 * - Checks parent preferences for the notification type
 * - Routes to appropriate SNS topic based on type and channel
 * - Returns success with messageId, suppressed result, or APIError
 */
export async function sendNotification(
  payload: NotificationPayload,
  deps: NotificationServiceDeps
): Promise<NotificationResult | NotificationSuppressedResult | APIError> {
  // Validate payload
  if (!payload.recipientId || payload.recipientId.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'recipientId is required',
      retryable: false,
    };
  }

  if (!payload.type) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'notification type is required',
      retryable: false,
    };
  }

  if (!payload.channel) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'channel is required',
      retryable: false,
    };
  }

  // Retrieve parent preferences
  const preferences = await deps.preferencesRepository.getPreferences(payload.recipientId);

  if (preferences === null) {
    return {
      statusCode: 404,
      errorCode: 'PARENT_NOT_FOUND',
      message: 'Parent preferences not found',
      retryable: false,
    };
  }

  // Check if notification type is enabled for this parent
  if (!isNotificationEnabled(payload.type, preferences)) {
    return {
      success: true,
      suppressed: true,
      reason: `Notification type '${payload.type}' is disabled by parent preferences`,
    };
  }

  // Resolve topic ARN and publish
  const topicArn = getTopicArn(payload.type, deps.topicConfig);

  try {
    const result = await deps.snsClient.publish({
      topicArn,
      message: JSON.stringify({
        type: payload.type,
        recipientId: payload.recipientId,
        channel: payload.channel,
        data: payload.data,
      }),
      subject: formatSubject(payload.type),
      messageAttributes: {
        channel: {
          DataType: 'String',
          StringValue: payload.channel,
        },
        notificationType: {
          DataType: 'String',
          StringValue: payload.type,
        },
      },
    });

    return {
      success: true,
      messageId: result.messageId,
      notificationType: payload.type,
      channel: payload.channel,
    };
  } catch (error) {
    return {
      statusCode: 500,
      errorCode: 'NOTIFICATION_DELIVERY_FAILED',
      message: 'Failed to publish notification',
      retryable: true,
    };
  }
}

/**
 * Formats a human-readable subject line for the notification.
 */
function formatSubject(type: NotificationPayload['type']): string {
  switch (type) {
    case 'streak_alert':
      return 'Streak Alert';
    case 'progress_update':
      return 'Progress Update';
    case 'streak_reminder':
      return 'Streak Reminder';
  }
}
