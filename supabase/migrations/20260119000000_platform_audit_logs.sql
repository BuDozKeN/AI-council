-- ============================================================================
-- PLATFORM AUDIT LOGS
-- ============================================================================
-- Platform-wide audit logging for admin actions and security events.
-- Separate from activity_logs which is company-scoped business events.
-- ============================================================================

-- 1. Create platform audit logs table
CREATE TABLE IF NOT EXISTS platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Actor (who performed the action)
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'admin', 'system', 'api')),

    -- Action details
    action TEXT NOT NULL,
    action_category TEXT NOT NULL CHECK (action_category IN (
        'auth',      -- login, logout, password_reset, mfa
        'user',      -- user create, update, delete, impersonate
        'company',   -- company create, update, delete, transfer
        'admin',     -- role_grant, role_revoke, setting_change
        'data',      -- export, import, bulk_delete
        'api',       -- key_create, key_revoke, rate_limit
        'billing',   -- subscription_change, payment
        'security'   -- suspicious_activity, access_denied
    )),

    -- Target (what was affected)
    resource_type TEXT,
    resource_id UUID,
    resource_name TEXT,

    -- Context
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,

    -- Changes (for update actions)
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,

    -- Compliance
    retention_until TIMESTAMPTZ DEFAULT (now() + interval '7 years'),
    is_sensitive BOOLEAN DEFAULT false,

    -- Integrity
    integrity_hash TEXT
);

-- 2. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_platform_audit_timestamp
    ON platform_audit_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_actor
    ON platform_audit_logs(actor_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_action
    ON platform_audit_logs(action_category, action, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_resource
    ON platform_audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_platform_audit_company
    ON platform_audit_logs(company_id, timestamp DESC)
    WHERE company_id IS NOT NULL;

-- 3. Enable Row Level Security
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Only platform admins can read audit logs
-- Note: Simplified to not require is_active column (schema varies by deployment)
DROP POLICY IF EXISTS "Platform admins can read audit logs" ON platform_audit_logs;
CREATE POLICY "Platform admins can read audit logs" ON platform_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_admins
            WHERE user_id = auth.uid()
        )
    );

-- 5. RLS Policy: Service role can insert (for backend logging)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON platform_audit_logs;
CREATE POLICY "Service role can insert audit logs" ON platform_audit_logs
    FOR INSERT WITH CHECK (true);

-- 6. Hash generation function for integrity
CREATE OR REPLACE FUNCTION generate_platform_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    hash_input TEXT;
BEGIN
    hash_input := COALESCE(NEW.id::TEXT, '') || '|' ||
                  COALESCE(NEW.timestamp::TEXT, '') || '|' ||
                  COALESCE(NEW.actor_id::TEXT, '') || '|' ||
                  COALESCE(NEW.actor_type, '') || '|' ||
                  COALESCE(NEW.action, '') || '|' ||
                  COALESCE(NEW.action_category, '') || '|' ||
                  COALESCE(NEW.resource_type, '') || '|' ||
                  COALESCE(NEW.resource_id::TEXT, '') || '|' ||
                  COALESCE(NEW.ip_address::TEXT, '');

    NEW.integrity_hash := encode(sha256(hash_input::bytea), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 7. Trigger to auto-generate hash
DROP TRIGGER IF EXISTS platform_audit_hash_trigger ON platform_audit_logs;
CREATE TRIGGER platform_audit_hash_trigger
    BEFORE INSERT ON platform_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION generate_platform_audit_hash();

-- 8. Prevent updates (audit logs are immutable)
CREATE OR REPLACE FUNCTION prevent_platform_audit_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Platform audit logs cannot be modified.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS platform_audit_no_update ON platform_audit_logs;
CREATE TRIGGER platform_audit_no_update
    BEFORE UPDATE ON platform_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_platform_audit_update();

-- 9. Prevent deletes except by service role
CREATE OR REPLACE FUNCTION prevent_platform_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Platform audit logs cannot be deleted.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS platform_audit_no_delete ON platform_audit_logs;
CREATE TRIGGER platform_audit_no_delete
    BEFORE DELETE ON platform_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_platform_audit_delete();

-- 10. Comments
COMMENT ON TABLE platform_audit_logs IS 'Platform-wide audit trail for admin actions and security events';
COMMENT ON COLUMN platform_audit_logs.actor_type IS 'user=regular user, admin=platform admin, system=automated, api=API call';
COMMENT ON COLUMN platform_audit_logs.action_category IS 'Category of action: auth, user, company, admin, data, api, billing, security';
COMMENT ON COLUMN platform_audit_logs.integrity_hash IS 'SHA-256 hash for tamper detection';
COMMENT ON COLUMN platform_audit_logs.retention_until IS 'Data retention deadline (default 7 years for compliance)';
