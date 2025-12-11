-- Migration: Add starred and archived columns to conversations
-- Enables favouriting conversations and archiving completed ones

-- Add is_starred column (favourited conversations show at top)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Add is_archived column (archived conversations hidden by default)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_conversations_starred ON conversations(user_id, is_starred) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(user_id, is_archived);

-- Comments for documentation
COMMENT ON COLUMN conversations.is_starred IS 'Starred/favourited conversations always appear at top of list';
COMMENT ON COLUMN conversations.is_archived IS 'Archived conversations are hidden from default view';
