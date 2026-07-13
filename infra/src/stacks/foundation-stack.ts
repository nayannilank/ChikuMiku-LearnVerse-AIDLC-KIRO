import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Foundation stack — shared infrastructure used by all other stacks.
 *
 * Contains: VPC, Aurora Serverless PostgreSQL (pgvector), Cognito User Pool,
 * and Secrets Manager for third-party API keys.
 */
export class FoundationStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly dbCluster: rds.DatabaseCluster;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly apiKeysSecret: secretsmanager.ISecret;
  /** Security group that Lambdas should join to access the DB */
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — AZs hardcoded to avoid ec2:DescribeAvailabilityZones API call during synth
    this.vpc = new ec2.Vpc(this, 'LearnVerseVpc', {
      availabilityZones: ['ap-south-1a', 'ap-south-1b'],
      natGateways: 1,
    });

    // Shared security group for all Lambda functions that need DB access
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSharedSG', {
      vpc: this.vpc,
      description: 'Shared security group for Lambda functions needing DB access',
      allowAllOutbound: true,
    });

    // Aurora Serverless v2 PostgreSQL with pgvector
    this.dbCluster = new rds.DatabaseCluster(this, 'LearnVerseDb', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('Writer'),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      defaultDatabaseName: 'learnverse',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Allow the shared Lambda SG to access Aurora
    this.dbCluster.connections.allowDefaultPortFrom(this.lambdaSecurityGroup);

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'LearnVerseUserPool', {
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

    this.userPoolClient = this.userPool.addClient('LearnVerseAppClient', {
      authFlows: { userPassword: true, userSrp: true },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.minutes(60),
    });

    // Secrets Manager for third-party API keys
    this.apiKeysSecret = new secretsmanager.Secret(this, 'ThirdPartyApiKeys', {
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

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId, exportName: 'LearnVerse-VpcId' });
    new cdk.CfnOutput(this, 'DbClusterEndpoint', { value: this.dbCluster.clusterEndpoint.hostname, exportName: 'LearnVerse-DbEndpoint' });
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId, exportName: 'LearnVerse-UserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId, exportName: 'LearnVerse-UserPoolClientId' });
  }
}
