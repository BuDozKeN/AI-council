-- HOTFIX: Enable RLS on tables that are missing it
-- Run this IMMEDIATELY in Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ============================================
-- 1. Enable RLS on both tables
-- ============================================

ALTER TABLE public.user_department_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Verify RLS is enabled
-- ============================================

SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename IN ('user_department_access', 'knowledge_entries')
AND schemaname = 'public';

-- Both should show rowsecurity = true

-- ============================================
-- 3. Check existing policies (if migration 001 ran partially)
-- ============================================

SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('user_department_access', 'knowledge_entries');

-- If no policies exist, run the policy creation from 001_knowledge_entries.sql

-- ============================================
-- 4. Fix function search_path security warning
-- ============================================

CREATE OR REPLACE FUNCTION public.update_knowledge_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
