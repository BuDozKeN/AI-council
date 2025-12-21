-- =============================================
-- SCHEMA CLEANUP: Single Source of Truth
-- =============================================
-- This migration consolidates redundant columns and establishes
-- clean, unambiguous data structures.
--
-- CHANGES:
-- 1. knowledge_entries: Consolidate content fields, remove department_id singular
-- 2. projects: Remove department_id singular
-- 3. activity_logs: Add explicit action column, clean title prefixes
--
-- RESULT: No more fallback chains, dual fields, or string parsing
-- =============================================

-- =============================================
-- PHASE 1: ADD NEW CANONICAL COLUMNS
-- =============================================

-- activity_logs: Add explicit action column (no more parsing "Saved: Title")
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS action TEXT;

-- knowledge_entries: Add canonical content fields
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content_summary TEXT;

-- Ensure department_ids exists as UUID[] on projects (may be different type)
-- Note: knowledge_entries.department_ids is TEXT[] for historical reasons

-- =============================================
-- PHASE 2: BACKFILL DATA
-- =============================================

-- 2.1 Backfill content from body_md (primary) or summary (legacy)
UPDATE knowledge_entries
SET content = COALESCE(NULLIF(body_md, ''), summary)
WHERE content IS NULL OR content = '';

-- 2.2 Backfill question from user_question, fallback to title
UPDATE knowledge_entries
SET question = COALESCE(NULLIF(user_question, ''), title)
WHERE question IS NULL OR question = '';

-- 2.3 Backfill content_summary from decision_summary
UPDATE knowledge_entries
SET content_summary = decision_summary
WHERE content_summary IS NULL AND decision_summary IS NOT NULL;

-- 2.4 Backfill department_ids from department_id (knowledge_entries)
-- Note: department_id in knowledge_entries is TEXT, department_ids is TEXT[]
UPDATE knowledge_entries
SET department_ids = ARRAY[department_id]
WHERE department_id IS NOT NULL
  AND department_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND (department_ids IS NULL OR array_length(department_ids, 1) IS NULL);

-- 2.5 Backfill department_ids from department_id (projects)
-- Note: Both are UUID type in projects table
UPDATE projects
SET department_ids = ARRAY[department_id]
WHERE department_id IS NOT NULL
  AND (department_ids IS NULL OR array_length(department_ids, 1) IS NULL);

-- 2.6 Extract action from activity_logs title prefix
-- Pattern: "Saved: My Title" -> action="saved", title="My Title"
UPDATE activity_logs
SET
    action = LOWER(SPLIT_PART(title, ':', 1)),
    title = TRIM(SUBSTRING(title FROM POSITION(':' IN title) + 1))
WHERE title ~ '^(Deleted|Promoted|Saved|Created|Updated|Archived|Consulted):'
  AND action IS NULL;

-- 2.7 Default action for logs without prefix
UPDATE activity_logs
SET action = CASE
    WHEN event_type = 'consultation' THEN 'consulted'
    WHEN event_type = 'decision' THEN 'saved'
    WHEN event_type = 'playbook' THEN 'created'
    WHEN event_type = 'project' THEN 'created'
    WHEN event_type = 'role' THEN 'updated'
    WHEN event_type = 'department' THEN 'updated'
    ELSE 'created'
END
WHERE action IS NULL;

-- =============================================
-- PHASE 3: ADD CONSTRAINTS
-- =============================================

-- Add CHECK constraint for action column
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_check
    CHECK (action IN ('saved', 'promoted', 'deleted', 'created', 'updated', 'archived', 'consulted'));

-- =============================================
-- PHASE 4: DROP LEGACY COLUMNS
-- =============================================

-- knowledge_entries: Drop redundant columns
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS department_id;
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS summary;
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS body_md;
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS user_question;
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS decision_summary;
ALTER TABLE knowledge_entries DROP COLUMN IF EXISTS is_promoted;

-- projects: Drop singular department column
ALTER TABLE projects DROP COLUMN IF EXISTS department_id;

-- =============================================
-- PHASE 5: CREATE/UPDATE INDEXES
-- =============================================

-- Index on action for activity_logs queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- Ensure GIN index on department_ids for array containment queries
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_dept_ids ON knowledge_entries USING GIN (department_ids);
CREATE INDEX IF NOT EXISTS idx_projects_dept_ids ON projects USING GIN (department_ids);

-- =============================================
-- PHASE 6: ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN knowledge_entries.content IS 'The full council response or decision content (single source of truth)';
COMMENT ON COLUMN knowledge_entries.question IS 'The original user question that prompted this decision';
COMMENT ON COLUMN knowledge_entries.content_summary IS 'AI-generated brief summary for quick scanning';
COMMENT ON COLUMN knowledge_entries.question_summary IS 'AI-generated summary of the user question';
COMMENT ON COLUMN knowledge_entries.department_ids IS 'Array of department UUIDs this decision applies to';
COMMENT ON COLUMN knowledge_entries.promoted_to_id IS 'UUID of the org_document this was promoted to (NULL = not promoted)';
COMMENT ON COLUMN knowledge_entries.promoted_to_type IS 'Type of promotion target: sop, framework, policy, or project';

COMMENT ON COLUMN activity_logs.action IS 'Explicit action type: saved, promoted, deleted, created, updated, archived, consulted';
COMMENT ON COLUMN activity_logs.title IS 'Clean title without action prefix';

COMMENT ON COLUMN projects.department_ids IS 'Array of department UUIDs this project belongs to';

-- =============================================
-- VERIFICATION
-- =============================================

DO $$
DECLARE
    missing_content INTEGER;
    missing_question INTEGER;
    missing_action INTEGER;
BEGIN
    -- Check for any rows missing required data
    SELECT COUNT(*) INTO missing_content FROM knowledge_entries WHERE content IS NULL OR content = '';
    SELECT COUNT(*) INTO missing_question FROM knowledge_entries WHERE question IS NULL OR question = '';
    SELECT COUNT(*) INTO missing_action FROM activity_logs WHERE action IS NULL;

    IF missing_content > 0 THEN
        RAISE WARNING 'Migration warning: % knowledge_entries have empty content', missing_content;
    END IF;

    IF missing_question > 0 THEN
        RAISE WARNING 'Migration warning: % knowledge_entries have empty question', missing_question;
    END IF;

    IF missing_action > 0 THEN
        RAISE WARNING 'Migration warning: % activity_logs have NULL action', missing_action;
    END IF;

    RAISE NOTICE 'Schema cleanup migration completed successfully';
    RAISE NOTICE 'Removed columns: knowledge_entries.{department_id, summary, body_md, user_question, decision_summary, is_promoted}';
    RAISE NOTICE 'Removed columns: projects.department_id';
    RAISE NOTICE 'Added columns: activity_logs.action';
    RAISE NOTICE 'Canonical columns: knowledge_entries.{content, question, content_summary, department_ids}';
END $$;
