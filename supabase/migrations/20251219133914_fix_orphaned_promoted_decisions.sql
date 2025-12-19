-- Fix orphaned promoted decisions that have is_promoted=true but no promoted_to_id
-- This can happen for decisions promoted before we tracked the playbook link

-- Step 1: Try to match decisions with playbooks by title (same company)
-- and set promoted_to_id and promoted_to_type
UPDATE knowledge_entries ke
SET
  promoted_to_id = od.id,
  promoted_to_type = od.doc_type
FROM org_documents od
WHERE ke.company_id = od.company_id
  AND ke.is_promoted = true
  AND ke.promoted_to_id IS NULL
  AND ke.promoted_to_type IS NULL
  AND LOWER(TRIM(ke.title)) = LOWER(TRIM(od.title));

-- Step 2: For decisions that are promoted but we still can't find the playbook,
-- default to 'sop' as the most common type (better than showing nothing)
UPDATE knowledge_entries
SET promoted_to_type = 'sop'
WHERE is_promoted = true
  AND promoted_to_type IS NULL
  AND project_id IS NULL;  -- Only for playbook promotions, not project ones
