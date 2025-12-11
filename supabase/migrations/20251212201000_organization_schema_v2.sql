-- =============================================
-- PHASE 1: MY COMPANY ORGANIZATION SCHEMA (v2)
-- =============================================
-- Fixed version - accounts for existing tables
-- Only adds new tables and missing columns

-- Add missing columns to existing roles table
ALTER TABLE roles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS responsibilities TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS problems_solved TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to existing departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS budget_annual NUMERIC(12,2);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'EUR';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill company_id for roles from their department's company
UPDATE roles r
SET company_id = d.company_id
FROM departments d
WHERE r.department_id = d.id
AND r.company_id IS NULL;

-- Playbooks (SOPs, Frameworks, Policies)
CREATE TABLE IF NOT EXISTS org_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('sop', 'framework', 'policy')),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    summary TEXT,
    is_active BOOLEAN DEFAULT true,
    auto_inject BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, doc_type, slug)
);

-- Document Versions
CREATE TABLE IF NOT EXISTS org_document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES org_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    change_summary TEXT,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(document_id, version)
);

-- Decisions (replaces Knowledge Base)
CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source_conversation_id UUID REFERENCES conversations(id),
    source_message_id UUID,
    tags TEXT[] DEFAULT '{}',
    is_promoted BOOLEAN DEFAULT false,
    promoted_to_id UUID REFERENCES org_documents(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "org_documents_access" ON org_documents;
DROP POLICY IF EXISTS "org_document_versions_access" ON org_document_versions;
DROP POLICY IF EXISTS "decisions_access" ON decisions;

-- RLS Policies for new tables
CREATE POLICY "org_documents_access" ON org_documents FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

CREATE POLICY "org_document_versions_access" ON org_document_versions FOR ALL USING (
    document_id IN (
        SELECT id FROM org_documents
        WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
    )
);

CREATE POLICY "decisions_access" ON decisions FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

-- Add RLS policy for roles now that company_id exists
DROP POLICY IF EXISTS "roles_company_access" ON roles;
CREATE POLICY "roles_company_access" ON roles FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_decisions_company_id ON decisions(company_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_company_type ON org_documents(company_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_org_document_versions_document ON org_document_versions(document_id);

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, execute these to verify:
-- SELECT * FROM org_documents;  -- Should return empty, no errors
-- SELECT * FROM decisions;      -- Should return empty, no errors
