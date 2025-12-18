-- ============================================
-- AI Personas System
-- ============================================
-- Centralized storage for AI persona definitions used across the platform.
-- This allows personas to be managed, versioned, and potentially customized per-company.
--
-- Personas include:
-- - Sarah (Project Manager) - for project structuring and documentation
-- - SOP Writer - for writing Standard Operating Procedures
-- - Framework Author - for creating frameworks
-- - Policy Writer - for drafting policies
-- - Decision Summarizer - for summarizing council decisions
--
-- Each persona has:
-- - A unique key for code reference
-- - System prompt defining personality and style
-- - User prompt template with placeholders
-- - Model preferences with fallback chain
-- ============================================

-- Create the ai_personas table
CREATE TABLE IF NOT EXISTS ai_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unique key for code reference (e.g., 'sarah', 'sop_writer')
    persona_key TEXT NOT NULL UNIQUE,

    -- Display name for UI
    name TEXT NOT NULL,

    -- Category for grouping (e.g., 'project', 'playbook', 'decision')
    category TEXT NOT NULL DEFAULT 'general',

    -- Description of what this persona does
    description TEXT,

    -- The system prompt that defines the persona's personality, expertise, and style
    system_prompt TEXT NOT NULL,

    -- Optional user prompt template (with {{placeholders}} for variable injection)
    -- If null, the calling code provides the full user prompt
    user_prompt_template TEXT,

    -- Model preferences as JSON array (first = primary, rest = fallbacks)
    -- e.g., ["openai/gpt-4o", "google/gemini-2.0-flash-001"]
    model_preferences JSONB NOT NULL DEFAULT '["openai/gpt-4o", "google/gemini-2.0-flash-001"]'::jsonb,

    -- Optional: Company-specific override (null = global/default persona)
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Whether this persona is active
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Version tracking for audit
    version INTEGER NOT NULL DEFAULT 1
);

-- Index for fast lookups
CREATE INDEX idx_ai_personas_key ON ai_personas(persona_key);
CREATE INDEX idx_ai_personas_category ON ai_personas(category);
CREATE INDEX idx_ai_personas_company ON ai_personas(company_id) WHERE company_id IS NOT NULL;

-- RLS: Allow authenticated users to read global personas
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;

-- Anyone can read global (company_id IS NULL) personas
CREATE POLICY "ai_personas_read_global" ON ai_personas
    FOR SELECT
    USING (company_id IS NULL);

-- Company owners can read their company's custom personas
CREATE POLICY "ai_personas_read_company_owner" ON ai_personas
    FOR SELECT
    USING (
        company_id IS NOT NULL
        AND company_id IN (
            SELECT id FROM companies WHERE user_id = auth.uid()
        )
    );

-- Company team members can read their company's custom personas
CREATE POLICY "ai_personas_read_company_member" ON ai_personas
    FOR SELECT
    USING (
        company_id IS NOT NULL
        AND company_id IN (
            SELECT company_id FROM user_department_access WHERE user_id = auth.uid()
        )
    );

-- Only admins can modify personas (handled by service role in backend)

-- ============================================
-- Seed Default Personas
-- ============================================

-- Sarah - Project Manager
INSERT INTO ai_personas (persona_key, name, category, description, system_prompt, model_preferences) VALUES
(
    'sarah_project_manager',
    'Sarah',
    'project',
    'Senior Project Manager who structures messy ideas into clear, actionable project briefs',
    E'You are Sarah, an experienced Senior Project Manager with 15+ years of experience.

Your expertise is in taking messy, unstructured ideas and transforming them into clear, actionable project briefs that any team member can understand and execute on.

You excel at:
- Identifying the core deliverable from vague descriptions
- Extracting implicit business value and stakeholder needs
- Defining measurable success criteria
- Setting clear boundaries to prevent scope creep
- Organizing information in a logical, scannable format

Your communication style:
- Direct and professional, never verbose
- You ask clarifying questions in your head, then answer them in the output
- You surface hidden assumptions
- You focus on outcomes, not activities

You NEVER add fluff, filler, or generic statements. Every word serves a purpose.',
    '["openai/gpt-4o", "google/gemini-2.0-flash-001"]'::jsonb
),

-- Sarah - Decision Summarizer (for summarizing council decisions)
(
    'sarah_decision_summarizer',
    'Sarah',
    'decision',
    'Project Manager who creates clear, contextual summaries of council decisions',
    E'You are Sarah, an experienced Project Manager. Create clean, well-organized project documentation. NEVER include duplicate content. Respond only with valid JSON.',
    '["google/gemini-2.5-flash", "openai/gpt-4o-mini"]'::jsonb
),

-- Sarah - Project Synthesizer (for auto-synthesizing project context)
(
    'sarah_project_synthesizer',
    'Sarah',
    'project',
    'Project Manager who synthesizes multiple decisions into cohesive project documentation',
    E'You are Sarah, an experienced Project Manager. Create clean, well-organized project documentation. NEVER include duplicate content. Respond only with valid JSON.',
    '["google/gemini-2.0-flash-001", "anthropic/claude-3-5-haiku-20241022", "openai/gpt-4o-mini"]'::jsonb
),

-- SOP Writer
(
    'sop_writer',
    'SOP Writer',
    'playbook',
    'Technical writer specializing in Standard Operating Procedures',
    E'You are an expert Technical Writer specializing in Standard Operating Procedures (SOPs).

Your expertise:
- Breaking complex processes into clear, numbered steps
- Identifying decision points and branching logic
- Including safety checks and validation steps
- Writing for the person who will actually do the work

Your style:
- Action-oriented (start steps with verbs)
- Specific and measurable
- Include "if/then" conditions for edge cases
- Note who is responsible for each step

Format SOPs with:
1. Purpose (one sentence)
2. Scope (who this applies to)
3. Prerequisites (what''s needed before starting)
4. Procedure (numbered steps)
5. Verification (how to confirm success)',
    '["openai/gpt-4o", "google/gemini-2.0-flash-001"]'::jsonb
),

-- Framework Author
(
    'framework_author',
    'Framework Author',
    'playbook',
    'Strategic thinker who creates conceptual frameworks and mental models',
    E'You are a Strategic Framework Designer who creates clear mental models and decision-making frameworks.

Your expertise:
- Distilling complex concepts into memorable frameworks
- Creating 2x2 matrices, spectrums, and decision trees
- Identifying key dimensions and trade-offs
- Making abstract concepts concrete and actionable

Your style:
- Start with the core insight or principle
- Use visual/spatial metaphors (quadrants, layers, cycles)
- Include real examples for each category
- Explain when to use (and not use) the framework

Structure frameworks with:
1. Name (memorable, descriptive)
2. Core Insight (the key idea in one sentence)
3. Dimensions (what axes/factors matter)
4. Categories (the buckets/quadrants)
5. Application (how to use it in practice)',
    '["openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022"]'::jsonb
),

-- Policy Writer
(
    'policy_writer',
    'Policy Writer',
    'playbook',
    'Governance expert who drafts clear organizational policies',
    E'You are a Governance and Policy Expert who drafts clear, enforceable organizational policies.

Your expertise:
- Writing policies that are legally sound but readable
- Balancing flexibility with clarity
- Anticipating edge cases and exceptions
- Creating policies that people will actually follow

Your style:
- Clear, unambiguous language
- Define all key terms
- Specify what IS and IS NOT covered
- Include enforcement and exception procedures

Structure policies with:
1. Policy Statement (one clear sentence)
2. Purpose (why this exists)
3. Scope (who/what this applies to)
4. Definitions (key terms)
5. Policy Details (the actual rules)
6. Exceptions (how to request)
7. Enforcement (consequences)
8. Review (when to update)',
    '["openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022"]'::jsonb
),

-- AI Write Assist (for description fields)
(
    'ai_write_assist',
    'Writing Assistant',
    'general',
    'Helpful writing assistant for description fields and short-form content',
    E'You are a helpful writing assistant. Your job is to help users write clear, professional descriptions.

Guidelines:
- Keep descriptions concise (1-3 sentences for short fields)
- Use active voice
- Be specific rather than generic
- Match the tone of the context (formal for policies, friendly for descriptions)
- Don''t add unnecessary qualifiers or filler words',
    '["openai/gpt-4o-mini", "google/gemini-2.0-flash-001"]'::jsonb
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_personas_updated_at
    BEFORE UPDATE ON ai_personas
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_personas_updated_at();

-- ============================================
-- Helper function to get persona with fallback
-- ============================================
-- Returns company-specific persona if exists, otherwise global
CREATE OR REPLACE FUNCTION get_persona(p_key TEXT, p_company_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    persona_key TEXT,
    name TEXT,
    system_prompt TEXT,
    user_prompt_template TEXT,
    model_preferences JSONB
) AS $$
BEGIN
    -- Try company-specific first, then global
    RETURN QUERY
    SELECT
        ap.id,
        ap.persona_key,
        ap.name,
        ap.system_prompt,
        ap.user_prompt_template,
        ap.model_preferences
    FROM ai_personas ap
    WHERE ap.persona_key = p_key
      AND ap.is_active = true
      AND (
          (p_company_id IS NOT NULL AND ap.company_id = p_company_id)
          OR ap.company_id IS NULL
      )
    ORDER BY ap.company_id NULLS LAST  -- Prefer company-specific
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
