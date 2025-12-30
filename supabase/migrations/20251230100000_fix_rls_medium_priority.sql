-- ============================================================================
-- MEDIUM PRIORITY RLS FIXES
-- ============================================================================
-- Fixes identified in the Data Architecture & RLS Security Audit:
--
-- 1. rate_limits: Add missing INSERT policy (only owners should create)
-- 2. budget_alerts: Add INSERT policy (service_role only for system alerts)
-- 3. rate_limit_counters: Add INSERT/UPDATE policies
-- ============================================================================

-- ============================================================================
-- 1. FIX rate_limits POLICIES
-- ============================================================================
-- Currently missing INSERT policy - only company owners should be able to
-- create rate limit configurations for their company.

-- Drop existing policies to recreate cleanly
DROP POLICY IF EXISTS "rate_limits_select" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_update" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_insert" ON rate_limits;
DROP POLICY IF EXISTS "rate_limits_delete" ON rate_limits;

-- Ensure RLS is enabled
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- SELECT: Only owners and admins can view rate limits
CREATE POLICY "rate_limits_select" ON rate_limits
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limits.company_id
            AND cm.user_id = auth.uid()
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
            AND cm.user_id = auth.uid()
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
            AND cm.user_id = auth.uid()
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
            AND cm.user_id = auth.uid()
            AND cm.role = 'owner'
        )
    );


-- ============================================================================
-- 2. FIX budget_alerts POLICIES
-- ============================================================================
-- Budget alerts are created by the system, not users directly.
-- Users should only be able to SELECT and UPDATE (acknowledge) alerts.

-- Drop existing policies
DROP POLICY IF EXISTS "budget_alerts_select" ON budget_alerts;
DROP POLICY IF EXISTS "budget_alerts_update" ON budget_alerts;
DROP POLICY IF EXISTS "budget_alerts_insert" ON budget_alerts;

-- Ensure RLS is enabled
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: Only owners and admins can view alerts
CREATE POLICY "budget_alerts_select" ON budget_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = budget_alerts.company_id
            AND cm.user_id = auth.uid()
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
            AND cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'admin')
        )
    );

-- INSERT: No direct user inserts - alerts created via service role or RPC
-- This policy allows the increment_rate_limit_counter function to create alerts
-- since it runs as SECURITY DEFINER
-- Note: If alerts need to be created from the backend, use service role


-- ============================================================================
-- 3. FIX rate_limit_counters POLICIES
-- ============================================================================
-- Counters are updated by the system via SECURITY DEFINER functions.
-- Users should only be able to SELECT for monitoring.

-- Drop existing policies
DROP POLICY IF EXISTS "rate_limit_counters_select" ON rate_limit_counters;
DROP POLICY IF EXISTS "rate_limit_counters_insert" ON rate_limit_counters;
DROP POLICY IF EXISTS "rate_limit_counters_update" ON rate_limit_counters;

-- Ensure RLS is enabled
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- SELECT: Only owners and admins can view counters
CREATE POLICY "rate_limit_counters_select" ON rate_limit_counters
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = rate_limit_counters.company_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('owner', 'admin')
        )
    );

-- INSERT/UPDATE: Done via SECURITY DEFINER function (increment_rate_limit_counter)
-- No direct user access needed


-- ============================================================================
-- 4. FIX session_usage INSERT POLICY
-- ============================================================================
-- The current INSERT policy allows any company member to insert.
-- This is correct for backend usage, but we should validate the company_id.

-- Drop and recreate with proper validation
DROP POLICY IF EXISTS "session_usage_insert" ON session_usage;

CREATE POLICY "session_usage_insert" ON session_usage
    FOR INSERT
    WITH CHECK (
        -- User must be a member of the company they're inserting for
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = session_usage.company_id
            AND cm.user_id = auth.uid()
        )
    );


-- ============================================================================
-- 5. FIX usage_events INSERT POLICY
-- ============================================================================
-- Similar to session_usage - validate company membership

DROP POLICY IF EXISTS "usage_events_insert" ON usage_events;

CREATE POLICY "usage_events_insert" ON usage_events
    FOR INSERT
    WITH CHECK (
        -- User must be a member of the company they're inserting for
        EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = usage_events.company_id
            AND cm.user_id = auth.uid()
        )
    );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run these queries to verify policies are correct:
--
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('rate_limits', 'budget_alerts', 'rate_limit_counters', 'session_usage', 'usage_events')
-- ORDER BY tablename, policyname;
