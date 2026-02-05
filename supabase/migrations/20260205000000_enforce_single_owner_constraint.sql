-- =============================================
-- ENFORCE SINGLE OWNER PER COMPANY
-- =============================================
--
-- Problem: Multiple users can have 'owner' role in the same company
-- due to invitation system allowing target_company_role='owner'
--
-- This migration:
-- 1. Demotes extra owners to 'admin' (keeps original owner from companies.user_id)
-- 2. Adds partial unique index enforcing single owner per company
-- 3. Updates invitation acceptance to reject 'owner' role
-- 4. Restricts platform_invitations to only allow 'admin'/'member' roles
--
-- Enterprise requirement: Data integrity at database level, not just app code

BEGIN;

-- =============================================
-- STEP 1: FIX EXISTING DATA
-- =============================================
-- Demote any company_members with role='owner' who are NOT the original
-- company owner (companies.user_id)

-- First, log what we're about to change (for audit trail)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            cm.id as member_id,
            cm.user_id,
            cm.company_id,
            c.name as company_name,
            c.user_id as true_owner_id
        FROM company_members cm
        JOIN companies c ON c.id = cm.company_id
        WHERE cm.role = 'owner'
        AND cm.user_id != c.user_id
    LOOP
        RAISE NOTICE 'DEMOTING: member_id=%, user_id=%, company=% (true owner is %)',
            r.member_id, r.user_id, r.company_name, r.true_owner_id;
    END LOOP;
END $$;

-- Demote extra owners to admin
UPDATE company_members cm
SET role = 'admin'
FROM companies c
WHERE cm.company_id = c.id
AND cm.role = 'owner'
AND cm.user_id != c.user_id;

-- Verify: should now have exactly one owner per company
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO violation_count
    FROM (
        SELECT company_id, COUNT(*) as owner_count
        FROM company_members
        WHERE role = 'owner'
        GROUP BY company_id
        HAVING COUNT(*) > 1
    ) violations;

    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Data integrity check failed: % companies still have multiple owners', violation_count;
    END IF;

    RAISE NOTICE 'Data integrity verified: all companies have at most one owner';
END $$;

-- =============================================
-- STEP 2: ADD DATABASE CONSTRAINT
-- =============================================
-- Partial unique index: only one row with role='owner' per company_id
-- This is the Silicon Valley way - enforce at DB level

DROP INDEX IF EXISTS idx_company_members_single_owner;

CREATE UNIQUE INDEX idx_company_members_single_owner
ON company_members (company_id)
WHERE role = 'owner';

COMMENT ON INDEX idx_company_members_single_owner IS
    'Enforces single owner per company - business rule at database level';

-- =============================================
-- STEP 3: UPDATE INVITATION ACCEPTANCE FUNCTION
-- =============================================
-- Reject attempts to add someone as 'owner' via invitation

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation RECORD;
    v_effective_role TEXT;
BEGIN
    -- Get and lock the invitation
    SELECT * INTO v_invitation
    FROM platform_invitations
    WHERE token = p_token
    FOR UPDATE;

    -- Validate
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    IF v_invitation.status != 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status;
    END IF;

    IF v_invitation.expires_at < now() THEN
        -- Mark as expired
        UPDATE platform_invitations
        SET status = 'expired'
        WHERE id = v_invitation.id;
        RAISE EXCEPTION 'Invitation has expired';
    END IF;

    -- Mark as accepted
    UPDATE platform_invitations
    SET
        status = 'accepted',
        accepted_at = now(),
        accepted_user_id = p_user_id
    WHERE id = v_invitation.id;

    -- If target company specified, add user as member
    IF v_invitation.target_company_id IS NOT NULL THEN
        -- SECURITY: Never allow 'owner' role via invitation
        -- Owner is assigned only when creating a company
        v_effective_role := v_invitation.target_company_role;
        IF v_effective_role = 'owner' THEN
            v_effective_role := 'admin';  -- Downgrade to admin
            RAISE WARNING 'Invitation had owner role - downgraded to admin for security';
        END IF;

        INSERT INTO company_members (company_id, user_id, role)
        VALUES (
            v_invitation.target_company_id,
            p_user_id,
            v_effective_role
        )
        ON CONFLICT (company_id, user_id) DO NOTHING;
    END IF;

    RETURN TRUE;
END;
$$;

-- =============================================
-- STEP 4: RESTRICT INVITATION ROLE OPTIONS
-- =============================================
-- Alter platform_invitations to only allow admin/member for target_company_role
-- This prevents creating invitations with owner role in the first place

-- First, fix any existing pending invitations with owner role
UPDATE platform_invitations
SET target_company_role = 'admin'
WHERE target_company_role = 'owner'
AND status = 'pending';

-- Drop old constraint and add new one
ALTER TABLE platform_invitations
DROP CONSTRAINT IF EXISTS platform_invitations_target_company_role_check;

ALTER TABLE platform_invitations
ADD CONSTRAINT platform_invitations_target_company_role_check
CHECK (target_company_role IN ('admin', 'member'));

COMMENT ON CONSTRAINT platform_invitations_target_company_role_check ON platform_invitations IS
    'Owner role cannot be granted via invitation - only at company creation';

-- =============================================
-- STEP 5: ADD HELPER FUNCTION FOR OWNERSHIP TRANSFER
-- =============================================
-- If ownership needs to be transferred, it must be explicit

CREATE OR REPLACE FUNCTION transfer_company_ownership(
    p_company_id UUID,
    p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_owner_id UUID;
    v_caller_id UUID;
BEGIN
    v_caller_id := auth.uid();

    -- Get current owner
    SELECT user_id INTO v_current_owner_id
    FROM companies
    WHERE id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Company not found';
    END IF;

    -- Only current owner can transfer ownership
    IF v_caller_id != v_current_owner_id THEN
        RAISE EXCEPTION 'Only the company owner can transfer ownership';
    END IF;

    -- Verify new owner is a member of the company
    IF NOT EXISTS (
        SELECT 1 FROM company_members
        WHERE company_id = p_company_id AND user_id = p_new_owner_id
    ) THEN
        RAISE EXCEPTION 'New owner must be an existing member of the company';
    END IF;

    -- Transfer ownership in transaction
    -- 1. Demote current owner to admin in company_members
    UPDATE company_members
    SET role = 'admin'
    WHERE company_id = p_company_id AND user_id = v_current_owner_id;

    -- 2. Promote new owner in company_members
    UPDATE company_members
    SET role = 'owner'
    WHERE company_id = p_company_id AND user_id = p_new_owner_id;

    -- 3. Update companies.user_id (the source of truth for ownership)
    UPDATE companies
    SET user_id = p_new_owner_id
    WHERE id = p_company_id;

    RETURN TRUE;
END;
$$;

-- Only authenticated users can call this
REVOKE EXECUTE ON FUNCTION transfer_company_ownership FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transfer_company_ownership TO authenticated;

COMMENT ON FUNCTION transfer_company_ownership IS
    'Safely transfer company ownership - only callable by current owner';

COMMIT;

-- =============================================
-- VERIFICATION QUERIES (run manually to verify)
-- =============================================
--
-- Check no company has multiple owners:
-- SELECT company_id, COUNT(*) FROM company_members WHERE role = 'owner' GROUP BY company_id HAVING COUNT(*) > 1;
--
-- Check constraint exists:
-- SELECT indexname FROM pg_indexes WHERE indexname = 'idx_company_members_single_owner';
--
-- Check invitation role constraint:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'platform_invitations_target_company_role_check';
