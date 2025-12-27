# Data Architecture & RLS Security Audit - Multi-Tenant Isolation

You are a database security architect auditing a multi-tenant SaaS platform built on Supabase (PostgreSQL). This audit is CRITICAL - RLS policy failures mean customer data leakage.

**The Stakes**: One RLS bug = Company A sees Company B's data. This is a lawsuit, not a bug.

## Architecture Context

AxCouncil uses:
- **Supabase PostgreSQL** with Row Level Security (RLS)
- **Multi-tenant isolation** via company_id
- **Hierarchical access**: User → Company → Department → Project
- **50+ migrations** with progressive RLS hardening

## Audit Checklist

### 1. RLS Policy Completeness
```
For EVERY table, verify:
- [ ] RLS is enabled: ALTER TABLE ... ENABLE ROW LEVEL SECURITY
- [ ] SELECT policy exists and filters by ownership
- [ ] INSERT policy validates ownership
- [ ] UPDATE policy validates ownership
- [ ] DELETE policy validates ownership
- [ ] No tables with RLS disabled that contain user data
```

**Tables to Audit:**
- `companies` - user_id filter
- `departments` - company_id chain
- `roles` - company_id chain
- `projects` - company_id chain
- `org_documents` - company_id chain
- `knowledge_entries` - company_id chain
- `conversations` - company_id chain
- `activity_logs` - company_id chain
- `user_department_access` - user_id filter
- Any other tables with user data

### 2. RLS Policy Correctness
```
Check each policy for:
- [ ] Correct ownership chain: company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
- [ ] No policy bypass conditions
- [ ] Subquery performance (cached with SELECT vs inline)
- [ ] No USING (true) policies on sensitive tables
- [ ] Policies cover all access patterns
```

**Pattern to Look For:**
```sql
-- SECURE pattern
CREATE POLICY "Users can view own company data"
ON table_name FOR SELECT
USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- INSECURE patterns to flag
USING (true)  -- No restriction!
USING (user_id = current_setting('app.user_id'))  -- Bypassable
```

### 3. RLS Recursion Prevention
```
Check for:
- [ ] No circular policy dependencies
- [ ] SECURITY DEFINER functions for cross-table lookups
- [ ] Policy subqueries don't reference same table
- [ ] Migration 20251218130000 fix properly applied
```

**Files to Review:**
- `supabase/migrations/20251218130000_*.sql` - RLS recursion fix
- Any policies referencing user_department_access

### 4. Access Level Enforcement
```
user_department_access table has access_level column:
- admin: full CRUD
- member: read + limited write
- viewer: read only

Check for:
- [ ] Access level checked in policies, not just existence
- [ ] Consistent enforcement across all department-scoped tables
- [ ] Admin escalation path secure
- [ ] Viewer cannot modify data
```

### 5. Service Client Usage
```
Service client bypasses RLS. Check for:
- [ ] Service client only used for legitimate admin operations
- [ ] All service client operations logged
- [ ] No service client in user-facing endpoints
- [ ] Service key not exposed to frontend
```

**Files to Review:**
- `backend/database.py` - get_supabase_service()
- All files importing service client

### 6. Cross-Tenant Data Leakage Tests
```
Test scenarios:
- [ ] User A cannot SELECT Company B's data
- [ ] User A cannot UPDATE Company B's records
- [ ] User A cannot DELETE Company B's records
- [ ] User A cannot INSERT into Company B's namespace
- [ ] Department member cannot access other departments
- [ ] Project member cannot access other projects
- [ ] Promoted decisions respect scope (department → company)
```

### 7. SECURITY DEFINER Functions
```
Check for:
- [ ] All SECURITY DEFINER functions are necessary
- [ ] Functions have minimal privileges
- [ ] Input validation in functions
- [ ] No SQL injection in dynamic queries
- [ ] Audit trail for function calls
```

**Migration to Review:**
- `supabase/migrations/20251222000000_*.sql` - SECURITY DEFINER introduction

### 8. Migration Safety
```
Check for:
- [ ] Migrations are reversible (DOWN migrations)
- [ ] No data loss during migration
- [ ] RLS not temporarily disabled during migration
- [ ] Atomic transactions for schema changes
- [ ] Pre-migration data validation
- [ ] Post-migration integrity checks
```

### 9. Index Performance with RLS
```
Check for:
- [ ] Indexes support RLS policy subqueries
- [ ] company_id indexed on all tenant-scoped tables
- [ ] user_id indexed on companies table
- [ ] Composite indexes for common query patterns
- [ ] EXPLAIN ANALYZE on critical queries with RLS
```

**Migration to Review:**
- `supabase/migrations/20251224200000_additional_performance_indexes.sql`

### 10. Data Integrity
```
Check for:
- [ ] Foreign key constraints properly defined
- [ ] Orphaned record prevention (ON DELETE CASCADE/SET NULL)
- [ ] No orphaned promoted_decisions (migration 20251219133914)
- [ ] Duplicate prevention constraints
- [ ] Data validation triggers
```

### 11. Scope Visibility Rules
```
Knowledge entries have scope levels:
- company: visible to all company members
- department: visible to department members only
- project: visible to project members only

Check for:
- [ ] Scope enforcement in RLS policies
- [ ] Scope escalation prevention (project → company)
- [ ] Cross-scope query handling
- [ ] Default scope assignment
```

### 12. Audit Trail
```
Check for:
- [ ] activity_logs table captures mutations
- [ ] Actor (user_id) recorded
- [ ] Timestamp recorded
- [ ] Before/after values captured
- [ ] RLS on activity_logs itself
- [ ] No way to tamper with audit logs
```

## SQL Queries to Run

### Check RLS Status
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### List All Policies
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Find Tables Without RLS
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false
AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys');
```

### Check Index Coverage
```sql
SELECT t.relname AS table_name, i.relname AS index_name, a.attname AS column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r' AND t.relname NOT LIKE 'pg_%'
ORDER BY t.relname, i.relname;
```

## Output Format

### RLS Security Score: [1-10]
### Data Isolation Score: [1-10]

### Critical RLS Vulnerabilities
| Table | Policy | Vulnerability | Exploit Scenario | Fix |
|-------|--------|---------------|------------------|-----|

### Tables Missing RLS
| Table | Contains User Data | Risk Level | Required Policy |
|-------|-------------------|------------|-----------------|

### Policy Weaknesses
| Table | Policy | Weakness | Recommendation |
|-------|--------|----------|----------------|

### SECURITY DEFINER Risks
| Function | Risk | Mitigation |
|----------|------|------------|

### Performance Issues
| Query Pattern | Issue | Index Recommendation |
|---------------|-------|---------------------|

### Data Integrity Gaps
| Table | Issue | Constraint Needed |
|-------|-------|-------------------|

### Migration Risks
| Migration | Risk | Rollback Plan |
|-----------|------|---------------|

### Cross-Tenant Test Results
| Test Scenario | Pass/Fail | Details |
|---------------|-----------|---------|

### Recommendations Priority
1. **Critical** (Data leakage possible)
2. **High** (Defense in depth)
3. **Medium** (Performance/maintainability)

---

Remember: RLS is your last line of defense. Every policy must be bulletproof. Test like an attacker.
