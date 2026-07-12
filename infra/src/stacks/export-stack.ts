import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ExportStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbCluster: rds.DatabaseCluster;
  apiKeysSecret: secretsmanager.ISecret;
  lambdaSecurityGroup: ec2.ISecurityGroup;
}

/**
 * Export stack — PDF/CSV report generation for parents.
 */
export class ExportStack extends cdk.Stack {
  public readonly exportFunction: lambda.Function;
  public readonly exportFilesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ExportStackProps) {
    super(scope, id, props);

    const { vpc, dbCluster, apiKeysSecret } = props;

    // S3 bucket for export files (30-day lifecycle)
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

    // Export Lambda
    this.exportFunction = new lambda.Function(this, 'ExportFunction', {
      functionName: 'learnverse-export',
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
        EXPORT_FILES_BUCKET: this.exportFilesBucket.bucketName,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    // Permissions
    dbCluster.secret?.grantRead(this.exportFunction);
    this.exportFilesBucket.grantReadWrite(this.exportFunction);

    // Log group
    new logs.LogGroup(this, 'ExportLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-export',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ExportFilesBucketName', { value: this.exportFilesBucket.bucketName });
  }
}
