-- Migration: Add attachments support for images
-- Run this in Supabase SQL Editor

-- 1. Create the attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_index INTEGER, -- Which message in the conversation this attachment belongs to

    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- e.g., 'image/png', 'image/jpeg', 'image/webp'
    file_size INTEGER NOT NULL, -- Size in bytes
    storage_path TEXT NOT NULL, -- Path in Supabase Storage

    -- Optional: AI-generated description of the image
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON attachments(conversation_id);

-- 3. Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Users can only access their own attachments
CREATE POLICY "Users can view their own attachments"
    ON attachments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attachments"
    ON attachments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attachments"
    ON attachments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own attachments"
    ON attachments FOR DELETE
    USING (auth.uid() = user_id);

-- 5. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_updated_at
    BEFORE UPDATE ON attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachments_updated_at();

-- Note: You also need to create the storage bucket manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name: "attachments"
-- 4. Make it PRIVATE (not public)
-- 5. Set file size limit to 10MB
-- 6. Allowed MIME types: image/png, image/jpeg, image/webp, image/gif

-- Storage bucket policies (run these after creating the bucket):
-- These allow authenticated users to upload/read their own files

-- Policy for uploading (INSERT)
-- CREATE POLICY "Users can upload their own attachments"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Policy for reading (SELECT)
-- CREATE POLICY "Users can read their own attachments"
-- ON storage.objects FOR SELECT
-- USING (
--     bucket_id = 'attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- Policy for deleting (DELETE)
-- CREATE POLICY "Users can delete their own attachments"
-- ON storage.objects FOR DELETE
-- USING (
--     bucket_id = 'attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );
