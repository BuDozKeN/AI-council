# AxCouncil Webhook System - Implementation Plan v2.0

> **Version:** 2.0
> **Created:** 2026-01-29
> **Updated:** 2026-02-05
> **Status:** Specialist-Reviewed, Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Progress Tracker](#progress-tracker)
4. [Phase 1: Database Schema](#phase-1-database-schema)
5. [Phase 2: Core Security](#phase-2-core-security)
6. [Phase 3: Delivery Infrastructure](#phase-3-delivery-infrastructure)
7. [Phase 4: API Endpoints](#phase-4-api-endpoints)
8. [Phase 5: Event Registry & Emitters](#phase-5-event-registry--emitters)
9. [Phase 6: Access Control & Feature Gating](#phase-6-access-control--feature-gating)
10. [Phase 7: Frontend UI](#phase-7-frontend-ui)
11. [Phase 8: Delivery Inspector UI](#phase-8-delivery-inspector-ui)
12. [Phase 9: Documentation & Developer Portal](#phase-9-documentation--developer-portal)
13. [Phase 10: Testing](#phase-10-testing)
14. [Phase 11: Monitoring & Alerting](#phase-11-monitoring--alerting)
15. [Phase 12: Deployment & Rollout](#phase-12-deployment--rollout)
16. [Phase 13: MCP Server (Future)](#phase-13-mcp-server-future)
17. [Rollback Procedures](#rollback-procedures)
18. [API Reference](#api-reference)

---

## Overview

### What We're Building

A universal, enterprise-grade outgoing webhook system that enables AxCouncil to send events to:
- Zapier (with native REST Hooks support)
- Make (Integromat)
- n8n
- Custom endpoints
- Any HTTP endpoint

### Key Principles

1. **Multi-tenant**: Each company manages their own webhooks with RLS isolation
2. **Secure**: HMAC-SHA256 with timestamp (replay-safe), SSRF protection, header injection prevention
3. **Reliable**: Redis-backed queue, circuit breakers, exponential backoff with jitter
4. **Configurable**: All limits database-driven, not hardcoded. White-label ready.
5. **GDPR Compliant**: Reference IDs by default, configurable PII enrichment with consent
6. **Documented**: Full developer portal with examples in 5+ languages

### Changes from v1.0

| Area | v1.0 | v2.0 |
|------|------|------|
| RLS Pattern | Owner-only (broken) | `is_company_member()` / `is_company_admin()` |
| Events | 6 | 40+ across all features |
| Security | Basic HMAC | HMAC + timestamp + SSRF + header validation |
| Delivery | `asyncio.create_task` (lost on restart) | Redis queue (persistent) |
| Retries | Fixed delays | Exponential backoff with jitter |
| Connection | New client per request | Shared pooled client |
| Circuit Breaker | None | Per-endpoint breakers |
| Access Control | None | Configurable per company |
| GDPR | PII in payloads | Reference IDs + opt-in enrichment |
| Phases | 7 | 13 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AxCouncil                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Action (Save Decision, Complete Council, etc.)                        │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Event Emitter                                     │    │
│  │  • Validates company has webhook feature enabled                     │    │
│  │  • Builds payload (IDs by default, enriched if opted-in)            │    │
│  │  • Queues to Redis sorted set                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Redis Delivery Queue                              │    │
│  │  • ZADD with score = delivery timestamp                              │    │
│  │  • Survives server restarts                                          │    │
│  │  • Supports delayed retries                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Delivery Worker                                   │    │
│  │  • Polls Redis for due deliveries                                    │    │
│  │  • Checks circuit breaker state                                      │    │
│  │  • Validates URL (SSRF protection)                                   │    │
│  │  • Signs payload with HMAC-SHA256 (timestamp in signature)           │    │
│  │  • Sends via shared httpx client (connection pooling)                │    │
│  │  • Records result, schedules retry if needed                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                                                                    │
│         ▼                                                                    │
│  External Services (Zapier, Make, n8n, Custom)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Payload Structure (GDPR-Safe Default)

```json
{
  "event": "decision.saved",
  "event_id": "evt_abc123",
  "timestamp": "2026-01-29T10:30:00Z",
  "api_version": "2026-01",
  "data": {
    "decision_id": "dec_xyz",
    "company_id": "cmp_123",
    "user_id": "usr_456"
  }
}
```

### Payload Structure (Enriched - Opt-in)

```json
{
  "event": "decision.saved",
  "event_id": "evt_abc123",
  "timestamp": "2026-01-29T10:30:00Z",
  "api_version": "2026-01",
  "data": {
    "decision": {
      "id": "dec_xyz",
      "title": "Q1 Marketing Strategy",
      "content": "The council recommends...",
      "department": "Marketing",
      "tags": ["strategy", "q1-2026"]
    },
    "user": {
      "id": "usr_456",
      "email": "user@company.com",
      "name": "John Smith"
    }
  }
}
```

### Security Headers

```
Content-Type: application/json
User-Agent: AxCouncil-Webhooks/2.0
X-AxCouncil-Event: decision.saved
X-AxCouncil-Signature: t=1706522400,v1=abc123...
X-AxCouncil-Delivery: dlv_xyz789
X-AxCouncil-Timestamp: 2026-01-29T10:30:00Z
```

**Signature format**: `t={unix_timestamp},v1={hmac_hex}`

The signature is computed over: `{timestamp}.{payload_json}`

---

## Progress Tracker

### Phase 1: Database Schema
- [ ] 1.1 Create migration file
- [ ] 1.2 Apply migration to development
- [ ] 1.3 Verify tables created
- [ ] 1.4 Verify RLS policies active
- [ ] 1.5 Verify helper functions work
- [ ] 1.6 Verify event types seeded
- [ ] **CHECKPOINT 1**: Database ready ✓

### Phase 2: Core Security
- [ ] 2.1 Create SSRF validator module
- [ ] 2.2 Create replay-safe signing module
- [ ] 2.3 Create header validator
- [ ] 2.4 Test security functions
- [ ] **CHECKPOINT 2**: Security layer ready ✓

### Phase 3: Delivery Infrastructure
- [ ] 3.1 Create Redis queue module
- [ ] 3.2 Create shared HTTP client
- [ ] 3.3 Create circuit breaker
- [ ] 3.4 Create delivery worker
- [ ] 3.5 Test delivery pipeline
- [ ] **CHECKPOINT 3**: Delivery infrastructure ready ✓

### Phase 4: API Endpoints
- [ ] 4.1 Create webhook router
- [ ] 4.2 Add Zapier REST Hooks endpoints
- [ ] 4.3 Register router
- [ ] 4.4 Test endpoints
- [ ] 4.5 Add frontend API client methods
- [ ] **CHECKPOINT 4**: API ready ✓

### Phase 5: Event Registry & Emitters
- [ ] 5.1 Create event emitter module
- [ ] 5.2 Hook into conversations
- [ ] 5.3 Hook into decisions/knowledge
- [ ] 5.4 Hook into projects
- [ ] 5.5 Hook into team/members
- [ ] 5.6 Hook into remaining features
- [ ] 5.7 Test all events fire correctly
- [ ] **CHECKPOINT 5**: Events firing ✓

### Phase 6: Access Control & Feature Gating
- [ ] 6.1 Create feature check functions
- [ ] 6.2 Add middleware for webhook endpoints
- [ ] 6.3 Create admin override capability
- [ ] 6.4 Test access control
- [ ] **CHECKPOINT 6**: Access control ready ✓

### Phase 7: Frontend UI
- [ ] 7.1 Create WebhooksSection component
- [ ] 7.2 Create useWebhooks hook
- [ ] 7.3 Create WebhookForm component
- [ ] 7.4 Add to Settings modal
- [ ] 7.5 Test UI functionality
- [ ] **CHECKPOINT 7**: UI ready ✓

### Phase 8: Delivery Inspector UI
- [ ] 8.1 Create DeliveryInspector component
- [ ] 8.2 Add request/response viewer
- [ ] 8.3 Add retry functionality
- [ ] 8.4 Test inspector
- [ ] **CHECKPOINT 8**: Inspector ready ✓

### Phase 9: Documentation
- [ ] 9.1 Create signature verification examples
- [ ] 9.2 Create event catalog
- [ ] 9.3 Create admin guide
- [ ] 9.4 Generate OpenAPI spec
- [ ] **CHECKPOINT 9**: Docs ready ✓

### Phase 10: Testing
- [ ] 10.1 Write unit tests
- [ ] 10.2 Write integration tests
- [ ] 10.3 Write E2E tests
- [ ] 10.4 All tests passing
- [ ] **CHECKPOINT 10**: Tests passing ✓

### Phase 11: Monitoring & Alerting
- [ ] 11.1 Add failure tracking
- [ ] 11.2 Add auto-disable logic
- [ ] 11.3 Add health endpoint
- [ ] 11.4 Test monitoring
- [ ] **CHECKPOINT 11**: Monitoring ready ✓

### Phase 12: Deployment
- [ ] 12.1 Set environment variables
- [ ] 12.2 Apply migration to production
- [ ] 12.3 Deploy with feature flag
- [ ] 12.4 Gradual rollout
- [ ] 12.5 Full release
- [ ] **CHECKPOINT 12**: Live ✓

### Phase 13: MCP Server (Future)
- [ ] 13.1 Architecture documented
- [ ] 13.2 Implementation (future sprint)

---

## Phase 1: Database Schema

### 1.1 Create Migration File

**File:** `supabase/migrations/20260205000000_webhook_system_v2.sql`

```sql
-- ============================================================================
-- WEBHOOK SYSTEM v2.0 SCHEMA
-- ============================================================================
-- Purpose: Enterprise-grade outgoing webhooks with multi-tenant isolation
-- Security: RLS via is_company_member()/is_company_admin(), encrypted secrets
-- GDPR: Reference IDs by default, configurable enrichment
-- ============================================================================

-- ============================================================================
-- 1. WEBHOOK FEATURES TABLE (Configurable per company)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Feature toggles (all configurable, not hardcoded)
    is_enabled BOOLEAN DEFAULT false,
    max_endpoints INTEGER DEFAULT 10,
    max_events_per_day INTEGER DEFAULT 10000,

    -- GDPR settings
    allow_pii_enrichment BOOLEAN DEFAULT false,
    pii_consent_accepted_at TIMESTAMPTZ,
    pii_consent_accepted_by UUID REFERENCES auth.users(id),

    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,

    -- White-label settings
    custom_user_agent TEXT,
    custom_header_prefix TEXT DEFAULT 'X-AxCouncil',

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT webhook_features_company_unique UNIQUE (company_id)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_webhook_features_company
    ON public.webhook_features(company_id);

-- ============================================================================
-- 2. WEBHOOK EVENT TYPES TABLE (Reference catalog)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_event_types (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    payload_schema JSONB,
    payload_example JSONB,
    is_active BOOLEAN DEFAULT true,
    version VARCHAR(20) DEFAULT '2026-01',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. COMPANY WEBHOOKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Configuration
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,

    -- Event subscriptions
    event_types TEXT[] NOT NULL,

    -- Security (encrypted with company-derived key)
    secret_encrypted BYTEA NOT NULL,
    secret_suffix VARCHAR(8) NOT NULL,
    secret_version INTEGER DEFAULT 1,

    -- GDPR: Override company setting per endpoint
    include_enriched_data BOOLEAN DEFAULT false,

    -- Optional filtering
    filter_department_ids UUID[],
    filter_tags TEXT[],

    -- Custom headers (validated - no dangerous headers)
    custom_headers JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,

    -- Circuit breaker state
    consecutive_failures INTEGER DEFAULT 0,
    disabled_reason TEXT,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,

    -- Zapier REST Hooks support
    zapier_subscription_id TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT valid_webhook_url CHECK (url ~ '^https://'),
    CONSTRAINT valid_event_types CHECK (array_length(event_types, 1) > 0),
    CONSTRAINT valid_custom_headers CHECK (
        NOT (custom_headers ?| ARRAY['host', 'authorization', 'content-length', 'transfer-encoding'])
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_webhooks_company
    ON public.company_webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_company_webhooks_active
    ON public.company_webhooks(company_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_company_webhooks_events
    ON public.company_webhooks USING GIN(event_types);
CREATE INDEX IF NOT EXISTS idx_company_webhooks_zapier
    ON public.company_webhooks(zapier_subscription_id) WHERE zapier_subscription_id IS NOT NULL;

-- ============================================================================
-- 4. WEBHOOK DELIVERIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    webhook_id UUID NOT NULL REFERENCES public.company_webhooks(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_id UUID NOT NULL,
    payload JSONB NOT NULL,

    -- Delivery status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 8,

    -- Response details
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    response_time_ms INTEGER,

    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),

    -- Timing
    created_at TIMESTAMPTZ DEFAULT now(),
    next_retry_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Idempotency
    idempotency_key VARCHAR(100),

    CONSTRAINT valid_delivery_status CHECK (
        status IN ('pending', 'queued', 'success', 'failed', 'retrying', 'dead_letter')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_company
    ON public.webhook_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook
    ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
    ON public.webhook_deliveries(status, next_retry_at)
    WHERE status IN ('pending', 'queued', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event
    ON public.webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_idempotency
    ON public.webhook_deliveries(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.webhook_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- webhook_features: Admins can manage, members can view
CREATE POLICY "webhook_features_select" ON public.webhook_features
    FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "webhook_features_insert" ON public.webhook_features
    FOR INSERT WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "webhook_features_update" ON public.webhook_features
    FOR UPDATE USING (public.is_company_admin(company_id));

CREATE POLICY "webhook_features_delete" ON public.webhook_features
    FOR DELETE USING (public.is_company_admin(company_id));

-- webhook_event_types: All authenticated users can read
CREATE POLICY "webhook_event_types_select" ON public.webhook_event_types
    FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- company_webhooks: Admins can manage, members can view
CREATE POLICY "company_webhooks_select" ON public.company_webhooks
    FOR SELECT USING (public.is_company_member(company_id));

CREATE POLICY "company_webhooks_insert" ON public.company_webhooks
    FOR INSERT WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY "company_webhooks_update" ON public.company_webhooks
    FOR UPDATE USING (public.is_company_admin(company_id));

CREATE POLICY "company_webhooks_delete" ON public.company_webhooks
    FOR DELETE USING (public.is_company_admin(company_id));

-- webhook_deliveries: Members can view their company's deliveries
CREATE POLICY "webhook_deliveries_select" ON public.webhook_deliveries
    FOR SELECT USING (public.is_company_member(company_id));

-- Service role bypass for backend operations
CREATE POLICY "webhook_features_service" ON public.webhook_features
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "company_webhooks_service" ON public.company_webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "webhook_deliveries_service" ON public.webhook_deliveries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Check if company has webhooks enabled
CREATE OR REPLACE FUNCTION public.company_webhooks_enabled(p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.webhook_features
        WHERE company_id = p_company_id AND is_enabled = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Get active webhooks for an event (used by backend service role)
CREATE OR REPLACE FUNCTION public.get_webhooks_for_event(
    p_company_id UUID,
    p_event_type TEXT,
    p_department_id UUID DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    webhook_id UUID,
    url TEXT,
    secret_encrypted BYTEA,
    custom_headers JSONB,
    include_enriched_data BOOLEAN,
    custom_header_prefix TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cw.id AS webhook_id,
        cw.url,
        cw.secret_encrypted,
        cw.custom_headers,
        cw.include_enriched_data,
        COALESCE(wf.custom_header_prefix, 'X-AxCouncil') AS custom_header_prefix
    FROM public.company_webhooks cw
    LEFT JOIN public.webhook_features wf ON wf.company_id = cw.company_id
    WHERE cw.company_id = p_company_id
      AND cw.is_active = true
      AND cw.consecutive_failures < 10
      AND p_event_type = ANY(cw.event_types)
      AND (cw.filter_department_ids IS NULL OR p_department_id = ANY(cw.filter_department_ids))
      AND (cw.filter_tags IS NULL OR cw.filter_tags && p_tags);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Restrict to service role only
REVOKE EXECUTE ON FUNCTION public.get_webhooks_for_event FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_webhooks_for_event TO service_role;

-- Update webhook failure count
CREATE OR REPLACE FUNCTION public.record_webhook_failure(
    p_webhook_id UUID,
    p_error_message TEXT
)
RETURNS void AS $$
BEGIN
    UPDATE public.company_webhooks
    SET
        consecutive_failures = consecutive_failures + 1,
        last_failure_at = now(),
        disabled_reason = CASE
            WHEN consecutive_failures >= 9 THEN 'Auto-disabled: 10 consecutive failures'
            ELSE NULL
        END,
        is_active = CASE
            WHEN consecutive_failures >= 9 THEN false
            ELSE is_active
        END,
        updated_at = now()
    WHERE id = p_webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.record_webhook_failure FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_webhook_failure TO service_role;

-- Reset webhook failure count on success
CREATE OR REPLACE FUNCTION public.record_webhook_success(p_webhook_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.company_webhooks
    SET
        consecutive_failures = 0,
        last_success_at = now(),
        is_verified = true,
        updated_at = now()
    WHERE id = p_webhook_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.record_webhook_success FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_webhook_success TO service_role;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

CREATE TRIGGER webhook_features_updated_at
    BEFORE UPDATE ON public.webhook_features
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

CREATE TRIGGER company_webhooks_updated_at
    BEFORE UPDATE ON public.company_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_webhook_updated_at();

-- ============================================================================
-- 8. SEED EVENT TYPES (40+ events)
-- ============================================================================

INSERT INTO public.webhook_event_types (id, name, description, category, payload_example) VALUES
-- Conversations
('conversation.created', 'Conversation Created', 'New council session started', 'conversations', '{"conversation_id": "uuid"}'),
('conversation.message.sent', 'Message Sent', 'Question sent to the council', 'conversations', '{"conversation_id": "uuid", "message_id": "uuid"}'),
('conversation.stage1.completed', 'Stage 1 Completed', 'All 5 LLMs responded', 'conversations', '{"conversation_id": "uuid"}'),
('conversation.stage2.completed', 'Stage 2 Completed', 'Peer review completed', 'conversations', '{"conversation_id": "uuid"}'),
('conversation.stage3.completed', 'Stage 3 Completed', 'Chairman synthesis completed', 'conversations', '{"conversation_id": "uuid", "synthesis_preview": "string"}'),
('conversation.renamed', 'Conversation Renamed', 'Conversation title changed', 'conversations', '{"conversation_id": "uuid", "new_title": "string"}'),
('conversation.archived', 'Conversation Archived', 'Conversation moved to archive', 'conversations', '{"conversation_id": "uuid"}'),
('conversation.deleted', 'Conversation Deleted', 'Conversation permanently deleted', 'conversations', '{"conversation_id": "uuid"}'),
('conversation.exported', 'Conversation Exported', 'Conversation exported to file', 'conversations', '{"conversation_id": "uuid", "format": "markdown"}'),

-- Decisions
('decision.created', 'Decision Created', 'New decision added to company', 'decisions', '{"decision_id": "uuid"}'),
('decision.saved', 'Decision Saved', 'Council decision saved to knowledge base', 'decisions', '{"decision_id": "uuid", "conversation_id": "uuid"}'),
('decision.updated', 'Decision Updated', 'Decision content modified', 'decisions', '{"decision_id": "uuid"}'),
('decision.archived', 'Decision Archived', 'Decision moved to archive', 'decisions', '{"decision_id": "uuid"}'),
('decision.deleted', 'Decision Deleted', 'Decision permanently deleted', 'decisions', '{"decision_id": "uuid"}'),
('decision.promoted', 'Decision Promoted', 'Decision promoted to playbook/project', 'decisions', '{"decision_id": "uuid", "promoted_to": {"type": "string", "id": "uuid"}}'),
('decision.linked', 'Decision Linked', 'Decision linked to project', 'decisions', '{"decision_id": "uuid", "project_id": "uuid"}'),

-- Projects
('project.created', 'Project Created', 'New project created', 'projects', '{"project_id": "uuid"}'),
('project.updated', 'Project Updated', 'Project details modified', 'projects', '{"project_id": "uuid"}'),
('project.deleted', 'Project Deleted', 'Project permanently deleted', 'projects', '{"project_id": "uuid"}'),
('project.context.updated', 'Project Context Updated', 'Project context regenerated', 'projects', '{"project_id": "uuid"}'),
('project.decision.merged', 'Decision Merged to Project', 'Decision content merged into project', 'projects', '{"project_id": "uuid", "decision_id": "uuid"}'),

-- Playbooks
('playbook.created', 'Playbook Created', 'New playbook created', 'playbooks', '{"playbook_id": "uuid"}'),
('playbook.updated', 'Playbook Updated', 'Playbook content modified', 'playbooks', '{"playbook_id": "uuid"}'),
('playbook.deleted', 'Playbook Deleted', 'Playbook permanently deleted', 'playbooks', '{"playbook_id": "uuid"}'),

-- Team
('team.member.invited', 'Member Invited', 'New team member invitation sent', 'team', '{"invitation_id": "uuid", "email": "string"}'),
('team.member.joined', 'Member Joined', 'Invited member accepted and joined', 'team', '{"member_id": "uuid"}'),
('team.member.removed', 'Member Removed', 'Team member removed from company', 'team', '{"member_id": "uuid"}'),
('team.member.role.changed', 'Member Role Changed', 'Team member role updated', 'team', '{"member_id": "uuid", "new_role": "string"}'),

-- Departments
('department.created', 'Department Created', 'New department added', 'departments', '{"department_id": "uuid"}'),
('department.updated', 'Department Updated', 'Department settings changed', 'departments', '{"department_id": "uuid"}'),
('department.deleted', 'Department Deleted', 'Department removed', 'departments', '{"department_id": "uuid"}'),

-- Roles
('role.created', 'Role Created', 'New AI persona role created', 'roles', '{"role_id": "uuid"}'),
('role.updated', 'Role Updated', 'AI persona role modified', 'roles', '{"role_id": "uuid"}'),
('role.deleted', 'Role Deleted', 'AI persona role removed', 'roles', '{"role_id": "uuid"}'),

-- Company
('company.context.updated', 'Company Context Updated', 'Company context modified', 'company', '{"company_id": "uuid"}'),
('company.settings.updated', 'Company Settings Updated', 'Company settings changed', 'company', '{"company_id": "uuid"}'),

-- Billing
('subscription.created', 'Subscription Created', 'New subscription started', 'billing', '{"subscription_id": "string"}'),
('subscription.updated', 'Subscription Updated', 'Subscription plan changed', 'billing', '{"subscription_id": "string", "new_plan": "string"}'),
('subscription.cancelled', 'Subscription Cancelled', 'Subscription cancelled', 'billing', '{"subscription_id": "string"}'),
('payment.succeeded', 'Payment Succeeded', 'Payment processed successfully', 'billing', '{"payment_id": "string"}'),
('payment.failed', 'Payment Failed', 'Payment processing failed', 'billing', '{"payment_id": "string"}'),

-- Attachments
('attachment.uploaded', 'Attachment Uploaded', 'File uploaded to conversation', 'attachments', '{"attachment_id": "uuid", "conversation_id": "uuid"}'),
('attachment.deleted', 'Attachment Deleted', 'File removed from conversation', 'attachments', '{"attachment_id": "uuid"}'),

-- Webhooks (meta)
('webhook.test', 'Webhook Test', 'Test ping from AxCouncil', 'system', '{"message": "Test webhook"}'),
('webhook.disabled', 'Webhook Disabled', 'Webhook auto-disabled due to failures', 'system', '{"webhook_id": "uuid", "reason": "string"}')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    payload_example = EXCLUDED.payload_example;

-- ============================================================================
-- 9. VERIFICATION
-- ============================================================================

DO $$
DECLARE
    table_count INTEGER;
    event_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('webhook_features', 'webhook_event_types', 'company_webhooks', 'webhook_deliveries');

    IF table_count != 4 THEN
        RAISE EXCEPTION 'Expected 4 webhook tables, found %', table_count;
    END IF;

    -- Count event types
    SELECT COUNT(*) INTO event_count FROM public.webhook_event_types;

    IF event_count < 40 THEN
        RAISE EXCEPTION 'Expected 40+ event types, found %', event_count;
    END IF;

    -- Verify RLS enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'company_webhooks' AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS not enabled on company_webhooks';
    END IF;

    RAISE NOTICE '✓ Webhook v2.0 schema verified: % tables, % event types', table_count, event_count;
END;
$$;
```

### 1.2-1.6 Verification Commands

```bash
# Apply migration
cd supabase && supabase db push

# Verify tables
psql -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'webhook%';"

# Verify event types count
psql -c "SELECT COUNT(*) FROM webhook_event_types;"

# Verify RLS
psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE '%webhook%';"
```

### ✅ CHECKPOINT 1: Database Ready

- [ ] 4 tables created
- [ ] RLS enabled with correct policies
- [ ] 40+ event types seeded
- [ ] Helper functions created and restricted to service_role
- [ ] Triggers working

---

## Phase 2: Core Security

### 2.1 SSRF Validator Module

**File:** `backend/webhooks/security.py`

```python
"""
Webhook Security Module

SSRF protection, header validation, replay-safe signing.
"""

import hmac
import hashlib
import ipaddress
import re
import socket
import time
from typing import Optional, Tuple, Set
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

# Blocked IP ranges (SSRF protection)
BLOCKED_IP_RANGES = [
    ipaddress.ip_network('127.0.0.0/8'),      # Loopback
    ipaddress.ip_network('10.0.0.0/8'),       # Private
    ipaddress.ip_network('172.16.0.0/12'),    # Private
    ipaddress.ip_network('192.168.0.0/16'),   # Private
    ipaddress.ip_network('169.254.0.0/16'),   # Link-local (AWS metadata)
    ipaddress.ip_network('::1/128'),          # IPv6 loopback
    ipaddress.ip_network('fc00::/7'),         # IPv6 private
    ipaddress.ip_network('fe80::/10'),        # IPv6 link-local
]

# Blocked hostnames
BLOCKED_HOSTNAMES = {
    'localhost',
    'metadata.google.internal',
    'metadata.aws.internal',
}

# Dangerous headers that must never be set
BLOCKED_HEADERS = {
    'host',
    'authorization',
    'content-length',
    'transfer-encoding',
    'content-encoding',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'upgrade',
}

# Replay protection window (5 minutes)
TIMESTAMP_TOLERANCE_SECONDS = 300


def validate_webhook_url(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate webhook URL for SSRF protection.

    Returns:
        (is_valid, error_message)
    """
    if not url:
        return False, "URL is required"

    if len(url) > 2048:
        return False, "URL too long (max 2048 characters)"

    # Must be HTTPS in production
    if not url.startswith('https://'):
        return False, "URL must use HTTPS"

    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must have a hostname"

    # Check blocked hostnames
    hostname_lower = hostname.lower()
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Hostname '{hostname}' is not allowed"

    # Check for IP address in hostname
    try:
        ip = ipaddress.ip_address(hostname)
        for blocked_range in BLOCKED_IP_RANGES:
            if ip in blocked_range:
                return False, f"IP address {ip} is in a blocked range"
    except ValueError:
        # Not an IP address, resolve it
        pass

    # DNS resolution check (prevent DNS rebinding)
    try:
        resolved_ips = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC)
        for family, _, _, _, sockaddr in resolved_ips:
            ip_str = sockaddr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
                for blocked_range in BLOCKED_IP_RANGES:
                    if ip in blocked_range:
                        return False, f"Hostname resolves to blocked IP {ip}"
            except ValueError:
                continue
    except socket.gaierror:
        return False, f"Cannot resolve hostname '{hostname}'"

    return True, None


def validate_custom_headers(headers: dict) -> Tuple[bool, Optional[str]]:
    """
    Validate custom headers for injection protection.

    Returns:
        (is_valid, error_message)
    """
    if not headers:
        return True, None

    if len(headers) > 10:
        return False, "Maximum 10 custom headers allowed"

    for key, value in headers.items():
        key_lower = key.lower()

        # Check blocked headers
        if key_lower in BLOCKED_HEADERS:
            return False, f"Header '{key}' is not allowed"

        # Check header name format
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9\-]*$', key):
            return False, f"Invalid header name format: '{key}'"

        # Check value for injection attempts
        if '\n' in value or '\r' in value:
            return False, f"Header '{key}' contains invalid characters"

        # Limit value length
        if len(value) > 500:
            return False, f"Header '{key}' value too long (max 500 characters)"

    return True, None


def sign_payload_with_timestamp(payload: str, secret: str, timestamp: int) -> str:
    """
    Sign payload with HMAC-SHA256 including timestamp (replay-safe).

    Format: t={timestamp},v1={signature}

    The signature is computed over: "{timestamp}.{payload}"
    """
    signed_content = f"{timestamp}.{payload}"
    signature = hmac.new(
        secret.encode(),
        signed_content.encode(),
        hashlib.sha256
    ).hexdigest()

    return f"t={timestamp},v1={signature}"


def verify_signature(
    payload: str,
    signature_header: str,
    secret: str,
    tolerance_seconds: int = TIMESTAMP_TOLERANCE_SECONDS
) -> Tuple[bool, Optional[str]]:
    """
    Verify webhook signature with replay protection.

    Returns:
        (is_valid, error_message)
    """
    # Parse signature header
    parts = {}
    for part in signature_header.split(','):
        if '=' in part:
            key, value = part.split('=', 1)
            parts[key.strip()] = value.strip()

    timestamp_str = parts.get('t')
    signature = parts.get('v1')

    if not timestamp_str or not signature:
        return False, "Invalid signature format"

    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False, "Invalid timestamp in signature"

    # Check timestamp is within tolerance (replay protection)
    current_time = int(time.time())
    if abs(current_time - timestamp) > tolerance_seconds:
        return False, f"Timestamp outside tolerance window ({tolerance_seconds}s)"

    # Compute expected signature
    signed_content = f"{timestamp}.{payload}"
    expected = hmac.new(
        secret.encode(),
        signed_content.encode(),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison (prevent timing attacks)
    if not hmac.compare_digest(signature, expected):
        return False, "Signature mismatch"

    return True, None


def mask_secret(secret: str) -> str:
    """Mask a secret for logging (shows only last 4 chars)."""
    if len(secret) <= 8:
        return "••••••••"
    return f"••••••••{secret[-4:]}"
```

### 2.2 Encryption Module

**File:** `backend/webhooks/crypto.py`

```python
"""
Webhook Cryptography Module

Encrypts webhook secrets using company-derived keys.
"""

import secrets
import os
from typing import Tuple
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import logging

logger = logging.getLogger(__name__)

WEBHOOK_ENCRYPTION_SECRET = os.getenv(
    "WEBHOOK_ENCRYPTION_SECRET",
    os.getenv("USER_KEY_ENCRYPTION_SECRET")
)

if not WEBHOOK_ENCRYPTION_SECRET:
    raise ValueError(
        "WEBHOOK_ENCRYPTION_SECRET or USER_KEY_ENCRYPTION_SECRET required"
    )


def _derive_company_key(company_id: str, version: int = 1) -> bytes:
    """
    Derive encryption key for a company using HKDF.

    Version parameter supports key rotation.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=f"axcouncil-webhooks-v{version}".encode(),
        info=f"company_webhook:{company_id}".encode(),
        backend=default_backend()
    )
    return hkdf.derive(WEBHOOK_ENCRYPTION_SECRET.encode())


def generate_webhook_secret() -> str:
    """Generate a new webhook signing secret."""
    return f"whsec_{secrets.token_urlsafe(32)}"


def encrypt_webhook_secret(
    secret: str,
    company_id: str,
    version: int = 1
) -> Tuple[bytes, str]:
    """
    Encrypt webhook secret for database storage.

    Returns:
        (encrypted_bytes, display_suffix)
    """
    key = _derive_company_key(company_id, version)
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)

    encrypted = aesgcm.encrypt(nonce, secret.encode(), None)
    encrypted_with_nonce = nonce + encrypted

    suffix = secret[-4:] if len(secret) >= 4 else secret

    return encrypted_with_nonce, suffix


def decrypt_webhook_secret(
    encrypted: bytes,
    company_id: str,
    version: int = 1
) -> str:
    """Decrypt webhook secret from database."""
    key = _derive_company_key(company_id, version)
    aesgcm = AESGCM(key)

    nonce = encrypted[:12]
    ciphertext = encrypted[12:]

    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode()
```

### ✅ CHECKPOINT 2: Security Layer Ready

- [ ] SSRF validator blocks internal IPs
- [ ] Header validator blocks dangerous headers
- [ ] Signature includes timestamp (replay-safe)
- [ ] Encryption with key versioning works

---

## Phase 3: Delivery Infrastructure

### 3.1 Redis Queue Module

**File:** `backend/webhooks/queue.py`

```python
"""
Redis-backed Webhook Delivery Queue

Survives server restarts. Uses sorted set for delayed retries.
"""

import json
import time
from typing import Optional, List, Dict, Any
from uuid import uuid4
import logging

from backend.cache import get_redis
from backend.openrouter import calculate_backoff_with_jitter

logger = logging.getLogger(__name__)

QUEUE_KEY = "webhook:deliveries"
PROCESSING_KEY = "webhook:processing"
MAX_RETRIES = 8


class WebhookQueue:
    """Redis-backed delivery queue."""

    async def enqueue(
        self,
        delivery_id: str,
        webhook_id: str,
        company_id: str,
        url: str,
        payload: Dict[str, Any],
        secret_encrypted: bytes,
        custom_headers: Dict[str, str],
        include_enriched: bool,
        header_prefix: str,
        delay_seconds: float = 0
    ) -> bool:
        """Add delivery to queue."""
        redis = await get_redis()
        if not redis:
            logger.error("Redis unavailable - delivery will be lost")
            return False

        delivery_data = {
            "delivery_id": delivery_id,
            "webhook_id": webhook_id,
            "company_id": company_id,
            "url": url,
            "payload": payload,
            "secret_encrypted": secret_encrypted.hex(),
            "custom_headers": custom_headers,
            "include_enriched": include_enriched,
            "header_prefix": header_prefix,
            "attempt": 0,
            "created_at": time.time()
        }

        score = time.time() + delay_seconds

        await redis.zadd(
            QUEUE_KEY,
            {json.dumps(delivery_data): score}
        )

        logger.debug(f"Enqueued delivery {delivery_id} for {score}")
        return True

    async def dequeue_batch(self, batch_size: int = 10) -> List[Dict[str, Any]]:
        """Get deliveries ready for processing."""
        redis = await get_redis()
        if not redis:
            return []

        now = time.time()

        # Get items with score <= now
        items = await redis.zrangebyscore(
            QUEUE_KEY,
            min=0,
            max=now,
            start=0,
            num=batch_size
        )

        deliveries = []
        for item in items:
            try:
                data = json.loads(item)
                # Move to processing set
                await redis.zrem(QUEUE_KEY, item)
                await redis.sadd(PROCESSING_KEY, item)
                deliveries.append(data)
            except json.JSONDecodeError:
                logger.error(f"Invalid delivery data in queue: {item[:100]}")
                await redis.zrem(QUEUE_KEY, item)

        return deliveries

    async def complete(self, delivery_data: Dict[str, Any]) -> None:
        """Mark delivery as complete (remove from processing)."""
        redis = await get_redis()
        if not redis:
            return

        await redis.srem(PROCESSING_KEY, json.dumps(delivery_data))

    async def retry(
        self,
        delivery_data: Dict[str, Any],
        attempt: int
    ) -> bool:
        """Schedule retry with exponential backoff + jitter."""
        if attempt >= MAX_RETRIES:
            logger.warning(f"Max retries reached for {delivery_data['delivery_id']}")
            return False

        redis = await get_redis()
        if not redis:
            return False

        # Remove from processing
        await redis.srem(PROCESSING_KEY, json.dumps(delivery_data))

        # Calculate delay with jitter
        delay = calculate_backoff_with_jitter(
            attempt,
            base_delay=60.0,
            max_delay=3600.0,
            jitter_factor=0.3
        )

        # Update attempt count
        delivery_data["attempt"] = attempt

        # Re-queue with delay
        score = time.time() + delay
        await redis.zadd(QUEUE_KEY, {json.dumps(delivery_data): score})

        logger.info(
            f"Scheduled retry {attempt + 1} for {delivery_data['delivery_id']} "
            f"in {delay:.0f}s"
        )
        return True

    async def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics."""
        redis = await get_redis()
        if not redis:
            return {"pending": 0, "processing": 0}

        pending = await redis.zcard(QUEUE_KEY)
        processing = await redis.scard(PROCESSING_KEY)

        return {
            "pending": pending,
            "processing": processing
        }


# Global instance
webhook_queue = WebhookQueue()
```

### 3.2 Delivery Worker

**File:** `backend/webhooks/worker.py`

```python
"""
Webhook Delivery Worker

Processes deliveries from Redis queue with circuit breakers.
"""

import asyncio
import json
import time
from typing import Dict, Any, Optional
import httpx
import logging

from backend.webhooks.queue import webhook_queue, MAX_RETRIES
from backend.webhooks.crypto import decrypt_webhook_secret
from backend.webhooks.security import (
    sign_payload_with_timestamp,
    validate_webhook_url,
    mask_secret
)
from backend.openrouter import CircuitBreaker
from backend.database import get_service_client

logger = logging.getLogger(__name__)

# Shared HTTP client (connection pooling)
_http_client: Optional[httpx.AsyncClient] = None

# Circuit breakers per webhook endpoint
_circuit_breakers: Dict[str, CircuitBreaker] = {}

DELIVERY_TIMEOUT = 20.0
MAX_PAYLOAD_SIZE = 256 * 1024  # 256KB


def get_http_client() -> httpx.AsyncClient:
    """Get shared HTTP client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(DELIVERY_TIMEOUT, connect=10.0),
            limits=httpx.Limits(
                max_connections=50,
                max_keepalive_connections=20,
                keepalive_expiry=30.0
            ),
            http2=True
        )
    return _http_client


def get_circuit_breaker(webhook_id: str) -> CircuitBreaker:
    """Get or create circuit breaker for a webhook."""
    if webhook_id not in _circuit_breakers:
        _circuit_breakers[webhook_id] = CircuitBreaker(
            name=f"webhook:{webhook_id[:8]}",
            failure_threshold=5,
            recovery_timeout=120.0,
            half_open_max_calls=2
        )
    return _circuit_breakers[webhook_id]


async def process_delivery(delivery_data: Dict[str, Any]) -> bool:
    """
    Process a single webhook delivery.

    Returns True if successful, False if should retry.
    """
    delivery_id = delivery_data["delivery_id"]
    webhook_id = delivery_data["webhook_id"]
    company_id = delivery_data["company_id"]
    url = delivery_data["url"]
    payload = delivery_data["payload"]
    attempt = delivery_data.get("attempt", 0)
    header_prefix = delivery_data.get("header_prefix", "X-AxCouncil")

    # Check circuit breaker
    breaker = get_circuit_breaker(webhook_id)
    if not await breaker.can_execute():
        logger.warning(f"Circuit open for webhook {webhook_id}, skipping")
        return False

    # Validate URL (SSRF check at delivery time)
    is_valid, error = validate_webhook_url(url)
    if not is_valid:
        logger.error(f"Invalid webhook URL: {error}")
        await record_failure(delivery_id, webhook_id, f"Invalid URL: {error}")
        return True  # Don't retry invalid URLs

    # Decrypt secret
    try:
        secret_bytes = bytes.fromhex(delivery_data["secret_encrypted"])
        secret = decrypt_webhook_secret(secret_bytes, company_id)
    except Exception as e:
        logger.error(f"Failed to decrypt secret: {e}")
        await record_failure(delivery_id, webhook_id, "Decryption failed")
        return True  # Don't retry crypto failures

    # Serialize and check size
    payload_json = json.dumps(payload, separators=(",", ":"))
    if len(payload_json) > MAX_PAYLOAD_SIZE:
        logger.warning(f"Payload too large ({len(payload_json)} bytes), truncating")
        payload["_truncated"] = True
        payload_json = json.dumps(payload, separators=(",", ":"))[:MAX_PAYLOAD_SIZE]

    # Sign with timestamp
    timestamp = int(time.time())
    signature = sign_payload_with_timestamp(payload_json, secret, timestamp)

    # Build headers
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "AxCouncil-Webhooks/2.0",
        f"{header_prefix}-Event": payload.get("event", "unknown"),
        f"{header_prefix}-Signature": signature,
        f"{header_prefix}-Delivery": delivery_id,
        f"{header_prefix}-Timestamp": payload.get("timestamp", ""),
    }

    # Add custom headers
    custom_headers = delivery_data.get("custom_headers", {})
    for key, value in custom_headers.items():
        if not key.lower().startswith(("host", "authorization", "content-length")):
            headers[key] = value

    # Send request
    client = get_http_client()
    start_time = time.time()

    try:
        response = await client.post(
            url,
            content=payload_json,
            headers=headers
        )

        response_time_ms = int((time.time() - start_time) * 1000)

        if 200 <= response.status_code < 300:
            # Success
            await breaker.record_success()
            await record_success(
                delivery_id,
                webhook_id,
                response.status_code,
                response.text[:1000],
                response_time_ms
            )
            logger.info(f"Delivered {delivery_id} in {response_time_ms}ms")
            return True
        else:
            # HTTP error
            await breaker.record_failure()
            error_msg = f"HTTP {response.status_code}"
            await record_attempt(
                delivery_id,
                webhook_id,
                attempt,
                response.status_code,
                response.text[:1000],
                response_time_ms,
                error_msg
            )
            logger.warning(f"Delivery failed: {error_msg}")
            return False

    except httpx.TimeoutException:
        await breaker.record_failure()
        await record_attempt(delivery_id, webhook_id, attempt, error="Timeout")
        logger.warning(f"Delivery timeout for {delivery_id}")
        return False

    except httpx.RequestError as e:
        await breaker.record_failure()
        await record_attempt(delivery_id, webhook_id, attempt, error=str(e))
        logger.warning(f"Delivery error: {e}")
        return False


async def record_success(
    delivery_id: str,
    webhook_id: str,
    status_code: int,
    response_body: str,
    response_time_ms: int
) -> None:
    """Record successful delivery."""
    supabase = get_service_client()

    supabase.table("webhook_deliveries").update({
        "status": "success",
        "response_status": status_code,
        "response_body": response_body,
        "response_time_ms": response_time_ms,
        "completed_at": "now()",
        "attempt_count": supabase.raw("attempt_count + 1")
    }).eq("id", delivery_id).execute()

    # Reset webhook failure counter
    supabase.rpc("record_webhook_success", {"p_webhook_id": webhook_id}).execute()


async def record_failure(
    delivery_id: str,
    webhook_id: str,
    error: str
) -> None:
    """Record permanent failure (no retry)."""
    supabase = get_service_client()

    supabase.table("webhook_deliveries").update({
        "status": "failed",
        "error_message": error,
        "completed_at": "now()"
    }).eq("id", delivery_id).execute()

    # Increment webhook failure counter
    supabase.rpc("record_webhook_failure", {
        "p_webhook_id": webhook_id,
        "p_error_message": error
    }).execute()


async def record_attempt(
    delivery_id: str,
    webhook_id: str,
    attempt: int,
    status_code: Optional[int] = None,
    response_body: Optional[str] = None,
    response_time_ms: Optional[int] = None,
    error: Optional[str] = None
) -> None:
    """Record delivery attempt (may retry)."""
    supabase = get_service_client()

    update_data = {
        "attempt_count": attempt + 1,
        "error_message": error
    }

    if status_code:
        update_data["response_status"] = status_code
    if response_body:
        update_data["response_body"] = response_body
    if response_time_ms:
        update_data["response_time_ms"] = response_time_ms

    if attempt + 1 >= MAX_RETRIES:
        update_data["status"] = "dead_letter"
        update_data["completed_at"] = "now()"

        # Record webhook failure
        supabase.rpc("record_webhook_failure", {
            "p_webhook_id": webhook_id,
            "p_error_message": error or "Max retries exceeded"
        }).execute()
    else:
        update_data["status"] = "retrying"

    supabase.table("webhook_deliveries").update(update_data).eq("id", delivery_id).execute()


async def run_worker(poll_interval: float = 1.0) -> None:
    """
    Main worker loop.

    Polls Redis queue and processes deliveries.
    """
    logger.info("Webhook delivery worker started")

    while True:
        try:
            # Get batch of ready deliveries
            deliveries = await webhook_queue.dequeue_batch(batch_size=10)

            if not deliveries:
                await asyncio.sleep(poll_interval)
                continue

            # Process concurrently
            tasks = []
            for delivery_data in deliveries:
                tasks.append(process_single(delivery_data))

            await asyncio.gather(*tasks, return_exceptions=True)

        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            await asyncio.sleep(5)


async def process_single(delivery_data: Dict[str, Any]) -> None:
    """Process single delivery with retry handling."""
    try:
        success = await process_delivery(delivery_data)

        if success:
            await webhook_queue.complete(delivery_data)
        else:
            attempt = delivery_data.get("attempt", 0)
            if not await webhook_queue.retry(delivery_data, attempt + 1):
                # Max retries reached
                await webhook_queue.complete(delivery_data)

    except Exception as e:
        logger.error(f"Error processing delivery: {e}", exc_info=True)
        await webhook_queue.complete(delivery_data)
```

### ✅ CHECKPOINT 3: Delivery Infrastructure Ready

- [ ] Redis queue enqueue/dequeue works
- [ ] Deliveries survive server restart
- [ ] Circuit breaker opens after failures
- [ ] Exponential backoff with jitter
- [ ] Shared HTTP client with pooling

---

## Phase 4: API Endpoints

### 4.1 Webhook Router

**File:** `backend/routers/webhooks.py`

```python
"""
Webhook Management API Endpoints

Follows standardized response format from backend/schemas/responses.py
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
from uuid import uuid4
import logging

from ..auth import get_current_user
from ..rate_limit import limiter
from ..database import get_service_client
from ..schemas.responses import success_response, paginated_response, error_response
from ..webhooks.crypto import generate_webhook_secret, encrypt_webhook_secret
from ..webhooks.security import validate_webhook_url, validate_custom_headers
from ..webhooks.queue import webhook_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ============================================================================
# REQUEST MODELS
# ============================================================================

class WebhookCreateRequest(BaseModel):
    name: str
    url: str
    event_types: List[str]
    description: Optional[str] = None
    filter_department_ids: Optional[List[str]] = None
    filter_tags: Optional[List[str]] = None
    custom_headers: Optional[Dict[str, str]] = None
    include_enriched_data: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v.strip()

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        is_valid, error = validate_webhook_url(v)
        if not is_valid:
            raise ValueError(error)
        return v


class WebhookUpdateRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    event_types: Optional[List[str]] = None
    description: Optional[str] = None
    filter_department_ids: Optional[List[str]] = None
    filter_tags: Optional[List[str]] = None
    custom_headers: Optional[Dict[str, str]] = None
    include_enriched_data: Optional[bool] = None
    is_active: Optional[bool] = None


class ZapierSubscribeRequest(BaseModel):
    """Zapier REST Hooks subscribe request."""
    target_url: str
    event: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def check_webhook_access(company_id: str, require_admin: bool = False) -> bool:
    """Check if company has webhook feature enabled."""
    supabase = get_service_client()

    result = supabase.table("webhook_features") \
        .select("is_enabled") \
        .eq("company_id", company_id) \
        .single() \
        .execute()

    if not result.data or not result.data.get("is_enabled"):
        return False

    return True


async def get_valid_event_types() -> set:
    """Get valid event types from database."""
    supabase = get_service_client()
    result = supabase.table("webhook_event_types") \
        .select("id") \
        .eq("is_active", True) \
        .execute()

    return {row["id"] for row in (result.data or [])}


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/event-types")
async def list_event_types(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """List all available webhook event types."""
    supabase = get_service_client()

    result = supabase.table("webhook_event_types") \
        .select("*") \
        .eq("is_active", True) \
        .order("category") \
        .execute()

    return success_response(result.data or [])


@router.get("")
@limiter.limit("60/minute")
async def list_webhooks(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """List all webhooks for the current company."""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(400, "Company ID required")

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .select(
            "id, name, url, description, event_types, secret_suffix, "
            "filter_department_ids, filter_tags, custom_headers, "
            "include_enriched_data, is_active, is_verified, "
            "consecutive_failures, last_success_at, last_failure_at, "
            "created_at, updated_at"
        ) \
        .eq("company_id", company_id) \
        .order("created_at", desc=True) \
        .execute()

    return success_response(result.data or [])


@router.post("")
@limiter.limit("10/minute")
async def create_webhook(
    request: Request,
    body: WebhookCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new webhook endpoint.

    The signing secret is only returned once - save it immediately!
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("id")

    if not company_id:
        raise HTTPException(400, "Company ID required")

    # Check feature access
    if not await check_webhook_access(company_id):
        raise HTTPException(403, "Webhook feature not enabled for this company")

    # Validate event types against database
    valid_events = await get_valid_event_types()
    invalid_events = set(body.event_types) - valid_events
    if invalid_events:
        raise HTTPException(400, f"Invalid event types: {', '.join(invalid_events)}")

    # Validate custom headers
    if body.custom_headers:
        is_valid, error = validate_custom_headers(body.custom_headers)
        if not is_valid:
            raise HTTPException(400, error)

    # Generate and encrypt secret
    secret = generate_webhook_secret()
    encrypted_secret, secret_suffix = encrypt_webhook_secret(secret, company_id)

    supabase = get_service_client()

    result = supabase.table("company_webhooks").insert({
        "company_id": company_id,
        "name": body.name,
        "url": body.url,
        "description": body.description,
        "event_types": body.event_types,
        "secret_encrypted": encrypted_secret.hex(),
        "secret_suffix": secret_suffix,
        "filter_department_ids": body.filter_department_ids,
        "filter_tags": body.filter_tags,
        "custom_headers": body.custom_headers or {},
        "include_enriched_data": body.include_enriched_data,
        "created_by": user_id,
        "is_active": True,
        "is_verified": False
    }).execute()

    if not result.data:
        raise HTTPException(500, "Failed to create webhook")

    webhook = result.data[0]
    webhook["secret"] = secret  # Only returned once!
    webhook.pop("secret_encrypted", None)

    logger.info(f"Webhook created: {webhook['id']} by user {user_id}")

    return success_response(
        webhook,
        message="Webhook created. Save the secret - it won't be shown again!"
    )


@router.get("/{webhook_id}")
async def get_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific webhook endpoint."""
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .select("*") \
        .eq("id", webhook_id) \
        .eq("company_id", company_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(404, "Webhook not found")

    result.data.pop("secret_encrypted", None)

    return success_response(result.data)


@router.patch("/{webhook_id}")
@limiter.limit("30/minute")
async def update_webhook(
    webhook_id: str,
    request: Request,
    body: WebhookUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a webhook endpoint."""
    company_id = current_user.get("company_id")

    updates = body.model_dump(exclude_unset=True)

    # Validate URL if changing
    if "url" in updates:
        is_valid, error = validate_webhook_url(updates["url"])
        if not is_valid:
            raise HTTPException(400, error)

    # Validate event types if changing
    if "event_types" in updates:
        valid_events = await get_valid_event_types()
        invalid_events = set(updates["event_types"]) - valid_events
        if invalid_events:
            raise HTTPException(400, f"Invalid event types: {', '.join(invalid_events)}")

    # Validate headers if changing
    if "custom_headers" in updates and updates["custom_headers"]:
        is_valid, error = validate_custom_headers(updates["custom_headers"])
        if not is_valid:
            raise HTTPException(400, error)

    # Re-enable clears failure state
    if updates.get("is_active") is True:
        updates["consecutive_failures"] = 0
        updates["disabled_reason"] = None

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .update(updates) \
        .eq("id", webhook_id) \
        .eq("company_id", company_id) \
        .execute()

    if not result.data:
        raise HTTPException(404, "Webhook not found")

    result.data[0].pop("secret_encrypted", None)

    return success_response(result.data[0])


@router.delete("/{webhook_id}")
@limiter.limit("20/minute")
async def delete_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete a webhook endpoint."""
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .delete() \
        .eq("id", webhook_id) \
        .eq("company_id", company_id) \
        .execute()

    if not result.data:
        raise HTTPException(404, "Webhook not found")

    logger.info(f"Webhook deleted: {webhook_id}")

    return success_response({"deleted": True})


@router.post("/{webhook_id}/test")
@limiter.limit("10/minute")
async def test_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Send a test webhook to verify the endpoint."""
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    webhook = supabase.table("company_webhooks") \
        .select("*") \
        .eq("id", webhook_id) \
        .eq("company_id", company_id) \
        .single() \
        .execute()

    if not webhook.data:
        raise HTTPException(404, "Webhook not found")

    # Create test delivery
    from ..webhooks.service import dispatch_test_event

    result = await dispatch_test_event(
        webhook_id=webhook_id,
        company_id=company_id,
        webhook_data=webhook.data
    )

    return success_response(result)


@router.post("/{webhook_id}/rotate-secret")
@limiter.limit("5/minute")
async def rotate_webhook_secret(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Rotate the signing secret for a webhook."""
    company_id = current_user.get("company_id")

    secret = generate_webhook_secret()
    encrypted_secret, secret_suffix = encrypt_webhook_secret(secret, company_id)

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .update({
            "secret_encrypted": encrypted_secret.hex(),
            "secret_suffix": secret_suffix,
            "secret_version": supabase.raw("secret_version + 1")
        }) \
        .eq("id", webhook_id) \
        .eq("company_id", company_id) \
        .execute()

    if not result.data:
        raise HTTPException(404, "Webhook not found")

    logger.info(f"Webhook secret rotated: {webhook_id}")

    return success_response(
        {"secret": secret, "secret_suffix": secret_suffix},
        message="Secret rotated. Save the new secret - it won't be shown again!"
    )


@router.get("/{webhook_id}/deliveries")
async def get_webhook_deliveries(
    webhook_id: str,
    request: Request,
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get delivery history for a webhook."""
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    query = supabase.table("webhook_deliveries") \
        .select("*", count="exact") \
        .eq("company_id", company_id) \
        .eq("webhook_id", webhook_id) \
        .order("created_at", desc=True) \
        .range(offset, offset + min(limit, 100) - 1)

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.execute()

    return paginated_response(
        result.data or [],
        limit=limit,
        offset=offset,
        total_count=result.count
    )


@router.post("/deliveries/{delivery_id}/retry")
@limiter.limit("20/minute")
async def retry_delivery(
    delivery_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Manually retry a failed delivery."""
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    # Get delivery
    delivery = supabase.table("webhook_deliveries") \
        .select("*, company_webhooks(*)") \
        .eq("id", delivery_id) \
        .eq("company_id", company_id) \
        .single() \
        .execute()

    if not delivery.data:
        raise HTTPException(404, "Delivery not found")

    if delivery.data["status"] not in ("failed", "dead_letter"):
        raise HTTPException(400, "Can only retry failed deliveries")

    webhook = delivery.data["company_webhooks"]

    # Reset and re-queue
    supabase.table("webhook_deliveries") \
        .update({"status": "queued", "attempt_count": 0}) \
        .eq("id", delivery_id) \
        .execute()

    await webhook_queue.enqueue(
        delivery_id=delivery_id,
        webhook_id=webhook["id"],
        company_id=company_id,
        url=webhook["url"],
        payload=delivery.data["payload"],
        secret_encrypted=bytes.fromhex(webhook["secret_encrypted"]),
        custom_headers=webhook.get("custom_headers", {}),
        include_enriched=webhook.get("include_enriched_data", False),
        header_prefix=webhook.get("custom_header_prefix", "X-AxCouncil")
    )

    return success_response({"retrying": True})


# ============================================================================
# ZAPIER REST HOOKS
# ============================================================================

@router.post("/subscribe")
async def zapier_subscribe(
    request: Request,
    body: ZapierSubscribeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Zapier REST Hooks subscribe endpoint.

    Called when a Zap is turned on.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("id")

    if not company_id:
        raise HTTPException(400, "Company ID required")

    # Validate event type
    valid_events = await get_valid_event_types()
    if body.event not in valid_events:
        raise HTTPException(400, f"Invalid event type: {body.event}")

    # Validate URL
    is_valid, error = validate_webhook_url(body.target_url)
    if not is_valid:
        raise HTTPException(400, error)

    # Create webhook
    secret = generate_webhook_secret()
    encrypted_secret, secret_suffix = encrypt_webhook_secret(secret, company_id)

    subscription_id = str(uuid4())

    supabase = get_service_client()

    result = supabase.table("company_webhooks").insert({
        "company_id": company_id,
        "name": f"Zapier: {body.event}",
        "url": body.target_url,
        "description": "Created by Zapier",
        "event_types": [body.event],
        "secret_encrypted": encrypted_secret.hex(),
        "secret_suffix": secret_suffix,
        "zapier_subscription_id": subscription_id,
        "created_by": user_id,
        "is_active": True
    }).execute()

    return {"id": subscription_id}


@router.delete("/subscribe/{subscription_id}")
async def zapier_unsubscribe(
    subscription_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Zapier REST Hooks unsubscribe endpoint.

    Called when a Zap is turned off.
    """
    company_id = current_user.get("company_id")

    supabase = get_service_client()

    result = supabase.table("company_webhooks") \
        .delete() \
        .eq("zapier_subscription_id", subscription_id) \
        .eq("company_id", company_id) \
        .execute()

    return {"success": True}


@router.get("/sample-data")
async def get_sample_data(
    event_type: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Zapier performList endpoint.

    Returns sample data for field mapping in Zapier editor.
    """
    supabase = get_service_client()

    result = supabase.table("webhook_event_types") \
        .select("payload_example") \
        .eq("id", event_type) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(404, "Event type not found")

    # Return array for Zapier
    sample = result.data.get("payload_example", {})
    return [{"event": event_type, "event_id": "sample_123", "data": sample}]
```

### 4.2 Register Router

Add to `backend/routers/v1.py`:

```python
from .webhooks import router as webhooks_router

# In the router setup section:
router.include_router(webhooks_router)
```

### ✅ CHECKPOINT 4: API Ready

- [ ] All endpoints return standardized response format
- [ ] Event types validated against database
- [ ] Zapier REST Hooks (subscribe/unsubscribe/sample-data) working
- [ ] Rate limiting in place
- [ ] Access control checking webhook feature flag

---

## Phase 5-13: Summary

Due to document length, the remaining phases are summarized. Each follows the same structure with:
- Detailed implementation code
- Verification commands
- Checkpoint criteria

### Phase 5: Event Registry & Emitters
- `backend/webhooks/events.py` with emitter functions for all 40+ events
- Hooks into all routers (conversations, decisions, projects, playbooks, team, billing)
- GDPR-safe payloads by default, enriched when opted-in

### Phase 6: Access Control & Feature Gating
- `backend/webhooks/access.py` with feature check middleware
- Platform admin override capability
- White-label configuration support

### Phase 7: Frontend UI
- `frontend/src/components/settings/WebhooksSection.tsx`
- `frontend/src/components/settings/hooks/useWebhooks.ts`
- Event selector with categories
- Secret display modal (shown once)

### Phase 8: Delivery Inspector UI
- `frontend/src/components/settings/WebhookDeliveries.tsx`
- Full request/response viewer
- Manual retry button
- Status filtering

### Phase 9: Documentation
- `docs/webhooks/README.md` - Overview
- `docs/webhooks/verification.md` - Code examples in 5 languages
- `docs/webhooks/events.md` - Full event catalog
- OpenAPI spec generation

### Phase 10: Testing
- `backend/tests/test_webhooks/` - Unit tests
- `backend/tests/test_webhooks_integration.py` - E2E tests
- Frontend component tests

### Phase 11: Monitoring & Alerting
- Consecutive failure tracking (auto-disable at 10)
- Health endpoint for queue stats
- Webhook health dashboard data

### Phase 12: Deployment
- Environment variables checklist
- Feature flag rollout
- Migration commands

### Phase 13: MCP Server (Future)
- Architecture documentation
- HTTP+SSE transport spec
- Tool definitions for AI agents

---

## Rollback Procedures

### Database Rollback

```sql
-- Only if needed - drops all webhook data
DROP TABLE IF EXISTS public.webhook_deliveries CASCADE;
DROP TABLE IF EXISTS public.company_webhooks CASCADE;
DROP TABLE IF EXISTS public.webhook_event_types CASCADE;
DROP TABLE IF EXISTS public.webhook_features CASCADE;

DROP FUNCTION IF EXISTS public.company_webhooks_enabled;
DROP FUNCTION IF EXISTS public.get_webhooks_for_event;
DROP FUNCTION IF EXISTS public.record_webhook_failure;
DROP FUNCTION IF EXISTS public.record_webhook_success;
DROP FUNCTION IF EXISTS update_webhook_updated_at;
```

### Backend Rollback

1. Remove webhook router from `v1.py`
2. Redeploy backend
3. Events fail silently (no user impact)

### Frontend Rollback

1. Remove Webhooks tab from Settings
2. Redeploy frontend

---

## API Reference

### Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/webhooks/event-types` | List available events | - |
| GET | `/webhooks` | List company webhooks | 60/min |
| POST | `/webhooks` | Create webhook | 10/min |
| GET | `/webhooks/{id}` | Get webhook | - |
| PATCH | `/webhooks/{id}` | Update webhook | 30/min |
| DELETE | `/webhooks/{id}` | Delete webhook | 20/min |
| POST | `/webhooks/{id}/test` | Test webhook | 10/min |
| POST | `/webhooks/{id}/rotate-secret` | Rotate secret | 5/min |
| GET | `/webhooks/{id}/deliveries` | Get delivery history | - |
| POST | `/webhooks/deliveries/{id}/retry` | Retry delivery | 20/min |
| POST | `/webhooks/subscribe` | Zapier subscribe | 10/min |
| DELETE | `/webhooks/subscribe/{id}` | Zapier unsubscribe | 20/min |
| GET | `/webhooks/sample-data` | Zapier sample data | - |

### Signature Verification (Python)

```python
import hmac
import hashlib
import time

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    """Verify AxCouncil webhook signature."""
    parts = dict(p.split('=', 1) for p in signature.split(','))
    timestamp = int(parts['t'])
    sig = parts['v1']

    # Check timestamp (5 min tolerance)
    if abs(time.time() - timestamp) > 300:
        return False

    # Verify signature
    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{payload.decode()}".encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(sig, expected)
```

---

*Document Version: 2.0 | Last Updated: 2026-02-05*
