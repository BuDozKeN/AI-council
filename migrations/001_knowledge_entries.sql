-- Migration: Knowledge Entries with Role-Based Access
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ywoodvmtbkinopixoyfc/sql

-- ============================================
-- 1. User Department Access (permissions table)
-- ============================================
-- Controls which departments a user can access within a company
-- access_level: 'admin' = full company access, 'member' = specific departments only
-- department_id NULL = company-wide access (for admins/CEOs)

CREATE TABLE IF NOT EXISTS user_department_access (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL DEFAULT 'member' CHECK (access_level IN ('admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, company_id, department_id)
);

-- Index for fast permission lookups
CREATE INDEX IF NOT EXISTS idx_user_dept_access_user ON user_department_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_access_company ON user_department_access(company_id);

-- ============================================
-- 2. Knowledge Entries (council decisions/patterns)
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    role_id UUID,  -- Optional: specific role context
    category TEXT NOT NULL CHECK (category IN ('technical_decision', 'ux_pattern', 'feature', 'policy', 'process')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_knowledge_company_dept ON knowledge_entries(company_id, department_id, is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_entries(category);

-- ============================================
-- 3. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE user_department_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- User Department Access: Users can see their own access records
CREATE POLICY "Users can view their own access"
ON user_department_access FOR SELECT
USING (user_id = auth.uid());

-- Admins can manage access for their company
CREATE POLICY "Admins can manage company access"
ON user_department_access FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = auth.uid()
        AND uda.company_id = user_department_access.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL  -- company-wide admin
    )
);

-- Knowledge Entries: View if user has access to the department (or is company admin)
CREATE POLICY "Users can view knowledge for their departments"
ON knowledge_entries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = auth.uid()
        AND uda.company_id = knowledge_entries.company_id
        AND (
            uda.department_id IS NULL  -- company-wide admin
            OR uda.department_id = knowledge_entries.department_id
            OR knowledge_entries.department_id IS NULL  -- company-wide knowledge
        )
    )
);

-- Users can create knowledge for departments they have access to
CREATE POLICY "Users can create knowledge for their departments"
ON knowledge_entries FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = auth.uid()
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level IN ('admin', 'member')
        AND (
            uda.department_id IS NULL  -- company-wide admin
            OR uda.department_id = knowledge_entries.department_id
        )
    )
);

-- Users can update/delete their own entries or if they're admin
CREATE POLICY "Users can manage their own knowledge entries"
ON knowledge_entries FOR UPDATE
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = auth.uid()
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL
    )
);

CREATE POLICY "Users can delete their own knowledge entries"
ON knowledge_entries FOR DELETE
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = auth.uid()
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL
    )
);

-- ============================================
-- 4. Seed initial admin access for existing user
-- ============================================
-- Give the founder (ozpaniard@gmail.com) admin access to AxCouncil

INSERT INTO user_department_access (user_id, company_id, department_id, access_level, created_by)
SELECT
    'd11a00e6-fc4b-4126-8d19-29db1534cb8b'::UUID,  -- Your user ID
    'a0000000-0000-0000-0000-000000000001'::UUID,  -- AxCouncil company ID
    NULL,  -- NULL = company-wide admin access
    'admin',
    'd11a00e6-fc4b-4126-8d19-29db1534cb8b'::UUID
WHERE NOT EXISTS (
    SELECT 1 FROM user_department_access
    WHERE user_id = 'd11a00e6-fc4b-4126-8d19-29db1534cb8b'::UUID
    AND company_id = 'a0000000-0000-0000-0000-000000000001'::UUID
    AND department_id IS NULL
);

-- ============================================
-- Done! Verify with:
-- SELECT * FROM user_department_access;
-- SELECT * FROM knowledge_entries;
-- ============================================
