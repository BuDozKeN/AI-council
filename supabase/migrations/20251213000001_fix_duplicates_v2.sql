-- =============================================
-- FIX: Remove duplicate roles (v2)
-- =============================================
-- Previous migration partially ran and added roles_department_slug_unique.
-- This migration cleans up the actual duplicates seen in the UI:
-- Content Manager, SEO Specialist, Social Media Manager, Head of AI People & Culture

-- =============================================
-- 1. FIRST: Analyze what duplicates actually exist
-- =============================================
DO $$
DECLARE
    dept_slug_dups INTEGER;
    company_name_dups INTEGER;
BEGIN
    -- Check for duplicates by department_id + slug
    SELECT COUNT(*) INTO dept_slug_dups
    FROM (
        SELECT department_id, slug, COUNT(*) as cnt
        FROM roles
        WHERE department_id IS NOT NULL AND slug IS NOT NULL
        GROUP BY department_id, slug
        HAVING COUNT(*) > 1
    ) as dups;

    -- Check for duplicates by company_id + name
    SELECT COUNT(*) INTO company_name_dups
    FROM (
        SELECT company_id, name, COUNT(*) as cnt
        FROM roles
        WHERE company_id IS NOT NULL AND name IS NOT NULL
        GROUP BY company_id, name
        HAVING COUNT(*) > 1
    ) as dups;

    RAISE NOTICE 'Duplicates by (department_id, slug): %', dept_slug_dups;
    RAISE NOTICE 'Duplicates by (company_id, name): %', company_name_dups;
END $$;

-- =============================================
-- 2. REMOVE DUPLICATES BY (company_id, name)
-- =============================================
-- Since the UI shows duplicates like "Content Manager" appearing twice,
-- and these are in the SAME department, we need to dedupe by company_id + name.
-- Keep only the oldest role for each name.

-- First, show what will be deleted
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Roles to be deleted (keeping oldest):';
    FOR rec IN
        SELECT id, name, created_at
        FROM (
            SELECT id, name, created_at,
                   ROW_NUMBER() OVER (
                       PARTITION BY company_id, name
                       ORDER BY created_at ASC, id ASC
                   ) as rn
            FROM roles
            WHERE company_id IS NOT NULL AND name IS NOT NULL
        ) ranked
        WHERE rn > 1
        ORDER BY name
    LOOP
        RAISE NOTICE '  - % (id: %, created: %)', rec.name, rec.id, rec.created_at;
    END LOOP;
END $$;

-- Delete the duplicates
DELETE FROM roles
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY company_id, name
                   ORDER BY created_at ASC, id ASC
               ) as rn
        FROM roles
        WHERE company_id IS NOT NULL AND name IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- =============================================
-- 3. VERIFY CLEANUP
-- =============================================
DO $$
DECLARE
    remaining_dups INTEGER;
    total_roles INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_dups
    FROM (
        SELECT company_id, name, COUNT(*) as cnt
        FROM roles
        WHERE company_id IS NOT NULL AND name IS NOT NULL
        GROUP BY company_id, name
        HAVING COUNT(*) > 1
    ) as dups;

    SELECT COUNT(*) INTO total_roles FROM roles;

    IF remaining_dups = 0 THEN
        RAISE NOTICE 'SUCCESS: All duplicate roles have been removed';
        RAISE NOTICE 'Total roles remaining: %', total_roles;
    ELSE
        RAISE WARNING 'WARNING: % duplicate combinations still remain', remaining_dups;
    END IF;
END $$;

-- =============================================
-- 4. NOTE: Do NOT add company_name unique constraint
-- =============================================
-- Different departments may legitimately have roles with the same name
-- (e.g., "Content Manager" in Marketing and "Content Manager" in HR).
-- The roles_department_slug_unique constraint from the previous migration
-- is the correct level of uniqueness.
