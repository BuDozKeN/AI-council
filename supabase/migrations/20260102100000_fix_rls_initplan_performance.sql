-- ============================================================================
-- FIX RLS INITPLAN PERFORMANCE
-- ============================================================================
-- Fixes Supabase linter warnings about auth.uid() re-evaluation per row.
--
-- Problem: When RLS policies use auth.uid() directly, PostgreSQL evaluates
-- the function for EACH row being checked, which is inefficient at scale.
--
-- Solution: Wrap auth.uid() in a subquery: (SELECT auth.uid())
-- This forces PostgreSQL to evaluate it once as an InitPlan and cache the result.
--
-- Affected tables (from linter):
-- - api_key_audit_log (select, insert)
-- - rate_limits (select, insert, update, delete)
-- - budget_alerts (select, update)
-- - rate_limit_counters (select)
-- - session_usage (insert)
-- - usage_events (insert)
-- ============================================================================

-- ============================================================================
-- 1. FIX api_key_audit_log POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users view own API key audit log" ON api_key_audit_log;
DROP POLICY IF EXISTS "Service role inserts audit log" ON api_key_audit_log;
DROP POLICY IF EXISTS "api_key_audit_log_select" ON api_key_audit_log;
DROP POLICY IF EXISTS "api_key_audit_log_insert" ON api_key_audit_log;

-- SELECT: Users can only view their own audit log
CREATE POLICY "api_key_audit_log_select" ON api_key_audit_log
    FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

-- INSERT: Service role or authenticated users can insert their own logs
CREATE POLICY "api_key_audit_log_insert" ON api_key_audit_log
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT auth.uid()) IS NULL);


-- ============================================================================
-- 2. FIX rate_limits POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "rate_limits_select" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_insert" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_update" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_delete" ON rate_limits;

-- SELECT: Only owners and admins can view rate limits
CREATE POLICY "rate_limits_select" ON rate_limits
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limits.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );

-- INSERT: Only owners can create rate limits for their company
CREATE POLICY "rate_limits_insert" ON rate_limits
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limits.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role = 'owner'
        )
    );

-- UPDATE: Only owners can update rate limits
CREATE POLICY "rate_limits_update" ON rate_limits
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limits.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role = 'owner'
        )
    );

-- DELETE: Only owners can delete rate limits
CREATE POLICY "rate_limits_delete" ON rate_limits
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limits.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role = 'owner'
        )
    );


-- ============================================================================
-- 3. FIX budget_alerts POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "budget_alerts_select" ON budget_alerts;
DROP POLICY IF EXISTS "budget_alerts_update" ON budget_alerts;

-- SELECT: Only owners and admins can view alerts
CREATE POLICY "budget_alerts_select" ON budget_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = budget_alerts.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );

-- UPDATE: Only owners and admins can acknowledge alerts
CREATE POLICY "budget_alerts_update" ON budget_alerts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = budget_alerts.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );


-- ============================================================================
-- 4. FIX rate_limit_counters POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "rate_limit_counters_select" ON rate_limit_counters;

-- SELECT: Only owners and admins can view counters
CREATE POLICY "rate_limit_counters_select" ON rate_limit_counters
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limit_counters.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );


-- ============================================================================
-- 5. FIX session_usage POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "session_usage_select" ON session_usage;
DROP POLICY IF EXISTS "session_usage_insert" ON session_usage;

-- SELECT: Only owners and admins can view session usage
CREATE POLICY "session_usage_select" ON session_usage
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = session_usage.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );

-- INSERT: Any company member can insert usage records
CREATE POLICY "session_usage_insert" ON session_usage
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = session_usage.company_id
            AND cm.user_id = (SELECT auth.uid())
        )
    );


-- ============================================================================
-- 6. FIX usage_events POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "usage_events_select" ON usage_events;
DROP POLICY IF EXISTS "usage_events_insert" ON usage_events;

-- SELECT: Only owners and admins can view usage events
CREATE POLICY "usage_events_select" ON usage_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = usage_events.company_id
            AND cm.user_id = (SELECT auth.uid())
            AND cm.role IN ('owner', 'admin')
        )
    );

-- INSERT: Any company member can insert usage events
CREATE POLICY "usage_events_insert" ON usage_events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = usage_events.company_id
            AND cm.user_id = (SELECT auth.uid())
        )
    );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying, verify with Supabase linter or this query:
--
-- SELECT tablename, policyname,
--        CASE WHEN qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%'
--             THEN 'NEEDS FIX'
--             ELSE 'OK'
--        END as status
-- FROM pg_policies
-- WHERE tablename IN (
--     'api_key_audit_log', 'rate_limits', 'budget_alerts',
--     'rate_limit_counters', 'session_usage', 'usage_events'
-- )
-- ORDER BY tablename, policyname;
