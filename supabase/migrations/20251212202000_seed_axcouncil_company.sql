-- =============================================
-- SEED DATA: AxCouncil Company
-- =============================================
-- This migration ensures the 'axcouncil' company exists in the database
-- so that My Company features work correctly.

-- First, check if the companies table has a slug column, add if missing
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Insert AxCouncil company if it doesn't exist
-- Use the first user as the owner (your user)
INSERT INTO companies (id, name, slug, user_id, created_at)
SELECT
    gen_random_uuid(),
    'AxCouncil',
    'axcouncil',
    (SELECT id FROM auth.users LIMIT 1),  -- First user becomes owner
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE slug = 'axcouncil'
);

-- Update existing company to have the slug if it was created without one
UPDATE companies
SET slug = 'axcouncil'
WHERE name ILIKE '%axcouncil%' AND slug IS NULL;

-- Verify
-- SELECT id, name, slug, user_id FROM companies WHERE slug = 'axcouncil';
