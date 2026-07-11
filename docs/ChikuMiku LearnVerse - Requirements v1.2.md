# ChikuMiku LearnVerse — Product Requirements Document

**Version:** 1.2  
**Date:** 26 June 2026  
**Author:** Nayan Nilank  
**Tagline:** *"Where Curiosity Comes Alive"*

---

## 1. Product Overview

### 1.1 Vision
ChikuMiku LearnVerse is a subject-agnostic learning platform for children from **LKG to 12th Grade**. It empowers learners to digitize their textbook content, practice pronunciation, solve exercises, take quizzes, and receive AI-powered explanations — all within a safe, parent-monitored environment.

### 1.2 Target Audience
- **Primary:** Students (LKG–12th Grade)
- **Secondary:** Parents (account management, progress monitoring)

### 1.3 Supported Subjects (Default)
| # | Subject | Icon Color |
|---|---------|-----------|
| 1 | Maths | Pink (#E94F9B) |
| 2 | Science | Green (#27AE60) |
| 3 | English | Blue (#5DADE2) |
| 4 | Hindi | Gold (#E5A100) |
| 5 | Kannada | Purple (#9B59B6) |
| 6 | Computers | Indigo (#4A6CF7) |
| 7 | EVS (Environmental Science) | Orange (#E67E22) |

> Parents may add **custom subjects** (e.g., French, Sanskrit) from the profile settings. Custom subjects use a generic teal icon.

### 1.4 Platforms
| Platform | Minimum Version |
|----------|----------------|
| Android | 8.0 (API 26) |
| Web | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| iOS | Future (Phase 2) |

---

## 2. User Roles & Authentication

### 2.1 Roles
| Role | Description |
|------|-------------|
| **Parent** | Creates account, registers learners, monitors progress, manages settings |
| **Learner** | Uses the platform to learn, practice, and take quizzes |

### 2.2 Parent Registration

THE Parent Registration Form SHALL contain:

| # | Field | Constraints |
|---|-------|-------------|
| 1 | Parent Username | 8–15 characters; allowed: a-z, 0-9, hyphen (-), underscore (_) |
| 2 | Name | 5–20 characters; allowed: alphabets and spaces |
| 3 | Phone | Exactly 10 digits |
| 4 | Email | ≤ 30 characters; valid email format |
| 5 | Password | 8–20 characters; minimum: 1 uppercase, 1 lowercase, 1 number, 1 special symbol |

- Submit button label: **"Register Parent"**
- On successful registration, display success message and **auto-redirect to Login page in 5 seconds** (with a visible countdown timer)

### 2.3 Learner Registration

THE Learner Registration Form SHALL contain:

| # | Field | Constraints |
|---|-------|-------------|
| 1 | Parent Username | Pre-filled from authenticated parent session; **read-only** |
| 2 | Learner Username | 8–15 characters; allowed: a-z, 0-9, hyphen (-), underscore (_) |
| 3 | Name | 5–20 characters; allowed: alphabets and spaces |
| 4 | Password | 8–20 characters; minimum: 1 uppercase, 1 lowercase, 1 number, 1 special symbol |
| 5 | Gender | Radio button with kid-friendly icons; Options: **Male**, **Female**, **Other** |
| 6 | Relationship | Dropdown; Options: **Son**, **Daughter**, **Other** |
| 7 | Grade | Dropdown: LKG, UKG, First, Second, Third, Fourth, Fifth, Sixth, Seventh, Eighth, Ninth, Tenth, Eleventh, Twelfth |
| 8 | School Name | 5–30 characters; allowed: alphabets, numbers, commas, hyphens |
| 9 | Subject Selection | 7 default subjects displayed as selectable icons; **all selected by default** |
| 10 | Add Subject | Parent can create a custom subject (1–50 characters) added to the selectable list |

- At least **1 subject** must be selected before submission
- Submit button label: **"Register Learner"**
- Additional subjects can be added later from profile settings

### 2.4 Login

| # | Requirement |
|---|-------------|
| 1 | Role selector: **Parent** or **Learner** (must select before proceeding) |
| 2 | Username field |
| 3 | Password field (masked) |
| 4 | **Login** button |
| 5 | **Forgot Password** link |

### 2.5 Forgot Password Flow

| Step | Screen |
|------|--------|
| 1 | Enter Username → system sends OTP to registered email/phone |
| 2 | Enter OTP (6-digit verification code) |
| 3 | Set New Password (same validation rules as registration) |
| 4 | Success confirmation → redirect to Login |

### 2.6 Session Management
- Session duration: **30+ days** (persistent login)
- Parental accounts support multiple learner profiles
- Logout available from settings

### 2.7 Streak Rules
- A learner's streak increments by 1 for each consecutive day of activity
- **If a learner does not perform any activity for 2 continuous days, the streak resets to 0**
- Activity includes: reading a chapter page, completing an exercise, taking a quiz, or practicing pronunciation

---

## 2A. Navigation & Functional Flow

### 2A.1 Unauthenticated Flow
| From | Action | Navigates To |
|------|--------|-------------|
| Landing Page | Tap "Register Now" | Parent Registration |
| Landing Page | Tap "Login" | Login Screen |
| Parent Registration | Successful submit | Success message → Auto-redirect to Login (5s) |
| Login | Tap "Forgot Password" | Forgot Password Step 1 |
| Forgot Password (Success) | Auto-redirect | Login Screen |

### 2A.2 Parent Flow (Authenticated)
| From | Action | Navigates To |
|------|--------|-------------|
| Login (Parent) | Successful login | Parent Dashboard |
| Parent Dashboard | Click tree item | Detail panel (right side) updates |
| Parent Dashboard | Tap "Add Learner" / "+" | Learner Registration Form |
| Parent Dashboard | Tap Settings/Profile icon | Parent Profile & Settings |
| Parent Profile | Tap "Manage Learners" | Manage Students list |
| Manage Students | Tap "Edit" on learner | Edit Learner form |

### 2A.3 Learner Flow (Authenticated)
| From | Action | Navigates To |
|------|--------|-------------|
| Login (Learner) | Successful login | Learner Dashboard |
| Learner Dashboard | Click tree item | Detail panel (right side) updates |
| Learner Dashboard | Tap "Continue Reading" | Chapter Explanation (page-by-page) |
| Learner Dashboard | Tap "Take Exercise" | Chapter Exercise screen |
| Learner Dashboard | Tap subject heading | Subject detail → Books & Chapters |
| Subject detail | Tap "Add Chapter" | Content Ingestion: Select Book → Add Pages → OCR |
| Chapter Explanation | Tap "Take Exercise" | Chapter Exercise |
| Any screen | Tap nav bar icons | Switch between Dashboard / Subjects / Profile |

---

## 3. Content Ingestion

### 3.1 Overview
Learners can digitize physical textbook content by photographing or uploading page images. The system extracts text via OCR and creates a chapter transcript.

### 3.2 Structure
```
Subject
  └── Book (one or more per subject)
       └── Chapter (one or more per book)
            ├── Content Pages (1–50 pages per chapter)
            ├── Exercise Pages (identified separately during capture)
            └── Chapter Exercise (linked to the chapter)
```

### 3.3 Adding a Chapter

| # | Requirement |
|---|-------------|
| 1 | Learner selects a **Subject** from their enrolled subjects |
| 2 | Learner selects an existing **Book** OR creates a new book (Book Name field) |
| 3 | **Chapter Number** is auto-suggested (next sequential); can be overridden |
| 4 | Learner enters **Chapter Name** |

### 3.4 Page Capture

| # | Requirement |
|---|-------------|
| 1 | Two input modes: **Camera** (live capture) or **Upload** (gallery/file picker) |
| 2 | Supported formats: JPEG, PNG, HEIC |
| 3 | Maximum file size per image: **10 MB** |
| 4 | Maximum pages per chapter: **50** |
| 5 | Pages displayed as numbered thumbnails in a grid |
| 6 | Pages can be reordered, deleted, or recaptured |
| 7 | **"Done"** button finalizes page capture |
| 8 | Learner SHALL **tag/identify exercise pages** separately from content pages (e.g., via a toggle or label on each page thumbnail) |
| 9 | Exercise pages are grouped under the chapter's Exercise section for separate OCR processing and exercise generation |

### 3.5 Text Recognition (OCR)

| # | Requirement |
|---|-------------|
| 1 | System processes uploaded pages through OCR engine |
| 2 | Progress indicator shown during extraction ("Extracting text from pages...") |
| 3 | Generated transcript is organized **page-by-page** with page markers (Page 1, Page 2, etc.) |
| 4 | Transcript is editable by the learner before saving |
| 5 | **"Save Transcript"** button stores the chapter content |
| 6 | OCR SHALL **automatically detect the language/script** of each page (no manual language selection required) |
| 7 | Auto-detection must scale to support **any additional language** added as a custom subject (e.g., French, Sanskrit, Tamil) without configuration changes |
| 8 | Target accuracy: best-effort with manual correction capability |

### 3.6 Chapter Explanation

| # | Requirement |
|---|-------------|
| 1 | Once transcript is generated, the application SHALL explain content **page by page** |
| 2 | Two modes available via toggle: **Read (Text)** and **Listen (Speech)** |
| 3 | Learner can select preferred mode before starting |
| 4 | Text mode: displays explanation with summary, key words, and concepts per page |
| 5 | Speech mode: audio playback of explanation with player controls (play/pause/seek) |
| 6 | Navigation: **Previous Page** / **Next Page** buttons with page indicator dots |
| 7 | This functionality SHALL be supported for **all subjects** |

---

## 4. Learning Modes

### 4.1 Pronunciation Practice

| # | Requirement |
|---|-------------|
| 1 | Supported for language subjects: English, Hindi, Kannada, **and any additional language added as a custom subject** |
| 1a | The system SHALL automatically extend pronunciation support when a new language subject is added — no developer intervention required |
| 2 | System presents words/sentences from chapter content |
| 3 | Learner records their pronunciation via microphone |
| 4 | System provides accuracy score: **0–100%** |
| 5 | Syllable-by-syllable breakdown of pronunciation |
| 6 | Color-coded feedback: green (correct), red (incorrect), yellow (partial) |
| 7 | "Try Again" option for re-recording |
| 8 | Multi-language support (script-appropriate phonetics) |

### 4.2 Grammar Exercises

| # | Requirement |
|---|-------------|
| 1 | Supported for language subjects: English, Hindi, Kannada, **and any additional language added as a custom subject** |
| 1a | The system SHALL automatically extend grammar exercise support when a new language subject is added — no developer intervention required |
| 2 | Child-friendly exercise format |
| 3 | 5–10 exercises per chapter |
| 4 | Language-specific grammar rules applied |
| 5 | Exercise types: sentence building, fill-in-the-blank, word reordering, error correction |
| 6 | Instant feedback with explanation of correct answer |
| 7 | Progress tracking per exercise set |

### 4.3 Chapter-based Q&A (Comprehension)

| # | Requirement |
|---|-------------|
| 1 | Supported for **all subjects** |
| 2 | Questions generated from chapter content |
| 3 | Model answers provided in **< 10 seconds** |
| 4 | Step-by-step guidance for complex problems |
| 5 | Learner can ask follow-up questions |
| 6 | Difficulty adapts to learner's grade level |

### 4.4 Revision Mode

| # | Requirement |
|---|-------------|
| 1 | Supported for **all subjects** |
| 2 | 5–20 questions per chapter |
| 3 | Three difficulty levels: **Easy**, **Medium**, **Hard** |
| 4 | Timer: 5–120 minutes (configurable by learner) |
| 5 | Question types: MCQ, Fill-in-the-blank, True/False, Short Answer |
| 6 | **Long Answer** questions: supported for all subjects (learner types multi-sentence response, evaluated against model answer) |
| 7 | **Language-specific formats** (for English, Hindi, Kannada, and custom language subjects): |
|   | — Word Meaning (given a word, provide the meaning) |
|   | — Sentence Forming (form a sentence using a given word) |
| 8 | **Maths-specific formats:** |
|   | — Practical questions (addition, subtraction, multiplication, division) |
|   | — Problem-based questions (word problems requiring multi-step solutions) |
| 9 | **Computers-specific formats:** |
|   | — Lab-style questions (write code, identify output, debug a snippet) |
| 10 | **Science/EVS-specific formats:** |
|   | — Diagram-based questions (label, identify, explain) |
| 11 | Results screen: score, time taken, per-question breakdown |
| 12 | Progress tracking over multiple attempts |

---

## 5. Dashboards

### 5.1 Parent Dashboard

**Left Panel — Tree Navigation:**
```
Learner 1
  ├── Subject 1
  │   ├── Book 1
  │   │   ├── Chapter 1 (% complete)
  │   │   │   └── Chapter Exercise (% complete)
  │   │   ├── Chapter 2 (% complete)
  │   │   │   └── Chapter Exercise (% complete)
  │   │   └── ...
  │   ├── Book 2
  │   │   └── ...
  │   └── Quizzes
  │       └── Completed (% complete)
  ├── Subject 2
  │   └── ...
  └── ...
Learner 2
  └── ...
```

**Right Panel — Detail View (on item click):**
| Element | Description |
|---------|-------------|
| Subject icon + Chapter name | Header identification |
| Reading progress | Percentage + progress bar |
| Exercise score | Percentage |
| Pages read | Count |
| Recent activity | Timestamped log entries |
| Last active | Date/time of learner's last session |

### 5.2 Learner Dashboard

**Left Panel — Tree Navigation** (same structure as Parent, but for the **single logged-in learner only**):
```
├── Subject 1
│   ├── Book 1
│   │   ├── Chapter 1 (% complete)
│   │   │   └── Chapter Exercise (% complete)
│   │   └── ...
│   └── Quizzes
│       └── Completed (% complete)
├── Subject 2
│   └── ...
└── ...
```

**Right Panel — Detail View (on item click):**
| Element | Description |
|---------|-------------|
| Chapter details | Name, book, subject |
| Stats cards | Read %, Exercise %, Pages Done, Pages Left |
| Progress bar | Visual completion indicator |
| Action buttons | **Continue Reading**, **Take Exercise**, **Listen** |

### 5.3 Manage Students (Parent)

| # | Requirement |
|---|-------------|
| 1 | List of all registered learners with **name, gender, grade, and subjects** |
| 2 | **Edit** action: modify name, grade, school, subjects |
| 3 | **Reset Password** action |
| 4 | **Remove** action with confirmation dialog |

### 5.4 Parent Profile & Settings

| # | Requirement |
|---|-------------|
| 1 | Display parent account details: Username, Name, Phone, Email, Relationship |
| 2 | **Update Profile** action: edit Name, Phone, Email, Relationship |
| 3 | **Update Password** action: enter current password → new password (same validation rules) |
| 4 | **Reset Password** action: via OTP to registered email/phone (same flow as Forgot Password) |
| 5 | **Manage Learners** subsection (as described in Section 5.3 above) |
| 6 | **Add Subject** option: create custom subjects (1–50 characters) available to all learners |
| 7 | **Notification Preferences**: enable/disable progress alerts, streak reminders |
| 8 | **Data Export**: download learner progress reports (PDF/CSV) |
| 9 | **Logout** action |
| 10 | **Delete Account** action: with parental confirmation gate and data deletion warning |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target |
|--------|--------|
| API response time (P95) | < 2 seconds |
| Local interaction response | < 100 milliseconds |
| System uptime | 99.5% |
| OCR processing | < 15 seconds per page |
| Content explanation generation | < 10 seconds |

### 6.2 Security

| # | Requirement |
|---|-------------|
| 1 | All data transmitted over HTTPS/TLS |
| 2 | Passwords stored using bcrypt/scrypt hashing |
| 3 | Session tokens with secure storage |
| 4 | Parental gate for sensitive actions (account deletion, data export) |
| 5 | COPPA-compliant data handling for minors |
| 6 | No third-party tracking or advertising |

### 6.3 Storage & Data

| # | Requirement |
|---|-------------|
| 1 | Chapter content persists across sessions |
| 2 | Grade lifecycle: content organized by academic year |
| 3 | Progress data retained for historical comparison |
| 4 | Offline support: previously loaded chapters accessible without internet |
| 5 | Data export option for parents (progress reports) |

### 6.4 Accessibility

| # | Requirement |
|---|-------------|
| 1 | Minimum font sizes appropriate for target age group |
| 2 | High contrast mode available |
| 3 | Screen reader compatible (WCAG 2.1 AA) |
| 4 | Touch targets: minimum 48×48dp on mobile |

### 6.5 Architecture & Deployment

- All components SHALL be deployed as **serverless** components within the **AWS ecosystem**
- Infrastructure-as-code for reproducible deployments
- Auto-scaling based on usage patterns

### 6.6 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **OCR** | Google Vision OCR | Text extraction from page images, auto language detection |
| **Embeddings** | OpenAI text-embedding-3-small | Chapter content vectorization for semantic search |
| **Question Answering** | GPT-5 Mini | Chapter Q&A, comprehension, follow-up questions |
| **Revision Generator** | GPT-5 Mini | Generate MCQ, fill-in-blank, long answer, subject-specific questions |
| **Grammar** | GPT-5 Mini | Grammar exercise generation and evaluation |
| **Translation** | GPT-5 Mini | Multi-language content translation and localization |
| **Chapter Summary** | GPT-5 Mini | Page-by-page explanation, key words, concepts extraction |
| **Answer Evaluation** | GPT-5 Mini | Evaluate learner responses against model answers |
| **Speech Recognition** | Whisper | Pronunciation input — convert learner speech to text for scoring |
| **Text-to-Speech** | Google TTS | Chapter explanation audio playback (Listen mode) |
| **Vector Search** | pgvector | Semantic similarity search over chapter embeddings |
| **AI Gateway** | Custom Node.js Service | API orchestration, rate limiting, prompt management, model routing |
| **Database** | PostgreSQL | User data, progress, content storage, session management |

### 6.7 AWS Services (Serverless)

| Layer | Service |
|-------|---------|
| Compute | AWS Lambda (API handlers, AI Gateway) |
| API | Amazon API Gateway (REST/WebSocket) |
| Storage | Amazon S3 (page images, audio files) |
| Database | Amazon RDS Aurora Serverless (PostgreSQL + pgvector) |
| Auth | Amazon Cognito (session management, JWT tokens) |
| CDN | Amazon CloudFront (static assets, web app) |
| Queue | Amazon SQS (async OCR processing, AI jobs) |
| Notifications | Amazon SNS (streak alerts, progress notifications) |
| Monitoring | Amazon CloudWatch (logs, metrics, alarms) |
| Secrets | AWS Secrets Manager (API keys for OpenAI, Google) |

---

## 7. Landing Page

### 7.1 Purpose
First screen shown to unauthenticated users. Provides product overview and directs to registration or login.

### 7.2 Content

| # | Element |
|---|---------|
| 1 | App logo and name (ChikuMiku LearnVerse) |
| 2 | Tagline: "Where Curiosity Comes Alive" |
| 3 | Feature highlights: 7 Subjects, Pronunciation, Scan & Learn, Quizzes |
| 4 | Grade range indicator: "LKG to 12th Grade" |
| 5 | **Register Now** button (primary CTA) |
| 6 | **Login** button (secondary) |
| 7 | Platform indicators: Android App, Web Access |
| 8 | Safety badge: "Safe & secure for children • Parent-monitored" |

---

## 8. Design System

### 8.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Pink) | #E94F9B | Primary actions, Maths |
| Secondary (Purple) | #9B59B6 | Branding, Kannada |
| Accent (Blue) | #5DADE2 | Info, English |
| Warning (Gold) | #F7C948 | Highlights, streaks |
| Success (Green) | #27AE60 | Correct, Science |
| Error (Red) | #E74C3C | Incorrect, warnings |
| Dark | #2C2341 | Headers, dark backgrounds |
| Page Background | #F8F5FF | Page fill |
| Border | #E0D8EC | Dividers, input borders |
| Hindi Gold | #E5A100 | Hindi subject |
| Computers Indigo | #4A6CF7 | Computers subject |
| EVS Orange | #E67E22 | EVS subject |

### 8.2 Typography
- Font family: System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- Mobile body: 14px
- Web body: 16px

### 8.3 Spacing & Layout
| Property | Value |
|----------|-------|
| Card border-radius | 16px (large), 10px (small) |
| Button border-radius | 20–22px (pill shape) |
| Mobile viewport | 360×720px |
| Web content max-width | 960px+ |

### 8.4 Logo & Watermark
- Logo: ChikuMiku-LearnVerse-Logo_1.png
- Watermark: 75% of screen width, 7–10% opacity

---

## 9. Future Considerations (Phase 2)

| # | Feature |
|---|---------|
| 1 | iOS native app |
| 2 | Gamification (badges, leaderboards, rewards) |
| 3 | Peer collaboration (study groups) |
| 4 | AI tutor chatbot |
| 5 | Video explanations |
| 6 | Handwriting recognition |
| 7 | Parent-teacher communication |
| 8 | Multiple language UI (app interface in Hindi/Kannada) |

---

## 10. Appendix

### 10.1 Screen Inventory

| Section | Screens |
|---------|---------|
| Landing Page | Mobile + Web |
| Authentication | Login, Parent Registration, Learner Registration, Forgot Password (4 steps) |
| Parent Dashboard | Tree navigation + detail view (Mobile + Web) |
| Learner Dashboard | Tree navigation + detail view (Mobile + Web) |
| Content Ingestion | Select Subject/Book, Add Pages, Text Recognition, Chapter Explanation |
| Learning Modes | Pronunciation, Grammar, Comprehension, Revision (per subject) |
| Subject Screens | Kannada, English, Hindi, Maths, Computers, EVS |
| Settings | Parent Profile, Update/Reset Password, Manage Learners, Add Subject |

### 10.2 Subject Icon Mapping

| Subject | Icon (Font Awesome) | Color | Background |
|---------|-------------------|-------|------------|
| Maths | `fa-calculator` | var(--pink) | var(--pink-light) |
| Science | `fa-flask` | var(--green) | var(--green-light) |
| English | `fa-spell-check` | var(--blue) | var(--blue-light) |
| Hindi | `fa-om` | #E5A100 | var(--gold-light) |
| Kannada | `fa-language` | var(--purple) | var(--purple-light) |
| Computers | `fa-laptop-code` | #4A6CF7 | #EBF0FF |
| EVS | `fa-leaf` | #E67E22 | #FFF0E0 |
| Custom | `fa-plus` (dashed border) | #9B59B6 | #F3E8F9 |

---

*End of Document*
