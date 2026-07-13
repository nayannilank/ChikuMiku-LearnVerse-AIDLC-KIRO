import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface LearningStackProps extends cdk.StackProps {
  databaseSecret: secretsmanager.ISecret;
  apiKeysSecret: secretsmanager.ISecret;
}

/**
 * Learning stack — dashboards, progress tracking, streaks, notifications.
 */
export class LearningStack extends cdk.Stack {
  public readonly learningFunction: lambda.Function;
  public readonly streakAlertsTopic: sns.Topic;
  public readonly progressNotificationsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: LearningStackProps) {
    super(scope, id, props);

    const { databaseSecret, apiKeysSecret } = props;

    this.streakAlertsTopic = new sns.Topic(this, 'StreakAlertsTopic', {
      topicName: 'learnverse-streak-alerts',
      displayName: 'LearnVerse Streak Alerts',
    });

    this.progressNotificationsTopic = new sns.Topic(this, 'ProgressNotificationsTopic', {
      topicName: 'learnverse-progress-notifications',
      displayName: 'LearnVerse Progress Notifications',
    });

    this.learningFunction = new lambda.Function(this, 'LearningFunction', {
      functionName: 'learnverse-learning',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        STREAK_ALERTS_TOPIC_ARN: this.streakAlertsTopic.topicArn,
        PROGRESS_NOTIFICATIONS_TOPIC_ARN: this.progressNotificationsTopic.topicArn,
      },
    });

    databaseSecret.grantRead(this.learningFunction);
    this.streakAlertsTopic.grantPublish(this.learningFunction);
    this.progressNotificationsTopic.grantPublish(this.learningFunction);

    // Notification Dispatcher
    const notificationDispatcherFn = new lambda.Function(this, 'NotificationDispatcherFunction', {
      functionName: 'learnverse-notification-dispatcher',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async (event) => { console.log("Dispatching:", JSON.stringify(event)); return { statusCode: 200 }; }'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
      },
    });

    databaseSecret.grantRead(notificationDispatcherFn);

    this.streakAlertsTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(notificationDispatcherFn, {
        filterPolicy: {
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['streak_alert', 'streak_reminder'],
          }),
        },
      }),
    );

    this.progressNotificationsTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(notificationDispatcherFn, {
        filterPolicy: {
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['progress_update'],
          }),
        },
      }),
    );

    new logs.LogGroup(this, 'LearningLambdaLogGroup', {
      logGroupName: `/aws/lambda/${this.learningFunction.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
