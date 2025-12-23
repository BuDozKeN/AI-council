# AI Council Security Audit - Hostile Actor Assessment

**Audit Date:** 2025-12-23
**Auditor:** Security Assessment (Claude Opus)
**Scope:** Complete codebase security analysis
**Methodology:** Hostile actor perspective - finding all possible destruction vectors

---

## EXECUTIVE SUMMARY

This audit examines the AI Council codebase from the perspective of a malicious actor seeking to destroy the application. The codebase shows **mature security practices** in many areas (RLS, input validation, rate limiting, encryption), but several **critical and high-severity issues** remain that could enable significant damage.

**Overall Security Posture:** 6.5/10 - Good foundation with notable gaps

---

# 🔴 CATASTROPHIC FINDINGS (Fix immediately or don't launch)

## CATASTROPHIC-1: Service Role Key Exposure Risk
**Severity:** CATASTROPHIC | **Exploitability:** Medium

**Location:** Multiple files using `get_supabase_service()` without access verification

**Impact:**
- Complete bypass of Row Level Security (RLS)
- Access to ALL user data across ALL tenants
- Ability to modify/delete any record in the database

**Vulnerable Code Paths:**
| File | Function | Risk |
|------|----------|------|
| `context_loader.py:64-86` | `list_available_businesses()` | Lists ALL companies without filtering |
| `context_loader.py:107-125` | `load_company_context_from_db()` | Loads ANY company's context by ID |
| `context_loader.py:138-156` | `load_department_context_from_db()` | Loads ANY department context |

**Attack Scenario:**
1. Attacker discovers company UUIDs (enumerable or guessable)
2. Uses context loading endpoints to extract competitor's proprietary data
3. No authentication required for context_loader functions

**Remediation:**
```python
# Always verify user access before service role operations
def load_company_context_from_db(company_id: str, user_id: str, access_token: str) -> Optional[str]:
    verify_user_company_access(user_id, company_id, access_token)
    # ... rest of function
```

---

## CATASTROPHIC-2: BYOK API Key Theft Vector
**Severity:** CATASTROPHIC | **Exploitability:** Low-Medium

**Location:** `backend/byok.py`, `backend/utils/encryption.py`

**Vulnerability:**
If `ENCRYPTION_KEY` environment variable is compromised or weakly generated, ALL user API keys can be decrypted.

**Current Implementation Issues:**
1. Single encryption key for all users (single point of failure)
2. No key rotation mechanism
3. Encryption key logged on startup (`print(f"[BYOK] Encryption key loaded..."`)

**Attack Scenario:**
1. Attacker gains server access or logs
2. Extracts `ENCRYPTION_KEY` from environment/logs
3. Decrypts ALL OpenRouter API keys from database
4. Bills thousands of dollars in AI usage to victims

**Impact:**
- Financial destruction of users
- Regulatory violations (storing plaintext credentials)
- Complete loss of user trust

**Remediation:**
1. Use per-user derived keys (e.g., HKDF with user_id as context)
2. Implement key rotation
3. Remove all encryption key logging
4. Consider using AWS KMS/GCP KMS for key management

---

# 🔴 CRITICAL FINDINGS (Fix within 24 hours)

## CRITICAL-1: Missing Rate Limits on AI-Heavy Endpoints
**Severity:** CRITICAL | **Exploitability:** High

**Location:** `backend/main.py`

**Unprotected Endpoints:**
```python
# These endpoints trigger AI calls but have NO rate limits:
- POST /api/projects/{project_id}/merge-decision     # AI synthesis
- POST /api/projects/{project_id}/regenerate-context # AI regeneration
- POST /api/projects/structure-context               # AI structuring
- POST /api/knowledge/extract                        # AI extraction
- POST /api/ai/write-assist                          # AI writing
- POST /api/company/{id}/decisions/{id}/generate-summary # AI summary
```

**Attack Scenario:**
1. Attacker creates free account
2. Loops 10,000 requests to `/merge-decision` endpoint
3. Each request triggers expensive AI model calls
4. **Massive OpenRouter bill** accumulated in minutes

**Financial Impact:** $10,000+ in API costs per hour of abuse

**Remediation:**
```python
@router.post("/{project_id}/merge-decision")
@limiter.limit("5/minute;20/hour")  # Add rate limiting
async def merge_decision(...)
```

---

## CRITICAL-2: Webhook Replay Attack
**Severity:** CRITICAL | **Exploitability:** Medium

**Location:** `backend/billing.py:329-448`

**Vulnerability:**
No idempotency check on Stripe webhook events. Webhooks can be replayed.

**Attack Scenario:**
1. Attacker intercepts a `checkout.session.completed` webhook
2. Replays the webhook multiple times
3. User's subscription is reset/manipulated each time
4. Could reset `queries_used_this_period` to 0 infinitely

**Current Code:**
```python
def handle_webhook_event(payload: bytes, sig_header: str):
    # Only verifies signature, not idempotency
    event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    # ... processes event without checking if already processed
```

**Remediation:**
```python
# Add idempotency tracking
processed_events = set()  # Or use Redis/DB

def handle_webhook_event(payload, sig_header):
    event = stripe.Webhook.construct_event(...)

    if event['id'] in processed_events:
        return {"success": True, "status": "already_processed"}

    processed_events.add(event['id'])
    # ... process event
```

---

## CRITICAL-3: Insufficient Input Length Limits
**Severity:** CRITICAL | **Exploitability:** High

**Location:** Throughout `backend/main.py` and `backend/routers/company.py`

**Vulnerability:**
No maximum length validation on text inputs before sending to AI models.

**Attack Scenario:**
1. Submit a 10MB question to council endpoint
2. This gets appended to system prompts + context
3. Results in massive AI token costs
4. May crash models or cause timeouts

**Vulnerable Inputs:**
- `content` in message endpoints (no limit)
- `user_question` in extract endpoints (no limit)
- `decision_content` in merge endpoints (no limit)
- Playbook `content` field (no limit)
- Company `context_md` field (no limit)

**Remediation:**
```python
class MessageRequest(BaseModel):
    content: str = Field(..., max_length=50000)  # ~12K tokens
```

---

## CRITICAL-4: Error Messages Leak Stack Traces
**Severity:** CRITICAL | **Exploitability:** High

**Location:** Multiple `print(f"[ERROR]...")` statements

**Examples of Information Leakage:**
```python
# backend/main.py:1615
print(f"[ERROR] Failed to update project: {type(e).__name__}: {err_msg}", flush=True)

# backend/openrouter.py:224
print(f"[HTTP ERROR] Model {model}: Status {e.response.status_code} - {e.response.text[:200]}", flush=True)
```

**Impact:**
- Reveals internal architecture
- Exposes file paths
- Shows database schema details
- Aids in crafting targeted attacks

**Remediation:**
- Use structured logging with log levels
- Never include exception details in production logs visible to users
- Use Sentry for error tracking (already integrated but not fully used)

---

# 🟠 HIGH FINDINGS (Fix within 1 week)

## HIGH-1: Race Condition in Query Usage Tracking
**Location:** `backend/billing.py:299-326`

```python
def increment_query_usage(user_id: str, ...):
    # GET current count
    result = supabase.table('user_profiles').select('queries_used_this_period').eq('user_id', user_id).execute()
    current = result.data[0].get('queries_used_this_period', 0)

    # RACE CONDITION WINDOW HERE

    # INCREMENT and SAVE
    new_count = current + 1
    supabase.table('user_profiles').upsert({'queries_used_this_period': new_count, ...})
```

**Attack:** Submit 10 concurrent requests. All read `current=5`, all write `6`. User gets 10 free queries.

**Fix:** Use atomic increment:
```sql
UPDATE user_profiles SET queries_used_this_period = queries_used_this_period + 1 WHERE user_id = $1
```

---

## HIGH-2: Missing CORS Origin Validation
**Location:** `backend/main.py:229-232`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DANGEROUS IN PRODUCTION
    allow_credentials=True,
    ...
)
```

**Impact:** Any website can make authenticated requests to your API if user is logged in.

**Fix:**
```python
ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "https://app.yourdomain.com",
]
if os.getenv("ENVIRONMENT") == "development":
    ALLOWED_ORIGINS.append("http://localhost:5173")
```

---

## HIGH-3: No File Size Validation Before Processing
**Location:** `backend/main.py:1932-1955` (attachment upload)

While `MAX_FILE_SIZE = 10MB` exists, the file is fully loaded into memory before checking:

```python
async def upload_attachment(..., file: UploadFile):
    file_data = await file.read()  # Loads ENTIRE file into memory first
    if len(file_data) > MAX_FILE_SIZE:  # Only then checks size
        raise HTTPException(...)
```

**Attack:** Upload 100 concurrent 500MB files. Server runs out of memory and crashes.

**Fix:** Use streaming validation:
```python
async def upload_attachment(...):
    content = b''
    async for chunk in file:
        content += chunk
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, "File too large")
```

---

## HIGH-4: Potential IDOR in Project Access
**Location:** `backend/main.py:1576-1579`, `backend/storage.py`

```python
@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    project = storage.get_project(project_id, access_token)
    if not project:
        raise HTTPException(status_code=404, detail="Resource not found")
    # NO OWNERSHIP CHECK - relies entirely on RLS
```

**Risk:** If RLS policy is misconfigured, any user can access any project by ID.

**Defense in Depth Fix:**
```python
if project.get("user_id") != user["id"]:
    # Also check company membership if relevant
    raise HTTPException(403, "Access denied")
```

---

## HIGH-5: Timing Attack on API Key Validation
**Location:** `backend/byok.py:91-120`

```python
async def validate_openrouter_key(api_key: str) -> bool:
    try:
        response = await client.get(...)
        return response.status_code == 200
    except:
        return False
```

**Issue:** Response time differs based on key validity. Attacker can enumerate valid key prefixes.

---

## HIGH-6: No Audit Logging for Sensitive Operations
**Missing Logs For:**
- API key creation/deletion
- Subscription changes
- Company member additions/removals
- Bulk deletions
- Admin-level operations

---

# 🟡 MEDIUM FINDINGS

## MEDIUM-1: Session Token Not Invalidated on Password Change
`AuthContext.tsx` - No token revocation mechanism when password is updated.

## MEDIUM-2: Weak UUID Validation Pattern
```python
UUID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')  # Too permissive
```

## MEDIUM-3: No Request ID for Tracing
Makes debugging and incident response difficult.

## MEDIUM-4: Attachment Filenames Not Sanitized for Display
Path components could leak in error messages.

## MEDIUM-5: Mock Mode Toggle Accessible via API
```python
@app.post("/api/settings/mock-mode")  # Anyone can disable billing!
```

## MEDIUM-6: Missing CSP Headers
No Content-Security-Policy header to prevent XSS.

## MEDIUM-7: Frontend Bundle Contains Source Maps (Potentially)
Check production build configuration.

## MEDIUM-8: No Retry Limits on Password Reset
Could be used to spam users with reset emails.

---

# 🟢 LOW FINDINGS

## LOW-1: Verbose Error Messages in Console
All errors logged with full details.

## LOW-2: No Rate Limit on Leaderboard
Could be scraped for user enumeration.

## LOW-3: Missing robots.txt
API endpoints could be indexed.

## LOW-4: No Secure Cookie Attributes Verification
Check HttpOnly, Secure, SameSite flags.

## LOW-5: Test Files in Production?
Check if `/backend/test_*.py` files are deployed.

---

# ATTACK SURFACE MAP

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ATTACK SURFACE MAP                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  EXTERNAL                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   User Browser  │  │  Stripe Webhooks│  │  OpenRouter API │     │
│  │  (React SPA)    │  │                 │  │                 │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           ▼                    ▼                    ▼               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Backend                          │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │   │
│  │  │ Auth Layer    │ │ Rate Limiter  │ │ CORS Handler  │     │   │
│  │  │ (JWT/Supabase)│ │ (slowapi)     │ │ (OPEN!)       │     │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘     │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │                  API ENDPOINTS                        │ │   │
│  │  │  /api/conversations/*  [Rate Limited: 20/min]         │ │   │
│  │  │  /api/billing/*        [NO Rate Limit!]              │ │   │
│  │  │  /api/company/*        [Mixed]                        │ │   │
│  │  │  /api/projects/*       [NO Rate Limit on AI ops!]    │ │   │
│  │  │  /api/attachments/*    [10MB limit]                   │ │   │
│  │  │  /api/knowledge/*      [NO Rate Limit!]              │ │   │
│  │  │  /api/settings/*       [Sensitive!]                   │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUPABASE                                 │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │   │
│  │  │  Auth (JWT)   │ │ PostgreSQL    │ │   Storage     │     │   │
│  │  │               │ │ (RLS Enabled) │ │ (Attachments) │     │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘     │   │
│  │                                                             │   │
│  │  ⚠️  SERVICE ROLE KEY BYPASSES ALL RLS                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  SENSITIVE DATA STORES:                                             │
│  • user_api_keys (encrypted OpenRouter keys)                       │
│  • user_profiles (Stripe customer IDs, usage)                      │
│  • companies (proprietary business context)                        │
│  • knowledge_entries (saved decisions)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# SECURITY HARDENING CHECKLIST

## Immediate Actions (This Week)
- [ ] Add rate limits to ALL AI-calling endpoints
- [ ] Implement webhook idempotency tracking
- [ ] Add max_length validation to all text inputs
- [ ] Remove `allow_origins=["*"]` from CORS
- [ ] Add access verification to context_loader functions
- [ ] Remove encryption key logging
- [ ] Add file size streaming validation

## Short-term (This Month)
- [ ] Implement per-user derived encryption keys
- [ ] Add comprehensive audit logging
- [ ] Implement session token revocation
- [ ] Add CSP headers
- [ ] Create security monitoring dashboard
- [ ] Add request ID tracing
- [ ] Review and restrict mock mode toggle

## Long-term (This Quarter)
- [ ] Migrate to managed KMS for encryption
- [ ] Implement SOC 2 compliance controls
- [ ] Add penetration testing to CI/CD
- [ ] Implement bug bounty program
- [ ] Add WAF (Web Application Firewall)
- [ ] Implement anomaly detection on API usage

---

# AUTOMATED TESTING RECOMMENDATIONS

## Security Tests for CI/CD

```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Python dependency audit
      - name: Safety Check
        run: pip install safety && safety check -r backend/requirements.txt

      # JavaScript dependency audit
      - name: NPM Audit
        run: cd frontend && npm audit --audit-level=high

      # Static analysis for Python
      - name: Bandit Security Scan
        run: pip install bandit && bandit -r backend/ -ll

      # Secret scanning
      - name: GitLeaks
        uses: gitleaks/gitleaks-action@v2
```

## Load Testing Scenarios
```bash
# Test rate limiting effectiveness
artillery quick --count 100 -n 50 https://api.example.com/api/conversations/test/message

# Test concurrent file uploads
for i in {1..100}; do
  curl -X POST -F "file=@large_file.png" https://api/attachments/upload &
done
```

## Chaos Engineering Suggestions
1. **Database failover test:** Kill Supabase connection mid-transaction
2. **API key rotation:** Rotate encryption key, verify all operations still work
3. **AI provider failure:** Mock OpenRouter returning 500s for 5 minutes
4. **Webhook flood:** Send 1000 webhooks in 1 second
5. **Memory exhaustion:** Upload files until OOM

---

# PRIORITIZED REMEDIATION PLAN

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| P0 | CATASTROPHIC-1 (Service Role) | Medium | 10/10 |
| P0 | CATASTROPHIC-2 (BYOK Keys) | High | 10/10 |
| P1 | CRITICAL-1 (Rate Limits) | Low | 9/10 |
| P1 | CRITICAL-2 (Webhook Replay) | Low | 8/10 |
| P1 | CRITICAL-3 (Input Limits) | Low | 8/10 |
| P1 | CRITICAL-4 (Error Leaks) | Medium | 7/10 |
| P2 | HIGH-1 (Race Condition) | Low | 6/10 |
| P2 | HIGH-2 (CORS) | Low | 7/10 |
| P2 | HIGH-3 (File Size) | Low | 6/10 |
| P2 | HIGH-4 (IDOR) | Medium | 7/10 |

---

**This audit should be re-run after remediation and on a quarterly basis.**

*End of Hostile Security Assessment*
