-- =============================================================================
-- Profile Fields Extension
-- =============================================================================
-- Adds linkedin_url and role fields to user_profiles table
-- These fields capture onboarding data for better personalization
-- =============================================================================

-- Add new columns to user_profiles (safe - IF NOT EXISTS handles reruns)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT;

-- Add index for LinkedIn URL lookups (for deduplication)
CREATE INDEX IF NOT EXISTS idx_user_profiles_linkedin_url
    ON user_profiles(linkedin_url)
    WHERE linkedin_url IS NOT NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN user_profiles.linkedin_url IS
    'LinkedIn profile URL provided during onboarding';

COMMENT ON COLUMN user_profiles.role IS
    'Professional role/title (e.g., CEO, CTO, Marketing Director)';
