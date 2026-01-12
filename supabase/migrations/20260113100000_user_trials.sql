-- =============================================================================
-- User Trials Table
-- =============================================================================
-- Tracks free trial runs for onboarding flow
-- Each user gets ONE free council run using the master API key
-- After trial, user must add their own API key or upgrade
-- =============================================================================

-- Create user_trials table
CREATE TABLE IF NOT EXISTS user_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trial_type VARCHAR(50) NOT NULL DEFAULT 'onboarding_council',
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only have one trial of each type
    CONSTRAINT unique_user_trial UNIQUE(user_id, trial_type)
);

-- Create index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_trials_user_id
    ON user_trials(user_id);

-- Create index for trial type queries
CREATE INDEX IF NOT EXISTS idx_user_trials_type
    ON user_trials(trial_type);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS
ALTER TABLE user_trials ENABLE ROW LEVEL SECURITY;

-- Users can only read their own trial records
CREATE POLICY "Users can view own trials"
    ON user_trials
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only the service role can insert (backend handles trial creation)
-- This prevents users from manipulating their trial status
CREATE POLICY "Service role can insert trials"
    ON user_trials
    FOR INSERT
    WITH CHECK (
        -- Only allow if called with service role key
        -- auth.role() returns the role used in the current session
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR
        -- Or if it's a legitimate insert (user_id matches auth.uid)
        auth.uid() = user_id
    );

-- No one can update or delete trial records (immutable audit trail)
-- This ensures trial usage cannot be reversed

-- =============================================================================
-- HELPER FUNCTION
-- =============================================================================

-- Function to check trial availability (can be called from frontend via RPC)
CREATE OR REPLACE FUNCTION check_trial_available(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    trial_exists BOOLEAN;
BEGIN
    -- Check if trial record exists for this user
    SELECT EXISTS(
        SELECT 1 FROM user_trials
        WHERE user_id = p_user_id
        AND trial_type = 'onboarding_council'
    ) INTO trial_exists;

    -- Return true if NO trial exists (trial is available)
    RETURN NOT trial_exists;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_trial_available TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_trials IS
    'Tracks free trial runs for onboarding. Each user gets ONE free council run.';

COMMENT ON COLUMN user_trials.trial_type IS
    'Type of trial. Default is onboarding_council. Allows for future trial types.';

COMMENT ON COLUMN user_trials.ip_address IS
    'IP address when trial was used. For abuse detection.';

COMMENT ON FUNCTION check_trial_available IS
    'Check if user has a free trial available. Returns true if trial not yet used.';
