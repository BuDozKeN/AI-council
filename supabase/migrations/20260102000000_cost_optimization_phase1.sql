-- ============================================
-- Phase 1: Utility Model Cost Optimization
-- ============================================
-- Date: 2026-01-02
-- Purpose: Reduce utility model costs by ~94-95%
--
-- Changes:
-- - ai_polish: Gemini 3 Pro -> Gemini 2.5 Flash (95% cheaper)
-- - sop_writer: GPT-4o -> GPT-4o-mini (94% cheaper)
-- - framework_author: GPT-4o -> GPT-4o-mini (94% cheaper)
-- - policy_writer: GPT-4o -> GPT-4o-mini (94% cheaper)
--
-- Rollback: See bottom of file for rollback SQL
-- ============================================

-- Update ai_polish to Gemini 2.5 Flash
UPDATE model_registry
SET model_id = 'google/gemini-2.5-flash',
    display_name = 'Gemini 2.5 Flash',
    notes = 'Cost-optimized 2026-01-02: was Gemini 3 Pro ($2/$12 -> $0.15/$0.60)',
    updated_at = now()
WHERE role = 'ai_polish' AND priority = 0 AND company_id IS NULL;

-- Update ai_polish fallback
UPDATE model_registry
SET model_id = 'openai/gpt-4o-mini',
    display_name = 'GPT-4o Mini',
    notes = 'Cost-optimized fallback',
    updated_at = now()
WHERE role = 'ai_polish' AND priority = 1 AND company_id IS NULL;

-- Update sop_writer to GPT-4o-mini
UPDATE model_registry
SET model_id = 'openai/gpt-4o-mini',
    display_name = 'GPT-4o Mini',
    notes = 'Cost-optimized 2026-01-02: was GPT-4o ($2.50/$10 -> $0.15/$0.60)',
    updated_at = now()
WHERE role = 'sop_writer' AND priority = 0 AND company_id IS NULL;

-- Update framework_author to GPT-4o-mini
UPDATE model_registry
SET model_id = 'openai/gpt-4o-mini',
    display_name = 'GPT-4o Mini',
    notes = 'Cost-optimized 2026-01-02: was GPT-4o ($2.50/$10 -> $0.15/$0.60)',
    updated_at = now()
WHERE role = 'framework_author' AND priority = 0 AND company_id IS NULL;

-- Update policy_writer to GPT-4o-mini
UPDATE model_registry
SET model_id = 'openai/gpt-4o-mini',
    display_name = 'GPT-4o Mini',
    notes = 'Cost-optimized 2026-01-02: was GPT-4o ($2.50/$10 -> $0.15/$0.60)',
    updated_at = now()
WHERE role = 'policy_writer' AND priority = 0 AND company_id IS NULL;


-- ============================================
-- ROLLBACK SQL (if needed)
-- ============================================
-- Run these to revert to original models:
--
-- UPDATE model_registry SET model_id = 'google/gemini-3-pro-preview', display_name = 'Gemini 3 Pro', notes = NULL WHERE role = 'ai_polish' AND priority = 0 AND company_id IS NULL;
-- UPDATE model_registry SET model_id = 'openai/gpt-4o', display_name = 'GPT-4o', notes = NULL WHERE role = 'ai_polish' AND priority = 1 AND company_id IS NULL;
-- UPDATE model_registry SET model_id = 'openai/gpt-4o', display_name = 'GPT-4o', notes = NULL WHERE role = 'sop_writer' AND priority = 0 AND company_id IS NULL;
-- UPDATE model_registry SET model_id = 'openai/gpt-4o', display_name = 'GPT-4o', notes = NULL WHERE role = 'framework_author' AND priority = 0 AND company_id IS NULL;
-- UPDATE model_registry SET model_id = 'openai/gpt-4o', display_name = 'GPT-4o', notes = NULL WHERE role = 'policy_writer' AND priority = 0 AND company_id IS NULL;
