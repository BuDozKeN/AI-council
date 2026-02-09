-- =============================================
-- FIX: Company Membership Gaps (ISS-024-028)
-- =============================================
-- Problem: Companies created via resolve_company_id() don't have
-- the creator added to company_members table, making them
-- inaccessible via RLS policies.
--
-- Solution:
-- 1. Add trigger to auto-add company creator as owner
-- 2. Backfill existing companies without any members

-- =============================================
-- STEP 1: CREATE TRIGGER FOR NEW COMPANIES
-- =============================================
-- When a company is created, automatically add the creator as owner

CREATE OR REPLACE FUNCTION auto_add_company_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add if user_id is set (authenticated creation)
    IF NEW.user_id IS NOT NULL THEN
        INSERT INTO company_members (company_id, user_id, role, joined_at)
        VALUES (NEW.id, NEW.user_id, 'owner', NOW())
        ON CONFLICT (company_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_auto_add_company_owner ON companies;

-- Create the trigger
CREATE TRIGGER trigger_auto_add_company_owner
    AFTER INSERT ON companies
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_company_owner();

-- =============================================
-- STEP 2: BACKFILL COMPANIES WITHOUT MEMBERS
-- =============================================
-- For companies that have user_id set but no members,
-- add the owner to company_members

INSERT INTO company_members (company_id, user_id, role, joined_at)
SELECT c.id, c.user_id, 'owner', c.created_at
FROM companies c
WHERE c.user_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.company_id = c.id
)
ON CONFLICT (company_id, user_id) DO NOTHING;

-- =============================================
-- STEP 3: LOG ANY ORPHANED COMPANIES
-- =============================================
-- Companies with NULL user_id and no members are orphaned.
-- Log them for manual review but don't delete.

DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM companies c
    WHERE c.user_id IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = c.id
    );

    IF orphan_count > 0 THEN
        RAISE NOTICE 'Found % orphaned companies (no owner or members). Run this query to review:
SELECT id, name, slug, created_at FROM companies c
WHERE c.user_id IS NULL
AND NOT EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = c.id);', orphan_count;
    END IF;
END $$;
