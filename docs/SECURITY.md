# Security Documentation

Last Updated: 2025-12-20 (commit e84360e)

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

All path parameters are validated against safe patterns:

```python
SAFE_ID_PATTERN = r'^[a-zA-Z0-9_-]+$'

ValidCompanyId = Annotated[str, Path(pattern=SAFE_ID_PATTERN)]
```

This prevents path traversal and injection attacks.

### File Upload Validation

- Allowed MIME types: images, PDFs, common documents
- File size limits enforced
- Filename sanitization

---

## Security Audit History

| Date | Commit | Summary |
|------|--------|---------|
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