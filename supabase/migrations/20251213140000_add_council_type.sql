-- =============================================
-- ADD COUNCIL TYPE TO KNOWLEDGE ENTRIES
-- =============================================
-- This migration adds a council_type field to track which council
-- (CTO Council, Legal Council, Board, etc.) made the decision.
-- =============================================

-- Add council_type column
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS council_type TEXT;

-- Index for filtering by council type
CREATE INDEX IF NOT EXISTS idx_knowledge_council_type ON knowledge_entries(council_type);

-- Add comment for documentation
COMMENT ON COLUMN knowledge_entries.council_type IS 'The type of council that made this decision (e.g., CTO Council, Legal Council, Board)';

-- Verification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'council_type'
    ) THEN
        RAISE NOTICE 'SUCCESS: council_type column added to knowledge_entries';
    END IF;
END $$;
