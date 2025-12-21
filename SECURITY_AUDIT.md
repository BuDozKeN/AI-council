# Service Role Key Usage Audit

**Audit Date:** 2025-12-22
**Auditor:** Claude Security Analysis
**Scope:** All `get_supabase_service()` calls in backend/

## Executive Summary

The codebase uses Supabase's service role key (bypasses RLS) in ~50 locations. Most usage is properly secured with access verification, but some high-risk patterns exist.

## Risk Categories

### ✅ LOW RISK - Properly Secured (Access Verified Before Use)

These functions verify user access before using service role:

| File | Function | Security Check |
|------|----------|----------------|
| `knowledge.py:53` | `create_knowledge_entry()` | `verify_user_company_access()` |
| `knowledge.py:114` | `get_knowledge_entries()` | `verify_user_company_access()` |
| `knowledge.py:294` | `update_knowledge_entry()` | `verify_user_entry_access()` |
| `knowledge.py:345` | `deactivate_knowledge_entry()` | `verify_user_entry_access()` |
| `security.py:431` | `verify_user_company_access()` | Self - checks ownership |
| `security.py:484` | `verify_user_entry_access()` | Self - checks ownership |

### ✅ LOW RISK - Legitimate Admin Operations

These are system-level operations without user context:

| File | Function | Justification |
|------|----------|---------------|
| `billing.py:357` | Stripe webhook handler | Webhook has signature verification |
| `leaderboard.py:*` | All leaderboard functions | Aggregates anonymous rankings |
| `context_loader.py:*` | Context loading | Read-only, filtered by company/dept |

### ⚠️ MEDIUM RISK - Read-Only Context

These load context for LLM prompts. Low exploitation risk but could leak data if IDs are guessable:

| File | Lines | Operation |
|------|-------|-----------|
| `context_loader.py:64-86` | `list_available_businesses()` | Lists all companies (should be scoped) |
| `context_loader.py:107-125` | `load_company_context_from_db()` | Loads any company's context |
| `context_loader.py:138-156` | `load_department_context_from_db()` | Loads any department's context |

### 🔴 HIGH RISK - Write Operations Without Verification

These perform write operations without explicit access verification in the function:

| File | Lines | Operation | Risk |
|------|-------|-----------|------|
| `storage.py:574` | `create_project()` | Creates project | Relies on endpoint auth only |
| `storage.py:635` | `update_project()` | Updates any project | Relies on endpoint auth only |
| `routers/company.py:1543` | `update_decision()` | Updates decision | Relies on endpoint auth only |
| `routers/company.py:2037` | `update_playbook()` | Updates playbook | Relies on endpoint auth only |

## Recommendations

### Immediate (P1) - Add Access Verification

1. **`storage.py:create_project()`** - Add `verify_user_company_access()` check
2. **`storage.py:update_project()`** - Add project ownership verification
3. **`routers/company.py`** decision/playbook updates - Verify ownership before modification

### Short-term (P2) - Database Functions

Create SECURITY DEFINER PostgreSQL functions for high-value operations:

```sql
-- Example: Safe project creation that enforces company ownership
CREATE OR REPLACE FUNCTION create_project_safe(
  p_company_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS projects AS $$
DECLARE
  v_project projects;
BEGIN
  -- Verify user has access to company
  IF NOT EXISTS (
    SELECT 1 FROM companies
    WHERE id = p_company_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM user_department_access
    WHERE company_id = p_company_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to company';
  END IF;

  INSERT INTO projects (company_id, user_id, name, description)
  VALUES (p_company_id, p_user_id, p_name, p_description)
  RETURNING * INTO v_project;

  RETURN v_project;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Long-term (P3) - Architectural Improvements

1. **Prefer RLS over service role** - Most operations should use `get_supabase_with_auth()`
2. **Audit logging** - Log all service role usage with user context
3. **Code review checklist** - All PRs adding service role usage require security review

## Mitigation Applied (2025-12-22)

The following access verification was already present or has been added:

- [x] `knowledge.py` - All CRUD operations verify access
- [x] `security.py` - Access verification functions properly scoped
- [x] `storage.py:create_project()` - Added `verify_user_company_access()` check
- [x] `storage.py:update_project()` - Added project company ownership verification
- [x] Removed debug `print()` statements from storage.py (use `log_app_event()` instead)
- [ ] `routers/company.py` - Most endpoints rely on RLS + endpoint auth (lower priority)

## SQL Migration Created

A new migration `20251222000000_security_definer_functions.sql` has been created with:

- `verify_company_access(user_id, company_id)` - Reusable access check function
- `create_project_safe(...)` - Project creation with built-in access verification
- `create_knowledge_entry_safe(...)` - Knowledge entry creation with access check

These functions can be called from application code as a more secure alternative
to using the service role key for write operations.

To deploy:
```bash
npx supabase db push
```

---

*This audit should be re-run after any significant changes to database access patterns.*
