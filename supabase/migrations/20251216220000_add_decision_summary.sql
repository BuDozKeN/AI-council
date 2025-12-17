-- =============================================
-- ADD DECISION SUMMARY TO KNOWLEDGE ENTRIES
-- =============================================
-- Stores an AI-generated brief summary of the decision for quick scanning.
-- This helps users understand what a decision is about without expanding it.

-- Add decision_summary column for AI-generated summary
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS decision_summary TEXT;

-- =============================================
-- VERIFICATION
-- =============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'decision_summary'
    ) THEN
        RAISE NOTICE 'SUCCESS: decision_summary column added to knowledge_entries';
    END IF;
END $$;
