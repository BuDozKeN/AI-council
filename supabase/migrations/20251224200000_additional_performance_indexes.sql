-- Additional performance indexes identified during CTO audit
-- These indexes improve query performance for remaining hot paths

-- =============================================================================
-- MODEL RANKINGS INDEXES
-- =============================================================================
-- Index for leaderboard queries filtered by department
-- Used in: get_department_leaderboard, get_all_department_leaderboards
CREATE INDEX IF NOT EXISTS idx_model_rankings_department
ON public.model_rankings (department);

-- Index for global leaderboard aggregation by model and rank
CREATE INDEX IF NOT EXISTS idx_model_rankings_model_rank
ON public.model_rankings (model, average_rank);


-- =============================================================================
-- CONVERSATIONS INDEXES
-- =============================================================================
-- Index for conversations filtered by company_id (for company-scoped queries)
-- Used in: list_conversations with company_id filter
CREATE INDEX IF NOT EXISTS idx_conversations_company_updated
ON public.conversations (company_id, updated_at DESC)
WHERE company_id IS NOT NULL;

-- Index for messages by conversation (for get_conversation pagination)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON public.messages (conversation_id, created_at DESC);


-- =============================================================================
-- USER ACCESS INDEXES
-- =============================================================================
-- Index for user_department_access lookups (used in list_available_businesses)
CREATE INDEX IF NOT EXISTS idx_user_dept_access_user
ON public.user_department_access (user_id);


-- =============================================================================
-- KNOWLEDGE ENTRIES INDEXES
-- =============================================================================
-- Index for knowledge entries by department (array containment)
-- Note: GIN index for array operations
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_dept_ids
ON public.knowledge_entries USING GIN (department_ids)
WHERE is_active = true;
