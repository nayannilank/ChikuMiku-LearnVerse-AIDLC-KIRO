-- 003_create_indexes.sql
-- Create indexes for performance optimization
-- Compatible with Aurora PostgreSQL 15.4+

SET search_path TO "chikumiku-learnverse", public;

-- Parent indexes
CREATE INDEX idx_parent_deleted_at ON "chikumiku-learnverse".parent(deleted_at) WHERE deleted_at IS NOT NULL;

-- Learner indexes
CREATE INDEX idx_learner_parent_id ON "chikumiku-learnverse".learner(parent_id);
CREATE INDEX idx_learner_deleted_at ON "chikumiku-learnverse".learner(deleted_at) WHERE deleted_at IS NOT NULL;

-- Subject indexes
CREATE INDEX idx_subject_parent_id ON "chikumiku-learnverse".subject(parent_id);
CREATE INDEX idx_subject_is_default ON "chikumiku-learnverse".subject(is_default) WHERE is_default = TRUE;

-- Book indexes
CREATE INDEX idx_book_learner_id ON "chikumiku-learnverse".book(learner_id);
CREATE INDEX idx_book_subject_id ON "chikumiku-learnverse".book(subject_id);

-- Chapter indexes
CREATE INDEX idx_chapter_book_id ON "chikumiku-learnverse".chapter(book_id);
CREATE INDEX idx_chapter_academic_year ON "chikumiku-learnverse".chapter(academic_year);

-- Page indexes
CREATE INDEX idx_page_chapter_id ON "chikumiku-learnverse".page(chapter_id);
CREATE INDEX idx_page_ocr_status ON "chikumiku-learnverse".page(ocr_status) WHERE ocr_status != 'completed';

-- Explanation indexes
CREATE INDEX idx_explanation_page_id ON "chikumiku-learnverse".explanation(page_id);

-- Revision question indexes
CREATE INDEX idx_revision_question_chapter_id ON "chikumiku-learnverse".revision_question(chapter_id);
CREATE INDEX idx_revision_question_difficulty ON "chikumiku-learnverse".revision_question(chapter_id, difficulty);

-- Quiz attempt indexes
CREATE INDEX idx_quiz_attempt_learner_id ON "chikumiku-learnverse".quiz_attempt(learner_id);
CREATE INDEX idx_quiz_attempt_chapter_id ON "chikumiku-learnverse".quiz_attempt(chapter_id);
CREATE INDEX idx_quiz_attempt_learner_chapter ON "chikumiku-learnverse".quiz_attempt(learner_id, chapter_id);

-- Grammar exercise indexes
CREATE INDEX idx_grammar_exercise_chapter_id ON "chikumiku-learnverse".grammar_exercise(chapter_id);

-- Pronunciation asset indexes
CREATE INDEX idx_pronunciation_asset_chapter_id ON "chikumiku-learnverse".pronunciation_asset(chapter_id);

-- Activity log indexes (critical for streak calculations and analytics)
CREATE INDEX idx_activity_log_learner_id ON "chikumiku-learnverse".activity_log(learner_id);
CREATE INDEX idx_activity_log_learner_date ON "chikumiku-learnverse".activity_log(learner_id, local_date);
CREATE INDEX idx_activity_log_chapter_id ON "chikumiku-learnverse".activity_log(chapter_id);

-- Embedding indexes
CREATE INDEX idx_embedding_chapter_id ON "chikumiku-learnverse".embedding(chapter_id);
CREATE INDEX idx_embedding_chapter_page ON "chikumiku-learnverse".embedding(chapter_id, page_number);

-- HNSW index on embedding column for fast approximate nearest neighbor search
-- Uses cosine distance operator for text-embedding-3-small vectors
CREATE INDEX idx_embedding_vector_hnsw ON "chikumiku-learnverse".embedding
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- QA session indexes
CREATE INDEX idx_qa_session_learner_id ON "chikumiku-learnverse".qa_session(learner_id);
CREATE INDEX idx_qa_session_chapter_id ON "chikumiku-learnverse".qa_session(chapter_id);
CREATE INDEX idx_qa_session_learner_chapter ON "chikumiku-learnverse".qa_session(learner_id, chapter_id);
