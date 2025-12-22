-- BYOK (Bring Your Own Key) Support for OpenRouter API Keys
-- This migration adds encrypted API key storage and user settings for council mode

-- =============================================================================
-- Table: user_api_keys
-- Stores encrypted OpenRouter API keys per user
-- Keys are encrypted at the application level before storage
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL,
    provider TEXT DEFAULT 'openrouter' CHECK (provider IN ('openrouter')),
    key_suffix TEXT, -- Last 4 chars for display (e.g., "1234")
    is_valid BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE, -- User toggle to temporarily disable key
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- Enable RLS
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage their own keys
CREATE POLICY "Users manage own API keys" ON user_api_keys
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Table: user_settings
-- Stores user preferences including default council mode
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID REFERENCES auth.users PRIMARY KEY,
    default_mode TEXT DEFAULT 'full_council' CHECK (default_mode IN ('quick', 'full_council')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage their own settings
CREATE POLICY "Users manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Trigger: Update updated_at timestamp
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to user_api_keys
DROP TRIGGER IF EXISTS update_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER update_user_api_keys_updated_at
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_settings
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments for documentation
-- =============================================================================
COMMENT ON TABLE user_api_keys IS 'Encrypted OpenRouter API keys for BYOK users';
COMMENT ON COLUMN user_api_keys.encrypted_key IS 'Fernet-encrypted API key (application-level encryption)';
COMMENT ON COLUMN user_api_keys.key_suffix IS 'Last 4 characters of key for UI display (sk-or-v1-••••1234)';
COMMENT ON COLUMN user_api_keys.is_valid IS 'Set to false if key validation fails';
COMMENT ON COLUMN user_api_keys.is_active IS 'User-controlled toggle to temporarily disable key without deleting';
COMMENT ON TABLE user_settings IS 'User preferences for council mode and other settings';
COMMENT ON COLUMN user_settings.default_mode IS 'quick = single model, full_council = all 5 models + synthesis';