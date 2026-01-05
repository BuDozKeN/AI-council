# Unified Delete System - Implementation Plan

> **Status**: Planning
> **Priority**: High (Consistency across platform)
> **Estimated Effort**: Medium (2-3 development sessions)

## Executive Summary

This plan establishes a **unified delete system** across the AxCouncil platform. Currently, delete functionality is scattered across multiple patterns, with departments and roles missing delete capability entirely. This plan creates a single, consistent approach that:

1. Reduces code duplication
2. Ensures consistent UX across all entity types
3. Makes adding delete to new entities trivial
4. Guarantees all deletions are logged for audit

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Design](#2-architecture-design)
3. [Implementation Phases](#3-implementation-phases)
4. [Phase 1: Backend DELETE Endpoints](#phase-1-backend-delete-endpoints)
5. [Phase 2: Frontend API Layer](#phase-2-frontend-api-layer)
6. [Phase 3: Unified Delete Modal Component](#phase-3-unified-delete-modal-component)
7. [Phase 4: Migrate Existing Delete UIs](#phase-4-migrate-existing-delete-uis)
8. [Phase 5: Add Delete to Missing Entities](#phase-5-add-delete-to-missing-entities)
9. [Testing Strategy](#testing-strategy)
10. [Rollback Plan](#rollback-plan)
11. [Future Considerations](#future-considerations)

---

## 1. Current State Analysis

### 1.1 Existing Delete Patterns (Inconsistent)

| Entity | UI Pattern | Frontend API | Backend Endpoint | Activity Log |
|--------|------------|--------------|------------------|--------------|
| **Conversations** | Dedicated `DeleteModal.tsx` | `deleteConversation()` | `DELETE /conversations/{id}` | ✅ |
| **Projects** | Inline confirm in `ViewProjectModal` | `deleteProject()` | `DELETE /projects/{id}` | ✅ |
| **Playbooks** | ❌ No UI (API exists) | `deletePlaybook()` | `DELETE /company/{id}/playbooks/{id}` | ✅ |
| **Decisions** | ❌ No UI (API exists) | `deleteDecision()` | `DELETE /company/{id}/decisions/{id}` | ✅ |
| **Attachments** | ❌ No UI (API exists) | `deleteAttachment()` | `DELETE /attachments/{id}` | ❌ |
| **API Keys** | ❌ No UI (API exists) | `deleteOpenRouterKey()` | `DELETE /openrouter-key` | ❌ |
| **Model Registry** | ❌ No UI (API exists) | `deleteModelRegistryEntry()` | `DELETE /.../models/{id}` | ✅ |

### 1.2 Missing Delete Functionality (Critical Gap)

| Entity | UI | Frontend API | Backend Endpoint | Status |
|--------|-----|--------------|------------------|--------|
| **Departments** | ❌ | ❌ | ❌ | **COMPLETELY MISSING** |
| **Roles** | ❌ | ❌ | ❌ | **COMPLETELY MISSING** |

### 1.3 Problems with Current Approach

1. **3 Different UI Patterns**:
   - Dedicated modal (`DeleteModal.tsx` for conversations)
   - Inline confirmation embedded in view modal (`ViewProjectModal.tsx`)
   - No UI at all (playbooks, decisions, etc.)

2. **Inconsistent Error Handling**: Each implementation handles errors differently

3. **Inconsistent Activity Logging**: Some entities log, others don't

4. **Code Duplication**: Similar confirmation logic repeated across components

5. **Maintenance Burden**: Adding delete to new entities requires implementing from scratch

---

## 2. Architecture Design

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED DELETE SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           UnifiedDeleteModal.tsx                        │   │
│  │  - Config-driven (entity type → messages, warnings)     │   │
│  │  - Consistent UI: ConfirmModal with variant="danger"    │   │
│  │  - Loading states, error handling                       │   │
│  │  - Success callback for cache invalidation              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           deleteConfig.ts                               │   │
│  │  - Entity-specific configuration                        │   │
│  │  - Titles, messages, warnings                           │   │
│  │  - Cascade delete warnings                              │   │
│  │  - i18n translation keys                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           api.ts (Entity-specific delete methods)       │   │
│  │  - deleteConversation()                                 │   │
│  │  - deleteProject()                                      │   │
│  │  - deleteDepartment() ← NEW                             │   │
│  │  - deleteRole() ← NEW                                   │   │
│  │  - etc.                                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Backend DELETE Endpoints                      │   │
│  │  - Standard pattern for all entities                    │   │
│  │  - Verify ownership → Delete related → Delete main      │   │
│  │  - Activity logging for all                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Design Decisions

1. **Single Modal Component**: One `UnifiedDeleteModal` for ALL entities
2. **Config-Driven**: Entity-specific text/warnings defined in `deleteConfig.ts`
3. **Keep Entity-Specific API Methods**: More readable than generic `deleteEntity(type, id)`
4. **Standardized Backend Pattern**: All DELETE endpoints follow same structure
5. **Mandatory Activity Logging**: All deletions logged for audit trail

### 2.3 File Structure

```
frontend/src/
├── components/ui/
│   ├── UnifiedDeleteModal.tsx       # NEW - Single delete modal
│   └── ConfirmModal.tsx             # Existing - Used internally
├── config/
│   └── deleteConfig.ts              # NEW - Entity configurations
├── api.ts                           # Add missing delete methods

backend/routers/
├── company/
│   └── team.py                      # Add DELETE endpoints
```

---

## 3. Implementation Phases

### Phase Overview

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| 1 | Backend DELETE endpoints for departments/roles | Small | None |
| 2 | Frontend API layer methods | Small | Phase 1 |
| 3 | Unified Delete Modal component | Medium | Phase 2 |
| 4 | Migrate existing delete UIs | Medium | Phase 3 |
| 5 | Add delete to all missing entities | Small | Phase 3 |

---

## Phase 1: Backend DELETE Endpoints

### 1.1 Add to `backend/routers/company/team.py`

**File**: `backend/routers/company/team.py`

#### Delete Department Endpoint

```python
@router.delete("/{company_id}/departments/{dept_id}")
async def delete_department(
    company_id: ValidCompanyId,
    dept_id: ValidDeptId,
    user=Depends(get_current_user)
):
    """
    Delete a department and all its roles permanently.

    Cascade deletes:
    - All roles in this department
    - All department links (playbook associations, etc.)
    """
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # 1. Verify department exists and user has access
    existing = client.table("departments") \
        .select("id, name") \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Department not found")

    dept_name = existing.data.get("name", "Department")

    # 2. Count roles for logging
    roles_result = client.table("roles") \
        .select("id", count="exact") \
        .eq("department_id", dept_id) \
        .execute()
    role_count = roles_result.count or 0

    # 3. Delete all roles in this department
    client.table("roles") \
        .delete() \
        .eq("department_id", dept_id) \
        .execute()

    # 4. Delete department links (org_document_departments, project_departments, etc.)
    client.table("org_document_departments") \
        .delete() \
        .eq("department_id", dept_id) \
        .execute()

    client.table("project_departments") \
        .delete() \
        .eq("department_id", dept_id) \
        .execute()

    client.table("knowledge_entry_departments") \
        .delete() \
        .eq("department_id", dept_id) \
        .execute()

    # 5. Delete the department
    client.table("departments") \
        .delete() \
        .eq("id", dept_id) \
        .eq("company_id", company_uuid) \
        .execute()

    # 6. Log activity
    await log_activity(
        company_id=company_uuid,
        event_type="department",
        title=f"Deleted: {dept_name}",
        description=f"Department and {role_count} role(s) permanently deleted",
        related_id=dept_id,
        related_type="department"
    )

    return {
        "success": True,
        "message": f"Department '{dept_name}' and {role_count} role(s) deleted",
        "deleted_roles": role_count
    }
```

#### Delete Role Endpoint

```python
@router.delete("/{company_id}/departments/{dept_id}/roles/{role_id}")
async def delete_role(
    company_id: ValidCompanyId,
    dept_id: ValidDeptId,
    role_id: ValidRoleId,
    user=Depends(get_current_user)
):
    """Delete a role permanently."""
    client = get_client(user)
    company_uuid = resolve_company_id(client, company_id)

    # 1. Verify role exists
    existing = client.table("roles") \
        .select("id, name, department_id") \
        .eq("id", role_id) \
        .eq("department_id", dept_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Role not found")

    role_name = existing.data.get("name", "Role")

    # 2. Delete the role
    client.table("roles") \
        .delete() \
        .eq("id", role_id) \
        .execute()

    # 3. Log activity
    await log_activity(
        company_id=company_uuid,
        event_type="role",
        title=f"Deleted: {role_name}",
        description="Role was permanently deleted",
        related_id=role_id,
        related_type="role"
    )

    return {"success": True, "message": f"Role '{role_name}' deleted"}
```

### 1.2 Checklist

- [ ] Add `delete_department` endpoint to `team.py`
- [ ] Add `delete_role` endpoint to `team.py`
- [ ] Import `log_activity` from utils if not already imported
- [ ] Test endpoints manually with curl/Postman
- [ ] Write backend unit tests for both endpoints

---

## Phase 2: Frontend API Layer

### 2.1 Add to `frontend/src/api.ts`

**File**: `frontend/src/api.ts`

```typescript
/**
 * Delete a department and all its roles
 */
async deleteCompanyDepartment(companyId: string, departmentId: string): Promise<{
  success: boolean;
  message: string;
  deleted_roles: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE}${API_VERSION}/company/${companyId}/departments/${departmentId}`,
    {
      method: 'DELETE',
      headers,
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete department' }));
    throw new Error(error.detail || 'Failed to delete department');
  }
  return response.json();
}

/**
 * Delete a role
 */
async deleteCompanyRole(
  companyId: string,
  departmentId: string,
  roleId: string
): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE}${API_VERSION}/company/${companyId}/departments/${departmentId}/roles/${roleId}`,
    {
      method: 'DELETE',
      headers,
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete role' }));
    throw new Error(error.detail || 'Failed to delete role');
  }
  return response.json();
}
```

### 2.2 Checklist

- [ ] Add `deleteCompanyDepartment` method
- [ ] Add `deleteCompanyRole` method
- [ ] Add TypeScript return types
- [ ] Test API methods from console

---

## Phase 3: Unified Delete Modal Component

### 3.1 Delete Configuration File

**File**: `frontend/src/config/deleteConfig.ts`

```typescript
import type { ReactNode } from 'react';

export type DeleteEntityType =
  | 'conversation'
  | 'project'
  | 'department'
  | 'role'
  | 'playbook'
  | 'decision'
  | 'attachment'
  | 'modelRegistryEntry';

export interface DeleteConfig {
  /** i18n key for modal title */
  titleKey: string;
  /** i18n key for confirmation message */
  messageKey: string;
  /** i18n key for additional warning (cascade deletes, etc.) */
  warningKey?: string;
  /** i18n key for confirm button text */
  confirmTextKey: string;
  /** Whether this delete cascades to other entities */
  hasCascade: boolean;
  /** Icon to show (optional) */
  icon?: ReactNode;
}

export const DELETE_CONFIGS: Record<DeleteEntityType, DeleteConfig> = {
  conversation: {
    titleKey: 'delete.conversation.title',
    messageKey: 'delete.conversation.message',
    confirmTextKey: 'delete.conversation.confirm',
    hasCascade: false,
  },
  project: {
    titleKey: 'delete.project.title',
    messageKey: 'delete.project.message',
    warningKey: 'delete.project.warning',
    confirmTextKey: 'delete.project.confirm',
    hasCascade: true, // Deletes decisions linked to project
  },
  department: {
    titleKey: 'delete.department.title',
    messageKey: 'delete.department.message',
    warningKey: 'delete.department.warning',
    confirmTextKey: 'delete.department.confirm',
    hasCascade: true, // Deletes all roles in department
  },
  role: {
    titleKey: 'delete.role.title',
    messageKey: 'delete.role.message',
    confirmTextKey: 'delete.role.confirm',
    hasCascade: false,
  },
  playbook: {
    titleKey: 'delete.playbook.title',
    messageKey: 'delete.playbook.message',
    confirmTextKey: 'delete.playbook.confirm',
    hasCascade: false,
  },
  decision: {
    titleKey: 'delete.decision.title',
    messageKey: 'delete.decision.message',
    confirmTextKey: 'delete.decision.confirm',
    hasCascade: false,
  },
  attachment: {
    titleKey: 'delete.attachment.title',
    messageKey: 'delete.attachment.message',
    confirmTextKey: 'delete.attachment.confirm',
    hasCascade: false,
  },
  modelRegistryEntry: {
    titleKey: 'delete.modelRegistry.title',
    messageKey: 'delete.modelRegistry.message',
    confirmTextKey: 'delete.modelRegistry.confirm',
    hasCascade: false,
  },
};
```

### 3.2 Unified Delete Modal Component

**File**: `frontend/src/components/ui/UnifiedDeleteModal.tsx`

```tsx
/**
 * UnifiedDeleteModal - Single delete confirmation modal for all entity types
 *
 * Usage:
 * <UnifiedDeleteModal
 *   isOpen={showDelete}
 *   entityType="department"
 *   entityName="Engineering"
 *   onConfirm={async () => {
 *     await api.deleteCompanyDepartment(companyId, deptId);
 *   }}
 *   onClose={() => setShowDelete(false)}
 *   onSuccess={() => {
 *     queryClient.invalidateQueries(['team']);
 *     toast.success('Department deleted');
 *   }}
 * />
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AppModal } from './AppModal';
import { Button } from './button';
import { Spinner } from './Spinner';
import { AlertTriangle } from 'lucide-react';
import { DELETE_CONFIGS, type DeleteEntityType } from '../../config/deleteConfig';

interface UnifiedDeleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The type of entity being deleted */
  entityType: DeleteEntityType;
  /** The name of the entity (shown in message) */
  entityName: string;
  /** Additional context for cascade warning (e.g., "3 roles") */
  cascadeContext?: string;
  /** Async function to perform the deletion */
  onConfirm: () => Promise<void>;
  /** Called when modal closes (cancel or success) */
  onClose: () => void;
  /** Called after successful deletion (for cache invalidation, toasts, etc.) */
  onSuccess?: () => void;
}

export function UnifiedDeleteModal({
  isOpen,
  entityType,
  entityName,
  cascadeContext,
  onConfirm,
  onClose,
  onSuccess,
}: UnifiedDeleteModalProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = DELETE_CONFIGS[entityType];

  const handleConfirm = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('delete.genericError');
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  }, [onConfirm, onSuccess, onClose, t]);

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  }, [isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <AppModal
      isOpen={true}
      onClose={handleClose}
      size="sm"
      title={t(config.titleKey)}
      closeOnOverlayClick={!isDeleting}
    >
      <div className="unified-delete-modal-body">
        {/* Warning icon */}
        <div className="unified-delete-icon">
          <AlertTriangle size={48} className="text-[var(--color-error)]" />
        </div>

        {/* Main message with entity name */}
        <p className="unified-delete-message">
          {t(config.messageKey, { name: entityName })}
        </p>

        {/* Cascade warning if applicable */}
        {config.hasCascade && config.warningKey && (
          <p className="unified-delete-warning">
            {t(config.warningKey, { context: cascadeContext })}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p className="unified-delete-error">
            {error}
          </p>
        )}

        {/* Permanent deletion notice */}
        <p className="unified-delete-permanent">
          {t('delete.permanentNotice')}
        </p>
      </div>

      <AppModal.Footer>
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={isDeleting}
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={isDeleting}
          autoFocus
        >
          {isDeleting ? (
            <>
              <Spinner size="sm" variant="muted" />
              {t('delete.deleting')}
            </>
          ) : (
            t(config.confirmTextKey)
          )}
        </Button>
      </AppModal.Footer>
    </AppModal>
  );
}
```

### 3.3 Add CSS Styles

**File**: `frontend/src/components/ui/UnifiedDeleteModal.css`

```css
.unified-delete-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-4) var(--space-6);
  gap: var(--space-4);
}

.unified-delete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--color-error-50);
}

.unified-delete-message {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: 1.5;
}

.unified-delete-warning {
  font-size: var(--font-size-sm);
  color: var(--color-warning-600);
  background: var(--color-warning-50);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-warning-200);
}

.unified-delete-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  background: var(--color-error-50);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-error-200);
}

.unified-delete-permanent {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

/* Dark mode */
.dark .unified-delete-icon {
  background: var(--color-error-900);
}

.dark .unified-delete-warning {
  background: var(--color-warning-900);
  border-color: var(--color-warning-700);
  color: var(--color-warning-300);
}

.dark .unified-delete-error {
  background: var(--color-error-900);
  border-color: var(--color-error-700);
}
```

### 3.4 Add i18n Translation Keys

**File**: `frontend/src/i18n/locales/en/translation.json` (add to existing)

```json
{
  "delete": {
    "genericError": "Failed to delete. Please try again.",
    "deleting": "Deleting...",
    "permanentNotice": "This action cannot be undone.",

    "conversation": {
      "title": "Delete Conversation",
      "message": "Are you sure you want to delete this conversation?",
      "confirm": "Delete Conversation"
    },
    "project": {
      "title": "Delete Project",
      "message": "Are you sure you want to delete \"{{name}}\"?",
      "warning": "All decisions saved to this project will also be deleted.",
      "confirm": "Delete Project"
    },
    "department": {
      "title": "Delete Department",
      "message": "Are you sure you want to delete \"{{name}}\"?",
      "warning": "This will also delete {{context}} in this department.",
      "confirm": "Delete Department"
    },
    "role": {
      "title": "Delete Role",
      "message": "Are you sure you want to delete \"{{name}}\"?",
      "confirm": "Delete Role"
    },
    "playbook": {
      "title": "Delete Playbook",
      "message": "Are you sure you want to delete \"{{name}}\"?",
      "confirm": "Delete Playbook"
    },
    "decision": {
      "title": "Delete Decision",
      "message": "Are you sure you want to delete \"{{name}}\"?",
      "confirm": "Delete Decision"
    },
    "attachment": {
      "title": "Delete Attachment",
      "message": "Are you sure you want to delete this attachment?",
      "confirm": "Delete Attachment"
    },
    "modelRegistry": {
      "title": "Delete Model",
      "message": "Are you sure you want to remove \"{{name}}\" from the registry?",
      "confirm": "Delete Model"
    }
  }
}
```

### 3.5 Checklist

- [ ] Create `frontend/src/config/deleteConfig.ts`
- [ ] Create `frontend/src/components/ui/UnifiedDeleteModal.tsx`
- [ ] Create `frontend/src/components/ui/UnifiedDeleteModal.css`
- [ ] Import CSS in component
- [ ] Add translation keys to all locale files (en, es, etc.)
- [ ] Export from `frontend/src/components/ui/index.tsx`
- [ ] Write unit tests for UnifiedDeleteModal

---

## Phase 4: Migrate Existing Delete UIs

### 4.1 Migration Strategy

Migrate one at a time, testing after each:

1. **Conversations** (simplest, isolated)
2. **Projects** (more complex, has inline confirm)
3. **Others** as needed

### 4.2 Migrate Conversations Delete

**Current**: `frontend/src/components/sidebar/DeleteModal.tsx` (dedicated component)

**After**: Use `UnifiedDeleteModal` directly in Sidebar

```tsx
// In Sidebar.tsx
import { UnifiedDeleteModal } from '../ui/UnifiedDeleteModal';

// Replace usage of DeleteModal with:
<UnifiedDeleteModal
  isOpen={deleteConfirmOpen}
  entityType="conversation"
  entityName={conversationToDelete?.title || 'Conversation'}
  onConfirm={async () => {
    await api.deleteConversation(conversationToDelete.id);
  }}
  onClose={() => setDeleteConfirmOpen(false)}
  onSuccess={() => {
    queryClient.invalidateQueries(['conversations']);
    toast.success(t('sidebar.conversationDeleted'));
  }}
/>
```

### 4.3 Migrate Projects Delete

**Current**: Inline confirmation in `ViewProjectModal.tsx` (lines 1009-1114)

**After**: Replace with UnifiedDeleteModal

```tsx
// In ViewProjectModal.tsx
import { UnifiedDeleteModal } from '../../ui/UnifiedDeleteModal';

// Replace confirmingAction === 'delete' block with:
<UnifiedDeleteModal
  isOpen={confirmingAction === 'delete'}
  entityType="project"
  entityName={project.name}
  cascadeContext={`${project.decision_count || 0} decisions`}
  onConfirm={async () => {
    if (onDelete) await onDelete(project.id);
  }}
  onClose={() => setConfirmingAction(null)}
  onSuccess={() => {
    // Parent handles cache invalidation
    onClose();
  }}
/>
```

### 4.4 Checklist

- [ ] Migrate conversations delete
- [ ] Test conversation deletion
- [ ] Migrate projects delete
- [ ] Test project deletion
- [ ] Remove old `DeleteModal.tsx` (or keep for backwards compatibility)
- [ ] Update any imports

---

## Phase 5: Add Delete to Missing Entities

### 5.1 Add Delete to Departments

**File**: `frontend/src/components/mycompany/modals/ViewDepartmentModal.tsx`

Add delete button to footer and UnifiedDeleteModal:

```tsx
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { UnifiedDeleteModal } from '../../ui/UnifiedDeleteModal';
import { api } from '../../../api';

// In component props, add:
interface ViewDepartmentModalProps {
  // ... existing props
  onDelete?: (departmentId: string) => Promise<void>;
}

// In component:
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

// In footer (view mode):
{onDelete && (
  <Button
    variant="ghost"
    onClick={() => setShowDeleteConfirm(true)}
    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
  >
    <Trash2 size={16} />
    {t('common.delete')}
  </Button>
)}

// Add modal at end of component:
<UnifiedDeleteModal
  isOpen={showDeleteConfirm}
  entityType="department"
  entityName={department.name}
  cascadeContext={`${department.roles?.length || 0} roles`}
  onConfirm={async () => {
    if (onDelete) await onDelete(department.id);
  }}
  onClose={() => setShowDeleteConfirm(false)}
  onSuccess={() => {
    onClose();
  }}
/>
```

### 5.2 Add Delete to Roles

**File**: `frontend/src/components/mycompany/modals/ViewRoleModal.tsx`

Same pattern as departments:

```tsx
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { UnifiedDeleteModal } from '../../ui/UnifiedDeleteModal';

// Add to props:
interface ViewRoleModalProps {
  // ... existing props
  onDelete?: (roleId: string, departmentId: string) => Promise<void>;
}

// In component:
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

// In footer (view mode):
{onDelete && role.departmentId && (
  <Button
    variant="ghost"
    onClick={() => setShowDeleteConfirm(true)}
    className="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
  >
    <Trash2 size={16} />
    {t('common.delete')}
  </Button>
)}

// Add modal:
<UnifiedDeleteModal
  isOpen={showDeleteConfirm}
  entityType="role"
  entityName={role.name}
  onConfirm={async () => {
    if (onDelete && role.departmentId) {
      await onDelete(role.id, role.departmentId);
    }
  }}
  onClose={() => setShowDeleteConfirm(false)}
  onSuccess={() => {
    onClose();
  }}
/>
```

### 5.3 Wire Up in TeamTab

**File**: `frontend/src/components/mycompany/tabs/TeamTab.tsx`

Add handlers for delete callbacks:

```tsx
const handleDeleteDepartment = async (departmentId: string) => {
  await api.deleteCompanyDepartment(companyId, departmentId);
  queryClient.invalidateQueries(['company-team', companyId]);
  toast.success(t('team.departmentDeleted'));
};

const handleDeleteRole = async (roleId: string, departmentId: string) => {
  await api.deleteCompanyRole(companyId, departmentId, roleId);
  queryClient.invalidateQueries(['company-team', companyId]);
  toast.success(t('team.roleDeleted'));
};

// Pass to modals:
<ViewDepartmentModal
  department={selectedDepartment}
  onClose={() => setSelectedDepartment(null)}
  onSave={handleSaveDepartment}
  onDelete={handleDeleteDepartment}  // NEW
/>

<ViewRoleModal
  role={selectedRole}
  onClose={() => setSelectedRole(null)}
  onSave={handleSaveRole}
  onDelete={handleDeleteRole}  // NEW
/>
```

### 5.4 Checklist

- [ ] Update `ViewDepartmentModal.tsx` with delete button and modal
- [ ] Update `ViewRoleModal.tsx` with delete button and modal
- [ ] Update `TeamTab.tsx` with delete handlers
- [ ] Add translation keys for team delete messages
- [ ] Test department deletion (verify cascade deletes roles)
- [ ] Test role deletion
- [ ] Verify activity logs are created

---

## Testing Strategy

### Unit Tests

1. **UnifiedDeleteModal component**
   - Renders correct title/message for each entity type
   - Shows loading state during deletion
   - Displays error on failure
   - Calls onSuccess after successful deletion
   - Prevents closing during deletion

2. **Backend endpoints**
   - Returns 404 for non-existent entities
   - Cascade deletes work correctly
   - Activity logs are created
   - Ownership verification works

### Integration Tests

1. **Full delete flow**
   - Open modal → Confirm → Verify deleted → Verify UI updated
   - Test each entity type

2. **Error handling**
   - Network failure shows error
   - Can retry after error

### E2E Tests

1. **Department deletion**
   - Create department with roles
   - Delete department
   - Verify department and roles gone
   - Verify activity log entry

2. **Role deletion**
   - Create role
   - Delete role
   - Verify role gone
   - Verify department still exists

---

## Rollback Plan

### If Issues Arise

1. **Phase 1 (Backend)**:
   - Remove new endpoints from `team.py`
   - No frontend changes yet, so no user impact

2. **Phase 2 (API Layer)**:
   - Remove new methods from `api.ts`
   - No UI uses them yet

3. **Phase 3 (Modal Component)**:
   - Keep new component but don't use it
   - Existing delete flows unaffected

4. **Phase 4 (Migration)**:
   - Revert specific component changes
   - Old delete flows still work

5. **Phase 5 (New Entities)**:
   - Revert ViewDepartmentModal/ViewRoleModal
   - Delete functionality simply not available (same as before)

### Feature Flag Option

Consider adding a feature flag:

```typescript
// config/features.ts
export const FEATURES = {
  UNIFIED_DELETE: process.env.VITE_FEATURE_UNIFIED_DELETE === 'true',
};

// Usage:
{FEATURES.UNIFIED_DELETE ? (
  <UnifiedDeleteModal ... />
) : (
  <LegacyDeleteModal ... />
)}
```

---

## Future Considerations

### 1. Soft Delete / Archive

Some entities might benefit from soft delete:

```typescript
// Future extension to deleteConfig.ts
export interface DeleteConfig {
  // ... existing
  supportsSoftDelete?: boolean;
  archiveLabel?: string;
}

// Modal could show "Archive" vs "Delete Permanently" options
```

### 2. Bulk Delete

The unified system could extend to bulk operations:

```tsx
<UnifiedDeleteModal
  isOpen={showBulkDelete}
  entityType="conversation"
  entityName={`${selectedIds.length} conversations`}
  isBulk={true}
  onConfirm={async () => {
    await api.bulkDeleteConversations(selectedIds);
  }}
  // ...
/>
```

### 3. Undo Support

For less critical entities, could add undo:

```typescript
// After delete, show toast with undo button
toast.success('Deleted conversation', {
  action: {
    label: 'Undo',
    onClick: () => api.restoreConversation(id),
  },
});
```

### 4. Delete Permissions

Enterprise feature - role-based delete permissions:

```typescript
// Check before showing delete button
const canDelete = useCanDelete(entityType, entityId);
```

---

## Summary

This plan establishes a unified delete system that:

1. ✅ Creates consistency across all entity types
2. ✅ Reduces code duplication significantly
3. ✅ Makes adding delete to new entities trivial (add config entry)
4. ✅ Ensures all deletions are logged
5. ✅ Provides clear migration path from current scattered approach
6. ✅ Includes comprehensive testing strategy
7. ✅ Has rollback plan for each phase

**Recommended execution order**: Phase 1 → 2 → 3 → 5 → 4

(Add delete to departments/roles first since they're completely missing, then migrate existing UIs)
