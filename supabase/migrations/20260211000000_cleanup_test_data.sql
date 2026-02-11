-- =============================================
-- CLEANUP: Remove/rename test data (UXH-117/167/168/171)
-- =============================================
-- Problem: Test data ("Simple Af" company, test users) visible
-- in production, degrading UX for demos and real users.
--
-- Solution:
-- 1. Rename unprofessional company names
-- 2. Populate profiles table with auth emails (fixes UXH-141)
-- 3. Add is_demo flag to companies for future filtering

-- =============================================
-- STEP 1: Rename "Simple Af" to a professional name
-- =============================================

UPDATE companies
SET name = 'Demo Company'
WHERE lower(name) = 'simple af';

-- =============================================
-- STEP 2: Backfill profiles table with auth emails
-- =============================================
-- Ensures team member display shows email instead of "Team Member"
-- This inserts missing profile rows for users who have auth accounts
-- but no profiles entry.

INSERT INTO profiles (id, email, full_name, updated_at)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    now()
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE
SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

-- Also update existing profiles that have NULL email
UPDATE profiles
SET email = au.email,
    updated_at = now()
FROM auth.users au
WHERE profiles.id = au.id
AND profiles.email IS NULL
AND au.email IS NOT NULL;

-- =============================================
-- STEP 3: Add is_demo column for future filtering
-- =============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'is_demo'
    ) THEN
        ALTER TABLE companies ADD COLUMN is_demo boolean DEFAULT false;
    END IF;
END $$;

-- Mark known demo/test companies
UPDATE companies
SET is_demo = true
WHERE lower(name) IN ('demo company', 'test company', 'example corp');

-- =============================================
-- STEP 4: Mark test users in user_metadata (UXH-168)
-- =============================================
-- Flag users with test-like patterns so admin UI can filter them
-- Uses raw_user_meta_data JSONB column in auth.users

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_test": true}'::jsonb
WHERE email LIKE '%+test%'
   OR email LIKE '%curl%'
   OR (raw_user_meta_data->>'full_name') ILIKE '%curl test%'
   OR (raw_user_meta_data->>'full_name') ILIKE '%test user%';
