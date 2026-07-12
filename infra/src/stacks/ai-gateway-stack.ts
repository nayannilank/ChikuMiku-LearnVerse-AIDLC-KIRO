import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AiGatewayStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbCluster: rds.DatabaseCluster;
  apiKeysSecret: secretsmanager.ISecret;
  ocrProcessingQueue: sqs.Queue;
  lambdaSecurityGroup: ec2.ISecurityGroup;
}

/**
 * AI Gateway stack — single entry point for all external AI services.
 *
 * Handles OCR (Google Vision), explanations (GPT-5 Mini), pronunciation (TTS/Whisper),
 * grammar exercises, Q&A with RAG, revision quizzes, and embeddings.
 */
export class AiGatewayStack extends cdk.Stack {
  public readonly aiGatewayFunction: lambda.Function;
  public readonly audioAssetsBucket: s3.Bucket;
  public readonly aiGenerationQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: AiGatewayStackProps) {
    super(scope, id, props);

    const { vpc, dbCluster, apiKeysSecret, ocrProcessingQueue } = props;

    // S3 bucket for audio assets (TTS, pronunciation)
    this.audioAssetsBucket = new s3.Bucket(this, 'AudioAssetsBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SQS queue for async AI generation
    this.aiGenerationQueue = new sqs.Queue(this, 'AiGenerationQueue', {
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

    // AI Gateway Lambda
    this.aiGatewayFunction = new lambda.Function(this, 'AiGatewayFunction', {
      functionName: 'learnverse-ai-gateway',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
        DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        AUDIO_ASSETS_BUCKET: this.audioAssetsBucket.bucketName,
        AI_GENERATION_QUEUE_URL: this.aiGenerationQueue.queueUrl,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    // Permissions
    dbCluster.secret?.grantRead(this.aiGatewayFunction);
    apiKeysSecret.grantRead(this.aiGatewayFunction);
    this.audioAssetsBucket.grantReadWrite(this.aiGatewayFunction);
    this.aiGenerationQueue.grantSendMessages(this.aiGatewayFunction);
    this.aiGenerationQueue.grantConsumeMessages(this.aiGatewayFunction);
    ocrProcessingQueue.grantConsumeMessages(this.aiGatewayFunction);

    // SQS event sources
    this.aiGatewayFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(ocrProcessingQueue, {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(10),
        reportBatchItemFailures: true,
      }),
    );

    this.aiGatewayFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.aiGenerationQueue, {
        batchSize: 2,
        maxBatchingWindow: cdk.Duration.seconds(30),
        reportBatchItemFailures: true,
      }),
    );

    // Log group
    new logs.LogGroup(this, 'AiGatewayLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-ai-gateway',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'AudioAssetsBucketName', { value: this.audioAssetsBucket.bucketName });
    new cdk.CfnOutput(this, 'AiGenerationQueueUrl', { value: this.aiGenerationQueue.queueUrl });
  }
}
