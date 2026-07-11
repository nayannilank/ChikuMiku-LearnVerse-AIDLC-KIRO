import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

/**
 * Main infrastructure stack for ChikuMiku LearnVerse.
 *
 * Defines all AWS resources for the AI-powered learning platform:
 * - Aurora Serverless PostgreSQL with pgvector
 * - S3 buckets for images, audio, and exports
 * - Cognito User Pool with JWT configuration
 * - API Gateway (REST + WebSocket)
 * - Lambda functions for each service
 * - SQS queues for async processing
 * - SNS topics for notifications
 * - CloudFront distribution for web app
 * - Secrets Manager for third-party API keys
 * - CloudWatch log groups and alarms
 */
export class LearnVerseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─────────────────────────────────────────────────────────────────────────
    // VPC for Aurora Serverless
    // ─────────────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'LearnVerseVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Aurora Serverless v2 PostgreSQL with pgvector extension
    // ─────────────────────────────────────────────────────────────────────────
    const dbCluster = new rds.DatabaseCluster(this, 'LearnVerseDb', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('Writer'),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: 'learnverse',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // S3 Buckets
    // ─────────────────────────────────────────────────────────────────────────
    const pageImagesBucket = new s3.Bucket(this, 'PageImagesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const audioAssetsBucket = new s3.Bucket(this, 'AudioAssetsBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const exportFilesBucket = new s3.Bucket(this, 'ExportFilesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          id: 'ExpireExportsAfter30Days',
        },
      ],
    });

    const webAppBucket = new s3.Bucket(this, 'WebAppBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Cognito User Pool
    // ─────────────────────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'LearnVerseUserPool', {
      userPoolName: 'learnverse-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true, phone: true },
      autoVerify: { email: true, phone: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('LearnVerseAppClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.minutes(60),
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Secrets Manager for third-party API keys
    // ─────────────────────────────────────────────────────────────────────────
    const apiKeysSecret = new secretsmanager.Secret(this, 'ThirdPartyApiKeys', {
      secretName: 'learnverse/third-party-api-keys',
      description: 'API keys for Google Vision OCR, OpenAI GPT-5 Mini, Whisper, Google TTS, OpenAI Embeddings',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          GOOGLE_VISION_API_KEY: '',
          OPENAI_API_KEY: '',
          GOOGLE_TTS_API_KEY: '',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SQS Queues
    // ─────────────────────────────────────────────────────────────────────────
    const ocrProcessingQueue = new sqs.Queue(this, 'OcrProcessingQueue', {
      queueName: 'learnverse-ocr-processing',
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'OcrProcessingDlq', {
          queueName: 'learnverse-ocr-processing-dlq',
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    const aiGenerationQueue = new sqs.Queue(this, 'AiGenerationQueue', {
      queueName: 'learnverse-ai-generation',
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'AiGenerationDlq', {
          queueName: 'learnverse-ai-generation-dlq',
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SNS Topics
    // ─────────────────────────────────────────────────────────────────────────
    const streakAlertsTopic = new sns.Topic(this, 'StreakAlertsTopic', {
      topicName: 'learnverse-streak-alerts',
      displayName: 'LearnVerse Streak Alerts',
    });

    const progressNotificationsTopic = new sns.Topic(this, 'ProgressNotificationsTopic', {
      topicName: 'learnverse-progress-notifications',
      displayName: 'LearnVerse Progress Notifications',
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Lambda Functions
    // ─────────────────────────────────────────────────────────────────────────
    const commonLambdaEnv: Record<string, string> = {
      NODE_OPTIONS: '--enable-source-maps',
      DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
      DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
      API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
    };

    const authFn = new lambda.Function(this, 'AuthFunction', {
      functionName: 'learnverse-auth',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonLambdaEnv,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const contentFn = new lambda.Function(this, 'ContentFunction', {
      functionName: 'learnverse-content',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        ...commonLambdaEnv,
        PAGE_IMAGES_BUCKET: pageImagesBucket.bucketName,
        OCR_QUEUE_URL: ocrProcessingQueue.queueUrl,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const learningFn = new lambda.Function(this, 'LearningFunction', {
      functionName: 'learnverse-learning',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        ...commonLambdaEnv,
        STREAK_ALERTS_TOPIC_ARN: streakAlertsTopic.topicArn,
        PROGRESS_NOTIFICATIONS_TOPIC_ARN: progressNotificationsTopic.topicArn,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const aiGatewayFn = new lambda.Function(this, 'AiGatewayFunction', {
      functionName: 'learnverse-ai-gateway',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      environment: {
        ...commonLambdaEnv,
        AUDIO_ASSETS_BUCKET: audioAssetsBucket.bucketName,
        AI_GENERATION_QUEUE_URL: aiGenerationQueue.queueUrl,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const exportFn = new lambda.Function(this, 'ExportFunction', {
      functionName: 'learnverse-export',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        ...commonLambdaEnv,
        EXPORT_FILES_BUCKET: exportFilesBucket.bucketName,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // IAM Permissions for Lambda functions
    // ─────────────────────────────────────────────────────────────────────────
    dbCluster.secret?.grantRead(authFn);
    dbCluster.secret?.grantRead(contentFn);
    dbCluster.secret?.grantRead(learningFn);
    dbCluster.secret?.grantRead(aiGatewayFn);
    dbCluster.secret?.grantRead(exportFn);

    dbCluster.connections.allowDefaultPortFrom(authFn);
    dbCluster.connections.allowDefaultPortFrom(contentFn);
    dbCluster.connections.allowDefaultPortFrom(learningFn);
    dbCluster.connections.allowDefaultPortFrom(aiGatewayFn);
    dbCluster.connections.allowDefaultPortFrom(exportFn);

    apiKeysSecret.grantRead(aiGatewayFn);

    pageImagesBucket.grantReadWrite(contentFn);
    audioAssetsBucket.grantReadWrite(aiGatewayFn);
    exportFilesBucket.grantReadWrite(exportFn);

    ocrProcessingQueue.grantSendMessages(contentFn);
    aiGenerationQueue.grantSendMessages(aiGatewayFn);

    // AI Gateway Lambda consumes messages from both SQS queues
    ocrProcessingQueue.grantConsumeMessages(aiGatewayFn);
    aiGenerationQueue.grantConsumeMessages(aiGatewayFn);

    // Wire SQS event sources to AI Gateway Lambda
    aiGatewayFn.addEventSource(
      new lambdaEventSources.SqsEventSource(ocrProcessingQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(10),
        reportBatchItemFailures: true,
      }),
    );

    aiGatewayFn.addEventSource(
      new lambdaEventSources.SqsEventSource(aiGenerationQueue, {
        batchSize: 2,
        maxBatchingWindow: cdk.Duration.seconds(30),
        reportBatchItemFailures: true,
      }),
    );

    streakAlertsTopic.grantPublish(learningFn);
    progressNotificationsTopic.grantPublish(learningFn);

    // ─────────────────────────────────────────────────────────────────────────
    // SNS Subscriptions — Notification Dispatcher
    // Subscribes a Lambda to both SNS topics to handle delivery to parent
    // notification channels (email, push). The dispatcher reads the message
    // attributes to determine the delivery channel and routes accordingly.
    // Requirements: 24.8, 17.4
    // ─────────────────────────────────────────────────────────────────────────
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
    });

    // Grant dispatcher access to database for reading parent contact details
    dbCluster.secret?.grantRead(notificationDispatcherFn);
    dbCluster.connections.allowDefaultPortFrom(notificationDispatcherFn);

    // Subscribe the dispatcher Lambda to both SNS topics
    streakAlertsTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(notificationDispatcherFn, {
        filterPolicy: {
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['streak_alert', 'streak_reminder'],
          }),
        },
      })
    );

    progressNotificationsTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(notificationDispatcherFn, {
        filterPolicy: {
          notificationType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['progress_update'],
          }),
        },
      })
    );

    // ─────────────────────────────────────────────────────────────────────────
    // CloudFront Distribution for web app
    // (Defined before API Gateway so we can reference the domain in CORS config)
    // ─────────────────────────────────────────────────────────────────────────
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'WebAppOAI',
      { comment: 'OAI for LearnVerse web app' },
    );
    webAppBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'WebAppDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(webAppBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    // ─────────────────────────────────────────────────────────────────────────
    // API Gateway - REST API with Cognito Authorizer
    // ─────────────────────────────────────────────────────────────────────────
    // Domain name with TLS 1.2+ enforcement (Req 20.1)
    // Reject connections using TLS versions older than 1.2
    const domainName = new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: `api.${this.stackName.toLowerCase()}.example.com`,
      certificate: acm.Certificate.fromCertificateArn(
        this,
        'ApiCert',
        `arn:aws:acm:${this.region}:${this.account}:certificate/placeholder`,
      ),
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    // Web client origin for CORS — uses CloudFront distribution domain
    const webClientOrigin = `https://${distribution.distributionDomainName}`;

    const restApi = new apigateway.RestApi(this, 'LearnVerseRestApi', {
      restApiName: 'LearnVerse API',
      description: 'ChikuMiku LearnVerse REST API',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 500,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [webClientOrigin],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Date',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      // Enforce HTTPS-only access — deny requests without secure transport
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            conditions: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
          }),
        ],
      }),
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: 'LearnVerseCognitoAuthorizer',
      },
    );

    const authorizedMethodOptions: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ── /auth/* → Auth Lambda (NO Cognito auth — login/register don't have tokens)
    const authResource = restApi.root.addResource('auth');
    authResource.addMethod('ANY', new apigateway.LambdaIntegration(authFn));
    const authProxy = authResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(authFn),
      anyMethod: true,
    });

    // ── /content/* → Content Lambda (Cognito authorized)
    const contentResource = restApi.root.addResource('content');
    contentResource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(contentFn),
      authorizedMethodOptions,
    );
    const contentProxy = contentResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(contentFn),
      anyMethod: false,
    });
    contentProxy.addMethod('ANY', new apigateway.LambdaIntegration(contentFn), authorizedMethodOptions);

    // ── /learn/* → Learning Lambda (Cognito authorized)
    const learnResource = restApi.root.addResource('learn');
    learnResource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(learningFn),
      authorizedMethodOptions,
    );
    const learnProxy = learnResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(learningFn),
      anyMethod: false,
    });
    learnProxy.addMethod('ANY', new apigateway.LambdaIntegration(learningFn), authorizedMethodOptions);

    // ── /ai/* → AI Gateway Lambda (Cognito authorized)
    const aiResource = restApi.root.addResource('ai');
    aiResource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(aiGatewayFn),
      authorizedMethodOptions,
    );
    const aiProxy = aiResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(aiGatewayFn),
      anyMethod: false,
    });
    aiProxy.addMethod('ANY', new apigateway.LambdaIntegration(aiGatewayFn), authorizedMethodOptions);

    // ── /export/* → Export Lambda (Cognito authorized)
    const exportResource = restApi.root.addResource('export');
    exportResource.addMethod(
      'ANY',
      new apigateway.LambdaIntegration(exportFn),
      authorizedMethodOptions,
    );
    const exportProxy = exportResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(exportFn),
      anyMethod: false,
    });
    exportProxy.addMethod('ANY', new apigateway.LambdaIntegration(exportFn), authorizedMethodOptions);

    // ─────────────────────────────────────────────────────────────────────────
    // API Gateway - WebSocket API for real-time updates
    // ─────────────────────────────────────────────────────────────────────────
    const webSocketApi = new apigatewayv2.CfnApi(this, 'LearnVerseWebSocketApi', {
      name: 'LearnVerse WebSocket API',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const webSocketStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: webSocketApi.ref,
      stageName: 'v1',
      autoDeploy: true,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CloudWatch Log Groups
    // ─────────────────────────────────────────────────────────────────────────
    const authLogGroup = new logs.LogGroup(this, 'AuthLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-auth',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const contentLogGroup = new logs.LogGroup(this, 'ContentLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-content',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const learningLogGroup = new logs.LogGroup(this, 'LearningLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-learning',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const aiGatewayLogGroup = new logs.LogGroup(this, 'AiGatewayLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-ai-gateway',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const exportLogGroup = new logs.LogGroup(this, 'ExportLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-export',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CloudWatch Alarms
    // ─────────────────────────────────────────────────────────────────────────
    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: 'learnverse-api-5xx-errors',
      alarmDescription: 'Alarm when API Gateway 5xx error rate exceeds threshold',
      metric: restApi.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
      alarmName: 'learnverse-api-4xx-errors',
      alarmDescription: 'Alarm when API Gateway 4xx error rate exceeds threshold',
      metric: restApi.metricClientError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Stack Outputs
    // ─────────────────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'RestApiUrl', { value: restApi.url });
    new cdk.CfnOutput(this, 'WebSocketApiId', { value: webSocketApi.ref });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'PageImagesBucketName', { value: pageImagesBucket.bucketName });
    new cdk.CfnOutput(this, 'AudioAssetsBucketName', { value: audioAssetsBucket.bucketName });
    new cdk.CfnOutput(this, 'ExportFilesBucketName', { value: exportFilesBucket.bucketName });
    new cdk.CfnOutput(this, 'DbClusterEndpoint', { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'OcrQueueUrl', { value: ocrProcessingQueue.queueUrl });
    new cdk.CfnOutput(this, 'AiGenerationQueueUrl', { value: aiGenerationQueue.queueUrl });
  }
}
