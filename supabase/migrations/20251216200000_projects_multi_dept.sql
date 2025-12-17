-- =============================================
-- PROJECT MULTI-DEPARTMENT SUPPORT
-- =============================================
-- Adds department_ids array and source_conversation_id to projects

-- Add department_ids array column for multi-department support
-- This allows a project to be associated with multiple departments
ALTER TABLE projects ADD COLUMN IF NOT EXISTS department_ids UUID[] DEFAULT '{}';

-- Add source_conversation_id to track the original conversation that created this project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_conversation_id TEXT;

-- Backfill department_ids from existing department_id for existing projects
UPDATE projects
SET department_ids = ARRAY[department_id]::UUID[]
WHERE department_id IS NOT NULL
  AND (department_ids IS NULL OR department_ids = '{}');

-- Create index for queries that filter by department_ids (using GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_projects_department_ids
    ON projects USING GIN (department_ids);

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, verify with:
-- SELECT id, name, department_id, department_ids, source_conversation_id FROM projects LIMIT 5;
