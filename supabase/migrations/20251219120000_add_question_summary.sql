-- =============================================
-- ADD QUESTION_SUMMARY COLUMN
-- =============================================
-- The user_question field stores the raw question text which can be long and messy.
-- This new field stores an AI-generated concise summary of what the user asked.
-- =============================================

-- Add question_summary column to store the AI-summarized question
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS question_summary TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN knowledge_entries.question_summary IS 'AI-generated concise summary of the user question (2-3 sentences max)';
