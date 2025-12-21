-- ============================================================================
-- Security Definer Functions
-- ============================================================================
-- These functions run with elevated privileges but verify access internally.
-- This is more secure than exposing service role key to application code.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: verify_company_access
-- Checks if a user has access to a company (owner or team member)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_company_access(
    p_user_id UUID,
    p_company_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user owns the company
    IF EXISTS (
        SELECT 1 FROM companies
        WHERE id = p_company_id AND user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Check if user has department access
    IF EXISTS (
        SELECT 1 FROM user_department_access
        WHERE company_id = p_company_id AND user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION verify_company_access(UUID, UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- Function: create_project_safe
-- Creates a project with built-in access verification
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
) RETURNS projects AS $$
DECLARE
    v_project projects;
BEGIN
    -- Verify user has access to the company
    IF NOT verify_company_access(p_user_id, p_company_id) THEN
        RAISE EXCEPTION 'Access denied: user does not have access to company';
    END IF;

    -- Create the project
    INSERT INTO projects (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_project_safe(UUID, UUID, TEXT, TEXT, TEXT, UUID[], TEXT, UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- Function: create_knowledge_entry_safe
-- Creates a knowledge entry with built-in access verification
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
) RETURNS knowledge_entries AS $$
DECLARE
    v_entry knowledge_entries;
BEGIN
    -- Verify user has access to the company
    IF NOT verify_company_access(p_user_id, p_company_id) THEN
        RAISE EXCEPTION 'Access denied: user does not have access to company';
    END IF;

    -- Create the knowledge entry
    INSERT INTO knowledge_entries (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_knowledge_entry_safe(UUID, UUID, TEXT, TEXT, TEXT, UUID[], UUID, BOOLEAN, TEXT, TEXT[]) TO authenticated;


-- ----------------------------------------------------------------------------
-- Index for faster access verification
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_dept_access_lookup
ON user_department_access(user_id, company_id);

COMMENT ON FUNCTION verify_company_access IS 'Securely verify if a user has access to a company';
COMMENT ON FUNCTION create_project_safe IS 'Create a project with built-in access verification';
COMMENT ON FUNCTION create_knowledge_entry_safe IS 'Create a knowledge entry with built-in access verification';
