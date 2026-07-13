-- ============================================================================
-- ChikuMiku LearnVerse — Complete Database Schema for Neon PostgreSQL
-- ============================================================================
-- Run this single script against your Neon database to create all entities.
-- Neon supports pgvector natively — just enable the extension.
--
-- Usage:
--   psql "postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/learnverse?sslmode=require" -f neon-init.sql
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Parent: registered adult users who manage learner profiles
CREATE TABLE IF NOT EXISTS parent (
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
CREATE TABLE IF NOT EXISTS learner (
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
CREATE TABLE IF NOT EXISTS subject (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    parent_id UUID REFERENCES parent(id) ON DELETE CASCADE
);

-- Book: a book owned by a learner within a subject
CREATE TABLE IF NOT EXISTS book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Chapter: a unit of content within a book
CREATE TABLE IF NOT EXISTS chapter (
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
CREATE TABLE IF NOT EXISTS page (
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
CREATE TABLE IF NOT EXISTS explanation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
    audio_s3_key VARCHAR(512),
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Revision question: AI-generated quiz questions per chapter
CREATE TABLE IF NOT EXISTS revision_question (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL,
    question_type VARCHAR(30) NOT NULL,
    question_data JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Quiz attempt: records a learner's quiz session
CREATE TABLE IF NOT EXISTS quiz_attempt (
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
CREATE TABLE IF NOT EXISTS grammar_exercise (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    exercise_type VARCHAR(30) NOT NULL,
    exercise_data JSONB NOT NULL,
    correct_answer JSONB NOT NULL,
    grammar_rule VARCHAR(100) NOT NULL
);

-- Pronunciation asset: TTS audio for words/sentences in a chapter
CREATE TABLE IF NOT EXISTS pronunciation_asset (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    word_or_sentence TEXT NOT NULL,
    audio_s3_key VARCHAR(512) NOT NULL,
    language VARCHAR(50) NOT NULL
);

-- Activity log: tracks all learner activities for streaks and analytics
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapter(id) ON DELETE SET NULL,
    activity_type VARCHAR(30) NOT NULL,
    local_date DATE NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Embedding: pgvector content chunks for RAG retrieval (text-embedding-3-small = 1536 dimensions)
CREATE TABLE IF NOT EXISTS embedding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL
);

-- QA session: tracks interactive question-answer sessions
CREATE TABLE IF NOT EXISTS qa_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learner_id UUID NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
    question_count INTEGER NOT NULL DEFAULT 0,
    context_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Parent
CREATE INDEX IF NOT EXISTS idx_parent_deleted_at ON parent(deleted_at) WHERE deleted_at IS NOT NULL;

-- Learner
CREATE INDEX IF NOT EXISTS idx_learner_parent_id ON learner(parent_id);
CREATE INDEX IF NOT EXISTS idx_learner_deleted_at ON learner(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subject
CREATE INDEX IF NOT EXISTS idx_subject_parent_id ON subject(parent_id);
CREATE INDEX IF NOT EXISTS idx_subject_is_default ON subject(is_default) WHERE is_default = TRUE;

-- Book
CREATE INDEX IF NOT EXISTS idx_book_learner_id ON book(learner_id);
CREATE INDEX IF NOT EXISTS idx_book_subject_id ON book(subject_id);

-- Chapter
CREATE INDEX IF NOT EXISTS idx_chapter_book_id ON chapter(book_id);
CREATE INDEX IF NOT EXISTS idx_chapter_academic_year ON chapter(academic_year);

-- Page
CREATE INDEX IF NOT EXISTS idx_page_chapter_id ON page(chapter_id);
CREATE INDEX IF NOT EXISTS idx_page_ocr_status ON page(ocr_status) WHERE ocr_status != 'completed';

-- Explanation
CREATE INDEX IF NOT EXISTS idx_explanation_page_id ON explanation(page_id);

-- Revision question
CREATE INDEX IF NOT EXISTS idx_revision_question_chapter_id ON revision_question(chapter_id);
CREATE INDEX IF NOT EXISTS idx_revision_question_difficulty ON revision_question(chapter_id, difficulty);

-- Quiz attempt
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_learner_id ON quiz_attempt(learner_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_chapter_id ON quiz_attempt(chapter_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_learner_chapter ON quiz_attempt(learner_id, chapter_id);

-- Grammar exercise
CREATE INDEX IF NOT EXISTS idx_grammar_exercise_chapter_id ON grammar_exercise(chapter_id);

-- Pronunciation asset
CREATE INDEX IF NOT EXISTS idx_pronunciation_asset_chapter_id ON pronunciation_asset(chapter_id);

-- Activity log (critical for streak calculations)
CREATE INDEX IF NOT EXISTS idx_activity_log_learner_id ON activity_log(learner_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_learner_date ON activity_log(learner_id, local_date);
CREATE INDEX IF NOT EXISTS idx_activity_log_chapter_id ON activity_log(chapter_id);

-- Embedding
CREATE INDEX IF NOT EXISTS idx_embedding_chapter_id ON embedding(chapter_id);
CREATE INDEX IF NOT EXISTS idx_embedding_chapter_page ON embedding(chapter_id, page_number);

-- HNSW index for fast vector similarity search (RAG)
CREATE INDEX IF NOT EXISTS idx_embedding_vector_hnsw ON embedding
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- QA session
CREATE INDEX IF NOT EXISTS idx_qa_session_learner_id ON qa_session(learner_id);
CREATE INDEX IF NOT EXISTS idx_qa_session_chapter_id ON qa_session(chapter_id);
CREATE INDEX IF NOT EXISTS idx_qa_session_learner_chapter ON qa_session(learner_id, chapter_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed default subjects
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO subject (name, is_default, parent_id) VALUES
    ('English', TRUE, NULL),
    ('Hindi', TRUE, NULL),
    ('Kannada', TRUE, NULL),
    ('Maths', TRUE, NULL),
    ('Science', TRUE, NULL),
    ('EVS', TRUE, NULL),
    ('Computers', TRUE, NULL)
ON CONFLICT DO NOTHING;

COMMIT;
