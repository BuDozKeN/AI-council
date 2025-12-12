-- =============================================
-- FIX: Remove duplicate roles and add constraints
-- =============================================
-- This migration cleans up duplicate roles and adds proper
-- unique constraints to prevent future duplicates.

-- =============================================
-- 1. IDENTIFY AND REMOVE DUPLICATE ROLES
-- =============================================
-- Keep only the oldest role for each (department_id, slug) combination

-- First, let's see what duplicates exist (for logging)
DO $$
DECLARE
    dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dup_count
    FROM (
        SELECT department_id, slug, COUNT(*) as cnt
        FROM roles
        WHERE department_id IS NOT NULL AND slug IS NOT NULL
        GROUP BY department_id, slug
        HAVING COUNT(*) > 1
    ) as dups;

    RAISE NOTICE 'Found % duplicate (department_id, slug) combinations to clean up', dup_count;
END $$;

-- Delete duplicate roles, keeping only the one with the oldest created_at
DELETE FROM roles
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY department_id, slug
                   ORDER BY created_at ASC, id ASC
               ) as rn
        FROM roles
        WHERE department_id IS NOT NULL AND slug IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Verify cleanup
DO $$
DECLARE
    remaining_dups INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_dups
    FROM (
        SELECT department_id, slug, COUNT(*) as cnt
        FROM roles
        WHERE department_id IS NOT NULL AND slug IS NOT NULL
        GROUP BY department_id, slug
        HAVING COUNT(*) > 1
    ) as dups;

    IF remaining_dups = 0 THEN
        RAISE NOTICE 'SUCCESS: All duplicate roles have been removed';
    ELSE
        RAISE WARNING 'WARNING: % duplicate combinations still remain', remaining_dups;
    END IF;
END $$;

-- =============================================
-- 2. ADD UNIQUE CONSTRAINT TO PREVENT FUTURE DUPLICATES
-- =============================================
-- Drop if exists first (in case of partial runs)
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_department_slug_unique;

-- Add unique constraint on department_id + slug
-- This ensures ON CONFLICT clauses work properly in future migrations
ALTER TABLE roles ADD CONSTRAINT roles_department_slug_unique
    UNIQUE (department_id, slug);

-- NOTE: We do NOT add a unique constraint on (company_id, name) because
-- different departments may legitimately have roles with the same name
-- (e.g., "Content Manager" in Marketing vs HR). The department_slug constraint
-- is the correct level of uniqueness.

DO $$
BEGIN
    RAISE NOTICE 'Unique constraint roles_department_slug_unique added to roles table';
END $$;

-- =============================================
-- 3. VERIFICATION
-- =============================================
-- Run these queries to verify:
-- SELECT department_id, slug, COUNT(*) FROM roles GROUP BY department_id, slug HAVING COUNT(*) > 1;
-- Should return 0 rows

-- SELECT * FROM pg_constraint WHERE conrelid = 'roles'::regclass AND contype = 'u';
-- Should show the new unique constraints
