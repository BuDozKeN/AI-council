-- Add department_ids column to knowledge_entries for multi-department decisions
-- This allows decisions to be associated with multiple departments
-- Note: department_id in knowledge_entries may be TEXT type (not UUID) due to historical reasons

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS department_ids TEXT[];

-- Index for efficient filtering by department_ids array
CREATE INDEX IF NOT EXISTS idx_knowledge_department_ids
    ON knowledge_entries USING GIN (department_ids)
    WHERE department_ids IS NOT NULL;

-- Migrate existing single department_id to department_ids array
-- Only migrate valid UUIDs (skip slugs like 'ux', 'all', etc.)
UPDATE knowledge_entries
SET department_ids = ARRAY[department_id]
WHERE department_id IS NOT NULL
AND department_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
AND (department_ids IS NULL OR array_length(department_ids, 1) IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN knowledge_entries.department_ids IS 'Array of department UUIDs this decision applies to (multi-department support)';

-- Verification
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'department_ids'
    ) THEN
        RAISE NOTICE 'SUCCESS: department_ids column added to knowledge_entries';
    END IF;
END $$;
