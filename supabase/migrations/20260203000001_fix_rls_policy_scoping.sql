-- Migration: Harden RLS policies on 6 tables
--
-- H1: parse_failures INSERT - scope to service_role only
-- H2: platform_audit_logs INSERT - scope to service_role only
-- H3: api_key_audit_log INSERT - remove anon/NULL uid loophole
-- H4: platform_admins, impersonation_sessions, platform_invitations
--     - replace open USING(true) with service_role-scoped policies

-- ============================================================
-- H1: parse_failures - restrict INSERT to service_role
-- Previously: WITH CHECK (true) allowed any authenticated user
-- to insert parse failure records for any company.
-- ============================================================

DROP POLICY IF EXISTS parse_failures_insert ON public.parse_failures;
CREATE POLICY parse_failures_insert ON public.parse_failures
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================================
-- H2: platform_audit_logs - restrict INSERT to service_role
-- Previously: WITH CHECK (true) allowed any authenticated user
-- to fabricate audit log entries.
-- ============================================================

DROP POLICY IF EXISTS "Service role can insert audit logs" ON platform_audit_logs;
CREATE POLICY "Service role can insert audit logs" ON platform_audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================================
-- H3: api_key_audit_log - remove NULL uid loophole
-- Previously: WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL)
-- allowed anon role to insert with arbitrary user_id.
-- Service role bypasses RLS anyway, so we only need the uid check.
-- ============================================================

DROP POLICY IF EXISTS "api_key_audit_log_insert" ON api_key_audit_log;
CREATE POLICY "api_key_audit_log_insert" ON api_key_audit_log
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================================
-- H4a: platform_admins - scope to service_role only
-- Previously: FOR ALL USING (true) allowed any authenticated
-- user to read admin user IDs and roles.
-- ============================================================

DROP POLICY IF EXISTS "Service role full access" ON public.platform_admins;
CREATE POLICY "Service role full access" ON public.platform_admins
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- H4b: impersonation_sessions - scope to service_role only
-- Previously: FOR ALL USING (true) allowed any authenticated
-- user to read impersonation session details.
-- ============================================================

DROP POLICY IF EXISTS "Service role full access" ON public.impersonation_sessions;
CREATE POLICY "Service role full access" ON public.impersonation_sessions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- H4c: platform_invitations - scope service_role policy
-- The admin policy is fine (checks platform_admins membership).
-- Only the open "Service role full access" needs scoping.
-- ============================================================

DROP POLICY IF EXISTS "Service role full access to invitations" ON platform_invitations;
CREATE POLICY "Service role full access to invitations" ON platform_invitations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
