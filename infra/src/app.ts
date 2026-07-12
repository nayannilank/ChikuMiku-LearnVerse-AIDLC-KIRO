#!/usr/bin/env node
/**
 * CDK App entry point for ChikuMiku LearnVerse infrastructure.
 *
 * Stacks are split by functional flow:
 * 1. Foundation — VPC, Aurora, Cognito, Secrets Manager
 * 2. Frontend — S3 + CloudFront for web app
 * 3. Auth — Authentication Lambda
 * 4. Content — Content ingestion Lambda, page images S3, OCR queue
 * 5. AI Gateway — AI routing Lambda, audio S3, AI generation queue
 * 6. Learning — Dashboard/progress Lambda, SNS notifications
 * 7. Export — Report generation Lambda, export files S3
 * 8. API — API Gateway (REST + WebSocket), CloudWatch alarms
 */
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from './stacks/foundation-stack';
import { FrontendStack } from './stacks/frontend-stack';
import { AuthStack } from './stacks/auth-stack';
import { ContentStack } from './stacks/content-stack';
import { AiGatewayStack } from './stacks/ai-gateway-stack';
import { LearningStack } from './stacks/learning-stack';
import { ExportStack } from './stacks/export-stack';
import { ApiStack } from './stacks/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-south-1',
};

// 1. Foundation — shared infrastructure
const foundation = new FoundationStack(app, 'LearnVerse-Foundation', {
  env,
  description: 'ChikuMiku LearnVerse — VPC, Aurora PostgreSQL, Cognito, Secrets',
});

// 2. Frontend — web app hosting
const frontend = new FrontendStack(app, 'LearnVerse-Frontend', {
  env,
  description: 'ChikuMiku LearnVerse — CloudFront + S3 web hosting',
});

// 3. Auth service
const auth = new AuthStack(app, 'LearnVerse-Auth', {
  env,
  description: 'ChikuMiku LearnVerse — Authentication service',
  vpc: foundation.vpc,
  dbCluster: foundation.dbCluster,
  userPool: foundation.userPool,
  userPoolClient: foundation.userPoolClient,
  apiKeysSecret: foundation.apiKeysSecret,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
});
auth.addDependency(foundation);

// 4. Content ingestion service
const content = new ContentStack(app, 'LearnVerse-Content', {
  env,
  description: 'ChikuMiku LearnVerse — Content ingestion service',
  vpc: foundation.vpc,
  dbCluster: foundation.dbCluster,
  apiKeysSecret: foundation.apiKeysSecret,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
});
content.addDependency(foundation);

// 5. AI Gateway service
const aiGateway = new AiGatewayStack(app, 'LearnVerse-AiGateway', {
  env,
  description: 'ChikuMiku LearnVerse — AI Gateway service',
  vpc: foundation.vpc,
  dbCluster: foundation.dbCluster,
  apiKeysSecret: foundation.apiKeysSecret,
  ocrProcessingQueue: content.ocrProcessingQueue,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
});
aiGateway.addDependency(foundation);
aiGateway.addDependency(content);

// 6. Learning service
const learning = new LearningStack(app, 'LearnVerse-Learning', {
  env,
  description: 'ChikuMiku LearnVerse — Learning, progress, streaks',
  vpc: foundation.vpc,
  dbCluster: foundation.dbCluster,
  apiKeysSecret: foundation.apiKeysSecret,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
});
learning.addDependency(foundation);

// 7. Export service
const exportStack = new ExportStack(app, 'LearnVerse-Export', {
  env,
  description: 'ChikuMiku LearnVerse — Export/report generation',
  vpc: foundation.vpc,
  dbCluster: foundation.dbCluster,
  apiKeysSecret: foundation.apiKeysSecret,
  lambdaSecurityGroup: foundation.lambdaSecurityGroup,
});
exportStack.addDependency(foundation);

// 8. API Gateway — depends on all Lambdas and frontend
const api = new ApiStack(app, 'LearnVerse-Api', {
  env,
  description: 'ChikuMiku LearnVerse — API Gateway, routing, alarms',
  userPool: foundation.userPool,
  authFunction: auth.authFunction,
  contentFunction: content.contentFunction,
  learningFunction: learning.learningFunction,
  aiGatewayFunction: aiGateway.aiGatewayFunction,
  exportFunction: exportStack.exportFunction,
  cloudFrontDomain: frontend.distribution.distributionDomainName,
});
api.addDependency(auth);
api.addDependency(content);
api.addDependency(aiGateway);
api.addDependency(learning);
api.addDependency(exportStack);
api.addDependency(frontend);

app.synth();
