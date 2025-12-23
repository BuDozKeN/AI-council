-- Webhook Idempotency Table
-- Prevents replay attacks by tracking processed Stripe webhook events

-- Create the processed_webhook_events table
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,  -- Stripe event ID (e.g., evt_xxx)
    event_type TEXT NOT NULL,       -- Event type (e.g., checkout.session.completed)
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id
    ON processed_webhook_events(event_id);

-- Create index for cleanup queries (delete old events)
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at
    ON processed_webhook_events(processed_at);

-- Add comment explaining the table's purpose
COMMENT ON TABLE processed_webhook_events IS
    'Tracks processed Stripe webhook events to prevent replay attacks. Events older than 30 days can be safely deleted.';

-- RLS: This table is only accessed by the service role (webhooks have no user context)
-- No user-facing RLS policies needed
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON processed_webhook_events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
