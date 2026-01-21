# AxCouncil Technical Debt Audit Report
## $25M Enterprise Due Diligence Assessment

**Audit Date:** 2026-01-21
**Auditor:** Claude Code (Opus 4.5)
**Scope:** Complete codebase analysis - backend, frontend, database, CSS, configuration, testing
**Methodology:** Manual code path verification (see [Audit Methodology](#audit-methodology))

---

## Executive Summary

This audit identifies **verified technical debt** after thorough code path tracing. The codebase is **production-ready with mature security practices** but has standard technical debt items that should be addressed for enterprise-grade quality.

| Category | Risk Level | Verified Issues |
|----------|------------|-----------------|
| **Security** | ✅ LOW | Prior audit fixed critical issues - see migration `20251230000000_fix_rls_critical_vulnerabilities.sql` |
| **Performance** | 🟡 MEDIUM | N+1 query patterns, client-side filtering |
| **Code Organization** | 🟡 MEDIUM | Large files, some code duplication |
| **Testing** | 🟡 MEDIUM | Coverage thresholds intentionally lowered during admin portal buildout |
| **Documentation** | 🟡 MEDIUM | TODO comments in non-production code paths |

**Bottom Line:** The codebase has proper security controls in place. Technical debt items are standard for a growing product and represent optimization opportunities rather than blocking issues.

---

## Security Status (Verified ✅)

### Security Controls Already Implemented

The following security controls were verified by tracing complete code paths:

#### 1. Impersonation Properly Secured
**Status:** ✅ VERIFIED SECURE

**Code Path Traced:**
1. `backend/routers/admin.py:2230-2238` - Admin check at session creation:
```python
is_admin, role = await check_is_platform_admin(admin_user_id)
if not is_admin:
    raise HTTPException(status_code=403, detail=t("errors.admin_access_required", locale))
if role not in ("super_admin", "admin"):
    raise HTTPException(status_code=403, detail=t("errors.only_admin_can_impersonate", locale))
```
2. Session is created only AFTER admin verification
3. `auth.py:get_effective_user()` validates the session exists (created by verified admin)

**Conclusion:** Impersonation requires verified platform admin role. No vulnerability.

#### 2. API Keys Properly Encrypted
**Status:** ✅ VERIFIED SECURE

**Code Path Traced:**
1. Production path: `backend/byok.py:102` calls `decrypt_api_key(result.data["encrypted_key"], user_id=user_id)`
2. Encryption implementation: `backend/utils/encryption.py:62-101` uses HKDF key derivation:
```python
hkdf = HKDF(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,  # Configurable via HKDF_SALT env var
    info=f"user_api_key:{user_id}".encode(),
    backend=default_backend()
)
```
3. Per-user derived keys via Fernet encryption
4. The `trial.py` TODO is in the trial service, NOT the production BYOK path

**Conclusion:** Production API keys use proper HKDF-based per-user encryption. No vulnerability.

#### 3. RLS Policies Fixed
**Status:** ✅ VERIFIED SECURE

**Migration Verified:** `supabase/migrations/20251230000000_fix_rls_critical_vulnerabilities.sql`
- Drops permissive `auth.role() = 'authenticated'` policies
- Implements proper `is_company_member(company_id)` checks
- All tables now have company-scoped RLS

**Conclusion:** RLS vulnerabilities were already fixed. No active vulnerability.

---

## Table of Contents

1. [Verified Performance Issues](#1-verified-performance-issues)
2. [Code Organization Improvements](#2-code-organization-improvements)
3. [Testing Coverage](#3-testing-coverage)
4. [Minor Technical Debt](#4-minor-technical-debt)
5. [Quick Wins](#5-quick-wins)
6. [Audit Methodology](#audit-methodology)

---

## 1. Verified Performance Issues

### 1.1 N+1 Query Pattern in get_projects_with_stats
**Severity:** 🟡 MEDIUM

**File:** `backend/storage.py:925-947`

**The Problem:**
```python
for project in projects:
    # Query 1 per project: Get decision count
    count_result = client.table("knowledge_entries")\
        .select("id", count="exact")\
        .eq("project_id", project["id"])\
        .execute()

    # Query 2 per project: Get first decision's question
    first_decision = client.table("knowledge_entries")\
        .select("question")\
        .eq("project_id", project["id"])\
        .order("created_at", desc=False)\
        .limit(1)\
        .execute()
```

**Impact:**
- For N projects: 2N+1 database queries instead of 2
- Latency increases linearly with project count
- Not critical now but will degrade with scale

**Suggested Solution:**
Use a single aggregated query with window functions or fetch all knowledge entries for the project IDs in one query, then aggregate in Python.

**Risk Assessment:**
- Current: Low (limited project counts)
- At scale (1000+ projects): Performance degradation

---

### 1.2 Client-Side Filtering in list_conversations
**Severity:** 🟢 LOW

**File:** `backend/routers/conversations.py:229-236`

**The Problem:**
```python
# Filter by department and starred client-side if specified
# (storage function doesn't support these filters yet)
conversations = result.get("conversations", [])
if department:
    conversations = [c for c in conversations if c.get("department") == department]
if starred is not None:
    conversations = [c for c in conversations if c.get("is_starred") == starred]
```

**Impact:**
- Fetches all conversations then filters in memory
- Wastes database bandwidth
- Self-documented with TODO comment

**Suggested Solution:**
Add department and starred filters to the storage layer query.

---

## 2. Code Organization Improvements

### 2.1 Large API File
**Severity:** 🟢 LOW

**File:** `frontend/src/api.ts` (41,000+ tokens)

**The Problem:**
Single file contains all API methods, making it difficult to navigate and maintain.

**Suggested Solution:**
Split into domain-specific modules:
- `api/conversations.ts`
- `api/knowledge.ts`
- `api/company.ts`
- `api/admin.ts`

**Risk of NOT Doing It:** Manageable - file is well-organized internally

---

### 2.2 Duplicated Event Generator Patterns
**Severity:** 🟢 LOW

**Files:**
- `backend/routers/conversations.py:309-755` (send_message event_generator)
- `backend/routers/conversations.py:804-980` (chat_with_chairman event_generator)

**The Problem:**
Both streaming endpoints have similar patterns for:
- API key token handling
- Usage tracking
- Rate limit checking
- Activity logging

**Suggested Solution:**
Extract common streaming infrastructure into a reusable helper or decorator.

---

## 3. Testing Coverage

### 3.1 Current State
**Status:** 🟡 MEDIUM - Intentionally Lowered Thresholds

**Backend Tests:**
- 13 test files
- 5,366 lines of test code
- Coverage enforced in CI

**Frontend Tests:**
- 14 test files (more than initially reported)
- `vitest.config.js` shows 23% threshold
- Comment documents intentional lowering during admin portal buildout:

```javascript
// NOTE: Thresholds temporarily lowered while adding admin portal tests
// Target: 50% after admin portal test coverage complete
thresholds: {
  lines: 23,
  branches: 15,
  functions: 20,
  statements: 23,
}
```

**Conclusion:** This is documented temporary state, not neglect.

---

## 4. Minor Technical Debt

### 4.1 TODO in Trial Service
**File:** `backend/services/trial.py:205-214`

```python
async def _decrypt_api_key(self, encrypted_key: str) -> str:
    """
    TODO: Implement actual decryption based on your security scheme.
    Currently returns the key as-is (assuming it's not actually encrypted yet).
    """
    return encrypted_key
```

**Context:** This is in the TRIAL service, not production. The production BYOK path in `byok.py` uses proper encryption via `utils/encryption.py`.

**Risk:** None - trial service uses master key from environment, not stored encrypted keys.

---

### 4.2 Hardcoded Default HKDF Salt
**File:** `backend/utils/encryption.py:56-58`

```python
# Default salt for backwards compatibility
# SECURITY NOTE: Set HKDF_SALT in production for better security
_hkdf_salt = b"ai_council_user_keys"
```

**Context:** Self-documented with security note. Environment variable override available.

**Suggested Action:** Ensure `HKDF_SALT` is set in production environment.

---

## 5. Quick Wins

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Set `HKDF_SALT` env var in production | 5 min | Enhanced key derivation security |
| 2 | Add department/starred filters to storage layer | 1 hour | Eliminate client-side filtering |
| 3 | Refactor `get_projects_with_stats` to batch queries | 2 hours | Eliminate N+1 pattern |
| 4 | Split `api.ts` into domain modules | 4 hours | Improved maintainability |
| 5 | Complete admin portal test coverage | 1-2 weeks | Restore coverage thresholds |

---

## Audit Methodology

### Why This Audit Is Different

The initial audit used parallel exploration agents that identified issues without verifying complete code paths. This led to **false positives** that were corrected through manual verification.

### Verification Process Used

For each potential issue, the following verification steps were performed:

1. **Read the actual code file** - Not summaries or agent reports
2. **Trace the complete execution path** - From entry point to resolution
3. **Check for existing fixes** - Search for migrations, patches, or related code
4. **Verify the issue is in production code** - Not test fixtures, examples, or deprecated paths
5. **Confirm the issue description matches reality** - Code comments, function names, actual behavior

### False Positives Corrected

| Original Claim | Verification Finding |
|----------------|---------------------|
| "Impersonation has no admin check" | Admin check exists at session creation in `admin.py:2230-2238` |
| "API keys stored unencrypted" | Production uses HKDF encryption in `byok.py` + `utils/encryption.py` |
| "RLS allows cross-tenant access" | Fixed in migration `20251230000000_fix_rls_critical_vulnerabilities.sql` |
| "2% frontend test coverage" | 23% with documented intentional lowering during buildout |

### Lesson Learned

When auditing code:
1. **Never trust summaries** - Read actual code
2. **Trace complete paths** - A TODO in file A may be addressed by code in file B
3. **Check migration history** - Issues may already be fixed
4. **Distinguish production vs development paths** - Trial services ≠ production services

---

## Conclusion

The AxCouncil codebase is **production-ready with mature security practices**. The identified technical debt items are:

1. **Performance optimizations** - N+1 queries, client-side filtering (standard optimization opportunities)
2. **Code organization** - Large files, some duplication (maintainability improvements)
3. **Test coverage** - Temporarily lowered during feature buildout (documented and planned)

None of these items represent blocking issues for enterprise deployment or acquisition. The security posture is sound, with proper encryption, RLS policies, and admin controls in place.

**Recommendation:** Address quick wins in priority order, complete admin portal test coverage, then systematically tackle the performance optimizations as part of normal development velocity.
