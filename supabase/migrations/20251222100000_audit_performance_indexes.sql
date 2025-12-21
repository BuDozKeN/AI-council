-- Performance indexes identified during code audit
-- These indexes improve query performance for common access patterns

-- Index for knowledge_entries filtered by project and active status
-- Used in: _auto_synthesize_project_context, get_injectable_entries
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_project_active
ON public.knowledge_entries (project_id, is_active, created_at DESC)
WHERE is_active = true;

-- Index for roles by department (frequently joined in context loading)
-- Used in: get_department_roles, context_loader queries
CREATE INDEX IF NOT EXISTS idx_roles_department
ON public.roles (department_id);

-- Index for playbooks by company with active filter
-- Used in: get_playbooks_for_context, getCompanyPlaybooks
CREATE INDEX IF NOT EXISTS idx_playbooks_company_active
ON public.org_documents (company_id, is_active)
WHERE is_active = true;

-- Index for knowledge_entries by company with active filter
-- Used in: getKnowledgeEntries, get_decisions_for_context
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_company_active
ON public.knowledge_entries (company_id, is_active, created_at DESC)
WHERE is_active = true;
