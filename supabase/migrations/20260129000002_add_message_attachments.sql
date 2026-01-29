-- Add attachment support to messages table
-- Allows storing attachment IDs and image analysis results for conversation context persistence

-- Add columns for attachment tracking and image analysis caching
ALTER TABLE messages
ADD COLUMN attachment_ids TEXT[],
ADD COLUMN image_analysis JSONB;

-- Add index for querying messages with attachments
CREATE INDEX idx_messages_attachment_ids ON messages USING GIN (attachment_ids)
WHERE attachment_ids IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN messages.attachment_ids IS 'Array of attachment IDs (from attachments table) associated with this message';
COMMENT ON COLUMN messages.image_analysis IS 'Cached image analysis results from vision model to preserve context across conversation reloads';

-- DOWN migration (for rollback)
-- To rollback: DROP INDEX idx_messages_attachment_ids; ALTER TABLE messages DROP COLUMN attachment_ids, DROP COLUMN image_analysis;
