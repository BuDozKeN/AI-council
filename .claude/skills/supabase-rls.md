---
name: supabase-rls
description: Supabase RLS policies, multi-tenancy patterns, database security
tags: [supabase, database, security, rls]
---

# Supabase RLS Patterns

This skill contains Supabase Row Level Security patterns for AxCouncil. Load when working on database or authorization.

## Core RLS Policy

All tables enforce multi-tenant isolation:
```sql
company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
```

This ensures users can only access data belonging to their companies.

## Database Patterns

### Always Use Parameterized Queries

```python
# CORRECT: Parameterized
supabase.table("items").select("*").eq("company_id", company_id).execute()

# WRONG: String concatenation (SQL injection risk!)
supabase.table("items").select(f"* WHERE company_id = '{company_id}'")
```

### Service Client vs Auth Client

```python
# Use service client only for admin operations
from database import get_supabase_service
service = get_supabase_service()

# Use auth client for user-scoped queries (respects RLS)
from database import get_supabase_with_auth
client = get_supabase_with_auth(user["access_token"])
```

**When to use which:**
- **Service client**: Admin operations, system tasks, background jobs
- **Auth client**: User-initiated requests, API endpoints

## Core Tables

| Table | Purpose |
|-------|---------|
| `companies` | Company profiles with context |
| `departments` | Department configurations |
| `roles` | AI personas with system prompts |
| `org_documents` | Playbooks (SOPs, policies) |
| `knowledge_entries` | Saved decisions |
| `conversations` | Chat history |

## RLS Policy Patterns

### Basic Owner Policy

```sql
-- User can only see their own companies
CREATE POLICY "users_own_companies" ON companies
FOR ALL USING (user_id = auth.uid());
```

### Company Member Policy

```sql
-- User can see data for companies they own
CREATE POLICY "company_data_access" ON departments
FOR ALL USING (
  company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
);
```

### Admin Override

```sql
-- Admins can see all data
CREATE POLICY "admin_access" ON companies
FOR ALL USING (
  auth.jwt() ->> 'role' = 'admin'
);
```

## Security Checklist

### RLS Validation

- [ ] ALL tables have RLS enabled
- [ ] Policies use `auth.uid()` not client-provided values
- [ ] Service key usage minimized and audited
- [ ] No RLS bypass in application code without explicit justification
- [ ] Test RLS with multiple user contexts

### API Endpoint Checklist

Every endpoint should:
1. **Authenticate** - Verify JWT is valid
2. **Authorize** - Check user has permission for this action
3. **Filter by ownership** - Use RLS or explicit company_id checks
4. **Validate input** - Reject malformed requests
5. **Return minimal data** - Don't expose more than needed

### Common Security Pitfalls

**Backend:**
- **Don't** expose internal errors - use `create_secure_error()`
- **Don't** bypass RLS unless admin operation requires it
- **Don't** store sensitive data without encryption
- **Do** filter all queries by user/company ownership
- **Do** use rate limiting on public endpoints

## Router Pattern

```python
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/api/resource", tags=["resource"])

@router.get("/")
async def list_items(user: dict = Depends(get_current_user)):
    # Always filter by user ownership
    return await get_items_for_user(user["id"])
```

## Pydantic Models

Define request/response models in each router file:

```python
class CreateItemRequest(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
```

## Testing RLS

### Manual Testing

```sql
-- Test as a specific user
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';

-- Try to access data
SELECT * FROM companies;  -- Should only show user's companies
```

### Automated Testing

```python
async def test_rls_isolation():
    # Create two users with separate companies
    user1 = await create_test_user()
    user2 = await create_test_user()

    company1 = await create_company(user1)
    company2 = await create_company(user2)

    # User 1 should not see user 2's company
    client1 = get_supabase_with_auth(user1.token)
    companies = client1.table("companies").select("*").execute()

    assert len(companies.data) == 1
    assert companies.data[0]["id"] == company1.id
```

## Multi-Tenancy Architecture

```
User
 └── owns many Companies
      └── has many Departments
           └── has many Roles
      └── has many Conversations
      └── has many Knowledge Entries
      └── has many Org Documents
```

**Key principle:** All queries should ultimately filter by `user_id = auth.uid()` through the company relationship.
