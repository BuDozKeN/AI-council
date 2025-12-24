# Knowledge Management Architecture Audit

**Date:** 2024-12-24
**Scope:** Complete "Command Centre" / "My Company" knowledge management system
**Repository:** AI-council (AxCouncil)

---

## 1. Complete Schema Documentation

### 1.1 Core Tables

#### `companies`
**Purpose:** Root tenant entity - company/organization data

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner's auth.users ID |
| `name` | TEXT | Company display name |
| `slug` | TEXT | URL-safe identifier |
| `context_md` | TEXT | **Company context markdown - main knowledge document** |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- One-to-Many → `departments`
- One-to-Many → `projects`
- One-to-Many → `org_documents` (playbooks)
- One-to-Many → `knowledge_entries` (decisions)
- One-to-Many → `company_members`
- One-to-Many → `company_documents` (files/URLs)
- One-to-Many → `conversations`
- One-to-Many → `activity_logs`

**RLS:** Owner-based (user_id = auth.uid()) + member access via `company_members`

---

#### `departments`
**Purpose:** Organizational units within a company

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `name` | TEXT | Department name |
| `slug` | TEXT | URL-safe identifier |
| `description` | TEXT | Brief description |
| `purpose` | TEXT | Department purpose statement |
| `context_md` | TEXT | **Department-specific context markdown** |
| `budget_annual` | NUMERIC(12,2) | Annual budget |
| `budget_currency` | TEXT | Currency code (default: EUR) |
| `display_order` | INTEGER | UI sort order |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- Many-to-One → `companies`
- One-to-Many → `roles`
- One-to-Many → `org_documents` (playbooks assigned to dept)

**RLS:** Company member access via `is_company_member()` function

---

#### `roles`
**Purpose:** Council advisor personas within departments

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `department_id` | UUID FK | Parent department |
| `name` | TEXT | Role name (e.g., "CTO") |
| `slug` | TEXT | URL-safe identifier |
| `title` | TEXT | Full title |
| `description` | TEXT | Role description |
| `responsibilities` | TEXT | Key responsibilities |
| `problems_solved` | TEXT | Problems this role addresses |
| `system_prompt` | TEXT | **AI persona system prompt** |
| `is_active` | BOOLEAN | Whether role is active |
| `display_order` | INTEGER | UI sort order |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- Many-to-One → `companies`
- Many-to-One → `departments`

**RLS:** Company member access

---

#### `projects`
**Purpose:** Client projects or initiatives for contextual knowledge

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `name` | TEXT | Project name |
| `description` | TEXT | Project description |
| `context_md` | TEXT | **Auto-synthesized project context** |
| `status` | TEXT | 'active' / 'completed' / 'archived' |
| `department_ids` | UUID[] | Associated departments |
| `last_accessed_at` | TIMESTAMPTZ | For "recently used" sorting |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- Many-to-One → `companies`
- One-to-Many → `knowledge_entries` (decisions linked to project)
- One-to-Many → `company_documents` (files linked to project)

**RLS:** Company member access

**Note:** `context_md` is automatically regenerated when decisions are saved to the project, synthesizing all decisions into a clean document.

---

#### `org_documents` (Playbooks)
**Purpose:** SOPs, Frameworks, and Policies

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `department_id` | UUID FK | Owner department (nullable for company-wide) |
| `doc_type` | TEXT | **'sop' / 'framework' / 'policy'** |
| `title` | TEXT | Playbook title |
| `slug` | TEXT | URL-safe identifier (unique per company+type) |
| `summary` | TEXT | Brief description |
| `tags` | TEXT[] | Categorization tags |
| `is_active` | BOOLEAN | Whether playbook is active |
| `auto_inject` | BOOLEAN | **Auto-include in council context** |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- Many-to-One → `companies`
- Many-to-One → `departments`
- One-to-Many → `org_document_versions`
- Many-to-Many → `departments` via `org_document_departments` (multi-dept visibility)

**RLS:** Company member access; delete requires admin

---

#### `org_document_versions`
**Purpose:** Version history for playbooks (content versioning)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `document_id` | UUID FK | Parent org_document |
| `version` | INTEGER | Version number |
| `content` | TEXT | **Full playbook content (Markdown)** |
| `status` | TEXT | 'draft' / 'active' / 'archived' |
| `change_summary` | TEXT | Description of changes |
| `is_current` | BOOLEAN | Whether this is the active version |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | UUID FK | Author user ID |

**Relationships:**
- Many-to-One → `org_documents`

**RLS:** Inherited via document_id → org_documents

---

#### `org_document_departments`
**Purpose:** Junction table for multi-department playbook visibility

| Column | Type | Description |
|--------|------|-------------|
| `document_id` | UUID FK | org_document reference |
| `department_id` | UUID FK | Additional visible department |

---

#### `knowledge_entries` (Decisions/Knowledge Base)
**Purpose:** Saved council decisions and knowledge items - **CORE KNOWLEDGE ENTITY**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `department_ids` | TEXT[] | Linked departments (array) |
| `project_id` | UUID FK | Linked project (for project timeline) |
| `role_id` | UUID | Optional role context |
| `category` | TEXT | 'technical_decision' / 'ux_pattern' / 'feature' / 'policy' / 'process' |
| `title` | TEXT | Decision title |
| `content` | TEXT | **Full council response/decision content** |
| `question` | TEXT | **Original user question** |
| `content_summary` | TEXT | AI-generated brief summary |
| `question_summary` | TEXT | AI-generated question summary |
| `problem_statement` | TEXT | Structured: problem being solved |
| `decision_text` | TEXT | Structured: the decision made |
| `reasoning` | TEXT | Structured: why this decision |
| `status` | TEXT | 'active' / 'superseded' / 'archived' |
| `tags` | TEXT[] | Categorization tags |
| `source_conversation_id` | UUID FK | Source conversation |
| `source_message_id` | UUID | Source message within conversation |
| `response_index` | INTEGER | Index within multi-decision conversation |
| `auto_inject` | BOOLEAN | **Auto-include in future council context** |
| `scope` | TEXT | 'company' / 'department' / 'project' visibility |
| `promoted_to_id` | UUID FK | If promoted, link to org_document |
| `promoted_to_type` | TEXT | 'sop' / 'framework' / 'policy' / 'project' |
| `version` | TEXT | Version string |
| `is_active` | BOOLEAN | Soft delete flag |
| `created_by` | UUID FK | Author user ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Relationships:**
- Many-to-One → `companies`
- Many-to-One → `projects`
- Many-to-One → `conversations`
- Many-to-One → `org_documents` (if promoted)

**RLS:** Company member access; delete requires admin

---

#### `conversations`
**Purpose:** Chat conversations with the AI council

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | Owner user |
| `company_id` | UUID FK | Associated company |
| `title` | TEXT | Conversation title |
| `messages` | JSONB | Array of message objects |
| `department` | TEXT | Department context (legacy) |
| `is_starred` | BOOLEAN | Starred for quick access |
| `is_archived` | BOOLEAN | Archived status |
| `message_count` | INTEGER | Number of messages |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Note:** Messages are stored as JSONB with structure:
```json
{
  "id": "uuid",
  "role": "user|assistant",
  "content": "text",
  "stage1": [{"model": "...", "content": "..."}],
  "stage2": [{"model": "...", "ranking": "..."}],
  "stage3": {"content": "...", "model": "..."},
  "attachments": ["attachment_id", ...],
  "created_at": "timestamp"
}
```

---

#### `activity_logs`
**Purpose:** Audit trail for company activity

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `event_type` | TEXT | 'decision' / 'playbook' / 'role' / 'department' / 'council_session' / 'project' / 'consultation' |
| `action` | TEXT | 'saved' / 'promoted' / 'deleted' / 'created' / 'updated' / 'archived' / 'consulted' |
| `title` | TEXT | Activity title |
| `description` | TEXT | Activity description |
| `department_id` | UUID FK | Related department |
| `related_id` | UUID | ID of related entity |
| `related_type` | TEXT | Type of related entity |
| `promoted_to_type` | TEXT | If promotion, target type |
| `created_at` | TIMESTAMPTZ | Timestamp |

**RLS:** Admin-only read; member insert

---

#### `company_members`
**Purpose:** Multi-user company access

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Company |
| `user_id` | UUID FK | User |
| `role` | TEXT | 'owner' / 'admin' / 'member' |
| `invited_by` | UUID FK | Inviter |
| `invited_at` | TIMESTAMPTZ | Invitation time |
| `joined_at` | TIMESTAMPTZ | Join time |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Unique:** (company_id, user_id)

---

#### `company_documents` (File Library - Future)
**Purpose:** PDF, Excel, URL document storage

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID FK | Parent company |
| `project_id` | UUID FK | Optional project link |
| `title` | TEXT | Document title |
| `description` | TEXT | Description |
| `doc_type` | TEXT | 'file' / 'url' |
| `file_type` | TEXT | 'pdf' / 'csv' / 'xlsx' / 'image' / 'txt' / 'json' / 'xml' |
| `mime_type` | TEXT | MIME type |
| `storage_path` | TEXT | Supabase Storage path |
| `source_url` | TEXT | URL for URL-type docs |
| `file_size_bytes` | BIGINT | File size |
| `extracted_text` | TEXT | **Extracted content for context injection** |
| `extraction_status` | TEXT | 'pending' / 'processing' / 'completed' / 'failed' |
| `extraction_error` | TEXT | Error message if failed |
| `last_fetched_at` | TIMESTAMPTZ | For URL docs |
| `created_by` | UUID FK | Uploader |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |
| `is_active` | BOOLEAN | Soft delete |

---

#### `user_department_access` (Legacy Permissions)
**Purpose:** Department-level access control (legacy, being replaced by company_members)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID FK | User |
| `company_id` | UUID FK | Company |
| `department_id` | UUID FK | Department (NULL = company-wide) |
| `access_level` | TEXT | 'admin' / 'member' / 'viewer' |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | UUID FK | Creator |

---

#### `ai_personas`
**Purpose:** AI writing assistant personas (Sarah, SOP Writer, etc.)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `persona_key` | TEXT | Unique key ('sarah', 'sop_writer') |
| `name` | TEXT | Display name |
| `category` | TEXT | 'project' / 'playbook' / 'decision' / 'general' |
| `description` | TEXT | Purpose description |
| `system_prompt` | TEXT | Full system prompt |
| `user_prompt_template` | TEXT | Template with {{placeholders}} |
| `model_preferences` | JSONB | Array of model names |
| `company_id` | UUID FK | NULL = global, or company-specific |
| `is_active` | BOOLEAN | Whether active |
| `version` | INTEGER | Version number |

---

#### `model_registry`
**Purpose:** Available LLM models and their capabilities

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Model display name |
| `provider` | TEXT | 'openai' / 'anthropic' / 'google' / 'openrouter' |
| `model_id` | TEXT | Provider's model ID |
| `role` | TEXT | 'council' / 'chairman' / 'assistant' |
| `is_active` | BOOLEAN | Whether available |
| `capabilities` | JSONB | Model capabilities |
| `context_window` | INTEGER | Context window size |
| `cost_per_1k_input` | NUMERIC | Input cost |
| `cost_per_1k_output` | NUMERIC | Output cost |

---

## 2. Entity Relationship Diagram

```
Company (1)
├── company_members (many) ─────────────────────────────────────────┐
│   └── Users with owner/admin/member roles                        │
│                                                                    │
├── Departments (many)                                               │
│   ├── context_md [Department-specific knowledge]                  │
│   ├── Roles (many)                                                 │
│   │   └── system_prompt [AI persona definition]                   │
│   └── org_documents (many, as owner dept)                         │
│       └── org_document_versions (many)                            │
│           └── content [Playbook content - VERSIONED]              │
│                                                                    │
├── org_documents (many, company-wide or multi-dept)                 │
│   ├── doc_type: 'sop' | 'framework' | 'policy'                    │
│   └── org_document_departments (many-to-many with departments)    │
│                                                                    │
├── Projects (many)                                                  │
│   ├── context_md [Auto-synthesized from decisions]                │
│   ├── knowledge_entries (many, linked by project_id)              │
│   └── company_documents (many, optional project link)             │
│                                                                    │
├── knowledge_entries (many) ──── Decisions/Knowledge Base          │
│   ├── content [Full council response]                             │
│   ├── question [Original user question]                           │
│   ├── department_ids[] [Multi-department support]                 │
│   ├── auto_inject [For context injection]                         │
│   ├── scope ['company' | 'department' | 'project']                │
│   └── promoted_to_id → org_documents (optional promotion)         │
│                                                                    │
├── conversations (many)                                             │
│   ├── messages (JSONB array with 3-stage structure)               │
│   └── knowledge_entries (many, via source_conversation_id)        │
│                                                                    │
├── company_documents (many) ──── File Library [Future]             │
│   ├── doc_type: 'file' | 'url'                                    │
│   ├── extracted_text [For context injection]                      │
│   └── project_id → Projects (optional)                            │
│                                                                    │
├── activity_logs (many) ──── Audit Trail                           │
│                                                                    │
└── context_md [Main company knowledge document] ───────────────────┘
```

### Relationship Summary

| Relationship | Type | Cascade |
|--------------|------|---------|
| Company → Departments | 1:N | CASCADE DELETE |
| Company → Projects | 1:N | CASCADE DELETE |
| Company → org_documents | 1:N | CASCADE DELETE |
| Company → knowledge_entries | 1:N | CASCADE DELETE |
| Company → conversations | 1:N | CASCADE DELETE |
| Department → Roles | 1:N | CASCADE DELETE |
| Department → org_documents | 1:N | SET NULL |
| Project → knowledge_entries | 1:N | SET NULL |
| org_document → org_document_versions | 1:N | CASCADE DELETE |
| knowledge_entry → org_document (promoted) | N:1 | SET NULL |
| Conversation → knowledge_entries | 1:N | SET NULL |

---

## 3. Frontend Data Access Patterns

### API Layer (`frontend/src/api.ts`)

The API client provides comprehensive CRUD operations:

#### Company Context
| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get Overview | GET | `/api/company/{id}/overview` |
| Update Context | PUT | `/api/company/{id}/context` |
| Merge Context | POST | `/api/company/{id}/context/merge` |

#### Departments & Roles
| Operation | Method | Endpoint |
|-----------|--------|----------|
| Get Team | GET | `/api/company/{id}/team` |
| Create Department | POST | `/api/company/{id}/departments` |
| Update Department | PUT | `/api/company/{id}/departments/{deptId}` |
| Create Role | POST | `/api/company/{id}/departments/{deptId}/roles` |
| Update Role | PUT | `/api/company/{id}/departments/{deptId}/roles/{roleId}` |
| Get Role | GET | `/api/company/{id}/departments/{deptId}/roles/{roleId}` |

#### Playbooks (SOPs/Frameworks/Policies)
| Operation | Method | Endpoint |
|-----------|--------|----------|
| List Playbooks | GET | `/api/company/{id}/playbooks` |
| Get Playbook | GET | `/api/company/{id}/playbooks/{playbookId}` |
| Create Playbook | POST | `/api/company/{id}/playbooks` |
| Update Playbook | PUT | `/api/company/{id}/playbooks/{playbookId}` |
| Delete Playbook | DELETE | `/api/company/{id}/playbooks/{playbookId}` |
| Get Tags | GET | `/api/company/{id}/playbooks/tags` |

#### Decisions (Knowledge Entries)
| Operation | Method | Endpoint |
|-----------|--------|----------|
| List Decisions | GET | `/api/company/{id}/decisions` |
| Get Decision | GET | `/api/company/{id}/decisions/{decisionId}` |
| Promote Decision | POST | `/api/company/{id}/decisions/{decisionId}/promote` |
| Create Knowledge Entry | POST | `/api/knowledge` |
| Update Knowledge Entry | PATCH | `/api/knowledge/{entryId}` |
| Delete Knowledge Entry | DELETE | `/api/knowledge/{entryId}` |

#### Projects
| Operation | Method | Endpoint |
|-----------|--------|----------|
| List Projects | GET | `/api/companies/{id}/projects` |
| List with Stats | GET | `/api/companies/{id}/projects/stats` |
| Create Project | POST | `/api/companies/{id}/projects` |
| Get Project | GET | `/api/projects/{projectId}` |
| Update Project | PATCH | `/api/projects/{projectId}` |
| Delete Project | DELETE | `/api/projects/{projectId}` |
| Touch (access) | POST | `/api/projects/{projectId}/touch` |
| Regenerate Context | POST | `/api/projects/{projectId}/regenerate-context` |
| Get Report | GET | `/api/projects/{projectId}/report` |

### React Hooks

#### `useCompanyData` (`frontend/src/components/mycompany/hooks/useCompanyData.ts`)
Central hook managing all MyCompany data:
- Loads data per tab (overview, team, playbooks, decisions, activity, projects)
- Handles loading states, errors, pagination
- Provides setters for optimistic updates

#### `useDecisionActions` (`frontend/src/components/mycompany/hooks/useDecisionActions.ts`)
- Decision CRUD operations
- Promotion to playbooks
- Summary regeneration

#### `useProjectActions` (`frontend/src/components/mycompany/hooks/useProjectActions.ts`)
- Project CRUD operations
- Context regeneration

#### `useActivityData` (`frontend/src/components/mycompany/hooks/useActivityData.ts`)
- Activity log fetching with pagination

---

## 4. Content Structure Analysis

### Content Formats

| Entity | Field | Format | Versioned? |
|--------|-------|--------|------------|
| Company | context_md | Markdown | No |
| Department | context_md | Markdown | No |
| Role | system_prompt | Plain text (AI prompt) | No |
| Playbook | content | Markdown | **Yes** |
| Knowledge Entry | content | Markdown/Plain | No |
| Knowledge Entry | question | Plain text | No |
| Project | context_md | Markdown (auto-generated) | No |

### Playbook Versioning System

1. `org_documents` stores metadata (title, type, tags)
2. `org_document_versions` stores content with:
   - Version number (incrementing)
   - `is_current` flag for active version
   - `change_summary` for audit trail
   - `status`: draft → active → archived

### Revision History

- **Playbooks:** Full version history via `org_document_versions`
- **Other entities:** No built-in revision history
- **Activity logs:** Track changes at entity level (not content level)

### Search/Indexing

Current capabilities:
- **Text search:** ILIKE pattern matching on title, problem_statement, decision_text
- **Tag filtering:** PostgreSQL array containment (`@>` operator)
- **GIN indexes:** On `tags`, `department_ids` arrays

No current capabilities:
- Full-text search (tsvector/tsquery)
- Embeddings/vector search
- Semantic search

---

## 5. User Permissions & Multi-tenancy

### Permission Model

```
company_members.role:
├── 'owner'   → Full access, can delete company
├── 'admin'   → Full access except delete company
└── 'member'  → Read all, create/update own, no delete
```

### Helper Functions (Database Level)

```sql
is_company_member(company_id)  -- Returns TRUE if user is any member
is_company_admin(company_id)   -- Returns TRUE if user is owner/admin
```

### RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| companies | member | owner | owner | owner |
| departments | member | admin | admin | admin |
| roles | member | admin | admin | admin |
| org_documents | member | member | member | admin |
| org_document_versions | member | member | member | - |
| knowledge_entries | member | member | member | admin |
| projects | member | member | member | admin |
| activity_logs | admin | member | - | - |
| usage_events | admin | member | - | - |

### Access Check Flow (Backend)

```python
# 1. Extract user from JWT
user = get_current_user(request)

# 2. Get service client (bypasses RLS for read)
client = get_service_client()

# 3. Verify access
verify_company_access(client, company_uuid, user)
# - Checks companies.user_id (owner)
# - Checks company_members
# - Checks user_department_access (legacy)
```

---

## 6. Current Update Flows

### Company Context Update
```
UI: MyCompany → Overview → Edit Context
    ↓
Component: ViewCompanyContextModal
    ↓
API: PUT /api/company/{id}/context
    ↓
Backend: update_company_context()
    ↓
DB: UPDATE companies SET context_md = ...
```

### AI-Assisted Context Merge
```
UI: Knowledge Gap prompt → User answers
    ↓
API: POST /api/company/{id}/context/merge
    ↓
Backend: merge_company_context()
    ↓
AI: Uses Claude/GPT to intelligently merge
    ↓
DB: UPDATE companies SET context_md = ...
```

### Department/Role Update
```
UI: MyCompany → Team → Edit Department/Role
    ↓
Modal: ViewDepartmentModal / ViewRoleModal
    ↓
API: PUT /api/company/{id}/departments/{id}
     PUT /api/company/{id}/departments/{id}/roles/{id}
    ↓
DB: UPDATE departments/roles SET ...
```

### Playbook Create/Update
```
UI: MyCompany → Playbooks → Create/Edit
    ↓
Modal: ViewPlaybookModal
    ↓
API: POST/PUT /api/company/{id}/playbooks
    ↓
Backend:
    1. Upsert org_documents
    2. Create new org_document_version with is_current=true
    3. Set previous version is_current=false
```

### Decision Save Flow
```
UI: Chat → Stage3 → Save Decision
    ↓
Modal: SaveKnowledgeModal
    ↓
API: POST /api/company/{id}/decisions/merge
    ↓
Backend:
    1. Create knowledge_entry
    2. Link to conversation
    3. If project_id: auto-regenerate project context
    4. Log to activity_logs
```

### Decision → Playbook Promotion
```
UI: MyCompany → Decisions → Promote
    ↓
Modal: PromoteDecisionModal
    ↓
API: POST /api/company/{id}/decisions/{id}/promote
    ↓
Backend:
    1. Create org_document
    2. Create org_document_version with decision content
    3. Update knowledge_entry.promoted_to_id
    4. Log to activity_logs
```

---

## 7. Search & Retrieval Mechanisms

### Current Search Implementation

#### Decisions Search
```python
# backend/knowledge.py
query = query.or_(
    f"title.ilike.%{search}%,"
    f"problem_statement.ilike.%{search}%,"
    f"decision_text.ilike.%{search}%"
)
```

#### Playbook Filtering
- By `doc_type` (sop/framework/policy)
- By `department_id` (owner or visible)
- By `tag` (array containment)

### Context Injection into Council

The `context_loader.py` builds system prompts with:

1. **Company Context** (`companies.context_md`)
2. **Department Context** (`departments.context_md`) - if selected
3. **Role Persona** (`roles.system_prompt`) - if selected
4. **Project Context** (`projects.context_md`) - if selected
5. **Playbooks** (`org_documents` with `auto_inject=true`) - disabled by default
6. **Knowledge Entries** (`knowledge_entries` with `auto_inject=true`) - disabled by default

### Auto-Inject Logic

```python
# Only inject if explicitly selected OR auto_inject=true
# Controlled by scope: 'company' | 'department' | 'project'

if scope == "company":
    # Always included for company context
elif scope == "department":
    # Only if department matches OR entry has no department
elif scope == "project":
    # Only if project matches
```

### Current Limitations

- No vector/semantic search
- No full-text search indexes
- Playbook auto-inject disabled by default
- Knowledge entry auto-inject disabled by default

---

## 8. Document Intelligence (Current & Planned)

### Current State

The `company_documents` table exists but document processing is **not yet implemented**:

```python
# backend/attachments.py - handles image uploads only
# No PDF/Excel parsing implemented yet
```

### Planned Structure

```
company_documents:
├── doc_type: 'file' | 'url'
├── file_type: 'pdf' | 'csv' | 'xlsx' | ...
├── storage_path: Supabase Storage location
├── extracted_text: For context injection
└── extraction_status: 'pending' | 'processing' | 'completed' | 'failed'
```

### Missing Capabilities

- PDF text extraction
- Excel/CSV parsing
- URL content fetching
- Document-to-context pipeline
- Document search

---

## 9. Key File Locations

### Database/Schema

```
/home/user/AI-council/supabase/migrations/
├── 20251212201000_organization_schema_v2.sql      # Core org schema
├── 20251213120000_knowledge_entries_consolidation.sql  # Knowledge entries
├── 20251220200000_company_documents.sql           # Document library
├── 20251220300000_company_members_and_usage.sql   # Multi-user
├── 20251221000000_schema_cleanup.sql              # Schema normalization
├── 20251218140000_ai_personas.sql                 # AI personas
└── 20251220000000_model_registry.sql              # LLM models

/home/user/AI-council/migrations/
└── 001_knowledge_entries.sql                       # Original knowledge schema
```

### Backend

```
/home/user/AI-council/backend/
├── main.py                  # FastAPI entry point
├── context_loader.py        # Knowledge → Council context
├── knowledge.py             # Knowledge entry CRUD
├── council.py               # 3-stage deliberation
├── storage.py               # File operations
├── personas.py              # AI persona management
├── security.py              # Auth & security
└── routers/
    ├── company.py           # /api/company/* endpoints
    └── settings.py          # Settings endpoints
```

### Frontend

```
/home/user/AI-council/frontend/src/
├── api.ts                   # API client (2400+ lines)
├── types/
│   ├── business.ts          # Business entity types
│   └── conversation.ts      # Message/conversation types
├── components/mycompany/
│   ├── hooks/
│   │   ├── useCompanyData.ts
│   │   ├── useDecisionActions.ts
│   │   └── useProjectActions.ts
│   ├── tabs/
│   │   ├── OverviewTab.tsx
│   │   ├── PlaybooksTab.tsx
│   │   ├── DecisionsTab.tsx
│   │   └── ProjectsTab.tsx
│   └── modals/
│       ├── ViewCompanyContextModal.tsx
│       ├── ViewPlaybookModal.tsx
│       ├── ViewDecisionModal.tsx
│       ├── ViewProjectModal.tsx
│       └── PromoteDecisionModal.tsx
└── hooks/queries/
    └── useCompany.ts
```

---

## 10. Permission Matrix

| Entity | View | Create | Edit | Delete | Who Can |
|--------|------|--------|------|--------|---------|
| Company Context | ✓ | N/A | ✓ | N/A | Any member (edit: owner only) |
| Department | ✓ | ✓ | ✓ | ✓ | Any member (CUD: admin only) |
| Role | ✓ | ✓ | ✓ | ✓ | Any member (CUD: admin only) |
| Playbook | ✓ | ✓ | ✓ | ✓ | Any member (delete: admin only) |
| Decision | ✓ | ✓ | ✓ | ✓ | Any member (delete: admin only) |
| Project | ✓ | ✓ | ✓ | ✓ | Any member (delete: admin only) |
| Activity Logs | ✓ | ✓ | - | - | Admin only (view); any member (create) |

---

## 11. Current Gaps & Observations

### Technical Debt

1. **Dual permission systems:** `user_department_access` (legacy) and `company_members` (new) both exist
2. **Mixed column naming:** Some use `TEXT[]`, others `UUID[]` for arrays
3. **No revision history:** Only playbooks have versioning
4. **RLS complexity:** Multiple overlapping policies

### Missing Features

1. **Full-text search:** No tsvector indexes
2. **Vector/semantic search:** No embeddings
3. **Document processing:** company_documents table exists but no parsing
4. **Audit trail:** Activity logs exist but no diff tracking
5. **Workflow:** No approval/review workflow for knowledge

### Inconsistencies

1. **Content field names:** `content`, `context_md`, `system_prompt` used inconsistently
2. **ID types:** Some TEXT, some UUID for department arrays
3. **Soft delete:** `is_active` exists on some tables but not all

### Performance Considerations

1. **Indexes exist:** GIN on arrays, B-tree on foreign keys
2. **No caching:** Context loader has basic in-memory cache
3. **N+1 queries:** Some endpoints fetch related data in loops

---

## 12. Recommendations for Conversational Updates Feature

### Data Model Implications

1. **Track update source:** Add `updated_by`, `update_source` ('manual' | 'conversation' | 'merge')
2. **Revision history:** Consider extending versioning to all content entities
3. **Partial updates:** Support incremental context updates vs full replacement

### API Considerations

1. **Streaming updates:** For long AI-generated content
2. **Conflict resolution:** When multiple updates occur
3. **Validation:** Ensure context coherence after updates

### Context Integration

1. **Knowledge entries:** Perfect for conversational updates (already have `question`, `content`)
2. **Company context:** Would benefit from section-aware updates
3. **Projects:** Auto-synthesis already works well

---

*End of Audit Report*
