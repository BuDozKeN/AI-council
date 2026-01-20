-- =============================================================================
-- Fix Platform Invitations Status Constraint
-- =============================================================================
-- Updates the status check constraint to include all valid status values.
-- The original constraint may have been missing 'cancelled' and 'revoked'.
-- =============================================================================

-- Drop all existing check constraints on the status column
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'platform_invitations'
        AND nsp.nspname = 'public'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.platform_invitations DROP CONSTRAINT %I', constraint_rec.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_rec.conname;
    END LOOP;
END $$;

-- Add the correct constraint with all valid status values
ALTER TABLE public.platform_invitations
    ADD CONSTRAINT platform_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'revoked'));
