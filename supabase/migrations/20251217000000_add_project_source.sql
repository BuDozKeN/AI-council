-- =============================================
-- ADD PROJECT SOURCE TRACKING
-- =============================================
-- Tracks how a project was created:
-- - 'manual': Created manually via New Project modal
-- - 'council': Created from a council decision/save
-- - 'import': Imported from external source

-- Add source column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add CHECK constraint for valid source values
DO $$
BEGIN
    ALTER TABLE projects ADD CONSTRAINT projects_source_check
        CHECK (source IN ('manual', 'council', 'import'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Backfill existing projects:
-- If they have decisions linked via source_conversation_id in knowledge_entries, mark as 'council'
-- Otherwise assume 'manual'
UPDATE projects p
SET source = 'council'
WHERE EXISTS (
    SELECT 1 FROM knowledge_entries ke
    WHERE ke.project_id = p.id
    AND ke.source_conversation_id IS NOT NULL
)
AND source = 'manual';
