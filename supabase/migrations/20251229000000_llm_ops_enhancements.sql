-- =============================================
-- LLM OPERATIONS ENHANCEMENTS
-- =============================================
-- Extends usage tracking with detailed per-session data,
-- adds rate limiting support, and budget alerts

-- =============================================
-- TABLE 1: SESSION USAGE (Detailed per-session breakdown)
-- =============================================
-- Stores detailed token usage per council session for analytics
-- Links to usage_events for aggregate rollups

CREATE TABLE IF NOT EXISTS session_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

    -- Token totals
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    tokens_total INTEGER NOT NULL DEFAULT 0,

    -- Cache metrics (for cost optimization tracking)
    cache_creation_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,

    -- Cost estimate (in USD cents for precision)
    estimated_cost_cents INTEGER DEFAULT 0,

    -- Per-model breakdown (JSONB for flexibility)
    -- Format: { "model_id": { "input": n, "output": n, "total": n, "cost_cents": n } }
    model_breakdown JSONB DEFAULT '{}',

    -- Session metadata
    session_type TEXT DEFAULT 'council' CHECK (session_type IN ('council', 'chat', 'triage', 'document')),
    stage_count INTEGER DEFAULT 3,
    model_count INTEGER DEFAULT 5,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE 2: RATE LIMITS (Per-company configurable)
-- =============================================
-- Stores rate limit configuration per company
-- Allows different tiers (free, pro, enterprise) to have different limits

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Session limits
    sessions_per_hour INTEGER DEFAULT 20,
    sessions_per_day INTEGER DEFAULT 100,

    -- Token limits (monthly)
    tokens_per_month INTEGER DEFAULT 10000000, -- 10M tokens

    -- Cost limits (monthly, in USD cents)
    budget_cents_per_month INTEGER DEFAULT 10000, -- $100

    -- Alert thresholds (percentage of limit)
    alert_threshold_percent INTEGER DEFAULT 80,

    -- Tier for quick reference
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise', 'custom')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE 3: BUDGET ALERTS (Alert history)
-- =============================================
-- Tracks when alerts were sent to avoid spam

CREATE TABLE IF NOT EXISTS budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Alert type
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'sessions_hourly_warning',
        'sessions_daily_warning',
        'tokens_monthly_warning',
        'budget_monthly_warning',
        'sessions_hourly_limit',
        'sessions_daily_limit',
        'tokens_monthly_limit',
        'budget_monthly_limit'
    )),

    -- Current value when alert triggered
    current_value INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,

    -- Notification status
    notified_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),

    -- Period reference (for monthly alerts, first of month)
    period_start TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLE 4: RATE LIMIT COUNTERS (Rolling window)
-- =============================================
-- Tracks current usage for rate limiting
-- Updated in real-time, cleaned up periodically

CREATE TABLE IF NOT EXISTS rate_limit_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Time window
    window_type TEXT NOT NULL CHECK (window_type IN ('hourly', 'daily', 'monthly')),
    window_start TIMESTAMPTZ NOT NULL,

    -- Counters
    session_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint for upsert
    UNIQUE(company_id, window_type, window_start)
);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE session_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: SESSION USAGE
-- =============================================

-- Only owners and admins can view session usage
CREATE POLICY "session_usage_select" ON session_usage FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = session_usage.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Any company member can insert (via backend service)
CREATE POLICY "session_usage_insert" ON session_usage FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = session_usage.company_id
        AND cm.user_id = auth.uid()
    )
);

-- =============================================
-- RLS POLICIES: RATE LIMITS
-- =============================================

-- Only owners and admins can view rate limits
CREATE POLICY "rate_limits_select" ON rate_limits FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = rate_limits.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Only owners can update rate limits
CREATE POLICY "rate_limits_update" ON rate_limits FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = rate_limits.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
);

-- =============================================
-- RLS POLICIES: BUDGET ALERTS
-- =============================================

-- Only owners and admins can view alerts
CREATE POLICY "budget_alerts_select" ON budget_alerts FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = budget_alerts.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Only owners and admins can acknowledge alerts
CREATE POLICY "budget_alerts_update" ON budget_alerts FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = budget_alerts.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- =============================================
-- RLS POLICIES: RATE LIMIT COUNTERS
-- =============================================

-- Only owners and admins can view counters
CREATE POLICY "rate_limit_counters_select" ON rate_limit_counters FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = rate_limit_counters.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Session usage indexes
CREATE INDEX IF NOT EXISTS idx_session_usage_company_id ON session_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_session_usage_created_at ON session_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_session_usage_company_date ON session_usage(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_usage_conversation ON session_usage(conversation_id);

-- Rate limit counters indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_company ON rate_limit_counters(company_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_window ON rate_limit_counters(company_id, window_type, window_start);

-- Budget alerts indexes
CREATE INDEX IF NOT EXISTS idx_budget_alerts_company ON budget_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_unacked ON budget_alerts(company_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- =============================================
-- FUNCTION: INCREMENT RATE LIMIT COUNTER
-- =============================================
-- Atomically increments counters for rate limiting
-- Uses upsert to handle concurrent requests

CREATE OR REPLACE FUNCTION increment_rate_limit_counter(
    p_company_id UUID,
    p_sessions INTEGER DEFAULT 1,
    p_tokens INTEGER DEFAULT 0,
    p_cost_cents INTEGER DEFAULT 0
) RETURNS TABLE(
    hourly_sessions INTEGER,
    daily_sessions INTEGER,
    monthly_tokens INTEGER,
    monthly_cost_cents INTEGER
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_hour_start TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day_start TIMESTAMPTZ := date_trunc('day', v_now);
    v_month_start TIMESTAMPTZ := date_trunc('month', v_now);
    v_hourly INTEGER;
    v_daily INTEGER;
    v_monthly_tokens INTEGER;
    v_monthly_cost INTEGER;
BEGIN
    -- Upsert hourly counter
    INSERT INTO rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'hourly', v_hour_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = rate_limit_counters.session_count + p_sessions,
        token_count = rate_limit_counters.token_count + p_tokens,
        cost_cents = rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING session_count INTO v_hourly;

    -- Upsert daily counter
    INSERT INTO rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'daily', v_day_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = rate_limit_counters.session_count + p_sessions,
        token_count = rate_limit_counters.token_count + p_tokens,
        cost_cents = rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING session_count INTO v_daily;

    -- Upsert monthly counter
    INSERT INTO rate_limit_counters (company_id, window_type, window_start, session_count, token_count, cost_cents, updated_at)
    VALUES (p_company_id, 'monthly', v_month_start, p_sessions, p_tokens, p_cost_cents, v_now)
    ON CONFLICT (company_id, window_type, window_start)
    DO UPDATE SET
        session_count = rate_limit_counters.session_count + p_sessions,
        token_count = rate_limit_counters.token_count + p_tokens,
        cost_cents = rate_limit_counters.cost_cents + p_cost_cents,
        updated_at = v_now
    RETURNING token_count, cost_cents INTO v_monthly_tokens, v_monthly_cost;

    RETURN QUERY SELECT v_hourly, v_daily, v_monthly_tokens, v_monthly_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCTION: CHECK RATE LIMITS
-- =============================================
-- Checks if a company has exceeded any rate limits
-- Returns which limits are exceeded (if any)

CREATE OR REPLACE FUNCTION check_rate_limits(p_company_id UUID)
RETURNS TABLE(
    limit_type TEXT,
    current_value INTEGER,
    limit_value INTEGER,
    is_exceeded BOOLEAN,
    is_warning BOOLEAN
) AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_hour_start TIMESTAMPTZ := date_trunc('hour', v_now);
    v_day_start TIMESTAMPTZ := date_trunc('day', v_now);
    v_month_start TIMESTAMPTZ := date_trunc('month', v_now);
    v_limits rate_limits%ROWTYPE;
    v_hourly rate_limit_counters%ROWTYPE;
    v_daily rate_limit_counters%ROWTYPE;
    v_monthly rate_limit_counters%ROWTYPE;
BEGIN
    -- Get company rate limits (use defaults if not set)
    SELECT * INTO v_limits FROM rate_limits WHERE company_id = p_company_id;
    IF NOT FOUND THEN
        v_limits.sessions_per_hour := 20;
        v_limits.sessions_per_day := 100;
        v_limits.tokens_per_month := 10000000;
        v_limits.budget_cents_per_month := 10000;
        v_limits.alert_threshold_percent := 80;
    END IF;

    -- Get current counters
    SELECT * INTO v_hourly FROM rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'hourly' AND window_start = v_hour_start;

    SELECT * INTO v_daily FROM rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'daily' AND window_start = v_day_start;

    SELECT * INTO v_monthly FROM rate_limit_counters
    WHERE company_id = p_company_id AND window_type = 'monthly' AND window_start = v_month_start;

    -- Check hourly sessions
    RETURN QUERY SELECT
        'sessions_hourly'::TEXT,
        COALESCE(v_hourly.session_count, 0),
        v_limits.sessions_per_hour,
        COALESCE(v_hourly.session_count, 0) >= v_limits.sessions_per_hour,
        COALESCE(v_hourly.session_count, 0) >= (v_limits.sessions_per_hour * v_limits.alert_threshold_percent / 100);

    -- Check daily sessions
    RETURN QUERY SELECT
        'sessions_daily'::TEXT,
        COALESCE(v_daily.session_count, 0),
        v_limits.sessions_per_day,
        COALESCE(v_daily.session_count, 0) >= v_limits.sessions_per_day,
        COALESCE(v_daily.session_count, 0) >= (v_limits.sessions_per_day * v_limits.alert_threshold_percent / 100);

    -- Check monthly tokens
    RETURN QUERY SELECT
        'tokens_monthly'::TEXT,
        COALESCE(v_monthly.token_count, 0),
        v_limits.tokens_per_month,
        COALESCE(v_monthly.token_count, 0) >= v_limits.tokens_per_month,
        COALESCE(v_monthly.token_count, 0) >= (v_limits.tokens_per_month * v_limits.alert_threshold_percent / 100);

    -- Check monthly budget
    RETURN QUERY SELECT
        'budget_monthly'::TEXT,
        COALESCE(v_monthly.cost_cents, 0),
        v_limits.budget_cents_per_month,
        COALESCE(v_monthly.cost_cents, 0) >= v_limits.budget_cents_per_month,
        COALESCE(v_monthly.cost_cents, 0) >= (v_limits.budget_cents_per_month * v_limits.alert_threshold_percent / 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- FUNCTION: GET USAGE ANALYTICS
-- =============================================
-- Returns aggregated usage data for dashboard display

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
    top_models JSONB
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
        jsonb_agg(DISTINCT su.model_breakdown) FILTER (WHERE su.model_breakdown != '{}') as top_models
    FROM session_usage su
    WHERE su.company_id = p_company_id
    AND su.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(su.created_at)
    ORDER BY DATE(su.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- CLEANUP FUNCTION: REMOVE OLD COUNTERS
-- =============================================
-- Call periodically to clean up old rate limit counters

CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_counters()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_counters
    WHERE
        (window_type = 'hourly' AND window_start < NOW() - INTERVAL '24 hours')
        OR (window_type = 'daily' AND window_start < NOW() - INTERVAL '7 days')
        OR (window_type = 'monthly' AND window_start < NOW() - INTERVAL '3 months');

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INITIALIZE DEFAULT RATE LIMITS
-- =============================================
-- Create default rate limits for existing companies

INSERT INTO rate_limits (company_id, tier)
SELECT id, 'free'
FROM companies
WHERE NOT EXISTS (
    SELECT 1 FROM rate_limits WHERE rate_limits.company_id = companies.id
)
ON CONFLICT (company_id) DO NOTHING;
