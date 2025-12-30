-- ============================================================================
-- RLS CROSS-TENANT ISOLATION TEST SUITE
-- ============================================================================
-- Run these tests to verify that RLS policies correctly isolate tenant data.
--
-- SETUP: You need two test users in different companies
-- 1. Run as User A (member of Company A)
-- 2. Verify they cannot see Company B's data
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Set the JWT of a test user using: SELECT set_config('request.jwt.claims', '...', true);
-- 3. Or test via the application by logging in as different users
-- ============================================================================

-- ============================================================================
-- DIAGNOSTIC: Check current user and their company memberships
-- ============================================================================
-- Run this first to understand which companies the current user can access

SELECT 'Current User ID' as check_type, auth.uid()::text as value
UNION ALL
SELECT 'Companies Owned', COUNT(*)::text FROM companies WHERE user_id = auth.uid()
UNION ALL
SELECT 'Company Memberships', COUNT(*)::text FROM company_members WHERE user_id = auth.uid();

-- Show companies the current user should have access to
SELECT
    c.id as company_id,
    c.name as company_name,
    CASE WHEN c.user_id = auth.uid() THEN 'owner' ELSE cm.role END as access_type
FROM companies c
LEFT JOIN company_members cm ON cm.company_id = c.id AND cm.user_id = auth.uid()
WHERE c.user_id = auth.uid() OR cm.user_id = auth.uid();


-- ============================================================================
-- TEST 1: knowledge_entries isolation
-- ============================================================================
-- User should ONLY see knowledge entries from companies they belong to

-- Count all knowledge entries (should only be from user's companies)
SELECT
    'knowledge_entries' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM knowledge_entries;

-- Verify no entries from other companies are visible
-- This should return 0 if RLS is working correctly
SELECT
    'FAIL: Can see other company data' as status,
    ke.id,
    ke.company_id,
    ke.title
FROM knowledge_entries ke
WHERE ke.company_id NOT IN (
    SELECT c.id FROM companies c WHERE c.user_id = auth.uid()
    UNION
    SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
)
LIMIT 5;


-- ============================================================================
-- TEST 2: org_document_departments isolation
-- ============================================================================
-- User should only see document-department links for their companies

SELECT
    'org_document_departments' as table_name,
    COUNT(*) as visible_count
FROM org_document_departments;

-- Verify no links from other companies are visible
SELECT
    'FAIL: Can see other company document links' as status,
    odd.id,
    odd.document_id
FROM org_document_departments odd
JOIN org_documents od ON od.id = odd.document_id
WHERE od.company_id NOT IN (
    SELECT c.id FROM companies c WHERE c.user_id = auth.uid()
    UNION
    SELECT cm.company_id FROM company_members cm WHERE cm.user_id = auth.uid()
)
LIMIT 5;


-- ============================================================================
-- TEST 3: activity_logs isolation
-- ============================================================================
-- User should only see activity logs if they are admin of the company

SELECT
    'activity_logs' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM activity_logs;

-- For non-admins, this should return 0
-- For admins, should only show their company's logs


-- ============================================================================
-- TEST 4: api_key_audit_log isolation
-- ============================================================================
-- User should only see their own API key audit entries

SELECT
    'api_key_audit_log' as table_name,
    COUNT(*) as visible_count
FROM api_key_audit_log;

-- Verify all visible entries belong to current user
SELECT
    'FAIL: Can see other user API key logs' as status,
    id,
    user_id
FROM api_key_audit_log
WHERE user_id != auth.uid()
LIMIT 5;


-- ============================================================================
-- TEST 5: INSERT isolation tests
-- ============================================================================
-- These tests verify that users cannot INSERT data into other companies
-- CAUTION: These will fail with permission errors if RLS is working correctly

-- Uncomment to test (replace UUIDs with real values from another company):
/*
-- Should FAIL: Insert knowledge entry into another company
INSERT INTO knowledge_entries (company_id, title, content, created_by)
VALUES ('OTHER_COMPANY_UUID', 'Test Entry', 'Should fail', auth.uid());

-- Should FAIL: Insert activity log into another company
INSERT INTO activity_logs (company_id, event_type, title)
VALUES ('OTHER_COMPANY_UUID', 'test', 'Should fail');

-- Should FAIL: Insert API key audit for another user
INSERT INTO api_key_audit_log (user_id, event_type)
VALUES ('OTHER_USER_UUID', 'test');
*/


-- ============================================================================
-- TEST 6: Verify helper functions work correctly
-- ============================================================================

-- Test is_company_member for own companies (should return true)
SELECT
    c.id as company_id,
    c.name,
    is_company_member(c.id) as is_member,
    is_company_admin(c.id) as is_admin
FROM companies c
WHERE c.user_id = auth.uid()
   OR c.id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid());

-- Test is_company_member for a random UUID (should return false)
SELECT
    'Random UUID membership test' as test,
    is_company_member('00000000-0000-0000-0000-000000000000'::uuid) as should_be_false;


-- ============================================================================
-- TEST 7: Projects isolation
-- ============================================================================
SELECT
    'projects' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM projects;


-- ============================================================================
-- TEST 8: Departments and Roles isolation
-- ============================================================================
SELECT
    'departments' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM departments;

SELECT
    'roles' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM roles;


-- ============================================================================
-- TEST 9: org_documents isolation
-- ============================================================================
SELECT
    'org_documents' as table_name,
    COUNT(*) as visible_count,
    COUNT(DISTINCT company_id) as companies_visible
FROM org_documents;


-- ============================================================================
-- SUMMARY: All tables that should be company-isolated
-- ============================================================================
SELECT 'SUMMARY: Tables with company isolation' as info;

SELECT
    'knowledge_entries' as table_name, COUNT(*) as count FROM knowledge_entries
UNION ALL SELECT 'org_documents', COUNT(*) FROM org_documents
UNION ALL SELECT 'org_document_departments', COUNT(*) FROM org_document_departments
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'company_members', COUNT(*) FROM company_members
UNION ALL SELECT 'usage_events', COUNT(*) FROM usage_events;


-- ============================================================================
-- CLEANUP VERIFICATION
-- ============================================================================
-- Verify no permissive policies remain

SELECT
    'Permissive auth.role() policies (should be empty except processed_webhook_events)' as check_type;

SELECT tablename, policyname, qual
FROM pg_policies
WHERE qual::text LIKE '%auth.role()%'
AND schemaname = 'public'
AND tablename NOT IN ('processed_webhook_events');

-- Check for USING(true) policies (should be empty)
SELECT
    'USING(true) policies (should be empty)' as check_type;

SELECT tablename, policyname
FROM pg_policies
WHERE qual::text = 'true'
AND schemaname = 'public';
