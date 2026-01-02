-- =============================================================================
-- Parse Failure Tracking
-- Track ranking parse failures for quality monitoring
-- =============================================================================

-- Create parse_failures table
CREATE TABLE IF NOT EXISTS public.parse_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    session_id UUID,  -- Optional link to session_usage if available
    model TEXT NOT NULL,
    reason TEXT NOT NULL,  -- no_final_ranking_section | no_valid_entries_after_header
    text_preview TEXT,  -- First 200 chars for debugging
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_parse_failures_company_date
    ON public.parse_failures(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parse_failures_model
    ON public.parse_failures(model, created_at DESC);

-- Enable RLS
ALTER TABLE public.parse_failures ENABLE ROW LEVEL SECURITY;

-- RLS policy: company owners can view their parse failures
CREATE POLICY parse_failures_select ON public.parse_failures
    FOR SELECT USING (
        company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    );

-- Only service role can insert (backend writes these)
CREATE POLICY parse_failures_insert ON public.parse_failures
    FOR INSERT WITH CHECK (true);  -- Service role bypasses RLS anyway

-- =============================================================================
-- Analytics function for parse failure rate
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_parse_failure_stats(
    p_company_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    total_failures BIGINT,
    by_model JSONB,
    by_reason JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_failures,
        COALESCE(
            jsonb_object_agg(
                pf.model,
                pf.model_count
            ) FILTER (WHERE pf.model IS NOT NULL),
            '{}'::jsonb
        ) as by_model,
        COALESCE(
            jsonb_object_agg(
                pf2.reason,
                pf2.reason_count
            ) FILTER (WHERE pf2.reason IS NOT NULL),
            '{}'::jsonb
        ) as by_reason
    FROM (
        SELECT model, COUNT(*) as model_count
        FROM public.parse_failures
        WHERE company_id = p_company_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY model
    ) pf
    CROSS JOIN (
        SELECT reason, COUNT(*) as reason_count
        FROM public.parse_failures
        WHERE company_id = p_company_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY reason
    ) pf2
    CROSS JOIN (
        SELECT COUNT(*) as total
        FROM public.parse_failures
        WHERE company_id = p_company_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    ) total_count;
END;
$$;

-- Grant execute to authenticated users (they can only see their own company's data via RLS)
GRANT EXECUTE ON FUNCTION public.get_parse_failure_stats TO authenticated;

COMMENT ON TABLE public.parse_failures IS 'Tracks ranking parse failures for quality monitoring';
COMMENT ON FUNCTION public.get_parse_failure_stats IS 'Get parse failure statistics for a company';
