-- =============================================================================
-- Email Leads Table
-- Stores email-based council requests and lead enrichment data
-- Powers the email-to-council onboarding flow
-- =============================================================================

-- Create email_leads table
CREATE TABLE IF NOT EXISTS email_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Email information
    email TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    from_name TEXT,
    subject TEXT,
    question TEXT,

    -- Corporate validation
    is_corporate BOOLEAN DEFAULT true,
    rejection_reason TEXT,

    -- Processing status
    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN ('received', 'processing', 'completed', 'failed', 'non_corporate', 'waiting_list', 'paused_for_maintenance')
    ),

    -- Lead enrichment (from Apollo/FreshLink)
    full_name TEXT,
    title TEXT,
    company_name TEXT,
    company_industry TEXT,
    company_size INTEGER,
    enrichment_data JSONB,  -- Full enrichment payload
    enrichment_source TEXT,  -- 'apollo', 'freshlink', 'apollo+freshlink', 'mock', 'none'
    enrichment_confidence TEXT,  -- 'high', 'medium', 'low'
    enriched_at TIMESTAMPTZ,

    -- Council execution
    council_completed BOOLEAN DEFAULT false,
    council_completed_at TIMESTAMPTZ,
    council_response TEXT,  -- Stage 3 synthesis
    council_model TEXT,  -- Which model provided synthesis
    council_metadata JSONB,  -- Rankings, model counts, etc.

    -- Response tracking
    response_sent BOOLEAN DEFAULT false,
    response_sent_at TIMESTAMPTZ,
    response_message_id TEXT,  -- AgentMail message ID
    response_thread_id TEXT,  -- AgentMail thread ID

    -- AgentMail tracking
    agentmail_message_id TEXT,  -- Incoming message ID
    agentmail_thread_id TEXT,  -- Thread ID for replies
    is_reply BOOLEAN DEFAULT false,

    -- Conversion tracking
    converted_to_user BOOLEAN DEFAULT false,
    converted_user_id UUID REFERENCES auth.users(id),
    converted_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,

    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_leads_email ON email_leads(email);
CREATE INDEX IF NOT EXISTS idx_email_leads_email_domain ON email_leads(email_domain);
CREATE INDEX IF NOT EXISTS idx_email_leads_status ON email_leads(status);
CREATE INDEX IF NOT EXISTS idx_email_leads_created_at ON email_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_leads_is_corporate ON email_leads(is_corporate);
CREATE INDEX IF NOT EXISTS idx_email_leads_company_name ON email_leads(company_name);
CREATE INDEX IF NOT EXISTS idx_email_leads_agentmail_thread ON email_leads(agentmail_thread_id);

-- Index for conversion tracking
CREATE INDEX IF NOT EXISTS idx_email_leads_converted ON email_leads(converted_to_user) WHERE converted_to_user = true;

-- =============================================================================
-- Email Lead Statistics View
-- For quick analytics on email onboarding performance
-- =============================================================================

CREATE OR REPLACE VIEW email_lead_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE is_corporate = true) AS corporate_leads,
    COUNT(*) FILTER (WHERE is_corporate = false) AS non_corporate_leads,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE converted_to_user = true) AS conversions,
    COUNT(DISTINCT email_domain) AS unique_domains,
    COUNT(DISTINCT company_name) FILTER (WHERE company_name IS NOT NULL) AS unique_companies
FROM email_leads
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- =============================================================================
-- RLS Policies
-- Email leads are internal system records, not user-owned
-- Only service role should have full access
-- =============================================================================

-- Enable RLS
ALTER TABLE email_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for webhook processing)
CREATE POLICY "Service role full access to email_leads"
    ON email_leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Platform admins can view (for analytics)
CREATE POLICY "Platform admins can view email_leads"
    ON email_leads
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM platform_admins
            WHERE user_id = auth.uid()
            AND revoked_at IS NULL
        )
    );

-- =============================================================================
-- Update trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_email_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_leads_updated_at
    BEFORE UPDATE ON email_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_email_leads_updated_at();

-- =============================================================================
-- Function to link email lead to converted user
-- Called when a user signs up via the registration link
-- =============================================================================

CREATE OR REPLACE FUNCTION link_email_lead_to_user(
    p_lead_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE email_leads
    SET
        converted_to_user = true,
        converted_user_id = p_user_id,
        converted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_lead_id
    AND converted_to_user = false;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION link_email_lead_to_user TO service_role;

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE email_leads IS 'Stores email-based council requests for the email-to-council onboarding flow';
COMMENT ON COLUMN email_leads.enrichment_data IS 'Full Apollo/FreshLink enrichment payload as JSON';
COMMENT ON COLUMN email_leads.council_metadata IS 'Council execution metadata: rankings, model counts, etc.';
COMMENT ON COLUMN email_leads.agentmail_thread_id IS 'AgentMail thread ID for reply tracking';
