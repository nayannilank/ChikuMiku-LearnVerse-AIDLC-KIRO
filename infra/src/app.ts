#!/usr/bin/env node
/**
 * CDK App entry point for ChikuMiku LearnVerse infrastructure.
 *
 * Stacks are split by functional flow:
 * 1. Foundation — Cognito, Secrets Manager (Neon DB URL + API keys)
 * 2. Auth — Authentication Lambda
 * 3. Content — Content ingestion Lambda, page images S3, OCR queue
 * 4. AI Gateway — AI routing Lambda, audio S3, AI generation queue
 * 5. Learning — Dashboard/progress Lambda, SNS notifications
 * 6. Export — Report generation Lambda, export files S3
 * 7. API — API Gateway (REST + WebSocket), CloudWatch alarms
 *
 * Frontend: Hosted on Vercel (not AWS)
 * Database: Neon PostgreSQL (external, no VPC needed)
 */
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from './stacks/foundation-stack';
import { AuthStack } from './stacks/auth-stack';
import { ContentStack } from './stacks/content-stack';
import { AiGatewayStack } from './stacks/ai-gateway-stack';
import { LearningStack } from './stacks/learning-stack';
import { ExportStack } from './stacks/export-stack';
import { ApiStack } from './stacks/api-stack';

const app = new cdk.App();

// Single production environment — ap-south-1
const env = { region: 'ap-south-1' };

// 1. Foundation — Cognito + Secrets
const foundation = new FoundationStack(app, 'LearnVerse-Foundation', {
  env,
  description: 'ChikuMiku LearnVerse — Cognito, Secrets Manager',
});

// 2. Auth service
const auth = new AuthStack(app, 'LearnVerse-Auth', {
  env,
  description: 'ChikuMiku LearnVerse — Authentication service',
  databaseSecret: foundation.databaseSecret,
  userPool: foundation.userPool,
  userPoolClient: foundation.userPoolClient,
  apiKeysSecret: foundation.apiKeysSecret,
});
auth.addDependency(foundation);

// 3. Content ingestion service
const content = new ContentStack(app, 'LearnVerse-Content', {
  env,
  description: 'ChikuMiku LearnVerse — Content ingestion service',
  databaseSecret: foundation.databaseSecret,
  apiKeysSecret: foundation.apiKeysSecret,
});
content.addDependency(foundation);

// 4. AI Gateway service
const aiGateway = new AiGatewayStack(app, 'LearnVerse-AiGateway', {
  env,
  description: 'ChikuMiku LearnVerse — AI Gateway service',
  databaseSecret: foundation.databaseSecret,
  apiKeysSecret: foundation.apiKeysSecret,
  ocrProcessingQueue: content.ocrProcessingQueue,
});
aiGateway.addDependency(foundation);
aiGateway.addDependency(content);

// 5. Learning service
const learning = new LearningStack(app, 'LearnVerse-Learning', {
  env,
  description: 'ChikuMiku LearnVerse — Learning, progress, streaks',
  databaseSecret: foundation.databaseSecret,
  apiKeysSecret: foundation.apiKeysSecret,
});
learning.addDependency(foundation);

// 6. Export service
const exportStack = new ExportStack(app, 'LearnVerse-Export', {
  env,
  description: 'ChikuMiku LearnVerse — Export/report generation',
  databaseSecret: foundation.databaseSecret,
  apiKeysSecret: foundation.apiKeysSecret,
});
exportStack.addDependency(foundation);

// 7. API Gateway — depends on all Lambda stacks
const api = new ApiStack(app, 'LearnVerse-Api', {
  env,
  description: 'ChikuMiku LearnVerse — API Gateway, routing, alarms',
  authFunction: auth.authFunction,
  contentFunction: content.contentFunction,
  learningFunction: learning.learningFunction,
  aiGatewayFunction: aiGateway.aiGatewayFunction,
  exportFunction: exportStack.exportFunction,
  userPool: foundation.userPool,
});
api.addDependency(auth);
api.addDependency(content);
api.addDependency(aiGateway);
api.addDependency(learning);
api.addDependency(exportStack);

app.synth();
