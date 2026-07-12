import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  dbCluster: rds.DatabaseCluster;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  apiKeysSecret: secretsmanager.ISecret;
  lambdaSecurityGroup: ec2.ISecurityGroup;
}

/**
 * Authentication stack — handles registration, login, OTP, password reset, lockout.
 */
export class AuthStack extends cdk.Stack {
  public readonly authFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { vpc, dbCluster, userPool, userPoolClient, apiKeysSecret } = props;

    this.authFunction = new lambda.Function(this, 'AuthFunction', {
      functionName: 'learnverse-auth',
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
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    });

    // Permissions
    dbCluster.secret?.grantRead(this.authFunction);

    // Log group
    new logs.LogGroup(this, 'AuthLambdaLogGroup', {
      logGroupName: '/aws/lambda/learnverse-auth',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
