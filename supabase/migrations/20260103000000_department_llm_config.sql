-- =============================================
-- DEPARTMENT LLM CONFIGURATION
-- =============================================
-- Adds LLM parameter configuration per department for council behavior tuning.
-- Enables Legal to be conservative while Marketing is creative.
--
-- Key concepts:
-- - llm_preset: Quick selection ('conservative', 'balanced', 'creative', 'custom')
-- - llm_config: Custom JSONB config when preset = 'custom'
-- - llm_presets table: Global system presets with default configs
--
-- Temperature guidelines:
-- - 0.1-0.3: Conservative (Legal, Compliance, HR)
-- - 0.4-0.6: Balanced (General, Technical, Executive)
-- - 0.7-0.9: Creative (Marketing, Content, Sales)

-- =============================================
-- 1. ADD COLUMNS TO DEPARTMENTS TABLE
-- =============================================

-- Add llm_preset column for quick selection
ALTER TABLE departments ADD COLUMN IF NOT EXISTS llm_preset TEXT DEFAULT 'balanced';

-- Add llm_config column for custom configuration
-- Structure: { "stage1": { "temperature": 0.7, "max_tokens": 1536 }, ... }
ALTER TABLE departments ADD COLUMN IF NOT EXISTS llm_config JSONB DEFAULT '{}'::jsonb;

-- =============================================
-- 2. CREATE LLM PRESETS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS llm_presets (
    id TEXT PRIMARY KEY,  -- 'conservative', 'balanced', 'creative'
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    -- Recommended department types for this preset
    recommended_for TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. SEED DEFAULT PRESETS
-- =============================================

INSERT INTO llm_presets (id, name, description, config, recommended_for) VALUES
(
    'conservative',
    'Conservative',
    'Low temperature for precise, deterministic outputs. Minimizes creativity for factual accuracy.',
    '{
        "stage1": { "temperature": 0.2, "max_tokens": 1024 },
        "stage2": { "temperature": 0.15, "max_tokens": 512 },
        "stage3": { "temperature": 0.25, "max_tokens": 2048 }
    }'::jsonb,
    ARRAY['legal', 'compliance', 'hr', 'finance']
),
(
    'balanced',
    'Balanced',
    'Moderate temperature for general business queries. Good balance of accuracy and flexibility.',
    '{
        "stage1": { "temperature": 0.5, "max_tokens": 1536 },
        "stage2": { "temperature": 0.3, "max_tokens": 512 },
        "stage3": { "temperature": 0.4, "max_tokens": 2048 }
    }'::jsonb,
    ARRAY['executive', 'technical', 'operations', 'standard']
),
(
    'creative',
    'Creative',
    'Higher temperature for varied, creative outputs. Best for content generation and brainstorming.',
    '{
        "stage1": { "temperature": 0.8, "max_tokens": 2048 },
        "stage2": { "temperature": 0.5, "max_tokens": 512 },
        "stage3": { "temperature": 0.7, "max_tokens": 2048 }
    }'::jsonb,
    ARRAY['marketing', 'content', 'sales', 'creative']
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    config = EXCLUDED.config,
    recommended_for = EXCLUDED.recommended_for,
    updated_at = NOW();

-- =============================================
-- 4. RLS FOR LLM PRESETS
-- =============================================

ALTER TABLE llm_presets ENABLE ROW LEVEL SECURITY;

-- Everyone can read active presets (they're system-level)
DROP POLICY IF EXISTS "llm_presets_read" ON llm_presets;
CREATE POLICY "llm_presets_read" ON llm_presets
    FOR SELECT USING (is_active = true);

-- Only service role can modify (no user modification)

-- =============================================
-- 5. FUNCTION: GET DEPARTMENT LLM CONFIG
-- =============================================
-- Returns the effective LLM config for a department
-- Priority: custom config > preset config > balanced default

CREATE OR REPLACE FUNCTION get_department_llm_config(p_department_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_preset TEXT;
    v_custom_config JSONB;
    v_preset_config JSONB;
BEGIN
    -- Get department's preset and custom config
    SELECT llm_preset, llm_config INTO v_preset, v_custom_config
    FROM departments WHERE id = p_department_id;

    -- Default to balanced if not set
    IF v_preset IS NULL THEN
        v_preset := 'balanced';
    END IF;

    -- If custom preset with valid config, use it
    IF v_preset = 'custom' AND v_custom_config IS NOT NULL AND v_custom_config != '{}'::jsonb THEN
        RETURN v_custom_config;
    END IF;

    -- Otherwise get from presets table
    SELECT config INTO v_preset_config FROM llm_presets WHERE id = v_preset AND is_active = true;

    -- Fall back to balanced if preset not found
    IF v_preset_config IS NULL THEN
        SELECT config INTO v_preset_config FROM llm_presets WHERE id = 'balanced';
    END IF;

    RETURN COALESCE(v_preset_config, '{
        "stage1": { "temperature": 0.5, "max_tokens": 1536 },
        "stage2": { "temperature": 0.3, "max_tokens": 512 },
        "stage3": { "temperature": 0.4, "max_tokens": 2048 }
    }'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- 6. FUNCTION: GET STAGE CONFIG
-- =============================================
-- Convenience function to get config for a specific stage

CREATE OR REPLACE FUNCTION get_department_stage_config(
    p_department_id UUID,
    p_stage TEXT DEFAULT 'stage1'
)
RETURNS JSONB AS $$
DECLARE
    v_full_config JSONB;
    v_stage_config JSONB;
BEGIN
    v_full_config := get_department_llm_config(p_department_id);
    v_stage_config := v_full_config->p_stage;

    -- Return stage config or defaults
    RETURN COALESCE(v_stage_config, '{"temperature": 0.5, "max_tokens": 1536}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- 7. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_departments_llm_preset ON departments(llm_preset);
CREATE INDEX IF NOT EXISTS idx_llm_presets_active ON llm_presets(is_active) WHERE is_active = true;

-- =============================================
-- 8. SET DEFAULT PRESETS FOR EXISTING DEPARTMENTS
-- =============================================
-- Map existing departments to appropriate presets based on name/slug

UPDATE departments SET llm_preset = 'conservative'
WHERE LOWER(name) IN ('legal', 'compliance', 'hr', 'human resources', 'finance', 'accounting')
   OR LOWER(slug) IN ('legal', 'compliance', 'hr', 'human-resources', 'finance', 'accounting');

UPDATE departments SET llm_preset = 'creative'
WHERE LOWER(name) IN ('marketing', 'content', 'sales', 'creative', 'design', 'communications')
   OR LOWER(slug) IN ('marketing', 'content', 'sales', 'creative', 'design', 'communications');

-- Everything else stays as 'balanced' (the default)

-- =============================================
-- 9. AUDIT TRIGGER FOR CONFIG CHANGES
-- =============================================
-- Log when department LLM config changes

CREATE OR REPLACE FUNCTION log_llm_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.llm_preset IS DISTINCT FROM NEW.llm_preset
       OR OLD.llm_config IS DISTINCT FROM NEW.llm_config THEN
        INSERT INTO activity_logs (
            company_id,
            department_id,
            event_type,
            title,
            description,
            related_id,
            related_type,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.id,
            'llm_config',
            'LLM Configuration Changed',
            format('Preset changed from %s to %s', COALESCE(OLD.llm_preset, 'none'), COALESCE(NEW.llm_preset, 'none')),
            NEW.id,
            'department',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_llm_config_change ON departments;
CREATE TRIGGER trigger_log_llm_config_change
    AFTER UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION log_llm_config_change();

-- =============================================
-- VERIFICATION QUERIES (run manually)
-- =============================================
-- SELECT * FROM llm_presets;
-- SELECT id, name, llm_preset FROM departments;
-- SELECT get_department_llm_config('your-dept-uuid-here');
-- SELECT get_department_stage_config('your-dept-uuid-here', 'stage1');
