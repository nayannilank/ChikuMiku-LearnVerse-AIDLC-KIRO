-- 001_enable_extensions.sql
-- Enable required PostgreSQL extensions for ChikuMiku LearnVerse
-- Compatible with Aurora PostgreSQL 15.4+

-- uuid-ossp: Generate UUIDs for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pgvector: Vector similarity search for RAG embeddings
CREATE EXTENSION IF NOT EXISTS "vector";
