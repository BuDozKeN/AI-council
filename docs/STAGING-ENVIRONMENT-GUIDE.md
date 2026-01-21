# Staging Environment & Production Testing Guide

> A comprehensive guide for implementing staging environments and deployment best practices for AxCouncil.

## Table of Contents

1. [Why Staging Matters](#why-staging-matters)
2. [The $25M Question](#the-25m-question)
3. [Modern Best Practices (2024-2026)](#modern-best-practices)
4. [Implementation Plan](#implementation-plan)
5. [Database Strategies](#database-strategies)
6. [Cost Analysis](#cost-analysis)
7. [Deployment Pipeline](#deployment-pipeline)
8. [Feature Flags](#feature-flags)
9. [Quick Reference](#quick-reference)

---

## Why Staging Matters

### The Problem You're Experiencing

```
Local Environment          Production Environment
─────────────────         ─────────────────────
✓ Fresh database          ✗ Years of real data
✓ Happy path data         ✗ Edge cases everywhere
✓ Single user testing     ✗ Concurrent users
✓ Dev machine specs       ✗ Cloud resource limits
✓ Mocked external APIs    ✗ Real rate limits
✓ Admin access to all     ✗ RLS policies active
```

**Real bugs that staging catches:**
- Data migration issues with existing records
- Performance with 10,000+ rows (not 10 test rows)
- Edge cases in user data (nulls, special chars, long strings)
- RLS policy conflicts with new features
- Third-party API rate limits and errors
- Environment variable misconfigurations
- CORS and CSP header issues

### The Cost of Production Bugs

| Stage Found | Cost to Fix | User Impact |
|-------------|-------------|-------------|
| Local Dev | $1 | None |
| Staging | $10 | None |
| Production | $100+ | Real users affected |
| Post-mortem | $1000+ | Trust damaged |

---

## The $25M Question

> "Do we need staging for a $25M software company?"

**Absolutely yes. Here's why:**

### What $25M Companies Have That You Need

1. **Zero-downtime deployments** - Users expect 99.9% uptime
2. **Confidence in releases** - Deploy Friday afternoon without fear
3. **Rapid iteration** - Ship daily, not monthly
4. **Compliance readiness** - SOC2, GDPR require audit trails
5. **Enterprise sales** - "How do you test before production?" is an RFP question

### The Maturity Progression

| Revenue Stage | Minimum Deployment Maturity |
|--------------|----------------------------|
| $0-100K | Local → Production (acceptable risk) |
| $100K-1M | CI/CD + Basic staging |
| $1M-5M | Full staging + Feature flags |
| $5M-25M | Blue/green + Canary + Observability |
| $25M+ | Multi-region + Chaos engineering |

**You're in the $1M-5M transition zone** - perfect time to build this foundation.

---

## Modern Best Practices (2024-2026)

### 1. Environment Parity

**Principle:** Staging should be identical to production except for data.

```yaml
# What should match:
- Same cloud provider (Render)
- Same database version (Supabase PostgreSQL 15)
- Same Redis/Qdrant configuration
- Same environment variable structure
- Same security policies (RLS, CORS, CSP)

# What differs:
- Database contains sanitized/synthetic data
- Isolated tenant (no real user data)
- Lower resource allocation (cost savings)
```

### 2. Trunk-Based Development

```
main (production)
  │
  ├── feature/xyz  ← Short-lived (1-3 days max)
  │     └── Merges to main via PR
  │
  └── All commits go through:
        1. PR review
        2. CI tests
        3. Preview/staging
        4. Production
```

### 3. Deployment Strategies

| Strategy | Risk | Complexity | Best For |
|----------|------|------------|----------|
| **Rolling** | Medium | Low | Most deployments |
| **Blue/Green** | Low | Medium | Critical services |
| **Canary** | Very Low | High | High-traffic features |
| **Feature Flags** | Lowest | Medium | Gradual rollouts |

**Recommended for AxCouncil:** Rolling + Feature Flags

### 4. Database Migration Safety

```sql
-- SAFE: Additive changes (no staging needed)
ALTER TABLE users ADD COLUMN new_field TEXT;

-- RISKY: Destructive changes (test in staging!)
ALTER TABLE users DROP COLUMN old_field;
ALTER TABLE users ALTER COLUMN status TYPE integer;
```

### 5. Observability Triad

```
                    ┌─────────────┐
                    │   Metrics   │ ← Prometheus/Datadog
                    │  (numbers)  │   "Response time: 234ms"
                    └─────────────┘
                          │
    ┌─────────────┐      │      ┌─────────────┐
    │    Logs     │──────┴──────│   Traces    │
    │   (events)  │             │  (journeys) │
    │  Sentry/Log │             │  OpenTel    │
    └─────────────┘             └─────────────┘
```

---

## Implementation Plan

### Phase 1: Staging Environment (Week 1-2)

#### Step 1: Create Supabase Staging Project

```bash
# 1. Go to https://supabase.com/dashboard
# 2. Create new project: "axcouncil-staging"
# 3. Note the URL and keys

# Environment variables for staging:
SUPABASE_URL=https://xxxxx-staging.supabase.co
SUPABASE_ANON_KEY=eyJ...staging-key
SUPABASE_SERVICE_KEY=eyJ...staging-service-key
```

#### Step 2: Create Render Staging Service

```yaml
# render-staging.yaml
services:
  - type: web
    name: axcouncil-backend-staging
    env: python
    plan: free  # or starter for better performance
    region: oregon
    buildCommand: pip install --upgrade pip && pip install -r requirements.txt && pip install -e .
    startCommand: python -m backend.main
    healthCheckPath: /health
    envVars:
      - key: ENVIRONMENT
        value: staging
      - key: SUPABASE_URL
        sync: false  # Set manually in dashboard
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: OPENROUTER_API_KEY
        sync: false
```

#### Step 3: Create Vercel Staging (Preview Environments)

Vercel already provides this! Every PR gets a preview URL:
```
PR #123 → https://ai-council-git-feature-xyz-budozken.vercel.app
```

To create a persistent staging:
```bash
# vercel.json - add environment
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "staging": true  // Add staging branch
    }
  }
}
```

#### Step 4: Update GitHub Actions

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]
  pull_request:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # GitHub environment with secrets

    steps:
      - uses: actions/checkout@v4

      - name: Deploy Backend to Staging
        run: |
          curl -X POST "${{ secrets.RENDER_STAGING_DEPLOY_HOOK }}"

      - name: Wait for deployment
        run: sleep 60

      - name: Health check
        run: |
          for i in {1..10}; do
            if curl -sf https://axcouncil-backend-staging.onrender.com/health; then
              echo "✅ Staging is healthy"
              exit 0
            fi
            echo "Attempt $i failed, waiting..."
            sleep 30
          done
          exit 1

      - name: Run E2E tests against staging
        run: |
          cd frontend
          VITE_API_URL=https://axcouncil-backend-staging.onrender.com \
          npm run test:e2e
```

### Phase 2: Database Seeding (Week 2-3)

#### Option A: Sanitized Production Clone (Recommended)

```python
# scripts/seed_staging.py
"""
Clone production data to staging with sanitization.
Run monthly or before major releases.
"""

import hashlib
from supabase import create_client

PROD_URL = "https://prod.supabase.co"
STAGING_URL = "https://staging.supabase.co"

def sanitize_email(email: str) -> str:
    """Convert real emails to test emails"""
    hash_part = hashlib.md5(email.encode()).hexdigest()[:8]
    return f"test-{hash_part}@example.com"

def sanitize_company(company: dict) -> dict:
    """Remove sensitive business data"""
    return {
        **company,
        "name": f"Test Company {company['id'][:8]}",
        "context": "Test company for staging environment",
        # Keep structure, sanitize content
    }

def clone_to_staging():
    prod = create_client(PROD_URL, PROD_SERVICE_KEY)
    staging = create_client(STAGING_URL, STAGING_SERVICE_KEY)

    # Clone companies (sanitized)
    companies = prod.table("companies").select("*").execute()
    for company in companies.data:
        sanitized = sanitize_company(company)
        staging.table("companies").upsert(sanitized).execute()

    # Clone structure tables (departments, roles - less sensitive)
    for table in ["departments", "roles", "model_registry"]:
        data = prod.table(table).select("*").execute()
        staging.table(table).upsert(data.data).execute()

    print(f"✅ Cloned {len(companies.data)} companies to staging")

if __name__ == "__main__":
    clone_to_staging()
```

#### Option B: Synthetic Data Factory

```python
# scripts/generate_staging_data.py
"""
Generate realistic test data without touching production.
Useful for specific test scenarios.
"""

from faker import Faker
from supabase import create_client

fake = Faker()

def generate_company():
    return {
        "name": fake.company(),
        "context": fake.catch_phrase(),
        "industry": fake.random_element(["tech", "finance", "healthcare"]),
        "size": fake.random_element(["startup", "smb", "enterprise"]),
    }

def generate_departments(company_id: str, count: int = 5):
    departments = ["Engineering", "Product", "Marketing", "Sales", "Operations"]
    return [
        {
            "company_id": company_id,
            "name": dept,
            "description": fake.bs(),
        }
        for dept in departments[:count]
    ]

def seed_staging(num_companies: int = 10):
    staging = create_client(STAGING_URL, STAGING_SERVICE_KEY)

    for _ in range(num_companies):
        # Create company
        company = staging.table("companies").insert(
            generate_company()
        ).execute().data[0]

        # Create departments
        departments = generate_departments(company["id"])
        staging.table("departments").insert(departments).execute()

    print(f"✅ Generated {num_companies} test companies with departments")
```

### Phase 3: Deployment Pipeline (Week 3-4)

#### Complete CI/CD Flow

```yaml
# .github/workflows/complete-pipeline.yml
name: Complete CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  # ════════════════════════════════════════════
  # STAGE 1: Quality Gates
  # ════════════════════════════════════════════
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Lint & Type Check
        run: |
          cd frontend
          npm run lint
          npm run lint:css
          npm run type-check

      - name: Unit Tests
        run: cd frontend && npm run test:coverage

      - name: Backend Tests
        run: |
          pip install -e ".[dev]"
          pytest backend/tests/ -v --cov=backend --cov-fail-under=40

  # ════════════════════════════════════════════
  # STAGE 2: Build & Security
  # ════════════════════════════════════════════
  build:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build

      - name: Check Bundle Size
        run: cd frontend && npm run size

      - name: Security Scan
        uses: github/codeql-action/analyze@v3

  # ════════════════════════════════════════════
  # STAGE 3: Deploy to Staging
  # ════════════════════════════════════════════
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy Backend to Staging
        run: curl -X POST "${{ secrets.RENDER_STAGING_DEPLOY_HOOK }}"

      - name: Wait & Health Check
        run: |
          sleep 60
          for i in {1..10}; do
            curl -sf https://axcouncil-backend-staging.onrender.com/health && exit 0
            sleep 30
          done
          exit 1

  # ════════════════════════════════════════════
  # STAGE 4: E2E Tests on Staging
  # ════════════════════════════════════════════
  e2e-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run E2E Tests
        env:
          VITE_API_URL: https://axcouncil-backend-staging.onrender.com
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
        run: |
          cd frontend
          npm ci
          npx playwright install chromium
          npm run test:e2e

      - name: Upload Test Results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: frontend/playwright-report/

  # ════════════════════════════════════════════
  # STAGE 5: Deploy to Production
  # ════════════════════════════════════════════
  deploy-production:
    needs: e2e-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://axcouncil-backend.onrender.com
    steps:
      - name: Deploy Backend to Production
        run: curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"

      - name: Wait & Health Check
        run: |
          sleep 60
          for i in {1..10}; do
            curl -sf https://axcouncil-backend.onrender.com/health && exit 0
            sleep 30
          done
          exit 1

      - name: Notify Success
        if: success()
        run: echo "✅ Production deployment successful"

      - name: Notify Failure
        if: failure()
        run: |
          echo "❌ Production deployment failed"
          # Add Slack/Discord webhook here
```

---

## Database Strategies

### Strategy 1: Snapshot Restore (Fastest)

```bash
# Supabase CLI approach
# Take production snapshot
supabase db dump -p $PROD_PROJECT_REF > prod_snapshot.sql

# Sanitize sensitive data
sed -i 's/@[a-zA-Z0-9.-]*\.com/@example.com/g' prod_snapshot.sql

# Restore to staging
supabase db push -p $STAGING_PROJECT_REF < prod_snapshot.sql
```

### Strategy 2: Migration + Seed (Most Control)

```sql
-- supabase/seed.sql (for staging only)

-- Test users
INSERT INTO auth.users (id, email) VALUES
  ('test-user-1', 'admin@staging.local'),
  ('test-user-2', 'user@staging.local');

-- Test companies
INSERT INTO companies (id, user_id, name, context) VALUES
  ('test-company-1', 'test-user-1', 'Acme Corp', 'Tech startup'),
  ('test-company-2', 'test-user-2', 'Globex Inc', 'Enterprise');

-- Test departments with various edge cases
INSERT INTO departments (company_id, name, description) VALUES
  ('test-company-1', 'Engineering', 'Software development'),
  ('test-company-1', 'Product', NULL),  -- Test null handling
  ('test-company-1', 'Sales & "Marketing"', 'Test special chars'),
  ('test-company-2', 'Operations', REPEAT('Long text ', 100));  -- Test long content
```

### Strategy 3: On-Demand Cloning (Advanced)

```python
# For testing specific production scenarios
async def clone_specific_company(prod_company_id: str):
    """Clone one company's data for debugging a specific issue"""

    # Export from production
    company = await prod_db.get_company(prod_company_id)
    departments = await prod_db.get_departments(prod_company_id)
    conversations = await prod_db.get_conversations(prod_company_id)

    # Sanitize
    company["name"] = f"DEBUG_{company['name']}"
    company["user_id"] = STAGING_TEST_USER_ID

    # Import to staging
    await staging_db.upsert_company(company)
    await staging_db.upsert_departments(departments)
    await staging_db.upsert_conversations(conversations)

    return company["id"]
```

---

## Cost Analysis

### Current Infrastructure Cost

| Service | Plan | Cost/Month |
|---------|------|------------|
| Vercel | Free | $0 |
| Render | Free | $0 |
| Supabase | Free | $0 |
| Redis Cloud | Free | $0 |
| Qdrant Cloud | Free | $0 |
| **Total** | | **$0** |

### With Staging Environment

| Service | Production | Staging | Total |
|---------|------------|---------|-------|
| Vercel | Free | Free (preview) | $0 |
| Render | Free | Free | $0 |
| Supabase | Free | Free | $0 |
| Redis | Free | Shared | $0 |
| Qdrant | Free | Shared | $0 |
| **Total** | | | **$0** |

**Key insight:** You can run a full staging environment for **$0/month** using free tiers!

### Recommended Upgrade Path

| Revenue | Investment | Services |
|---------|------------|----------|
| <$10K MRR | $0/month | All free tiers |
| $10-50K MRR | $50-100/month | Render Starter ($7), Supabase Pro ($25) |
| $50-100K MRR | $200-500/month | Add monitoring (Sentry $26), better Redis |
| $100K+ MRR | $500-2000/month | Production-grade all services |

---

## Feature Flags

### Why Feature Flags > Staging for Some Cases

```
Traditional: Code complete → Staging → Production → All users see it

Feature Flags: Code complete → Production (flag off) → Enable for 1% → 10% → 100%
```

### Enhanced Feature Flag System

```python
# backend/feature_flags.py (enhanced)

from enum import Enum
from typing import Optional
import random

class RolloutStrategy(Enum):
    ALL = "all"              # 100% of users
    NONE = "none"            # 0% of users
    PERCENTAGE = "percentage" # X% of users
    USER_LIST = "user_list"   # Specific users only
    COMPANY_LIST = "company"  # Specific companies only

FEATURE_FLAGS = {
    "new_chat_ui": {
        "default": False,
        "strategy": RolloutStrategy.PERCENTAGE,
        "percentage": 10,  # 10% of users
        "description": "New chat interface redesign",
    },
    "ai_suggestions": {
        "default": False,
        "strategy": RolloutStrategy.COMPANY_LIST,
        "companies": ["company-id-1", "company-id-2"],
        "description": "AI-powered suggestions in prompts",
    },
    "export_pdf": {
        "default": False,
        "strategy": RolloutStrategy.USER_LIST,
        "users": ["beta-user-1", "beta-user-2"],
        "description": "PDF export functionality",
    },
}

def is_enabled(flag_name: str, user_id: Optional[str] = None, company_id: Optional[str] = None) -> bool:
    """Check if feature is enabled for this user/company"""
    flag = FEATURE_FLAGS.get(flag_name)
    if not flag:
        return False

    strategy = flag.get("strategy", RolloutStrategy.ALL)

    if strategy == RolloutStrategy.ALL:
        return flag.get("default", True)

    if strategy == RolloutStrategy.NONE:
        return False

    if strategy == RolloutStrategy.PERCENTAGE:
        # Consistent hashing so same user always gets same result
        if user_id:
            hash_val = hash(f"{flag_name}:{user_id}") % 100
            return hash_val < flag.get("percentage", 0)
        return False

    if strategy == RolloutStrategy.USER_LIST:
        return user_id in flag.get("users", [])

    if strategy == RolloutStrategy.COMPANY_LIST:
        return company_id in flag.get("companies", [])

    return flag.get("default", False)
```

### Frontend Usage

```tsx
// hooks/useFeatureFlag.ts
import { useUser, useCompany } from './useAuth';

export function useFeatureFlag(flagName: string): boolean {
  const { user } = useUser();
  const { company } = useCompany();
  const { data: flags } = useQuery({
    queryKey: ['feature-flags', user?.id, company?.id],
    queryFn: () => fetchFlags(user?.id, company?.id),
  });

  return flags?.[flagName] ?? false;
}

// Usage in component
function ChatInterface() {
  const showNewUI = useFeatureFlag('new_chat_ui');

  if (showNewUI) {
    return <NewChatInterface />;
  }
  return <LegacyChatInterface />;
}
```

---

## Quick Reference

### Checklist: Before Deploying to Production

```
□ All CI checks passing (lint, tests, build)
□ E2E tests passing on staging
□ Database migrations tested on staging
□ Feature flags configured correctly
□ Rollback plan documented
□ Monitoring alerts configured
□ Team notified of deployment
```

### Commands Cheatsheet

```bash
# Deploy to staging manually
curl -X POST "$RENDER_STAGING_DEPLOY_HOOK"

# Check staging health
curl https://axcouncil-backend-staging.onrender.com/health

# Run E2E against staging
VITE_API_URL=https://axcouncil-backend-staging.onrender.com npm run test:e2e

# Seed staging database
python scripts/seed_staging.py

# Clone production data (sanitized)
python scripts/clone_to_staging.py

# Check feature flag status
curl https://axcouncil-backend.onrender.com/api/feature-flags
```

### Emergency Rollback

```bash
# 1. Revert to previous commit
git revert HEAD --no-edit
git push origin main

# 2. Or deploy specific commit
# In Render dashboard: Manual Deploy → Select commit

# 3. Database rollback (if migration issue)
supabase migration repair --status reverted <migration_id>
```

### Environment URLs

| Environment | Frontend | Backend | Database |
|-------------|----------|---------|----------|
| Local | localhost:5173 | localhost:8081 | Supabase (prod or local) |
| Staging | PR preview URL | staging.onrender.com | Supabase staging project |
| Production | app.axcouncil.com | onrender.com | Supabase production |

---

## Summary: Your Action Items

### Immediate (This Week)
1. ✅ Create Supabase staging project (free)
2. ✅ Create Render staging service (free)
3. ✅ Set up GitHub environments with secrets

### Short-term (2-4 Weeks)
4. Implement database seeding scripts
5. Add staging deployment to CI pipeline
6. Add E2E tests running against staging

### Medium-term (1-3 Months)
7. Enhance feature flag system
8. Add deployment notifications
9. Implement synthetic data generation
10. Add performance testing in staging

### Long-term ($25M Readiness)
11. Blue/green deployments
12. Canary releases
13. Chaos engineering
14. Multi-region deployment

---

*Last updated: January 2026*
*Document location: `/docs/STAGING-ENVIRONMENT-GUIDE.md`*
