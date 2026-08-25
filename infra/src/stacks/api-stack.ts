import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  authFunction: lambda.Function;
  contentFunction: lambda.Function;
  learningFunction: lambda.Function;
  aiGatewayFunction: lambda.Function;
  exportFunction: lambda.Function;
  /** Cognito user pool backing the JWT authorizer for protected routes. */
  userPool: cognito.IUserPool;
}

/**
 * API stack — REST API Gateway, WebSocket API, Cognito authorizer, CloudWatch alarms.
 */
export class ApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      authFunction, contentFunction,
      learningFunction, aiGatewayFunction, exportFunction,
      userPool,
    } = props;

    // REST API
    this.restApi = new apigateway.RestApi(this, 'LearnVerseRestApi', {
      restApiName: 'LearnVerse API',
      description: 'ChikuMiku LearnVerse REST API',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 500,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type', 'Authorization', 'X-Api-Key',
          'X-Amz-Date', 'X-Amz-Security-Token',
        ],
      },
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            conditions: { Bool: { 'aws:SecureTransport': 'false' } },
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

    // Domain name with TLS 1.2+ enforcement
    // Uncomment and configure when you have a real domain + ACM certificate:
    // new apigateway.DomainName(this, 'ApiDomainName', {
    //   domainName: 'api.learnverse.yourdomain.com',
    //   certificate: acm.Certificate.fromCertificateArn(this, 'ApiCert', 'arn:aws:acm:...'),
    //   securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    // });

    // Cognito authorizer — validates the JWT (from the Authorization header)
    // against the user pool and injects verified claims into
    // event.requestContext.authorizer.claims, which the Lambdas read for
    // identity (sub, cognito:username, custom:role).
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'LearnVerseCognitoAuthorizer',
    });

    /** Method options that require a valid Cognito JWT. */
    const authorized: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const authIntegration = new apigateway.LambdaIntegration(authFunction);
    const contentIntegration = new apigateway.LambdaIntegration(contentFunction);
    const learnIntegration = new apigateway.LambdaIntegration(learningFunction);
    const aiIntegration = new apigateway.LambdaIntegration(aiGatewayFunction);
    const exportIntegration = new apigateway.LambdaIntegration(exportFunction);

    // /auth/* — mostly PUBLIC (login, register/parent, and the password-reset
    // flow must be reachable without a token). Only the routes that act on an
    // authenticated session are protected: register/learner and logout.
    const authResource = this.restApi.root.addResource('auth');
    const registerResource = authResource.addResource('register');
    // POST /auth/register/parent — public
    registerResource.addResource('parent').addMethod('POST', authIntegration);
    // POST /auth/register/learner — requires an authenticated parent
    registerResource.addResource('learner').addMethod('POST', authIntegration, authorized);
    // POST /auth/logout — requires an authenticated session
    authResource.addResource('logout').addMethod('POST', authIntegration, authorized);
    // All other /auth/* routes (login, forgot-password, verify-otp,
    // reset-password) stay public via the proxy.
    authResource.addProxy({
      defaultIntegration: authIntegration,
      anyMethod: true,
    });

    // /content/* — protected
    const contentResource = this.restApi.root.addResource('content');
    contentResource.addMethod('ANY', contentIntegration, authorized);
    const contentProxy = contentResource.addProxy({
      defaultIntegration: contentIntegration,
      anyMethod: false,
    });
    contentProxy.addMethod('ANY', contentIntegration, authorized);

    // /learn/* — protected
    const learnResource = this.restApi.root.addResource('learn');
    learnResource.addMethod('ANY', learnIntegration, authorized);
    const learnProxy = learnResource.addProxy({
      defaultIntegration: learnIntegration,
      anyMethod: false,
    });
    learnProxy.addMethod('ANY', learnIntegration, authorized);

    // /ai/* — protected
    const aiResource = this.restApi.root.addResource('ai');
    aiResource.addMethod('ANY', aiIntegration, authorized);
    const aiProxy = aiResource.addProxy({
      defaultIntegration: aiIntegration,
      anyMethod: false,
    });
    aiProxy.addMethod('ANY', aiIntegration, authorized);

    // /export/* — protected
    const exportResource = this.restApi.root.addResource('export');
    exportResource.addMethod('ANY', exportIntegration, authorized);
    const exportProxy = exportResource.addProxy({
      defaultIntegration: exportIntegration,
      anyMethod: false,
    });
    exportProxy.addMethod('ANY', exportIntegration, authorized);

    // WebSocket API for real-time updates
    const webSocketApi = new apigatewayv2.CfnApi(this, 'LearnVerseWebSocketApi', {
      name: 'LearnVerse WebSocket API',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: webSocketApi.ref,
      stageName: 'v1',
      autoDeploy: true,
    });

    // CloudWatch Alarms
    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      alarmName: 'learnverse-api-5xx-errors',
      alarmDescription: 'Alarm when API Gateway 5xx error rate exceeds threshold',
      metric: this.restApi.metricServerError({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
      alarmName: 'learnverse-api-4xx-errors',
      alarmDescription: 'Alarm when API Gateway 4xx error rate exceeds threshold',
      metric: this.restApi.metricClientError({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 100,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    // Outputs
    new cdk.CfnOutput(this, 'RestApiUrl', { value: this.restApi.url, exportName: 'LearnVerse-RestApiUrl' });
    new cdk.CfnOutput(this, 'WebSocketApiId', { value: webSocketApi.ref });
  }
}
