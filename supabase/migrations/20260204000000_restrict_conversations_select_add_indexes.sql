-- Migration: Restrict conversation/message SELECT to owner-only + add indexes
--
-- C1/C2 FIX: The original SELECT policies allowed any company member to read
-- all conversations and messages within their company. While this closed
-- cross-tenant leakage, it exposed sensitive user conversations (e.g. HR
-- decisions, salary discussions) to co-workers. Conversations are personal
-- artifacts and should be private by default.
--
-- C3 FIX: Add indexes to support the RLS subquery on messages, which performs
-- a per-row lookup against conversations. Without these indexes, the policies
-- degrade at scale.

-- ============================================================
-- C1: Restrict conversations SELECT to owner-only
-- ============================================================

DROP POLICY IF EXISTS conversations_select ON conversations;

CREATE POLICY conversations_select ON conversations
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid())
    );

-- ============================================================
-- C2: Restrict messages SELECT to owner's conversations only
-- ============================================================

DROP POLICY IF EXISTS messages_select ON messages;

CREATE POLICY messages_select ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = (SELECT auth.uid())
        )
    );

-- ============================================================
-- C3: Add indexes to support RLS subqueries at scale
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_conversations_company_id ON conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
