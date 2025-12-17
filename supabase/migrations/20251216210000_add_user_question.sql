-- =============================================
-- ADD USER QUESTION TO KNOWLEDGE ENTRIES
-- =============================================
-- Stores the original user question that triggered the council session.
-- This provides critical context when viewing decisions later -
-- you need to know what was asked to understand the answer.

-- Add user_question column to store the original question
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS user_question TEXT;

-- Add index for searching by user_question
CREATE INDEX IF NOT EXISTS idx_knowledge_user_question
    ON knowledge_entries USING GIN (to_tsvector('english', user_question))
    WHERE user_question IS NOT NULL;

-- =============================================
-- VERIFICATION
-- =============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'user_question'
    ) THEN
        RAISE NOTICE 'SUCCESS: user_question column added to knowledge_entries';
    END IF;
END $$;
