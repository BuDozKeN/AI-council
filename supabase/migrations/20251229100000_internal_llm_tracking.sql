-- =============================================
-- INTERNAL LLM OPERATIONS TRACKING
-- =============================================
-- Extends session_usage to track internal LLM operations
-- (title generation, project extraction, summaries, etc.)
-- that were previously invisible to cost tracking.

-- =============================================
-- UPDATE SESSION_TYPE CONSTRAINT
-- =============================================
-- Remove old constraint and add new one that allows internal_* types

ALTER TABLE session_usage
DROP CONSTRAINT IF EXISTS session_usage_session_type_check;

ALTER TABLE session_usage
ADD CONSTRAINT session_usage_session_type_check
CHECK (
    session_type IN (
        -- Original session types
        'council',
        'chat',
        'triage',
        'document',
        -- Internal operations (tracked for cost visibility)
        'internal_title_generation',
        'internal_project_extraction',
        'internal_context_structuring',
        'internal_decision_merge',
        'internal_context_regeneration',
        'internal_auto_context_regeneration',
        'internal_decision_summary'
    )
);

-- Add comment explaining the internal types
COMMENT ON COLUMN session_usage.session_type IS
'Session type: council/chat/triage/document for user-facing sessions, internal_* for background LLM operations (title generation, project extraction, etc.)';

-- =============================================
-- INDEX FOR FILTERING BY SESSION TYPE
-- =============================================
-- Allows efficient queries to separate internal vs user-facing sessions

CREATE INDEX IF NOT EXISTS idx_session_usage_type_prefix
ON session_usage ((session_type LIKE 'internal_%'));

-- Partial index for internal operations only
CREATE INDEX IF NOT EXISTS idx_session_usage_internal_ops
ON session_usage (company_id, created_at DESC)
WHERE session_type LIKE 'internal_%';

-- Partial index for user-facing sessions only
CREATE INDEX IF NOT EXISTS idx_session_usage_user_sessions
ON session_usage (company_id, created_at DESC)
WHERE session_type NOT LIKE 'internal_%';

-- =============================================
-- UPDATE get_usage_analytics TO INCLUDE SESSION TYPE BREAKDOWN
-- =============================================
-- Returns aggregated usage data with breakdown by session type category

CREATE OR REPLACE FUNCTION get_usage_analytics(
    p_company_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE(
    date DATE,
    sessions INTEGER,
    tokens_input BIGINT,
    tokens_output BIGINT,
    tokens_total BIGINT,
    cache_read_tokens BIGINT,
    estimated_cost_cents BIGINT,
    top_models JSONB,
    council_sessions INTEGER,
    council_cost_cents BIGINT,
    internal_sessions INTEGER,
    internal_cost_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(su.created_at) as date,
        COUNT(*)::INTEGER as sessions,
        SUM(su.tokens_input)::BIGINT as tokens_input,
        SUM(su.tokens_output)::BIGINT as tokens_output,
        SUM(su.tokens_total)::BIGINT as tokens_total,
        SUM(su.cache_read_tokens)::BIGINT as cache_read_tokens,
        SUM(su.estimated_cost_cents)::BIGINT as estimated_cost_cents,
        jsonb_agg(DISTINCT su.model_breakdown) FILTER (WHERE su.model_breakdown != '{}') as top_models,
        -- Council sessions (user-facing)
        COUNT(*) FILTER (WHERE su.session_type NOT LIKE 'internal_%')::INTEGER as council_sessions,
        COALESCE(SUM(su.estimated_cost_cents) FILTER (WHERE su.session_type NOT LIKE 'internal_%'), 0)::BIGINT as council_cost_cents,
        -- Internal operations (background LLM calls)
        COUNT(*) FILTER (WHERE su.session_type LIKE 'internal_%')::INTEGER as internal_sessions,
        COALESCE(SUM(su.estimated_cost_cents) FILTER (WHERE su.session_type LIKE 'internal_%'), 0)::BIGINT as internal_cost_cents
    FROM session_usage su
    WHERE su.company_id = p_company_id
    AND su.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(su.created_at)
    ORDER BY DATE(su.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
