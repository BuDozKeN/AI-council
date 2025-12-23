# Security Documentation

Last Updated: 2025-12-24 (commits 51b5a34, 88efe1d, 1ae8772)

## Overview

This document outlines the security measures implemented in AI-Council to protect against common vulnerabilities and ensure multi-tenant data isolation.

---

## Authentication & Authorization

### Endpoint Protection

All API endpoints require authentication via Supabase JWT tokens:

```python
@app.get("/api/settings/mock-mode")
async def get_mock_mode(user: dict = Depends(get_current_user)):  # Auth required
```

**Protected endpoints include:**
- `/api/settings/*` - Runtime configuration toggles
- `/api/knowledge/*` - Knowledge base CRUD operations
- `/api/company/*` - Company management and decisions
- `/api/conversations/*` - Chat history
- `/api/attachments/*` - File uploads

### Multi-Tenant Access Control

All service client operations verify user access before executing:

| Function | Verification |
|----------|-------------|
| `create_knowledge_entry()` | `verify_user_company_access(user_id, company_id)` |
| `get_knowledge_entries()` | `verify_user_company_access(user_id, company_id)` |
| `update_knowledge_entry()` | `verify_user_entry_access(user_id, entry_id)` |
| `deactivate_knowledge_entry()` | `verify_user_entry_access(user_id, entry_id)` |

Company router endpoints use `verify_company_access(client, company_uuid, user)` before any data operations.

**Access is granted if:**
1. User owns the company (`companies.user_id = user.id`)
2. User has department access (`user_department_access` table)

---

## Network Security

### X-Forwarded-For Header Validation

The `get_client_ip()` function only trusts forwarded headers from known proxy IPs:

```python
trusted_proxies = os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1")

if direct_ip in trusted_proxies:
    # Only then trust X-Forwarded-For
    return forwarded.split(",")[0].strip()
```

**Configuration:** Set `TRUSTED_PROXIES` environment variable to your load balancer IPs.

### CORS Configuration

CORS origins are environment-conditional via `CORS_ORIGINS` env var. In production, restrict to your domain only.

### HSTS Header

Strict-Transport-Security header enforces HTTPS connections.

---

## Data Protection

### Row Level Security (RLS)

Supabase RLS policies enforce tenant isolation at the database level. The service client (`get_supabase_service()`) bypasses RLS but **always** performs access verification before operations.

### PII Masking

Logging functions mask sensitive data:

| Function | Purpose |
|----------|---------|
| `mask_email()` | Shows only domain: `***@example.com` |
| `mask_pii()` | Redacts sensitive fields from dicts |
| `mask_id()` | Shows first/last 4 chars: `abc1...xyz9` |

### Sensitive Field Filtering

The following fields are automatically masked in logs:
- `password`, `token`, `secret`, `api_key`
- `credentials`, `private_key`, `access_token`
- `refresh_token`, `authorization`

---

## Input Validation

### Path Parameter Validation

All UUID path parameters are validated:

```python
UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def validate_uuid(value: str, param_name: str) -> str:
    if not UUID_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {param_name} format")
    return value
```

This prevents SQL/NoSQL injection via malformed IDs.

### Request Body Validation

All Pydantic models enforce max length on text fields:

```python
class MessageRequest(BaseModel):
    content: str = Field(..., max_length=50000)
```

Length limits:
- Message content: 50,000 chars
- Knowledge entries: 10,000-100,000 chars
- Project context: 100,000 chars

### File Upload Validation

- Allowed MIME types: images, PDFs, common documents
- Streaming file size limit: 10MB
- Filename sanitization

---

## Rate Limiting

AI-heavy endpoints are rate limited to prevent credit drain attacks:

| Endpoint | Limit |
|----------|-------|
| `/api/knowledge/extract` | 10/min, 50/hour |
| `/api/projects/extract` | 10/min, 50/hour |
| `/api/projects/structure-context` | 10/min, 50/hour |
| `/api/projects/{id}/merge-decision` | 5/min, 30/hour |
| `/api/projects/{id}/regenerate-context` | 3/min, 15/hour |
| `/api/ai/write-assist` | 15/min, 100/hour |

---

## BYOK (Bring Your Own Key) Security

User API keys are encrypted with per-user derived keys:

1. Master key stored in `USER_KEY_ENCRYPTION_SECRET` environment variable
2. Per-user key derived via HKDF-SHA256 with user_id in info field
3. Keys encrypted with Fernet symmetric encryption

This ensures compromise of one user's key doesn't affect others.

### Timing Attack Prevention

Key validation endpoints use constant-time responses (500ms minimum) to prevent timing-based key enumeration.

---

## Billing & Webhook Security

### Atomic Query Increment

Query usage is incremented atomically via PostgreSQL function to prevent race conditions:

```sql
CREATE OR REPLACE FUNCTION increment_query_usage(p_user_id UUID)
RETURNS INTEGER AS $$
-- Uses INSERT ... ON CONFLICT for atomic increment
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Webhook Idempotency

Stripe webhooks are deduplicated via `processed_webhook_events` table to prevent replay attacks.

---

## Production Error Handling

In production, stack traces are suppressed and replaced with reference IDs:

```json
{"detail": "An error occurred. Reference: AB12CD34"}
```

Internal errors are logged with full details for debugging.

---

## Database Security

### Function Search Path

All SECURITY DEFINER functions include `SET search_path = ''` to prevent search path injection attacks.

### Migrations Applied

| Migration | Purpose |
|-----------|---------|
| `20251224000000_webhook_idempotency.sql` | Webhook replay protection |
| `20251224100000_fix_function_search_paths.sql` | Function security hardening |
| `20251224110000_atomic_query_increment.sql` | Race condition prevention |

---

## Security Audit History

| Date | Commit | Summary |
|------|--------|---------|
| 2025-12-24 | 1ae8772 | Atomic query increment, UUID validation, production error handling, ReDoS fix, audit logging |
| 2025-12-24 | 88efe1d | BYOK per-user HKDF keys, timing attack prevention, streaming file validation, mock mode restriction |
| 2025-12-24 | 51b5a34 | Rate limits on AI endpoints, webhook idempotency, input length validation, multi-tenant access control |
| 2025-12-22 | - | Service role key audit (see SECURITY_AUDIT.md) |
| 2025-12-20 | e84360e | Fixed unauthenticated admin endpoints, RLS bypass, X-Forwarded-For spoofing |

---

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to the maintainers rather than opening a public issue.

---

## Checklist for New Endpoints

When adding new API endpoints, ensure:

- [ ] `Depends(get_current_user)` is added to require authentication
- [ ] `verify_company_access()` or `verify_user_company_access()` is called before service client operations
- [ ] Path parameters use validated `Annotated` types
- [ ] Sensitive data is not logged directly (use `mask_*` functions)
- [ ] Error responses use `SecureHTTPException` to avoid leaking internal details