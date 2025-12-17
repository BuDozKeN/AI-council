-- =============================================
-- PROJECT MANAGEMENT ENHANCEMENT
-- Phase 1: Database Foundation
-- =============================================
-- Adds last_accessed_at column and performance indexes
-- for the Projects Tab and Chat Selector features

-- Add last_accessed_at column for recently used sorting
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill last_accessed_at from updated_at for existing projects
UPDATE projects SET last_accessed_at = COALESCE(updated_at, created_at) WHERE last_accessed_at IS NULL;

-- Add CHECK constraint for status if not exists
-- (status column already exists, just ensure valid values)
DO $$
BEGIN
    -- Try to add the constraint, ignore if it already exists
    ALTER TABLE projects ADD CONSTRAINT projects_status_check
        CHECK (status IN ('active', 'completed', 'archived'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Index for listing projects by company and status (Projects Tab)
CREATE INDEX IF NOT EXISTS idx_projects_company_status
    ON projects(company_id, status);

-- Index for knowledge entries by project (for project-scoped queries)
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_project
    ON knowledge_entries(project_id)
    WHERE project_id IS NOT NULL;

-- Index for sorting by last accessed (Chat Selector dropdown)
CREATE INDEX IF NOT EXISTS idx_projects_last_accessed
    ON projects(company_id, last_accessed_at DESC);

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, verify with:
-- SELECT id, name, status, last_accessed_at FROM projects LIMIT 5;
