import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface LearningStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbCluster: rds.DatabaseCluster;
  apiKeysSecret: secretsmanager.ISecret;
  lambdaSecurityGroup: ec2.ISecurityGroup;
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

    const { vpc, dbCluster, apiKeysSecret } = props;

    // SNS Topics
    this.streakAlertsTopic = new sns.Topic(this, 'StreakAlertsTopic', {
      topicName: 'learnverse-streak-alerts',
      displayName: 'LearnVerse Streak Alerts',
    });

    this.progressNotificationsTopic = new sns.Topic(this, 'ProgressNotificationsTopic', {
      topicName: 'learnverse-progress-notifications',
      displayName: 'LearnVerse Progress Notifications',
    });

    // Learning Lambda
    this.learningFunction = new lambda.Function(this, 'LearningFunction', {
      functionName: 'learnverse-learning',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
        DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        STREAK_ALERTS_TOPIC_ARN: this.streakAlertsTopic.topicArn,
        PROGRESS_NOTIFICATIONS_TOPIC_ARN: this.progressNotificationsTopic.topicArn,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    // Permissions
    dbCluster.secret?.grantRead(this.learningFunction);
    this.streakAlertsTopic.grantPublish(this.learningFunction);
    this.progressNotificationsTopic.grantPublish(this.learningFunction);

    // Notification Dispatcher Lambda
    const notificationDispatcherFn = new lambda.Function(this, 'NotificationDispatcherFunction', {
      functionName: 'learnverse-notification-dispatcher',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async (event) => { console.log("Dispatching notification:", JSON.stringify(event)); return { statusCode: 200 }; }'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
        DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    dbCluster.secret?.grantRead(notificationDispatcherFn);

    // SNS subscriptions
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

    // Log group
    new logs.LogGroup(this, 'LearningLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-learning',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
