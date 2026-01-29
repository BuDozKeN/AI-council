# AxCouncil Webhook System - Implementation Plan

> **Version:** 1.0
> **Created:** 2026-01-29
> **Status:** Ready for Implementation
> **Estimated Effort:** 5-7 days

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Progress Tracker](#progress-tracker)
4. [Phase 1: Database Schema](#phase-1-database-schema)
5. [Phase 2: Backend Services](#phase-2-backend-services)
6. [Phase 3: API Endpoints](#phase-3-api-endpoints)
7. [Phase 4: Event Integration](#phase-4-event-integration)
8. [Phase 5: Frontend UI](#phase-5-frontend-ui)
9. [Phase 6: Testing](#phase-6-testing)
10. [Phase 7: Deployment](#phase-7-deployment)
11. [Rollback Procedures](#rollback-procedures)
12. [API Reference](#api-reference)

---

## Overview

### What We're Building

A universal outgoing webhook system that enables AxCouncil to send events to:
- Zapier
- Make (Integromat)
- n8n
- Custom endpoints

### Key Principles

1. **Multi-tenant**: Each company manages their own webhooks
2. **Secure**: HMAC-SHA256 signed payloads, encrypted secrets
3. **Reliable**: Automatic retries with exponential backoff
4. **Auditable**: All deliveries logged for debugging

### Webhook Events

| Event | Trigger | Use Case |
|-------|---------|----------|
| `decision.saved` | Council decision saved | Send to CRM, Notion, Sheets |
| `decision.promoted` | Decision → Playbook | Update documentation systems |
| `conversation.completed` | Council deliberation done | Post to Slack, create tasks |
| `conversation.exported` | Export triggered | Backup to cloud storage |
| `member.invited` | Team invite sent | HR system sync |
| `member.joined` | Invite accepted | Onboarding automation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AxCouncil                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User Action (Save Decision, Complete Council, etc.)                   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 Webhook Dispatcher                               │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  1. Query company_webhooks for matching event                   │   │
│  │  2. Build payload with event data                               │   │
│  │  3. Sign payload with HMAC-SHA256                               │   │
│  │  4. Queue async delivery                                        │   │
│  │  5. Log to webhook_deliveries                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 Delivery Worker                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  • POST to webhook URL with signed payload                      │   │
│  │  • Retry on failure (3 attempts: 1min, 5min, 15min)            │   │
│  │  • Update delivery status                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  External Services (Zapier, Make, n8n, Custom)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Payload Structure

```json
{
  "event": "decision.saved",
  "event_id": "evt_abc123",
  "timestamp": "2026-01-29T10:30:00Z",
  "data": {
    "decision": {
      "id": "dec_xyz",
      "title": "Q1 Marketing Strategy",
      "content": "The council recommends...",
      "department": "Marketing",
      "tags": ["strategy", "q1-2026"]
    },
    "user": {
      "id": "usr_123",
      "email": "user@company.com"
    }
  }
}
```

### Security Headers

```
Content-Type: application/json
User-Agent: AxCouncil-Webhooks/1.0
X-AxCouncil-Event: decision.saved
X-AxCouncil-Signature: sha256=abc123...
X-AxCouncil-Delivery: dlv_xyz789
X-AxCouncil-Timestamp: 2026-01-29T10:30:00Z
```

---

## Progress Tracker

Use this checklist to track implementation progress. Mark each item when complete.

### Phase 1: Database Schema
- [ ] **1.1** Create migration file
- [ ] **1.2** Apply migration to development
- [ ] **1.3** Verify tables created
- [ ] **1.4** Verify RLS policies active
- [ ] **1.5** Verify helper functions work
- [ ] **CHECKPOINT 1**: Database ready ✓

### Phase 2: Backend Services
- [ ] **2.1** Create webhook encryption module
- [ ] **2.2** Test encryption/decryption
- [ ] **2.3** Create webhook service
- [ ] **2.4** Test service instantiation
- [ ] **CHECKPOINT 2**: Services ready ✓

### Phase 3: API Endpoints
- [ ] **3.1** Create webhook router
- [ ] **3.2** Register router in v1.py
- [ ] **3.3** Test endpoints with curl
- [ ] **3.4** Add to API client (frontend)
- [ ] **CHECKPOINT 3**: API ready ✓

### Phase 4: Event Integration
- [ ] **4.1** Hook into decision saving
- [ ] **4.2** Hook into decision promotion
- [ ] **4.3** Hook into conversation completion
- [ ] **4.4** Test event emission
- [ ] **CHECKPOINT 4**: Events firing ✓

### Phase 5: Frontend UI
- [ ] **5.1** Create WebhooksSection component
- [ ] **5.2** Create useWebhooks hook
- [ ] **5.3** Create CSS files
- [ ] **5.4** Add Webhooks tab to Settings
- [ ] **5.5** Test UI functionality
- [ ] **CHECKPOINT 5**: UI complete ✓

### Phase 6: Testing
- [ ] **6.1** Write backend unit tests
- [ ] **6.2** Write frontend tests
- [ ] **6.3** Manual integration test
- [ ] **6.4** Test with real Zapier webhook
- [ ] **CHECKPOINT 6**: Tests passing ✓

### Phase 7: Deployment
- [ ] **7.1** Set environment variables
- [ ] **7.2** Apply migration to production
- [ ] **7.3** Deploy backend
- [ ] **7.4** Deploy frontend
- [ ] **7.5** Smoke test in production
- [ ] **CHECKPOINT 7**: Live ✓

---

## Phase 1: Database Schema

### Stage 1.1: Create Migration File

**File:** `supabase/migrations/20260129000000_webhook_system.sql`

```sql
-- ============================================================================
-- WEBHOOK SYSTEM SCHEMA
-- ============================================================================
-- Purpose: Enable outgoing webhooks for AxCouncil events
-- Scope: Company-level (each company manages their own webhooks)
-- Security: Encrypted secrets, signed payloads, RLS isolation
-- ============================================================================

-- ============================================================================
-- 1. COMPANY WEBHOOKS TABLE
-- ============================================================================
-- Stores webhook endpoint configurations per company

DROP TABLE IF EXISTS public.webhook_deliveries CASCADE;
DROP TABLE IF EXISTS public.company_webhooks CASCADE;
DROP TABLE IF EXISTS public.webhook_event_types CASCADE;

CREATE TABLE public.company_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Configuration
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,

    -- Event subscriptions (PostgreSQL array)
    event_types TEXT[] NOT NULL DEFAULT '{}',

    -- Security (encrypted with company-derived key)
    secret_encrypted BYTEA NOT NULL,
    secret_suffix VARCHAR(8) NOT NULL,

    -- Optional filtering
    filter_department_ids UUID[] DEFAULT NULL,
    filter_tags TEXT[] DEFAULT NULL,

    -- Custom headers (stored as JSONB)
    custom_headers JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,

    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 60,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT valid_webhook_url CHECK (url ~ '^https?://'),
    CONSTRAINT valid_event_types CHECK (array_length(event_types, 1) > 0)
);

-- Indexes
CREATE INDEX idx_company_webhooks_company_id
    ON public.company_webhooks(company_id);
CREATE INDEX idx_company_webhooks_active
    ON public.company_webhooks(company_id, is_active)
    WHERE is_active = true;
CREATE INDEX idx_company_webhooks_events
    ON public.company_webhooks USING GIN(event_types);

-- Comments
COMMENT ON TABLE public.company_webhooks IS 'Outgoing webhook configurations per company';
COMMENT ON COLUMN public.company_webhooks.event_types IS 'Array of subscribed event types';
COMMENT ON COLUMN public.company_webhooks.secret_encrypted IS 'HMAC signing secret, encrypted with company-derived key';

-- ============================================================================
-- 2. WEBHOOK DELIVERIES TABLE
-- ============================================================================
-- Audit log of all webhook delivery attempts

CREATE TABLE public.webhook_deliveries (
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
    max_attempts INTEGER DEFAULT 3,

    -- Response details
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,

    -- Error tracking
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT now(),
    next_retry_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT valid_delivery_status CHECK (
        status IN ('pending', 'success', 'failed', 'retrying')
    )
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_webhook_id
    ON public.webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_status
    ON public.webhook_deliveries(status, next_retry_at)
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_event_id
    ON public.webhook_deliveries(event_id);
CREATE INDEX idx_webhook_deliveries_cleanup
    ON public.webhook_deliveries(created_at)
    WHERE created_at < now() - INTERVAL '30 days';

-- Comments
COMMENT ON TABLE public.webhook_deliveries IS 'Audit log of all webhook delivery attempts';

-- ============================================================================
-- 3. WEBHOOK EVENT TYPES TABLE (Reference)
-- ============================================================================
-- Documents available event types for UI and validation

CREATE TABLE public.webhook_event_types (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    payload_example JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert event types
INSERT INTO public.webhook_event_types (id, name, description, category, payload_example) VALUES
(
    'decision.saved',
    'Decision Saved',
    'Triggered when a council decision is saved to the knowledge base',
    'decisions',
    '{"decision": {"id": "uuid", "title": "string", "content": "string", "tags": ["string"]}}'
),
(
    'decision.promoted',
    'Decision Promoted',
    'Triggered when a decision is promoted to a playbook or project',
    'decisions',
    '{"decision": {"id": "uuid", "title": "string"}, "promoted_to": {"type": "string", "id": "uuid"}}'
),
(
    'conversation.completed',
    'Conversation Completed',
    'Triggered when a council deliberation completes all 3 stages',
    'conversations',
    '{"conversation": {"id": "uuid", "title": "string", "synthesis": "string"}}'
),
(
    'conversation.exported',
    'Conversation Exported',
    'Triggered when a conversation is exported',
    'conversations',
    '{"conversation_id": "uuid", "format": "markdown", "export_url": "string"}'
),
(
    'member.invited',
    'Team Member Invited',
    'Triggered when a new team member is invited',
    'team',
    '{"member": {"email": "string", "role": "string", "invited_by": "string"}}'
),
(
    'member.joined',
    'Team Member Joined',
    'Triggered when an invited member accepts and joins',
    'team',
    '{"member": {"id": "uuid", "email": "string", "name": "string"}}'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    payload_example = EXCLUDED.payload_example;

-- Comments
COMMENT ON TABLE public.webhook_event_types IS 'Reference table of available webhook events';

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE public.company_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_types ENABLE ROW LEVEL SECURITY;

-- Company webhooks: Company members can manage their webhooks
CREATE POLICY "company_webhooks_company_isolation" ON public.company_webhooks
    FOR ALL USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

-- Webhook deliveries: Company members can view their deliveries
CREATE POLICY "webhook_deliveries_company_isolation" ON public.webhook_deliveries
    FOR ALL USING (
        company_id IN (
            SELECT id FROM public.companies WHERE user_id = auth.uid()
        )
    );

-- Event types: All authenticated users can read
CREATE POLICY "webhook_event_types_readable" ON public.webhook_event_types
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypass for backend operations
CREATE POLICY "company_webhooks_service_role" ON public.company_webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "webhook_deliveries_service_role" ON public.webhook_deliveries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Get active webhooks for an event
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
    custom_headers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cw.id AS webhook_id,
        cw.url,
        cw.secret_encrypted,
        cw.custom_headers
    FROM public.company_webhooks cw
    WHERE cw.company_id = p_company_id
      AND cw.is_active = true
      AND p_event_type = ANY(cw.event_types)
      AND (cw.filter_department_ids IS NULL
           OR p_department_id = ANY(cw.filter_department_ids))
      AND (cw.filter_tags IS NULL
           OR cw.filter_tags && p_tags);
END;
$$;

-- Update delivery status
CREATE OR REPLACE FUNCTION public.update_webhook_delivery(
    p_delivery_id UUID,
    p_status VARCHAR(20),
    p_response_status INTEGER DEFAULT NULL,
    p_response_body TEXT DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.webhook_deliveries
    SET
        status = p_status,
        response_status = COALESCE(p_response_status, response_status),
        response_body = COALESCE(LEFT(p_response_body, 1000), response_body),
        response_time_ms = COALESCE(p_response_time_ms, response_time_ms),
        error_message = COALESCE(p_error_message, error_message),
        attempt_count = attempt_count + 1,
        completed_at = CASE
            WHEN p_status IN ('success', 'failed') THEN now()
            ELSE NULL
        END,
        next_retry_at = CASE
            WHEN p_status = 'retrying' THEN
                now() + (POWER(2, attempt_count) * INTERVAL '1 minute')
            ELSE NULL
        END
    WHERE id = p_delivery_id;
END;
$$;

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify tables exist
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_webhooks') THEN
        RAISE EXCEPTION 'company_webhooks table was not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'webhook_deliveries') THEN
        RAISE EXCEPTION 'webhook_deliveries table was not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'webhook_event_types') THEN
        RAISE EXCEPTION 'webhook_event_types table was not created';
    END IF;

    -- Verify RLS enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'company_webhooks'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS not enabled on company_webhooks';
    END IF;

    -- Verify event types populated
    IF (SELECT COUNT(*) FROM public.webhook_event_types) < 6 THEN
        RAISE EXCEPTION 'webhook_event_types not fully populated';
    END IF;

    RAISE NOTICE '✓ Webhook system schema verified successfully';
END;
$$;
```

### Stage 1.2: Apply Migration

```bash
# From project root
cd supabase

# Apply to development
supabase db push

# Or if using direct connection
psql -h your-db-host -U postgres -d postgres -f migrations/20260129000000_webhook_system.sql
```

### Stage 1.3-1.5: Verification Commands

```sql
-- 1.3: Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('company_webhooks', 'webhook_deliveries', 'webhook_event_types');
-- Expected: 3 rows

-- 1.4: Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('company_webhooks', 'webhook_deliveries');
-- Expected: rowsecurity = true for both

-- 1.5: Verify event types
SELECT COUNT(*) FROM webhook_event_types;
-- Expected: 6

-- 1.5: Test helper function (should return empty, that's OK)
SELECT * FROM get_webhooks_for_event(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'decision.saved'
);
-- Expected: 0 rows (no webhooks configured yet)
```

### ✅ CHECKPOINT 1: Database Ready

Before proceeding, verify:
- [ ] All 3 tables created
- [ ] RLS enabled on company_webhooks and webhook_deliveries
- [ ] 6 event types in webhook_event_types
- [ ] Helper functions created without errors

---

## Phase 2: Backend Services

### Stage 2.1: Webhook Encryption Module

**File:** `backend/webhooks/crypto.py`

```python
"""
Webhook Cryptography Module

Encrypts webhook secrets using company-derived keys.
Signs payloads with HMAC-SHA256 for verification.
Follows existing BYOK pattern from backend/utils/encryption.py.
"""

import hmac
import hashlib
import secrets
import os
from typing import Tuple
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import logging

logger = logging.getLogger(__name__)

# Use existing encryption secret or dedicated webhook secret
WEBHOOK_ENCRYPTION_SECRET = os.getenv(
    "WEBHOOK_ENCRYPTION_SECRET",
    os.getenv("USER_KEY_ENCRYPTION_SECRET")
)

if not WEBHOOK_ENCRYPTION_SECRET:
    raise ValueError(
        "WEBHOOK_ENCRYPTION_SECRET or USER_KEY_ENCRYPTION_SECRET "
        "environment variable required"
    )


def _derive_company_key(company_id: str) -> bytes:
    """
    Derive a unique encryption key for each company using HKDF.

    This ensures webhook secrets are encrypted with company-specific keys,
    providing tenant isolation even if the database is compromised.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"axcouncil-webhooks-v1",
        info=f"company_webhook:{company_id}".encode(),
        backend=default_backend()
    )
    return hkdf.derive(WEBHOOK_ENCRYPTION_SECRET.encode())


def generate_webhook_secret() -> str:
    """
    Generate a new webhook signing secret.

    Format: whsec_{44 random characters}
    Example: whsec_a1b2c3d4e5f6g7h8i9j0...
    """
    return f"whsec_{secrets.token_urlsafe(32)}"


def encrypt_webhook_secret(secret: str, company_id: str) -> Tuple[bytes, str]:
    """
    Encrypt a webhook secret for database storage.

    Args:
        secret: The plain text webhook secret
        company_id: Company UUID for key derivation

    Returns:
        Tuple of (encrypted_bytes, display_suffix)
        - encrypted_bytes: For database storage
        - display_suffix: Last 4 chars for UI display (e.g., "••••abc1")
    """
    key = _derive_company_key(company_id)
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)

    encrypted = aesgcm.encrypt(nonce, secret.encode(), None)
    encrypted_with_nonce = nonce + encrypted

    # Keep last 4 chars for display
    suffix = secret[-4:] if len(secret) >= 4 else secret

    return encrypted_with_nonce, suffix


def decrypt_webhook_secret(encrypted: bytes, company_id: str) -> str:
    """
    Decrypt a webhook secret for use.

    Args:
        encrypted: Encrypted bytes from database
        company_id: Company UUID for key derivation

    Returns:
        Plain text webhook secret

    Raises:
        Exception: If decryption fails (wrong key, corrupted data)
    """
    key = _derive_company_key(company_id)
    aesgcm = AESGCM(key)

    nonce = encrypted[:12]
    ciphertext = encrypted[12:]

    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode()


def sign_webhook_payload(payload: str, secret: str) -> str:
    """
    Sign a webhook payload using HMAC-SHA256.

    This signature is sent in the X-AxCouncil-Signature header.
    Recipients can verify the webhook authenticity.

    Args:
        payload: JSON string of the webhook payload
        secret: The webhook signing secret

    Returns:
        Signature string in format "sha256={hex_digest}"
    """
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

    return f"sha256={signature}"


def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    """
    Verify a webhook signature.

    Useful for testing and documentation examples.

    Args:
        payload: JSON string of the webhook payload
        signature: Signature from X-AxCouncil-Signature header
        secret: The webhook signing secret

    Returns:
        True if signature is valid
    """
    expected = sign_webhook_payload(payload, secret)
    return hmac.compare_digest(signature, expected)


def get_secret_suffix(secret: str) -> str:
    """Get display suffix for a secret (last 4 characters)."""
    return secret[-4:] if len(secret) >= 4 else secret


def mask_secret(secret: str) -> str:
    """Mask a secret for logging (shows only last 4 chars)."""
    if len(secret) <= 4:
        return "••••"
    return f"••••••••{secret[-4:]}"
```

### Stage 2.2: Test Encryption

Create a quick test script:

```bash
# From project root
python -c "
from backend.webhooks.crypto import (
    generate_webhook_secret,
    encrypt_webhook_secret,
    decrypt_webhook_secret,
    sign_webhook_payload,
    verify_webhook_signature
)

# Test 1: Generate secret
secret = generate_webhook_secret()
print(f'Generated: {secret}')
assert secret.startswith('whsec_'), 'Secret should start with whsec_'

# Test 2: Encrypt/decrypt roundtrip
company_id = 'test-company-123'
encrypted, suffix = encrypt_webhook_secret(secret, company_id)
decrypted = decrypt_webhook_secret(encrypted, company_id)
assert decrypted == secret, 'Decryption should match original'
print(f'Encrypt/decrypt: OK (suffix: {suffix})')

# Test 3: Signature
payload = '{\"event\":\"test\"}'
signature = sign_webhook_payload(payload, secret)
assert verify_webhook_signature(payload, signature, secret), 'Signature should verify'
print(f'Signature: OK ({signature[:30]}...)')

print('\\n✓ All crypto tests passed')
"
```

### Stage 2.3: Webhook Service

**File:** `backend/webhooks/service.py`

```python
"""
Webhook Delivery Service

Dispatches webhooks asynchronously with retry logic.
Follows existing patterns from backend/routers/settings.py.
"""

import asyncio
import httpx
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from uuid import uuid4

from backend.database import get_service_client
from backend.webhooks.crypto import (
    encrypt_webhook_secret,
    decrypt_webhook_secret,
    sign_webhook_payload,
    generate_webhook_secret,
    mask_secret
)
from backend.security import log_app_event

logger = logging.getLogger(__name__)

# Configuration
MAX_RETRIES = 3
TIMEOUT_SECONDS = 30
RETRY_DELAYS = [60, 300, 900]  # 1 min, 5 min, 15 min


class WebhookEvent:
    """Represents a webhook event to be dispatched."""

    def __init__(
        self,
        event_type: str,
        company_id: str,
        data: Dict[str, Any],
        department_id: Optional[str] = None,
        tags: Optional[List[str]] = None
    ):
        self.event_id = str(uuid4())
        self.event_type = event_type
        self.company_id = company_id
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.department_id = department_id
        self.tags = tags or []

        # Build full payload
        self.payload = {
            "event": event_type,
            "event_id": self.event_id,
            "timestamp": self.timestamp,
            "data": data
        }


class WebhookService:
    """Service for managing and dispatching webhooks."""

    def __init__(self):
        self._supabase = None

    @property
    def supabase(self):
        """Lazy load Supabase client."""
        if self._supabase is None:
            self._supabase = get_service_client()
        return self._supabase

    # =========================================================================
    # ENDPOINT MANAGEMENT
    # =========================================================================

    async def create_endpoint(
        self,
        company_id: str,
        name: str,
        url: str,
        event_types: List[str],
        created_by: str,
        description: Optional[str] = None,
        filter_department_ids: Optional[List[str]] = None,
        filter_tags: Optional[List[str]] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Create a new webhook endpoint for a company."""

        # Generate and encrypt secret
        secret = generate_webhook_secret()
        encrypted_secret, secret_suffix = encrypt_webhook_secret(secret, company_id)

        # Insert endpoint
        result = self.supabase.table("company_webhooks").insert({
            "company_id": company_id,
            "name": name,
            "url": url,
            "description": description,
            "event_types": event_types,
            "secret_encrypted": encrypted_secret.hex(),
            "secret_suffix": secret_suffix,
            "filter_department_ids": filter_department_ids,
            "filter_tags": filter_tags,
            "custom_headers": custom_headers or {},
            "created_by": created_by,
            "is_active": True,
            "is_verified": False
        }).execute()

        if not result.data:
            raise Exception("Failed to create webhook endpoint")

        endpoint = result.data[0]

        # Log event
        log_app_event(
            "WEBHOOK_CREATED",
            user_id=created_by,
            resource_id=endpoint["id"],
            details={
                "name": name,
                "url": url[:50] + "..." if len(url) > 50 else url,
                "event_types": event_types
            }
        )

        logger.info(f"Webhook created: {endpoint['id']} for company {company_id}")

        # Return with plain secret (only shown once!)
        return {
            **endpoint,
            "secret": secret,
            "secret_encrypted": None  # Don't expose
        }

    async def list_endpoints(self, company_id: str) -> List[Dict[str, Any]]:
        """List all webhook endpoints for a company."""
        result = self.supabase.table("company_webhooks") \
            .select(
                "id, name, url, description, event_types, secret_suffix, "
                "filter_department_ids, filter_tags, custom_headers, "
                "is_active, is_verified, created_at, updated_at"
            ) \
            .eq("company_id", company_id) \
            .order("created_at", desc=True) \
            .execute()

        return result.data or []

    async def get_endpoint(
        self,
        webhook_id: str,
        company_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get a specific webhook endpoint."""
        result = self.supabase.table("company_webhooks") \
            .select("*") \
            .eq("id", webhook_id) \
            .eq("company_id", company_id) \
            .execute()

        return result.data[0] if result.data else None

    async def update_endpoint(
        self,
        webhook_id: str,
        company_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """Update a webhook endpoint."""

        # Don't allow updating sensitive fields
        updates.pop("secret", None)
        updates.pop("secret_encrypted", None)
        updates.pop("company_id", None)
        updates.pop("id", None)

        updates["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = self.supabase.table("company_webhooks") \
            .update(updates) \
            .eq("id", webhook_id) \
            .eq("company_id", company_id) \
            .execute()

        return result.data[0] if result.data else None

    async def delete_endpoint(
        self,
        webhook_id: str,
        company_id: str
    ) -> bool:
        """Delete a webhook endpoint."""
        result = self.supabase.table("company_webhooks") \
            .delete() \
            .eq("id", webhook_id) \
            .eq("company_id", company_id) \
            .execute()

        return len(result.data) > 0 if result.data else False

    async def rotate_secret(
        self,
        webhook_id: str,
        company_id: str
    ) -> Dict[str, str]:
        """Generate a new secret for an endpoint."""

        secret = generate_webhook_secret()
        encrypted_secret, secret_suffix = encrypt_webhook_secret(secret, company_id)

        result = self.supabase.table("company_webhooks") \
            .update({
                "secret_encrypted": encrypted_secret.hex(),
                "secret_suffix": secret_suffix,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }) \
            .eq("id", webhook_id) \
            .eq("company_id", company_id) \
            .execute()

        if not result.data:
            raise Exception("Webhook not found")

        logger.info(f"Webhook secret rotated: {webhook_id}")

        return {
            "secret": secret,
            "secret_suffix": secret_suffix
        }

    # =========================================================================
    # EVENT DISPATCH
    # =========================================================================

    async def dispatch_event(self, event: WebhookEvent) -> List[str]:
        """
        Dispatch an event to all subscribed webhooks.

        Returns list of delivery IDs for tracking.
        """

        # Get all active endpoints subscribed to this event
        endpoints = await self._get_subscribed_endpoints(
            company_id=event.company_id,
            event_type=event.event_type,
            department_id=event.department_id,
            tags=event.tags
        )

        if not endpoints:
            logger.debug(
                f"No webhooks subscribed to {event.event_type} "
                f"for company {event.company_id}"
            )
            return []

        delivery_ids = []

        for endpoint in endpoints:
            # Create delivery record
            delivery_id = await self._create_delivery(
                company_id=event.company_id,
                webhook_id=endpoint["webhook_id"],
                event_type=event.event_type,
                event_id=event.event_id,
                payload=event.payload
            )
            delivery_ids.append(delivery_id)

            # Dispatch asynchronously (fire and forget)
            asyncio.create_task(
                self._deliver_webhook(
                    delivery_id=delivery_id,
                    endpoint=endpoint,
                    payload=event.payload,
                    company_id=event.company_id
                )
            )

        logger.info(
            f"Dispatched {event.event_type} to {len(endpoints)} webhooks "
            f"for company {event.company_id}"
        )

        return delivery_ids

    async def _get_subscribed_endpoints(
        self,
        company_id: str,
        event_type: str,
        department_id: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get all endpoints subscribed to an event type."""

        result = self.supabase.rpc(
            "get_webhooks_for_event",
            {
                "p_company_id": company_id,
                "p_event_type": event_type,
                "p_department_id": department_id,
                "p_tags": tags
            }
        ).execute()

        return result.data or []

    async def _create_delivery(
        self,
        company_id: str,
        webhook_id: str,
        event_type: str,
        event_id: str,
        payload: Dict[str, Any]
    ) -> str:
        """Create a delivery record for tracking."""

        result = self.supabase.table("webhook_deliveries").insert({
            "company_id": company_id,
            "webhook_id": webhook_id,
            "event_type": event_type,
            "event_id": event_id,
            "payload": payload,
            "status": "pending",
            "attempt_count": 0,
            "max_attempts": MAX_RETRIES
        }).execute()

        return result.data[0]["id"]

    async def _deliver_webhook(
        self,
        delivery_id: str,
        endpoint: Dict[str, Any],
        payload: Dict[str, Any],
        company_id: str,
        attempt: int = 1
    ):
        """Deliver a webhook with retry logic."""

        url = endpoint["url"]

        # Decrypt secret and sign payload
        try:
            secret_encrypted = bytes.fromhex(endpoint["secret_encrypted"])
            secret = decrypt_webhook_secret(secret_encrypted, company_id)
        except Exception as e:
            logger.error(f"Failed to decrypt webhook secret: {e}")
            await self._update_delivery_failed(
                delivery_id,
                "Failed to decrypt secret"
            )
            return

        payload_json = json.dumps(payload, separators=(",", ":"))
        signature = sign_webhook_payload(payload_json, secret)

        # Build headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AxCouncil-Webhooks/1.0",
            "X-AxCouncil-Event": payload["event"],
            "X-AxCouncil-Signature": signature,
            "X-AxCouncil-Delivery": delivery_id,
            "X-AxCouncil-Timestamp": payload["timestamp"]
        }

        # Add custom headers
        if endpoint.get("custom_headers"):
            headers.update(endpoint["custom_headers"])

        # Make request
        start_time = asyncio.get_event_loop().time()

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
                response = await client.post(
                    url,
                    content=payload_json,
                    headers=headers
                )

            response_time_ms = int(
                (asyncio.get_event_loop().time() - start_time) * 1000
            )

            if 200 <= response.status_code < 300:
                # Success
                await self._update_delivery_success(
                    delivery_id=delivery_id,
                    response_status=response.status_code,
                    response_body=response.text[:1000],
                    response_time_ms=response_time_ms
                )
                logger.info(f"Webhook delivered: {delivery_id}")

            else:
                # HTTP error - retry if attempts remaining
                await self._handle_delivery_failure(
                    delivery_id=delivery_id,
                    endpoint=endpoint,
                    payload=payload,
                    company_id=company_id,
                    attempt=attempt,
                    error=f"HTTP {response.status_code}",
                    response_status=response.status_code,
                    response_body=response.text[:1000],
                    response_time_ms=response_time_ms
                )

        except httpx.TimeoutException:
            await self._handle_delivery_failure(
                delivery_id=delivery_id,
                endpoint=endpoint,
                payload=payload,
                company_id=company_id,
                attempt=attempt,
                error="Request timeout"
            )

        except httpx.RequestError as e:
            await self._handle_delivery_failure(
                delivery_id=delivery_id,
                endpoint=endpoint,
                payload=payload,
                company_id=company_id,
                attempt=attempt,
                error=str(e)
            )

    async def _handle_delivery_failure(
        self,
        delivery_id: str,
        endpoint: Dict[str, Any],
        payload: Dict[str, Any],
        company_id: str,
        attempt: int,
        error: str,
        response_status: Optional[int] = None,
        response_body: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ):
        """Handle a failed delivery - retry or mark as failed."""

        if attempt < MAX_RETRIES:
            # Schedule retry
            delay = RETRY_DELAYS[attempt - 1]

            self.supabase.rpc("update_webhook_delivery", {
                "p_delivery_id": delivery_id,
                "p_status": "retrying",
                "p_response_status": response_status,
                "p_response_body": response_body,
                "p_response_time_ms": response_time_ms,
                "p_error_message": error
            }).execute()

            logger.warning(
                f"Webhook delivery failed (attempt {attempt}), "
                f"retrying in {delay}s: {error}"
            )

            # Wait and retry
            await asyncio.sleep(delay)
            await self._deliver_webhook(
                delivery_id=delivery_id,
                endpoint=endpoint,
                payload=payload,
                company_id=company_id,
                attempt=attempt + 1
            )
        else:
            # Max retries reached
            await self._update_delivery_failed(
                delivery_id=delivery_id,
                error=error,
                response_status=response_status,
                response_body=response_body,
                response_time_ms=response_time_ms
            )
            logger.error(
                f"Webhook delivery failed after {MAX_RETRIES} attempts: "
                f"{delivery_id}"
            )

    async def _update_delivery_success(
        self,
        delivery_id: str,
        response_status: int,
        response_body: str,
        response_time_ms: int
    ):
        """Mark delivery as successful."""
        self.supabase.rpc("update_webhook_delivery", {
            "p_delivery_id": delivery_id,
            "p_status": "success",
            "p_response_status": response_status,
            "p_response_body": response_body,
            "p_response_time_ms": response_time_ms
        }).execute()

    async def _update_delivery_failed(
        self,
        delivery_id: str,
        error: str,
        response_status: Optional[int] = None,
        response_body: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ):
        """Mark delivery as permanently failed."""
        self.supabase.rpc("update_webhook_delivery", {
            "p_delivery_id": delivery_id,
            "p_status": "failed",
            "p_response_status": response_status,
            "p_response_body": response_body,
            "p_response_time_ms": response_time_ms,
            "p_error_message": error
        }).execute()

    # =========================================================================
    # DELIVERY HISTORY
    # =========================================================================

    async def get_deliveries(
        self,
        company_id: str,
        webhook_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get delivery history for debugging."""

        query = self.supabase.table("webhook_deliveries") \
            .select("*") \
            .eq("company_id", company_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .offset(offset)

        if webhook_id:
            query = query.eq("webhook_id", webhook_id)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        return result.data or []

    async def retry_delivery(
        self,
        delivery_id: str,
        company_id: str
    ) -> bool:
        """Manually retry a failed delivery."""

        # Get delivery with webhook info
        delivery_result = self.supabase.table("webhook_deliveries") \
            .select("*") \
            .eq("id", delivery_id) \
            .eq("company_id", company_id) \
            .execute()

        if not delivery_result.data:
            return False

        delivery = delivery_result.data[0]

        # Get webhook endpoint
        webhook_result = self.supabase.table("company_webhooks") \
            .select("*") \
            .eq("id", delivery["webhook_id"]) \
            .execute()

        if not webhook_result.data:
            return False

        webhook = webhook_result.data[0]

        # Reset delivery status
        self.supabase.table("webhook_deliveries") \
            .update({"status": "pending", "attempt_count": 0}) \
            .eq("id", delivery_id) \
            .execute()

        # Build endpoint data for delivery
        endpoint = {
            "webhook_id": webhook["id"],
            "url": webhook["url"],
            "secret_encrypted": webhook["secret_encrypted"],
            "custom_headers": webhook.get("custom_headers", {})
        }

        # Dispatch retry
        asyncio.create_task(
            self._deliver_webhook(
                delivery_id=delivery_id,
                endpoint=endpoint,
                payload=delivery["payload"],
                company_id=company_id
            )
        )

        return True

    # =========================================================================
    # TEST WEBHOOK
    # =========================================================================

    async def send_test(
        self,
        webhook_id: str,
        company_id: str
    ) -> Dict[str, Any]:
        """Send a test webhook to verify endpoint configuration."""

        # Get endpoint
        endpoint = await self.get_endpoint(webhook_id, company_id)
        if not endpoint:
            return {"success": False, "error": "Webhook not found"}

        # Create test payload
        test_payload = {
            "event": "test.ping",
            "event_id": str(uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": {
                "message": "This is a test webhook from AxCouncil",
                "webhook_name": endpoint["name"]
            }
        }

        # Decrypt secret
        try:
            secret_encrypted = bytes.fromhex(endpoint["secret_encrypted"])
            secret = decrypt_webhook_secret(secret_encrypted, company_id)
        except Exception as e:
            return {"success": False, "error": "Failed to decrypt secret"}

        # Sign and send
        payload_json = json.dumps(test_payload, separators=(",", ":"))
        signature = sign_webhook_payload(payload_json, secret)

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AxCouncil-Webhooks/1.0",
            "X-AxCouncil-Event": "test.ping",
            "X-AxCouncil-Signature": signature,
            "X-AxCouncil-Timestamp": test_payload["timestamp"]
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    endpoint["url"],
                    content=payload_json,
                    headers=headers
                )

            success = 200 <= response.status_code < 300

            # Update verification status
            if success:
                await self.update_endpoint(
                    webhook_id,
                    company_id,
                    is_verified=True
                )

            return {
                "success": success,
                "status_code": response.status_code,
                "response_body": response.text[:500] if response.text else None
            }

        except httpx.TimeoutException:
            return {"success": False, "error": "Request timeout (10s)"}
        except httpx.RequestError as e:
            return {"success": False, "error": str(e)}


# Global instance
webhook_service = WebhookService()
```

### Stage 2.4: Create __init__.py

**File:** `backend/webhooks/__init__.py`

```python
"""
Webhook System

Provides outgoing webhook functionality for AxCouncil events.
"""

from backend.webhooks.crypto import (
    generate_webhook_secret,
    encrypt_webhook_secret,
    decrypt_webhook_secret,
    sign_webhook_payload,
    verify_webhook_signature
)
from backend.webhooks.service import (
    WebhookService,
    WebhookEvent,
    webhook_service
)

__all__ = [
    # Crypto
    "generate_webhook_secret",
    "encrypt_webhook_secret",
    "decrypt_webhook_secret",
    "sign_webhook_payload",
    "verify_webhook_signature",
    # Service
    "WebhookService",
    "WebhookEvent",
    "webhook_service"
]
```

### Stage 2.4: Test Service Instantiation

```bash
# From project root
python -c "
from backend.webhooks import webhook_service, WebhookEvent

print('Service instantiated:', webhook_service)
print('WebhookEvent class:', WebhookEvent)

# Test event creation
event = WebhookEvent(
    event_type='decision.saved',
    company_id='test-company',
    data={'decision': {'id': 'test'}}
)
print(f'Event created: {event.event_type} ({event.event_id})')
print('\\n✓ Service ready')
"
```

### ✅ CHECKPOINT 2: Services Ready

Before proceeding, verify:
- [ ] `backend/webhooks/crypto.py` created
- [ ] `backend/webhooks/service.py` created
- [ ] `backend/webhooks/__init__.py` created
- [ ] Encryption test passes
- [ ] Service instantiation works

---

## Phase 3: API Endpoints

### Stage 3.1: Create Webhook Router

**File:** `backend/routers/webhooks.py`

```python
"""
Webhook Management API Endpoints

Follows patterns from backend/routers/settings.py
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, List, Dict
from backend.auth import get_current_user
from backend.webhooks import webhook_service
from backend.rate_limit import limiter
from backend.database import get_service_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class WebhookCreateRequest(BaseModel):
    """Request body for creating a webhook."""
    name: str
    url: str
    event_types: List[str]
    description: Optional[str] = None
    filter_department_ids: Optional[List[str]] = None
    filter_tags: Optional[List[str]] = None
    custom_headers: Optional[Dict[str, str]] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v.strip()

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v

    @field_validator("event_types")
    @classmethod
    def validate_event_types(cls, v):
        valid_events = {
            "decision.saved",
            "decision.promoted",
            "conversation.completed",
            "conversation.exported",
            "member.invited",
            "member.joined"
        }
        for event in v:
            if event not in valid_events:
                raise ValueError(f"Invalid event type: {event}")
        if not v:
            raise ValueError("At least one event type required")
        return v


class WebhookUpdateRequest(BaseModel):
    """Request body for updating a webhook."""
    name: Optional[str] = None
    url: Optional[str] = None
    event_types: Optional[List[str]] = None
    description: Optional[str] = None
    filter_department_ids: Optional[List[str]] = None
    filter_tags: Optional[List[str]] = None
    custom_headers: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/event-types")
async def list_event_types(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    List all available webhook event types.

    Returns event types with descriptions and example payloads.
    """
    supabase = get_service_client()

    result = supabase.table("webhook_event_types") \
        .select("*") \
        .eq("is_active", True) \
        .order("category") \
        .execute()

    return {
        "success": True,
        "data": result.data or []
    }


@router.get("")
@limiter.limit("30/minute")
async def list_webhooks(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    List all webhooks for the current company.

    Returns webhook configurations without secrets.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID required"
        )

    endpoints = await webhook_service.list_endpoints(company_id)

    return {
        "success": True,
        "data": endpoints
    }


@router.post("")
@limiter.limit("5/minute")
async def create_webhook(
    request: Request,
    body: WebhookCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new webhook endpoint.

    Returns the created webhook including the signing secret.
    IMPORTANT: The secret is only shown once - save it immediately!
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("id")

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID required"
        )

    try:
        endpoint = await webhook_service.create_endpoint(
            company_id=company_id,
            name=body.name,
            url=body.url,
            event_types=body.event_types,
            created_by=user_id,
            description=body.description,
            filter_department_ids=body.filter_department_ids,
            filter_tags=body.filter_tags,
            custom_headers=body.custom_headers
        )

        return {
            "success": True,
            "data": endpoint,
            "message": "Webhook created. Save the secret - it won't be shown again!"
        }

    except Exception as e:
        logger.error(f"Failed to create webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create webhook"
        )


@router.get("/{webhook_id}")
async def get_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific webhook endpoint."""
    company_id = current_user.get("company_id")

    endpoint = await webhook_service.get_endpoint(webhook_id, company_id)

    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    # Remove encrypted secret from response
    endpoint.pop("secret_encrypted", None)

    return {
        "success": True,
        "data": endpoint
    }


@router.patch("/{webhook_id}")
@limiter.limit("20/minute")
async def update_webhook(
    webhook_id: str,
    request: Request,
    body: WebhookUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a webhook endpoint."""
    company_id = current_user.get("company_id")

    updates = body.model_dump(exclude_unset=True)

    endpoint = await webhook_service.update_endpoint(
        webhook_id=webhook_id,
        company_id=company_id,
        **updates
    )

    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    return {
        "success": True,
        "data": endpoint
    }


@router.delete("/{webhook_id}")
@limiter.limit("10/minute")
async def delete_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Delete a webhook endpoint."""
    company_id = current_user.get("company_id")

    deleted = await webhook_service.delete_endpoint(webhook_id, company_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )

    logger.info(f"Webhook deleted: {webhook_id} by user {current_user.get('id')}")

    return {
        "success": True,
        "message": "Webhook deleted"
    }


@router.post("/{webhook_id}/rotate-secret")
@limiter.limit("5/minute")
async def rotate_webhook_secret(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Rotate the signing secret for a webhook.

    Returns the new secret - save it immediately!
    """
    company_id = current_user.get("company_id")

    try:
        result = await webhook_service.rotate_secret(webhook_id, company_id)

        return {
            "success": True,
            "data": result,
            "message": "Secret rotated. Save the new secret - it won't be shown again!"
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found"
        )


@router.post("/{webhook_id}/test")
@limiter.limit("10/minute")
async def test_webhook(
    webhook_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a test webhook to verify the endpoint.

    Sends a test.ping event and returns the response.
    """
    company_id = current_user.get("company_id")

    result = await webhook_service.send_test(webhook_id, company_id)

    return {
        "success": result.get("success", False),
        "data": result
    }


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

    deliveries = await webhook_service.get_deliveries(
        company_id=company_id,
        webhook_id=webhook_id,
        status=status_filter,
        limit=min(limit, 100),
        offset=offset
    )

    return {
        "success": True,
        "data": deliveries
    }


@router.post("/deliveries/{delivery_id}/retry")
@limiter.limit("10/minute")
async def retry_delivery(
    delivery_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Manually retry a failed delivery."""
    company_id = current_user.get("company_id")

    success = await webhook_service.retry_delivery(delivery_id, company_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery not found"
        )

    return {
        "success": True,
        "message": "Retry initiated"
    }
```

### Stage 3.2: Register Router

**File:** `backend/routers/v1.py` (add to existing file)

Find the imports section and add:

```python
from backend.routers.webhooks import router as webhooks_router
```

Find where other routers are included and add:

```python
router.include_router(webhooks_router)
```

### Stage 3.3: Test Endpoints

```bash
# Start the server
python -m backend.main

# In another terminal, test the endpoints:

# List event types (should work without auth for testing)
curl http://localhost:8081/api/v1/webhooks/event-types

# Expected response:
# {"success": true, "data": [{"id": "decision.saved", ...}, ...]}
```

### Stage 3.4: Add to Frontend API Client

**File:** `frontend/src/api.ts` (add to existing file)

Find the API class and add these methods:

```typescript
  // =========================================================================
  // WEBHOOKS
  // =========================================================================

  async getWebhookEventTypes(): Promise<{ success: boolean; data: WebhookEventType[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/event-types`, {
      headers,
    });
    if (!response.ok) throw new Error('Failed to get webhook event types');
    return response.json();
  }

  async getWebhooks(): Promise<{ success: boolean; data: Webhook[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks`, {
      headers,
    });
    if (!response.ok) throw new Error('Failed to get webhooks');
    return response.json();
  }

  async createWebhook(data: CreateWebhookRequest): Promise<{ success: boolean; data: Webhook & { secret: string }; message: string }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Failed to create webhook');
    }
    return response.json();
  }

  async updateWebhook(webhookId: string, data: UpdateWebhookRequest): Promise<{ success: boolean; data: Webhook }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/${webhookId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update webhook');
    return response.json();
  }

  async deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) throw new Error('Failed to delete webhook');
    return response.json();
  }

  async testWebhook(webhookId: string): Promise<{ success: boolean; data: WebhookTestResult }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/${webhookId}/test`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to test webhook');
    return response.json();
  }

  async rotateWebhookSecret(webhookId: string): Promise<{ success: boolean; data: { secret: string; secret_suffix: string } }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/${webhookId}/rotate-secret`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to rotate webhook secret');
    return response.json();
  }

  async getWebhookDeliveries(webhookId: string, options?: { status?: string; limit?: number; offset?: number }): Promise<{ success: boolean; data: WebhookDelivery[] }> {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options?.status) params.append('status_filter', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `${API_BASE}${API_VERSION}/webhooks/${webhookId}/deliveries${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error('Failed to get webhook deliveries');
    return response.json();
  }

  async retryWebhookDelivery(deliveryId: string): Promise<{ success: boolean }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${API_VERSION}/webhooks/deliveries/${deliveryId}/retry`, {
      method: 'POST',
      headers,
    });
    if (!response.ok) throw new Error('Failed to retry delivery');
    return response.json();
  }
```

Add TypeScript types at the top of the file or in a types file:

```typescript
// Webhook Types
interface WebhookEventType {
  id: string;
  name: string;
  description: string;
  category: string;
  payload_example: Record<string, unknown>;
  is_active: boolean;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  description?: string;
  event_types: string[];
  secret_suffix: string;
  filter_department_ids?: string[];
  filter_tags?: string[];
  custom_headers?: Record<string, string>;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateWebhookRequest {
  name: string;
  url: string;
  event_types: string[];
  description?: string;
  filter_department_ids?: string[];
  filter_tags?: string[];
  custom_headers?: Record<string, string>;
}

interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  event_types?: string[];
  description?: string;
  filter_department_ids?: string[];
  filter_tags?: string[];
  custom_headers?: Record<string, string>;
  is_active?: boolean;
}

interface WebhookTestResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  error?: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt_count: number;
  response_status?: number;
  response_body?: string;
  response_time_ms?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}
```

### ✅ CHECKPOINT 3: API Ready

Before proceeding, verify:
- [ ] Router file created at `backend/routers/webhooks.py`
- [ ] Router registered in `backend/routers/v1.py`
- [ ] Server starts without errors
- [ ] `GET /api/v1/webhooks/event-types` returns 200
- [ ] API client methods added to `frontend/src/api.ts`
- [ ] TypeScript types defined

---

## Phase 4: Event Integration

### Stage 4.1: Create Event Emitters

**File:** `backend/webhooks/events.py`

```python
"""
Webhook Event Emitters

Convenience functions for emitting webhook events from various parts of the application.
"""

import asyncio
from typing import Optional, List, Dict, Any
from backend.webhooks.service import webhook_service, WebhookEvent
import logging

logger = logging.getLogger(__name__)


async def emit_decision_saved(
    company_id: str,
    decision: Dict[str, Any],
    user: Dict[str, Any],
    department_id: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> List[str]:
    """
    Emit decision.saved event.

    Called when a council decision is saved to the knowledge base.
    """
    event = WebhookEvent(
        event_type="decision.saved",
        company_id=company_id,
        department_id=department_id,
        tags=tags,
        data={
            "decision": {
                "id": decision.get("id"),
                "title": decision.get("title"),
                "content": decision.get("content"),
                "summary": decision.get("content_summary") or decision.get("summary"),
                "department": decision.get("department_name"),
                "tags": decision.get("tags", []),
                "created_at": decision.get("created_at")
            },
            "user": {
                "id": user.get("id"),
                "email": user.get("email")
            }
        }
    )
    return await webhook_service.dispatch_event(event)


async def emit_decision_promoted(
    company_id: str,
    decision: Dict[str, Any],
    promoted_to: Dict[str, Any],
    user: Dict[str, Any]
) -> List[str]:
    """
    Emit decision.promoted event.

    Called when a decision is promoted to a playbook or project.
    """
    event = WebhookEvent(
        event_type="decision.promoted",
        company_id=company_id,
        data={
            "decision": {
                "id": decision.get("id"),
                "title": decision.get("title")
            },
            "promoted_to": {
                "type": promoted_to.get("type"),
                "id": promoted_to.get("id"),
                "name": promoted_to.get("name") or promoted_to.get("title")
            },
            "user": {
                "id": user.get("id"),
                "email": user.get("email")
            }
        }
    )
    return await webhook_service.dispatch_event(event)


async def emit_conversation_completed(
    company_id: str,
    conversation: Dict[str, Any],
    synthesis: str,
    duration_ms: int
) -> List[str]:
    """
    Emit conversation.completed event.

    Called when a council deliberation completes all 3 stages.
    """
    event = WebhookEvent(
        event_type="conversation.completed",
        company_id=company_id,
        data={
            "conversation": {
                "id": conversation.get("id"),
                "title": conversation.get("title"),
                "question": conversation.get("last_question"),
                "synthesis": synthesis[:2000] if synthesis else None,  # Limit size
                "duration_ms": duration_ms
            }
        }
    )
    return await webhook_service.dispatch_event(event)


async def emit_conversation_exported(
    company_id: str,
    conversation_id: str,
    format: str,
    user: Dict[str, Any]
) -> List[str]:
    """
    Emit conversation.exported event.

    Called when a conversation is exported.
    """
    event = WebhookEvent(
        event_type="conversation.exported",
        company_id=company_id,
        data={
            "conversation_id": conversation_id,
            "format": format,
            "user": {
                "id": user.get("id"),
                "email": user.get("email")
            }
        }
    )
    return await webhook_service.dispatch_event(event)


async def emit_member_invited(
    company_id: str,
    email: str,
    role: str,
    invited_by: Dict[str, Any]
) -> List[str]:
    """
    Emit member.invited event.

    Called when a new team member is invited.
    """
    event = WebhookEvent(
        event_type="member.invited",
        company_id=company_id,
        data={
            "member": {
                "email": email,
                "role": role,
                "invited_by": invited_by.get("email")
            }
        }
    )
    return await webhook_service.dispatch_event(event)


async def emit_member_joined(
    company_id: str,
    member: Dict[str, Any]
) -> List[str]:
    """
    Emit member.joined event.

    Called when an invited member accepts and joins.
    """
    event = WebhookEvent(
        event_type="member.joined",
        company_id=company_id,
        data={
            "member": {
                "id": member.get("id"),
                "email": member.get("email"),
                "name": member.get("name") or member.get("full_name"),
                "role": member.get("role")
            }
        }
    )
    return await webhook_service.dispatch_event(event)


def emit_async(coro):
    """
    Helper to emit webhook events without blocking.

    Usage:
        emit_async(emit_decision_saved(company_id, decision, user))
    """
    asyncio.create_task(coro)
```

Update `backend/webhooks/__init__.py`:

```python
"""
Webhook System
"""

from backend.webhooks.crypto import (
    generate_webhook_secret,
    encrypt_webhook_secret,
    decrypt_webhook_secret,
    sign_webhook_payload,
    verify_webhook_signature
)
from backend.webhooks.service import (
    WebhookService,
    WebhookEvent,
    webhook_service
)
from backend.webhooks.events import (
    emit_decision_saved,
    emit_decision_promoted,
    emit_conversation_completed,
    emit_conversation_exported,
    emit_member_invited,
    emit_member_joined,
    emit_async
)

__all__ = [
    # Crypto
    "generate_webhook_secret",
    "encrypt_webhook_secret",
    "decrypt_webhook_secret",
    "sign_webhook_payload",
    "verify_webhook_signature",
    # Service
    "WebhookService",
    "WebhookEvent",
    "webhook_service",
    # Event emitters
    "emit_decision_saved",
    "emit_decision_promoted",
    "emit_conversation_completed",
    "emit_conversation_exported",
    "emit_member_invited",
    "emit_member_joined",
    "emit_async"
]
```

### Stage 4.2-4.3: Hook into Existing Code

**File:** `backend/routers/knowledge.py` (modify existing)

Find the function that saves decisions (look for `save_knowledge_entry` or similar) and add:

```python
# At the top, add import
from backend.webhooks import emit_decision_saved, emit_async

# After successful save (find where result is returned):
# Add webhook emission
if result:
    emit_async(emit_decision_saved(
        company_id=str(company_uuid),
        decision=result,
        user={"id": str(current_user.get("id")), "email": current_user.get("email")},
        department_id=str(department_uuid) if department_uuid else None,
        tags=entry_request.tags
    ))
```

**File:** `backend/routers/company/decisions.py` (if promotion is here)

Find the promotion function and add:

```python
# At the top, add import
from backend.webhooks import emit_decision_promoted, emit_async

# After successful promotion:
if promoted_doc:
    emit_async(emit_decision_promoted(
        company_id=str(company_id),
        decision={"id": decision_id, "title": decision.get("title")},
        promoted_to={
            "type": doc_type,
            "id": str(promoted_doc.get("id")),
            "name": promoted_doc.get("title")
        },
        user={"id": str(current_user.get("id")), "email": current_user.get("email")}
    ))
```

### Stage 4.4: Test Event Emission

```bash
# Start the server with debug logging
LOG_LEVEL=DEBUG python -m backend.main

# In another terminal:
# 1. Create a webhook pointing to webhook.site or similar
# 2. Save a decision in the UI
# 3. Check the logs for "Dispatched decision.saved to X webhooks"
# 4. Check webhook.site for received payload
```

### ✅ CHECKPOINT 4: Events Firing

Before proceeding, verify:
- [ ] `backend/webhooks/events.py` created
- [ ] Event emitters added to knowledge.py
- [ ] Event emitters added to decisions.py (if applicable)
- [ ] Server starts without errors
- [ ] Test: Save a decision → check logs for webhook dispatch
- [ ] Test: Webhook delivery record created in database

---

## Phase 5: Frontend UI

> **Note:** Detailed frontend implementation continues with WebhooksSection.tsx,
> useWebhooks.ts hook, and CSS files. Follow the patterns in Phase 5 of the
> detailed implementation plan.

### Files to Create

1. `frontend/src/components/settings/WebhooksSection.tsx` - Main component
2. `frontend/src/components/settings/hooks/useWebhooks.ts` - Data hook
3. `frontend/src/components/settings/webhooks/base.css` - Styling
4. Update `frontend/src/components/settings/index.tsx` - Add tab

### ✅ CHECKPOINT 5: UI Complete

Before proceeding, verify:
- [ ] WebhooksSection component renders
- [ ] Can create a webhook
- [ ] Can test a webhook
- [ ] Can delete a webhook
- [ ] Can rotate secret
- [ ] Secret displayed only once after creation
- [ ] Mobile responsive

---

## Phase 6: Testing

### Stage 6.1: Backend Unit Tests

**File:** `backend/tests/test_webhooks.py`

```python
"""Webhook System Tests"""

import pytest
from backend.webhooks.crypto import (
    generate_webhook_secret,
    encrypt_webhook_secret,
    decrypt_webhook_secret,
    sign_webhook_payload,
    verify_webhook_signature
)
from backend.webhooks.service import WebhookEvent


class TestWebhookCrypto:
    """Test cryptography functions."""

    def test_generate_secret_format(self):
        secret = generate_webhook_secret()
        assert secret.startswith("whsec_")
        assert len(secret) > 20

    def test_generate_secret_unique(self):
        secrets = [generate_webhook_secret() for _ in range(100)]
        assert len(set(secrets)) == 100

    def test_encrypt_decrypt_roundtrip(self):
        secret = "whsec_test_secret_12345"
        company_id = "company-123"

        encrypted, suffix = encrypt_webhook_secret(secret, company_id)
        decrypted = decrypt_webhook_secret(encrypted, company_id)

        assert decrypted == secret
        assert suffix == "2345"

    def test_sign_verify(self):
        payload = '{"event":"test"}'
        secret = "whsec_test"

        signature = sign_webhook_payload(payload, secret)
        assert verify_webhook_signature(payload, signature, secret)
        assert not verify_webhook_signature(payload, signature, "wrong")


class TestWebhookEvent:
    """Test WebhookEvent class."""

    def test_event_creation(self):
        event = WebhookEvent(
            event_type="decision.saved",
            company_id="company-123",
            data={"decision": {"id": "dec-1"}}
        )

        assert event.event_type == "decision.saved"
        assert event.event_id is not None
        assert event.payload["event"] == "decision.saved"
        assert event.payload["data"]["decision"]["id"] == "dec-1"
```

Run tests:

```bash
pytest backend/tests/test_webhooks.py -v
```

### ✅ CHECKPOINT 6: Tests Passing

Before proceeding, verify:
- [ ] Backend unit tests pass
- [ ] Frontend tests pass (if applicable)
- [ ] Manual test with real Zapier/Make webhook
- [ ] Webhook delivery logged correctly
- [ ] Retry logic works

---

## Phase 7: Deployment

### Stage 7.1: Environment Variables

Add to production environment:

```bash
# Required
WEBHOOK_ENCRYPTION_SECRET=<generate-32-char-secret>

# Or use existing key
USER_KEY_ENCRYPTION_SECRET=<existing-key>
```

Generate a secret:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Stage 7.2: Apply Migration to Production

```bash
# Using Supabase CLI
supabase db push --db-url "$PRODUCTION_DATABASE_URL"

# Or direct SQL
psql "$PRODUCTION_DATABASE_URL" -f supabase/migrations/20260129000000_webhook_system.sql
```

### Stage 7.3-7.5: Deploy and Verify

1. Deploy backend (Render/Railway/etc.)
2. Deploy frontend (Vercel/Netlify/etc.)
3. Smoke test:
   - Create a webhook
   - Test it
   - Save a decision
   - Verify delivery

### ✅ CHECKPOINT 7: Live

- [ ] Production database migrated
- [ ] Environment variables set
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Smoke test passed
- [ ] Monitoring in place

---

## Rollback Procedures

### If Database Migration Fails

```sql
-- Drop all webhook tables
DROP TABLE IF EXISTS public.webhook_deliveries CASCADE;
DROP TABLE IF EXISTS public.company_webhooks CASCADE;
DROP TABLE IF EXISTS public.webhook_event_types CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_webhooks_for_event;
DROP FUNCTION IF EXISTS public.update_webhook_delivery;
```

### If Backend Fails

1. Remove webhook router from `v1.py`
2. Redeploy backend
3. Events will fail silently (emit_async catches errors)

### If Frontend Fails

1. Remove Webhooks tab from Settings
2. Redeploy frontend
3. Backend continues to work

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/webhooks/event-types` | List available events |
| GET | `/webhooks` | List company webhooks |
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks/{id}` | Get webhook |
| PATCH | `/webhooks/{id}` | Update webhook |
| DELETE | `/webhooks/{id}` | Delete webhook |
| POST | `/webhooks/{id}/test` | Test webhook |
| POST | `/webhooks/{id}/rotate-secret` | Rotate secret |
| GET | `/webhooks/{id}/deliveries` | Get delivery history |
| POST | `/webhooks/deliveries/{id}/retry` | Retry delivery |

### Webhook Payload Format

```json
{
  "event": "decision.saved",
  "event_id": "evt_abc123",
  "timestamp": "2026-01-29T10:30:00Z",
  "data": {
    // Event-specific data
  }
}
```

### Signature Verification (for Recipients)

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

---

## Support

- **Documentation:** `/docs/webhooks/`
- **Issues:** GitHub Issues
- **Logs:** Check `webhook_deliveries` table for debugging

---

*Last updated: 2026-01-29*
