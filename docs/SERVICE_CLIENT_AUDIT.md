# Service Client Usage Audit

## Overview

The backend uses `get_supabase_service()` which bypasses RLS policies. This audit identifies where it's used and recommends switching to `get_supabase_with_auth(access_token)` where appropriate.

## Risk Levels

| Level | Description |
|-------|-------------|
| **Safe** | Service client appropriate (no user context, admin operation) |
| **Recommended** | Could use auth client for defense in depth |
| **Required** | Must switch to auth client to enforce RLS |

---

## File: `backend/knowledge.py`

### Current State
Uses service client for all operations with manual `verify_user_company_access()` checks.

### Analysis

| Function | Line | Current | Recommendation |
|----------|------|---------|----------------|
| `create_knowledge_entry` | 51-65 | ✅ Uses auth client + RPC first | Safe - already uses `get_supabase_with_auth` |
| `create_knowledge_entry` | 84 | ⚠️ Fallback to service client | **Required**: Pass access_token to all callers |
| `get_knowledge_entries` | 142 | ⚠️ Service client | **Recommended**: Use auth client with RLS |
| `get_injectable_entries` | 195 | ⚠️ Service client | **Recommended**: Internal, but could use RLS |
| `update_knowledge_entry` | 322 | ⚠️ Service client | **Required**: Has access_token param, should use it |
| `get_knowledge_count_for_conversation` | 343 | ⚠️ Service client | **Recommended**: Add access_token param |
| `deactivate_knowledge_entry` | 373 | ⚠️ Service client | **Required**: Has access_token param, should use it |

### Recommended Changes

```python
# update_knowledge_entry - line 322
def update_knowledge_entry(
    entry_id: str,
    user_id: str,
    updates: Dict[str, Any],
    access_token: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    # SECURITY: Use auth client if access_token provided
    if access_token:
        client = get_supabase_with_auth(access_token)
    else:
        # Fallback: verify access manually
        if not verify_user_entry_access(user_id, entry_id, "knowledge_entries"):
            log_security_event("UPDATE_BLOCKED", ...)
            return None
        client = get_supabase_service()

    # ... rest of function
```

---

## File: `backend/context_loader.py`

### Current State
Uses service client for all read operations. No access_token parameter available.

### Analysis

| Function | Line | Current | Recommendation |
|----------|------|---------|----------------|
| `list_available_businesses` | 87 | ⚠️ Service client | Safe - manually filters by user_id |
| `load_company_context_from_db` | 180 | ⚠️ Service client | **Recommended**: Add access_token, use RLS |
| `load_department_context_from_db` | 214 | ⚠️ Service client | **Recommended**: Add access_token |
| `load_role_prompt_from_db` | 245 | ⚠️ Service client | **Recommended**: Add access_token |
| `get_company_departments` | 276 | ⚠️ Service client | **Recommended**: Add access_token |
| `get_department_roles` | 325 | ⚠️ Service client | **Recommended**: Add access_token |
| `get_company_playbooks` | 354 | ⚠️ Service client | **Recommended**: Add access_token |
| `build_council_context` | 670, 788, 826 | ⚠️ Service client | Context building - internal |

### Recommended Pattern

Add `access_token` parameter to all public functions and propagate through call chain:

```python
def load_company_context_from_db(
    company_id: str,
    access_token: Optional[str] = None
) -> Optional[str]:
    if access_token:
        client = get_supabase_with_auth(access_token)
    else:
        client = get_supabase_service()
    # RLS will enforce access if using auth client
```

---

## File: `backend/routers/knowledge.py`

### Analysis

| Function | Line | Current | Recommendation |
|----------|------|---------|----------------|
| `create_project_entry` | 118 | ⚠️ Fetches project with service client | **Required**: Use auth client |
| `promote_to_playbook` | 365 | ⚠️ Service client | **Required**: Use auth client |
| `promote_to_project` | 423 | ⚠️ Service client | **Required**: Use auth client |

These are API endpoints that have `user = Depends(get_current_user)` which includes `access_token`.

---

## File: `backend/routers/company.py`

### Analysis

| Function | Line | Current | Recommendation |
|----------|------|---------|----------------|
| `_get_service_client` | 175 | Service client helper | Used for read-only operations where user is authenticated |

Most operations here are read-only after authentication. The RLS fix already protects the data, but using auth client would add defense in depth.

---

## Files: Safe to Keep Service Client

| File | Reason |
|------|--------|
| `billing.py` | Webhook processing - no user context |
| `attachments.py` | Storage operations with validated paths |
| `leaderboard.py` | Global analytics, read-only |
| `byok.py` | Admin key management |
| `routers/company/utils.py` | Internal helper, access verified separately |

---

## Implementation Priority

### Phase 1: Critical (Mutation endpoints)
1. `routers/knowledge.py:create_project_entry` - Switch to auth client
2. `routers/knowledge.py:promote_to_playbook` - Switch to auth client
3. `routers/knowledge.py:promote_to_project` - Switch to auth client
4. `knowledge.py:update_knowledge_entry` - Use access_token when provided
5. `knowledge.py:deactivate_knowledge_entry` - Use access_token when provided

### Phase 2: Recommended (Read operations)
1. Add `access_token` parameter to `context_loader.py` functions
2. Propagate through call chain from API endpoints
3. Use auth client when token available, fall back to service client

### Phase 3: Nice to Have
1. Audit remaining service client usage
2. Add telemetry to track service vs auth client usage
3. Consider removing service client fallback entirely for user-facing endpoints

---

## Quick Win: Router Endpoints

These endpoints already have `access_token` available via `user["access_token"]`:

```python
# routers/knowledge.py - line 118
# BEFORE
service_client = get_supabase_service()
project_result = service_client.table("projects").select("*").eq("id", project_id).single().execute()

# AFTER
access_token = user.get("access_token")
client = get_supabase_with_auth(access_token) if access_token else get_supabase_service()
project_result = client.table("projects").select("*").eq("id", project_id).single().execute()
```

This leverages the new RLS policies to automatically enforce access control.
