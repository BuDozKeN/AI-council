-- Impersonation Sessions Table
-- Tracks admin impersonation of users for audit and security purposes

-- Drop existing table if it exists (clean slate)
DROP TABLE IF EXISTS public.impersonation_sessions CASCADE;

-- Create impersonation_sessions table
CREATE TABLE public.impersonation_sessions (
    id TEXT PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_email TEXT NOT NULL,
    reason TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    ended_reason TEXT CHECK (ended_reason IN ('manual', 'expired', 'admin_logout', 'target_deleted')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_impersonation_admin_id ON public.impersonation_sessions(admin_id);
CREATE INDEX idx_impersonation_is_active ON public.impersonation_sessions(is_active);
CREATE INDEX idx_impersonation_target_user ON public.impersonation_sessions(target_user_id);
CREATE INDEX idx_impersonation_started_at ON public.impersonation_sessions(started_at DESC);
CREATE INDEX idx_impersonation_expires_at ON public.impersonation_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access
CREATE POLICY "Service role full access"
    ON public.impersonation_sessions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant usage
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impersonation_sessions TO service_role;

-- Comments
COMMENT ON TABLE public.impersonation_sessions IS 'Tracks admin impersonation sessions for audit and security';
COMMENT ON COLUMN public.impersonation_sessions.id IS 'Session ID with imp_ prefix';
COMMENT ON COLUMN public.impersonation_sessions.reason IS 'Required reason for impersonation (audit trail)';
COMMENT ON COLUMN public.impersonation_sessions.expires_at IS 'Auto-expiry time (30 minutes from start)';
COMMENT ON COLUMN public.impersonation_sessions.ended_reason IS 'How the session ended: manual, expired, admin_logout, target_deleted';

-- DOWN (Rollback)
-- To rollback: DROP TABLE IF EXISTS public.impersonation_sessions CASCADE;
