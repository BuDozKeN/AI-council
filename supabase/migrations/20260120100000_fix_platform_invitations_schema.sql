-- =============================================================================
-- Fix Platform Invitations Schema
-- =============================================================================
-- Adds missing columns to platform_invitations table.
-- The original migration may not have been applied or the table was created
-- with a simpler schema initially.
-- =============================================================================

-- Add missing columns (using DO block for conditional adds)
DO $$
BEGIN
    -- Add 'name' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN name TEXT;
        COMMENT ON COLUMN public.platform_invitations.name IS 'Optional name for personalization';
    END IF;

    -- Add 'token' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'token'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
        COMMENT ON COLUMN public.platform_invitations.token IS 'Unique token for the invitation URL';
    END IF;

    -- Add 'invited_by_email' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'invited_by_email'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN invited_by_email TEXT;
        COMMENT ON COLUMN public.platform_invitations.invited_by_email IS 'Denormalized for display after user deletion';
    END IF;

    -- Add 'accepted_at' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'accepted_at'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN accepted_at TIMESTAMPTZ;
    END IF;

    -- Add 'cancelled_at' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;

    -- Add 'accepted_user_id' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'accepted_user_id'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Add 'target_company_id' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'target_company_id'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN target_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;

    -- Add 'target_company_role' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'target_company_role'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN target_company_role TEXT DEFAULT 'member'
            CHECK (target_company_role IN ('owner', 'admin', 'member'));
    END IF;

    -- Add 'metadata' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- Add 'email_sent_at' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'email_sent_at'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN email_sent_at TIMESTAMPTZ;
    END IF;

    -- Add 'email_message_id' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'email_message_id'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN email_message_id TEXT;
    END IF;

    -- Add 'resend_count' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'resend_count'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN resend_count INTEGER DEFAULT 0;
    END IF;

    -- Add 'last_resent_at' column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'platform_invitations'
        AND column_name = 'last_resent_at'
    ) THEN
        ALTER TABLE public.platform_invitations ADD COLUMN last_resent_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create indexes if they don't exist
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

-- Create/replace the validate_invitation_token function
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

-- Create/replace the accept_invitation function
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

-- Update RLS policies to ensure service role has access
DROP POLICY IF EXISTS "Service role full access to invitations" ON platform_invitations;
CREATE POLICY "Service role full access to invitations" ON platform_invitations
    FOR ALL USING (true) WITH CHECK (true);

-- Ensure platform admins can manage invitations
DROP POLICY IF EXISTS "Platform admins can manage invitations" ON platform_invitations;
CREATE POLICY "Platform admins can manage invitations" ON platform_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM platform_admins
            WHERE user_id = auth.uid()
        )
    );
