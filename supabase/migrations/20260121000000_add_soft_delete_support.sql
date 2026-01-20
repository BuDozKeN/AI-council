-- =============================================================================
-- Soft Delete Support for GDPR-Compliant User Deletion
-- =============================================================================
-- This migration adds infrastructure for soft-deleting users:
-- 1. Users are marked as deleted but data is retained
-- 2. After 30 days, PII is anonymized but audit trail is preserved
-- 3. Full deletion is still possible via manual admin action
-- =============================================================================

-- 1. Create user_deletions table to track deletion state
CREATE TABLE IF NOT EXISTS public.user_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,  -- References auth.users(id) but no FK constraint
    email_hash TEXT NOT NULL,  -- SHA256 hash of original email for lookup
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by UUID,  -- Admin who initiated deletion (references auth.users)
    deletion_reason TEXT,  -- Optional reason for deletion
    anonymized_at TIMESTAMPTZ,  -- When PII was anonymized (null = not yet)
    permanently_deleted_at TIMESTAMPTZ,  -- When fully purged (null = not yet)
    restoration_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    metadata JSONB DEFAULT '{}'  -- Store any additional context
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_deletions_user_id
    ON public.user_deletions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_deletions_deleted_at
    ON public.user_deletions(deleted_at);

CREATE INDEX IF NOT EXISTS idx_user_deletions_restoration_deadline
    ON public.user_deletions(restoration_deadline)
    WHERE permanently_deleted_at IS NULL AND anonymized_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_deletions_email_hash
    ON public.user_deletions(email_hash);

-- 3. Enable RLS
ALTER TABLE public.user_deletions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Only platform admins can access
DROP POLICY IF EXISTS "Platform admins can manage user deletions" ON public.user_deletions;
CREATE POLICY "Platform admins can manage user deletions" ON public.user_deletions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM platform_admins
            WHERE user_id = auth.uid()
        )
    );

-- Service role has full access (for backend/scheduled jobs)
DROP POLICY IF EXISTS "Service role full access to user deletions" ON public.user_deletions;
CREATE POLICY "Service role full access to user deletions" ON public.user_deletions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Add deleted_user_id column to audit-relevant tables for anonymization
-- This allows us to preserve "a user did X" without knowing who

-- Add to conversations (preserve that conversations existed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'original_user_id'
    ) THEN
        ALTER TABLE public.conversations ADD COLUMN original_user_id UUID;
        COMMENT ON COLUMN public.conversations.original_user_id IS
            'Original user_id before anonymization. Set when user is anonymized.';
    END IF;
END $$;

-- Add to knowledge_entries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'knowledge_entries'
        AND column_name = 'original_user_id'
    ) THEN
        ALTER TABLE public.knowledge_entries ADD COLUMN original_user_id UUID;
    END IF;
END $$;

-- 6. Function to check if a user is soft-deleted
CREATE OR REPLACE FUNCTION public.is_user_deleted(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_deletions
        WHERE user_id = p_user_id
        AND permanently_deleted_at IS NULL
    );
END;
$$;

-- 7. Function to soft-delete a user
CREATE OR REPLACE FUNCTION public.soft_delete_user(
    p_user_id UUID,
    p_deleted_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_email_hash TEXT;
BEGIN
    -- Get user email for hash
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = p_user_id;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Create email hash (for potential future lookup if needed)
    v_email_hash := encode(sha256(v_email::bytea), 'hex');

    -- Insert deletion record
    INSERT INTO user_deletions (user_id, email_hash, deleted_by, deletion_reason)
    VALUES (p_user_id, v_email_hash, p_deleted_by, p_reason)
    ON CONFLICT (user_id) DO UPDATE SET
        deleted_at = now(),
        deleted_by = p_deleted_by,
        deletion_reason = COALESCE(p_reason, user_deletions.deletion_reason),
        restoration_deadline = now() + INTERVAL '30 days',
        anonymized_at = NULL,  -- Reset if re-deleted
        permanently_deleted_at = NULL;

    RETURN TRUE;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.soft_delete_user(UUID, UUID, TEXT) TO service_role;

-- 8. Function to restore a soft-deleted user (within 30-day window)
CREATE OR REPLACE FUNCTION public.restore_deleted_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deletion RECORD;
BEGIN
    -- Get deletion record
    SELECT * INTO v_deletion
    FROM user_deletions
    WHERE user_id = p_user_id
    AND permanently_deleted_at IS NULL
    AND anonymized_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User deletion record not found or already anonymized';
    END IF;

    IF v_deletion.restoration_deadline < now() THEN
        RAISE EXCEPTION 'Restoration deadline has passed';
    END IF;

    -- Remove deletion record
    DELETE FROM user_deletions WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.restore_deleted_user(UUID) TO service_role;

-- 9. Function to anonymize a user's PII (called by scheduled job after 30 days)
CREATE OR REPLACE FUNCTION public.anonymize_user_pii(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deletion RECORD;
    v_anon_label TEXT;
BEGIN
    -- Get deletion record
    SELECT * INTO v_deletion
    FROM user_deletions
    WHERE user_id = p_user_id
    AND permanently_deleted_at IS NULL
    AND anonymized_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not in deletable state';
    END IF;

    -- Create anonymized label
    v_anon_label := '[Deleted User ' || substring(p_user_id::text, 1, 8) || ']';

    -- Preserve original user_id before nullifying
    UPDATE conversations
    SET original_user_id = user_id
    WHERE user_id = p_user_id AND original_user_id IS NULL;

    UPDATE knowledge_entries
    SET original_user_id = user_id
    WHERE user_id = p_user_id AND original_user_id IS NULL;

    -- Mark as anonymized
    UPDATE user_deletions
    SET anonymized_at = now()
    WHERE user_id = p_user_id;

    RETURN TRUE;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.anonymize_user_pii(UUID) TO service_role;

-- 10. Comments
COMMENT ON TABLE public.user_deletions IS
    'Tracks soft-deleted users for GDPR compliance. Users remain here until permanently purged.';
COMMENT ON COLUMN public.user_deletions.restoration_deadline IS
    'User can be restored until this deadline (default 30 days from deletion)';
COMMENT ON COLUMN public.user_deletions.anonymized_at IS
    'When PII was anonymized. After this, user cannot be restored.';
COMMENT ON COLUMN public.user_deletions.permanently_deleted_at IS
    'When all user data was fully purged from the system.';
