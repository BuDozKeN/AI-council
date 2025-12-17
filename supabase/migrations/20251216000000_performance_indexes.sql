-- Performance optimization: Add index for conversations ordering
-- Suggested by Supabase query analyzer
-- Improves queries that ORDER BY is_starred DESC, updated_at DESC

-- Index for is_starred (used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_conversations_is_starred
ON public.conversations USING btree (is_starred);

-- Composite index for the common query pattern: filter by user_id + is_archived, order by is_starred + updated_at
CREATE INDEX IF NOT EXISTS idx_conversations_user_archived_starred
ON public.conversations USING btree (user_id, is_archived, is_starred DESC, updated_at DESC);

-- Index for org_documents: filter by company_id, order by created_at
CREATE INDEX IF NOT EXISTS idx_org_documents_company_created
ON public.org_documents (company_id, created_at DESC);

-- Index for org_document_versions: filter by document_id and is_current
CREATE INDEX IF NOT EXISTS idx_org_document_versions_doc_current
ON public.org_document_versions (document_id, is_current);
