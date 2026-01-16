-- =============================================================================
-- Invite-Only Mode: Block New Signups Auth Hook
-- =============================================================================
-- This function is called by Supabase Auth before creating any new user.
-- It blocks direct signups but ALLOWS invited users through.
-- Users must be invited via Supabase Dashboard to join.
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
DECLARE
  auth_method TEXT;
BEGIN
  -- Extract authentication method from the event payload
  auth_method := event->'authentication_method'->>'method';

  -- Allow invited users through (they have authentication_method = 'invite')
  IF auth_method = 'invite' THEN
    RETURN event;
  END IF;

  -- Block all other signup methods (email, oauth, etc.)
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
    'Auth hook that blocks direct signups but allows invited users. Platform is invite-only. Disable hook in Supabase Dashboard to allow open signups again.';
