-- Migration: Atomic billing operations and usage caps
-- Fixes: Race condition in query counting, adds enterprise usage caps
-- Date: 2025-12-21

-- =============================================================================
-- 1. ATOMIC INCREMENT FUNCTION
-- =============================================================================
-- Prevents race conditions where concurrent requests could both read the same
-- count and write the same incremented value, giving users free queries.

CREATE OR REPLACE FUNCTION increment_query_usage(p_user_id UUID)
RETURNS TABLE(new_count INTEGER, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INTEGER;
    v_was_created BOOLEAN := FALSE;
BEGIN
    -- Try to atomically increment existing row
    UPDATE user_profiles
    SET
        queries_used_this_period = COALESCE(queries_used_this_period, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING queries_used_this_period INTO v_new_count;

    -- If no row was updated, create one
    IF NOT FOUND THEN
        INSERT INTO user_profiles (user_id, queries_used_this_period, updated_at)
        VALUES (p_user_id, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
            queries_used_this_period = COALESCE(user_profiles.queries_used_this_period, 0) + 1,
            updated_at = NOW()
        RETURNING queries_used_this_period INTO v_new_count;
        v_was_created := TRUE;
    END IF;

    RETURN QUERY SELECT v_new_count, v_was_created;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION increment_query_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_query_usage(UUID) TO service_role;

-- =============================================================================
-- 2. ADD DAILY USAGE TRACKING FOR ENTERPRISE COST CONTROL
-- =============================================================================
-- Even "unlimited" enterprise users need a safety cap to prevent abuse/runaway costs

-- Add columns if they don't exist
DO $$
BEGIN
    -- Daily usage counter (resets daily)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'queries_used_today'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN queries_used_today INTEGER DEFAULT 0;
    END IF;

    -- Last daily reset timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'daily_reset_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN daily_reset_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Total tokens used (for cost tracking)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'total_tokens_used'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN total_tokens_used BIGINT DEFAULT 0;
    END IF;

    -- Tokens used this billing period
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'tokens_used_this_period'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN tokens_used_this_period BIGINT DEFAULT 0;
    END IF;
END $$;

-- =============================================================================
-- 3. ATOMIC INCREMENT WITH DAILY CAP CHECK
-- =============================================================================
-- Returns whether the user can query and increments if allowed

CREATE OR REPLACE FUNCTION check_and_increment_usage(
    p_user_id UUID,
    p_daily_limit INTEGER DEFAULT 500,  -- Default daily cap for enterprise
    p_monthly_limit INTEGER DEFAULT -1   -- -1 = unlimited (from subscription)
)
RETURNS TABLE(
    allowed BOOLEAN,
    reason TEXT,
    queries_today INTEGER,
    queries_this_period INTEGER,
    daily_remaining INTEGER,
    monthly_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_allowed BOOLEAN := TRUE;
    v_reason TEXT := NULL;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Get or create profile with row lock
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create new profile
        INSERT INTO user_profiles (
            user_id,
            queries_used_this_period,
            queries_used_today,
            daily_reset_at,
            updated_at
        )
        VALUES (p_user_id, 0, 0, NOW(), NOW())
        RETURNING * INTO v_profile;
    END IF;

    -- Reset daily counter if it's a new day
    IF v_profile.daily_reset_at::DATE < v_today THEN
        UPDATE user_profiles
        SET queries_used_today = 0, daily_reset_at = NOW()
        WHERE user_id = p_user_id;
        v_profile.queries_used_today := 0;
    END IF;

    -- Check daily limit (applies to all tiers as a safety)
    IF p_daily_limit > 0 AND v_profile.queries_used_today >= p_daily_limit THEN
        v_allowed := FALSE;
        v_reason := 'Daily query limit reached (' || p_daily_limit || '). Resets at midnight UTC.';
    -- Check monthly limit (if not unlimited)
    ELSIF p_monthly_limit > 0 AND v_profile.queries_used_this_period >= p_monthly_limit THEN
        v_allowed := FALSE;
        v_reason := 'Monthly query limit reached (' || p_monthly_limit || '). Upgrade to continue.';
    END IF;

    -- If allowed, increment counters atomically
    IF v_allowed THEN
        UPDATE user_profiles
        SET
            queries_used_this_period = COALESCE(queries_used_this_period, 0) + 1,
            queries_used_today = COALESCE(queries_used_today, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING queries_used_today, queries_used_this_period
        INTO v_profile.queries_used_today, v_profile.queries_used_this_period;
    END IF;

    RETURN QUERY SELECT
        v_allowed,
        v_reason,
        COALESCE(v_profile.queries_used_today, 0)::INTEGER,
        COALESCE(v_profile.queries_used_this_period, 0)::INTEGER,
        CASE WHEN p_daily_limit > 0
             THEN GREATEST(0, p_daily_limit - COALESCE(v_profile.queries_used_today, 0))
             ELSE -1 END::INTEGER,
        CASE WHEN p_monthly_limit > 0
             THEN GREATEST(0, p_monthly_limit - COALESCE(v_profile.queries_used_this_period, 0))
             ELSE -1 END::INTEGER;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_usage(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_increment_usage(UUID, INTEGER, INTEGER) TO service_role;

-- =============================================================================
-- 4. TOKEN USAGE TRACKING FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION record_token_usage(
    p_user_id UUID,
    p_tokens_input INTEGER,
    p_tokens_output INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_profiles
    SET
        total_tokens_used = COALESCE(total_tokens_used, 0) + p_tokens_input + p_tokens_output,
        tokens_used_this_period = COALESCE(tokens_used_this_period, 0) + p_tokens_input + p_tokens_output,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create profile if it doesn't exist
    IF NOT FOUND THEN
        INSERT INTO user_profiles (
            user_id,
            total_tokens_used,
            tokens_used_this_period,
            updated_at
        )
        VALUES (
            p_user_id,
            p_tokens_input + p_tokens_output,
            p_tokens_input + p_tokens_output,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            total_tokens_used = COALESCE(user_profiles.total_tokens_used, 0) + p_tokens_input + p_tokens_output,
            tokens_used_this_period = COALESCE(user_profiles.tokens_used_this_period, 0) + p_tokens_input + p_tokens_output,
            updated_at = NOW();
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_token_usage(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_token_usage(UUID, INTEGER, INTEGER) TO service_role;

-- =============================================================================
-- 5. COMMENTS
-- =============================================================================

COMMENT ON FUNCTION increment_query_usage IS 'Atomically increment query usage counter. Prevents race conditions.';
COMMENT ON FUNCTION check_and_increment_usage IS 'Check usage limits and atomically increment if allowed. Enforces daily caps.';
COMMENT ON FUNCTION record_token_usage IS 'Record token usage for cost tracking and analytics.';
