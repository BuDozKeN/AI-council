-- =============================================================================
-- Email Leads Waiting List Enhancement
-- Adds waiting list functionality for non-corporate email users
-- =============================================================================

-- Add waiting list columns
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS waiting_list_status TEXT;
-- Values: NULL (corporate, not applicable), 'pending', 'notified', 'converted_public'

ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS waiting_list_position INTEGER;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS notify_on_public_launch BOOLEAN DEFAULT true;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS waiting_list_joined_at TIMESTAMPTZ;

-- Add funnel tracking columns
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS session_viewed_at TIMESTAMPTZ;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS registration_started_at TIMESTAMPTZ;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS paid_conversion_at TIMESTAMPTZ;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS paid_plan TEXT;  -- 'pro', 'enterprise'
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2);

-- Add auto-reply detection flag
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS is_auto_reply BOOLEAN DEFAULT false;
ALTER TABLE email_leads ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES email_leads(id);

-- Create index for waiting list queries
CREATE INDEX IF NOT EXISTS idx_email_leads_waiting_list
ON email_leads(waiting_list_status, created_at)
WHERE is_corporate = false AND waiting_list_status IS NOT NULL;

-- Create index for funnel analysis
CREATE INDEX IF NOT EXISTS idx_email_leads_funnel
ON email_leads(created_at, council_completed, converted_to_user, paid_conversion_at);

-- Create index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_email_leads_duplicate_check
ON email_leads(email, question, created_at DESC);

-- =============================================================================
-- Waiting List Statistics View
-- =============================================================================

CREATE OR REPLACE VIEW waiting_list_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS new_signups,
    COUNT(*) FILTER (WHERE notify_on_public_launch = true) AS want_notification,
    COUNT(DISTINCT email_domain) AS unique_domains,
    MAX(waiting_list_position) AS latest_position
FROM email_leads
WHERE is_corporate = false
  AND waiting_list_status IS NOT NULL
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- =============================================================================
-- Conversion Funnel View
-- =============================================================================

CREATE OR REPLACE VIEW email_lead_funnel AS
SELECT
    DATE_TRUNC('week', created_at) AS week,
    COUNT(*) AS emails_received,
    COUNT(*) FILTER (WHERE is_corporate) AS corporate_leads,
    COUNT(*) FILTER (WHERE NOT is_corporate) AS waiting_list_leads,
    COUNT(*) FILTER (WHERE council_completed) AS councils_completed,
    COUNT(*) FILTER (WHERE response_sent) AS emails_sent,
    COUNT(*) FILTER (WHERE session_viewed_at IS NOT NULL) AS sessions_viewed,
    COUNT(*) FILTER (WHERE converted_to_user) AS registrations,
    COUNT(*) FILTER (WHERE trial_used_at IS NOT NULL) AS trials_used,
    COUNT(*) FILTER (WHERE paid_conversion_at IS NOT NULL) AS paid_conversions,
    COALESCE(SUM(lifetime_value), 0) AS total_ltv,
    -- Conversion rates
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE converted_to_user) /
        NULLIF(COUNT(*) FILTER (WHERE response_sent), 0),
        2
    ) AS email_to_registration_pct,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE paid_conversion_at IS NOT NULL) /
        NULLIF(COUNT(*) FILTER (WHERE converted_to_user), 0),
        2
    ) AS registration_to_paid_pct
FROM email_leads
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- =============================================================================
-- Function to get next waiting list position
-- =============================================================================

CREATE OR REPLACE FUNCTION get_next_waiting_list_position()
RETURNS INTEGER AS $$
DECLARE
    next_position INTEGER;
BEGIN
    SELECT COALESCE(MAX(waiting_list_position), 0) + 1
    INTO next_position
    FROM email_leads
    WHERE waiting_list_status IS NOT NULL;

    RETURN next_position;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Function to check for duplicate emails within time window
-- =============================================================================

CREATE OR REPLACE FUNCTION check_duplicate_email(
    p_email TEXT,
    p_question TEXT,
    p_window_minutes INTEGER DEFAULT 5
) RETURNS UUID AS $$
DECLARE
    existing_lead_id UUID;
BEGIN
    SELECT id INTO existing_lead_id
    FROM email_leads
    WHERE email = p_email
      AND question = p_question
      AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN existing_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_next_waiting_list_position TO service_role;
GRANT EXECUTE ON FUNCTION check_duplicate_email TO service_role;

-- Comments
COMMENT ON COLUMN email_leads.waiting_list_status IS 'Waiting list status: pending, notified, converted_public';
COMMENT ON COLUMN email_leads.waiting_list_position IS 'Position in waiting list queue';
COMMENT ON COLUMN email_leads.is_auto_reply IS 'True if detected as out-of-office or auto-reply';
COMMENT ON COLUMN email_leads.duplicate_of_lead_id IS 'If duplicate, points to original lead';
