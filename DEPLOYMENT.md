# Deployment Guide

ChikuMiku LearnVerse deploys its backend to **AWS** (via CDK) and its web frontend to **Vercel**.

## Architecture

```
┌────────────────┐         ┌─────────────────────────────────┐
│  Vercel (Web)  │──API──▶ │  AWS (Backend)                  │
│  React SPA     │         │  API Gateway → Lambda → Aurora  │
└────────────────┘         │  S3, SQS, SNS, Cognito          │
                           └─────────────────────────────────┘
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Vercel CLI (`npm install -g vercel`)
- GitHub repository with Actions enabled

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM Role ARN for OIDC-based GitHub Actions deployment |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## CI/CD Pipelines

### CI (`ci.yml`)
Runs on every push and PR:
- TypeScript type checking
- Full test suite (1,416 tests including property-based tests)
- CDK synth validation
- Web client Vite build

### Deploy (`deploy.yml`)
Triggered on push to `main` or manual dispatch:
1. Runs tests
2. Deploys backend via `cdk deploy`
3. Deploys web client to Vercel
4. Runs post-deploy health checks

### Destroy (`destroy.yml`)
Manual workflow for tearing down staging:
- Requires typing "destroy" for confirmation
- Production destruction is blocked

## Local Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start web dev server
cd clients/web && npm run dev
```

## Manual Deployment

### Backend (AWS)

```bash
# Build everything
npm run build

# Deploy infrastructure
cd infra
npx cdk diff          # Preview changes
npx cdk deploy        # Deploy stack
```

### Web Frontend (Vercel)

```bash
# Link project (first time only)
vercel link

# Deploy preview
vercel deploy

# Deploy production
vercel deploy --prod
```

## Environment Variables

### Vercel (set in Vercel Dashboard → Settings → Environment Variables)

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | CDK output `RestApiUrl` | Production |
| `VITE_API_BASE_URL` | CDK staging output | Preview |

### AWS (managed by CDK)

All Lambda environment variables are configured in the CDK stack. Third-party API keys are stored in AWS Secrets Manager (`learnverse/third-party-api-keys`).

## First-Time Setup

1. **Bootstrap CDK** (once per AWS account/region):
   ```bash
   cd infra
   npx cdk bootstrap aws://ACCOUNT_ID/ap-south-1
   ```

2. **Deploy backend**:
   ```bash
   npx cdk deploy --outputs-file cdk-outputs.json
   ```

3. **Set Vercel env vars** from CDK outputs:
   ```bash
   # Extract the API URL
   cat cdk-outputs.json | jq -r '.ChikuMikuLearnVerseStack.RestApiUrl'
   # Set it in Vercel dashboard as VITE_API_BASE_URL
   ```

4. **Deploy web**:
   ```bash
   vercel deploy --prod
   ```

5. **Populate Secrets Manager** with actual API keys in the AWS Console.

6. **Run database migrations** against Aurora:
   ```bash
   # Connect to Aurora via bastion or VPN, then run:
   psql -h <cluster-endpoint> -U postgres -d learnverse -f infra/migrations/001_enable_extensions.sql
   psql -h <cluster-endpoint> -U postgres -d learnverse -f infra/migrations/002_create_tables.sql
   psql -h <cluster-endpoint> -U postgres -d learnverse -f infra/migrations/003_create_indexes.sql
   ```

## Updating the API URL in Vercel

After each backend deployment, the API Gateway URL may change (if the stack is recreated). Update Vercel:

1. Check CDK outputs: `cat infra/cdk-outputs.json`
2. Update `VITE_API_BASE_URL` in Vercel Dashboard
3. Trigger a redeployment: `vercel deploy --prod`

Alternatively, use a custom domain with API Gateway to avoid URL changes.
