-- =============================================
-- PLAYBOOK ENHANCEMENTS: Tags + Multi-Department Access
-- =============================================
-- This migration adds:
-- 1. Tags array to org_documents for categorization
-- 2. Junction table for multi-department access
-- 3. Conversation/message links to activity_logs
-- =============================================

-- =============================================
-- 1. ADD TAGS TO PLAYBOOKS
-- =============================================
ALTER TABLE org_documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for efficient tag searching
CREATE INDEX IF NOT EXISTS idx_org_documents_tags ON org_documents USING GIN (tags);

COMMENT ON COLUMN org_documents.tags IS 'Array of tags for categorization (e.g., deployment, security, onboarding)';

-- =============================================
-- 2. MULTI-DEPARTMENT ACCESS (Junction Table)
-- =============================================
-- This allows a playbook to be visible to multiple departments
-- while keeping the original department_id as the "owner" department

CREATE TABLE IF NOT EXISTS org_document_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES org_documents(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, department_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_org_document_departments_document ON org_document_departments(document_id);
CREATE INDEX IF NOT EXISTS idx_org_document_departments_department ON org_document_departments(department_id);

COMMENT ON TABLE org_document_departments IS 'Junction table for playbooks visible to multiple departments';

-- =============================================
-- 3. ACTIVITY LOG SOURCE LINKS
-- =============================================
-- Add conversation and message links to trace back to the source

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS message_id UUID;

-- Index for efficient conversation lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_conversation ON activity_logs(conversation_id);

COMMENT ON COLUMN activity_logs.conversation_id IS 'Link to the council conversation that triggered this event';
COMMENT ON COLUMN activity_logs.message_id IS 'Link to the specific message within the conversation';

-- =============================================
-- 4. RLS POLICIES FOR NEW TABLE
-- =============================================
ALTER TABLE org_document_departments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all document-department links
-- (actual company filtering happens at the org_documents level)
CREATE POLICY "Authenticated users can view org_document_departments"
    ON org_document_departments FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role has full access for all operations
CREATE POLICY "Service role has full access to org_document_departments"
    ON org_document_departments FOR ALL
    USING (true)
    WITH CHECK (true);

-- =============================================
-- 5. HELPER FUNCTION: Get departments for a playbook
-- =============================================
CREATE OR REPLACE FUNCTION get_playbook_departments(playbook_id UUID)
RETURNS TABLE (department_id UUID, department_name TEXT, department_slug TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT d.id, d.name, d.slug
    FROM org_document_departments odd
    JOIN departments d ON odd.department_id = d.id
    WHERE odd.document_id = playbook_id
    ORDER BY d.name;
$$;

-- =============================================
-- 6. VERIFICATION
-- =============================================
DO $$
BEGIN
    -- Verify tags column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'org_documents' AND column_name = 'tags'
    ) THEN
        RAISE NOTICE 'SUCCESS: tags column added to org_documents';
    END IF;

    -- Verify junction table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'org_document_departments'
    ) THEN
        RAISE NOTICE 'SUCCESS: org_document_departments junction table created';
    END IF;

    -- Verify activity_logs columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'conversation_id'
    ) THEN
        RAISE NOTICE 'SUCCESS: conversation_id column added to activity_logs';
    END IF;
END $$;
