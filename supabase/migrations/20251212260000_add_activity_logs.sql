-- Activity logs table for tracking company events
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,  -- 'decision', 'playbook', 'role', 'department', 'council_session'
    title TEXT NOT NULL,
    description TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    related_id UUID,           -- ID of the related entity (decision, playbook, etc.)
    related_type TEXT,         -- Type of related entity
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries by company and date
CREATE INDEX IF NOT EXISTS idx_activity_company_date ON activity_logs(company_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see activity for companies they own
DROP POLICY IF EXISTS "Users see own company activity" ON activity_logs;
CREATE POLICY "Users see own company activity" ON activity_logs
    FOR ALL USING (
        company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    );

-- Policy: Service role can insert (for backend logging)
DROP POLICY IF EXISTS "Service role can insert activity" ON activity_logs;
CREATE POLICY "Service role can insert activity" ON activity_logs
    FOR INSERT WITH CHECK (true);
