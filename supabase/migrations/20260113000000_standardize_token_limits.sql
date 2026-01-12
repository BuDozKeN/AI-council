-- =============================================
-- STANDARDIZE TOKEN LIMITS ACROSS PRESETS
-- =============================================
-- Updates all preset configs to use standardized token limits.
-- Only temperature differs between presets; max_tokens is now uniform:
-- - Stage 1: 8192 tokens (4+ pages)
-- - Stage 2: 2048 tokens (1-2 pages)
-- - Stage 3: 8192 tokens (4+ pages)
--
-- This prevents Stage 3 synthesis truncation issues.

-- Update conservative preset
UPDATE llm_presets 
SET config = '{
    "stage1": { "temperature": 0.2, "max_tokens": 8192 },
    "stage2": { "temperature": 0.15, "max_tokens": 2048 },
    "stage3": { "temperature": 0.25, "max_tokens": 8192 }
}'::jsonb,
updated_at = NOW()
WHERE id = 'conservative';

-- Update balanced preset
UPDATE llm_presets 
SET config = '{
    "stage1": { "temperature": 0.5, "max_tokens": 8192 },
    "stage2": { "temperature": 0.3, "max_tokens": 2048 },
    "stage3": { "temperature": 0.4, "max_tokens": 8192 }
}'::jsonb,
updated_at = NOW()
WHERE id = 'balanced';

-- Update creative preset
UPDATE llm_presets 
SET config = '{
    "stage1": { "temperature": 0.8, "max_tokens": 8192 },
    "stage2": { "temperature": 0.5, "max_tokens": 2048 },
    "stage3": { "temperature": 0.7, "max_tokens": 8192 }
}'::jsonb,
updated_at = NOW()
WHERE id = 'creative';

-- Also update the fallback in get_department_llm_config function
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

    -- Fall back to balanced if preset not found (with NEW standardized values)
    IF v_preset_config IS NULL THEN
        SELECT config INTO v_preset_config FROM llm_presets WHERE id = 'balanced';
    END IF;

    RETURN COALESCE(v_preset_config, '{
        "stage1": { "temperature": 0.5, "max_tokens": 8192 },
        "stage2": { "temperature": 0.3, "max_tokens": 2048 },
        "stage3": { "temperature": 0.4, "max_tokens": 8192 }
    }'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update get_department_stage_config fallback too
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

    -- Return stage config or defaults (with NEW standardized values)
    RETURN COALESCE(v_stage_config, '{"temperature": 0.5, "max_tokens": 8192}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
