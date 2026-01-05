-- ============================================
-- Model Registry Consolidation
-- ============================================
-- Consolidates document writing and utility roles into fewer, simpler configurations.
-- The LLM model is just the engine; the PERSONA/PROMPT defines the expertise.
--
-- Before: 13+ roles with separate model configs
-- After: 6 roles
--   - council_member (keep - parallel queries)
--   - stage2_reviewer (keep - parallel queries)
--   - chairman (keep - synthesis)
--   - document_writer (NEW - consolidates sop_writer, framework_author, policy_writer, decision_summarizer)
--   - utility (NEW - consolidates title_generator, triage, sarah, ai_write_assist, ai_polish)
--   - vision_analyzer (keep - requires vision capability)
--
-- Old role names are aliased in the backend code for backward compatibility.
-- ============================================

-- First, add the new consolidated roles

-- DOCUMENT_WRITER: One config for all document types
-- SOPs, Frameworks, Policies, Summaries all use this
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('document_writer', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary - excellent structured writing'),
('document_writer', 'anthropic/claude-3-5-sonnet-20241022', 'Claude Sonnet 3.5', 1, 'Fallback 1'),
('document_writer', 'google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 2, 'Fallback 2')
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- UTILITY: One config for helper tasks
-- Titles, routing, writing assistance, polish all use this
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('utility', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 0, 'Primary - fast and economical'),
('utility', 'openai/gpt-4o-mini', 'GPT-4o Mini', 1, 'Fallback 1'),
('utility', 'anthropic/claude-3-5-haiku-20241022', 'Claude Haiku 3.5', 2, 'Fallback 2')
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- VISION_ANALYZER: Keep separate (requires vision capability)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('vision_analyzer', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary - best vision capability'),
('vision_analyzer', 'anthropic/claude-3-5-sonnet-20241022', 'Claude Sonnet 3.5', 1, 'Fallback - also has vision')
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- STAGE2_REVIEWER: Add if missing (was added in a later migration)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('stage2_reviewer', 'anthropic/claude-sonnet-4', 'Claude Sonnet 4', 0, 'Quality anchor'),
('stage2_reviewer', 'openai/gpt-4o-mini', 'GPT-4o Mini', 1, 'Fast & cheap'),
('stage2_reviewer', 'x-ai/grok-4-fast', 'Grok 4 Fast', 2, 'Fast variant'),
('stage2_reviewer', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 3, 'Economical'),
('stage2_reviewer', 'moonshotai/kimi-k2', 'Kimi K2', 4, 'Chinese AI'),
('stage2_reviewer', 'deepseek/deepseek-chat-v3-0324', 'DeepSeek V3', 5, 'DeepSeek')
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- Now soft-delete the old individual roles
-- We keep them in the database but mark as inactive for audit trail
-- The backend will use role aliases to redirect to consolidated roles

UPDATE model_registry SET is_active = false, notes = 'DEPRECATED: Use document_writer instead'
WHERE role IN ('sop_writer', 'framework_author', 'policy_writer', 'decision_summarizer')
AND company_id IS NULL;

UPDATE model_registry SET is_active = false, notes = 'DEPRECATED: Use utility instead'
WHERE role IN ('title_generator', 'triage', 'sarah', 'ai_write_assist', 'ai_polish')
AND company_id IS NULL;

-- Add a comment to document the consolidation
COMMENT ON TABLE model_registry IS 'Model Registry - Consolidated roles as of 2026-01-04.
Core roles: council_member, stage2_reviewer, chairman
Content role: document_writer (replaces sop_writer, framework_author, policy_writer, decision_summarizer)
Utility role: utility (replaces title_generator, triage, sarah, ai_write_assist, ai_polish)
Special role: vision_analyzer (requires vision capability)
Old role names are aliased in backend/model_registry.py for backward compatibility.';
