-- ============================================================================
-- DROP LEGACY DECISIONS TABLE
-- ============================================================================
-- The 'decisions' table was replaced by 'knowledge_entries' in migration
-- 20251213120000_knowledge_entries_consolidation.sql
--
-- All backend code now uses knowledge_entries exclusively.
-- This migration removes the unused legacy table.
-- ============================================================================

-- First, check if any data exists (should be 0 after consolidation)
-- If this returns rows, data migration may be needed first
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM decisions;
    IF row_count > 0 THEN
        RAISE NOTICE 'WARNING: decisions table has % rows. Verify data was migrated to knowledge_entries before dropping.', row_count;
    ELSE
        RAISE NOTICE 'decisions table is empty, safe to drop.';
    END IF;
END $$;

-- Drop RLS policies first
DROP POLICY IF EXISTS "decisions_access" ON decisions;
DROP POLICY IF EXISTS "decisions_select" ON decisions;
DROP POLICY IF EXISTS "decisions_insert" ON decisions;
DROP POLICY IF EXISTS "decisions_update" ON decisions;
DROP POLICY IF EXISTS "decisions_delete" ON decisions;

-- Drop the legacy table
DROP TABLE IF EXISTS decisions;

-- Verify table is gone
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'decisions' AND table_schema = 'public') THEN
        RAISE NOTICE 'SUCCESS: decisions table has been dropped.';
    END IF;
END $$;
