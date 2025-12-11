-- =============================================
-- SEED DATA: Complete AxCouncil Organization
-- =============================================
-- This migration creates the full AxCouncil company with all
-- departments and roles from the filesystem config.json
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. ENSURE COMPANY EXISTS
-- =============================================

-- Add slug column if missing
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Insert AxCouncil company (or update if exists)
INSERT INTO companies (id, name, slug, user_id, created_at)
SELECT
    gen_random_uuid(),
    'AxCouncil',
    'axcouncil',
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM companies WHERE slug = 'axcouncil'
);

-- Store company ID for later use
DO $$
DECLARE
    v_company_id UUID;
    v_dept_executive UUID;
    v_dept_technology UUID;
    v_dept_marketing UUID;
    v_dept_sales UUID;
    v_dept_finance UUID;
    v_dept_legal UUID;
    v_dept_operations UUID;
BEGIN
    -- Get the company ID
    SELECT id INTO v_company_id FROM companies WHERE slug = 'axcouncil';

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'AxCouncil company not found';
    END IF;

    -- =============================================
    -- 2. CREATE DEPARTMENTS
    -- =============================================

    -- Executive Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Executive', 'executive', 'Strategic advisory and high-level decision making', 1, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_executive;

    IF v_dept_executive IS NULL THEN
        SELECT id INTO v_dept_executive FROM departments WHERE company_id = v_company_id AND slug = 'executive';
    END IF;

    -- Technology Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Technology', 'technology', 'Technical execution and development guidance', 2, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_technology;

    IF v_dept_technology IS NULL THEN
        SELECT id INTO v_dept_technology FROM departments WHERE company_id = v_company_id AND slug = 'technology';
    END IF;

    -- Marketing Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Marketing', 'marketing', 'Marketing strategy and execution', 3, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_marketing;

    IF v_dept_marketing IS NULL THEN
        SELECT id INTO v_dept_marketing FROM departments WHERE company_id = v_company_id AND slug = 'marketing';
    END IF;

    -- Sales Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Sales', 'sales', 'Sales strategy and outreach', 4, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_sales;

    IF v_dept_sales IS NULL THEN
        SELECT id INTO v_dept_sales FROM departments WHERE company_id = v_company_id AND slug = 'sales';
    END IF;

    -- Finance Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Finance', 'finance', 'Financial planning and analysis', 5, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_finance;

    IF v_dept_finance IS NULL THEN
        SELECT id INTO v_dept_finance FROM departments WHERE company_id = v_company_id AND slug = 'finance';
    END IF;

    -- Legal Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Legal', 'legal', 'Legal compliance and contracts', 6, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_legal;

    IF v_dept_legal IS NULL THEN
        SELECT id INTO v_dept_legal FROM departments WHERE company_id = v_company_id AND slug = 'legal';
    END IF;

    -- Operations Department
    INSERT INTO departments (id, company_id, name, slug, description, display_order, created_at)
    VALUES (gen_random_uuid(), v_company_id, 'Operations', 'operations', 'Business operations and processes', 7, NOW())
    ON CONFLICT (company_id, slug) DO UPDATE SET description = EXCLUDED.description
    RETURNING id INTO v_dept_operations;

    IF v_dept_operations IS NULL THEN
        SELECT id INTO v_dept_operations FROM departments WHERE company_id = v_company_id AND slug = 'operations';
    END IF;

    -- =============================================
    -- 3. CREATE ROLES
    -- =============================================

    -- Executive Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_executive, 'CEO', 'ceo', 'Chief Executive Officer', 1, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_executive, 'Strategic Advisor', 'advisor', 'General strategic guidance', 2, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Technology Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_technology, 'CTO', 'cto', 'Chief Technology Officer', 1, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_technology, 'Developer', 'developer', 'Development guidance', 2, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_technology, 'DevOps', 'devops', 'Deployment and infrastructure', 3, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Marketing Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_marketing, 'CMO', 'cmo', 'Chief Marketing Officer', 1, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_marketing, 'Content Manager', 'content', 'Content creation and strategy', 2, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_marketing, 'SEO Specialist', 'seo', 'Search engine optimization', 3, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_marketing, 'Social Media Manager', 'social-media', 'Manages social media presence and engagement', 4, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Sales Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_sales, 'Sales Lead', 'sales-lead', 'Sales strategy and execution', 1, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Finance Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_finance, 'CFO', 'cfo', 'Chief Financial Officer', 1, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_finance, 'Accountant', 'accountant', 'Accounting and bookkeeping', 2, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Legal Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_legal, 'Legal Counsel', 'legal-counsel', 'Legal advice and compliance', 1, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    -- Operations Roles
    INSERT INTO roles (id, company_id, department_id, name, slug, title, display_order, created_at)
    VALUES
        (gen_random_uuid(), v_company_id, v_dept_operations, 'COO', 'coo', 'Chief Operations Officer', 1, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_operations, 'Head of AI People & Culture', 'ai-people-culture', 'AI org structure, roles, governance and capability development', 2, NOW()),
        (gen_random_uuid(), v_company_id, v_dept_operations, 'AI UX/UI Designer', 'ai-ux-ui-designer', 'Zero-friction interface design and user experience optimization', 3, NOW())
    ON CONFLICT (department_id, slug) DO UPDATE SET title = EXCLUDED.title;

    RAISE NOTICE 'AxCouncil organization seeded successfully!';
    RAISE NOTICE 'Company ID: %', v_company_id;

END $$;

-- =============================================
-- 4. VERIFICATION QUERIES
-- =============================================
-- Run these after the migration to verify:

-- Check company
-- SELECT id, name, slug FROM companies WHERE slug = 'axcouncil';

-- Check departments
-- SELECT d.name, d.slug, d.description, d.display_order
-- FROM departments d
-- JOIN companies c ON d.company_id = c.id
-- WHERE c.slug = 'axcouncil'
-- ORDER BY d.display_order;

-- Check roles
-- SELECT d.name as department, r.name as role, r.title, r.display_order
-- FROM roles r
-- JOIN departments d ON r.department_id = d.id
-- JOIN companies c ON r.company_id = c.id
-- WHERE c.slug = 'axcouncil'
-- ORDER BY d.display_order, r.display_order;

-- Count summary
-- SELECT
--     (SELECT COUNT(*) FROM departments d JOIN companies c ON d.company_id = c.id WHERE c.slug = 'axcouncil') as dept_count,
--     (SELECT COUNT(*) FROM roles r JOIN companies c ON r.company_id = c.id WHERE c.slug = 'axcouncil') as role_count;
