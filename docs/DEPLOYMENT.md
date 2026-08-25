# Deployment Guide

ChikuMiku LearnVerse deploys its backend to **AWS** (via CDK) and its web frontend to **Vercel**.

## Architecture

```
┌────────────────┐         ┌───────────────────────────────────────┐
│  Vercel (Web)  │──API──▶ │  AWS (Backend)                        │
│  React SPA     │         │  API Gateway → Lambda → Neon Postgres │
└────────────────┘         │  S3, SQS, SNS, Cognito, SES           │
                           └───────────────────────────────────────┘
```

> The database is **Neon PostgreSQL** (serverless, external to AWS, reached over
> the public internet — no VPC or bastion required). Email/SMS for the
> password-reset flow use **SES** (email) and **SNS** (SMS).

## Prerequisites

- Node.js 22+
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
- Full test suite (1,600+ tests including property-based tests)
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

Most Lambda environment variables are configured in the CDK stacks, including
`DATABASE_SECRET_ARN`, `API_KEYS_SECRET_ARN`, and (for the auth service)
`COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID`. Third-party API keys and the Neon
connection string live in AWS Secrets Manager (`learnverse/third-party-api-keys`
and `learnverse/database-url`).

Two auth-service variables are operator-configurable (set them on the auth
Lambda, e.g. via the console or by extending the auth stack):

| Variable | Purpose | Default |
|----------|---------|---------|
| `SES_FROM_ADDRESS` | Verified SES sender for password-reset OTP emails | *(required for email OTP)* |
| `RESET_REQUEST_WINDOW_MINUTES` | Min interval between reset requests per user | `30` |

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

5. **Populate Secrets Manager** with actual values in the AWS Console:
   - `learnverse/third-party-api-keys` — JSON blob with `GOOGLE_VISION_API_KEY`,
     `GOOGLE_TTS_API_KEY`, `OPENAI_API_KEY` (Whisper uses the OpenAI key).
   - `learnverse/database-url` — the Neon connection string (`DATABASE_URL`, and
     optionally `DATABASE_URL_UNPOOLED`).

5a. **Configure Amazon SES/SNS for the password-reset flow**:
   - Verify a sender identity in **SES** and set `SES_FROM_ADDRESS` on the auth
     Lambda to that verified address. If your SES account is still in the
     sandbox, either move it to production or verify each recipient address.
   - **SNS** SMS requires no identity, but check your account's SMS spending
     limit / sandbox destination numbers in the target region.
   - Optionally set `RESET_REQUEST_WINDOW_MINUTES` on the auth Lambda to change
     the one-request-per-user reset window (defaults to 30 minutes).

   > The auth Lambda also receives `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`
   > automatically from the CDK stacks — no manual step needed.

6. **Run database migrations** against Neon. Neon's pooled endpoint is public
   (no bastion/VPN needed); use the connection string stored in the
   `learnverse/database-url` secret.

   The simplest path is the single idempotent init script, which creates every
   table + index and seeds the default subjects:
   ```bash
   psql "$DATABASE_URL" -f infra/migrations/neon-init.sql
   ```

   Or apply the numbered migrations in order (equivalent schema):
   ```bash
   psql "$DATABASE_URL" -f infra/migrations/001_enable_extensions.sql
   psql "$DATABASE_URL" -f infra/migrations/002_create_tables.sql
   psql "$DATABASE_URL" -f infra/migrations/003_create_indexes.sql
   psql "$DATABASE_URL" -f infra/migrations/004_auth_flow_tables.sql   # parental_consent, otp_record, password_reset_token
   ```

## Updating the API URL in Vercel

After each backend deployment, the API Gateway URL may change (if the stack is recreated). Update Vercel:

1. Check CDK outputs: `cat infra/cdk-outputs.json`
2. Update `VITE_API_BASE_URL` in Vercel Dashboard
3. Trigger a redeployment: `vercel deploy --prod`

Alternatively, use a custom domain with API Gateway to avoid URL changes.
