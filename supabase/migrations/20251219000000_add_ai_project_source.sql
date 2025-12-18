-- =============================================
-- ADD 'ai' TO PROJECT SOURCE VALUES
-- =============================================
-- Extends the source check constraint to include 'ai' for projects
-- created via the AI-assisted flow in the New Project modal.

-- Drop existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_source_check;

-- Re-create with 'ai' added
ALTER TABLE projects ADD CONSTRAINT projects_source_check
    CHECK (source IN ('manual', 'council', 'import', 'ai'));
