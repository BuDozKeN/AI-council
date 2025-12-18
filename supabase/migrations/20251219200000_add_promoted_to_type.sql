-- Add promoted_to_type column to knowledge_entries
-- This tracks what type of document a decision was promoted to (sop, framework, policy, project)

ALTER TABLE knowledge_entries
ADD COLUMN IF NOT EXISTS promoted_to_type TEXT
CHECK (promoted_to_type IN ('sop', 'framework', 'policy', 'project'));

-- Create index for filtering by promotion type
CREATE INDEX IF NOT EXISTS idx_knowledge_promoted_type
ON knowledge_entries(promoted_to_type)
WHERE promoted_to_type IS NOT NULL;

COMMENT ON COLUMN knowledge_entries.promoted_to_type IS 'Type of document this decision was promoted to: sop, framework, policy, or project';
