-- ============================================
-- Model Registry
-- ============================================
-- Centralized configuration for all AI models used across the platform.
-- This replaces hardcoded model lists in config.py, council.py, etc.
--
-- Benefits:
-- - Single source of truth for model configuration
-- - Change models without code deployment
-- - Track model usage and preferences per role
-- - Support company-specific model overrides (future)
--
-- Roles:
-- - council_member: The 5 models that provide initial responses (Stage 1)
-- - chairman: The model that synthesizes final response (Stage 3)
-- - title_generator: Fast model for generating conversation titles
-- - triage: Model for intent classification
-- - sarah: Project structuring persona
-- - sop_writer, framework_author, policy_writer: Playbook personas
-- - ai_write_assist: General writing assistance
-- ============================================

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Role this model is assigned to (e.g., 'council_member', 'chairman', 'title_generator')
    role TEXT NOT NULL,

    -- OpenRouter model identifier (e.g., 'anthropic/claude-opus-4.5')
    model_id TEXT NOT NULL,

    -- Display name for UI (optional)
    display_name TEXT,

    -- Priority order within role (lower = higher priority, 0 = primary)
    -- For fallback chains: 0 = primary, 1 = fallback1, 2 = fallback2, etc.
    priority INTEGER NOT NULL DEFAULT 0,

    -- Whether this model is currently active
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Optional: Company-specific override (null = global/default)
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Description/notes about this model assignment
    notes TEXT,

    -- Unique constraint: one model per role+priority (per company or global)
    UNIQUE (role, priority, company_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_model_registry_role ON model_registry(role) WHERE is_active = true;
CREATE INDEX idx_model_registry_company ON model_registry(company_id) WHERE company_id IS NOT NULL;

-- RLS: Allow authenticated users to read global models
ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;

-- Anyone can read global (company_id IS NULL) models
CREATE POLICY "model_registry_read_global" ON model_registry
    FOR SELECT
    USING (company_id IS NULL);

-- Company owners can read their company's custom models
CREATE POLICY "model_registry_read_company_owner" ON model_registry
    FOR SELECT
    USING (
        company_id IS NOT NULL
        AND company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Company team members can read their company's custom models
CREATE POLICY "model_registry_read_company_member" ON model_registry
    FOR SELECT
    USING (
        company_id IS NOT NULL
        AND company_id IN (
            SELECT company_id FROM user_department_access WHERE user_id = auth.uid()
        )
    );

-- Only admins can modify (handled by service role in backend)

-- ============================================
-- Seed Default Models
-- ============================================

-- Council Members (Stage 1 - 5 parallel responses)
-- These are the models that provide initial independent perspectives
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('council_member', 'google/gemini-3-pro-preview', 'Gemini 3 Pro', 0, 'Primary - placed first for streaming stability'),
('council_member', 'openai/gpt-5.1', 'GPT-5.1', 1, NULL),
('council_member', 'anthropic/claude-opus-4.5', 'Claude Opus 4.5', 2, NULL),
('council_member', 'x-ai/grok-4', 'Grok 4', 3, NULL),
('council_member', 'deepseek/deepseek-chat-v3-0324', 'DeepSeek V3', 4, NULL);

-- Chairman (Stage 3 - synthesizes final response)
-- Primary model with fallbacks in case of failure
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('chairman', 'openai/gpt-5.1', 'GPT-5.1', 0, 'Primary chairman - best synthesis'),
('chairman', 'google/gemini-3-pro-preview', 'Gemini 3 Pro', 1, 'Fallback 1'),
('chairman', 'anthropic/claude-opus-4.5', 'Claude Opus 4.5', 2, 'Fallback 2');

-- Title Generator (fast, cheap model for generating conversation titles)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('title_generator', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 0, 'Fast and cheap for title generation');

-- Triage (intent classification)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('triage', 'google/gemini-2.5-flash', 'Gemini 2.5 Flash', 0, 'Fast classification');

-- Sarah (Project Manager persona)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('sarah', 'google/gemini-2.0-flash-001', 'Gemini 2.0 Flash', 0, 'Primary for project structuring'),
('sarah', 'openai/gpt-4o', 'GPT-4o', 1, 'Fallback'),
('sarah', 'anthropic/claude-3-5-haiku-20241022', 'Claude Haiku', 2, 'Fallback 2');

-- Decision Summarizer (used for summarizing council decisions)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('decision_summarizer', 'anthropic/claude-3-5-haiku-20241022', 'Claude Haiku', 0, 'Fast structured extraction');

-- SOP Writer
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('sop_writer', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary'),
('sop_writer', 'anthropic/claude-3-5-sonnet-20241022', 'Claude Sonnet', 1, 'Fallback'),
('sop_writer', 'google/gemini-2.0-flash-001', 'Gemini Flash', 2, 'Fallback 2');

-- Framework Author
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('framework_author', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary'),
('framework_author', 'anthropic/claude-3-5-sonnet-20241022', 'Claude Sonnet', 1, 'Fallback'),
('framework_author', 'google/gemini-2.0-flash-001', 'Gemini Flash', 2, 'Fallback 2');

-- Policy Writer
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('policy_writer', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary'),
('policy_writer', 'anthropic/claude-3-5-sonnet-20241022', 'Claude Sonnet', 1, 'Fallback'),
('policy_writer', 'google/gemini-2.0-flash-001', 'Gemini Flash', 2, 'Fallback 2');

-- AI Write Assist (general writing assistance for description fields)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('ai_write_assist', 'openai/gpt-4o-mini', 'GPT-4o Mini', 0, 'Fast and cheap'),
('ai_write_assist', 'google/gemini-2.0-flash-001', 'Gemini Flash', 1, 'Fallback');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_model_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_registry_updated_at
    BEFORE UPDATE ON model_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_model_registry_updated_at();

-- ============================================
-- Helper function to get models for a role
-- ============================================
-- Returns models ordered by priority (0 = primary, then fallbacks)
-- Prefers company-specific models if available, falls back to global
CREATE OR REPLACE FUNCTION get_models_for_role(p_role TEXT, p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
    model_id TEXT,
    display_name TEXT,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mr.model_id,
        mr.display_name,
        mr.priority
    FROM model_registry mr
    WHERE mr.role = p_role
      AND mr.is_active = true
      AND (
          -- If company_id provided, prefer company-specific, else global
          (p_company_id IS NOT NULL AND mr.company_id = p_company_id)
          OR mr.company_id IS NULL
      )
    ORDER BY
        mr.company_id NULLS LAST,  -- Prefer company-specific
        mr.priority ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper function to get primary model for a role
-- ============================================
CREATE OR REPLACE FUNCTION get_primary_model(p_role TEXT, p_company_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_model_id TEXT;
BEGIN
    SELECT mr.model_id INTO v_model_id
    FROM model_registry mr
    WHERE mr.role = p_role
      AND mr.is_active = true
      AND mr.priority = 0
      AND (
          (p_company_id IS NOT NULL AND mr.company_id = p_company_id)
          OR mr.company_id IS NULL
      )
    ORDER BY mr.company_id NULLS LAST
    LIMIT 1;

    RETURN v_model_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
