# Admin Portal Roadmap - AxCouncil Platform

> **Created**: January 2026
> **Status**: In Progress
> **Last Updated**: January 19, 2026

This document outlines the phased implementation plan for the AxCouncil Admin Portal, based on 2025/2026 B2B SaaS best practices, competitive analysis, and the platform's current architecture.

---

## Executive Summary

The Admin Portal is a separate full-page interface (`/admin`) for platform administrators to manage users, companies, billing, compliance, and platform health. It follows the "admin as a separate app" pattern used by Stripe, Vercel, and other tier-1 SaaS platforms.

### Current State (Implemented)
- [x] Admin access control (`platform_admins` table with roles)
- [x] Admin authentication check (`useAdminAccess` hook)
- [x] Route protection and lazy loading
- [x] Stats dashboard (users, companies, conversations, messages)
- [x] Users tab with search and pagination
- [x] Companies tab with search and pagination
- [x] Admin roles tab (list current admins)
- [x] Audit logs tab with filtering
- [x] **Platform Invitations** - Invite users via email
- [ ] Settings tab (placeholder)

---

## Phase 1: Core Admin Infrastructure
**Status: COMPLETE**

### 1.1 Authentication & Authorization
- [x] `platform_admins` table with role hierarchy
- [x] Three-tier role system:
  - `super_admin` - Full platform access, can manage other admins
  - `admin` - Standard admin access, can manage users/companies
  - `support` - Read-only access for customer support
- [x] Backend middleware for admin route protection
- [x] Frontend `useAdminAccess` hook with React Query caching

### 1.2 Admin Portal Shell
- [x] Separate route (`/admin`) with own layout
- [x] Sidebar navigation with 5 tabs
- [x] Lazy-loaded for bundle optimization
- [x] Dark mode support via ThemeToggle
- [x] Back to app navigation

### 1.3 Stats Dashboard
- [x] Real-time platform metrics (cached 1 minute)
- [x] Total users, companies, conversations, messages
- [x] Color-coded stat cards with icons

---

## Phase 2: User & Company Management (Enhanced)
**Priority: HIGH | Effort: Medium**

### 2.1 Enhanced User Management

#### 2.1.1 User Details Panel
- [ ] Click-to-expand user row showing:
  - Full user profile
  - Company membership
  - Activity timeline
  - API key status
  - Billing tier
- [ ] Quick actions: Reset password, disable account, send email

#### 2.1.2 User Impersonation
**Security-first implementation following 2025 best practices**

- [ ] "Login as User" button for support scenarios
- [ ] Impersonation banner (sticky, cannot be dismissed)
  ```
  [!] You are viewing as user@example.com | [Exit Impersonation]
  ```
- [ ] Visual differentiation (border color, watermark)
- [ ] Automatic session timeout (30 minutes max)
- [ ] Full audit logging of all impersonated actions
- [ ] Requires MFA confirmation before impersonation
- [ ] Only `super_admin` and `admin` roles can impersonate
- [ ] Cannot impersonate other admins

**Implementation approach:**
```typescript
// Backend endpoint
POST /api/admin/impersonate
Body: { target_user_id: string, reason: string }
Response: { impersonation_token: string, expires_at: string }

// Frontend storage
sessionStorage.setItem('impersonation', JSON.stringify({
  token: string,
  originalAdmin: string,
  targetUser: string,
  expiresAt: string
}));
```

#### 2.1.3 Bulk Actions
- [ ] Select multiple users
- [ ] Bulk email (with template)
- [ ] Bulk export to CSV
- [ ] Bulk status change (with confirmation)

### 2.2 Enhanced Company Management

#### 2.2.1 Company Details Panel
- [ ] Click-to-expand company row showing:
  - Company profile and context
  - Team members list
  - Usage metrics (conversations, API calls)
  - Subscription/billing status
  - Recent activity

#### 2.2.2 Company Actions
- [ ] Edit company profile
- [ ] Transfer ownership
- [ ] Merge companies (handle duplicates)
- [ ] Archive/delete company (soft delete)
- [ ] Export company data (GDPR compliance)

#### 2.2.3 Company Health Score
**AI-powered health scoring (2025 best practice)**

- [ ] Health score algorithm based on:
  - Login frequency (weighted 20%)
  - Feature adoption (weighted 25%)
  - API usage trends (weighted 20%)
  - Support ticket volume (weighted 15%)
  - Time since last activity (weighted 20%)
- [ ] Risk indicators: "At Risk", "Healthy", "Champion"
- [ ] Churn prediction alerts
- [ ] Suggested interventions

```typescript
interface CompanyHealthScore {
  score: number;           // 0-100
  tier: 'at_risk' | 'monitor' | 'healthy' | 'champion';
  factors: {
    login_frequency: number;
    feature_adoption: number;
    api_usage_trend: number;
    support_tickets: number;
    days_since_active: number;
  };
  recommendations: string[];
  churn_probability: number;
}
```

---

## Phase 3: Audit Logging & Compliance
**Priority: HIGH | Effort: High**

### 3.1 Audit Log Infrastructure

#### 3.1.1 Database Schema
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Actor
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'api')),

  -- Action
  action TEXT NOT NULL,
  action_category TEXT NOT NULL,

  -- Target
  resource_type TEXT NOT NULL,
  resource_id UUID,
  resource_name TEXT,

  -- Context
  company_id UUID REFERENCES public.companies(id),
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Changes
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,

  -- Compliance
  retention_until TIMESTAMPTZ,
  is_sensitive BOOLEAN DEFAULT false
);

-- Indexes for common queries
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_company ON audit_logs(company_id, timestamp DESC);
```

#### 3.1.2 Action Categories
| Category | Actions |
|----------|---------|
| `auth` | login, logout, password_reset, mfa_setup |
| `user` | create, update, delete, impersonate |
| `company` | create, update, delete, transfer |
| `data` | export, import, bulk_delete |
| `admin` | role_grant, role_revoke, setting_change |
| `api` | key_create, key_revoke, rate_limit_hit |
| `billing` | subscription_change, payment_failed |
| `security` | suspicious_activity, access_denied |

#### 3.1.3 Audit Log UI
- [ ] Filterable log table with:
  - Date range picker
  - Actor filter (user, admin, system)
  - Action category filter
  - Resource type filter
  - Company filter
- [ ] Real-time log streaming (optional)
- [ ] Export to CSV/JSON
- [ ] Retention policy display

### 3.2 Compliance Features

#### 3.2.1 GDPR Data Export
- [ ] "Export User Data" button on user details
- [ ] Generates complete data package (JSON/ZIP)
- [ ] Includes: profile, companies, conversations, API keys
- [ ] Audit logged as `data.export`

#### 3.2.2 Data Deletion
- [ ] "Delete User Data" with confirmation
- [ ] Cascading deletion with company reassignment
- [ ] 30-day soft delete window
- [ ] Permanent deletion after retention period
- [ ] Audit logged as `data.delete`

#### 3.2.3 Compliance Reports
- [ ] SOC 2 activity report generator
- [ ] Access review report (who has access to what)
- [ ] Admin action summary report
- [ ] Scheduled report emails

---

## Phase 3.5: Platform Invitations
**Status: COMPLETE**

### 3.5.1 Invitation System
Invite-only user onboarding flow for controlled platform growth.

- [x] Database schema (`platform_invitations` table)
- [x] Admin invitation endpoints (create, list, cancel, resend)
- [x] Public invitation endpoints (validate, accept)
- [x] Email service abstraction (placeholder for Resend)
- [x] Invitations tab in Admin Portal
- [x] "Invite User" modal with email/name/notes
- [x] Invitation list with status badges (pending, accepted, expired, cancelled)
- [x] Resend and cancel actions
- [x] `/accept-invite` public page for new user signup

**Flow:**
1. Admin creates invitation → email sent (or logged to console if email disabled)
2. Recipient clicks link → `/accept-invite?token=xxx`
3. Page validates token → shows signup form
4. User creates password → Supabase account created
5. Invitation marked accepted → user redirected to app

**Future enhancements:**
- [ ] Resend email integration
- [ ] Invitation expiry reminders
- [ ] Bulk invitation import (CSV)
- [ ] Invitation analytics (open rate, conversion)

---

## Phase 4: Platform Settings & Configuration
**Priority: MEDIUM | Effort: Medium**

### 4.1 Feature Flags Management
- [ ] UI for toggling feature flags
- [ ] Per-flag description and status
- [ ] Environment indicator (dev/staging/prod)
- [ ] Audit logging of flag changes

### 4.2 Model Registry Management
- [ ] View/edit LLM model configurations
- [ ] Enable/disable models per tier
- [ ] Set default models per role
- [ ] Cost tracking per model

### 4.3 Rate Limiting Configuration
- [ ] View current rate limits
- [ ] Adjust limits per tier
- [ ] Exception rules for specific users/companies

### 4.4 Email Templates
- [ ] View/edit transactional email templates
- [ ] Preview with sample data
- [ ] Version history

### 4.5 Maintenance Mode
- [ ] Toggle maintenance mode
- [ ] Custom maintenance message
- [ ] Whitelist admin IPs during maintenance

---

## Phase 5: Advanced Analytics & Monitoring
**Priority: MEDIUM | Effort: High**

### 5.1 Usage Analytics Dashboard
- [ ] Daily/weekly/monthly active users (DAU/WAU/MAU)
- [ ] Conversation volume trends
- [ ] API call volume and latency
- [ ] Token usage and costs
- [ ] Geographic distribution

### 5.2 System Health Monitoring
- [ ] Backend service status
- [ ] Database connection pool
- [ ] Redis cache hit rates
- [ ] Qdrant vector DB status
- [ ] External API health (OpenRouter, Supabase)

### 5.3 Revenue Analytics
- [ ] MRR/ARR tracking
- [ ] Churn rate trends
- [ ] LTV calculations
- [ ] Cohort analysis

### 5.4 AI-Powered Insights
- [ ] Anomaly detection alerts
- [ ] Usage pattern insights
- [ ] Churn risk predictions
- [ ] Feature adoption recommendations

---

## Phase 6: Support & Communication Tools
**Priority: LOW | Effort: Medium**

### 6.1 In-App Announcements
- [ ] Create announcement banners
- [ ] Target by user segment
- [ ] Schedule announcements
- [ ] Track dismissals

### 6.2 Broadcast Messaging
- [ ] Send email to user segments
- [ ] Template system
- [ ] Preview and test sends
- [ ] Delivery tracking

### 6.3 Support Ticket Integration
- [ ] View support tickets (if integrated)
- [ ] Link tickets to users/companies
- [ ] Quick response templates

---

## Technical Implementation Notes

### API Endpoints Structure
```
/api/admin/
├── stats                    # GET - Platform statistics
├── users                    # GET - List users (paginated)
├── users/:id                # GET - User details
├── users/:id/impersonate    # POST - Start impersonation
├── users/:id/actions        # POST - User actions (reset, disable, etc.)
├── companies                # GET - List companies (paginated)
├── companies/:id            # GET - Company details
├── companies/:id/health     # GET - Health score
├── admins                   # GET - List admins
├── admins                   # POST - Grant admin role
├── admins/:id               # DELETE - Revoke admin role
├── audit                    # GET - Audit logs (paginated, filtered)
├── audit/export             # POST - Export audit logs
├── settings                 # GET - Platform settings
├── settings/:key            # PUT - Update setting
├── feature-flags            # GET/PUT - Feature flags
└── announcements            # CRUD - Announcements
```

### Security Considerations
1. **All admin endpoints require**:
   - Valid JWT token
   - User exists in `platform_admins` table
   - `is_active = true`
   - Role permits the action

2. **Sensitive actions require**:
   - MFA confirmation (impersonation, role changes)
   - Audit logging with full context
   - Rate limiting

3. **Data access**:
   - Admin queries bypass company-level RLS
   - Use service role client for admin operations
   - Log all data access

### Frontend Architecture
```
frontend/src/components/admin/
├── AdminPortal.tsx          # Main shell (exists)
├── AdminPortal.css          # Styles (exists)
├── tabs/
│   ├── UsersTab.tsx         # Enhanced user management
│   ├── CompaniesTab.tsx     # Enhanced company management
│   ├── AuditTab.tsx         # Audit log viewer
│   ├── AdminsTab.tsx        # Admin role management
│   └── SettingsTab.tsx      # Platform settings
├── components/
│   ├── UserDetailsPanel.tsx
│   ├── CompanyDetailsPanel.tsx
│   ├── ImpersonationBanner.tsx
│   ├── HealthScoreCard.tsx
│   └── AuditLogTable.tsx
└── hooks/
    ├── useAdminUsers.ts
    ├── useAdminCompanies.ts
    ├── useAuditLogs.ts
    └── useImpersonation.ts
```

---

## Prioritized Backlog

### Sprint 1: User Impersonation
1. Backend impersonation endpoint
2. Frontend impersonation banner
3. Audit logging for impersonation
4. Session management

### Sprint 2: Enhanced User Details
1. User details expandable panel
2. Activity timeline component
3. Quick action buttons
4. API key management view

### Sprint 3: Audit Logging
1. Database schema migration
2. Backend logging middleware
3. Audit log API endpoints
4. Frontend audit log viewer

### Sprint 4: Company Health
1. Health score algorithm
2. Backend health endpoint
3. Health score display
4. Risk indicators

### Sprint 5: Platform Settings
1. Feature flags UI
2. Model registry UI
3. Settings CRUD endpoints

---

## Competitive Reference

### Stripe Dashboard Features
- Clean data tables with inline actions
- Expandable row details
- Real-time search
- Export functionality
- Webhook logs viewer

### Vercel Admin Patterns
- Usage graphs and analytics
- Team management
- Domain management
- Deployment logs

### Linear Admin UX
- Keyboard navigation
- Fast search (Cmd+K)
- Minimal, focused interface
- Activity streams

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Admin task completion time | < 30 seconds | N/A |
| Support ticket resolution time | -25% | Baseline |
| Admin satisfaction score | > 4.5/5 | N/A |
| Impersonation audit coverage | 100% | N/A |
| Compliance report generation | < 5 min | N/A |

---

## Appendix: Role Permission Matrix

| Action | super_admin | admin | support |
|--------|-------------|-------|---------|
| View users | ✓ | ✓ | ✓ |
| Edit users | ✓ | ✓ | ✗ |
| Delete users | ✓ | ✗ | ✗ |
| Impersonate | ✓ | ✓ | ✗ |
| View companies | ✓ | ✓ | ✓ |
| Edit companies | ✓ | ✓ | ✗ |
| Delete companies | ✓ | ✗ | ✗ |
| View audit logs | ✓ | ✓ | ✓ |
| Export data | ✓ | ✓ | ✗ |
| Manage admins | ✓ | ✗ | ✗ |
| Platform settings | ✓ | ✗ | ✗ |
| Feature flags | ✓ | ✓ | ✗ |

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial roadmap creation |
| 2026-01-19 | Claude | Added Phase 3.5 Platform Invitations (complete), marked Audit Logs complete |
