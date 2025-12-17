-- Add response_index column to knowledge_entries for tracking multiple decisions per conversation
-- This allows each Stage3 response in a conversation to be tracked independently

ALTER TABLE knowledge_entries
ADD COLUMN IF NOT EXISTS response_index INTEGER;

-- Add index for efficient lookups by conversation + response index
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_conversation_response
ON knowledge_entries(source_conversation_id, response_index)
WHERE source_conversation_id IS NOT NULL AND response_index IS NOT NULL;

COMMENT ON COLUMN knowledge_entries.response_index IS 'Index of the response within the conversation (0-based). Used to track which Stage3 responses have been saved.';
