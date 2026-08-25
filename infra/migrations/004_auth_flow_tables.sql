-- 004_auth_flow_tables.sql
-- Tables supporting learner registration consent and the password-reset flow.
-- Compatible with Aurora/Neon PostgreSQL 15.4+.

-- Parental consent: records a parent's COPPA-style consent to create learners.
-- One active consent row per parent (version tracks the consent text revision).
CREATE TABLE IF NOT EXISTS parental_consent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
    consent_version VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- OTP records: one-time passcodes for the forgot-password flow.
-- 6-digit code, 5-minute validity, max 3 attempts, single-use (invalidated flag).
CREATE TABLE IF NOT EXISTS otp_record (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(15) NOT NULL,
    code VARCHAR(6) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    invalidated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Password reset tokens: issued after successful OTP verification, single-use.
CREATE TABLE IF NOT EXISTS password_reset_token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(15) NOT NULL,
    token VARCHAR(128) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parental_consent_parent_id ON parental_consent(parent_id);
CREATE INDEX IF NOT EXISTS idx_parental_consent_active
    ON parental_consent(parent_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_otp_record_username ON otp_record(username);
-- Latest-active-OTP lookups filter by username + not-invalidated, newest first.
CREATE INDEX IF NOT EXISTS idx_otp_record_username_created
    ON otp_record(username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_username ON password_reset_token(username);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_lookup
    ON password_reset_token(username, token);
