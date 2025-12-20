-- =============================================
-- PHASE 0: MULTI-USER & USAGE TRACKING (MVP)
-- =============================================
-- Implements the Council's "Revenue Unblocker" recommendation
-- Focus: Minimal viable multi-user with privacy-first usage tracking

-- =============================================
-- TABLE 1: COMPANY MEMBERS
-- =============================================
-- Tracks who belongs to which company with their role
-- Single owner per company, with admin and member tiers

CREATE TABLE IF NOT EXISTS company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, user_id)
);

-- =============================================
-- TABLE 2: USAGE EVENTS (Privacy by Design)
-- =============================================
-- Tracks usage for billing dashboard
-- IMPORTANT: No user_id column - aggregate by company only
-- This protects "zero fear of surveillance" promise

CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('council_session', 'document_created', 'decision_saved')),
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    model_used TEXT,
    session_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE 3: INVITATIONS (Simple 7-day expiry)
-- =============================================
-- Pending invitations that haven't been accepted yet

CREATE TABLE IF NOT EXISTS company_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    token UUID DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, email)
);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: COMPANY MEMBERS
-- =============================================

-- Members can see other members in their company
CREATE POLICY "company_members_select" ON company_members FOR SELECT USING (
    company_id IN (
        SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
    )
);

-- Only owners and admins can add new members
CREATE POLICY "company_members_insert" ON company_members FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Owners can update any member, admins can update non-owner members
CREATE POLICY "company_members_update" ON company_members FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND (
            cm.role = 'owner'
            OR (cm.role = 'admin' AND company_members.role != 'owner')
        )
    )
);

-- Owners can delete any member (except themselves), admins can delete members only
CREATE POLICY "company_members_delete" ON company_members FOR DELETE USING (
    company_members.user_id != auth.uid() -- Can't remove yourself
    AND EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
        AND (
            cm.role = 'owner'
            OR (cm.role = 'admin' AND company_members.role = 'member')
        )
    )
);

-- =============================================
-- RLS POLICIES: USAGE EVENTS
-- =============================================

-- Only owners and admins can view company usage (aggregate only)
CREATE POLICY "usage_events_select" ON usage_events FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = usage_events.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Any company member can insert usage events (via backend)
CREATE POLICY "usage_events_insert" ON usage_events FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = usage_events.company_id
        AND cm.user_id = auth.uid()
    )
);

-- =============================================
-- RLS POLICIES: INVITATIONS
-- =============================================

-- Owners and admins can see invitations for their company
CREATE POLICY "company_invitations_select" ON company_invitations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_invitations.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Owners and admins can create invitations
CREATE POLICY "company_invitations_insert" ON company_invitations FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_invitations.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Owners and admins can delete/cancel invitations
CREATE POLICY "company_invitations_delete" ON company_invitations FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = company_invitations.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- =============================================
-- MIGRATE EXISTING OWNERS TO COMPANY_MEMBERS
-- =============================================
-- This ensures existing company owners become members with role='owner'

INSERT INTO company_members (company_id, user_id, role, joined_at)
SELECT id, user_id, 'owner', created_at
FROM companies
WHERE user_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- =============================================
-- UPDATE RLS POLICIES FOR EXISTING TABLES
-- =============================================
-- Change from owner-only to member-based access

-- Helper function to check company membership
CREATE OR REPLACE FUNCTION is_company_member(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members
        WHERE company_id = check_company_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is owner/admin
CREATE OR REPLACE FUNCTION is_company_admin(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM company_members
        WHERE company_id = check_company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- UPDATE DEPARTMENTS RLS
-- =============================================
DROP POLICY IF EXISTS "departments_access" ON departments;
DROP POLICY IF EXISTS "departments_company_access" ON departments;

CREATE POLICY "departments_select" ON departments FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "departments_insert" ON departments FOR INSERT WITH CHECK (
    is_company_admin(company_id)
);

CREATE POLICY "departments_update" ON departments FOR UPDATE USING (
    is_company_admin(company_id)
);

CREATE POLICY "departments_delete" ON departments FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE ROLES RLS
-- =============================================
DROP POLICY IF EXISTS "roles_access" ON roles;
DROP POLICY IF EXISTS "roles_company_access" ON roles;

CREATE POLICY "roles_select" ON roles FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "roles_insert" ON roles FOR INSERT WITH CHECK (
    is_company_admin(company_id)
);

CREATE POLICY "roles_update" ON roles FOR UPDATE USING (
    is_company_admin(company_id)
);

CREATE POLICY "roles_delete" ON roles FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE ORG_DOCUMENTS RLS
-- =============================================
DROP POLICY IF EXISTS "org_documents_access" ON org_documents;

CREATE POLICY "org_documents_select" ON org_documents FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "org_documents_insert" ON org_documents FOR INSERT WITH CHECK (
    is_company_member(company_id)
);

CREATE POLICY "org_documents_update" ON org_documents FOR UPDATE USING (
    is_company_member(company_id)
);

CREATE POLICY "org_documents_delete" ON org_documents FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE ORG_DOCUMENT_VERSIONS RLS
-- =============================================
DROP POLICY IF EXISTS "org_document_versions_access" ON org_document_versions;

CREATE POLICY "org_document_versions_select" ON org_document_versions FOR SELECT USING (
    document_id IN (
        SELECT id FROM org_documents WHERE is_company_member(company_id)
    )
);

CREATE POLICY "org_document_versions_insert" ON org_document_versions FOR INSERT WITH CHECK (
    document_id IN (
        SELECT id FROM org_documents WHERE is_company_member(company_id)
    )
);

CREATE POLICY "org_document_versions_update" ON org_document_versions FOR UPDATE USING (
    document_id IN (
        SELECT id FROM org_documents WHERE is_company_member(company_id)
    )
);

-- =============================================
-- UPDATE DECISIONS RLS
-- =============================================
DROP POLICY IF EXISTS "decisions_access" ON decisions;

CREATE POLICY "decisions_select" ON decisions FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "decisions_insert" ON decisions FOR INSERT WITH CHECK (
    is_company_member(company_id)
);

CREATE POLICY "decisions_update" ON decisions FOR UPDATE USING (
    is_company_member(company_id)
);

CREATE POLICY "decisions_delete" ON decisions FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE PROJECTS RLS
-- =============================================
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "projects_company_access" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
    is_company_member(company_id)
);

CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
    is_company_member(company_id)
);

CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE KNOWLEDGE_ENTRIES RLS
-- =============================================
DROP POLICY IF EXISTS "knowledge_entries_access" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_company_access" ON knowledge_entries;

CREATE POLICY "knowledge_entries_select" ON knowledge_entries FOR SELECT USING (
    is_company_member(company_id)
);

CREATE POLICY "knowledge_entries_insert" ON knowledge_entries FOR INSERT WITH CHECK (
    is_company_member(company_id)
);

CREATE POLICY "knowledge_entries_update" ON knowledge_entries FOR UPDATE USING (
    is_company_member(company_id)
);

CREATE POLICY "knowledge_entries_delete" ON knowledge_entries FOR DELETE USING (
    is_company_admin(company_id)
);

-- =============================================
-- UPDATE ACTIVITY_LOGS RLS
-- =============================================
DROP POLICY IF EXISTS "activity_logs_access" ON activity_logs;
DROP POLICY IF EXISTS "Users can view activity logs for their companies" ON activity_logs;

-- Only owners and admins can view activity logs
CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT USING (
    is_company_admin(company_id)
);

-- Any member can insert activity logs
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (
    is_company_member(company_id)
);

-- =============================================
-- UPDATE COMPANIES TABLE RLS
-- =============================================
-- Companies table needs special handling - keep owner-based for now
-- but add member-based read access

DROP POLICY IF EXISTS "companies_access" ON companies;
DROP POLICY IF EXISTS "Users can view own companies" ON companies;
DROP POLICY IF EXISTS "Users can insert own companies" ON companies;
DROP POLICY IF EXISTS "Users can update own companies" ON companies;

-- All members can view the company
CREATE POLICY "companies_select" ON companies FOR SELECT USING (
    user_id = auth.uid() -- Owner
    OR is_company_member(id)
);

-- Only the owner can create companies (for themselves)
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Only the owner can update company settings
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
    user_id = auth.uid()
);

-- Only the owner can delete the company
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (
    user_id = auth.uid()
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(company_id, role);
CREATE INDEX IF NOT EXISTS idx_usage_events_company_id ON usage_events(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_company_month ON usage_events(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_company_invitations_email ON company_invitations(email);
CREATE INDEX IF NOT EXISTS idx_company_invitations_token ON company_invitations(token);
CREATE INDEX IF NOT EXISTS idx_company_invitations_expires ON company_invitations(expires_at);

-- =============================================
-- RPC FUNCTION: GET USER ID BY EMAIL
-- =============================================
-- Allows looking up user_id from email for member invitations
-- Only accessible via service role (not exposed to clients directly)

CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email TEXT)
RETURNS UUID AS $$
DECLARE
    found_user_id UUID;
BEGIN
    SELECT id INTO found_user_id
    FROM auth.users
    WHERE email = user_email;

    RETURN found_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
REVOKE EXECUTE ON FUNCTION get_user_id_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO service_role;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================
-- Run these after migration to verify:

-- Check company_members populated:
-- SELECT cm.*, c.name as company_name, u.email
-- FROM company_members cm
-- JOIN companies c ON cm.company_id = c.id
-- JOIN auth.users u ON cm.user_id = u.id;

-- Check usage_events table exists:
-- SELECT COUNT(*) FROM usage_events;

-- Verify RLS is working:
-- SELECT * FROM departments; -- Should only return departments for companies you're a member of