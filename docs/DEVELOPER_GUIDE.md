# ChikuMiku LearnVerse — Developer Guide

Technical guide for engineers working on the ChikuMiku LearnVerse platform.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Architecture Overview](#architecture-overview)
- [Running Tests](#running-tests)
- [Adding New Features](#adding-new-features)
- [Deployment Process](#deployment-process)
- [Environment Variables & Secrets](#environment-variables--secrets)
- [Database Migrations](#database-migrations)
- [Debugging Tips](#debugging-tips)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Runtime for all packages |
| npm | 10+ | Package manager (workspaces) |
| AWS CLI | v2 | Infrastructure deployment |
| AWS CDK | Latest | Infrastructure as Code |
| Vercel CLI | Latest | Frontend deployment |
| TypeScript | 5.4 | Type system |
| Git | Latest | Version control |

Optional:
- **psql** — For running database migrations directly against Neon
- **Docker** — Not required (serverless architecture)

---

## Project Structure

This is an npm workspaces monorepo. All packages live under a single `package.json` at the root.

```
ChikuMiku-LearnVerse-AIDLC-KIRO/
├── package.json                    # Root workspace config
├── tsconfig.json                   # TypeScript project references
├── vercel.json                     # Vercel deployment config
├── jest.config.ts                  # Root Jest config
│
├── shared/
│   ├── types/                      # Shared TypeScript interfaces & types
│   └── validation/                 # Shared validation schemas (Zod)
│
├── services/
│   ├── auth/                       # Authentication Lambda service
│   ├── content/                    # Content ingestion Lambda service
│   ├── learning/                   # Progress, streaks, dashboard Lambda
│   ├── ai-gateway/                 # AI routing Lambda (OCR, TTS, GPT, etc.)
│   └── export/                     # Report generation Lambda service
│
├── clients/
│   ├── web/                        # React 19 + Vite web app
│   │   ├── src/
│   │   │   ├── pages/              # Route pages
│   │   │   ├── components/         # Reusable UI components
│   │   │   ├── theme/              # Design tokens & theme
│   │   │   ├── context/            # React contexts (Auth, Network)
│   │   │   ├── hooks/              # Custom hooks
│   │   │   └── services/           # API client layer
│   │   └── vite.config.ts
│   └── mobile/                     # React Native / Capacitor mobile app
│
├── infra/
│   ├── src/
│   │   ├── app.ts                  # CDK app entry point (8 stacks)
│   │   └── stacks/                 # Individual CDK stack definitions
│   └── migrations/
│       └── neon-init.sql           # Full database schema
│
├── docs/                           # Documentation (you are here)
│
└── .github/
    └── workflows/
        ├── ci.yml                  # CI: lint, build, test
        ├── deploy.yml              # CD: deploy backend to AWS
        └── destroy.yml             # Teardown infrastructure
```

### Workspace Packages

```json
"workspaces": [
  "shared/types",
  "shared/validation",
  "infra",
  "services/auth",
  "services/content",
  "services/learning",
  "services/ai-gateway",
  "services/export",
  "clients/web",
  "clients/mobile"
]
```

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ChikuMiku-LearnVerse-AIDLC-KIRO
```

### 2. Install Dependencies

```bash
npm install
```

This installs all workspace dependencies in one go.

### 3. Build All Packages

```bash
npm run build
```

This runs `tsc --build` with project references, building all packages in dependency order.

### 4. Start the Web Dev Server

```bash
cd clients/web
npx vite dev
```

The dev server starts at `http://localhost:5173` by default.

### 5. Run Tests

```bash
npm test
```

---

## Architecture Overview

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Neon PostgreSQL** | Serverless Postgres with native pgvector support. No VPC needed, scales to zero, branching for dev/staging. |
| **AWS Lambda** | Pay-per-invocation, auto-scaling, no server management. Each service is a single Lambda for simplicity. |
| **Vercel (Frontend)** | Zero-config React deployments, edge CDN, preview deployments for PRs. |
| **CDK for Infra** | Type-safe infrastructure, same language (TypeScript) as application code. |
| **Single AI Gateway** | All AI calls (GPT, Whisper, Vision OCR, TTS, Embeddings) go through one service for unified rate limiting, caching, and cost tracking. |
| **Generate-Once-Serve-Forever** | AI assets are cached permanently after first generation, reducing LLM costs by ~70%. |
| **RAG for Q&A** | pgvector retrieves top-5 relevant chunks instead of sending full chapters to the LLM. |
| **Offline-First** | Learner content is persisted locally (IndexedDB) with background sync on reconnection. |

### Infrastructure Stacks (CDK)

The CDK app deploys 8 stacks to `ap-south-1`:

1. **LearnVerse-Foundation** — Cognito User Pool, Secrets Manager (Neon DB URL + API keys)
2. **LearnVerse-Frontend** — S3 + CloudFront for web app hosting
3. **LearnVerse-Auth** — Authentication Lambda (registration, login, OTP)
4. **LearnVerse-Content** — Content Lambda, page images S3 bucket, OCR processing queue (SQS)
5. **LearnVerse-AiGateway** — AI Gateway Lambda, audio assets S3, AI generation queue (SQS)
6. **LearnVerse-Learning** — Dashboard/progress Lambda, SNS notifications
7. **LearnVerse-Export** — Report generation Lambda, export files S3
8. **LearnVerse-Api** — API Gateway (REST + WebSocket), CloudWatch alarms

### External Services

| Service | Purpose |
|---------|---------|
| Google Vision OCR | Text extraction from textbook page images |
| GPT-5 Mini (OpenAI) | Explanations, grammar exercises, quiz generation, Q&A |
| Whisper (OpenAI) | Speech-to-text for pronunciation scoring |
| Google TTS | Text-to-speech for pronunciation audio |
| OpenAI Embeddings | text-embedding-3-small (1536d) for RAG |

---

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Property-Based Tests

The project uses [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. These tests live alongside unit tests and verify invariants like:

- Validation schemas accept/reject correctly across all inputs
- Streak logic behaves correctly for any sequence of activity days
- Score calculations are always within bounds
- Data transformations are reversible where expected

```typescript
import fc from 'fast-check';

test('username validation', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      // Property: validation never throws, always returns boolean
      const result = validateUsername(input);
      expect(typeof result).toBe('boolean');
    })
  );
});
```

---

## Adding New Features

### Where to Put Code

| What you're building | Where it goes |
|---------------------|---------------|
| New API endpoint | `services/<service-name>/src/` |
| New web page/route | `clients/web/src/pages/` |
| New UI component | `clients/web/src/components/` |
| Shared types/interfaces | `shared/types/src/` |
| Validation schemas | `shared/validation/src/` |
| New CDK resource | `infra/src/stacks/` |
| Database migration | `infra/migrations/` |

### Service Organization

Each Lambda service follows this pattern:

```
services/auth/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Lambda handler entry point
│   ├── routes/           # Route handlers
│   ├── services/         # Business logic
│   ├── repositories/     # Database access
│   └── utils/            # Helpers
└── tests/
    ├── unit/             # Unit tests
    └── property/         # Property-based tests
```

### Adding a New API Route

1. Add the route handler in the appropriate service under `src/routes/`.
2. Add business logic in `src/services/`.
3. Add database queries in `src/repositories/`.
4. Add shared types to `shared/types/` if needed.
5. Add validation schemas to `shared/validation/`.
6. Write tests (unit + property-based).
7. Update the API Gateway routing in `infra/src/stacks/api-stack.ts` if needed.

---

## Deployment Process

### Automated (Recommended)

Pushing to `main` triggers the full deployment pipeline:

1. **GitHub Actions** (`.github/workflows/deploy.yml`):
   - Checks out code
   - Installs dependencies (`npm ci`)
   - Builds all packages (`npm run build`)
   - Assumes AWS IAM role via OIDC
   - Runs `cdk deploy --all` in `ap-south-1`
   - Uploads CDK outputs as artifacts

2. **Vercel** (automatic):
   - Detects push to `main`
   - Runs `npm install --include=dev`
   - Builds: `cd clients/web && npx vite build`
   - Deploys `clients/web/dist/` to edge CDN
   - API calls are proxied via rewrites to `api.chikumiku-learnverse.com`

### Manual Deployment

```bash
# Backend (CDK)
cd infra
npx cdk deploy --all --require-approval never --outputs-file cdk-outputs.json

# Frontend (Vercel)
vercel deploy --prod
```

---

## Environment Variables & Secrets

### Local Development

Create a `.env` file at the project root (see `.env.example`):

```env
# Neon Database
DATABASE_URL=postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/learnverse?sslmode=require

# AWS
AWS_REGION=ap-south-1

# AI Services
OPENAI_API_KEY=sk-...
GOOGLE_VISION_API_KEY=...
GOOGLE_TTS_API_KEY=...

# Cognito
COGNITO_USER_POOL_ID=ap-south-1_xxxxx
COGNITO_CLIENT_ID=...

# Frontend
VITE_API_BASE_URL=http://localhost:3000
```

### Production Secrets (AWS Secrets Manager)

Secrets are stored in AWS Secrets Manager and injected into Lambda environments:

- `learnverse/database-url` — Neon PostgreSQL connection string
- `learnverse/api-keys` — JSON blob with all external API keys

These are referenced by the Foundation stack and shared with all service stacks.

### Vercel Environment Variables

Set these in the Vercel dashboard:
- `VITE_API_BASE_URL` — Production API Gateway URL

---

## Database Migrations

The database schema is managed via a single SQL script.

### Running Migrations

```bash
psql "postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/learnverse?sslmode=require" \
  -f infra/migrations/neon-init.sql
```

### Schema Overview

Key entities: `parent`, `learner`, `subject`, `book`, `chapter`, `page`, `explanation`, `revision_question`, `quiz_attempt`, `grammar_exercise`, `pronunciation_asset`, `activity_log`, `embedding`, `qa_session`.

The schema uses:
- **uuid-ossp** for UUID primary keys
- **pgvector** for embedding storage and HNSW similarity search
- Soft deletes via `deleted_at` columns on parent/learner
- JSONB for flexible data (subjects list, question data, context history)

### Adding New Migrations

For now, modifications should be added as new SQL files in `infra/migrations/` and applied manually. If a migration requires data changes, wrap it in a transaction (`BEGIN; ... COMMIT;`).

---

## Debugging Tips

### Lambda Logs

```bash
# View logs for a specific Lambda
aws logs tail /aws/lambda/LearnVerse-Auth-AuthFunction --follow --region ap-south-1

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/LearnVerse-AiGateway-AiGatewayFunction \
  --filter-pattern "ERROR" \
  --region ap-south-1
```

### CDK Issues

```bash
# Synthesize without deploying (check for errors)
cd infra && npx cdk synth

# Diff what would change
cd infra && npx cdk diff
```

### Database Debugging

```bash
# Connect to Neon directly
psql "postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/learnverse?sslmode=require"

# Check recent activity
SELECT * FROM activity_log ORDER BY "timestamp" DESC LIMIT 20;

# Check a learner's streak
SELECT username, current_streak, last_active_date FROM learner WHERE username = 'test-learner';
```

### Frontend Debugging

- **React DevTools** — Inspect component tree and context values
- **Network tab** — Check API calls and responses
- **Vite HMR** — Changes reflect instantly during development
- Check `VITE_API_BASE_URL` is set correctly for API proxy

### Common Issues

| Issue | Solution |
|-------|----------|
| `Cannot find module` after npm install | Run `npm run build` to compile TypeScript project references |
| CDK deploy fails with credential error | Re-authenticate with `aws sso login` or check IAM role |
| Vercel build fails | Ensure `clients/web` builds independently: `cd clients/web && npx vite build` |
| Database connection timeout | Check Neon endpoint is active (auto-suspends after inactivity) |
| OCR returns empty text | Verify image quality and Google Vision API key is valid |
| Tests fail with `fast-check` timeout | Increase `numRuns` or simplify generators |

---

*For architecture details and design decisions, see [DESIGN_GUIDE.md](./DESIGN_GUIDE.md).*
