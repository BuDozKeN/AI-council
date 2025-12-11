-- Migration: Expand Knowledge Base Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ywoodvmtbkinopixoyfc/sql
--
-- This migration adds support for Framework, SOP, and Role entries
-- and provides additional fields for long-form content.

-- ============================================
-- 1. Add new columns for Framework/SOP support
-- ============================================

-- body_md: For long-form markdown content (SOPs, step-by-step guides)
ALTER TABLE public.knowledge_entries
ADD COLUMN IF NOT EXISTS body_md TEXT;

-- version: Track versions of frameworks/SOPs (e.g., "v1", "v2.1")
ALTER TABLE public.knowledge_entries
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'v1';

-- updated_at: Track when entry was last modified
ALTER TABLE public.knowledge_entries
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. Expand category constraint to include new types
-- ============================================

-- First, drop the existing constraint (if it exists)
-- Note: This is safe because we're replacing it with a superset
ALTER TABLE public.knowledge_entries
DROP CONSTRAINT IF EXISTS knowledge_entries_category_check;

-- Add the expanded constraint with new categories
ALTER TABLE public.knowledge_entries
ADD CONSTRAINT knowledge_entries_category_check
CHECK (category IN (
    -- Existing categories
    'technical_decision',
    'ux_pattern',
    'feature',
    'policy',
    'process',
    -- New categories for Framework/SOP/Role support
    'role',        -- Role definitions (CTO, CMO, etc.)
    'framework',   -- Methodologies to follow
    'sop'          -- Step-by-step procedures
));

-- ============================================
-- 3. Add indexes for new query patterns
-- ============================================

-- Index for filtering by category (common operation on KB page)
CREATE INDEX IF NOT EXISTS idx_knowledge_company_category
ON public.knowledge_entries(company_id, category);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_knowledge_status
ON public.knowledge_entries(status);

-- Index for project-based queries
CREATE INDEX IF NOT EXISTS idx_knowledge_project
ON public.knowledge_entries(project_id);

-- ============================================
-- 4. Add updated_at trigger for automatic timestamp
-- ============================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS knowledge_updated_at_trigger ON public.knowledge_entries;

CREATE TRIGGER knowledge_updated_at_trigger
    BEFORE UPDATE ON public.knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_updated_at();

-- ============================================
-- Done! Verify with:
-- ============================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'knowledge_entries';
--
-- Expected new columns: body_md, version, updated_at
-- ============================================
