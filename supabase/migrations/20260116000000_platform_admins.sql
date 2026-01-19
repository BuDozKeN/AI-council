-- Platform Admins Table
-- Stores platform-level admin users with different roles

-- Create platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    notes TEXT,

    -- Ensure one active entry per user
    CONSTRAINT platform_admins_user_unique UNIQUE (user_id)
);

-- Create index for common lookups
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_platform_admins_role ON public.platform_admins(role) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only service role can read/write (no direct user access via RLS)
-- The backend uses service role key to check admin status

CREATE POLICY "Service role full access"
    ON public.platform_admins
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant usage
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admins TO service_role;

-- Add comment
COMMENT ON TABLE public.platform_admins IS 'Platform-level administrators with elevated access';
COMMENT ON COLUMN public.platform_admins.role IS 'Admin role: super_admin (full access), admin (standard admin), support (read-only support)';

-- Seed the first super admin (you - the developer)
-- NOTE: Replace this UUID with your actual user ID from auth.users
-- You can find it by running: SELECT id FROM auth.users WHERE email = 'your@email.com';
-- For now, this is commented out - add your user after deployment
-- INSERT INTO public.platform_admins (user_id, role, notes)
-- VALUES ('YOUR-USER-UUID', 'super_admin', 'Initial platform admin')
-- ON CONFLICT (user_id) DO NOTHING;
