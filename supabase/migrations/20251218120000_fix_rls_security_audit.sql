-- =============================================
-- RLS SECURITY AUDIT FIX
-- =============================================
-- This migration fixes RLS policies identified in security audit:
--
-- Issues fixed:
-- 1. knowledge_entries: Replace permissive auth.role() with proper company isolation
-- 2. org_document_departments: Replace permissive auth.role() with proper company isolation
-- 3. user_department_access: Ensure proper RLS policies exist
-- 4. Use (SELECT auth.uid()) pattern for performance optimization
--
-- Reference: Original proper policies from migrations/001_knowledge_entries.sql
-- =============================================

-- =============================================
-- 1. FIX knowledge_entries RLS POLICIES
-- =============================================
-- Drop ALL existing policies on knowledge_entries to start fresh
DROP POLICY IF EXISTS "Users can view their company knowledge" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view knowledge for their departments" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view knowledge based on scope" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can create knowledge for their departments" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can manage their own knowledge entries" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can delete their own knowledge entries" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_select" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_insert" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_update" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_delete" ON knowledge_entries;

-- Ensure RLS is enabled
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view knowledge for companies they belong to
-- Using (SELECT auth.uid()) for performance optimization
CREATE POLICY "knowledge_entries_select"
ON knowledge_entries FOR SELECT
USING (
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User has department access to this company
    company_id IN (
        SELECT company_id FROM user_department_access WHERE user_id = (SELECT auth.uid())
    )
);

-- INSERT: Users can create knowledge for companies they belong to
CREATE POLICY "knowledge_entries_insert"
ON knowledge_entries FOR INSERT
WITH CHECK (
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User has department access with admin/member role
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level IN ('admin', 'member')
    )
);

-- UPDATE: Users can update their own entries or if they're company admin
CREATE POLICY "knowledge_entries_update"
ON knowledge_entries FOR UPDATE
USING (
    -- User created this entry
    created_by = (SELECT auth.uid())
    OR
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User is company admin
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL  -- company-wide admin
    )
);

-- DELETE: Users can delete their own entries or if they're company admin
CREATE POLICY "knowledge_entries_delete"
ON knowledge_entries FOR DELETE
USING (
    -- User created this entry
    created_by = (SELECT auth.uid())
    OR
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User is company admin
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = knowledge_entries.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL
    )
);

-- =============================================
-- 2. FIX org_document_departments RLS POLICIES
-- =============================================
-- Drop ALL existing policies on org_document_departments
DROP POLICY IF EXISTS "Authenticated users can view org_document_departments" ON org_document_departments;
DROP POLICY IF EXISTS "Service role has full access to org_document_departments" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_select" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_insert" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_delete" ON org_document_departments;

-- Ensure RLS is enabled
ALTER TABLE org_document_departments ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view document-department links for their companies
CREATE POLICY "org_document_departments_select"
ON org_document_departments FOR SELECT
USING (
    document_id IN (
        SELECT id FROM org_documents
        WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
        )
        OR company_id IN (
            SELECT company_id FROM user_department_access WHERE user_id = (SELECT auth.uid())
        )
    )
);

-- INSERT: Users can create links for documents in their companies
CREATE POLICY "org_document_departments_insert"
ON org_document_departments FOR INSERT
WITH CHECK (
    document_id IN (
        SELECT id FROM org_documents
        WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
        )
    )
);

-- DELETE: Users can delete links for documents in their companies
CREATE POLICY "org_document_departments_delete"
ON org_document_departments FOR DELETE
USING (
    document_id IN (
        SELECT id FROM org_documents
        WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
        )
    )
);

-- =============================================
-- 3. ENSURE user_department_access HAS PROPER RLS
-- =============================================
-- Ensure RLS is enabled
ALTER TABLE user_department_access ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for consistency
DROP POLICY IF EXISTS "Users can view their own access" ON user_department_access;
DROP POLICY IF EXISTS "Admins can manage company access" ON user_department_access;
DROP POLICY IF EXISTS "user_department_access_select" ON user_department_access;
DROP POLICY IF EXISTS "user_department_access_admin" ON user_department_access;

-- SELECT: Users can see their own access records
CREATE POLICY "user_department_access_select"
ON user_department_access FOR SELECT
USING (
    user_id = (SELECT auth.uid())
    OR
    -- Company owners can see all access for their company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
);

-- INSERT/UPDATE/DELETE: Only company owners and admins
CREATE POLICY "user_department_access_admin"
ON user_department_access FOR ALL
USING (
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User is company-wide admin
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = user_department_access.company_id
        AND uda.access_level = 'admin'
        AND uda.department_id IS NULL
    )
);

-- =============================================
-- 4. VERIFICATION QUERIES (run manually to check)
-- =============================================
-- After applying, verify with:
--
-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('knowledge_entries', 'org_document_departments', 'user_department_access');
--
-- Check policies exist:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('knowledge_entries', 'org_document_departments', 'user_department_access')
-- ORDER BY tablename, cmd;
-- =============================================