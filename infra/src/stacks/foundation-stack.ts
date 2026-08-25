import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Foundation stack — shared infrastructure.
 *
 * Contains: Cognito User Pool, Secrets Manager (API keys + Neon DB connection string).
 * No VPC needed — Lambdas connect to Neon PostgreSQL over the public internet
 * using connection pooling.
 */
export class FoundationStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly apiKeysSecret: secretsmanager.ISecret;
  /** Secret holding the Neon PostgreSQL connection string */
  public readonly databaseSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
      // Custom attributes surfaced as JWT claims. `role` distinguishes
      // parent/learner; `appUserId` carries the application DB id (parent.id /
      // learner.id) so services can look up records — the Cognito `sub` is a
      // different value from the DB id. Mutable so they can be set after
      // creation if needed.
      customAttributes: {
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 16, mutable: true }),
        appUserId: new cognito.StringAttribute({ minLen: 1, maxLen: 64, mutable: true }),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('LearnVerseAppClient', {
      // userPassword enables the USER_PASSWORD_AUTH flow used by /auth/login.
      authFlows: { userPassword: true, userSrp: true },
      accessTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.minutes(60),
    });

    // Neon PostgreSQL connection string (set manually in AWS Console after deploy)
    // Format: postgresql://user:password@ep-xyz.ap-south-1.aws.neon.tech/learnverse?sslmode=require
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseConnectionString', {
      secretName: 'learnverse/database-url',
      description: 'Neon PostgreSQL connection string (pooled endpoint with pgvector)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          DATABASE_URL: '',
          DATABASE_URL_UNPOOLED: '',
        }),
        generateStringKey: 'placeholder',
      },
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
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId, exportName: 'LearnVerse-UserPoolId' });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId, exportName: 'LearnVerse-UserPoolClientId' });
    new cdk.CfnOutput(this, 'DatabaseSecretArn', { value: this.databaseSecret.secretArn });
    new cdk.CfnOutput(this, 'ApiKeysSecretArn', { value: this.apiKeysSecret.secretArn });
  }
}
