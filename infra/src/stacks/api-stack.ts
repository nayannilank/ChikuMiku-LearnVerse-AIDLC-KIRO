import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  authFunction: lambda.Function;
  contentFunction: lambda.Function;
  learningFunction: lambda.Function;
  aiGatewayFunction: lambda.Function;
  exportFunction: lambda.Function;
  cloudFrontDomain: string;
}

/**
 * API stack — REST API Gateway, WebSocket API, Cognito authorizer, CloudWatch alarms.
 */
export class ApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      userPool, authFunction, contentFunction,
      learningFunction, aiGatewayFunction, exportFunction, cloudFrontDomain,
    } = props;

    // Web client origin for CORS
    const webClientOrigin = `https://${cloudFrontDomain}`;

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
        allowOrigins: [webClientOrigin],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type', 'Authorization', 'X-Api-Key',
          'X-Amz-Date', 'X-Amz-Security-Token',
        ],
        allowCredentials: true,
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
    new apigateway.DomainName(this, 'ApiDomainName', {
      domainName: `api.learnverse.example.com`,
      certificate: acm.Certificate.fromCertificateArn(
        this, 'ApiCert',
        `arn:aws:acm:${this.region}:${this.account}:certificate/placeholder`,
      ),
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    // Cognito authorizer
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'LearnVerseCognitoAuthorizer',
    });

    const authorizedMethodOptions: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // /auth/* — NO Cognito auth (login/register don't have tokens)
    const authResource = this.restApi.root.addResource('auth');
    authResource.addMethod('ANY', new apigateway.LambdaIntegration(authFunction));
    authResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(authFunction),
      anyMethod: true,
    });

    // /content/* — Cognito authorized
    const contentResource = this.restApi.root.addResource('content');
    contentResource.addMethod('ANY', new apigateway.LambdaIntegration(contentFunction), authorizedMethodOptions);
    const contentProxy = contentResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(contentFunction),
      anyMethod: false,
    });
    contentProxy.addMethod('ANY', new apigateway.LambdaIntegration(contentFunction), authorizedMethodOptions);

    // /learn/* — Cognito authorized
    const learnResource = this.restApi.root.addResource('learn');
    learnResource.addMethod('ANY', new apigateway.LambdaIntegration(learningFunction), authorizedMethodOptions);
    const learnProxy = learnResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(learningFunction),
      anyMethod: false,
    });
    learnProxy.addMethod('ANY', new apigateway.LambdaIntegration(learningFunction), authorizedMethodOptions);

    // /ai/* — Cognito authorized
    const aiResource = this.restApi.root.addResource('ai');
    aiResource.addMethod('ANY', new apigateway.LambdaIntegration(aiGatewayFunction), authorizedMethodOptions);
    const aiProxy = aiResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(aiGatewayFunction),
      anyMethod: false,
    });
    aiProxy.addMethod('ANY', new apigateway.LambdaIntegration(aiGatewayFunction), authorizedMethodOptions);

    // /export/* — Cognito authorized
    const exportResource = this.restApi.root.addResource('export');
    exportResource.addMethod('ANY', new apigateway.LambdaIntegration(exportFunction), authorizedMethodOptions);
    const exportProxy = exportResource.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(exportFunction),
      anyMethod: false,
    });
    exportProxy.addMethod('ANY', new apigateway.LambdaIntegration(exportFunction), authorizedMethodOptions);

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
