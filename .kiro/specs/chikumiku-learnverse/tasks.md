# Implementation Plan: ChikuMiku LearnVerse

## Overview

This plan implements the ChikuMiku LearnVerse platform — a subject-agnostic AI-powered learning system on AWS serverless infrastructure. Implementation uses TypeScript across all layers (shared validation, Node.js Lambdas, React web, React Native Android). Tasks are ordered to establish infrastructure and shared modules first, then core services, then AI features, and finally client applications.

## Tasks

- [x] 1. Project setup and infrastructure foundation
  - [x] 1.1 Initialize monorepo structure with shared packages
    - Create workspace with packages: `shared/validation`, `shared/types`, `infra`, `services/auth`, `services/content`, `services/learning`, `services/ai-gateway`, `services/export`, `clients/web`, `clients/mobile`
    - Configure TypeScript project references across packages
    - Set up fast-check as testing framework for property-based tests
    - Set up Jest for unit and integration testing
    - _Requirements: 24.1, 24.11_

  - [x] 1.2 Define core TypeScript interfaces and types
    - Create shared type definitions: `ParentRegistrationRequest`, `LearnerRegistrationRequest`, `LoginRequest`, `ValidationResult`, `APIError`, `ChapterCreateRequest`, `PageUpload`, `TranscriptPage`
    - Create AI-related types: `AIRequest`, `CacheCheckResult`, `ExplanationResult`, `PronunciationScore`, `SyllableResult`, `QARequest`, `RAGContext`
    - Create learning types: `StreakData`, `ProgressPercentage`, `DashboardTreeNode`, `ActivityRecord`
    - Create export/notification types: `ExportRequest`, `NotificationPayload`
    - _Requirements: 1.1, 2.1, 3.1, 6.1, 7.2, 9.1, 10.4, 12.2, 14.1, 15.1_

  - [x] 1.3 Create AWS CDK infrastructure-as-code stack
    - Define Aurora Serverless PostgreSQL cluster with pgvector extension
    - Define S3 buckets (page-images, audio-assets, export-files)
    - Define Cognito User Pool with JWT configuration (60-min expiry)
    - Define API Gateway (REST + WebSocket)
    - Define Lambda functions (Auth, Content, Learning, AI Gateway, Export) with appropriate memory allocations
    - Define SQS queues (OCR processing, AI generation)
    - Define SNS topics (streak alerts, progress notifications)
    - Define CloudFront distribution for web app
    - Define Secrets Manager for third-party API keys
    - Define CloudWatch log groups and alarms
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 24.10, 24.11, 24.12_

  - [x] 1.4 Create database schema migrations
    - Write SQL migrations for all entities: Parent, Learner, Subject, Book, Chapter, Page, Explanation, Revision_Question, Quiz_Attempt, Grammar_Exercise, Pronunciation_Asset, Activity_Log, Embedding (with vector type), QA_Session
    - Include indexes, unique constraints (username), soft-delete columns (deleted_at), academic_year column
    - Enable pgvector extension and create HNSW index on embedding column
    - _Requirements: 1.4, 2.1, 20.5, 21.4, 21.5_

- [x] 2. Shared validation module
  - [x] 2.1 Implement field validators as pure functions
    - `validateUsername`: 8-15 chars, [a-z0-9_-]
    - `validateFullName`: 5-20 chars, [a-zA-Z ] (also used for learner Name)
    - `validatePhone`: exactly 10 digits
    - `validateEmail`: valid email format, max 30 chars
    - `validatePassword`: 8-20 chars, 1 upper, 1 lower, 1 digit, 1 special from !@#$%^&*
    - `validateBookName`: 3-50 chars, [a-zA-Z0-9 :-]
    - `validateChapterName`: 3-100 chars, [a-zA-Z0-9 :-]
    - `validateSubjectName`: 1-50 chars for custom subjects
    - `validateSchoolName`: 5-30 chars, [a-zA-Z0-9, -]
    - All validators return `ValidationResult` with field-specific error messages
    - _Requirements: 1.1, 1.3, 2.1, 2.5, 4.2, 6.1, 16.2, 16.3, 17.2, 17.7_

  - [x] 2.2 Write property test for field validation (Property 1)
    - **Property 1: Field Validation Correctness**
    - Use fast-check to generate arbitrary strings and verify validators accept if and only if input matches defined format rules
    - Test all 9 field types with random valid and invalid inputs
    - **Validates: Requirements 1.1, 1.3, 2.1, 2.5, 4.2, 6.1, 16.2, 16.3, 17.2, 17.7**

  - [x] 2.3 Implement file upload validator
    - `validateFileUpload(format: string, sizeBytes: number)`: accepts JPEG/PNG/HEIC ≤ 10MB, returns rejection reason (format or size)
    - _Requirements: 7.2, 7.3_

  - [x] 2.4 Write property test for file upload validation (Property 3)
    - **Property 3: File Upload Validation**
    - Generate random format strings and file sizes, verify acceptance iff format ∈ {jpeg, png, heic} AND size ≤ 10,485,760
    - Verify correct rejection reason returned
    - **Validates: Requirements 7.2, 7.3**

  - [x] 2.5 Implement question length constraint validator
    - `validateQuestionLength(question: string)`: reject if length > 500 chars before any AI processing
    - _Requirements: 12.6_

  - [x] 2.6 Write property test for question length constraint (Property 11)
    - **Property 11: Question Length Constraint Validation**
    - Generate random strings of varying lengths, verify rejection for > 500 chars
    - **Validates: Requirements 12.6**

  - [x] 2.7 Implement timer validator
    - `validateTimer(minutes: number)`: accept iff multiple of 5 AND 5 ≤ T ≤ 120
    - _Requirements: 13.3_

  - [x] 2.8 Write property test for timer validation (Property 12)
    - **Property 12: Revision Quiz Timer Validation**
    - Generate random integers, verify acceptance iff divisible by 5 and within [5, 120]
    - **Validates: Requirements 13.3**

- [x] 3. Checkpoint - Ensure all validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Streak and progress calculation modules
  - [x] 4.1 Implement streak calculator (shared client + server)
    - `calculateStreak(activityDays: string[])`: compute current streak from ordered date array
    - `shouldReset(lastActiveDate: string, currentDate: string)`: true if 2+ consecutive days without activity
    - `shouldIncrement(activityDays: string[], currentDate: string)`: true if current date adds to streak
    - Streak increments by 1 per consecutive active day, allows single-gap day without reset, resets to 0 on 2+ gap days
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 4.2 Write property test for streak calculation (Property 2)
    - **Property 2: Streak Calculation Consistency**
    - Generate ordered date sequences, verify: (a) increments by exactly 1 for each consecutive or single-gap day, (b) resets to 0 on 2+ day gap, (c) never decreases during consecutive active days
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 4.3 Implement score calculator
    - `calculateScorePercentage(correct: number, total: number)`: returns floor((correct / total) × 100)
    - _Requirements: 11.6, 13.9_

  - [x] 4.4 Write property test for exercise score calculation (Property 10)
    - **Property 10: Exercise Score Calculation**
    - Generate random C and N where 0 ≤ C ≤ N and N ≥ 1, verify result equals floor((C/N) × 100)
    - **Validates: Requirements 11.6**

  - [x] 4.5 Implement progress aggregator
    - Track per-chapter: attempt count, highest score, most recent score
    - `aggregateProgress(attempts: QuizAttempt[])`: correctly maintain all three metrics
    - _Requirements: 13.10, 14.3_

  - [x] 4.6 Write property test for progress aggregation (Property 13)
    - **Property 13: Progress Tracking Aggregation**
    - Generate sequences of quiz attempts, verify: (a) attempt count = total attempts, (b) highest = max score, (c) most recent = last attempt's score
    - **Validates: Requirements 13.10, 14.3**

  - [x] 4.7 Implement parent dashboard completion calculator
    - `calculateParentCompletion(pagesRead: number, totalPages: number)`: floor((R/T) × 100)
    - `calculateExerciseCompletion(correct: number, total: number)`: floor((A/Q) × 100)
    - _Requirements: 14.1_

  - [x] 4.8 Write property test for parent dashboard completion (Property 14)
    - **Property 14: Parent Dashboard Completion Percentage**
    - Generate R, T where 0 ≤ R ≤ T and T ≥ 1, verify floor-based percentage
    - **Validates: Requirements 14.1**

  - [x] 4.9 Implement learner dashboard completion calculator
    - `calculateLearnerCompletion(pagesRead: number, totalPages: number)`: round((R/T) × 100)
    - `calculatePagesLeft(totalPages: number, pagesRead: number)`: T - R
    - _Requirements: 15.1, 15.2_

  - [x] 4.10 Write property test for learner dashboard completion (Property 15)
    - **Property 15: Learner Dashboard Completion Percentage**
    - Generate R, T where 0 ≤ R ≤ T and T ≥ 1, verify round-based percentage and pages left = T - R
    - **Validates: Requirements 15.1, 15.2**

- [x] 5. Checkpoint - Ensure all streak/progress tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Authentication service (Auth Lambda)
  - [x] 6.1 Implement parent registration endpoint
    - POST /auth/register/parent
    - Server-side validation using shared validators
    - Unique username constraint enforcement (return field-specific error on duplicate)
    - Password hashing with bcrypt (cost factor ≥ 10)
    - Success response with auto-redirect countdown (5 seconds)
    - Cognito user creation for session management
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 20.2_

  - [x] 6.2 Implement learner registration endpoint
    - POST /auth/register/learner (authenticated parent only)
    - Pre-fill parent username from authenticated session
    - Validate all fields (username, name, password, gender, relationship, grade, school, subjects)
    - Enforce unique learner username, max 10 learners per parent, min 1 subject
    - Support custom subjects (max 5 per learner, 1-50 chars each)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 6.3 Implement login endpoint with role selection
    - POST /auth/login with role, username, password
    - Validate required fields before server submission
    - Generic error message on failure (no info leakage)
    - Cognito session creation (30-day persistence) with JWT (60-min expiry)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 20.3_

  - [x] 6.4 Implement account lockout logic
    - Track consecutive failed attempts per username
    - Lock account for 15 minutes after 5 consecutive failures
    - Display lockout message without revealing which field is wrong
    - _Requirements: 3.5_

  - [x] 6.5 Write property test for account lockout (Property 19)
    - **Property 19: Account Lockout Logic**
    - Generate attempt counts 1-10, verify lockout iff attempts ≥ 5, and authentication remains available for 1-4 attempts
    - **Validates: Requirements 3.5**

  - [x] 6.6 Implement forgot password / OTP flow
    - POST /auth/forgot-password: send 6-digit OTP to registered email/phone (generic error if username not found)
    - POST /auth/verify-otp: validate OTP within 5-minute window, max 3 attempts
    - POST /auth/reset-password: set new password with same validation rules as registration
    - Invalidate OTP after 3 failed attempts or expiry
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.7 Implement logout and JWT token management
    - POST /auth/logout: terminate session, redirect to login
    - JWT validation middleware: reject expired/invalid tokens with auth error
    - Silent refresh via Cognito when JWT expires
    - _Requirements: 3.6, 20.3, 20.7_

  - [x] 6.8 Write property test for JWT token validation (Property 16)
    - **Property 16: JWT Token Validation**
    - Generate tokens with random expiration timestamps and signatures, verify rejection when expired or invalid signature
    - **Validates: Requirements 20.7**

  - [x] 6.9 Implement re-authentication for sensitive actions
    - POST /auth/verify-password: verify parent password before account deletion, data export, learner removal
    - Block sensitive action if password verification not completed
    - _Requirements: 20.4_

  - [x] 6.10 Write unit tests for auth service
    - Test registration success/failure flows
    - Test login with valid/invalid/locked credentials
    - Test OTP generation, verification, expiry
    - Test session creation and token refresh
    - _Requirements: 1.1–1.5, 2.1–2.6, 3.1–3.6, 4.1–4.6_

- [x] 7. Checkpoint - Ensure auth service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Content ingestion service (Content Lambda)
  - [x] 8.1 Implement chapter CRUD endpoints
    - POST /content/chapters: create chapter with subject, book, chapter number (1-999), chapter name
    - Validate book name (3-50 chars), chapter name (3-100 chars)
    - Enforce hierarchical limits: 1-50 books per subject, 1-100 chapters per book
    - Reject duplicate chapter numbers within same book
    - GET /content/chapters/:id: return chapter details with pages and AI status
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 8.2 Implement page upload and management
    - POST /content/chapters/:id/pages: accept image uploads (JPEG/PNG/HEIC, max 10MB)
    - Validate file format and size using shared file validator
    - Store images in S3 with structured keys
    - Enforce 1-50 content pages + 0-20 exercise pages per chapter
    - Support page operations: reorder, delete, recapture
    - Default classification as Content, allow toggle to Exercise
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 8.3 Implement OCR processing orchestration
    - POST /content/chapters/:id/process: trigger OCR via SQS queue to AI Gateway
    - Progress tracking per page with status updates
    - Handle failures: mark page as failed, allow retry, don't affect other pages
    - 30-second timeout per page with error indicator
    - _Requirements: 8.1, 8.2, 8.3, 8.7, 8.8_

  - [x] 8.4 Implement transcript storage and organization
    - PUT /content/chapters/:id/transcript: save/edit transcript
    - Organize transcript page-by-page with sequential markers (Page 1, Page 2, etc.)
    - Separate content pages from exercise pages based on learner tags
    - Allow learner to edit before saving
    - On save: persist atomically, display success only after verification
    - On transcript edit after AI generation: reset `ai_assets_generated` flag
    - _Requirements: 8.4, 8.5, 8.6, 25.2_

  - [x] 8.5 Write property test for transcript page organization (Property 4)
    - **Property 4: Transcript Page Organization**
    - Generate sets of pages with numbers and classifications, verify: (a) sequential markers, (b) content/exercise separation, (c) text preservation
    - **Validates: Requirements 8.4**

  - [x] 8.6 Write unit tests for content ingestion
    - Test chapter creation with valid/invalid inputs
    - Test page upload acceptance/rejection
    - Test OCR queue message format
    - Test transcript save atomicity
    - _Requirements: 6.1–6.3, 7.1–7.9, 8.1–8.8_

- [x] 9. AI Gateway service
  - [x] 9.1 Implement AI Gateway core with caching layer
    - Route all AI requests through single Lambda entry point
    - Cache check before any external AI call (keyed by chapter + content hash)
    - Store results in Aurora on cache miss
    - Rate limiting per learner and per AI service
    - Cost tracking per request type
    - Retrieve API keys from Secrets Manager
    - Circuit breaker with exponential backoff (3 retries on failure)
    - _Requirements: 25.1, 25.2, 25.3, 25.6_

  - [x] 9.2 Write property test for AI content caching logic (Property 18)
    - **Property 18: AI Content Caching Logic**
    - Generate chapter states (ai_assets_generated flag, transcript modified flag), verify: (a) generate when first saved and flag false, (b) serve cached when flag true and unmodified, (c) regenerate when transcript edited after generation
    - **Validates: Requirements 25.1, 25.2, 25.3**

  - [x] 9.3 Implement OCR service integration (Google Vision)
    - POST /ai/ocr: send page images to Google Vision OCR
    - Auto-detect language/script per page
    - Process within 15 seconds per page (queue with timeout)
    - Return extracted text with language metadata
    - Send only OCR text (not raw images) to LLMs for subsequent processing
    - _Requirements: 8.1, 8.3, 8.7, 19.4, 25.6_

  - [x] 9.4 Implement explanation generation (GPT-5 Mini)
    - POST /ai/explain: generate page-by-page explanations
    - Each explanation: summary (max 200 words), 3-10 keywords, 1-5 concepts
    - Adapt complexity to learner's grade level
    - Generate TTS audio via Google TTS, store in S3
    - Target 10 seconds per page generation time
    - Support all subjects (default 7 + custom)
    - _Requirements: 9.1, 9.2, 9.6, 9.7_

  - [x] 9.5 Write property test for explanation structure (Property 5)
    - **Property 5: Explanation Structure Constraints**
    - Generate explanation outputs, verify: (a) summary ≤ 200 words, (b) 3-10 keywords, (c) 1-5 concepts
    - **Validates: Requirements 9.1**

  - [x] 9.6 Implement pronunciation service (TTS + Whisper)
    - POST /ai/pronunciation/audio: generate TTS audio for 5-20 words/sentences from chapter content
    - POST /ai/pronunciation/score: transcribe learner recording via Whisper, compare against expected text
    - Scoring: overall 0-100, per-syllable color (green ≥80, yellow 40-79, red <40)
    - Max 30-second recording, results within 5 seconds
    - Support all language subjects (auto-extend for new languages)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 9.7 Write property test for pronunciation scoring (Property 7)
    - **Property 7: Pronunciation Scoring and Color Classification**
    - Generate (expected, transcribed) text pairs, verify: (a) overall score 0-100, (b) syllable colors: green ≥80, yellow [40,79], red <40
    - **Validates: Requirements 10.4, 10.5**

  - [x] 9.8 Write property test for practice item count (Property 8)
    - **Property 8: Practice Item Count Bounds**
    - Generate chapters with varying content, verify 5-20 practice items extracted
    - **Validates: Requirements 10.3**

  - [x] 9.9 Implement grammar exercise generation (GPT-5 Mini)
    - POST /ai/grammar: generate 5-10 exercises from chapter transcript
    - Exercise types: sentence building, fill-in-the-blank, word reordering, error correction
    - Language-specific grammar rules adapted to grade level
    - Handle insufficient content: generate 1-4 exercises with "limited content" message for 2-4 count
    - Feedback on submission: correct/incorrect + explanation + grammar rule (within 3 seconds)
    - Support all language subjects, auto-extend for new languages
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.7_

  - [x] 9.10 Write property test for grammar exercise bounds (Property 9)
    - **Property 9: Grammar Exercise Generation Bounds**
    - Generate chapter content of varying lengths, verify: 5-10 exercises for sufficient content; 2-4 with limited message; 1 without message
    - **Validates: Requirements 11.3, 11.7**

  - [x] 9.11 Implement Q&A with RAG (GPT-5 Mini + pgvector)
    - POST /ai/qa: accept question (1-500 chars), retrieve top-5 relevant paragraphs via vector search
    - Generate answer within 10 seconds, adapted to grade level
    - Support step-by-step breakdown for multi-step problems
    - Maintain context for up to 20 follow-up questions per session
    - Error handling: report if no relevant content found or generation fails
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 25.4_

  - [x] 9.12 Implement embedding generation for RAG
    - POST /ai/embed: split page text into ~500-token chunks, embed with text-embedding-3-small
    - Store embeddings in Aurora pgvector
    - Create embeddings when chapter transcript is first saved
    - Regenerate embeddings when transcript is edited
    - _Requirements: 25.4_

  - [x] 9.13 Implement revision quiz generation (GPT-5 Mini)
    - POST /ai/revision: generate 5-20 questions per chapter at selected difficulty (Easy/Medium/Hard)
    - Question types: MCQ (4 options, 1 correct), Fill-in-blank, True/False, Short Answer (100 chars), Long Answer (1000 chars, scored 0-100)
    - Subject-specific formats: language (Word Meaning, Sentence Forming), Maths (practical, problem-based), Computers (lab-style), Science/EVS (diagram-based)
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 9.14 Write unit tests for AI Gateway
    - Test cache hit/miss flows
    - Test circuit breaker behavior
    - Test rate limiting
    - Test error handling and retry logic
    - _Requirements: 25.1–25.6_

- [x] 10. Checkpoint - Ensure AI Gateway tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Learning service (Learning Lambda)
  - [x] 11.1 Implement dashboard data endpoints
    - GET /learn/dashboard/parent: build tree (Learner → Subject → Book → Chapter → Exercise → Quizzes) with completion percentages
    - GET /learn/dashboard/learner: build tree (Subject → Book → Chapter → Exercise → Quizzes) with completion percentages
    - Include empty state handling for no-content scenarios
    - Refresh data on each navigation/selection
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2, 15.6_

  - [x] 11.2 Implement activity recording and streak management
    - POST /learn/activity: record qualifying activity (read, exercise, quiz, pronunciation)
    - Use device-local date for streak calculation
    - Increment streak on first activity of a new calendar day
    - Update denormalized streak fields on Learner record
    - GET /learn/streak/:learnerId: return current streak, last active date, longest streak
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 11.3 Implement progress tracking
    - GET /learn/progress/:learnerId: per-chapter progress summary
    - Track: pages read, exercise scores, quiz attempts (count, highest, most recent)
    - Rule-based weak-area detection and recommendations (no LLM)
    - GET /learn/recommendations/:learnerId: return rule-based suggestions
    - _Requirements: 13.9, 13.10, 14.1, 14.2, 14.3, 15.1, 15.2, 25.5_

  - [x] 11.4 Implement revision quiz session management
    - Timer configuration (5-120 min in 5-min increments)
    - Auto-submit on timer expiry
    - Results screen: total score percentage, time taken, per-question breakdown
    - Track multiple attempts per chapter (count, highest, most recent)
    - _Requirements: 13.3, 13.9, 13.10_

  - [x] 11.5 Implement academic year content organization
    - Determine academic year from learner's grade at chapter creation
    - Current year chapters: read-write mode
    - Prior year chapters: read-only archive
    - Retain historical progress for 3+ academic years
    - _Requirements: 21.4, 21.5_

  - [x] 11.6 Write property test for academic year access mode (Property 20)
    - **Property 20: Academic Year Content Organization**
    - Generate learner grades and chapter creation dates, verify current year = read-write and prior years = read-only
    - **Validates: Requirements 21.4**

  - [x] 11.7 Write unit tests for learning service
    - Test dashboard tree construction with various data states
    - Test streak increment/reset/maintain scenarios
    - Test progress aggregation with multiple attempts
    - Test recommendation engine rules
    - _Requirements: 5.1–5.4, 13.9–13.10, 14.1–14.5, 15.1–15.6_

- [x] 12. Export and notification services
  - [x] 12.1 Implement export service (Export Lambda)
    - POST /export/report: generate PDF or CSV report for parent
    - Include: all learners' scores, completion percentages, activity history
    - Store generated file in S3, return pre-signed download URL
    - Require re-authentication before export
    - _Requirements: 17.5, 20.4_

  - [x] 12.2 Implement notification service (SNS integration)
    - Streak alert notifications to parents
    - Progress update notifications
    - Streak reminder notifications
    - Support push and email channels
    - Respect parent notification preferences (progress alerts, streak reminders)
    - _Requirements: 17.4_

  - [x] 12.3 Implement manage learners endpoints
    - GET /learners: list all learners under parent account
    - PUT /learners/:id: edit name, grade, school, subjects (same validation as registration)
    - POST /learners/:id/reset-password: set new password meeting policy
    - DELETE /learners/:id: soft delete with confirmation, atomic operation (all-or-nothing)
    - Enforce min 1 subject on edit
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 12.4 Implement parent profile and settings endpoints
    - GET /profile: return username (read-only), name, phone, email, relationship
    - PUT /profile: update name, phone, email, relationship with registration validation
    - POST /profile/change-password: require current password, validate new password format
    - PUT /profile/notifications: toggle progress alerts and streak reminders
    - POST /profile/custom-subjects: add custom subjects (1-50 chars, max 10 per account)
    - DELETE /profile: schedule account deletion (30 days), require full deletion flow (password re-entry + warning)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 13. Checkpoint - Ensure all backend service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. React web client — core setup and auth screens
  - [x] 14.1 Set up React web application with design system
    - Configure React app with TypeScript, served via CloudFront
    - Implement design system: color palette (Primary Pink #E94F9B, Secondary Purple #9B59B6, etc.)
    - System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif)
    - Pill-shaped buttons (border-radius 20-22px), cards (16px radius), badges (10px radius)
    - Responsive layout: mobile min 360px viewport, web max-width 960px+
    - Logo watermark at 75% width, 7-10% opacity
    - High contrast mode toggle (7:1 contrast ratio)
    - Touch targets: min 48×48dp on mobile
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [x] 14.2 Implement grade-based font size configuration
    - LKG-2nd: 20px web / 18px mobile
    - 3rd-5th: 18px web / 16px mobile
    - 6th-12th: 16px web / 14px mobile
    - Minimum rendered font size: 12px
    - Apply based on authenticated learner's grade
    - _Requirements: 22.1, 23.2_

  - [x] 14.3 Write property test for grade-based font size (Property 17)
    - **Property 17: Grade-Based Font Size Selection**
    - Generate all possible grade levels, verify correct font size returned for each platform
    - **Validates: Requirements 22.1**

  - [x] 14.4 Implement landing page
    - Display: logo, name "ChikuMiku LearnVerse", tagline "Where Curiosity Comes Alive"
    - Feature highlights: 7 Subjects, Pronunciation, Scan & Learn, Quizzes
    - Grade range indicator: "LKG to 12th Grade"
    - Register Now (primary CTA), Login (secondary CTA)
    - Platform indicators: Android App, Web Access
    - Safety badge: "Safe & secure for children • Parent-monitored"
    - Responsive layout (360px mobile, 960px+ web)
    - Allow authenticated users to view without forced redirect
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 14.5 Implement parent registration screen
    - Form fields: username, full name, phone, email, password
    - Client-side validation with inline field-specific errors using shared validators
    - Prevent server submission when validation errors exist
    - Success: show message + 5-second countdown auto-redirect to login
    - Handle duplicate username error (retain other form data)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 14.6 Implement login screen
    - Role selector (Parent/Learner), username, masked password, login button, forgot password link
    - Client-side validation: require role, username, password before submission
    - Generic error on auth failure (no info leakage)
    - Account lockout display (15 min after 5 failures)
    - Redirect to role-appropriate dashboard on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 14.7 Implement forgot password and OTP screens
    - Username entry → generic error if not found
    - OTP entry (6 digits, 5-min timer display, max 3 attempts)
    - New password entry with same validation rules
    - Success → redirect to login within 3 seconds
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 14.8 Implement learner registration screen
    - Pre-filled parent username (read-only)
    - All fields: username, name, password, gender (radio with icons), relationship (dropdown), grade (dropdown), school, subjects (7 default icons, all selected), add custom subjects
    - Client-side validation with inline errors
    - Enforce: min 1 subject, max 5 custom subjects per learner
    - Success confirmation within 3 seconds
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 15. React web client — dashboards and content screens
  - [x] 15.1 Implement parent dashboard
    - Left panel: tree navigation (Learner → Subject → Book → Chapter → Exercise → Quizzes)
    - Completion percentages (floor-based) on each tree item
    - Right panel: detail view on chapter click (subject icon, chapter name, reading progress, exercise score, pages read, last 10 activity log entries, last session date)
    - Aggregated summary on non-chapter items (name, total completion, total pages, last 10 activities)
    - Empty state for no-content items
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 15.2 Implement learner dashboard
    - Left panel: tree navigation (Subject → Book → Chapter → Exercise → Quizzes)
    - Completion percentages (round-based) on each tree item
    - Right panel: chapter details (name, book, subject), stats cards (Read %, Exercise %, Pages Done, Pages Left), progress bar, action buttons (Continue Reading, Take Exercise, Listen)
    - Continue Reading → explanation view at last read page (or page 1)
    - Take Exercise → chapter exercise screen
    - Listen → explanation view in speech mode at last read page (or page 1)
    - Empty state with subject tree visible
    - Display current streak count
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 5.4_

  - [x] 15.3 Implement chapter creation flow
    - Subject selection (from enrolled subjects)
    - Book selection (existing or new, 3-50 chars)
    - Chapter number (auto-suggest next, overridable 1-999)
    - Chapter name (3-100 chars)
    - Duplicate chapter number error handling
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 15.4 Implement page capture and OCR screen
    - Camera and upload input modes
    - Grid of numbered thumbnails with reorder, delete, recapture
    - Page classification toggle (Content/Exercise) on each thumbnail
    - Enforce 1-50 pages, show errors at limits
    - Done button → lock pages, navigate to OCR processing
    - OCR progress: "Extracting text from pages..." with page counter
    - Failed page indicator with retry button
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.2, 8.8_

  - [x] 15.5 Implement transcript editor and save screen
    - Display OCR results page-by-page with markers
    - Content/exercise page separation
    - Allow text editing before save
    - Save button: atomic persist, success confirmation after verification
    - Block save if any page unprocessed
    - _Requirements: 8.4, 8.5, 8.6_

  - [x] 15.6 Implement chapter explanation view
    - Page-by-page display: summary, keywords, concepts
    - Read/Listen toggle (Read default)
    - Read mode: text display of explanation
    - Listen mode: audio playback with controls (play, pause, seek)
    - Toggle from Listen to Read: stop audio
    - Previous/Next navigation with page dots
    - Disable Previous on page 1, Next on last page
    - Error state with retry on generation failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 15.7 Write property test for page navigation (Property 6)
    - **Property 6: Page Navigation Boundary Controls**
    - Generate chapters with N pages (N ≥ 1) and current page P, verify: Previous disabled iff P=1, Next disabled iff P=N
    - **Validates: Requirements 9.5**

  - [x] 15.8 Implement pronunciation practice screen
    - Display 5-20 words/sentences from chapter
    - Record button with microphone permission check
    - Max 30-second recording
    - Show accuracy score (0-100) within 5 seconds
    - Syllable-by-syllable color-coded breakdown (green/yellow/red)
    - Try Again button (unlimited retries)
    - Error states: microphone unavailable, no speech detected
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 15.9 Implement grammar exercise screen
    - Display 5-10 exercises from chapter content
    - Types: sentence building, fill-in-blank, word reordering, error correction
    - Submit answer → feedback within 3 seconds (correct/incorrect + explanation + grammar rule)
    - No proactive explanations before submission
    - Track: exercises completed, correct answers, score percentage
    - Handle insufficient content (limited exercises message for 2-4 count)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 15.10 Implement Q&A chat screen
    - Text input (1-500 chars) with character counter
    - Display AI answer within 10 seconds
    - Step-by-step breakdown for multi-step problems
    - Support 20 follow-up questions with session context
    - Error messages: constraint violations, no relevant content, generation failure
    - Grade-adapted vocabulary and complexity
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 15.11 Implement revision quiz screen
    - Difficulty selector (Easy/Medium/Hard)
    - Timer configuration (5-120 min, 5-min increments)
    - Question display: MCQ, Fill-in-blank, True/False, Short Answer, Long Answer
    - Subject-specific formats: language (Word Meaning, Sentence Forming), Maths (practical, problem-based), Computers (lab-style), Science/EVS (diagram-based)
    - Auto-submit on timer expiry
    - Results screen: total score %, time taken, per-question breakdown
    - Track attempts (count, highest, most recent)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

- [x] 16. React web client — settings and management screens
  - [x] 16.1 Implement manage learners screen
    - List all learners: name, gender, grade, subjects
    - Edit: modify name, grade, school, subjects (with registration constraints)
    - Reset Password: new password meeting policy, generic error on invalid
    - Remove: confirmation dialog (warn about permanent deletion), soft delete on confirm, cancel returns unchanged
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [x] 16.2 Implement parent profile and settings screen
    - Display: username (read-only), name, phone, email, relationship
    - Update Profile: edit name, phone, email, relationship with validation
    - Update Password: current + new password with format validation
    - Notification preferences: toggle progress alerts, streak reminders
    - Data Export: PDF/CSV download of all learner progress
    - Delete Account: password re-entry + data warning + confirmation
    - Custom subjects: add subjects (1-50 chars, max 10 per account)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [x] 16.3 Implement timeout and error handling UX
    - Show timeout indication after 5 seconds for any API request
    - Allow retry without data loss
    - Visual acknowledgment within 100ms for all local interactions
    - _Requirements: 19.1, 19.2, 19.6_

- [x] 17. Checkpoint - Ensure web client builds successfully
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. React Native Android client
  - [x] 18.1 Set up React Native Android project with shared modules
    - Configure React Native targeting Android 8.0+
    - Import shared validation, types, streak calculator, and progress calculator modules
    - Implement same design system (colors, fonts, border-radius, touch targets 48×48dp)
    - Configure platform-secure storage for JWT tokens
    - _Requirements: 22.1, 22.4, 23.1, 23.2, 23.3, 23.4, 20.3_

  - [x] 18.2 Implement auth screens (Android)
    - Landing page, parent registration, login, forgot password/OTP, learner registration
    - Same functionality and validation as web client
    - Mobile font sizes per grade band (18px LKG-2nd, 16px 3rd-5th, 14px 6th-12th)
    - _Requirements: 1.1–1.5, 2.1–2.6, 3.1–3.6, 4.1–4.6, 18.1–18.5_

  - [x] 18.3 Implement dashboards (Android)
    - Parent dashboard with tree navigation and detail panel
    - Learner dashboard with action buttons
    - Same completion calculations as web (parent: floor, learner: round)
    - Streak display on learner dashboard
    - _Requirements: 14.1–14.5, 15.1–15.6, 5.4_

  - [x] 18.4 Implement content ingestion screens (Android)
    - Camera capture (live capture mode)
    - Gallery/file picker upload
    - Page grid with thumbnails, reorder, delete, classification toggle
    - OCR processing screen with progress indicator
    - Transcript editor with save
    - _Requirements: 6.1–6.3, 7.1–7.9, 8.1–8.8_

  - [x] 18.5 Implement learning feature screens (Android)
    - Chapter explanation (Read/Listen modes, page navigation)
    - Pronunciation practice (microphone recording, scoring display)
    - Grammar exercises (submission, feedback)
    - Q&A chat (input with character limit, answers)
    - Revision quiz (difficulty, timer, results)
    - _Requirements: 9.1–9.8, 10.1–10.8, 11.1–11.7, 12.1–12.6, 13.1–13.10_

  - [x] 18.6 Implement settings and management screens (Android)
    - Manage learners (list, edit, reset password, remove)
    - Parent profile (update, password change, notifications, export, delete, custom subjects)
    - _Requirements: 16.1–16.6, 17.1–17.7_

- [x] 19. Offline support and data persistence
  - [x] 19.1 Implement offline storage module (client-side)
    - `persistChapter`: atomic save of transcript, explanations, exercises, progress to local storage (within 5 seconds)
    - `getOfflineChapters`: retrieve all locally persisted chapters
    - `getAcademicYearContent`: filter by academic year
    - Fail entire persistence if any component fails, notify learner
    - _Requirements: 21.1_

  - [x] 19.2 Implement offline mode detection and UI indicators
    - Visible offline indicator when no connectivity
    - Disable server-requiring actions: add chapters, generate exercises, pronunciation practice
    - Enable read-mode access for locally saved chapters
    - _Requirements: 21.2, 21.6_

  - [x] 19.3 Implement background sync on reconnection
    - `syncProgress`: synchronize offline progress to server within 30 seconds of reconnection
    - Server-wins conflict resolution for progress data
    - Display sync indicator while in progress
    - Queue failed syncs for retry
    - _Requirements: 21.3_

  - [x] 19.4 Write unit tests for offline storage module
    - Test atomic persistence success and failure rollback
    - Test offline chapter retrieval
    - Test sync on reconnection
    - Test conflict resolution
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 20. Security hardening
  - [x] 20.1 Implement security measures across all services
    - TLS 1.2+ enforcement (reject older protocols) — API Gateway config
    - Password hashing: bcrypt cost ≥ 10
    - Session tokens: httpOnly secure cookies (web), platform-secure storage (mobile)
    - JWT: 60-minute expiry, silent refresh via Cognito
    - No PII leakage in error messages (generic auth errors)
    - Parental consent collection before learner data storage
    - No third-party tracking SDKs
    - Sensitive actions blocked until re-authentication
    - Data deletion within 30 days of parent request
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [x] 20.2 Write unit tests for security measures
    - Test TLS rejection of older protocols
    - Test JWT validation and refresh
    - Test re-authentication enforcement
    - Test sensitive action blocking without password verification
    - _Requirements: 20.1–20.7_

- [x] 21. Checkpoint - Ensure all offline and security tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Integration and wiring
  - [x] 22.1 Wire API Gateway routes to Lambda functions
    - Configure all REST endpoints with Cognito authorizer
    - Map routes: /auth/* → Auth Lambda, /content/* → Content Lambda, /learn/* → Learning Lambda, /ai/* → AI Gateway Lambda, /export/* → Export Lambda
    - Configure CORS for web client origin
    - Set up rate limiting at API Gateway level
    - _Requirements: 24.2, 24.5, 19.1_

  - [x] 22.2 Wire SQS queues for async processing
    - OCR queue: Content Lambda → SQS → AI Gateway (OCR processing)
    - AI Generation queue: Content Lambda → SQS → AI Gateway (explanation, pronunciation, grammar, revision generation)
    - Dead letter queue for failed messages
    - _Requirements: 24.7_

  - [x] 22.3 Wire SNS notifications
    - Streak alert topic: Learning Lambda → SNS → parent notification channel
    - Progress update topic: Learning Lambda → SNS → parent notification channel
    - Respect notification preference flags
    - _Requirements: 24.8, 17.4_

  - [x] 22.4 Wire client applications to backend
    - Configure API base URL in web and mobile clients
    - Implement API client layer with: auth token injection, refresh logic, error handling, timeout (5s indicator)
    - Connect all screens to their corresponding API endpoints
    - _Requirements: 19.1, 19.2, 19.6_

  - [x] 22.5 Write integration tests for end-to-end flows
    - API Gateway → Lambda → Aurora round trips
    - AI Gateway → external AI service calls (mocked)
    - SQS message processing for OCR queue
    - Cognito token issuance and validation
    - S3 upload/download for images and audio
    - Offline sync: record offline → reconnect → verify server state
    - _Requirements: 19.1, 24.1–24.12_

- [x] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1-20)
- Unit tests validate specific examples and edge cases
- Implementation language: TypeScript across all layers (shared, Lambda, React, React Native)
- All 25 requirements are covered across the task list
- Shared modules (validation, streak, progress) are implemented once and imported by both web and mobile clients
- The AI Gateway is a single Lambda that routes all external AI calls for unified cost control and caching


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5", "2.7"] },
    { "id": 4, "tasks": ["2.4", "2.6", "2.8", "4.1", "4.3", "4.5", "4.7", "4.9"] },
    { "id": 5, "tasks": ["4.2", "4.4", "4.6", "4.8", "4.10"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.6"] },
    { "id": 7, "tasks": ["6.5", "6.7", "6.9"] },
    { "id": 8, "tasks": ["6.8", "6.10", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 10, "tasks": ["8.5", "8.6", "9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3", "9.4", "9.6", "9.9", "9.12"] },
    { "id": 12, "tasks": ["9.5", "9.7", "9.8", "9.10", "9.11", "9.13"] },
    { "id": 13, "tasks": ["9.14", "11.1", "11.2", "11.3"] },
    { "id": 14, "tasks": ["11.4", "11.5", "12.1", "12.2", "12.3", "12.4"] },
    { "id": 15, "tasks": ["11.6", "11.7", "14.1"] },
    { "id": 16, "tasks": ["14.2", "14.4", "14.5", "14.6", "14.7", "14.8"] },
    { "id": 17, "tasks": ["14.3", "15.1", "15.2", "15.3"] },
    { "id": 18, "tasks": ["15.4", "15.5", "15.6"] },
    { "id": 19, "tasks": ["15.7", "15.8", "15.9", "15.10", "15.11"] },
    { "id": 20, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 21, "tasks": ["18.1"] },
    { "id": 22, "tasks": ["18.2", "18.3", "18.4"] },
    { "id": 23, "tasks": ["18.5", "18.6"] },
    { "id": 24, "tasks": ["19.1", "19.2"] },
    { "id": 25, "tasks": ["19.3", "19.4", "20.1"] },
    { "id": 26, "tasks": ["20.2", "22.1", "22.2", "22.3"] },
    { "id": 27, "tasks": ["22.4", "22.5"] }
  ]
}
```
