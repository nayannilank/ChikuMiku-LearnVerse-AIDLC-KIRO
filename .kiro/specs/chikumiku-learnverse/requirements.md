# Requirements Document

## Introduction

ChikuMiku LearnVerse is a subject-agnostic learning platform for children from LKG to 12th Grade. The platform enables learners to digitize textbook content via OCR, practice pronunciation, solve grammar exercises, take revision quizzes, receive AI-powered page-by-page explanations, and ask chapter-based questions — all within a safe, parent-monitored environment. It targets Android 8.0+ and modern web browsers, with iOS planned for a future phase.

## Glossary

- **Platform**: The ChikuMiku LearnVerse application system comprising Android and Web clients, serverless backend, and AI services
- **Parent**: A registered adult user who creates accounts, registers learners, monitors progress, and manages platform settings
- **Learner**: A registered student user (LKG–12th Grade) who uses the platform for learning activities
- **OCR_Engine**: The Google Vision OCR service that extracts text from textbook page images with automatic language detection
- **Content_Ingestion_Module**: The subsystem responsible for capturing page images, processing them through OCR, and storing chapter transcripts
- **Pronunciation_Engine**: The subsystem combining Google TTS for audio playback and Whisper for speech recognition and scoring
- **Grammar_Engine**: The AI-powered subsystem (GPT-5 Mini) that generates and evaluates language-specific grammar exercises
- **QA_Engine**: The AI-powered subsystem (GPT-5 Mini with RAG) that answers chapter-based questions and provides explanations
- **Revision_Engine**: The AI-powered subsystem (GPT-5 Mini) that generates quizzes with subject-specific question formats
- **Explanation_Engine**: The AI-powered subsystem (GPT-5 Mini) that generates page-by-page explanations, summaries, and key concepts
- **Dashboard**: The tree-navigation interface with a detail panel showing progress, scores, and action buttons
- **Streak**: A counter tracking consecutive days of learner activity, resetting to zero after two continuous days of inactivity
- **Chapter**: A unit of content within a book consisting of up to 50 pages of OCR-extracted text, associated exercises, and generated learning materials
- **Exercise_Page**: A page within a chapter tagged by the learner as containing exercises rather than content
- **RAG**: Retrieval-Augmented Generation — a technique that retrieves relevant content chunks via vector search before sending them to the LLM

## Requirements

### Requirement 1: Parent Registration

**User Story:** As a parent, I want to register an account with my credentials, so that I can manage my children's learning profiles.

#### Acceptance Criteria

1. THE Platform SHALL display a Parent Registration Form containing fields for Parent Username (8–15 characters; a-z, 0-9, hyphen, underscore), Full Name (5–20 characters; alphabets and spaces), Phone (exactly 10 digits), Email (up to 30 characters; valid email format), and Password (8–20 characters; minimum 1 uppercase, 1 lowercase, 1 number, 1 special symbol from the set !@#$%^&*)
2. WHEN a parent submits a valid registration form, THE Platform SHALL create the parent account, display a success message indicating that registration is complete, and auto-redirect to the Login page within 5 seconds with a visible countdown timer
3. WHEN a parent submits a registration form with invalid field values, THE Platform SHALL perform all validation client-side, display field-specific inline validation error messages adjacent to each invalid field, and SHALL NOT submit the form to the server under any circumstances when validation errors exist
4. THE Platform SHALL enforce a unique constraint on the Parent Username field across all registered parent accounts; Email and Phone fields are NOT required to be unique, allowing multiple parents (e.g., mother and father) to share the same email or phone number
5. IF a parent submits a registration form containing a Parent Username that is already registered, THEN THE Platform SHALL display a field-specific error message indicating the username is already in use and shall retain all other entered form data

### Requirement 2: Learner Registration

**User Story:** As a parent, I want to register learner profiles under my account, so that my children can use the platform independently.

#### Acceptance Criteria

1. THE Platform SHALL display a Learner Registration Form containing: pre-filled read-only Parent Username, Learner Username (8–15 characters; a-z, 0-9, hyphen, underscore), Name (5–20 characters; alphabets and spaces), Password (8–20 characters; minimum 1 uppercase, 1 lowercase, 1 number, 1 special symbol), Gender (Male, Female, Other as radio buttons with kid-friendly icons), Relationship (Son, Daughter, Other as dropdown), Grade (LKG through Twelfth as dropdown), School Name (5–30 characters; alphabets, numbers, commas, hyphens), Subject Selection (7 default subjects displayed as selectable icons, all selected by default), and Add Subject field (1–50 characters for custom subjects, maximum 5 custom subjects per learner)
2. WHEN a parent submits a valid learner registration form with at least 1 subject selected (validated as a simple count check accepting any selection of 1 or more subjects), THE Platform SHALL create the learner profile linked to the authenticated parent account and display a success confirmation message within 3 seconds
3. IF a parent submits a learner registration form with zero subjects selected, THEN THE Platform SHALL display a validation error indicating at least 1 subject must be selected and SHALL retain all other entered form data
4. IF a parent submits a learner registration form with a Learner Username that already exists in the system, THEN THE Platform SHALL display a validation error indicating the username is unavailable and SHALL retain all other entered form data
5. IF a parent submits a learner registration form with any field value violating its specified format or length constraints, THEN THE Platform SHALL display a validation error identifying each non-conforming field and SHALL retain all entered form data
6. THE Platform SHALL allow a maximum of 10 learner profiles per parent account

### Requirement 3: Login

**User Story:** As a user (parent or learner), I want to log in with my role and credentials, so that I can access role-appropriate features.

#### Acceptance Criteria

1. THE Platform SHALL display a Login screen with a role selector (Parent or Learner), Username field, Password field (masked), Login button, and Forgot Password link
2. WHEN a role is selected (whether actively chosen by the user or pre-selected) and valid credentials matching an account of the selected role are submitted, THE Platform SHALL authenticate the user, create a session persisting for a minimum of 30 days, and redirect to the corresponding dashboard (Parent Dashboard or Learner Dashboard)
3. IF a user submits the Login form with an empty Username field, empty Password field, or without selecting a role, THEN THE Platform SHALL display a validation error message indicating which fields are required and SHALL NOT submit the credentials to the server
4. IF a user submits credentials that do not match any account or do not match the selected role, THEN THE Platform SHALL display a generic authentication error message without revealing whether the username, password, or role selection is incorrect
5. IF a user fails authentication 5 consecutive times for the same username, THEN THE Platform SHALL temporarily lock the account for 15 minutes and display a message indicating the account is locked
6. WHEN an authenticated user selects Logout from settings, THE Platform SHALL terminate the session and redirect to the Login screen

### Requirement 4: Forgot Password

**User Story:** As a user, I want to reset my forgotten password via OTP verification, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user enters a valid username on the Forgot Password screen, THE Platform SHALL send a 6-digit OTP to the registered email or phone associated with that username, where the OTP remains valid for 5 minutes from the time of issuance
2. WHEN a user enters a valid OTP within the expiry period, THE Platform SHALL allow the user to set a new password following the same validation rules as registration (8–20 characters; minimum 1 uppercase, 1 lowercase, 1 number, 1 special symbol), and THE Platform SHALL always validate the new password format regardless of OTP validity status
3. WHEN a user successfully sets a new password, THE Platform SHALL display a success confirmation and redirect to the Login screen within 3 seconds
4. IF a user enters an incorrect OTP, THEN THE Platform SHALL display an error message indicating the OTP is invalid and allow the user to retry, up to a maximum of 3 attempts
5. IF a user exhausts 3 OTP attempts or the OTP expires, THEN THE Platform SHALL invalidate the current OTP, display an error message indicating the reason, and require the user to initiate a new password reset request
6. IF a user enters a username that does not exist in the system, THEN THE Platform SHALL display a generic error message indicating the request cannot be processed, without revealing whether the username exists

### Requirement 5: Streak Tracking

**User Story:** As a learner, I want my daily activity streak tracked, so that I stay motivated to learn consistently.

#### Acceptance Criteria

1. WHEN a learner performs any qualifying activity (reading a chapter page, completing an exercise, taking a quiz, or practicing pronunciation) on a calendar day (defined by the learner's device-local date) and no qualifying activity has been recorded for that calendar day yet, THE Platform SHALL increment the learner's streak counter by 1 and record that day as an active day
2. IF a learner has not performed any qualifying activity for 2 consecutive calendar days (e.g., activity on Day 1, no activity on Day 2, no activity on Day 3 triggers reset at end of Day 3), THEN THE Platform SHALL reset the learner's streak counter to 0
3. IF a learner misses exactly 1 calendar day of qualifying activity but performs a qualifying activity on the following calendar day, THEN THE Platform SHALL maintain the current streak count without resetting; streak counts SHALL only increase or remain the same when there are no missed days and SHALL never decrease during consecutive active days
4. THE Platform SHALL display the current streak count on the Learner Dashboard, updated within the same session after a qualifying activity is performed

### Requirement 6: Content Ingestion — Chapter Creation

**User Story:** As a learner, I want to create chapters within my subjects and books, so that I can organize my textbook content digitally.

#### Acceptance Criteria

1. WHEN a learner initiates chapter creation, THE Content_Ingestion_Module SHALL prompt for Subject selection (from enrolled subjects), Book selection (existing or new book name of 3–50 characters allowing alphabets, numbers, spaces, hyphens, and colons), Chapter Number (auto-suggested as next sequential integer starting from 1, overridable within the range 1–999), and Chapter Name (3–100 characters allowing alphabets, numbers, spaces, hyphens, and colons)
2. THE Content_Ingestion_Module SHALL support a hierarchical structure of Subject → Book (1–50 per subject) → Chapter (1–100 per book) → Content Pages (1–50 per chapter) and Exercise Pages (0–20 per chapter)
3. IF a learner specifies a Chapter Number that already exists within the same book, THEN THE Content_Ingestion_Module SHALL display an error message indicating the chapter number is already in use and SHALL NOT create the chapter until a unique number is provided

### Requirement 7: Content Ingestion — Page Capture

**User Story:** As a learner, I want to photograph or upload textbook pages and tag exercise pages, so that the system can process my content accurately.

#### Acceptance Criteria

1. THE Content_Ingestion_Module SHALL provide two input modes for page capture: Camera (live capture) and Upload (gallery or file picker)
2. THE Content_Ingestion_Module SHALL accept images in JPEG, PNG, or HEIC format with a maximum file size of 10 MB per image
3. IF a learner attempts to upload or capture an image that is not in JPEG, PNG, or HEIC format or exceeds 10 MB, THEN THE Content_Ingestion_Module SHALL reject the image and display an error message indicating the reason for rejection (unsupported format or file too large), retain all previously captured pages unchanged, and SHALL only display error messages when an actual invalid upload is attempted
4. THE Content_Ingestion_Module SHALL enforce a minimum of 1 page and a maximum of 50 pages per chapter
5. IF a learner attempts to add a page beyond the 50-page limit, THEN THE Content_Ingestion_Module SHALL prevent the addition and display an error message indicating the maximum page limit has been reached
6. THE Content_Ingestion_Module SHALL display captured pages as numbered thumbnails in a grid, supporting reorder, delete, and recapture operations
7. THE Content_Ingestion_Module SHALL classify each captured page as a Content Page by default, and allow the learner to toggle individual pages to Exercise Page classification via a control on each thumbnail
8. WHEN the learner taps the Done button and between 1 and 50 pages have been captured, THE Content_Ingestion_Module SHALL lock the page set from further editing, navigate to the OCR processing screen, and initiate text extraction; THE Content_Ingestion_Module SHALL NOT initiate OCR processing unless the Done button has been pressed; IF the page count exceeds 50 at the time of pressing Done, THE Content_Ingestion_Module SHALL block OCR processing and display an error until the page count is reduced
9. IF the learner taps the Done button with no pages captured, THEN THE Content_Ingestion_Module SHALL display an error message indicating that at least 1 page is required and remain on the page capture screen

### Requirement 8: Content Ingestion — OCR Processing

**User Story:** As a learner, I want the system to extract text from my captured pages automatically, so that I can study from digital transcripts.

#### Acceptance Criteria

1. WHEN page capture is finalized, THE OCR_Engine SHALL process each uploaded page image and extract text content within 15 seconds per page
2. WHILE OCR processing is in progress, THE Platform SHALL display a progress indicator with the message "Extracting text from pages..." showing the current page number being processed out of the total
3. THE OCR_Engine SHALL automatically detect the language or script of each page without requiring manual language selection
4. THE OCR_Engine SHALL organize the generated transcript page-by-page with page markers (Page 1, Page 2, etc.) and SHALL separate content page transcripts from exercise page transcripts based on the learner's page tags
5. THE Platform SHALL allow the learner to edit the generated transcript before saving, with the ability to modify text on any page
6. WHEN the learner taps Save Transcript and all pages have been successfully processed, THE Content_Ingestion_Module SHALL persist the chapter content, verify persistence is complete, and only then display a success confirmation message; THE Platform SHALL prevent saving when any page has not been successfully processed
7. THE OCR_Engine SHALL support text extraction for any language added as a custom subject without configuration changes
8. IF the OCR_Engine fails to process a page (due to timeout after 30 seconds, corrupted image, unsupported content, or any other processing error), THEN THE Platform SHALL immediately mark that page as failed, display an error indicator on the page thumbnail, and provide a Retry option to re-process the failed page without affecting successfully processed pages

### Requirement 9: Chapter Explanation

**User Story:** As a learner, I want page-by-page explanations of my chapter content in text and audio modes, so that I can understand concepts at my own pace.

#### Acceptance Criteria

1. WHEN a chapter transcript is available, THE Explanation_Engine SHALL generate explanations organized page by page, where each page explanation includes a summary (maximum 200 words), 3 to 10 key words, and 1 to 5 concepts
2. THE Platform SHALL provide two explanation modes via toggle: Read (text display) and Listen (audio playback), with Read mode selected as the default when the explanation screen is opened
3. WHILE in Read mode and explanation generation has succeeded for the current page, THE Platform SHALL display the explanation with summary, key words, and concepts for the current page; THE Platform SHALL NOT display explanation content when generation has failed
4. WHILE in Listen mode, THE Platform SHALL play audio of the explanation for the current page with player controls (play, pause, seek), and WHEN the learner toggles from Listen to Read mode, THE Platform SHALL stop audio playback
5. THE Platform SHALL provide Previous Page and Next Page navigation buttons with page indicator dots, and SHALL disable the Previous Page button on the first page and the Next Page button on the last page
6. THE Explanation_Engine SHALL target explanation generation within 10 seconds per page; IF generation exceeds 10 seconds but eventually succeeds, THE Platform SHALL display the result normally upon completion
7. THE Explanation_Engine SHALL support explanations for all subjects including the 7 default subjects and any custom subjects added by a parent
8. IF the Explanation_Engine fails to generate an explanation for a page, THEN THE Platform SHALL display an error message indicating the failure and provide a Retry option to re-attempt generation for that page

### Requirement 10: Pronunciation Practice

**User Story:** As a learner studying language subjects, I want to practice speaking words and sentences and receive scored feedback, so that I can improve my pronunciation.

#### Acceptance Criteria

1. THE Pronunciation_Engine SHALL support pronunciation practice for all language subjects (English, Hindi, Kannada, and any custom language subject added by a parent)
2. WHEN a new language subject is added, THE Pronunciation_Engine SHALL automatically extend pronunciation support without developer intervention
3. THE Pronunciation_Engine SHALL present between 5 and 20 words or sentences extracted from chapter content per practice session for the learner to practice
4. WHEN a learner records their pronunciation via microphone, THE Pronunciation_Engine SHALL transcribe the speech, compare it against the expected text, and provide an accuracy score from 0 to 100 percent within 5 seconds of recording completion, where the maximum recording duration is 30 seconds per attempt
5. THE Pronunciation_Engine SHALL provide syllable-by-syllable breakdown with color-coded feedback: green for accuracy at or above 80%, yellow for accuracy between 40% and 79% (partial match), and red for accuracy below 40% (incorrect)
6. THE Platform SHALL provide a Try Again option for re-recording after each pronunciation attempt with no limit on the number of retries
7. IF the microphone is unavailable or permission is denied, THEN THE Pronunciation_Engine SHALL display an error message indicating that microphone access is required and SHALL not proceed with recording
8. IF the recording produces no recognizable speech or transcription fails, THEN THE Pronunciation_Engine SHALL display an error message indicating the recording was not recognized and SHALL offer the learner the option to try again

### Requirement 11: Grammar Exercises

**User Story:** As a learner studying language subjects, I want to practice grammar exercises tailored to my chapter content, so that I can improve my language skills.

#### Acceptance Criteria

1. THE Grammar_Engine SHALL support grammar exercises for all language subjects (English, Hindi, Kannada, and any custom language subject added by a parent)
2. WHEN a new language subject is added, THE Grammar_Engine SHALL make grammar exercises available for that subject's chapters within the same session without requiring a platform update or developer intervention
3. WHEN a learner navigates to grammar exercises for a chapter that has a saved transcript, THE Grammar_Engine SHALL generate 5 to 10 exercises derived from the chapter content using language-specific grammar rules appropriate to the learner's grade level
4. THE Grammar_Engine SHALL support the following exercise types: sentence building, fill-in-the-blank, word reordering, and error correction
5. WHEN a learner submits an exercise answer, THE Grammar_Engine SHALL display feedback within 3 seconds indicating whether the answer is correct or incorrect, along with an explanation of the correct answer and the applicable grammar rule; THE Grammar_Engine SHALL NOT display explanations or grammar rules proactively before a submission occurs
6. THE Platform SHALL track and display per exercise set for each learner: the number of exercises completed, the number of correct answers, and the overall score as a percentage
7. IF a chapter's saved transcript contains insufficient content to generate the minimum of 5 exercises, THEN THE Grammar_Engine SHALL generate as many exercises as the content allows (minimum 1); IF 2 to 4 exercises are generated, THE Grammar_Engine SHALL display an indication that fewer exercises are available due to limited chapter content; IF only 1 exercise is generated, THE Grammar_Engine SHALL not display the limited content message

### Requirement 12: Chapter-Based Q&A

**User Story:** As a learner, I want to ask questions about my chapter content and receive AI-powered answers, so that I can clarify doubts and deepen understanding.

#### Acceptance Criteria

1. THE QA_Engine SHALL support chapter-based question answering for all subjects that have at least one chapter with a saved transcript
2. WHEN a learner submits a question of 1 to 500 characters about a chapter, THE QA_Engine SHALL first retrieve relevant content using vector search (RAG), and only upon successful content retrieval SHALL generate an answer within 10 seconds
3. IF the learner's question involves a multi-step problem (e.g., word problems in Maths, derivations in Science, or multi-part reasoning), THEN THE QA_Engine SHALL present the answer as a numbered step-by-step breakdown
4. THE QA_Engine SHALL allow learners to ask up to 20 follow-up questions within the same chapter context, where context is maintained for the duration of the learner's active session on that chapter
5. THE QA_Engine SHALL adapt answer vocabulary, sentence complexity, and explanation depth to match the learner's registered grade level (LKG through Twelfth)
6. IF the QA_Engine cannot retrieve relevant content, cannot generate an answer, or detects a constraint violation (such as question exceeding 500 characters), THEN THE QA_Engine SHALL display a message indicating the issue and suggest the learner rephrase or ask a different question; constraint violations SHALL be reported before any processing is attempted

### Requirement 13: Revision Mode

**User Story:** As a learner, I want to take revision quizzes with subject-specific question formats, so that I can test my understanding and prepare for exams.

#### Acceptance Criteria

1. THE Revision_Engine SHALL support revision quizzes for all subjects that have at least one chapter with a saved transcript
2. THE Revision_Engine SHALL generate 5 to 20 questions per chapter across three difficulty levels: Easy, Medium, and Hard, where the learner selects a difficulty level before starting the session
3. THE Platform SHALL allow the learner to configure a timer between 5 and 120 minutes (in 5-minute increments) for each revision session, and WHEN the timer expires THE Platform SHALL auto-submit all answered questions and display the results screen
4. THE Revision_Engine SHALL support question types: MCQ (4 options with exactly 1 correct answer), Fill-in-the-blank, True/False, Short Answer (up to 100 characters), and Long Answer (up to 1000 characters, evaluated against model answer with a score from 0 to 100)
5. FOR language subjects (English, Hindi, Kannada, and custom language subjects), THE Revision_Engine SHALL additionally support Word Meaning and Sentence Forming question formats
6. FOR Maths, THE Revision_Engine SHALL additionally support practical questions (arithmetic operations) and problem-based questions (multi-step word problems)
7. FOR Computers, THE Revision_Engine SHALL additionally support lab-style questions (write code, identify output, debug a snippet)
8. FOR Science and EVS, THE Revision_Engine SHALL additionally support diagram-based questions (label, identify, explain)
9. WHEN a learner completes a revision session, THE Platform SHALL display a results screen showing: total score as a percentage, time taken, and per-question breakdown including the learner's answer, correct answer, and whether the response was correct or incorrect
10. THE Platform SHALL track revision progress over multiple attempts per chapter, displaying the number of attempts, highest score, and most recent score

### Requirement 14: Parent Dashboard

**User Story:** As a parent, I want a hierarchical view of all my learners' progress across subjects, books, and chapters, so that I can monitor their learning effectively.

#### Acceptance Criteria

1. THE Platform SHALL display a Parent Dashboard with a left panel showing tree navigation (Learner → Subject → Book → Chapter with completion percentage as an integer from 0 to 100 → Chapter Exercise with completion percentage as an integer from 0 to 100 → Quizzes), where chapter completion percentage is calculated as (pages read / total pages in chapter) × 100 rounded down, and exercise completion percentage is calculated as (questions answered correctly / total questions) × 100 rounded down
2. WHEN a parent clicks a chapter-level tree item, THE Platform SHALL update the right detail panel with: subject icon and chapter name, reading progress (percentage and progress bar), exercise score (percentage), pages read count, up to 10 most recent activity log entries each showing timestamp and action description, and the date and time of the learner's last session in that chapter
3. WHEN a parent clicks a non-chapter tree item (Learner, Subject, or Book level), THE Platform SHALL update the right detail panel with an aggregated summary showing: the item name, total completion percentage across child items, total pages read count, and up to 10 most recent activity log entries across all child items each showing timestamp and action description
4. IF a learner has no content added for a subject, book, or chapter, THEN THE Platform SHALL display an empty state message indicating no content is available yet, which may coexist alongside other UI elements such as aggregated summaries and navigation controls
5. THE Platform SHALL display progress data for all learners registered under the parent account, and SHALL refresh the displayed data each time the parent navigates to the dashboard or selects a different tree item

### Requirement 15: Learner Dashboard

**User Story:** As a learner, I want a dashboard showing my progress and quick actions for each chapter, so that I can easily continue my learning activities.

#### Acceptance Criteria

1. THE Platform SHALL display a Learner Dashboard with a left panel showing tree navigation (Subject → Book → Chapter with completion percentage → Chapter Exercise with completion percentage → Quizzes), where chapter completion percentage is calculated as (pages read / total content pages) × 100 rounded to the nearest integer, and exercise completion percentage is calculated as (exercises answered / total exercises) × 100 rounded to the nearest integer
2. WHEN a learner clicks a chapter tree item, THE Platform SHALL update the right detail panel with: chapter details (name, book, subject), stats cards (Read percentage, Exercise percentage, Pages Done calculated as total pages read, Pages Left calculated as total pages minus pages read), a progress bar reflecting the Read percentage, and action buttons (Continue Reading, Take Exercise, Listen)
3. WHEN a learner taps Continue Reading, THE Platform SHALL navigate to the Chapter Explanation view at the last read page, or at page 1 if no pages have been previously read
4. WHEN a learner taps Take Exercise, THE Platform SHALL navigate to the Chapter Exercise screen
5. WHEN a learner taps Listen, THE Platform SHALL navigate to the Chapter Explanation view in Speech mode starting at the last read page, or at page 1 if no pages have been previously read
6. IF a learner has no chapters added for any subject, THEN THE Platform SHALL display the tree navigation structure (subjects listed, even if empty) with the empty state message shown in the right detail panel indicating no content is available and providing guidance to add chapters

### Requirement 16: Manage Learners

**User Story:** As a parent, I want to view, edit, and remove learner profiles, so that I can keep learner information up to date.

#### Acceptance Criteria

1. THE Platform SHALL display a list of all registered learners under the parent account showing name, gender, grade, and subjects
2. WHEN a parent selects Edit on a learner, THE Platform SHALL allow modification of name, grade, school, and subjects, enforcing the same field constraints as Learner Registration (name: 5–20 alphabets and spaces; school: 5–30 characters; grade: valid dropdown value) and requiring at least 1 subject to remain selected
3. WHEN a parent selects Reset Password on a learner, THE Platform SHALL allow setting a new password that meets the password policy (8–20 characters; minimum 1 uppercase, 1 lowercase, 1 number, 1 special symbol) and SHALL display a single generic validation error message if the entered password does not meet any aspect of the policy
4. WHEN a parent selects Remove on a learner, THE Platform SHALL display a confirmation dialog stating that the learner profile and all associated data (chapters, progress, and exercise history) will be permanently deleted
5. IF a parent confirms removal in the confirmation dialog, THEN THE Platform SHALL perform a soft deletion (marking the learner profile as deleted while preserving the underlying record in the database) of the learner profile and all associated data as a single atomic operation — if any part of the deletion fails, no changes SHALL be committed — and remove the learner from the displayed list
6. IF a parent cancels the removal confirmation dialog, THEN THE Platform SHALL return to the learner list without modifying any data

### Requirement 17: Parent Profile and Settings

**User Story:** As a parent, I want to manage my account details, notification preferences, and data exports, so that I have full control over my account.

#### Acceptance Criteria

1. THE Platform SHALL display parent account details: Username (read-only), Name, Phone, Email, and Relationship
2. WHEN a parent selects Update Profile, THE Platform SHALL allow editing Name, Phone, Email, and Relationship with the same validation rules as registration, SHALL display field-specific error messages for any invalid input, and SHALL clear all error messages when all fields pass validation
3. WHEN a parent selects Update Password, THE Platform SHALL require the current password and validate the new password format (same validation rules as registration: 8–20 characters; minimum 1 uppercase, 1 lowercase, 1 number, 1 special symbol) regardless of whether the current password is correct; IF the current password is incorrect THEN SHALL display an error message without proceeding; IF the new password format is invalid THEN SHALL display a format error message
4. THE Platform SHALL provide notification preferences to enable or disable progress alerts and streak reminders, with both enabled by default
5. WHEN a parent selects Data Export, THE Platform SHALL generate and download learner progress reports covering all learners under the account in PDF or CSV format (user-selectable), including scores, completion percentages, and activity history
6. WHEN a parent selects Delete Account, THE Platform SHALL require the full Delete Account selection flow (password re-entry, data deletion warning listing all data to be removed) before allowing any deletion confirmation; THE Platform SHALL NOT allow deletion to proceed if the full flow is bypassed; upon confirmation, THE Platform SHALL schedule all account data for permanent deletion within 30 days
7. THE Platform SHALL allow parents to add custom subjects (1–50 characters, maximum 10 custom subjects per account) available to all their learners from the settings

### Requirement 18: Landing Page

**User Story:** As an unauthenticated visitor, I want to see a clear product overview with registration and login options, so that I can quickly understand the platform and get started.

#### Acceptance Criteria

1. WHILE the visitor is unauthenticated, THE Platform SHALL display a Landing Page containing all of the following elements: app logo and name ("ChikuMiku LearnVerse"), tagline "Where Curiosity Comes Alive", feature highlights (7 Subjects, Pronunciation, Scan & Learn, Quizzes), grade range indicator ("LKG to 12th Grade"), Register Now button (primary CTA), Login button (secondary CTA), platform indicators (Android App, Web Access), and safety badge ("Safe & secure for children • Parent-monitored")
2. WHEN a visitor taps Register Now, THE Platform SHALL navigate to the Parent Registration screen
3. WHEN a visitor taps Login, THE Platform SHALL navigate to the Login screen
4. IF an authenticated user navigates to the Landing Page URL, THEN THE Platform SHALL allow the user to view the landing page content without forcing a redirect to their dashboard
5. THE Platform SHALL render the Landing Page in a responsive layout that adapts to both mobile (minimum viewport width 360px) and web (content max-width 960px or greater) without loss of content or functionality

### Requirement 19: Performance

**User Story:** As a user, I want the platform to respond quickly to my actions, so that my learning experience is smooth and uninterrupted.

#### Acceptance Criteria

1. THE Platform SHALL respond to API requests (excluding OCR processing and AI content generation) within 2 seconds at the 95th percentile under a load of up to 500 concurrent users
2. WHEN a user performs a local interaction (UI tap, navigation), THE Platform SHALL provide a visual acknowledgment (such as a button state change, loading indicator, or screen transition start) within 100 milliseconds
3. THE Platform SHALL maintain a system uptime of 99.5 percent measured on a calendar-month basis, excluding pre-announced scheduled maintenance windows
4. THE OCR_Engine SHALL process each page image (up to 10 MB in size) within 15 seconds at the 95th percentile, applied to all OCR processing operations regardless of how they are triggered
5. THE Explanation_Engine SHALL generate a content explanation for a single page within 10 seconds at the 95th percentile
6. IF an API request exceeds 5 seconds without completing, THEN THE Platform SHALL display a timeout indication to the user and allow the user to retry the request without loss of previously entered data; data preservation and retry capability SHALL function even if the timeout indication fails to render

### Requirement 20: Security and Privacy

**User Story:** As a parent, I want my children's data handled securely and in compliance with child privacy laws, so that I can trust the platform with sensitive information.

#### Acceptance Criteria

1. THE Platform SHALL transmit all data over HTTPS using TLS 1.2 or higher, and SHALL reject connections using older protocol versions
2. THE Platform SHALL store passwords using bcrypt with a minimum cost factor of 10, or scrypt with equivalent computational cost
3. THE Platform SHALL store session tokens in httpOnly secure cookies (web) or platform-secure storage (mobile) that are not accessible to client-side scripts, and SHALL issue JWT tokens with a maximum expiration of 60 minutes, requiring silent refresh thereafter
4. WHEN a sensitive action is requested (account deletion, data export, or learner removal), THE Platform SHALL actively block the action from proceeding until the parent re-enters their account password and the password is verified as correct
5. THE Platform SHALL collect verifiable parental consent before storing any learner personal data, SHALL collect only the minimum data fields required for platform functionality as defined in Section 2.3, and SHALL delete all learner data within 30 days of a parent-initiated deletion request
6. THE Platform SHALL not include third-party tracking scripts, advertising SDKs, or analytics services that transmit learner data to external parties
7. IF a JWT token has expired or is invalid, THEN THE Platform SHALL reject the request and return an authentication error indicating the session must be refreshed

### Requirement 21: Offline Support and Data Persistence

**User Story:** As a learner, I want to access previously loaded chapters without internet, so that I can continue studying in offline conditions.

#### Acceptance Criteria

1. WHEN a learner saves a chapter transcript or completes reading a chapter page, THE Platform SHALL automatically persist the chapter transcript, page-by-page explanations, exercise questions, and the learner's progress data (reading percentage, exercise scores, and quiz results) to local storage within 5 seconds as a single atomic operation; IF any component cannot be saved, THE Platform SHALL fail the entire persistence operation and notify the learner
2. IF the device has no internet connection, THEN THE Platform SHALL make all chapters whose transcripts have been previously saved to local storage accessible in read mode, including chapter explanations and previously generated exercises
3. WHEN the device regains internet connectivity after an offline session, THE Platform SHALL synchronize any progress data recorded offline to the server within 30 seconds, and SHALL display an indicator to the learner while synchronization is in progress
4. THE Platform SHALL organize content by academic year, where academic year is determined by the grade selected in the learner's profile, and SHALL retain content from prior academic years in a read-only archive accessible to both parent and learner
5. THE Platform SHALL retain historical progress data (scores, completion percentages, and activity logs) for a minimum of 3 academic years for comparison across time periods
6. WHILE the device has no internet connection, THE Platform SHALL display a visible offline indicator and SHALL disable actions that require server communication (adding new chapters, generating new exercises, pronunciation practice)

### Requirement 22: Accessibility

**User Story:** As a user with accessibility needs, I want the platform to support assistive technologies and age-appropriate sizing, so that the platform is usable for all children.

#### Acceptance Criteria

1. THE Platform SHALL use minimum body font sizes based on grade level bands: at least 18px for LKG to 2nd Grade, at least 16px for 3rd to 5th Grade, and at least 14px for 6th to 12th Grade on mobile devices, with web sizes 2px larger than mobile for each band
2. THE Platform SHALL provide a high contrast mode toggle accessible from the learner and parent profile settings, where enabled high contrast mode renders all text and interactive elements with a minimum contrast ratio of 7:1 against their background
3. THE Platform SHALL comply with WCAG 2.1 Level AA for screen reader compatibility, including semantic labeling of all interactive elements, logical reading order, and focus management for navigation between screens
4. THE Platform SHALL use touch targets of minimum 48×48 density-independent pixels on mobile devices for all interactive elements including buttons, links, icons, and form controls

### Requirement 23: Design System

**User Story:** As a user, I want a child-friendly, consistent visual experience, so that the platform feels welcoming and easy to navigate.

#### Acceptance Criteria

1. THE Platform SHALL use the defined color palette with Primary Pink (#E94F9B), Secondary Purple (#9B59B6), Accent Blue (#5DADE2), Warning Gold (#F7C948), Success Green (#27AE60), Error Red (#E74C3C), Dark (#2C2341), Page Background (#F8F5FF), Border (#E0D8EC), Hindi Gold (#E5A100), Computers Indigo (#4A6CF7), EVS Orange (#E67E22), and Custom Subject teal for any parent-added subjects
2. THE Platform SHALL validate and enforce all font requirements together: a system font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif) with 14px body size on mobile and 16px on web, and a minimum rendered font size of 12px for any text element; slight rendering variations due to browser or system font scaling differences SHALL be acceptable and SHALL NOT block platform operation
3. THE Platform SHALL render buttons in pill shape (border-radius 20–22px), primary content cards (chapter cards, subject cards, dashboard detail panels) with border-radius 16px, and secondary UI elements (tags, badges, inline info boxes) with border-radius 10px
4. THE Platform SHALL enforce exact design measurements: mobile viewport of 360×720px minimum, web content maximum width of 960px or greater, and all interactive elements (buttons, icons, toggles) meeting a minimum touch target size of exactly 48×48dp on mobile
5. THE Platform SHALL display the logo watermark at 75% of screen width with 7–10% opacity on applicable screens
6. THE Platform SHALL enforce exact WCAG numerical contrast requirements: a minimum color contrast ratio of 4.5:1 for normal text (below 18px) and 3:1 for large text (18px and above) against their background colors, verified against the specific ratios defined in WCAG 2.1 AA

### Requirement 24: Serverless Architecture

**User Story:** As a product owner, I want the platform deployed on AWS serverless infrastructure, so that it scales automatically and minimizes operational overhead.

#### Acceptance Criteria

1. THE Platform SHALL deploy all compute components, including API handlers and the AI Gateway service, as AWS Lambda functions with memory allocation configured per function type based on specific needs (e.g., higher memory for AI Gateway and OCR processing functions) and a maximum execution timeout of 900 seconds per invocation
2. THE Platform SHALL use Amazon API Gateway for REST and WebSocket APIs
3. THE Platform SHALL use Amazon S3 for page image and audio file storage
4. THE Platform SHALL use Amazon RDS Aurora Serverless (PostgreSQL with pgvector extension) for relational data and vector search
5. THE Platform SHALL use Amazon Cognito for session management and JWT token issuance
6. THE Platform SHALL use Amazon CloudFront as CDN for static assets and web application delivery
7. THE Platform SHALL use Amazon SQS for asynchronous OCR processing and AI job queuing
8. THE Platform SHALL use Amazon SNS for streak alert and progress notification delivery
9. THE Platform SHALL use AWS Secrets Manager for storing third-party API keys (OpenAI, Google)
10. THE Platform SHALL use Amazon CloudWatch for centralized logging, performance metrics, and operational alarms across all deployed services
11. THE Platform SHALL define all infrastructure resources using infrastructure-as-code templates that enable repeatable deployment to any AWS region without manual configuration
12. THE Platform SHALL auto-scale Lambda concurrency based on incoming request volume with no manual intervention required to handle usage spikes

### Requirement 25: AI Cost Optimization

**User Story:** As a product owner, I want AI-generated content cached and reused, so that operational costs remain low at scale.

#### Acceptance Criteria

1. WHEN a chapter transcript is saved for the first time, THE Platform SHALL attempt to generate chapter summaries, revision questions, pronunciation audio assets, and explanations for that chapter; IF generation succeeds, THE Platform SHALL store the assets for reuse until the chapter is deleted; IF generation fails, THE Platform SHALL NOT mark the chapter as processed and SHALL retry generation on the next user request for that chapter's content
2. IF a learner edits and re-saves a chapter transcript after AI assets have already been generated, THEN THE Platform SHALL regenerate all associated AI assets (summaries, revision questions, pronunciation audio, and explanations) to reflect the updated content
3. WHEN a learner requests chapter content that has previously been generated (summaries, explanations, revision questions, or pronunciation audio), THE Platform SHALL serve the stored version without invoking the LLM; WHEN a learner requests content that has never been generated, THE Platform SHALL attempt to generate it on demand
4. THE QA_Engine SHALL use RAG (retrieving the top 5 relevant paragraphs via vector search) rather than sending entire chapter text to the LLM
5. THE Platform SHALL use rule-based engines (not LLMs) for progress tracking, weak-area detection, content recommendations, and analytics
6. THE Platform SHALL send only OCR-extracted text (not raw images) to LLM services for content generation
