#!/usr/bin/env node
/**
 * CDK App entry point for ChikuMiku LearnVerse infrastructure.
 */
import * as cdk from 'aws-cdk-lib';
import { LearnVerseStack } from './stacks/learnverse-stack';

const app = new cdk.App();

new LearnVerseStack(app, 'ChikuMikuLearnVerseStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-south-1',
  },
  description: 'ChikuMiku LearnVerse - AI-powered learning platform infrastructure',
});

app.synth();
