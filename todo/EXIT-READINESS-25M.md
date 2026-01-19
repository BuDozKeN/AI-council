# $25M Exit Readiness Roadmap - AxCouncil

> **Target Valuation**: $25,000,000
> **Typical Multiple**: 5-10x ARR for AI SaaS (2025/2026)
> **Required ARR Range**: $2.5M - $5M
> **Created**: January 2026

---

## Reality Check: What Acquirers Actually Buy

Having been through due diligence from both sides, here's what a $25M acquirer is looking for:

| Factor | Weight | What They Examine |
|--------|--------|-------------------|
| **Revenue & Unit Economics** | 35% | ARR, NRR, GRR, CAC, LTV, margins |
| **Product & Technology** | 25% | Differentiation, scalability, tech debt, IP |
| **Enterprise Readiness** | 20% | SSO, compliance, security, SLAs |
| **Team & Operations** | 10% | Key person risk, documentation, processes |
| **Market & Growth** | 10% | TAM, growth rate, competitive position |

The admin portal we built? It's part of "Team & Operations" - maybe 3% of the decision.

---

## Current State Assessment

### What You Have (Strengths)
- [x] Working product with unique value prop (multi-LLM council)
- [x] Modern tech stack (React 19, FastAPI, Supabase)
- [x] Multi-tenant architecture
- [x] Basic admin infrastructure
- [x] Real-time streaming
- [x] Redis caching, Qdrant vectors

### Critical Gaps for $25M Exit
- [ ] **Revenue**: Need $2.5M-$5M ARR
- [ ] **Enterprise SSO**: No Okta/Azure AD integration
- [ ] **SOC 2**: No certification
- [ ] **Billing Infrastructure**: Basic/incomplete
- [ ] **Usage Tracking**: Not monetization-ready
- [ ] **API/SDK**: No developer ecosystem
- [ ] **White-Label**: No agency/reseller capability

---

## TIER 1: Revenue Infrastructure (Highest Priority)
*Without revenue, nothing else matters*

### 1.1 Billing & Subscription System
**Required for: Any paying customer**

```
Current State: Basic Stripe integration
Target State: Full subscription lifecycle
```

#### Must Have
- [ ] Stripe Billing integration (subscriptions, invoices)
- [ ] Multiple pricing tiers (Starter, Pro, Enterprise)
- [ ] Usage-based pricing component (tokens, API calls)
- [ ] Self-serve upgrade/downgrade
- [ ] Dunning management (failed payment handling)
- [ ] Proration for mid-cycle changes

#### Database Schema Needed
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL, -- active, past_due, canceled, trialing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  metric TEXT NOT NULL, -- 'tokens', 'api_calls', 'conversations'
  quantity BIGINT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  stripe_invoice_id TEXT UNIQUE,
  amount_due INTEGER, -- cents
  amount_paid INTEGER,
  status TEXT,
  invoice_pdf TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Pricing Model Recommendation
| Tier | Price/mo | Conversations | API Calls | Users | Key Features |
|------|----------|---------------|-----------|-------|--------------|
| **Starter** | $49 | 100 | 1,000 | 3 | Basic council, email support |
| **Pro** | $199 | 500 | 10,000 | 10 | All models, priority support, API |
| **Business** | $499 | 2,000 | 50,000 | 25 | SSO, audit logs, SLA |
| **Enterprise** | Custom | Unlimited | Custom | Unlimited | HIPAA, dedicated support, SLA |

### 1.2 Usage Tracking & Metering
**Required for: Usage-based pricing, cost control**

- [ ] Real-time token counting per conversation
- [ ] API call tracking with rate limiting
- [ ] Usage alerts (80%, 90%, 100% of quota)
- [ ] Overage handling (hard stop vs. pay-as-you-go)
- [ ] Usage dashboard for customers

### 1.3 Revenue Analytics
**Required for: Due diligence, board meetings**

- [ ] MRR/ARR calculation (real-time)
- [ ] Net Revenue Retention (NRR) tracking
- [ ] Gross Revenue Retention (GRR) tracking
- [ ] Cohort analysis
- [ ] Churn analysis by segment
- [ ] LTV:CAC ratio

**Target Metrics for $25M Exit:**
| Metric | Target | Why It Matters |
|--------|--------|----------------|
| ARR | $2.5M-$5M | 5-10x multiple basis |
| NRR | >110% | Shows expansion revenue |
| GRR | >90% | Shows retention strength |
| Logo Churn | <5% annual | Shows product-market fit |
| CAC Payback | <12 months | Shows efficient growth |

---

## TIER 2: Enterprise Readiness
*This is what gets you from $99/mo customers to $50K/year contracts*

### 2.1 SSO/SAML Integration
**Required for: Any enterprise sale**

Enterprise customers won't buy without SSO. Period.

- [ ] SAML 2.0 support
- [ ] Okta integration
- [ ] Azure AD integration
- [ ] Google Workspace integration
- [ ] JIT (Just-In-Time) provisioning
- [ ] SCIM for user sync

**Implementation Options:**
1. **WorkOS** ($$$, fastest) - https://workos.com
2. **Auth0 Enterprise** ($$, good) - Already in ecosystem
3. **Build with Supabase** ($, harder) - Native SAML support

**Recommended: WorkOS**
- Time to implement: 1-2 weeks
- Cost: ~$1,000/mo at scale
- Why: Used by Vercel, Loom, Webflow - investors recognize it

### 2.2 SOC 2 Type II Certification
**Required for: Enterprise sales, due diligence**

SOC 2 is table stakes for B2B SaaS selling to enterprises.

- [ ] Engage SOC 2 auditor (Vanta, Drata, Secureframe)
- [ ] Implement required controls
- [ ] Complete Type I (point-in-time)
- [ ] Complete Type II (6-month observation)

**Timeline:** 6-9 months total
**Cost:** $15,000-$50,000 (tools + audit)

**Recommended: Vanta** ($15K/year)
- Automated evidence collection
- Continuous monitoring
- Also covers GDPR, HIPAA, ISO 27001

### 2.3 Security Hardening
**Required for: Enterprise sales, due diligence**

- [ ] Annual penetration test (report for customers)
- [ ] Vulnerability disclosure program
- [ ] Encryption at rest (Supabase handles)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Data residency options (EU, US)
- [ ] Security whitepaper/trust center

### 2.4 Enterprise Features
**Required for: $10K+ contracts**

- [ ] Custom data retention policies
- [ ] IP allowlisting
- [ ] Advanced audit logs (already in roadmap)
- [ ] Custom SLAs (99.9% uptime)
- [ ] Dedicated support channel
- [ ] Custom model configuration

---

## TIER 3: Product Differentiation & Moat
*Why should they buy YOU vs. build it themselves?*

### 3.1 Defensible Technology

What makes AxCouncil hard to replicate?

**Current Differentiators:**
- Multi-LLM council approach (unique UX)
- 3-stage deliberation process
- Company context injection
- Peer review synthesis

**Strengthen the Moat:**
- [ ] Patent the 3-stage deliberation process
- [ ] Build proprietary training data from council outputs
- [ ] Create network effects (shared playbooks, benchmarks)
- [ ] Develop proprietary evaluation metrics

### 3.2 API & Developer Platform
**Required for: Platform expansion, integrations**

- [ ] RESTful API (already have basics)
- [ ] Webhook support for events
- [ ] API documentation (Swagger/OpenAPI)
- [ ] SDKs (TypeScript, Python)
- [ ] Rate limiting per API key
- [ ] API versioning strategy

**API Products:**
```
/api/v1/councils          # Create/manage council sessions
/api/v1/conversations     # Conversation management
/api/v1/knowledge         # Knowledge base CRUD
/api/v1/models            # Model configuration
/api/v1/webhooks          # Event subscriptions
```

### 3.3 White-Label / Reseller Program
**Required for: Channel sales, faster growth**

- [ ] Custom branding (logo, colors)
- [ ] Custom domain support
- [ ] Reseller pricing/margins
- [ ] Partner portal
- [ ] Co-marketing materials

This opens up:
- Consulting firms reselling to clients
- Agencies white-labeling for customers
- Tech companies embedding in their products

---

## TIER 4: Operational Excellence
*De-risks the acquisition, increases confidence*

### 4.1 Documentation
- [ ] API documentation (public)
- [ ] Architecture documentation (internal)
- [ ] Runbook for operations
- [ ] Disaster recovery plan
- [ ] Incident response playbook

### 4.2 Testing & Quality
- [ ] 80%+ test coverage (currently at 70%)
- [ ] E2E tests for critical paths
- [ ] Load testing results (proof of scale)
- [ ] Performance benchmarks

### 4.3 Team & Key Person Risk
- [ ] Document all tribal knowledge
- [ ] Cross-train on critical systems
- [ ] No single point of failure
- [ ] Clear ownership map

### 4.4 Legal & IP
- [ ] Clean IP ownership (all work-for-hire)
- [ ] No open source license violations
- [ ] Privacy policy (GDPR compliant)
- [ ] Terms of service
- [ ] DPA template for enterprises

---

## TIER 5: Growth & Metrics Dashboard
*What acquirers will ask for in due diligence*

### 5.1 Metrics They'll Want
```
Revenue Metrics:
- MRR/ARR (current and historical)
- MRR movement (new, expansion, contraction, churn)
- Revenue by tier/segment
- Average Revenue Per Account (ARPA)
- Customer Lifetime Value (LTV)

Growth Metrics:
- Customer acquisition cost (CAC)
- CAC by channel
- Time to payback
- Net Revenue Retention (NRR)
- Logo churn rate

Product Metrics:
- Daily/Weekly/Monthly Active Users
- Feature adoption rates
- Session duration
- Conversation completion rate
- NPS score

Operational Metrics:
- Uptime (target: 99.9%)
- Mean Time to Recovery (MTTR)
- Support ticket volume
- Time to resolution
```

### 5.2 Board-Ready Reporting
- [ ] Automated monthly metrics deck
- [ ] Cohort analysis dashboard
- [ ] Investor-ready data room

---

## Implementation Priority Matrix

| Item | Revenue Impact | Effort | Priority |
|------|----------------|--------|----------|
| Stripe Billing | Critical | Medium | **P0** |
| Usage Tracking | Critical | Medium | **P0** |
| SSO (WorkOS) | High | Low | **P0** |
| SOC 2 Start | High | High | **P1** |
| API Documentation | Medium | Low | **P1** |
| Revenue Dashboard | Medium | Medium | **P1** |
| Security Audit | Medium | Medium | **P1** |
| White-Label | Medium | High | **P2** |
| SDK/Webhooks | Low | Medium | **P2** |
| Admin Portal (existing roadmap) | Low | Medium | **P2** |

---

## 90-Day Sprint Plan for Exit Readiness

### Days 1-30: Revenue Foundation
- [ ] Complete Stripe Billing integration
- [ ] Launch tiered pricing (Starter, Pro, Business)
- [ ] Implement usage tracking
- [ ] Deploy upgrade/downgrade flows
- [ ] Set up MRR/ARR tracking

### Days 31-60: Enterprise Unlock
- [ ] Integrate WorkOS for SSO
- [ ] Start SOC 2 process with Vanta
- [ ] Complete security questionnaire template
- [ ] Create trust center / security page
- [ ] Build enterprise sales materials

### Days 61-90: Scale Preparation
- [ ] API documentation (public)
- [ ] Load testing and benchmarks
- [ ] Revenue analytics dashboard
- [ ] Customer health scoring
- [ ] Begin SOC 2 Type I evidence collection

---

## Budget Estimate

| Item | One-Time | Monthly | Notes |
|------|----------|---------|-------|
| WorkOS (SSO) | - | $500-2K | Scales with enterprise seats |
| Vanta (SOC 2) | - | $1,250 | Annual $15K |
| Penetration Test | $10-25K | - | Annual |
| Legal (contracts) | $5-10K | - | Enterprise MSA, DPA |
| **Total Year 1** | **~$25K** | **~$2K/mo** | |

This is an investment that enables $50K+ enterprise contracts.

---

## What $25M Buyers Look For (Due Diligence Checklist)

### Financial
- [ ] 24 months of financial statements
- [ ] MRR/ARR trend (growth rate)
- [ ] Customer list with ARR per customer
- [ ] Churn analysis
- [ ] Unit economics (LTV, CAC, payback)

### Legal
- [ ] Cap table
- [ ] IP assignment agreements
- [ ] Customer contracts
- [ ] Vendor contracts
- [ ] Any litigation

### Technical
- [ ] Architecture overview
- [ ] Security audit results
- [ ] Scalability proof
- [ ] Tech debt assessment
- [ ] Key person dependencies

### Commercial
- [ ] Sales pipeline
- [ ] Customer references
- [ ] Competitive positioning
- [ ] Go-to-market strategy

---

## The Path to $25M

```
Current State ────────────────────────────────────────► $25M Exit
     │                                                      │
     │  Revenue Foundation (30 days)                        │
     │  ├─ Stripe Billing ✓                                 │
     │  ├─ Usage Tracking ✓                                 │
     │  └─ Pricing Tiers ✓                                  │
     │                                                      │
     │  Enterprise Unlock (60 days)                         │
     │  ├─ SSO/SAML ✓                                       │
     │  ├─ SOC 2 Started ✓                                  │
     │  └─ Security Audit ✓                                 │
     │                                                      │
     │  Scale & Polish (90 days)                            │
     │  ├─ API Docs ✓                                       │
     │  ├─ Revenue Dashboard ✓                              │
     │  └─ Customer Success Tools ✓                         │
     │                                                      │
     │  Growth Phase (6-12 months)                          │
     │  ├─ Hit $2.5M ARR                                    │
     │  ├─ Complete SOC 2 Type II                           │
     │  └─ Land 5+ enterprise logos                         │
     │                                                      │
     └──────────────────────────────────────────────────────┘
```

---

## Honest Assessment

**Can you get to $25M?** Yes, but not just with the admin portal.

**What's actually required:**
1. **Revenue**: $2.5M-$5M ARR (at 5-10x multiple)
2. **Enterprise readiness**: SSO, SOC 2, security
3. **Defensible product**: Why can't they build this?
4. **Clean operations**: No landmines in due diligence

**The admin portal we built** is good for operational efficiency (saving you time on support). But it's <5% of the exit decision.

**The 80/20:**
- 80% of your exit value comes from revenue + enterprise features
- 20% comes from everything else (admin, docs, polish)

Focus on what moves the needle.

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial exit readiness assessment |
