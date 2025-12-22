-- Add is_active column to user_api_keys table
-- This allows users to temporarily disable their API key without deleting it

-- Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_api_keys' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_api_keys ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN user_api_keys.is_active IS 'User-controlled toggle to temporarily disable key without deleting';
