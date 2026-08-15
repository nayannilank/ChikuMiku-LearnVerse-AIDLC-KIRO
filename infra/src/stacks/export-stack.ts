import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ExportStackProps extends cdk.StackProps {
  databaseSecret: secretsmanager.ISecret;
  apiKeysSecret: secretsmanager.ISecret;
}

/**
 * Export stack — PDF/CSV report generation for parents.
 */
export class ExportStack extends cdk.Stack {
  public readonly exportFunction: lambda.Function;
  public readonly exportFilesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ExportStackProps) {
    super(scope, id, props);

    const { databaseSecret, apiKeysSecret } = props;

    this.exportFilesBucket = new s3.Bucket(this, 'ExportFilesBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        { expiration: cdk.Duration.days(30), id: 'ExpireExportsAfter30Days' },
      ],
    });

    this.exportFunction = new lambdaNodejs.NodejsFunction(this, 'ExportFunction', {
      functionName: 'learnverse-export',
      entry: path.join(__dirname, '../../../services/export/src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        EXPORT_FILES_BUCKET: this.exportFilesBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    databaseSecret.grantRead(this.exportFunction);
    this.exportFilesBucket.grantReadWrite(this.exportFunction);

    new logs.LogGroup(this, 'ExportLambdaLogGroup', {
      logGroupName: `/aws/lambda/${this.exportFunction.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'ExportFilesBucketName', { value: this.exportFilesBucket.bucketName });
  }
}
