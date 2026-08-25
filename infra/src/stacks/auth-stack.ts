import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  databaseSecret: secretsmanager.ISecret;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  apiKeysSecret: secretsmanager.ISecret;
}

/**
 * Authentication stack — registration, login, OTP, password reset, lockout.
 */
export class AuthStack extends cdk.Stack {
  public readonly authFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { databaseSecret, userPool, userPoolClient, apiKeysSecret } = props;

    this.authFunction = new lambdaNodejs.NodejsFunction(this, 'AuthFunction', {
      functionName: 'learnverse-auth',
      entry: path.join(__dirname, '../../../services/auth/src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        DATABASE_SECRET_ARN: databaseSecret.secretArn,
        API_KEYS_SECRET_ARN: apiKeysSecret.secretArn,
        // Names the AwsCognitoClient reads (COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID).
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    databaseSecret.grantRead(this.authFunction);

    // Cognito operations used by the auth service: provisioning users
    // (AdminCreateUser / AdminSetUserPassword), login (InitiateAuth), and
    // logout (GlobalSignOut). Scoped to this user pool.
    this.authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:InitiateAuth',
          'cognito-idp:GlobalSignOut',
        ],
        resources: [userPool.userPoolArn],
      })
    );

    new logs.LogGroup(this, 'AuthLambdaLogGroup', {
      logGroupName: `/aws/lambda/${this.authFunction.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
