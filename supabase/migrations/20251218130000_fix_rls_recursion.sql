-- =============================================
-- FIX RLS RECURSION ON user_department_access
-- =============================================
-- The previous migration created an infinite recursion because
-- user_department_access_admin policy referenced user_department_access
-- to check if user is admin, but that triggers the same policy again.
--
-- Solution: Only allow company owners to manage user_department_access.
-- Admins can be granted access through other means (like an admin flag on user_profiles).
-- =============================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "user_department_access_select" ON user_department_access;
DROP POLICY IF EXISTS "user_department_access_admin" ON user_department_access;

-- Ensure RLS is enabled
ALTER TABLE user_department_access ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see their own access OR all access for companies they own
CREATE POLICY "user_department_access_select"
ON user_department_access FOR SELECT
USING (
    -- User can see their own access records
    user_id = (SELECT auth.uid())
    OR
    -- Company owners can see all access for their company
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
);

-- INSERT/UPDATE/DELETE: Only company owners can manage access
-- (No self-reference, so no recursion)
CREATE POLICY "user_department_access_manage"
ON user_department_access FOR ALL
USING (
    -- Only company owners can manage department access
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    -- Only company owners can manage department access
    company_id IN (
        SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
    )
);

-- =============================================
-- VERIFICATION
-- =============================================
-- Test with:
-- SELECT * FROM user_department_access;
-- Should not cause infinite recursion error
