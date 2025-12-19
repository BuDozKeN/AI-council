-- Add promoted_to_type to activity_logs for tracking what type something was promoted to
-- This allows the Activity tab to show: DECISION → SOP, DECISION → FRAMEWORK, DECISION → PROJECT

ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS promoted_to_type TEXT
CHECK (promoted_to_type IN ('sop', 'framework', 'policy', 'project'));

-- Add index for filtering by promoted type
CREATE INDEX IF NOT EXISTS idx_activity_logs_promoted_type
ON activity_logs(promoted_to_type)
WHERE promoted_to_type IS NOT NULL;

COMMENT ON COLUMN activity_logs.promoted_to_type IS 'Type of document/project the decision was promoted to: sop, framework, policy, or project';
