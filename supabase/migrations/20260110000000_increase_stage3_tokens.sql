-- =============================================
-- INCREASE STAGE 3 MAX TOKENS
-- =============================================
-- Stage 3 synthesis was limited to 2048 tokens, causing truncation
-- for complex multi-decision responses. Increasing to 4096 tokens.

-- Update conservative preset
UPDATE llm_presets
SET config = jsonb_set(
    config,
    '{stage3,max_tokens}',
    '8192'::jsonb
),
updated_at = NOW()
WHERE id = 'conservative';

-- Update balanced preset
UPDATE llm_presets
SET config = jsonb_set(
    config,
    '{stage3,max_tokens}',
    '8192'::jsonb
),
updated_at = NOW()
WHERE id = 'balanced';

-- Update creative preset
UPDATE llm_presets
SET config = jsonb_set(
    config,
    '{stage3,max_tokens}',
    '8192'::jsonb
),
updated_at = NOW()
WHERE id = 'creative';

-- Also update the hardcoded fallback in get_department_llm_config function
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

    -- Updated fallback with 4096 tokens for stage3
    RETURN COALESCE(v_preset_config, '{
        "stage1": { "temperature": 0.5, "max_tokens": 1536 },
        "stage2": { "temperature": 0.3, "max_tokens": 512 },
        "stage3": { "temperature": 0.4, "max_tokens": 4096 }
    }'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Verification query
-- SELECT id, config->'stage3'->'max_tokens' as stage3_tokens FROM llm_presets;
