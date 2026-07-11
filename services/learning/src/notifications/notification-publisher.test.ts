/**
 * Unit tests for Notification Publisher
 *
 * Tests the high-level publisher utility that triggers streak alerts,
 * progress updates, and streak reminders through the notification service.
 *
 * Requirements: 24.8, 17.4
 */

import {
  publishStreakAlert,
  publishProgressUpdate,
  publishStreakReminder,
  createPublisherConfigFromEnv,
  isSuccessResult,
} from './notification-publisher';
import type {
  StreakAlertData,
  ProgressUpdateData,
  StreakReminderData,
  NotificationPublisherConfig,
} from './notification-publisher';
import type {
  ISNSClient,
  IParentPreferencesRepository,
  NotificationTopicConfig,
  NotificationServiceDeps,
  NotificationResult,
  NotificationSuppressedResult,
} from './notification-service';
import type { APIError } from '@chikumiku/types';

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
  preferences: { progressAlertsEnabled: boolean; streakRemindersEnabled: boolean } | null
): IParentPreferencesRepository {
  return {
    getPreferences: jest.fn(async () => preferences),
  };
}

function createConfig(overrides?: Partial<NotificationServiceDeps>): NotificationPublisherConfig {
  return {
    deps: {
      snsClient: createMockSNSClient(),
      preferencesRepository: createMockPreferencesRepo({
        progressAlertsEnabled: true,
        streakRemindersEnabled: true,
      }),
      topicConfig: mockTopicConfig,
      ...overrides,
    },
    defaultChannel: 'push',
  };
}

describe('publishStreakAlert', () => {
  it('publishes to streak alert topic when preferences allow', async () => {
    const snsClient = createMockSNSClient('msg-streak-001');
    const config = createConfig({ snsClient });

    const data: StreakAlertData = {
      learnerId: 'learner-001',
      learnerName: 'Arjun',
      currentStreak: 5,
      daysMissed: 1,
    };

    const result = await publishStreakAlert('parent-001', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationResult).messageId).toBe('msg-streak-001');
    expect((result as NotificationResult).notificationType).toBe('streak_alert');
    expect((result as NotificationResult).channel).toBe('push');

    expect(snsClient.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topicArn: mockTopicConfig.streakAlert,
      })
    );
  });

  it('suppresses when streakRemindersEnabled is false', async () => {
    const config = createConfig({
      preferencesRepository: createMockPreferencesRepo({
        progressAlertsEnabled: true,
        streakRemindersEnabled: false,
      }),
    });

    const data: StreakAlertData = {
      learnerId: 'learner-001',
      learnerName: 'Arjun',
      currentStreak: 5,
      daysMissed: 1,
    };

    const result = await publishStreakAlert('parent-001', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationSuppressedResult).suppressed).toBe(true);
  });

  it('uses provided channel override instead of default', async () => {
    const snsClient = createMockSNSClient('msg-002');
    const config = createConfig({ snsClient });

    const data: StreakAlertData = {
      learnerId: 'learner-001',
      learnerName: 'Arjun',
      currentStreak: 3,
      daysMissed: 1,
    };

    const result = await publishStreakAlert('parent-001', data, config, 'email');

    expect((result as NotificationResult).channel).toBe('email');
    expect(snsClient.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        messageAttributes: expect.objectContaining({
          channel: { DataType: 'String', StringValue: 'email' },
        }),
      })
    );
  });

  it('includes learner details in message body', async () => {
    const snsClient = createMockSNSClient('msg-003');
    const config = createConfig({ snsClient });

    const data: StreakAlertData = {
      learnerId: 'learner-001',
      learnerName: 'Arjun',
      currentStreak: 10,
      daysMissed: 1,
    };

    await publishStreakAlert('parent-001', data, config);

    const publishCall = (snsClient.publish as jest.Mock).mock.calls[0][0];
    const messageBody = JSON.parse(publishCall.message);
    expect(messageBody.data.learnerId).toBe('learner-001');
    expect(messageBody.data.learnerName).toBe('Arjun');
    expect(messageBody.data.currentStreak).toBe(10);
    expect(messageBody.data.daysMissed).toBe(1);
    expect(messageBody.data.message).toContain('Arjun');
  });
});

describe('publishProgressUpdate', () => {
  it('publishes to progress notification topic when preferences allow', async () => {
    const snsClient = createMockSNSClient('msg-progress-001');
    const config = createConfig({ snsClient });

    const data: ProgressUpdateData = {
      learnerId: 'learner-002',
      learnerName: 'Priya',
      subject: 'Mathematics',
      chapterName: 'Algebra Basics',
      completionPercent: 75,
      activitiesCompleted: 12,
    };

    const result = await publishProgressUpdate('parent-002', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationResult).messageId).toBe('msg-progress-001');
    expect((result as NotificationResult).notificationType).toBe('progress_update');

    expect(snsClient.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topicArn: mockTopicConfig.progressUpdate,
      })
    );
  });

  it('suppresses when progressAlertsEnabled is false', async () => {
    const config = createConfig({
      preferencesRepository: createMockPreferencesRepo({
        progressAlertsEnabled: false,
        streakRemindersEnabled: true,
      }),
    });

    const data: ProgressUpdateData = {
      learnerId: 'learner-002',
      learnerName: 'Priya',
      subject: 'Science',
      completionPercent: 50,
    };

    const result = await publishProgressUpdate('parent-002', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationSuppressedResult).suppressed).toBe(true);
  });

  it('includes subject and chapter in message body', async () => {
    const snsClient = createMockSNSClient('msg-004');
    const config = createConfig({ snsClient });

    const data: ProgressUpdateData = {
      learnerId: 'learner-002',
      learnerName: 'Priya',
      subject: 'English',
      chapterName: 'Grammar Basics',
      completionPercent: 90,
      activitiesCompleted: 8,
    };

    await publishProgressUpdate('parent-002', data, config);

    const publishCall = (snsClient.publish as jest.Mock).mock.calls[0][0];
    const messageBody = JSON.parse(publishCall.message);
    expect(messageBody.data.subject).toBe('English');
    expect(messageBody.data.chapterName).toBe('Grammar Basics');
    expect(messageBody.data.completionPercent).toBe(90);
    expect(messageBody.data.message).toContain('Priya');
    expect(messageBody.data.message).toContain('English');
    expect(messageBody.data.message).toContain('Grammar Basics');
  });
});

describe('publishStreakReminder', () => {
  it('publishes to streak reminder topic when preferences allow', async () => {
    const snsClient = createMockSNSClient('msg-reminder-001');
    const config = createConfig({ snsClient });

    const data: StreakReminderData = {
      learnerId: 'learner-003',
      learnerName: 'Ravi',
      currentStreak: 15,
      daysInactive: 1,
    };

    const result = await publishStreakReminder('parent-003', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationResult).messageId).toBe('msg-reminder-001');
    expect((result as NotificationResult).notificationType).toBe('streak_reminder');

    expect(snsClient.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        topicArn: mockTopicConfig.streakReminder,
      })
    );
  });

  it('suppresses when streakRemindersEnabled is false', async () => {
    const config = createConfig({
      preferencesRepository: createMockPreferencesRepo({
        progressAlertsEnabled: true,
        streakRemindersEnabled: false,
      }),
    });

    const data: StreakReminderData = {
      learnerId: 'learner-003',
      learnerName: 'Ravi',
      currentStreak: 15,
      daysInactive: 1,
    };

    const result = await publishStreakReminder('parent-003', data, config);

    expect(isSuccessResult(result)).toBe(true);
    expect((result as NotificationSuppressedResult).suppressed).toBe(true);
  });

  it('includes streak details and urgency message', async () => {
    const snsClient = createMockSNSClient('msg-005');
    const config = createConfig({ snsClient });

    const data: StreakReminderData = {
      learnerId: 'learner-003',
      learnerName: 'Ravi',
      currentStreak: 20,
      daysInactive: 1,
    };

    await publishStreakReminder('parent-003', data, config);

    const publishCall = (snsClient.publish as jest.Mock).mock.calls[0][0];
    const messageBody = JSON.parse(publishCall.message);
    expect(messageBody.data.currentStreak).toBe(20);
    expect(messageBody.data.daysInactive).toBe(1);
    expect(messageBody.data.message).toContain('Ravi');
    expect(messageBody.data.message).toContain('20');
  });
});

describe('createPublisherConfigFromEnv', () => {
  it('creates config from environment variables', () => {
    const snsClient = createMockSNSClient();
    const preferencesRepo = createMockPreferencesRepo({
      progressAlertsEnabled: true,
      streakRemindersEnabled: true,
    });

    const config = createPublisherConfigFromEnv(snsClient, preferencesRepo, {
      STREAK_ALERTS_TOPIC_ARN: 'arn:aws:sns:us-east-1:111:alerts',
      PROGRESS_NOTIFICATIONS_TOPIC_ARN: 'arn:aws:sns:us-east-1:111:progress',
    });

    expect(config.deps.topicConfig.streakAlert).toBe('arn:aws:sns:us-east-1:111:alerts');
    expect(config.deps.topicConfig.progressUpdate).toBe('arn:aws:sns:us-east-1:111:progress');
    expect(config.deps.topicConfig.streakReminder).toBe('arn:aws:sns:us-east-1:111:alerts');
    expect(config.defaultChannel).toBe('push');
  });

  it('defaults to empty strings when env vars are missing', () => {
    const snsClient = createMockSNSClient();
    const preferencesRepo = createMockPreferencesRepo({
      progressAlertsEnabled: true,
      streakRemindersEnabled: true,
    });

    const config = createPublisherConfigFromEnv(snsClient, preferencesRepo, {});

    expect(config.deps.topicConfig.streakAlert).toBe('');
    expect(config.deps.topicConfig.progressUpdate).toBe('');
  });
});

describe('isSuccessResult', () => {
  it('returns true for NotificationResult', () => {
    const result: NotificationResult = {
      success: true,
      messageId: 'msg-001',
      notificationType: 'streak_alert',
      channel: 'push',
    };
    expect(isSuccessResult(result)).toBe(true);
  });

  it('returns true for suppressed result', () => {
    const result: NotificationSuppressedResult = {
      success: true,
      suppressed: true,
      reason: 'Disabled by preference',
    };
    expect(isSuccessResult(result)).toBe(true);
  });

  it('returns false for error result', () => {
    const result: APIError = {
      statusCode: 500,
      errorCode: 'NOTIFICATION_DELIVERY_FAILED',
      message: 'Failed',
      retryable: true,
    };
    expect(isSuccessResult(result)).toBe(false);
  });
});
