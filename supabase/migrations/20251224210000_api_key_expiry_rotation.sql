-- API Key Expiry and Rotation Support
-- Adds expiration tracking and audit logging for BYOK keys

-- =============================================================================
-- Add expiry and audit columns to user_api_keys
-- =============================================================================

-- Add expires_at column for automatic key expiration (90 days default)
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add last_used_at for tracking key usage
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Add revoked_at for soft-delete on rotation
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Add rotation_count to track how many times key was rotated
ALTER TABLE user_api_keys
ADD COLUMN IF NOT EXISTS rotation_count INTEGER DEFAULT 0;

-- Set default expiry for existing keys (90 days from now)
UPDATE user_api_keys
SET expires_at = NOW() + INTERVAL '90 days'
WHERE expires_at IS NULL AND revoked_at IS NULL;

-- =============================================================================
-- API Key Audit Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_key_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 'rotated', 'revoked', 'expired', 'used', 'validation_failed'
    )),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying audit log by user
CREATE INDEX IF NOT EXISTS idx_api_key_audit_user
ON api_key_audit_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own audit log
CREATE POLICY "Users view own API key audit log" ON api_key_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (for backend logging)
CREATE POLICY "Service role inserts audit log" ON api_key_audit_log
    FOR INSERT WITH CHECK (true);

-- =============================================================================
-- Function: Check if key is expired
-- =============================================================================
CREATE OR REPLACE FUNCTION is_api_key_expired(key_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    key_expires_at TIMESTAMPTZ;
    key_revoked_at TIMESTAMPTZ;
BEGIN
    SELECT expires_at, revoked_at INTO key_expires_at, key_revoked_at
    FROM user_api_keys
    WHERE user_id = key_user_id;

    -- Key is expired if revoked or past expiry date
    IF key_revoked_at IS NOT NULL THEN
        RETURN TRUE;
    END IF;

    IF key_expires_at IS NOT NULL AND key_expires_at < NOW() THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON COLUMN user_api_keys.expires_at IS 'Key expiration date (90 days from creation by default)';
COMMENT ON COLUMN user_api_keys.last_used_at IS 'Last time the key was used for an API call';
COMMENT ON COLUMN user_api_keys.revoked_at IS 'When the key was revoked (soft delete on rotation)';
COMMENT ON COLUMN user_api_keys.rotation_count IS 'Number of times the key has been rotated';
COMMENT ON TABLE api_key_audit_log IS 'Audit trail for API key lifecycle events';
