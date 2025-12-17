-- =============================================
-- FIX PROJECTS RLS PERFORMANCE ISSUES
-- =============================================
-- Issues detected by Supabase linter:
-- 1. auth_rls_initplan: auth.uid() is re-evaluated for each row (use SELECT wrapper)
-- 2. multiple_permissive_policies: Both "Users can view company projects" and "projects_all" exist
--
-- Solution:
-- - Drop redundant policies
-- - Recreate with (SELECT auth.uid()) pattern for performance

-- =============================================
-- DROP ALL EXISTING SELECT POLICIES ON PROJECTS
-- =============================================
DROP POLICY IF EXISTS "Users can view company projects" ON projects;
DROP POLICY IF EXISTS "projects_all" ON projects;
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;

-- =============================================
-- CREATE SINGLE OPTIMIZED SELECT POLICY
-- =============================================
-- Using (SELECT auth.uid()) instead of auth.uid() directly
-- This ensures the function is evaluated once per query, not per row

CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    company_id IN (
        SELECT company_id FROM user_department_access WHERE user_id = (SELECT auth.uid())
    )
    OR
    user_id = (SELECT auth.uid())
);

-- =============================================
-- VERIFICATION
-- =============================================
-- After applying, verify with:
-- SELECT policyname FROM pg_policies WHERE tablename = 'projects';
-- Should show only ONE select policy: projects_select_policy