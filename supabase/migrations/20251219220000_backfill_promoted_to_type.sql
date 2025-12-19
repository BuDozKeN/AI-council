-- Backfill promoted_to_type for existing activity logs
-- This updates activity logs where:
-- 1. The title starts with "Promoted:"
-- 2. related_type is "playbook"
-- 3. promoted_to_type is currently NULL
-- We look up the doc_type from org_documents using the related_id

UPDATE activity_logs al
SET promoted_to_type = od.doc_type
FROM org_documents od
WHERE al.related_id::uuid = od.id
  AND al.related_type = 'playbook'
  AND al.title LIKE 'Promoted:%'
  AND al.promoted_to_type IS NULL;

-- Also backfill for project promotions (related_type = 'project')
UPDATE activity_logs
SET promoted_to_type = 'project'
WHERE related_type = 'project'
  AND title LIKE 'Promoted:%'
  AND promoted_to_type IS NULL;

-- Backfill promoted_to_type for knowledge_entries (decisions)
-- This updates decisions that have been promoted to playbooks but don't have the type set
UPDATE knowledge_entries ke
SET promoted_to_type = od.doc_type
FROM org_documents od
WHERE ke.promoted_to_id = od.id
  AND ke.is_promoted = true
  AND ke.promoted_to_type IS NULL;

-- Backfill for decisions promoted to projects
UPDATE knowledge_entries
SET promoted_to_type = 'project'
WHERE project_id IS NOT NULL
  AND is_promoted = true
  AND promoted_to_type IS NULL;
