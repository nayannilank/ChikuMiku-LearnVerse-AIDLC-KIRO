-- 003_create_indexes.sql
-- Create indexes for performance optimization
-- Compatible with Aurora PostgreSQL 15.4+

-- Parent indexes
CREATE INDEX idx_parent_deleted_at ON parent(deleted_at) WHERE deleted_at IS NOT NULL;

-- Learner indexes
CREATE INDEX idx_learner_parent_id ON learner(parent_id);
CREATE INDEX idx_learner_deleted_at ON learner(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subject indexes
CREATE INDEX idx_subject_parent_id ON subject(parent_id);
CREATE INDEX idx_subject_is_default ON subject(is_default) WHERE is_default = TRUE;

-- Book indexes
CREATE INDEX idx_book_learner_id ON book(learner_id);
CREATE INDEX idx_book_subject_id ON book(subject_id);

-- Chapter indexes
CREATE INDEX idx_chapter_book_id ON chapter(book_id);
CREATE INDEX idx_chapter_academic_year ON chapter(academic_year);

-- Page indexes
CREATE INDEX idx_page_chapter_id ON page(chapter_id);
CREATE INDEX idx_page_ocr_status ON page(ocr_status) WHERE ocr_status != 'completed';

-- Explanation indexes
CREATE INDEX idx_explanation_page_id ON explanation(page_id);

-- Revision question indexes
CREATE INDEX idx_revision_question_chapter_id ON revision_question(chapter_id);
CREATE INDEX idx_revision_question_difficulty ON revision_question(chapter_id, difficulty);

-- Quiz attempt indexes
CREATE INDEX idx_quiz_attempt_learner_id ON quiz_attempt(learner_id);
CREATE INDEX idx_quiz_attempt_chapter_id ON quiz_attempt(chapter_id);
CREATE INDEX idx_quiz_attempt_learner_chapter ON quiz_attempt(learner_id, chapter_id);

-- Grammar exercise indexes
CREATE INDEX idx_grammar_exercise_chapter_id ON grammar_exercise(chapter_id);

-- Pronunciation asset indexes
CREATE INDEX idx_pronunciation_asset_chapter_id ON pronunciation_asset(chapter_id);

-- Activity log indexes (critical for streak calculations and analytics)
CREATE INDEX idx_activity_log_learner_id ON activity_log(learner_id);
CREATE INDEX idx_activity_log_learner_date ON activity_log(learner_id, local_date);
CREATE INDEX idx_activity_log_chapter_id ON activity_log(chapter_id);

-- Embedding indexes
CREATE INDEX idx_embedding_chapter_id ON embedding(chapter_id);
CREATE INDEX idx_embedding_chapter_page ON embedding(chapter_id, page_number);

-- HNSW index on embedding column for fast approximate nearest neighbor search
-- Uses cosine distance operator for text-embedding-3-small vectors
CREATE INDEX idx_embedding_vector_hnsw ON embedding
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- QA session indexes
CREATE INDEX idx_qa_session_learner_id ON qa_session(learner_id);
CREATE INDEX idx_qa_session_chapter_id ON qa_session(chapter_id);
CREATE INDEX idx_qa_session_learner_chapter ON qa_session(learner_id, chapter_id);
