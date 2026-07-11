-- 002_create_tables.sql
-- Create all entity tables for ChikuMiku LearnVerse
-- Compatible with Aurora PostgreSQL 15.4+

-- Parent: registered adult users who manage learner profiles
CREATE TABLE parent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(15) NOT NULL UNIQUE,
    full_name VARCHAR(20) NOT NULL,
    phone VARCHAR(10) NOT NULL,
    email VARCHAR(30) NOT NULL,
    password_hash TEXT NOT NULL,
    progress_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    streak_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Learner: student users linked to a parent account
CREATE TABLE learner (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
    username VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    gender VARCHAR(10) NOT NULL,
    relationship VARCHAR(10) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    school_name VARCHAR(30) NOT NULL,
    subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Subject: default or custom subjects created by parents
CREATE TABLE subject (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    parent_id UUID REFERENCES parent(id) ON DELETE CASCADE
);

-- Book: a book owned by a learner within a subject
CREATE TABLE book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Chapter: a unit of content within a book (up to 50 pages)
CREATE TABLE chapter (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES book(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    chapter_name VARCHAR(100) NOT NULL,
    ai_assets_generated BOOLEAN NOT NULL DEFAULT FALSE,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chapter_book_number UNIQUE (book_id, chapter_number)
);

-- Page: an OCR-captured page within a chapter
CREATE TABLE page (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    classification VARCHAR(20) NOT NULL DEFAULT 'content',
    image_s3_key VARCHAR(512),
    transcript_text TEXT,
    detected_language VARCHAR(50),
    ocr_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_page_classification CHECK (classification IN ('content', 'exercise'))
);

-- Explanation: AI-generated page-by-page explanations
CREATE TABLE explanation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
    audio_s3_key VARCHAR(512),
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Revision question: AI-generated quiz questions per chapter
CREATE TABLE revision_question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    question_data JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Quiz attempt: records a learner's quiz session
CREATE TABLE quiz_attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    score_percentage INTEGER NOT NULL,
    time_taken_seconds INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Grammar exercise: AI-generated grammar exercises per chapter
CREATE TABLE grammar_exercise (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    exercise_type VARCHAR(30) NOT NULL,
    exercise_data JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    grammar_rule VARCHAR(100) NOT NULL
);

-- Pronunciation asset: TTS audio for words/sentences in a chapter
CREATE TABLE pronunciation_asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    word_or_sentence TEXT NOT NULL,
    audio_s3_key VARCHAR(512) NOT NULL,
    language VARCHAR(50) NOT NULL
);

-- Activity log: tracks all learner activities for streaks and analytics
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapter(id) ON DELETE SET NULL,
    activity_type VARCHAR(30) NOT NULL,
    local_date DATE NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Embedding: pgvector-based content chunks for RAG retrieval
CREATE TABLE embedding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL
);

-- QA session: tracks interactive question-answer sessions
CREATE TABLE qa_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    question_count INTEGER NOT NULL DEFAULT 0,
    context_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
