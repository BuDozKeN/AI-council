-- ============================================================================
-- Fix Function Search Paths Security Warning
-- ============================================================================
-- Addresses Supabase linter warning: "function_search_path_mutable"
-- When search_path is not explicitly set, an attacker could potentially
-- hijack function calls by creating malicious objects in a schema that
-- appears earlier in the search path.
--
-- Fix: Add SET search_path = '' to all SECURITY DEFINER functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. update_model_registry_updated_at (trigger function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_model_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 2. get_models_for_role (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
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
    FROM public.model_registry mr
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 3. get_primary_model (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_primary_model(p_role TEXT, p_company_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    v_model_id TEXT;
BEGIN
    SELECT mr.model_id INTO v_model_id
    FROM public.model_registry mr
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 4. update_user_preferences_updated_at (trigger function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 5. is_company_member (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_company_member(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = check_company_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 6. is_company_admin (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_company_admin(check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = check_company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 7. get_user_id_by_email (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email TEXT)
RETURNS UUID AS $$
DECLARE
    found_user_id UUID;
BEGIN
    SELECT id INTO found_user_id
    FROM auth.users
    WHERE email = user_email;

    RETURN found_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Re-apply grants (unchanged)
REVOKE EXECUTE ON FUNCTION get_user_id_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO service_role;

-- ----------------------------------------------------------------------------
-- 8. verify_company_access (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_company_access(
    p_user_id UUID,
    p_company_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user owns the company
    IF EXISTS (
        SELECT 1 FROM public.companies
        WHERE id = p_company_id AND user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check if user has department access
    IF EXISTS (
        SELECT 1 FROM public.user_department_access
        WHERE company_id = p_company_id AND user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Re-apply grants
GRANT EXECUTE ON FUNCTION verify_company_access(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. create_project_safe (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_project_safe(
    p_company_id UUID,
    p_user_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_context_md TEXT DEFAULT NULL,
    p_department_ids UUID[] DEFAULT '{}'::UUID[],
    p_source TEXT DEFAULT 'manual',
    p_source_conversation_id UUID DEFAULT NULL
) RETURNS public.projects AS $$
DECLARE
    v_project public.projects;
BEGIN
    -- Verify user has access to the company
    IF NOT public.verify_company_access(p_user_id, p_company_id) THEN
        RAISE EXCEPTION 'Access denied: user does not have access to company';
    END IF;

    -- Create the project
    INSERT INTO public.projects (
        company_id,
        user_id,
        name,
        description,
        context_md,
        department_ids,
        source,
        source_conversation_id,
        status
    ) VALUES (
        p_company_id,
        p_user_id,
        p_name,
        p_description,
        p_context_md,
        p_department_ids,
        p_source,
        p_source_conversation_id,
        'active'
    ) RETURNING * INTO v_project;

    RETURN v_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Re-apply grants
GRANT EXECUTE ON FUNCTION create_project_safe(UUID, UUID, TEXT, TEXT, TEXT, UUID[], TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. create_knowledge_entry_safe (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_knowledge_entry_safe(
    p_company_id UUID,
    p_user_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_category TEXT DEFAULT 'general',
    p_department_ids UUID[] DEFAULT '{}'::UUID[],
    p_project_id UUID DEFAULT NULL,
    p_auto_inject BOOLEAN DEFAULT FALSE,
    p_scope TEXT DEFAULT 'department',
    p_tags TEXT[] DEFAULT '{}'::TEXT[]
) RETURNS public.knowledge_entries AS $$
DECLARE
    v_entry public.knowledge_entries;
BEGIN
    -- Verify user has access to the company
    IF NOT public.verify_company_access(p_user_id, p_company_id) THEN
        RAISE EXCEPTION 'Access denied: user does not have access to company';
    END IF;

    -- Create the knowledge entry
    INSERT INTO public.knowledge_entries (
        company_id,
        created_by,
        title,
        content,
        category,
        department_ids,
        project_id,
        auto_inject,
        scope,
        tags,
        is_active,
        status
    ) VALUES (
        p_company_id,
        p_user_id,
        p_title,
        p_content,
        p_category,
        p_department_ids,
        p_project_id,
        p_auto_inject,
        p_scope,
        p_tags,
        TRUE,
        'active'
    ) RETURNING * INTO v_entry;

    RETURN v_entry;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Re-apply grants
GRANT EXECUTE ON FUNCTION create_knowledge_entry_safe(UUID, UUID, TEXT, TEXT, TEXT, UUID[], UUID, BOOLEAN, TEXT, TEXT[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. update_ai_personas_updated_at (trigger function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_ai_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ----------------------------------------------------------------------------
-- 12. get_persona (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
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
    FROM public.ai_personas ap
    WHERE ap.persona_key = p_key
      AND ap.is_active = true
      AND (
          (p_company_id IS NOT NULL AND ap.company_id = p_company_id)
          OR ap.company_id IS NULL
      )
    ORDER BY ap.company_id NULLS LAST  -- Prefer company-specific
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================================================
-- Note: auth_leaked_password_protection warning must be fixed in the
-- Supabase Dashboard under Authentication > Settings > Password Settings
-- ============================================================================
