-- =============================================
-- PHASE 1: MY COMPANY ORGANIZATION SCHEMA
-- =============================================
-- Run this in Supabase SQL Editor
-- This creates all tables for the unified "My Company" feature

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    purpose TEXT,
    budget_annual NUMERIC(12,2),
    budget_currency TEXT DEFAULT 'EUR',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, slug)
);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT,
    responsibilities TEXT,
    problems_solved TEXT,
    system_prompt TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department_id, slug)
);

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

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (access via company ownership)
CREATE POLICY "departments_access" ON departments FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

CREATE POLICY "roles_access" ON roles FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);

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

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_department_id ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_decisions_company_id ON decisions(company_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_company_type ON org_documents(company_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_org_document_versions_document ON org_document_versions(document_id);

-- =============================================
-- VERIFICATION
-- =============================================
-- After running, execute these to verify:
-- SELECT * FROM departments;  -- Should return empty, no errors
-- SELECT * FROM roles;        -- Should return empty, no errors
-- SELECT * FROM org_documents; -- Should return empty, no errors
-- SELECT * FROM decisions;    -- Should return empty, no errors
