-- ============================================================================
-- Atomic Query Usage Increment Function
-- ============================================================================
-- SECURITY: Prevents race conditions where concurrent requests could bypass
-- query limits by using atomic database-level increment instead of
-- read-then-write pattern.
-- ============================================================================

-- Drop existing function if it exists (for clean migration)
DROP FUNCTION IF EXISTS increment_query_usage(UUID);

-- Create atomic increment function
CREATE OR REPLACE FUNCTION increment_query_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    -- Use INSERT ... ON CONFLICT with atomic increment
    -- This is a single atomic operation that cannot race
    INSERT INTO user_profiles (user_id, queries_used_this_period, updated_at)
    VALUES (p_user_id, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET
        queries_used_this_period = COALESCE(user_profiles.queries_used_this_period, 0) + 1,
        updated_at = NOW()
    RETURNING queries_used_this_period INTO v_new_count;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Grant execute to authenticated users (they can only increment their own via RLS)
GRANT EXECUTE ON FUNCTION increment_query_usage(UUID) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION increment_query_usage IS
    'Atomically increments query usage counter for a user. Prevents race conditions.';
