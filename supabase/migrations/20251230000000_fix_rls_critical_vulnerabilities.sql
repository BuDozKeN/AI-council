-- ============================================================================
-- CRITICAL RLS SECURITY FIX
-- ============================================================================
-- Fixes vulnerabilities identified in the Data Architecture & RLS Security Audit:
--
-- 1. knowledge_entries: Remove permissive auth.role() = 'authenticated' policy
-- 2. org_document_departments: Remove permissive policies, add proper company scoping
-- 3. activity_logs: Fix INSERT policy that allowed inserting for any company
-- 4. api_key_audit_log: Fix INSERT policy that allowed inserting for any user
-- 5. LLM ops functions: Add SET search_path = '' for security
--
-- Risk: These policies could allow cross-tenant data access
-- ============================================================================

-- ============================================================================
-- 1. FIX knowledge_entries RLS POLICIES
-- ============================================================================
-- The policy from 20251213120000_knowledge_entries_consolidation.sql used
-- auth.role() = 'authenticated' which allows ANY authenticated user to see
-- ALL knowledge entries across ALL companies.
--
-- The 20251220300000_company_members_and_usage.sql migration added proper
-- company-scoped policies, but we need to ensure the old permissive policy
-- is removed.

-- Drop ALL legacy permissive policies that might still exist
DROP POLICY IF EXISTS "Users can view their company knowledge" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view knowledge for their departments" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can view knowledge based on scope" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can create knowledge for their departments" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can manage their own knowledge entries" ON knowledge_entries;
DROP POLICY IF EXISTS "Users can delete their own knowledge entries" ON knowledge_entries;

-- Drop the properly named policies (will recreate)
DROP POLICY IF EXISTS "knowledge_entries_select" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_insert" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_update" ON knowledge_entries;
DROP POLICY IF EXISTS "knowledge_entries_delete" ON knowledge_entries;

-- Ensure RLS is enabled
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: Only company members can view knowledge entries
CREATE POLICY "knowledge_entries_select" ON knowledge_entries
    FOR SELECT
    USING (is_company_member(company_id));

-- INSERT: Only company members can create entries
CREATE POLICY "knowledge_entries_insert" ON knowledge_entries
    FOR INSERT
    WITH CHECK (is_company_member(company_id));

-- UPDATE: Only company members can update entries
CREATE POLICY "knowledge_entries_update" ON knowledge_entries
    FOR UPDATE
    USING (is_company_member(company_id));

-- DELETE: Only company admins can delete entries
CREATE POLICY "knowledge_entries_delete" ON knowledge_entries
    FOR DELETE
    USING (is_company_admin(company_id));


-- ============================================================================
-- 2. FIX org_document_departments RLS POLICIES
-- ============================================================================
-- The policy from 20251213100000_playbook_tags_and_multi_dept.sql used:
-- - auth.role() = 'authenticated' for SELECT
-- - USING (true) WITH CHECK (true) for ALL (service role)
--
-- These need proper company scoping.

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Authenticated users can view org_document_departments" ON org_document_departments;
DROP POLICY IF EXISTS "Service role has full access to org_document_departments" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_select" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_insert" ON org_document_departments;
DROP POLICY IF EXISTS "org_document_departments_delete" ON org_document_departments;

-- Ensure RLS is enabled
ALTER TABLE org_document_departments ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view document-department links for documents in their company
CREATE POLICY "org_document_departments_select" ON org_document_departments
    FOR SELECT
    USING (
        document_id IN (
            SELECT id FROM org_documents
            WHERE is_company_member(company_id)
        )
    );

-- INSERT: Users can create links for documents in their company
CREATE POLICY "org_document_departments_insert" ON org_document_departments
    FOR INSERT
    WITH CHECK (
        document_id IN (
            SELECT id FROM org_documents
            WHERE is_company_member(company_id)
        )
    );

-- UPDATE: Users can update links for documents in their company
CREATE POLICY "org_document_departments_update" ON org_document_departments
    FOR UPDATE
    USING (
        document_id IN (
            SELECT id FROM org_documents
            WHERE is_company_member(company_id)
        )
    );

-- DELETE: Only admins can delete links
CREATE POLICY "org_document_departments_delete" ON org_document_departments
    FOR DELETE
    USING (
        document_id IN (
            SELECT id FROM org_documents
            WHERE is_company_admin(company_id)
        )
    );


-- ============================================================================
-- 3. FIX activity_logs INSERT POLICY
-- ============================================================================
-- The policy from 20251212260000_add_activity_logs.sql used WITH CHECK (true)
-- which allows inserting activity logs for ANY company.

-- Drop existing policies
DROP POLICY IF EXISTS "Users see own company activity" ON activity_logs;
DROP POLICY IF EXISTS "Service role can insert activity" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_select" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;

-- Ensure RLS is enabled
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Only company admins can view activity logs
CREATE POLICY "activity_logs_select" ON activity_logs
    FOR SELECT
    USING (is_company_admin(company_id));

-- INSERT: Only company members can insert logs for their company
CREATE POLICY "activity_logs_insert" ON activity_logs
    FOR INSERT
    WITH CHECK (is_company_member(company_id));


-- ============================================================================
-- 4. FIX api_key_audit_log INSERT POLICY
-- ============================================================================
-- The policy from 20251224210000_api_key_expiry_rotation.sql used
-- WITH CHECK (true) which allows any user to insert audit entries.

-- Drop existing policies
DROP POLICY IF EXISTS "Users view own API key audit log" ON api_key_audit_log;
DROP POLICY IF EXISTS "Service role inserts audit log" ON api_key_audit_log;

-- Ensure RLS is enabled
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can only view their own audit log
CREATE POLICY "api_key_audit_log_select" ON api_key_audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT: Users can only insert entries for themselves
-- Note: In practice, inserts happen via service role, but this is defense in depth
CREATE POLICY "api_key_audit_log_insert" ON api_key_audit_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 5. FIX LLM OPS FUNCTIONS - ADD search_path
-- ============================================================================
-- Functions from 20251229000000_llm_ops_enhancements.sql are missing
-- SET search_path = '' which is a security best practice for SECURITY DEFINER.

-- 5.1 increment_rate_limit_counter
CREATE OR REPLACE FUNCTION increment_rate_limit_counter(
    p_company_id UUID,
    p_sessions INTEGER DEFAULT 1,
    p_tokens INTEGER DEFAULT 0,
    p_cost_cents INTEGER DEFAULT 0
) RETURNS TABLE(
    hourly_sessions INTEGER,
    daily_sessions INTEGER,
    monthly_tokens INTEGER,
    monthly_cost_cents INTEGER
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_hour_start TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day_start TIMESTAMPTZ := date_trunc('day', v_now);
    v_month_start TIMESTAMPTZ := date_trunc('month', v_now);
    v_hourly INTEGER;
    v_daily INTEGER;
    v_monthly_tokens INTEGER;
    v_monthly_cost INTEGER;
BEGIN
    -- Upsert hourly counter
    INSERT INTO public.rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'hourly', v_hour_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = public.rate_limit_counters.session_count + p_sessions,
        token_count = public.rate_limit_counters.token_count + p_tokens,
        cost_cents = public.rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING session_count INTO v_hourly;

    -- Upsert daily counter
    INSERT INTO public.rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'daily', v_day_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = public.rate_limit_counters.session_count + p_sessions,
        token_count = public.rate_limit_counters.token_count + p_tokens,
        cost_cents = public.rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING session_count INTO v_daily;

    -- Upsert monthly counter
    INSERT INTO public.rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'monthly', v_month_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = public.rate_limit_counters.session_count + p_sessions,
        token_count = public.rate_limit_counters.token_count + p_tokens,
        cost_cents = public.rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING token_count, cost_cents INTO v_monthly_tokens, v_monthly_cost;

    RETURN QUERY SELECT v_hourly, v_daily, v_monthly_tokens, v_monthly_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- 5.2 check_rate_limits
CREATE OR REPLACE FUNCTION check_rate_limits(p_company_id UUID)
RETURNS TABLE(
    limit_type TEXT,
    current_value INTEGER,
    limit_value INTEGER,
    is_exceeded BOOLEAN,
    is_warning BOOLEAN
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_hour_start TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day_start TIMESTAMPTZ := date_trunc('day', v_now);
    v_month_start TIMESTAMPTZ := date_trunc('month', v_now);
    v_limits public.rate_limits%ROWTYPE;
    v_hourly public.rate_limit_counters%ROWTYPE;
    v_daily public.rate_limit_counters%ROWTYPE;
    v_monthly public.rate_limit_counters%ROWTYPE;
BEGIN
    -- Get company rate limits (use defaults if not set)
    SELECT * INTO v_limits FROM public.rate_limits WHERE company_id = p_company_id;
    IF NOT FOUND THEN
        v_limits.sessions_per_hour := 20;
        v_limits.sessions_per_day := 100;
        v_limits.tokens_per_month := 10000000;
        v_limits.budget_cents_per_month := 10000;
        v_limits.alert_threshold_percent := 80;
    END IF;

    -- Get current counters
    SELECT * INTO v_hourly FROM public.rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'hourly' AND window_start = v_hour_start;

    SELECT * INTO v_daily FROM public.rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'daily' AND window_start = v_day_start;

    SELECT * INTO v_monthly FROM public.rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'monthly' AND window_start = v_month_start;

    -- Check hourly sessions
    RETURN QUERY SELECT
        'sessions_hourly'::TEXT,
        COALESCE(v_hourly.session_count, 0),
        v_limits.sessions_per_hour,
        COALESCE(v_hourly.session_count, 0) >= v_limits.sessions_per_hour,
        COALESCE(v_hourly.session_count, 0) >= (v_limits.sessions_per_hour * v_limits.alert_threshold_percent / 100);

    -- Check daily sessions
    RETURN QUERY SELECT
        'sessions_daily'::TEXT,
        COALESCE(v_daily.session_count, 0),
        v_limits.sessions_per_day,
        COALESCE(v_daily.session_count, 0) >= v_limits.sessions_per_day,
        COALESCE(v_daily.session_count, 0) >= (v_limits.sessions_per_day * v_limits.alert_threshold_percent / 100);

    -- Check monthly tokens
    RETURN QUERY SELECT
        'tokens_monthly'::TEXT,
        COALESCE(v_monthly.token_count, 0),
        v_limits.tokens_per_month,
        COALESCE(v_monthly.token_count, 0) >= v_limits.tokens_per_month,
        COALESCE(v_monthly.token_count, 0) >= (v_limits.tokens_per_month * v_limits.alert_threshold_percent / 100);

    -- Check monthly budget
    RETURN QUERY SELECT
        'budget_monthly'::TEXT,
        COALESCE(v_monthly.cost_cents, 0),
        v_limits.budget_cents_per_month,
        COALESCE(v_monthly.cost_cents, 0) >= v_limits.budget_cents_per_month,
        COALESCE(v_monthly.cost_cents, 0) >= (v_limits.budget_cents_per_month * v_limits.alert_threshold_percent / 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';


-- 5.3 get_usage_analytics
CREATE OR REPLACE FUNCTION get_usage_analytics(
    p_company_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE(
    date DATE,
    sessions INTEGER,
    tokens_input BIGINT,
    tokens_output BIGINT,
    tokens_total BIGINT,
    cache_read_tokens BIGINT,
    estimated_cost_cents BIGINT,
    top_models JSONB,
    council_sessions INTEGER,
    council_cost_cents BIGINT,
    internal_sessions INTEGER,
    internal_cost_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(su.created_at) as date,
        COUNT(*)::INTEGER as sessions,
        SUM(su.tokens_input)::BIGINT as tokens_input,
        SUM(su.tokens_output)::BIGINT as tokens_output,
        SUM(su.tokens_total)::BIGINT as tokens_total,
        SUM(su.cache_read_tokens)::BIGINT as cache_read_tokens,
        SUM(su.estimated_cost_cents)::BIGINT as estimated_cost_cents,
        jsonb_agg(DISTINCT su.model_breakdown) FILTER (WHERE su.model_breakdown != '{}') as top_models,
        -- Council sessions (user-facing)
        COUNT(*) FILTER (WHERE su.session_type NOT LIKE 'internal_%')::INTEGER as council_sessions,
        COALESCE(SUM(su.estimated_cost_cents) FILTER (WHERE su.session_type NOT LIKE 'internal_%'), 0)::BIGINT as council_cost_cents,
        -- Internal operations (background LLM calls)
        COUNT(*) FILTER (WHERE su.session_type LIKE 'internal_%')::INTEGER as internal_sessions,
        COALESCE(SUM(su.estimated_cost_cents) FILTER (WHERE su.session_type LIKE 'internal_%'), 0)::BIGINT as internal_cost_cents
    FROM public.session_usage su
    WHERE su.company_id = p_company_id
    AND su.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(su.created_at)
    ORDER BY DATE(su.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';


-- 5.4 cleanup_old_rate_limit_counters
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_counters()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.rate_limit_counters
    WHERE
        (window_type = 'hourly' AND window_start < NOW() - INTERVAL '24 hours')
        OR (window_type = 'daily' AND window_start < NOW() - INTERVAL '7 days')
        OR (window_type = 'monthly' AND window_start < NOW() - INTERVAL '3 months');

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- 5.5 is_api_key_expired
CREATE OR REPLACE FUNCTION is_api_key_expired(key_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    key_expires_at TIMESTAMPTZ;
    key_revoked_at TIMESTAMPTZ;
BEGIN
    SELECT expires_at, revoked_at INTO key_expires_at, key_revoked_at
    FROM public.user_api_keys
    WHERE user_id = key_user_id;

    -- Key is expired if revoked or past expiry date
    IF key_revoked_at IS NOT NULL THEN
        RETURN TRUE;
    END IF;

    IF key_expires_at IS NOT NULL AND key_expires_at < NOW() THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';


-- ============================================================================
-- 6. ADD MISSING INDEX FOR RLS PERFORMANCE
-- ============================================================================
-- The companies table RLS policies use user_id = auth.uid() but there's no
-- explicit index on user_id (only the primary key on id).

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify policies are correct:
--
-- Check all policies on affected tables:
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('knowledge_entries', 'org_document_departments', 'activity_logs', 'api_key_audit_log')
-- ORDER BY tablename, policyname;
--
-- Verify no permissive auth.role() policies remain:
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE qual LIKE '%auth.role()%'
-- AND schemaname = 'public';
--
-- Test cross-tenant isolation (as user A, try to see company B data):
-- SELECT * FROM knowledge_entries WHERE company_id = '<company-b-id>';
-- Should return empty set if user A is not a member of company B
-- ============================================================================
