-- Performance optimization: Add indexes for org_documents queries

-- Index for org_documents: filter by company_id, order by created_at
CREATE INDEX IF NOT EXISTS idx_org_documents_company_created
ON public.org_documents (company_id, created_at DESC);

-- Index for org_document_versions: filter by document_id and is_current
CREATE INDEX IF NOT EXISTS idx_org_document_versions_doc_current
ON public.org_document_versions (document_id, is_current);
