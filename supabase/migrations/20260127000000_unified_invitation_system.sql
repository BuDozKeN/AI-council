-- =============================================
-- UNIFIED INVITATION SYSTEM
-- =============================================
-- Consolidates all invitations into platform_invitations table
-- with invitation_type discriminator.
--
-- Types:
--   - platform_signup: New user signing up to the platform
--   - company_member: Existing or new user joining a company
--
-- This enables proper invitation flow where users only appear
-- in company_members AFTER accepting the invitation.

-- =============================================
-- 1. ADD INVITATION TYPE COLUMN
-- =============================================

ALTER TABLE platform_invitations
ADD COLUMN IF NOT EXISTS invitation_type TEXT NOT NULL DEFAULT 'platform_signup'
    CHECK (invitation_type IN ('platform_signup', 'company_member'));

COMMENT ON COLUMN platform_invitations.invitation_type IS
    'Type of invitation: platform_signup for new users, company_member for adding users to companies';

-- =============================================
-- 2. UPDATE UNIQUE CONSTRAINT
-- =============================================
-- The old constraint only allowed one pending invitation per email globally.
-- Now we need to allow:
--   - One platform_signup invitation per email
--   - One company_member invitation per email per company

-- Drop the old constraint
ALTER TABLE platform_invitations
DROP CONSTRAINT IF EXISTS platform_invitations_email_pending_unique;

-- Create new partial unique index
-- For platform_signup: one per email
-- For company_member: one per email per company
DROP INDEX IF EXISTS platform_invitations_pending_unique;

CREATE UNIQUE INDEX platform_invitations_platform_signup_pending_unique
ON platform_invitations(email)
WHERE status = 'pending' AND invitation_type = 'platform_signup';

CREATE UNIQUE INDEX platform_invitations_company_member_pending_unique
ON platform_invitations(email, target_company_id)
WHERE status = 'pending' AND invitation_type = 'company_member';

-- =============================================
-- 3. ADD INDEX FOR COMPANY MEMBER QUERIES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_platform_invitations_company_member
ON platform_invitations(target_company_id, status, created_at DESC)
WHERE invitation_type = 'company_member';

-- =============================================
-- 4. ADD RLS POLICY FOR COMPANY ADMINS
-- =============================================
-- Company admins/owners can manage company_member invitations for their company

DROP POLICY IF EXISTS "Company admins can manage member invitations" ON platform_invitations;
CREATE POLICY "Company admins can manage member invitations" ON platform_invitations
    FOR ALL USING (
        invitation_type = 'company_member'
        AND target_company_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM company_members cm
            WHERE cm.company_id = platform_invitations.target_company_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'admin')
        )
    );

-- =============================================
-- 5. HELPER FUNCTION: CHECK IF USER EXISTS
-- =============================================
-- Returns user_id if email exists in auth.users, NULL otherwise
-- Used to determine whether to send signup or direct join email

CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(p_email TEXT)
RETURNS TABLE (user_id UUID, user_exists BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id AS user_id, TRUE AS user_exists
    FROM auth.users u
    WHERE LOWER(u.email) = LOWER(p_email);

    -- If no rows returned, return NULL with FALSE
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID AS user_id, FALSE AS user_exists;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.check_user_exists_by_email(TEXT) IS
    'Check if a user exists by email. Returns user_id and boolean flag.';

-- Grant execute to service_role only (backend use)
REVOKE ALL ON FUNCTION public.check_user_exists_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO service_role;

-- =============================================
-- 6. DROP UNUSED COMPANY_INVITATIONS TABLE
-- =============================================
-- This table was created but never used. All invitation logic
-- is now consolidated in platform_invitations.

-- First drop the RLS policies
DROP POLICY IF EXISTS "company_invitations_select" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_insert" ON company_invitations;
DROP POLICY IF EXISTS "company_invitations_delete" ON company_invitations;

-- Drop any indexes
DROP INDEX IF EXISTS idx_company_invitations_email;
DROP INDEX IF EXISTS idx_company_invitations_token;
DROP INDEX IF EXISTS idx_company_invitations_expires;

-- Drop the table
DROP TABLE IF EXISTS company_invitations;

-- =============================================
-- 7. BACKFILL EXISTING INVITATIONS
-- =============================================
-- Set invitation_type for any existing invitations without it
-- (shouldn't be needed due to DEFAULT, but safe to include)

UPDATE platform_invitations
SET invitation_type = 'platform_signup'
WHERE invitation_type IS NULL;

-- =============================================
-- VERIFICATION QUERIES (for manual testing)
-- =============================================
-- Run these after migration to verify:
--
-- Check column added:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'platform_invitations' AND column_name = 'invitation_type';
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'platform_invitations';
--
-- Verify company_invitations dropped:
-- SELECT * FROM information_schema.tables WHERE table_name = 'company_invitations';
