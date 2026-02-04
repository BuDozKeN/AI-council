-- ============================================================================
-- Fix SECURITY DEFINER search_path for post-20251224 functions
-- ============================================================================
-- Addresses audit M5: SECURITY DEFINER functions created after the original
-- search_path fix (20251224100000) are missing SET search_path = ''.
-- Without this, an attacker could hijack function calls via schema injection.
-- ============================================================================

-- 1. get_department_llm_config (from 20260103000000)
CREATE OR REPLACE FUNCTION public.get_department_llm_config(p_department_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_preset TEXT;
    v_custom_config JSONB;
    v_preset_config JSONB;
BEGIN
    SELECT llm_preset, llm_config INTO v_preset, v_custom_config
    FROM public.departments WHERE id = p_department_id;

    IF v_preset IS NULL THEN
        v_preset := 'balanced';
    END IF;

    IF v_preset = 'custom' AND v_custom_config IS NOT NULL AND v_custom_config != '{}'::jsonb THEN
        RETURN v_custom_config;
    END IF;

    SELECT config INTO v_preset_config FROM public.llm_presets WHERE id = v_preset AND is_active = true;

    IF v_preset_config IS NULL THEN
        SELECT config INTO v_preset_config FROM public.llm_presets WHERE id = 'balanced';
    END IF;

    RETURN COALESCE(v_preset_config, '{
        "stage1": { "temperature": 0.5, "max_tokens": 1536 },
        "stage2": { "temperature": 0.3, "max_tokens": 512 },
        "stage3": { "temperature": 0.4, "max_tokens": 2048 }
    }'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- 2. get_department_stage_config (from 20260103000000)
CREATE OR REPLACE FUNCTION public.get_department_stage_config(
    p_department_id UUID,
    p_stage TEXT DEFAULT 'stage1'
)
RETURNS JSONB AS $$
DECLARE
    v_full_config JSONB;
    v_stage_config JSONB;
BEGIN
    v_full_config := public.get_department_llm_config(p_department_id);
    v_stage_config := v_full_config->p_stage;

    RETURN COALESCE(v_stage_config, '{"temperature": 0.5, "max_tokens": 1536}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- 3. log_llm_config_change (from 20260103000000)
CREATE OR REPLACE FUNCTION public.log_llm_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.llm_preset IS DISTINCT FROM NEW.llm_preset
       OR OLD.llm_config IS DISTINCT FROM NEW.llm_config THEN
        INSERT INTO public.activity_logs (
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================================================
-- M6: Simplify user_trials INSERT RLS policy
-- ============================================================================
-- The existing policy uses complex current_setting() JSON parsing.
-- Simplify to just allow users to insert their own records (backend uses
-- service role which bypasses RLS anyway).

DROP POLICY IF EXISTS "Service role can insert trials" ON public.user_trials;
CREATE POLICY "Users can insert own trials"
    ON public.user_trials
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
