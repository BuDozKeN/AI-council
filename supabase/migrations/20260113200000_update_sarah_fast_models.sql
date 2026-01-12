-- ============================================
-- Update Sarah Persona with Faster Models
-- ============================================
-- Issue: structure-context endpoint taking 6 seconds
-- Root cause: Using slower models (gemini-2.0-flash, gpt-4o) for simple text structuring
-- Solution: Use faster utility-tier models (gemini-2.5-flash, gpt-4o-mini, haiku)
--
-- Sarah is used for all project management tasks:
-- - Extract project from council response
-- - Structure free-form text into project brief
-- - Merge decisions into project context
-- - Regenerate project context
-- - Generate decision summaries
-- - Create projects from decisions
--
-- These are all simple text transformation tasks that don't need premium models.
-- ============================================

-- Update sarah persona to use faster models
UPDATE ai_personas
SET
    model_preferences = '["google/gemini-2.5-flash", "openai/gpt-4o-mini", "anthropic/claude-3-5-haiku-20241022"]'::jsonb,
    updated_at = now()
WHERE persona_key = 'sarah'
  AND company_id IS NULL;  -- Only update global persona, not company overrides

-- Also update ai_write_assist to use the same fast models for consistency
UPDATE ai_personas
SET
    model_preferences = '["google/gemini-2.5-flash", "openai/gpt-4o-mini", "anthropic/claude-3-5-haiku-20241022"]'::jsonb,
    updated_at = now()
WHERE persona_key = 'ai_write_assist'
  AND company_id IS NULL;

-- Log the change
DO $$
BEGIN
    RAISE NOTICE 'Updated sarah and ai_write_assist personas to use faster models: gemini-2.5-flash, gpt-4o-mini, haiku';
END $$;
