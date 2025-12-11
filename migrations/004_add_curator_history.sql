-- Migration: Add curator_history column to conversations table
-- This stores the history of curator runs for each conversation

-- Add curator_history column (JSONB array to store multiple runs)
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS curator_history JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN conversations.curator_history IS 'Array of curator run records: [{analyzed_at, business_id, suggestion_count, accepted_count, rejected_count}]';
