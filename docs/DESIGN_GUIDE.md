# ChikuMiku LearnVerse — Design & Architecture Guide

A comprehensive reference for the design system, component library, architecture, data model, and AI services powering ChikuMiku LearnVerse.

---

## Table of Contents

- [Design Tokens](#design-tokens)
- [Component Library](#component-library)
- [Subject Color Mapping](#subject-color-mapping)
- [Screen Layouts & Responsiveness](#screen-layouts--responsiveness)
- [Branding](#branding)
- [Architecture Overview](#architecture-overview)
- [Data Model](#data-model)
- [API Design Patterns](#api-design-patterns)
- [AI Services](#ai-services)
- [Correctness Properties](#correctness-properties)

---

## Design Tokens

All tokens are defined in `clients/web/src/theme/uiTheme.ts`.

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `pink` | `#E94F9B` | Primary brand, Maths subject |
| `purple` | `#9B59B6` | Secondary brand, Kannada subject |
| `blue` | `#5DADE2` | Accent, English subject |
| `gold` | `#F7C948` | Highlights, achievements |
| `green` | `#27AE60` | Success states, Science subject |
| `red` | `#E74C3C` | Errors, destructive actions |
| `dark` | `#2C2341` | Dark backgrounds, hero sections |
| `hindi` | `#E5A100` | Hindi subject |
| `computers` | `#4A6CF7` | Computers subject |
| `evs` | `#E67E22` | EVS subject |
| `bg` | `#F8F5FF` | Page background (light lavender) |
| `white` | `#FFFFFF` | Card backgrounds |
| `border` | `#E0D8EC` | Subtle borders |
| `text` | `#333333` | Primary text |
| `textLight` | `#777777` | Secondary text |
| `textMuted` | `#999999` | Placeholder text |

### Light Variants (Backgrounds)

| Token | Hex | Usage |
|-------|-----|-------|
| `pinkLight` | `#FDE8F4` | Maths card background |
| `purpleLight` | `#F3E8F9` | Kannada card background |
| `blueLight` | `#E8F6FD` | English card background |
| `goldLight` | `#FFF8E1` | Hindi card background |
| `greenLight` | `#E8F8EE` | Science card background |
| `redLight` | `#FDEDEC` | Error background |
| `computersLight` | `#EBF0FF` | Computers card background |
| `evsLight` | `#FFF0E0` | EVS card background |

### Typography

```typescript
fonts: {
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sizes: {
    xs: 10,    // Captions, badges
    sm: 12,    // Small labels
    md: 14,    // Body text
    lg: 16,    // Subheadings
    xl: 18,    // Section titles
    xxl: 22,   // Page titles
    hero: 28,  // Hero headings
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
}
```

### Spacing

```typescript
spacing: {
  xs: 4,     // Tight gaps
  sm: 8,     // Icon padding
  md: 12,    // Standard padding
  lg: 16,    // Card padding
  xl: 20,    // Section gaps
  xxl: 24,   // Large sections
  xxxl: 32,  // Page margins
}
```

### Border Radii

```typescript
borderRadius: {
  small: 10,    // Small elements
  input: 8,     // Input fields
  card: 16,     // Cards and panels
  button: 22,   // Buttons
  pill: 20,     // Pill badges
  circle: 50,   // Avatars, icons
}
```

### Shadows

```typescript
shadows: {
  card: '0 2px 10px rgba(0, 0, 0, 0.05)',        // Default card elevation
  elevated: '0 6px 24px rgba(0, 0, 0, 0.1)',      // Modals, dropdowns
  button: '0 4px 12px rgba(233, 79, 155, 0.3)',   // Primary button glow
}
```

### Gradients

```typescript
gradients: {
  primary: 'linear-gradient(135deg, #E94F9B, #9B59B6)',  // Pink to purple
  dark: 'linear-gradient(135deg, #2C2341, #9B59B6)',     // Dark to purple
  blue: 'linear-gradient(135deg, #5DADE2, #9B59B6)',     // Blue to purple
  hero: 'linear-gradient(180deg, #2C2341 0%, #4A2068 50%, #F8F5FF 100%)', // Hero section
}
```

---

## Component Library

The UI component library uses inline styles driven by the theme tokens above.

### Core Components

| Component | Description | Key Props |
|-----------|-------------|-----------|
| **Button** | Primary CTA with gradient background and glow shadow | `variant`, `size`, `disabled`, `loading` |
| **Card** | Elevated container with rounded corners | `padding`, `elevated`, `onClick` |
| **Input** | Text field with label, validation error, and icon support | `label`, `error`, `icon`, `type` |
| **ProgressBar** | Horizontal progress indicator with animated fill | `value`, `max`, `color`, `label` |
| **Badge** | Pill-shaped status indicator | `text`, `color`, `variant` |
| **Avatar** | Circular image/initials with border | `src`, `name`, `size` |
| **SubjectCard** | Subject icon + name with colored background | `subject`, `onClick` |
| **StreakCounter** | Flame icon with streak number | `count`, `isActive` |
| **OfflineBanner** | Top banner indicating offline state | — |
| **SyncIndicator** | Shows sync status after reconnection | `syncState` |
| **ProtectedRoute** | Route wrapper for authentication | `allowedRoles` |

### Interaction Patterns

- Buttons use `borderRadius.button` (22px) for a rounded pill shape
- Cards use `borderRadius.card` (16px) with `shadows.card` elevation
- Active/selected states use the subject's primary color
- Loading states show a subtle pulse animation
- Errors display inline with `colors.red` text below the input

---

## Subject Color Mapping

Each subject has a dedicated icon, primary color, and light background:

| Subject | Icon | Color | Background |
|---------|------|-------|------------|
| Maths | `calculator` | `#E94F9B` (pink) | `#FDE8F4` |
| Science | `flask` | `#27AE60` (green) | `#E8F8EE` |
| English | `spell-check` | `#5DADE2` (blue) | `#E8F6FD` |
| Hindi | `om` | `#E5A100` (hindi) | `#FFF8E1` |
| Kannada | `language` | `#9B59B6` (purple) | `#F3E8F9` |
| Computers | `laptop-code` | `#4A6CF7` (computers) | `#EBF0FF` |
| EVS | `leaf` | `#E67E22` (evs) | `#FFF0E0` |

Custom subjects default to the `purple` color scheme.

---

## Screen Layouts & Responsiveness

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, bottom navigation, full-width cards |
| Tablet | 768–1024px | Two-column grid, side navigation collapses |
| Desktop | > 1024px | Three-column grid, persistent side navigation |

### Layout Patterns

- **Dashboard**: Tree navigator (left panel) + Detail panel (right) on tablet/desktop; stacked on mobile
- **Content Capture**: Full-screen camera view with overlay controls
- **Quiz/Exercise**: Single question per screen with progress bar at top
- **Explanations**: Scrollable content with sticky audio player bar

### Navigation

- **Mobile**: Bottom tab bar (Dashboard, Add Chapter, Learn, Profile)
- **Tablet/Desktop**: Left sidebar with expandable subject tree
- **All**: Breadcrumb navigation for deep content paths (Subject → Book → Chapter → Page)

---

## Branding

### Logo

- Primary mark: "ChikuMiku" wordmark with playful gradient (pink → purple)
- Icon mark: Stylized open book with sparkle/star elements
- Minimum clear space: 8px around all sides

### Tagline

> **Where Curiosity Comes Alive**

### Gradient Patterns

- Hero sections use the `hero` gradient (dark purple → mid purple → light lavender)
- CTA buttons use the `primary` gradient (pink → purple, 135°)
- Dark mode accents use the `dark` gradient

### Voice & Tone

- Friendly, encouraging, age-appropriate
- Short sentences, active voice
- Celebrates effort over results ("Great job practicing today!" not "You scored 80%")

---

## Architecture Overview

### System Architecture (8 CDK Stacks)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                   │
│  ┌──────────────────┐    ┌──────────────────┐                       │
│  │  React Web App   │    │  React Native    │                       │
│  │  (Vercel CDN)    │    │  (Android APK)   │                       │
│  └────────┬─────────┘    └────────┬─────────┘                       │
└───────────┼───────────────────────┼─────────────────────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Layer (LearnVerse-Api)                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  API Gateway (REST + WebSocket)  │  CloudWatch Alarms        │   │
│  └────────────────────┬─────────────┴───────────────────────────┘   │
│                       │                                              │
│  ┌────────────────────┴─────────────────────────────────────────┐   │
│  │  Amazon Cognito (JWT validation)                              │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Compute Layer (Lambdas)                           │
│                                                                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │  Auth   │  │ Content  │  │ Learning │  │AI Gateway│  │Export │ │
│  │ Lambda  │  │  Lambda  │  │  Lambda  │  │  Lambda  │  │Lambda │ │
│  └─────────┘  └──────────┘  └──────────┘  └──────────┘  └───────┘ │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Layer                                      │
│                                                                      │
│  ┌──────────────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  Neon PostgreSQL │  │ S3 (3x)  │  │  AWS Secrets Manager     │  │
│  │  + pgvector      │  │ images,  │  │  (DB URL, API keys)      │  │
│  │                  │  │ audio,   │  │                          │  │
│  │                  │  │ exports  │  │                          │  │
│  └──────────────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Stack Dependencies

```
Foundation ──┬──→ Auth ──────────────────────┐
             ├──→ Content ──────────────┐    │
             ├──→ AiGateway (depends on Content)│
             ├──→ Learning ─────────────┤    │
             └──→ Export ───────────────┤    │
                                        ▼    ▼
Frontend ──────────────────────────→ Api (depends on all)
```

---

## Data Model

### Entity Relationship Diagram

```
Parent (1) ───── (N) Learner
  │                    │
  │                    ├── (N) Book ──── (N) Chapter ──── (N) Page
  │                    │                      │               │
  │                    │                      ├── (N) RevisionQuestion
  │                    │                      ├── (N) GrammarExercise
  │                    │                      ├── (N) PronunciationAsset
  │                    │                      ├── (N) Embedding
  │                    │                      └── (N) QASession
  │                    │
  │                    ├── (N) QuizAttempt
  │                    └── (N) ActivityLog
  │
  └── (N) Subject (custom, linked to parent)

Subject (default, no parent link) ──── shared across all learners
```

### Key Entities

| Entity | Description | Key Fields |
|--------|-------------|------------|
| **Parent** | Adult user managing learner profiles | `username` (unique), `full_name`, `phone`, `email`, `password_hash` |
| **Learner** | Student user (LKG–12th) | `username` (unique), `grade`, `school_name`, `subjects` (JSONB), `current_streak`, `longest_streak` |
| **Subject** | Default (7) or custom per-parent | `name`, `is_default`, `parent_id` |
| **Book** | A textbook within a subject per learner | `name`, `learner_id`, `subject_id` |
| **Chapter** | Unit of content within a book | `chapter_number`, `chapter_name`, `ai_assets_generated`, `academic_year` |
| **Page** | OCR-captured page (content or exercise) | `page_number`, `classification`, `image_s3_key`, `transcript_text`, `detected_language` |
| **Explanation** | AI-generated summary per page | `summary`, `keywords`, `concepts`, `audio_s3_key` |
| **RevisionQuestion** | AI-generated quiz question | `difficulty`, `question_type`, `question_data`, `correct_answer` |
| **QuizAttempt** | Learner's quiz session record | `score_percentage`, `time_taken_seconds`, `correct_answers` |
| **GrammarExercise** | AI-generated grammar exercise | `exercise_type`, `exercise_data`, `grammar_rule` |
| **PronunciationAsset** | TTS audio for words/sentences | `word_or_sentence`, `audio_s3_key`, `language` |
| **ActivityLog** | Tracks all learner activities | `activity_type`, `local_date`, `metadata` |
| **Embedding** | pgvector chunks for RAG | `content`, `embedding` (vector 1536d), `chunk_index` |
| **QASession** | Interactive Q&A conversation | `question_count`, `context_history` (JSONB) |

### Database Features

- **UUID primary keys** via `uuid-ossp`
- **pgvector** with HNSW index for fast cosine similarity search
- **Soft deletes** on parent/learner (via `deleted_at`)
- **JSONB** for flexible data (subjects, question data, context history)
- **Composite indexes** on hot paths (learner+date for streaks, learner+chapter for quizzes)

---

## API Design Patterns

### REST API

- Base URL: `https://api.chikumiku-learnverse.com/v1/`
- All endpoints require JWT Bearer token (except `/auth/register/parent`, `/auth/login`, `/auth/forgot-password`)
- Responses follow standard envelope: `{ "success": boolean, "data": T, "error": string? }`

### Authentication (Cognito + JWT)

- Cognito User Pool for identity management
- JWT tokens with 30-day session persistence
- Role claim embedded in token (`parent` or `learner`)
- ProtectedRoute component validates role on frontend
- API Gateway authorizer validates JWT on backend

### Key Endpoints

```
POST   /auth/register/parent
POST   /auth/register/learner
POST   /auth/login
POST   /auth/forgot-password
POST   /auth/verify-otp
POST   /auth/reset-password

GET    /content/subjects
GET    /content/books/:subjectId
POST   /content/chapters
POST   /content/pages/upload
GET    /content/chapters/:id

POST   /ai/ocr/process
GET    /ai/explanations/:pageId
POST   /ai/pronunciation/score
POST   /ai/grammar/generate
POST   /ai/qa/ask
POST   /ai/revision/generate

GET    /learning/dashboard
GET    /learning/progress/:learnerId
GET    /learning/streak/:learnerId

POST   /export/report
GET    /export/download/:reportId
```

### Error Handling

- `400` — Validation error (field-specific messages)
- `401` — Unauthenticated
- `403` — Unauthorized (wrong role)
- `404` — Resource not found
- `429` — Rate limited
- `500` — Internal server error

---

## AI Services

All AI interactions are routed through the **AI Gateway Lambda** for unified control.

### Service Routing

| Feature | External Service | Model/API |
|---------|-----------------|-----------|
| OCR (text extraction) | Google Cloud | Vision OCR API |
| Explanations | OpenAI | GPT-5 Mini |
| Grammar exercises | OpenAI | GPT-5 Mini |
| Revision quizzes | OpenAI | GPT-5 Mini |
| Q&A (RAG) | OpenAI | GPT-5 Mini + pgvector retrieval |
| Pronunciation audio | Google Cloud | Text-to-Speech API |
| Pronunciation scoring | OpenAI | Whisper STT |
| Embeddings | OpenAI | text-embedding-3-small (1536d) |

### Caching Strategy (Generate-Once-Serve-Forever)

Once AI assets are generated for a chapter, they are stored permanently:

- **Explanations** → `explanation` table (text) + S3 (audio)
- **Revision questions** → `revision_question` table
- **Grammar exercises** → `grammar_exercise` table
- **Pronunciation audio** → `pronunciation_asset` table + S3
- **Embeddings** → `embedding` table with HNSW index

The `chapter.ai_assets_generated` flag prevents redundant generation.

### RAG Pipeline (Q&A)

1. Learner asks a question about a chapter
2. Question is embedded using `text-embedding-3-small`
3. pgvector HNSW index retrieves top-5 most relevant paragraph chunks from that chapter
4. Retrieved chunks + question are sent to GPT-5 Mini
5. Response is returned with source page references
6. Conversation context is maintained in `qa_session.context_history`

### Async Processing

- **OCR Queue (SQS)**: Page images are queued for background OCR processing
- **AI Generation Queue (SQS)**: After all pages are captured, AI asset generation is triggered asynchronously
- **Notifications (SNS)**: Streak milestones, progress updates sent to parents

---

## Correctness Properties

The project uses property-based testing (fast-check) to verify 20 key invariants:

### Validation Properties

1. **Username format** — Only valid usernames (8–15 chars, `[a-z0-9_-]`) pass validation
2. **Password strength** — Passwords meeting all 4 criteria (upper, lower, digit, special) pass validation
3. **Phone format** — Only exactly 10-digit strings pass validation
4. **Email format** — Valid emails up to 30 characters pass validation
5. **Name format** — Only 5–20 char alphabetic+space strings pass validation

### Streak Properties

6. **Monotonic increment** — Streak only increases by exactly 1 per active day
7. **Reset after 2 missed days** — Streak resets to 0 after 2 consecutive inactive days
8. **Single-day miss tolerance** — Missing exactly 1 day does not reset streak
9. **Never negative** — Streak count is always ≥ 0
10. **Longest streak tracking** — Longest streak is always ≥ current streak

### Content Properties

11. **Chapter number uniqueness** — No two chapters in the same book share a number
12. **Page count bounds** — Content pages ≤ 50, exercise pages ≤ 20 per chapter
13. **Book count bounds** — ≤ 50 books per subject
14. **Learner count bounds** — ≤ 10 learners per parent

### Score Properties

15. **Score percentage bounds** — Quiz scores are always 0–100%
16. **Correct ≤ Total** — Correct answers never exceed total questions
17. **Time non-negative** — Quiz time taken is always ≥ 0

### AI/RAG Properties

18. **Embedding dimension** — All embeddings are exactly 1536 dimensions
19. **RAG retrieval count** — Top-K retrieval returns ≤ 5 chunks
20. **Idempotent generation** — Re-generating assets for a chapter with `ai_assets_generated=true` is a no-op

---

*For implementation details, see [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md). For user-facing documentation, see [USER_GUIDE.md](./USER_GUIDE.md).*
