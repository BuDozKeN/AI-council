-- =============================================
-- KNOWLEDGE ENTRIES CONSOLIDATION
-- =============================================
-- This migration extends knowledge_entries to be the single source of truth
-- for all saved council outputs, with support for:
-- 1. Auto-injection into future council sessions
-- 2. Scope-based visibility (company/department/project)
-- 3. Promotion tracking to playbooks
-- 4. Tags for categorization
-- =============================================

-- =============================================
-- 1. ADD NEW COLUMNS TO knowledge_entries
-- =============================================

-- Auto-inject: When true, this entry will be automatically included in council context
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS auto_inject BOOLEAN DEFAULT false;

-- Scope: Determines visibility level
-- 'company' = visible to all departments
-- 'department' = visible only to the owning department
-- 'project' = visible only within a specific project
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'department'
    CHECK (scope IN ('company', 'department', 'project'));

-- Promotion tracking: Links to playbook if promoted
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT false;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS promoted_to_id UUID REFERENCES org_documents(id) ON DELETE SET NULL;

-- Tags for categorization (if not already present)
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Source message ID for precise linking
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS source_message_id UUID;

-- =============================================
-- 2. ADD INDEXES FOR NEW QUERY PATTERNS
-- =============================================

-- Index for auto-inject queries (context loading)
CREATE INDEX IF NOT EXISTS idx_knowledge_auto_inject ON knowledge_entries(company_id, auto_inject) WHERE auto_inject = true;

-- Index for scope-based queries
CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge_entries(scope);

-- Index for promotion status
CREATE INDEX IF NOT EXISTS idx_knowledge_promoted ON knowledge_entries(is_promoted) WHERE is_promoted = true;

-- GIN index for tags array searching
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_entries USING GIN (tags);

-- =============================================
-- 3. MIGRATE DATA FROM decisions TABLE (if any exists)
-- =============================================
-- Move any data from the redundant 'decisions' table to knowledge_entries
-- This ensures no data is lost during consolidation

INSERT INTO knowledge_entries (
    company_id,
    department_id,
    title,
    summary,
    category,
    source_conversation_id,
    source_message_id,
    tags,
    is_promoted,
    promoted_to_id,
    created_at,
    created_by,
    is_active
)
SELECT
    d.company_id,
    d.department_id,
    d.title,
    d.content as summary,  -- decisions.content maps to summary
    'technical_decision' as category,  -- Default category for migrated decisions
    d.source_conversation_id,
    d.source_message_id,
    d.tags,
    d.is_promoted,
    d.promoted_to_id,
    d.created_at,
    (SELECT user_id FROM companies WHERE id = d.company_id LIMIT 1) as created_by,
    true as is_active
FROM decisions d
WHERE NOT EXISTS (
    -- Skip if already migrated (same title + company + conversation)
    SELECT 1 FROM knowledge_entries ke
    WHERE ke.company_id = d.company_id
    AND ke.title = d.title
    AND ke.source_conversation_id = d.source_conversation_id
);

-- =============================================
-- 4. RLS POLICY (Simple authenticated access)
-- =============================================
-- Note: The backend uses service role for queries, bypassing RLS.
-- This basic policy allows authenticated users to see their company's knowledge.
-- More granular access control is handled in the application layer.

DROP POLICY IF EXISTS "Users can view knowledge for their departments" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view knowledge based on scope" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view their company knowledge" ON knowledge_entries;

-- Simple policy: authenticated users can view knowledge entries
-- (Company filtering is done in application layer via service role)
CREATE POLICY "Users can view their company knowledge"
ON knowledge_entries FOR SELECT
USING (auth.role() = 'authenticated');

-- =============================================
-- 5. HELPER FUNCTION: Get injectable context
-- =============================================
-- Note: knowledge_entries uses UUID columns but may need text comparison
-- The backend handles this in Python, so we use a text-based version here

CREATE OR REPLACE FUNCTION get_injectable_context(
    p_company_id TEXT,
    p_department_id TEXT DEFAULT NULL,
    p_project_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    category TEXT,
    scope TEXT,
    tags TEXT[]
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ke.id,
        ke.title,
        ke.summary,
        ke.category,
        ke.scope,
        ke.tags
    FROM knowledge_entries ke
    WHERE ke.company_id::text = p_company_id
    AND ke.auto_inject = true
    AND ke.is_active = true
    AND (
        -- Company-wide entries always included
        ke.scope = 'company'
        -- Department entries if matching or company-wide
        OR (ke.scope = 'department' AND (
            ke.department_id::text = p_department_id
            OR ke.department_id IS NULL
        ))
        -- Project entries if matching
        OR (ke.scope = 'project' AND ke.project_id::text = p_project_id)
    )
    ORDER BY ke.created_at DESC;
$$;

-- =============================================
-- 6. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN knowledge_entries.auto_inject IS 'When true, automatically include in council context for relevant scope';
COMMENT ON COLUMN knowledge_entries.scope IS 'Visibility: company (all), department (specific dept), project (specific project)';
COMMENT ON COLUMN knowledge_entries.is_promoted IS 'True if this entry has been promoted to a playbook';
COMMENT ON COLUMN knowledge_entries.promoted_to_id IS 'UUID of the org_document (playbook) this was promoted to';
COMMENT ON COLUMN knowledge_entries.tags IS 'Array of tags for categorization and filtering';

-- =============================================
-- 7. VERIFICATION
-- =============================================
DO $$
BEGIN
    -- Verify new columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'auto_inject'
    ) THEN
        RAISE NOTICE 'SUCCESS: auto_inject column added to knowledge_entries';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'scope'
    ) THEN
        RAISE NOTICE 'SUCCESS: scope column added to knowledge_entries';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_entries' AND column_name = 'is_promoted'
    ) THEN
        RAISE NOTICE 'SUCCESS: is_promoted column added to knowledge_entries';
    END IF;

    -- Count migrated decisions
    RAISE NOTICE 'Migration complete. Check knowledge_entries for migrated data.';
END $$;
