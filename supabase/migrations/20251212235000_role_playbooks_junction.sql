-- =============================================
-- ROLE-PLAYBOOK JUNCTION TABLE
-- =============================================
-- Enables connecting roles to specific playbooks
-- So the system knows which SOPs/frameworks apply to which roles

-- Role-Playbook connections (many-to-many)
CREATE TABLE IF NOT EXISTS role_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    playbook_id UUID NOT NULL REFERENCES org_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, playbook_id)
);

-- Enable RLS
ALTER TABLE role_playbooks ENABLE ROW LEVEL SECURITY;

-- RLS Policy - access via role's company
DROP POLICY IF EXISTS "role_playbooks_access" ON role_playbooks;
CREATE POLICY "role_playbooks_access" ON role_playbooks FOR ALL USING (
    role_id IN (
        SELECT id FROM roles WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_playbooks_role ON role_playbooks(role_id);
CREATE INDEX IF NOT EXISTS idx_role_playbooks_playbook ON role_playbooks(playbook_id);

-- Add is_customized flag to roles (per council recommendation)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE;
