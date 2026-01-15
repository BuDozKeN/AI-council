# Backend I18N Refactoring Status

## Overview
This document tracks the internationalization (i18n) refactoring of backend HTTPException error messages to use the centralized translation system.

## Completed Files (Previous Work)
1. ✅ `backend/routers/conversations.py`
2. ✅ `backend/routers/knowledge.py`
3. ✅ `backend/auth.py`
4. ✅ `backend/middleware/input_sanitization.py`

## Translation Keys Added
Added 44 new translation keys to both `en.json` and `es.json`:
- `admin_access_required`
- `owner_access_required`
- `no_updates_provided`
- `alert_not_found`
- `acknowledge_alert_failed`
- `persona_not_editable`
- `global_persona_not_found`
- `persona_update_failed`
- `persona_reset_failed`
- `invalid_preset_id`
- `preset_not_found`
- `preset_update_failed`
- `model_not_found`
- `model_update_failed`
- `model_create_failed`
- `model_already_exists`
- `model_delete_failed`
- `member_not_found`
- `only_owners_admins_add_members`
- `invalid_role`
- `user_email_not_found`
- `user_already_member`
- `member_add_failed`
- `only_owners_admins_update_members`
- `cannot_change_owner_role`
- `admins_cannot_modify_admins`
- `member_update_failed`
- `only_owners_admins_remove_members`
- `cannot_remove_yourself`
- `cannot_remove_owner`
- `admins_cannot_remove_admins`
- `only_owners_admins_view_usage`
- `decision_save_failed`
- `decision_archive_failed`
- `invalid_doc_type`
- `playbook_create_failed`
- `link_decision_failed`
- `invalid_uuid`
- `department_delete_failed`
- `role_delete_failed`
- `authentication_required`
- `project_delete_failed`
- `project_no_company`
- `rate_limits_update_failed`

## Files In Progress

### backend/routers/company/llm_ops.py (~40 instances)
**Status**: Partially complete (12/40 done)

**Completed**:
- ✅ Added i18n imports
- ✅ Updated `verify_admin_access()` helper
- ✅ Updated `verify_owner_access()` helper
- ✅ Updated `get_llm_usage()` endpoint
- ✅ Updated `get_rate_limit_status()` endpoint
- ✅ Updated `update_rate_limits()` endpoint
- ✅ Updated `get_budget_alerts()` endpoint
- ✅ Updated `acknowledge_alert()` endpoint
- ✅ Updated `get_llm_presets()` endpoint
- ✅ Updated `update_llm_preset()` endpoint (partial)

**Remaining** (28 instances):
- `get_model_registry()` endpoint
- `update_model_registry_entry()` endpoint
- `create_model_registry_entry()` endpoint
- `delete_model_registry_entry()` endpoint
- `get_personas()` endpoint
- `get_persona()` endpoint
- `update_persona()` endpoint
- `reset_persona()` endpoint

**Pattern to apply**:
```python
# Add at start of each endpoint:
locale = get_locale_from_request(request)

# Update all verify_admin_access calls:
verify_admin_access(client, company_uuid, user, locale)

# Update all verify_owner_access calls:
verify_owner_access(client, company_uuid, user, locale)

# Replace all HTTPException detail messages:
raise HTTPException(status_code=404, detail=t('errors.company_not_found', locale))
```

### backend/routers/company/members.py (~23 instances)
**Status**: Not started

**Key changes needed**:
1. Add `from ...i18n import t, get_locale_from_request`
2. Add `locale = get_locale_from_request(request)` to all endpoints
3. Update 23 HTTPException messages

**Endpoints to update**:
- `get_company_members()` - 1 instance
- `add_company_member()` - 6 instances
- `update_company_member()` - 5 instances
- `remove_company_member()` - 5 instances
- `get_company_usage()` - 6 instances

### backend/routers/company/decisions.py (~18 instances)
**Status**: Not started

**Key changes needed**:
1. Add `from ...i18n import t, get_locale_from_request`
2. Add `locale = get_locale_from_request(request)` to all endpoints
3. Update 18 HTTPException messages

**Endpoints to update**:
- `get_decisions()` - already has request parameter
- `create_decision()` - 1 instance
- `get_decision()` - 2 instances
- `archive_decision()` - 2 instances
- `delete_decision()` - 1 instance
- `promote_decision()` - 3 instances
- `link_decision_to_project()` - 3 instances
- `create_project_from_decision()` - 2 instances
- `get_project_decisions()` - 1 instance
- `sync_project_departments()` - 1 instance
- `generate_decision_summary()` - 2 instances

### backend/routers/company/team.py (~10 instances)
**Status**: Not started

**Key changes needed**:
1. Add `from ...i18n import t, get_locale_from_request`
2. Add `locale = get_locale_from_request(request)` to all endpoints
3. Update 10 HTTPException messages

**Endpoints to update**:
- `get_team()` - 1 instance
- `create_department()` - 1 instance
- `update_department()` - 1 instance
- `create_role()` - 1 instance
- `update_role()` - 1 instance
- `get_role()` - 1 instance
- `delete_department()` - 2 instances
- `delete_role()` - 2 instances

### backend/routers/projects.py (~8 instances)
**Status**: Not started

**Key changes needed**:
1. Add `from ..i18n import t, get_locale_from_request` (note: different import path)
2. Add `locale = get_locale_from_request(request)` to all endpoints
3. Update 8 HTTPException messages

**Endpoints to update**:
- `validate_uuid()` helper - 1 instance
- `create_project()` - 1 instance
- `get_project()` - 1 instance
- `update_project()` - 1 instance
- `delete_project()` - 2 instances
- `regenerate_project_context()` - 2 instances

## Additional Files to Check

After completing the above 5 high-priority files, these files should also be checked:

### backend/routers/company/__init__.py
- May contain shared utilities that throw HTTPExceptions

### backend/routers/company/utils.py
- Likely contains helper functions that throw HTTPExceptions
- Important: These helpers may be called from multiple files

### Other backend/routers/ files
- Check all remaining router files for HTTPException instances
- Priority: Any files with 3+ HTTPException instances

## Testing Checklist

After refactoring, test:

1. **Default locale (en)**:
   - All error messages display in English
   - Message formatting (placeholders) works correctly

2. **Spanish locale (es)**:
   - Set `Accept-Language: es` header
   - Verify all error messages display in Spanish
   - Check placeholder replacement works

3. **Missing translations**:
   - If a key is missing from locale file, should fall back to English
   - Log warning about missing key

4. **Error message parameters**:
   - Test messages with placeholders (e.g., `{email}`, `{field}`)
   - Verify parameter substitution works correctly

## Implementation Notes

### Import Paths
- Files in `backend/routers/`: Use `from ..i18n import t, get_locale_from_request`
- Files in `backend/routers/company/`: Use `from ...i18n import t, get_locale_from_request`
- Files in `backend/`: Use `from .i18n import t, get_locale_from_request`

### Common Pattern
```python
from fastapi import Request
from ...i18n import t, get_locale_from_request  # Adjust path as needed

@router.get("/endpoint")
async def my_endpoint(request: Request, ...):
    locale = get_locale_from_request(request)

    try:
        # ... code ...
    except HTTPException:
        raise HTTPException(status_code=404, detail=t('errors.not_found', locale))
```

### Helper Functions
When helper functions throw HTTPExceptions, they need a `locale` parameter:
```python
def verify_access(client, resource_id: str, user: dict, locale: str = 'en') -> dict:
    if not has_access:
        raise HTTPException(status_code=403, detail=t('errors.forbidden', locale))
    return resource
```

## Progress Summary

**Total files to refactor**: 9
**Files completed**: 4 (44%)
**Files in progress**: 1 (llm_ops.py - 30% complete)
**Files remaining**: 4

**Estimated instances**:
- Total: ~132 HTTPException messages
- Completed (previous): ~30 instances (23%)
- In progress (llm_ops.py): 12/40 complete (9%)
- Remaining: ~90 instances (68%)

## Next Steps

1. Complete `llm_ops.py` (28 instances remaining)
2. Refactor `members.py` (23 instances)
3. Refactor `decisions.py` (18 instances)
4. Refactor `team.py` (10 instances)
5. Refactor `projects.py` (8 instances)
6. Check and refactor additional backend files
7. Run full test suite
8. Test with different locale headers
9. Document any missing translation keys
