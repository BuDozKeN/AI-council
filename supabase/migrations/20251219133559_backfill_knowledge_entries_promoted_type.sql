-- Backfill promoted_to_type for knowledge_entries (decisions)
-- This updates decisions that have been promoted to playbooks but don't have the type set

-- First: decisions promoted to playbooks (via promoted_to_id)
UPDATE knowledge_entries ke
SET promoted_to_type = od.doc_type
FROM org_documents od
WHERE ke.promoted_to_id = od.id
  AND ke.is_promoted = true
  AND ke.promoted_to_type IS NULL;

-- Second: decisions linked to projects (via project_id)
UPDATE knowledge_entries
SET promoted_to_type = 'project'
WHERE project_id IS NOT NULL
  AND is_promoted = true
  AND promoted_to_type IS NULL;
