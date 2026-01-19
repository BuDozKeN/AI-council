-- Platform Invitations Table
-- Stores platform-level user invitations sent by admins
-- Used for invite-only signup flow

-- 1. Create platform_invitations table
CREATE TABLE IF NOT EXISTS public.platform_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invitee info
    email TEXT NOT NULL,
    name TEXT,  -- Optional name for personalization

    -- Invitation details
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'revoked')),

    -- Who sent it
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_by_email TEXT,  -- Denormalized for display after user deletion

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Result tracking
    accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Optional: Add to company after signup
    target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    target_company_role TEXT DEFAULT 'member'
        CHECK (target_company_role IN ('owner', 'admin', 'member')),

    -- Metadata
    notes TEXT,  -- Admin notes about why they invited this person
    metadata JSONB DEFAULT '{}',

    -- Email tracking
    email_sent_at TIMESTAMPTZ,
    email_message_id TEXT,
    resend_count INTEGER DEFAULT 0,
    last_resent_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT platform_invitations_email_pending_unique
        UNIQUE (email) WHERE (status = 'pending')
);

-- 2. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_platform_invitations_email
    ON platform_invitations(email);

CREATE INDEX IF NOT EXISTS idx_platform_invitations_token
    ON platform_invitations(token)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_platform_invitations_status
    ON platform_invitations(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_invitations_invited_by
    ON platform_invitations(invited_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_invitations_expires
    ON platform_invitations(expires_at)
    WHERE status = 'pending';

-- 3. Enable Row Level Security
ALTER TABLE platform_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Platform admins can manage all invitations
DROP POLICY IF EXISTS "Platform admins can manage invitations" ON platform_invitations;
CREATE POLICY "Platform admins can manage invitations" ON platform_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM platform_admins
            WHERE user_id = auth.uid()
        )
    );

-- Service role has full access (for backend operations)
DROP POLICY IF EXISTS "Service role full access to invitations" ON platform_invitations;
CREATE POLICY "Service role full access to invitations" ON platform_invitations
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Function to validate invitation token (public access)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token UUID)
RETURNS TABLE (
    invitation_id UUID,
    email TEXT,
    name TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    target_company_id UUID,
    target_company_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id as invitation_id,
        i.email,
        i.name,
        i.status,
        i.expires_at,
        (i.status = 'pending' AND i.expires_at > now()) as is_valid,
        i.target_company_id,
        i.target_company_role
    FROM platform_invitations i
    WHERE i.token = p_token;
END;
$$;

-- Grant execute to anon role (needed for accept-invite page)
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(UUID) TO authenticated;

-- 6. Function to mark invitation as accepted (called after successful signup)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation RECORD;
BEGIN
    -- Get and lock the invitation
    SELECT * INTO v_invitation
    FROM platform_invitations
    WHERE token = p_token
    FOR UPDATE;

    -- Validate
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    IF v_invitation.status != 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status;
    END IF;

    IF v_invitation.expires_at < now() THEN
        -- Mark as expired
        UPDATE platform_invitations
        SET status = 'expired'
        WHERE id = v_invitation.id;
        RAISE EXCEPTION 'Invitation has expired';
    END IF;

    -- Mark as accepted
    UPDATE platform_invitations
    SET
        status = 'accepted',
        accepted_at = now(),
        accepted_user_id = p_user_id
    WHERE id = v_invitation.id;

    -- If target company specified, add user as member
    IF v_invitation.target_company_id IS NOT NULL THEN
        INSERT INTO company_members (company_id, user_id, role, status)
        VALUES (
            v_invitation.target_company_id,
            p_user_id,
            v_invitation.target_company_role,
            'active'
        )
        ON CONFLICT (company_id, user_id) DO NOTHING;
    END IF;

    RETURN TRUE;
END;
$$;

-- Grant execute to service role only (backend handles this)
GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID, UUID) TO service_role;

-- 7. Function to expire old invitations (can be called by cron)
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE platform_invitations
        SET status = 'expired'
        WHERE status = 'pending'
        AND expires_at < now()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM expired;

    RETURN v_count;
END;
$$;

-- 8. Comments
COMMENT ON TABLE platform_invitations IS 'Platform-level user invitations for invite-only signup';
COMMENT ON COLUMN platform_invitations.token IS 'Unique token for the invitation URL';
COMMENT ON COLUMN platform_invitations.status IS 'pending=waiting, accepted=user signed up, expired=past expiry, cancelled=admin cancelled, revoked=admin revoked after send';
COMMENT ON COLUMN platform_invitations.target_company_id IS 'Optional: automatically add user to this company after signup';
COMMENT ON COLUMN platform_invitations.target_company_role IS 'Role in target company: owner, admin, or member';
