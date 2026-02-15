-- =============================================
-- FIX SESSION_USAGE SESSION_TYPE CONSTRAINT
-- =============================================
-- The existing CHECK constraint only allowed 11 specific session_type values,
-- but the backend dynamically generates many more internal_* types
-- (write_assist, text_polish, role_structuring, playbook_generation, etc.)
-- causing constraint violations in production.
--
-- Fix: Replace the brittle allowlist with a pattern-based constraint that
-- allows any 'internal_*' value plus the known user-facing session types.

ALTER TABLE session_usage
DROP CONSTRAINT IF EXISTS session_usage_session_type_check;

ALTER TABLE session_usage
ADD CONSTRAINT session_usage_session_type_check
CHECK (
    -- User-facing session types (explicit allowlist)
    session_type IN ('council', 'chat', 'triage', 'document')
    -- Internal operations: any internal_* type is valid
    -- This avoids needing a migration every time a new operation is added
    OR session_type LIKE 'internal_%'
);

-- Update column comment to reflect the flexible pattern
COMMENT ON COLUMN session_usage.session_type IS
'Session type: council/chat/triage/document for user-facing sessions, internal_* for background LLM operations (title generation, write assist, text polish, etc.). Any internal_* value is accepted.';
