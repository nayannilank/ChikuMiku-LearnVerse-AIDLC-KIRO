/**
 * Unit tests for Notification Service
 *
 * Tests notification dispatch logic including preference checks,
 * channel routing, and error handling.
 *
 * Requirements: 17.4
 */

import { sendNotification } from './notification-service';
import type {
  ISNSClient,
  IParentPreferencesRepository,
  ParentNotificationPreferences,
  NotificationTopicConfig,
  NotificationServiceDeps,
  NotificationResult,
  NotificationSuppressedResult,
} from './notification-service';
import type { NotificationPayload, APIError } from '@chikumiku/types';

const mockTopicConfig: NotificationTopicConfig = {
  streakAlert: 'arn:aws:sns:us-east-1:123456789:streak-alerts',
  progressUpdate: 'arn:aws:sns:us-east-1:123456789:progress-updates',
  streakReminder: 'arn:aws:sns:us-east-1:123456789:streak-reminders',
};

function createMockSNSClient(messageId = 'msg-001'): ISNSClient {
  return {
    publish: jest.fn(async () => ({ messageId })),
  };
}

function createMockPreferencesRepo(
  preferences: ParentNotificationPreferences | null
): IParentPreferencesRepository {
  return {
    getPreferences: jest.fn(async () => preferences),
  };
}

function createDeps(overrides?: Partial<NotificationServiceDeps>): NotificationServiceDeps {
  return {
    snsClient: createMockSNSClient(),
    preferencesRepository: createMockPreferencesRepo({
      progressAlertsEnabled: true,
      streakRemindersEnabled: true,
    }),
    topicConfig: mockTopicConfig,
    ...overrides,
  };
}

describe('sendNotification', () => {
  describe('validation', () => {
    it('returns 400 when recipientId is empty', async () => {
      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: '',
        channel: 'push',
        data: {},
      };

      const result = await sendNotification(payload, createDeps());

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('errorCode', 'VALIDATION_ERROR');
      expect((result as APIError).message).toContain('recipientId');
    });

    it('returns 400 when recipientId is whitespace-only', async () => {
      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: '   ',
        channel: 'push',
        data: {},
      };

      const result = await sendNotification(payload, createDeps());

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });
  });

  describe('preference checks', () => {
    it('returns 404 when parent preferences not found', async () => {
      const payload: NotificationPayload = {
        type: 'progress_update',
        recipientId: 'parent-unknown',
        channel: 'email',
        data: { subject: 'math', score: 85 },
      };

      const deps = createDeps({
        preferencesRepository: createMockPreferencesRepo(null),
      });

      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('statusCode', 404);
      expect(result).toHaveProperty('errorCode', 'PARENT_NOT_FOUND');
    });

    it('suppresses progress_update when progressAlertsEnabled is false', async () => {
      const payload: NotificationPayload = {
        type: 'progress_update',
        recipientId: 'parent-001',
        channel: 'email',
        data: { subject: 'science' },
      };

      const deps = createDeps({
        preferencesRepository: createMockPreferencesRepo({
          progressAlertsEnabled: false,
          streakRemindersEnabled: true,
        }),
      });

      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('suppressed', true);
      expect((result as NotificationSuppressedResult).reason).toContain('progress_update');
    });

    it('suppresses streak_alert when streakRemindersEnabled is false', async () => {
      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: 'parent-001',
        channel: 'push',
        data: { streak: 7 },
      };

      const deps = createDeps({
        preferencesRepository: createMockPreferencesRepo({
          progressAlertsEnabled: true,
          streakRemindersEnabled: false,
        }),
      });

      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('suppressed', true);
      expect((result as NotificationSuppressedResult).reason).toContain('streak_alert');
    });

    it('suppresses streak_reminder when streakRemindersEnabled is false', async () => {
      const payload: NotificationPayload = {
        type: 'streak_reminder',
        recipientId: 'parent-001',
        channel: 'push',
        data: { daysInactive: 1 },
      };

      const deps = createDeps({
        preferencesRepository: createMockPreferencesRepo({
          progressAlertsEnabled: true,
          streakRemindersEnabled: false,
        }),
      });

      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('suppressed', true);
      expect((result as NotificationSuppressedResult).reason).toContain('streak_reminder');
    });
  });

  describe('successful dispatch', () => {
    it('publishes streak_alert to correct topic with push channel', async () => {
      const snsClient = createMockSNSClient('msg-streak-001');
      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: 'parent-001',
        channel: 'push',
        data: { learnerId: 'learner-001', currentStreak: 7 },
      };

      const deps = createDeps({ snsClient });
      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect((result as NotificationResult).messageId).toBe('msg-streak-001');
      expect((result as NotificationResult).notificationType).toBe('streak_alert');
      expect((result as NotificationResult).channel).toBe('push');

      expect(snsClient.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topicArn: mockTopicConfig.streakAlert,
          messageAttributes: expect.objectContaining({
            channel: { DataType: 'String', StringValue: 'push' },
            notificationType: { DataType: 'String', StringValue: 'streak_alert' },
          }),
        })
      );
    });

    it('publishes progress_update to correct topic with email channel', async () => {
      const snsClient = createMockSNSClient('msg-progress-001');
      const payload: NotificationPayload = {
        type: 'progress_update',
        recipientId: 'parent-002',
        channel: 'email',
        data: { learnerId: 'learner-002', subject: 'math', completionPercent: 85 },
      };

      const deps = createDeps({ snsClient });
      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect((result as NotificationResult).messageId).toBe('msg-progress-001');
      expect((result as NotificationResult).notificationType).toBe('progress_update');
      expect((result as NotificationResult).channel).toBe('email');

      expect(snsClient.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topicArn: mockTopicConfig.progressUpdate,
        })
      );
    });

    it('publishes streak_reminder to correct topic', async () => {
      const snsClient = createMockSNSClient('msg-reminder-001');
      const payload: NotificationPayload = {
        type: 'streak_reminder',
        recipientId: 'parent-003',
        channel: 'push',
        data: { learnerId: 'learner-003', daysInactive: 1 },
      };

      const deps = createDeps({ snsClient });
      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('success', true);
      expect((result as NotificationResult).messageId).toBe('msg-reminder-001');
      expect((result as NotificationResult).notificationType).toBe('streak_reminder');

      expect(snsClient.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          topicArn: mockTopicConfig.streakReminder,
        })
      );
    });

    it('includes correct subject in published message', async () => {
      const snsClient = createMockSNSClient('msg-001');
      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: 'parent-001',
        channel: 'email',
        data: {},
      };

      const deps = createDeps({ snsClient });
      await sendNotification(payload, deps);

      expect(snsClient.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Streak Alert',
        })
      );
    });

    it('serializes payload data in the message body', async () => {
      const snsClient = createMockSNSClient('msg-001');
      const payload: NotificationPayload = {
        type: 'progress_update',
        recipientId: 'parent-001',
        channel: 'push',
        data: { score: 95, chapter: 'Photosynthesis' },
      };

      const deps = createDeps({ snsClient });
      await sendNotification(payload, deps);

      const publishCall = (snsClient.publish as jest.Mock).mock.calls[0][0];
      const messageBody = JSON.parse(publishCall.message);
      expect(messageBody.type).toBe('progress_update');
      expect(messageBody.recipientId).toBe('parent-001');
      expect(messageBody.channel).toBe('push');
      expect(messageBody.data.score).toBe(95);
      expect(messageBody.data.chapter).toBe('Photosynthesis');
    });
  });

  describe('error handling', () => {
    it('returns 500 when SNS publish fails', async () => {
      const snsClient: ISNSClient = {
        publish: jest.fn(async () => {
          throw new Error('SNS connection timeout');
        }),
      };

      const payload: NotificationPayload = {
        type: 'streak_alert',
        recipientId: 'parent-001',
        channel: 'push',
        data: {},
      };

      const deps = createDeps({ snsClient });
      const result = await sendNotification(payload, deps);

      expect(result).toHaveProperty('statusCode', 500);
      expect(result).toHaveProperty('errorCode', 'NOTIFICATION_DELIVERY_FAILED');
      expect((result as APIError).retryable).toBe(true);
    });
  });
});
