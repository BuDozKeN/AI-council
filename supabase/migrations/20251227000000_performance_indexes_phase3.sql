-- =============================================
-- PERFORMANCE INDEXES - Phase 3
-- =============================================
-- Additional indexes based on backend query pattern analysis
-- These optimize common access patterns identified in the codebase

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- messages.conversation_id + created_at: Used for fetching message history
-- Query: .eq('conversation_id', id).order('created_at', desc=True)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON public.messages (conversation_id, created_at DESC);

-- =============================================================================
-- ACTIVITY_LOGS TABLE
-- =============================================================================
-- activity_logs.company_id + created_at: Used for activity feed with pagination
-- Query: .eq('company_id', id).order('created_at', desc=True).limit(n)
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created
ON public.activity_logs (company_id, created_at DESC);

-- activity_logs.reference_id: Used for orphan cleanup (checking if referenced item exists)
CREATE INDEX IF NOT EXISTS idx_activity_logs_reference_id
ON public.activity_logs (reference_id)
WHERE reference_id IS NOT NULL;

-- =============================================================================
-- KNOWLEDGE_ENTRIES TABLE
-- =============================================================================
-- knowledge_entries.company_id + is_active + created_at: Common decision listing query
-- Query: .eq('company_id', id).eq('is_active', true).order('created_at', desc=True)
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_company_active_created
ON public.knowledge_entries (company_id, is_active, created_at DESC)
WHERE is_active = true;

-- knowledge_entries.company_id + is_active + updated_at: Alternative sort order
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_company_active_updated
ON public.knowledge_entries (company_id, is_active, updated_at DESC)
WHERE is_active = true;

-- =============================================================================
-- PROJECTS TABLE
-- =============================================================================
-- projects.company_id + last_accessed_at: Project listing ordered by recent access
-- Query: .eq('company_id', id).order('last_accessed_at', desc=True)
CREATE INDEX IF NOT EXISTS idx_projects_company_last_accessed
ON public.projects (company_id, last_accessed_at DESC);

-- projects.user_id: Filter by user's projects
CREATE INDEX IF NOT EXISTS idx_projects_user_id
ON public.projects (user_id);

-- =============================================================================
-- DEPARTMENTS TABLE
-- =============================================================================
-- departments.company_id + display_order: Ordered department listing
-- Query: .eq('company_id', id).order('display_order')
CREATE INDEX IF NOT EXISTS idx_departments_company_display_order
ON public.departments (company_id, display_order);

-- =============================================================================
-- ROLES TABLE
-- =============================================================================
-- roles.department_id + display_order: Ordered role listing within department
-- Query: .eq('department_id', id).order('display_order')
CREATE INDEX IF NOT EXISTS idx_roles_department_display_order
ON public.roles (department_id, display_order);

-- =============================================================================
-- COMPANIES TABLE
-- =============================================================================
-- companies.slug: Frequent lookup by slug (API routes use slug in URLs)
-- Query: .eq('slug', slug)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug
ON public.companies (slug);

-- companies.user_id: Filter by owner (RLS and direct queries)
CREATE INDEX IF NOT EXISTS idx_companies_user_id
ON public.companies (user_id);

-- =============================================================================
-- USER_PROFILES TABLE
-- =============================================================================
-- user_profiles.user_id: Primary lookup pattern
-- Query: .eq('user_id', id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id
ON public.user_profiles (user_id);

-- user_profiles.stripe_customer_id: Billing webhook lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
ON public.user_profiles (stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- =============================================================================
-- MODEL_CONFIGS TABLE
-- =============================================================================
-- model_configs.is_enabled + priority: Active model listing ordered by priority
-- Query: .eq('is_enabled', true).order('priority')
CREATE INDEX IF NOT EXISTS idx_model_configs_enabled_priority
ON public.model_configs (is_enabled, priority)
WHERE is_enabled = true;

-- =============================================================================
-- ATTACHMENTS TABLE
-- =============================================================================
-- attachments.message_id: Fetch attachments for a message
CREATE INDEX IF NOT EXISTS idx_attachments_message_id
ON public.attachments (message_id);

-- =============================================================================
-- ORG_DOCUMENTS TABLE
-- =============================================================================
-- org_documents.company_id + doc_type + is_active: Playbook filtering
-- Query: .eq('company_id', id).eq('doc_type', type).eq('is_active', true)
CREATE INDEX IF NOT EXISTS idx_org_documents_company_type_active
ON public.org_documents (company_id, doc_type, is_active)
WHERE is_active = true;

-- =============================================================================
-- PARTIAL INDEXES FOR SOFT DELETES
-- =============================================================================
-- Many tables use is_active or is_archived patterns - partial indexes help

-- Conversations: Only non-archived are typically queried
CREATE INDEX IF NOT EXISTS idx_conversations_user_not_archived
ON public.conversations (user_id, updated_at DESC)
WHERE is_archived = false;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run after migration to verify indexes were created:
-- SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
