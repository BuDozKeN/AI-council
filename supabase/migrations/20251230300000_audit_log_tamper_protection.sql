-- ============================================================================
-- AUDIT LOG TAMPER PROTECTION
-- ============================================================================
-- Adds integrity protection to activity_logs table:
-- 1. Hash column for tamper detection
-- 2. Trigger to auto-generate hash on insert
-- 3. Prevent updates/deletes (audit logs should be immutable)
-- 4. Function to verify log integrity
-- ============================================================================

-- 1. Add hash column for integrity verification
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS integrity_hash TEXT;

-- 2. Add actor tracking (who performed the action)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id);

-- 3. Create hash generation function
-- Uses SHA-256 hash of key fields to detect tampering
CREATE OR REPLACE FUNCTION generate_activity_log_hash()
RETURNS TRIGGER AS $$
DECLARE
    hash_input TEXT;
BEGIN
    -- Concatenate key fields that should not change
    hash_input := COALESCE(NEW.id::TEXT, '') || '|' ||
                  COALESCE(NEW.company_id::TEXT, '') || '|' ||
                  COALESCE(NEW.event_type, '') || '|' ||
                  COALESCE(NEW.title, '') || '|' ||
                  COALESCE(NEW.description, '') || '|' ||
                  COALESCE(NEW.related_id::TEXT, '') || '|' ||
                  COALESCE(NEW.related_type, '') || '|' ||
                  COALESCE(NEW.created_at::TEXT, '') || '|' ||
                  COALESCE(NEW.actor_id::TEXT, '');

    -- Generate SHA-256 hash
    NEW.integrity_hash := encode(sha256(hash_input::bytea), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 4. Create trigger to auto-generate hash on insert
DROP TRIGGER IF EXISTS activity_log_hash_trigger ON activity_logs;
CREATE TRIGGER activity_log_hash_trigger
    BEFORE INSERT ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION generate_activity_log_hash();

-- 5. Prevent updates to audit logs (immutable records)
CREATE OR REPLACE FUNCTION prevent_activity_log_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Activity logs cannot be modified. Audit trail must remain immutable.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS activity_log_no_update ON activity_logs;
CREATE TRIGGER activity_log_no_update
    BEFORE UPDATE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_activity_log_update();

-- 6. Prevent deletes from audit logs (except by service role for cleanup)
CREATE OR REPLACE FUNCTION prevent_activity_log_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow service_role to delete (for data retention cleanup)
    IF current_setting('role') != 'service_role' THEN
        RAISE EXCEPTION 'Activity logs cannot be deleted. Audit trail must remain immutable.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

DROP TRIGGER IF EXISTS activity_log_no_delete ON activity_logs;
CREATE TRIGGER activity_log_no_delete
    BEFORE DELETE ON activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_activity_log_delete();

-- 7. Function to verify integrity of a specific log entry
CREATE OR REPLACE FUNCTION verify_activity_log_integrity(log_id UUID)
RETURNS TABLE(
    is_valid BOOLEAN,
    stored_hash TEXT,
    computed_hash TEXT
) AS $$
DECLARE
    log_record RECORD;
    hash_input TEXT;
    computed TEXT;
BEGIN
    SELECT * INTO log_record FROM public.activity_logs WHERE id = log_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- Recompute hash
    hash_input := COALESCE(log_record.id::TEXT, '') || '|' ||
                  COALESCE(log_record.company_id::TEXT, '') || '|' ||
                  COALESCE(log_record.event_type, '') || '|' ||
                  COALESCE(log_record.title, '') || '|' ||
                  COALESCE(log_record.description, '') || '|' ||
                  COALESCE(log_record.related_id::TEXT, '') || '|' ||
                  COALESCE(log_record.related_type, '') || '|' ||
                  COALESCE(log_record.created_at::TEXT, '') || '|' ||
                  COALESCE(log_record.actor_id::TEXT, '');

    computed := encode(sha256(hash_input::bytea), 'hex');

    RETURN QUERY SELECT
        (log_record.integrity_hash = computed),
        log_record.integrity_hash,
        computed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- 8. Function to verify all logs for a company (batch integrity check)
CREATE OR REPLACE FUNCTION verify_company_audit_logs(p_company_id UUID)
RETURNS TABLE(
    total_logs BIGINT,
    valid_logs BIGINT,
    invalid_logs BIGINT,
    missing_hash BIGINT
) AS $$
DECLARE
    log_record RECORD;
    hash_input TEXT;
    computed TEXT;
    v_total BIGINT := 0;
    v_valid BIGINT := 0;
    v_invalid BIGINT := 0;
    v_missing BIGINT := 0;
BEGIN
    FOR log_record IN
        SELECT * FROM public.activity_logs WHERE company_id = p_company_id
    LOOP
        v_total := v_total + 1;

        IF log_record.integrity_hash IS NULL THEN
            v_missing := v_missing + 1;
            CONTINUE;
        END IF;

        -- Recompute hash
        hash_input := COALESCE(log_record.id::TEXT, '') || '|' ||
                      COALESCE(log_record.company_id::TEXT, '') || '|' ||
                      COALESCE(log_record.event_type, '') || '|' ||
                      COALESCE(log_record.title, '') || '|' ||
                      COALESCE(log_record.description, '') || '|' ||
                      COALESCE(log_record.related_id::TEXT, '') || '|' ||
                      COALESCE(log_record.related_type, '') || '|' ||
                      COALESCE(log_record.created_at::TEXT, '') || '|' ||
                      COALESCE(log_record.actor_id::TEXT, '');

        computed := encode(sha256(hash_input::bytea), 'hex');

        IF log_record.integrity_hash = computed THEN
            v_valid := v_valid + 1;
        ELSE
            v_invalid := v_invalid + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_total, v_valid, v_invalid, v_missing;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- 9. Index on integrity_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_hash ON activity_logs(integrity_hash);

-- 10. Backfill hashes for existing records (one-time operation)
-- Note: Existing records won't have actor_id, so we just hash what's available
UPDATE activity_logs
SET integrity_hash = encode(sha256((
    COALESCE(id::TEXT, '') || '|' ||
    COALESCE(company_id::TEXT, '') || '|' ||
    COALESCE(event_type, '') || '|' ||
    COALESCE(title, '') || '|' ||
    COALESCE(description, '') || '|' ||
    COALESCE(related_id::TEXT, '') || '|' ||
    COALESCE(related_type, '') || '|' ||
    COALESCE(created_at::TEXT, '') || '|' ||
    COALESCE(actor_id::TEXT, '')
)::bytea), 'hex')
WHERE integrity_hash IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN activity_logs.integrity_hash IS 'SHA-256 hash of key fields for tamper detection';
COMMENT ON COLUMN activity_logs.actor_id IS 'User who performed the action';
COMMENT ON FUNCTION verify_activity_log_integrity(UUID) IS 'Verify integrity of a single audit log entry';
COMMENT ON FUNCTION verify_company_audit_logs(UUID) IS 'Batch verify all audit logs for a company';
