-- =============================================
-- FIX PROJECTS RLS POLICY
-- =============================================
-- Problem: Current RLS restricts projects to user_id = auth.uid()
-- This means users can only see projects THEY created, not all company projects
--
-- Solution: Allow users to see all projects in companies they have access to

-- Drop the restrictive policies
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects" ON projects;

-- Create new policy: Users can view all projects in their company
CREATE POLICY "Users can view company projects"
ON projects FOR SELECT
USING (
    company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
    )
    OR
    company_id IN (
        SELECT company_id FROM user_department_access WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
);

-- Keep existing insert/update/delete policies (user must own the project)
-- These are already correct - only the creator can modify

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, test with:
-- SELECT * FROM projects WHERE company_id = 'your-company-id';
