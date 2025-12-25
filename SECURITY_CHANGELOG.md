# Security Changelog

Internal record of security fixes and vulnerability remediations.

---

## 2024-12-24 - Comprehensive Security Audit Remediation

**Audit Source:** Internal penetration test / hostile actor assessment
**Auditor:** Security review
**Fixes Applied By:** Development team with AI assistance

### CATASTROPHIC Severity

#### CATASTROPHIC-1: Multi-tenant Data Exposure
- **Risk:** `list_available_businesses()` returned all companies regardless of user
- **Fix:** Added `user_id` parameter filtering in `context_loader.py:59-122`
- **Verification:** Only returns companies user owns or has department access to

### CRITICAL Severity

#### CRITICAL-1: Missing Rate Limits on AI Endpoints
- **Risk:** Attackers could drain API credits via unthrottled requests
- **Fix:** Added `@limiter.limit()` decorators to 6 AI-heavy endpoints in `main.py`:
  - `/api/knowledge/extract` - 10/min, 50/hour
  - `/api/projects/extract` - 10/min, 50/hour
  - `/api/projects/structure-context` - 10/min, 50/hour
  - `/api/projects/{id}/merge-decision` - 5/min, 30/hour
  - `/api/projects/{id}/regenerate-context` - 3/min, 15/hour
  - `/api/ai/write-assist` - 15/min, 100/hour

#### CRITICAL-2: Webhook Replay Attacks
- **Risk:** Stripe webhooks could be replayed to grant free subscriptions
- **Fix:** Added idempotency tracking in `billing.py:363-380`
- **Migration:** `20251224000000_webhook_idempotency.sql`

#### CRITICAL-3: Input Length Validation
- **Risk:** Massive payloads could cause token cost attacks
- **Fix:** Added `max_length` to all Pydantic request models in `main.py`:
  - Message content: 50,000 chars
  - Knowledge entries: 10,000-100,000 chars
  - Project context: 100,000 chars

#### CRITICAL-4: Error Information Leakage
- **Risk:** Stack traces exposed in production errors
- **Fix:** Enhanced `general_exception_handler` in `main.py` to suppress details in production
- **Feature:** Added error reference IDs for support tickets

### HIGH Severity

#### HIGH-1: Race Condition in Query Limits
- **Risk:** Concurrent requests could bypass billing limits
- **Fix:** Atomic `increment_query_usage()` PostgreSQL function
- **Migration:** `20251224110000_atomic_query_increment.sql`
- **Fallback:** Graceful degradation if migration not applied

#### HIGH-2: BYOK API Key Theft via Timing Attack
- **Risk:** Response time differences could leak key validity
- **Fix:** Constant-time response (500ms minimum) in `routers/settings.py`

#### HIGH-3: Streaming File Size Validation
- **Risk:** Large files could bypass Content-Length checks
- **Fix:** Streaming validation with 10MB limit in attachment upload endpoint

#### HIGH-4: Mock Mode in Production
- **Risk:** `MOCK_MODE=true` could bypass billing
- **Fix:** Restricted to development only via `ENVIRONMENT` check

#### HIGH-5: X-Forwarded-For Header Spoofing
- **Risk:** Attackers could spoof IP for rate limit bypass
- **Fix:** `TRUSTED_PROXIES` validation in `security.py:92-120`

#### HIGH-6: Insufficient Audit Logging
- **Risk:** Security events not tracked for forensics
- **Fix:** Added `log_security_event()` calls in `routers/company.py` for:
  - ACCESS_DENIED events
  - MEMBER_ADDED, MEMBER_REMOVED events
  - DECISION_DELETED events

### MEDIUM Severity

#### MEDIUM-1: BYOK Per-User Key Derivation
- **Risk:** Single encryption key for all users
- **Fix:** HKDF-based per-user key derivation in `utils/encryption.py:36-74`
- **Algorithm:** HKDF-SHA256 with user_id in info field

#### MEDIUM-2: UUID Path Parameter Validation
- **Risk:** Malformed UUIDs could cause injection
- **Fix:** `validate_uuid()` function applied to 12 endpoints in `main.py`

#### MEDIUM-3: ReDoS Prevention
- **Risk:** Catastrophic regex backtracking on malformed JSON
- **Fix:** Changed greedy `.*` to lazy `.*?` in JSON extraction regex

#### MEDIUM-4: Function Search Path Security
- **Risk:** Supabase SECURITY DEFINER functions vulnerable to search path injection
- **Fix:** Added `SET search_path = ''` to all 12 functions
- **Migration:** `20251224100000_fix_function_search_paths.sql`

#### MEDIUM-5: HSTS Header
- **Risk:** SSL stripping attacks possible
- **Fix:** Added `Strict-Transport-Security` header in `main.py`

#### MEDIUM-6: Console.log in Production
- **Risk:** Sensitive data in browser console
- **Fix:** `drop: ['console', 'debugger']` in `vite.config.js:52`

### Database Migrations Applied

| Migration | Description | Status |
|-----------|-------------|--------|
| `20251224000000_webhook_idempotency.sql` | Webhook replay protection | ✅ Applied |
| `20251224100000_fix_function_search_paths.sql` | Function security hardening | ✅ Applied |
| `20251224110000_atomic_query_increment.sql` | Race condition prevention | ✅ Applied |

### Files Modified

**Backend:**
- `main.py` - Rate limits, UUID validation, error handling, HSTS
- `billing.py` - Atomic increment, webhook idempotency
- `security.py` - IP validation, audit logging, PII masking
- `knowledge.py` - Multi-tenant access control
- `context_loader.py` - Company access filtering
- `byok.py` - Per-user key decryption
- `routers/company.py` - Audit logging
- `routers/settings.py` - Timing attack prevention
- `utils/encryption.py` - HKDF key derivation

**Frontend:**
- `vite.config.js` - Console stripping

**Migrations:**
- `supabase/migrations/20251224000000_webhook_idempotency.sql`
- `supabase/migrations/20251224100000_fix_function_search_paths.sql`
- `supabase/migrations/20251224110000_atomic_query_increment.sql`

### Commits

1. `51b5a34` - Initial security fixes (rate limits, webhook idempotency, input validation)
2. `88efe1d` - BYOK security (HKDF, timing attack, file streaming, mock mode)
3. `1ae8772` - Final fixes (atomic increment, UUID validation, error handling, audit logging)

---

## Security Contacts

For security issues, contact the development team directly.

## Compliance Notes

- GDPR: PII masking implemented in all logging functions
- HIPAA: No PHI logged; all user identifiers masked
- SOC2: Audit trail maintained via `log_security_event()`
