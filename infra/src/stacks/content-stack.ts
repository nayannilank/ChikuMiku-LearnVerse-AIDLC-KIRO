import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ContentStackProps extends cdk.StackProps {
  databaseSecret: secretsmanager.ISecret;
  apiKeysSecret: secretsmanager.ISecret;
}

/**
 * Content ingestion stack — chapter CRUD, page images, OCR orchestration, transcripts.
 */
export class ContentStack extends cdk.Stack {
  public readonly contentFunction: lambda.Function;
  public readonly pageImagesBucket: s3.Bucket;
  public readonly ocrProcessingQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ContentStackProps) {
    super(scope, id, props);

    const { databaseSecret, apiKeysSecret } = props;

    this.pageImagesBucket = new s3.Bucket(this, 'PageImagesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.ocrProcessingQueue = new sqs.Queue(this, 'OcrProcessingQueue', {
      queueName: 'learnverse-ocr-processing',
      visibilityTimeout: cdk.Duration.seconds(180),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'OcrProcessingDlq', {
          queueName: 'learnverse-ocr-processing-dlq',
          retentionPeriod: cdk.Duration.days(14),
        }),
        maxReceiveCount: 3,
      },
    });

    this.contentFunction = new lambdaNodejs.NodejsFunction(this, 'ContentFunction', {
      functionName: 'learnverse-content',
      entry: path.join(__dirname, '../../../services/content/src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        PAGE_IMAGES_BUCKET: this.pageImagesBucket.bucketName,
        OCR_QUEUE_URL: this.ocrProcessingQueue.queueUrl,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    databaseSecret.grantRead(this.contentFunction);
    this.pageImagesBucket.grantReadWrite(this.contentFunction);
    this.ocrProcessingQueue.grantSendMessages(this.contentFunction);

    new logs.LogGroup(this, 'ContentLambdaLogGroup', {
      logGroupName: `/aws/lambda/${this.contentFunction.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'PageImagesBucketName', { value: this.pageImagesBucket.bucketName });
    new cdk.CfnOutput(this, 'OcrQueueUrl', { value: this.ocrProcessingQueue.queueUrl });
  }
}
