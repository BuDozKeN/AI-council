-- =============================================
-- REMOVE DUPLICATE INDEXES
-- =============================================
-- These indexes appear to be duplicates serving the same purpose
-- Keeping the more descriptively named versions

-- conversations: starred vs is_starred (keep is_starred as more explicit)
DROP INDEX IF EXISTS idx_conversations_starred;

-- conversations: department vs department_id (keep department_id as more explicit)
DROP INDEX IF EXISTS idx_conversations_department;