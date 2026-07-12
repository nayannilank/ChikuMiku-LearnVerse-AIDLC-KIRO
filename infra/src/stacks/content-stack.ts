import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ContentStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbCluster: rds.DatabaseCluster;
  apiKeysSecret: secretsmanager.ISecret;
  lambdaSecurityGroup: ec2.ISecurityGroup;
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

    const { vpc, dbCluster, apiKeysSecret } = props;

    // S3 bucket for page images
    this.pageImagesBucket = new s3.Bucket(this, 'PageImagesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SQS queue for OCR processing
    this.ocrProcessingQueue = new sqs.Queue(this, 'OcrProcessingQueue', {
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

    // Content Lambda
    this.contentFunction = new lambda.Function(this, 'ContentFunction', {
      functionName: 'learnverse-content',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DB_SECRET_ARN: dbCluster.secret?.secretArn ?? '',
        DB_CLUSTER_ENDPOINT: dbCluster.clusterEndpoint.hostname,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        PAGE_IMAGES_BUCKET: this.pageImagesBucket.bucketName,
        OCR_QUEUE_URL: this.ocrProcessingQueue.queueUrl,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    // Permissions
    dbCluster.secret?.grantRead(this.contentFunction);
    this.pageImagesBucket.grantReadWrite(this.contentFunction);
    this.ocrProcessingQueue.grantSendMessages(this.contentFunction);

    // Log group
    new logs.LogGroup(this, 'ContentLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-content',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'PageImagesBucketName', { value: this.pageImagesBucket.bucketName });
    new cdk.CfnOutput(this, 'OcrQueueUrl', { value: this.ocrProcessingQueue.queueUrl });
  }
}
