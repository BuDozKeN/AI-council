-- =============================================================================
-- Invite-Only Mode: Block New Signups Auth Hook
-- =============================================================================
-- This function is called by Supabase Auth before creating any new user.
-- It blocks ALL signups - users must be invited via Supabase Dashboard.
--
-- To invite users: Supabase Dashboard → Authentication → Users → Add user → Invite
--
-- To disable invite-only mode later:
--   1. Go to Supabase Dashboard → Authentication → Auth Hooks
--   2. Delete or disable the "Before User Created hook"
-- =============================================================================

CREATE OR REPLACE FUNCTION public.block_new_signups(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Block ALL new signups (invite-only mode)
  -- To allow a signup, invite users via Supabase Dashboard instead
  RAISE EXCEPTION 'Signups are currently invite-only. Please contact admin for access.';

  RETURN event;
END;
$$;

-- Grant execute permission to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.block_new_signups TO supabase_auth_admin;

-- =============================================================================
-- IMPORTANT: Manual Step Required
-- =============================================================================
-- After running this migration, you must ALSO configure the hook in Supabase:
--   1. Go to Supabase Dashboard → Authentication → Auth Hooks
--   2. Click "Add hook" → "Before User Created hook"
--   3. Select: Schema = public, Function = block_new_signups
--   4. Enable the hook
-- =============================================================================

COMMENT ON FUNCTION public.block_new_signups IS
    'Auth hook that blocks all new signups. Platform is invite-only. Disable hook in Supabase Dashboard to allow signups again.';
