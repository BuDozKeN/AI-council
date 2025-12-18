-- =============================================
-- ADD DELETE AND UPDATE POLICIES FOR PROJECTS
-- =============================================
-- Problem: Projects table only has SELECT policy, missing INSERT/UPDATE/DELETE
-- This causes delete operations to silently fail (RLS blocks them)
--
-- Solution: Add proper INSERT/UPDATE/DELETE policies that allow:
-- - Users to manage projects in companies they own
-- - Users with admin access to manage projects in their company
-- =============================================

-- =============================================
-- DROP ANY EXISTING POLICIES (cleanup)
-- =============================================
DROP POLICY IF EXISTS "projects_insert" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can delete projects" ON projects;

-- =============================================
-- INSERT POLICY
-- =============================================
-- Users can create projects in companies they own or have admin access to
CREATE POLICY "projects_insert"
ON projects FOR INSERT
WITH CHECK (
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User has admin access to the company
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = projects.company_id
        AND uda.access_level = 'admin'
    )
);

-- =============================================
-- UPDATE POLICY
-- =============================================
-- Users can update projects they created or if they own/admin the company
CREATE POLICY "projects_update"
ON projects FOR UPDATE
USING (
    -- User created this project
    user_id = (SELECT auth.uid())
    OR
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User has admin access to the company
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = projects.company_id
        AND uda.access_level = 'admin'
    )
);

-- =============================================
-- DELETE POLICY
-- =============================================
-- Users can delete projects they created or if they own/admin the company
CREATE POLICY "projects_delete"
ON projects FOR DELETE
USING (
    -- User created this project
    user_id = (SELECT auth.uid())
    OR
    -- User owns the company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
    OR
    -- User has admin access to the company
    EXISTS (
        SELECT 1 FROM user_department_access uda
        WHERE uda.user_id = (SELECT auth.uid())
        AND uda.company_id = projects.company_id
        AND uda.access_level = 'admin'
    )
);

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, verify with:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'projects';
-- Should show: projects_select_policy (SELECT), projects_insert (INSERT),
--              projects_update (UPDATE), projects_delete (DELETE)
