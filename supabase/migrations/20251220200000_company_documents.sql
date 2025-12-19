-- Create company_documents table for persistent file library (PDFs, CSVs, URLs)
-- This is separate from org_documents (playbooks) as they have different lifecycles

CREATE TABLE IF NOT EXISTS company_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Document metadata
    title TEXT NOT NULL,
    description TEXT,

    -- Document type and source
    doc_type TEXT NOT NULL CHECK (doc_type IN ('file', 'url')),
    file_type TEXT CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'image', 'txt', 'json', 'xml')),
    mime_type TEXT,

    -- Storage
    storage_path TEXT,  -- Supabase Storage path for file uploads
    source_url TEXT,    -- URL for URL-type documents
    file_size_bytes BIGINT,

    -- Extracted content for context injection
    extracted_text TEXT,
    extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    extraction_error TEXT,

    -- For URL documents: when was content last fetched
    last_fetched_at TIMESTAMPTZ,

    -- Ownership and metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,

    -- Constraints
    CONSTRAINT valid_file_document CHECK (
        doc_type != 'file' OR (storage_path IS NOT NULL AND file_type IS NOT NULL)
    ),
    CONSTRAINT valid_url_document CHECK (
        doc_type != 'url' OR source_url IS NOT NULL
    )
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_project_id ON company_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_doc_type ON company_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_company_documents_is_active ON company_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_company_documents_created_at ON company_documents(created_at DESC);

-- Enable RLS
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Company members can view, company owners can manage

-- Select policy: Company members can view their company's documents
CREATE POLICY "company_documents_select" ON company_documents
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM user_department_access
            WHERE user_id = auth.uid()
        )
        OR
        company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Insert policy: Company owners can add documents
CREATE POLICY "company_documents_insert" ON company_documents
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Update policy: Company owners can update documents
CREATE POLICY "company_documents_update" ON company_documents
    FOR UPDATE
    USING (
        company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Delete policy: Company owners can delete documents
CREATE POLICY "company_documents_delete" ON company_documents
    FOR DELETE
    USING (
        company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Add updated_at trigger
CREATE TRIGGER set_company_documents_updated_at
    BEFORE UPDATE ON company_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE company_documents IS 'Persistent file library for PDFs, CSVs, Excel files, and URLs that can be selected for council context';
COMMENT ON COLUMN company_documents.doc_type IS 'Type of document: file (uploaded) or url (fetched from web)';
COMMENT ON COLUMN company_documents.extraction_status IS 'Status of text extraction from document';
COMMENT ON COLUMN company_documents.extracted_text IS 'Extracted text content for context injection into council prompts';
