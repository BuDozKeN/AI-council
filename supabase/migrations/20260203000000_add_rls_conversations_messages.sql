-- Migration: Add RLS policies for conversations and messages tables
--
-- CRITICAL FIX: These tables predate the migration history and were never
-- given RLS policies, creating a cross-tenant data leakage vector.
-- Any authenticated user could potentially access other users' conversations
-- and messages via direct Supabase client queries.
--
-- conversations: Filtered by company membership (is_company_member) for SELECT,
--                and by user ownership (auth.uid()) for mutations.
-- messages:      Filtered through conversation FK chain - user must own the
--                parent conversation to access its messages.

-- ============================================================
-- conversations table RLS
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: Company members can read conversations belonging to their company
CREATE POLICY conversations_select ON conversations
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid())
        OR is_company_member(company_id)
    );

-- INSERT: Users can only create conversations as themselves
CREATE POLICY conversations_insert ON conversations
    FOR INSERT
    WITH CHECK (
        user_id = (SELECT auth.uid())
    );

-- UPDATE: Users can only update their own conversations
CREATE POLICY conversations_update ON conversations
    FOR UPDATE
    USING (
        user_id = (SELECT auth.uid())
    );

-- DELETE: Users can only delete their own conversations
CREATE POLICY conversations_delete ON conversations
    FOR DELETE
    USING (
        user_id = (SELECT auth.uid())
    );

-- ============================================================
-- messages table RLS
-- ============================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can read messages from conversations they have access to
-- (their own conversations or conversations in their company)
CREATE POLICY messages_select ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = (SELECT auth.uid())
               OR is_company_member(company_id)
        )
    );

-- INSERT: Users can only insert messages into their own conversations
CREATE POLICY messages_insert ON messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = (SELECT auth.uid())
        )
    );

-- UPDATE: Users can only update messages in their own conversations
CREATE POLICY messages_update ON messages
    FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = (SELECT auth.uid())
        )
    );

-- DELETE: Users can only delete messages in their own conversations
CREATE POLICY messages_delete ON messages
    FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = (SELECT auth.uid())
        )
    );
