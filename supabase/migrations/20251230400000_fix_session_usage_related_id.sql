-- =============================================
-- FIX SESSION_USAGE RELATED_ID COLUMN
-- =============================================
-- Fixes foreign key constraint violation (error 23503) when
-- internal LLM operations pass project_id instead of conversation_id.
--
-- The save_internal_llm_usage function was reusing conversation_id
-- to store related_id (which could be a project_id), causing FK violations.

-- =============================================
-- ADD RELATED_ID COLUMN
-- =============================================
-- Stores the related resource ID (project_id, decision_id, etc.)
-- without foreign key constraint since it can reference multiple tables.

ALTER TABLE session_usage
ADD COLUMN IF NOT EXISTS related_id UUID;

-- Add index for querying by related resource
CREATE INDEX IF NOT EXISTS idx_session_usage_related_id
ON session_usage(related_id)
WHERE related_id IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN session_usage.related_id IS
'Optional reference to related resource (project_id, decision_id, etc.). No FK constraint since it can reference multiple tables.';

-- =============================================
-- MIGRATE EXISTING DATA
-- =============================================
-- For internal operations that incorrectly stored project_id in conversation_id,
-- move the value to related_id and clear conversation_id.
-- This fixes orphaned references.

UPDATE session_usage
SET
    related_id = conversation_id,
    conversation_id = NULL
WHERE
    session_type LIKE 'internal_%'
    AND conversation_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM conversations c WHERE c.id = session_usage.conversation_id
    );
