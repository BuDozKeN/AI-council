# Email-to-Council Onboarding System
## Complete Implementation Guide

**Version:** 1.0
**Status:** Production-Ready Blueprint
**Target:** $50M Valuation Multiplier

---

## Executive Summary

This document provides a bulletproof, staged implementation plan for the email-to-council onboarding system. Each stage is self-contained, testable, and deployable independently.

**The Core Value Proposition:**
1. Corporate user emails question → Gets personalized AI council response
2. Lead enrichment (Apollo + FreshLink) creates "wow factor" with context
3. Free teaser → Full access requires registration = conversion funnel
4. Non-corporate emails → Waiting list = future marketing database

---

## Table of Contents

1. [Cost Analysis](#1-cost-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Stage 1: Foundation](#stage-1-foundation)
4. [Stage 2: Lead Enrichment](#stage-2-lead-enrichment)
5. [Stage 3: Council Execution](#stage-3-council-execution)
6. [Stage 4: Email Responses](#stage-4-email-responses)
7. [Stage 5: Waiting List System](#stage-5-waiting-list-system)
8. [Stage 6: Conversion Tracking](#stage-6-conversion-tracking)
9. [Stage 7: Monitoring & Alerts](#stage-7-monitoring--alerts)
10. [Edge Cases & Error Handling](#edge-cases--error-handling)
11. [Security Checklist](#security-checklist)
12. [Deployment Checklist](#deployment-checklist)

---

## 1. Cost Analysis

### API Costs Per Lead

| Service | Cost Per Call | Calls Per Lead | Cost Per Lead |
|---------|---------------|----------------|---------------|
| Apollo People Match | $0.03 | 1 | $0.03 |
| Apollo Company Enrich | $0.02 | 1 (fallback) | $0.01 avg |
| FreshLink (RapidAPI) | $0.005 | 1 (optional) | $0.005 |
| AgentMail Send | $0.001 | 1-2 | $0.002 |
| Council LLMs (5 models) | ~$0.15 | 1 | $0.15 |
| **Total Per Corporate Lead** | | | **~$0.20** |

### Break-Even Analysis

| Metric | Value |
|--------|-------|
| Cost per enriched lead | $0.20 |
| Expected conversion rate (email → signup) | 15-25% |
| Expected conversion rate (signup → paid) | 5-10% |
| Cost per paying customer | $0.20 / (0.20 × 0.075) = **$13.33 CAC** |
| Enterprise ARPU (monthly) | $99-499 |
| Payback period | < 1 month |

### Monthly Budget Projections

| Leads/Month | Enrichment Cost | Council Cost | Total | Expected Conversions |
|-------------|-----------------|--------------|-------|---------------------|
| 100 | $5 | $15 | $20 | 1-2 paying users |
| 500 | $25 | $75 | $100 | 7-10 paying users |
| 1,000 | $50 | $150 | $200 | 15-20 paying users |
| 5,000 | $250 | $750 | $1,000 | 75-100 paying users |

**Verdict:** At $200/month for 1,000 leads → 15 conversions @ $99/mo = $1,485 MRR. **ROI: 7.4x**

### Cost Optimization Strategies

1. **Cache Apollo results by domain** (1 company lookup serves all employees)
2. **Skip FreshLink if Apollo returns full data** (already implemented)
3. **Rate limit per domain** (max 10 leads/domain/day for initial launch)
4. **Skip enrichment for known spam domains**

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EMAIL ONBOARDING FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

User sends email to council@axcouncil.com
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: AgentMail Webhook                                             │
│  POST /api/v1/email-webhook/agentmail                                   │
│  - Verify webhook signature                                              │
│  - Parse email (from, subject, body)                                     │
│  - Extract question from body                                            │
│  - Create email_leads record (status: "received")                        │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: Email Classification                                          │
│  - Check if corporate email (not Gmail, Yahoo, etc.)                     │
│  - If NON-CORPORATE → Add to waiting list (Stage 5)                     │
│  - If CORPORATE → Continue to enrichment                                 │
└─────────────────────────────────────────────────────────────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌─────────────────┐  ┌─────────────────────────────────────────────────────┐
│  WAITING LIST   │  │  STAGE 3: Lead Enrichment (CORPORATE ONLY)          │
│  - Store lead   │  │  - Apollo People Match → name, title, seniority     │
│  - Send polite  │  │  - Apollo Company Enrich → industry, size, funding  │
│  - Track for    │  │  - FreshLink (if LinkedIn URL) → deeper profile     │
│    future       │  │  - Update email_leads with enrichment data          │
└─────────────────┘  └─────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: Council Execution                                             │
│  - Build personalized context from enrichment                            │
│  - Inject context into council system prompt                             │
│  - Run 3-stage council (Stage 1 → Stage 2 → Stage 3)                    │
│  - Store full council result in email_leads                              │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 5: Response Generation & Sending                                 │
│  - Generate personalized email with executive summary                    │
│  - Include "View Full Council Session" link (requires registration)     │
│  - Send via AgentMail (maintains thread for replies)                    │
│  - Update email_leads (status: "completed", response_sent: true)        │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 6: Conversion Tracking                                           │
│  - User clicks link → lands on /council-session/:leadId                 │
│  - Sees full deliberation + registration CTA                             │
│  - Signs up → POST /api/v1/email-webhook/convert-lead/:leadId           │
│  - Lead marked as converted, funnel analytics updated                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Foundation

### What This Stage Does
Sets up the AgentMail webhook endpoint and basic email parsing. No enrichment, no council execution—just receiving and storing emails.

### Files Involved
- `backend/services/agentmail.py` - AgentMail API client
- `backend/routers/email_webhook.py` - Webhook handler
- `supabase/migrations/20260131000000_email_leads.sql` - Database schema

### Prerequisites
- [ ] AgentMail account created at https://agentmail.to
- [ ] API key obtained from AgentMail dashboard
- [ ] Inbox created (e.g., `council@yourdomain.agentmail.to`)
- [ ] Database migration applied

### Environment Variables Required
```bash
AGENTMAIL_API_KEY=am_live_xxxxx
AGENTMAIL_INBOX_ADDRESS=council@yourdomain.agentmail.to
AGENTMAIL_WEBHOOK_SECRET=whsec_xxxxx  # From AgentMail webhook settings
```

### Verification Checklist
- [ ] Send test email to inbox address
- [ ] Verify webhook receives POST request
- [ ] Verify email_leads record created with status "received"
- [ ] Verify from_email, subject, question parsed correctly
- [ ] Verify webhook returns 200 OK

### Test Cases
```bash
# 1. Valid corporate email
Send email from: test@microsoft.com
Expected: email_leads record with is_corporate=true

# 2. Free email provider
Send email from: test@gmail.com
Expected: email_leads record with is_corporate=false, rejection_reason set

# 3. Malformed email
Send email with no from address
Expected: 200 OK with "No sender email found" message

# 4. Invalid webhook signature
POST with wrong signature header
Expected: 401 Unauthorized
```

### Rollback Plan
```sql
-- If issues, disable webhook processing
UPDATE email_leads SET status = 'paused' WHERE status = 'received';
-- Investigate logs before resuming
```

---

## Stage 2: Lead Enrichment

### What This Stage Does
Enriches corporate leads with Apollo (person + company data) and optionally FreshLink (LinkedIn profile). Creates the "wow factor" context.

### Files Involved
- `backend/services/lead_enrichment.py` - Enrichment service
- `backend/routers/email_webhook.py` - Pipeline integration

### Prerequisites
- [ ] Stage 1 complete and verified
- [ ] Apollo API key obtained from https://apollo.io
- [ ] FreshLink API key obtained from RapidAPI (optional)

### Environment Variables Required
```bash
APOLLO_API_KEY=your_apollo_api_key
FRESHLINK_API_KEY=your_freshlink_rapidapi_key  # Optional
```

### What Gets Enriched

| Data Point | Source | Used For |
|------------|--------|----------|
| Full name | Apollo | Email greeting |
| Title/Role | Apollo | Personalization context |
| Seniority | Apollo | Lead scoring |
| Company name | Apollo | Personalization context |
| Industry | Apollo | Council context injection |
| Employee count | Apollo | Company size context |
| Funding stage | Apollo | Startup vs Enterprise context |
| LinkedIn URL | Apollo | FreshLink lookup (optional) |
| Headline | FreshLink | Additional context |
| Experience | FreshLink | Role history |

### Personalization Context Example

**Input:** sarah.chen@cloudflow.io

**Apollo Returns:**
```json
{
  "name": "Sarah Chen",
  "title": "VP of Marketing",
  "seniority": "vp",
  "organization": {
    "name": "CloudFlow",
    "industry": "SaaS / Logistics",
    "estimated_num_employees": 150,
    "latest_funding_stage": "Series B"
  }
}
```

**Generated Context:**
> "The person asking this question is Sarah Chen, who serves as VP of Marketing at CloudFlow (in the SaaS / Logistics industry, with 51-200 employees, at Series B stage)."

### Verification Checklist
- [ ] Send email from known corporate domain
- [ ] Verify Apollo API called successfully
- [ ] Verify enrichment_data populated in email_leads
- [ ] Verify full_name, title, company_name columns populated
- [ ] Test fallback when Apollo returns no data (company-only enrichment)
- [ ] Test graceful failure when Apollo API is down

### Cost Controls
```python
# In lead_enrichment.py - ADD THESE CHECKS

# 1. Domain-level caching (reduce duplicate company lookups)
COMPANY_CACHE_TTL = 86400  # 24 hours
async def get_cached_company(domain: str) -> Optional[dict]:
    # Check Redis cache before calling Apollo
    pass

# 2. Rate limiting per domain
MAX_ENRICHMENTS_PER_DOMAIN_PER_DAY = 10

# 3. Skip known spam domains
SKIP_ENRICHMENT_DOMAINS = frozenset([
    "test.com", "example.com", "mailinator.com"
])
```

### Error Handling
| Scenario | Action |
|----------|--------|
| Apollo rate limited (429) | Retry with exponential backoff (3 attempts) |
| Apollo timeout | Continue without enrichment, log warning |
| Apollo invalid response | Continue without enrichment, log error |
| FreshLink fails | Continue (FreshLink is optional enhancement) |

---

## Stage 3: Council Execution

### What This Stage Does
Runs the full 3-stage council pipeline with the user's question, injecting personalized context from enrichment.

### Files Involved
- `backend/council.py` - Council orchestration
- `backend/routers/email_webhook.py` - Pipeline integration

### Prerequisites
- [ ] Stage 2 complete and verified
- [ ] OpenRouter API key configured
- [ ] Council models configured in model_registry

### Council Execution Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│  USER QUESTION + ENRICHED CONTEXT                                      │
│                                                                        │
│  CONTEXT: The person asking this question is Sarah Chen, who serves   │
│  as VP of Marketing at CloudFlow (in the SaaS/Logistics industry,     │
│  with 51-200 employees, at Series B stage).                           │
│                                                                        │
│  QUESTION: Should we invest in brand marketing or performance         │
│  marketing for our Series C preparation?                               │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: Individual Responses (5 models in parallel)                  │
│  - Claude 3.5 Sonnet                                                    │
│  - GPT-4o                                                               │
│  - Gemini 1.5 Pro                                                       │
│  - Grok 2                                                               │
│  - DeepSeek V3                                                          │
│  Each model provides full analysis with context awareness               │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: Peer Review (3 models rank responses)                        │
│  - Responses anonymized (Response A, B, C, D, E)                        │
│  - Each reviewer ranks all responses                                    │
│  - Rankings aggregated for consensus                                    │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: Chairman Synthesis                                           │
│  - Synthesizes all evidence into final recommendation                   │
│  - Structured output: Executive Summary, Analysis, Recommendations     │
│  - Tailored to the user's context (company stage, role, industry)      │
└────────────────────────────────────────────────────────────────────────┘
```

### Timeout Configuration

| Stage | Timeout | Per-Model Timeout |
|-------|---------|-------------------|
| Stage 1 | 120s | 60s |
| Stage 2 | 90s | 45s |
| Stage 3 | 90s | 60s |
| **Total Max** | **300s (5 min)** | |

### Verification Checklist
- [ ] Council executes successfully with enriched context
- [ ] Stage 3 synthesis includes personalized language
- [ ] Council result stored in email_leads.council_response
- [ ] council_completed=true, council_completed_at set
- [ ] Handles timeout gracefully (partial response + error notification)

### Error Recovery
```python
# If council fails mid-execution:
async def handle_council_failure(lead_id: str, error: str, partial_results: dict):
    """
    1. Store what we have (partial Stage 1 responses)
    2. Send apologetic email with retry option
    3. Mark lead for manual review
    4. Alert engineering team
    """
    await _update_lead_status(lead_id, "failed", error=error)
    await _send_error_response(email, lead_id, error)
    await alert_team("Council execution failed", lead_id, error)
```

---

## Stage 4: Email Responses

### What This Stage Does
Generates and sends personalized email responses via AgentMail. The email includes an executive summary (free) and a CTA to view the full deliberation (requires registration).

### Files Involved
- `backend/routers/email_templates.py` - Email template generation
- `backend/services/agentmail.py` - Email sending

### Email Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AxCouncil                                           │
│             AI-Powered Decision Council                                 │
└─────────────────────────────────────────────────────────────────────────┘

Hi Sarah,

┌─────────────────────────────────────────────────────────────────────────┐
│ PERSONALIZATION BLOCK (wow factor)                                      │
│                                                                         │
│ As VP of Marketing at CloudFlow (in the SaaS/Logistics industry,       │
│ with 51-200 employees, at Series B stage), our AI council has          │
│ tailored this response to your specific context.                        │
└─────────────────────────────────────────────────────────────────────────┘

Your question has been reviewed by our council of 5 AI advisors.

┌─────────────────────────────────────────────────────────────────────────┐
│ YOUR QUESTION                                                           │
│ Should we invest in brand marketing or performance marketing for        │
│ our Series C preparation?                                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ COUNCIL INFO                                                            │
│ 5 AI advisors analyzed your question across 3 stages of deliberation.  │
└─────────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY (FREE TEASER)

[2-3 paragraphs of actual value - enough to demonstrate worth]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────────────────┐
│ WANT THE FULL PICTURE?                                                  │
│                                                                         │
│ The complete council deliberation includes:                             │
│ • Detailed analysis from 5 AI advisors                                  │
│ • Peer review rankings and insights                                     │
│ • Implementation recommendations                                        │
│ • Risk considerations and alternatives                                  │
└─────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │    VIEW FULL COUNCIL SESSION    →        │
        └──────────────────────────────────────────┘

                Create Free Account →

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Have a follow-up question? Simply reply to this email.

© 2026 AxCouncil
```

### Thread Continuation (Replies)

When a user replies to the email:
1. AgentMail sends webhook with `in_reply_to` and `thread_id`
2. We extract only the new content (not quoted previous messages)
3. We run council with conversation history for context
4. Response maintains thread for email clients

### Verification Checklist
- [ ] Email sent successfully via AgentMail
- [ ] Personalization block appears correctly
- [ ] Executive summary is substantive (not just a teaser)
- [ ] "View Full Council Session" link works
- [ ] Thread ID maintained for replies
- [ ] Plain text version renders correctly
- [ ] Email passes spam filters (check deliverability)

### Email Deliverability Checklist
- [ ] SPF record configured for sending domain
- [ ] DKIM signing enabled in AgentMail
- [ ] DMARC policy set
- [ ] Reply-to address valid
- [ ] Unsubscribe link included (CAN-SPAM compliance)
- [ ] Test with mail-tester.com score > 8/10

---

## Stage 5: Waiting List System

### What This Stage Does
Captures non-corporate email users in a waiting list instead of rejecting them outright. This builds a marketing database for future launch.

### CRITICAL: This Needs Implementation

The current code rejects non-corporate emails with a polite response. We need to modify it to:

1. Store them in a waiting list
2. Send a different email (not rejection, but "exclusive corporate launch")
3. Track them for future marketing

### Database Changes Required

```sql
-- Add to migration or create new migration
ALTER TABLE email_leads ADD COLUMN waiting_list_status TEXT;
-- Values: NULL (not applicable), 'pending', 'notified', 'converted'

ALTER TABLE email_leads ADD COLUMN waiting_list_position INTEGER;
ALTER TABLE email_leads ADD COLUMN notify_on_public_launch BOOLEAN DEFAULT true;

-- Create index for waiting list queries
CREATE INDEX idx_email_leads_waiting_list
ON email_leads(waiting_list_status, created_at)
WHERE is_corporate = false;
```

### Code Changes Required

```python
# In email_webhook.py - MODIFY the non-corporate handling

if not is_corporate:
    # DON'T send rejection email
    # Instead, add to waiting list
    background_tasks.add_task(
        add_to_waiting_list,
        email=email,
        lead_id=lead_id,
    )

    return WebhookResponse(
        success=True,
        message="Added to waiting list",
        lead_id=lead_id,
    )

async def add_to_waiting_list(email: IncomingEmail, lead_id: str):
    """
    Add non-corporate user to waiting list.
    """
    # Calculate position
    position = await _get_waiting_list_position()

    # Update lead record
    await _update_lead_waiting_list(
        lead_id=lead_id,
        status="pending",
        position=position,
    )

    # Send waiting list email
    await _send_waiting_list_email(email, lead_id, position)
```

### Waiting List Email Template

```
Subject: You're on the AxCouncil Waiting List (#847)

Hi there,

Thanks for your interest in AxCouncil!

We're currently in exclusive corporate launch—our AI council is
available to verified business email addresses only.

GOOD NEWS: You're on our waiting list!
Position: #847

When we open to everyone, you'll be first in line. Plus, you'll get:
• 3 free council sessions (instead of 1)
• Priority support
• Early access to new features

In the meantime, want immediate access?
Use your work email and get started today.

   [Use Work Email Instead] →

We'll notify you at [user@gmail.com] when public access opens.

Best,
The AxCouncil Team
```

### Waiting List Benefits for Marketing

1. **Leads database** - Non-corporate users are often decision influencers
2. **Viral loop** - "Use your work email" drives corporate adoption
3. **Launch event** - "We're opening to everyone!" creates urgency
4. **Segmentation** - Know which free providers have most demand

---

## Stage 6: Conversion Tracking

### What This Stage Does
Tracks the full funnel from email → registration → paid conversion.

### Funnel Stages

```
EMAIL RECEIVED
     ↓
CORPORATE CHECK
     ↓ (corporate)        ↓ (non-corporate)
COUNCIL EXECUTED      WAITING LIST
     ↓
EMAIL SENT
     ↓
LINK CLICKED (view session)
     ↓
REGISTRATION STARTED
     ↓
REGISTRATION COMPLETED
     ↓
TRIAL USED
     ↓
PAID CONVERSION
```

### Tracking Implementation

```python
# Add to email_leads table
class EmailLeadFunnel:
    email_received_at: datetime      # When email arrived
    council_completed_at: datetime   # When council finished
    response_sent_at: datetime       # When email sent
    session_viewed_at: datetime      # When they clicked the link
    registration_started_at: datetime
    registration_completed_at: datetime
    trial_used_at: datetime
    paid_conversion_at: datetime
    paid_plan: str                   # pro, enterprise
    ltv: float                       # Lifetime value tracked
```

### UTM Parameters

All links in emails include tracking:
```
https://axcouncil.com/council-session/{lead_id}
  ?source=email
  &medium=council
  &campaign=onboarding
  &content={email_type}  # corporate, followup, waiting_list
```

### Analytics Dashboard Query

```sql
-- Conversion funnel by week
SELECT
    DATE_TRUNC('week', created_at) AS week,
    COUNT(*) AS emails_received,
    COUNT(*) FILTER (WHERE is_corporate) AS corporate_leads,
    COUNT(*) FILTER (WHERE council_completed) AS councils_run,
    COUNT(*) FILTER (WHERE response_sent) AS emails_sent,
    COUNT(*) FILTER (WHERE session_viewed_at IS NOT NULL) AS sessions_viewed,
    COUNT(*) FILTER (WHERE converted_to_user) AS registrations,
    COUNT(*) FILTER (WHERE paid_conversion_at IS NOT NULL) AS paid_conversions,
    -- Conversion rates
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE converted_to_user) /
        NULLIF(COUNT(*) FILTER (WHERE response_sent), 0),
        2
    ) AS email_to_registration_rate,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE paid_conversion_at IS NOT NULL) /
        NULLIF(COUNT(*) FILTER (WHERE converted_to_user), 0),
        2
    ) AS registration_to_paid_rate
FROM email_leads
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;
```

---

## Stage 7: Monitoring & Alerts

### What This Stage Does
Sets up monitoring, alerting, and health checks to ensure the system runs flawlessly.

### Health Checks

```python
# Add to backend/routers/email_webhook.py

@router.get("/health")
async def email_system_health():
    """
    Health check for email onboarding system.
    Returns status of all dependencies.
    """
    checks = {
        "agentmail": await _check_agentmail_health(),
        "apollo": await _check_apollo_health(),
        "database": await _check_database_health(),
        "council": await _check_council_health(),
    }

    all_healthy = all(c["healthy"] for c in checks.values())

    return {
        "healthy": all_healthy,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }
```

### Alerts to Configure

| Alert | Condition | Action |
|-------|-----------|--------|
| Webhook failures | >5 failures in 5 min | PagerDuty + Slack |
| Council timeouts | >3 timeouts in 10 min | Slack engineering |
| Apollo rate limit | 429 response | Slack + pause enrichment |
| Email bounce rate | >5% in 1 hour | Slack + investigate |
| Conversion drop | <10% vs last week | Slack product |

### Logging Standards

```python
# All logs must include:
log_app_event(
    "EMAIL_PIPELINE_EVENT",
    level="INFO",  # INFO, WARNING, ERROR, CRITICAL

    # Required context:
    lead_id=lead_id,
    email_domain=email.from_email.split("@")[-1],

    # Stage-specific:
    stage="enrichment",  # webhook, enrichment, council, response
    action="apollo_call",

    # Outcome:
    success=True,
    duration_ms=elapsed,
    error=None,  # or error message
)
```

### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Webhook latency (p99) | <500ms | >1000ms |
| Council execution time | <120s | >180s |
| Email delivery rate | >98% | <95% |
| Enrichment success rate | >80% | <60% |
| End-to-end time | <180s | >300s |

---

## Edge Cases & Error Handling

### Email Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty email body | Extract subject as question, proceed |
| Extremely long email (>50KB) | Truncate to first 10KB, warn user |
| Non-English email | Detect language, proceed (council is multilingual) |
| Attachments present | Ignore attachments, note in response |
| Out-of-office reply | Detect and skip (don't process auto-replies) |
| Email loop (our email → their auto-reply → webhook) | Detect self-replies and break loop |
| Duplicate email (same content, same sender) | Dedupe within 5 min window |

### Detection Patterns for Auto-Replies

```python
AUTO_REPLY_PATTERNS = [
    r"out of (the )?office",
    r"automatic reply",
    r"auto-reply",
    r"autoresponse",
    r"i am currently away",
    r"away from (my )?email",
    r"on (annual |medical )?leave",
    r"will respond when i return",
]

def is_auto_reply(subject: str, body: str) -> bool:
    combined = f"{subject} {body}".lower()
    return any(re.search(p, combined) for p in AUTO_REPLY_PATTERNS)
```

### Enrichment Edge Cases

| Scenario | Handling |
|----------|----------|
| Apollo returns no person | Fall back to company-only enrichment |
| Apollo returns no company | Use domain as company name fallback |
| Multiple people with same email | Use first result (Apollo handles dedup) |
| Competitor company detected | Flag for review, optionally skip |
| Very large company (>10K employees) | Tag as "Enterprise" for sales follow-up |
| Very small/unknown company | Lower enrichment confidence, still proceed |

### Council Execution Edge Cases

| Scenario | Handling |
|----------|----------|
| All Stage 1 models fail | Return error, queue for retry |
| Majority Stage 1 models fail | Proceed with available responses |
| Stage 2 all fail | Skip ranking, use Stage 1 verbatim |
| Stage 3 timeout | Return partial Stage 1 summary |
| Question is harmful/illegal | Detect and refuse politely |
| Question is personal (not business) | Still answer, but note limitation |

---

## Security Checklist

### Webhook Security
- [ ] Verify AgentMail signature on every request
- [ ] Reject unsigned requests in production
- [ ] Rate limit webhook endpoint (100/min)
- [ ] Log all incoming requests with IP

### Data Security
- [ ] Never log full email bodies (truncate to 200 chars)
- [ ] Never log full API keys
- [ ] Encrypt enrichment_data at rest (consider)
- [ ] PII access requires audit log

### API Security
- [ ] Apollo/FreshLink keys not exposed in frontend
- [ ] All API keys in environment variables (not code)
- [ ] Rotate API keys quarterly

### Email Security
- [ ] Sanitize all user input before echoing in response
- [ ] Prevent email injection attacks
- [ ] Rate limit emails per sender (10/hour max)
- [ ] Block known spam domains

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in production
- [ ] Database migration applied and verified
- [ ] AgentMail webhook URL configured
- [ ] Test email sent and received successfully
- [ ] Apollo API verified working
- [ ] Health check endpoint responding
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

### Post-Deployment

- [ ] Send test email from corporate domain → verify full flow
- [ ] Send test email from Gmail → verify waiting list flow
- [ ] Click "View Full Council Session" link → verify page loads
- [ ] Complete registration → verify lead conversion tracked
- [ ] Check all logs for errors
- [ ] Verify metrics appearing in dashboard
- [ ] Monitor for 24 hours before announcing

### Rollback Triggers

Immediately rollback if:
- Webhook failure rate >10%
- Email delivery rate <90%
- Any customer data exposure
- Council execution rate <50%

### Rollback Command

```bash
# Disable email processing
UPDATE email_leads SET status = 'paused_for_maintenance' WHERE status = 'received';

# Revert to previous deployment
git revert HEAD
git push origin main

# Re-enable after fix
UPDATE email_leads SET status = 'received' WHERE status = 'paused_for_maintenance';
```

---

## Implementation Timeline

| Week | Stage | Deliverables | Success Criteria |
|------|-------|--------------|------------------|
| 1 | Foundation | Webhook + DB | 100% emails received & stored |
| 2 | Enrichment | Apollo + FreshLink | 80%+ corporate emails enriched |
| 3 | Council | Pipeline integration | 95%+ councils complete in <3min |
| 4 | Responses | Email templates | 98%+ emails delivered |
| 5 | Waiting List | Non-corporate flow | Waiting list growing |
| 6 | Analytics | Conversion tracking | Dashboard live |
| 7 | Polish | Edge cases, monitoring | Zero critical bugs |
| 8 | Launch | LinkedIn/X campaign | First 100 organic leads |

---

## Marketing Launch Plan

### LinkedIn Strategy

1. **Founder post** announcing email-to-council feature
2. **Demo video** showing personalized response (blur sensitive data)
3. **Case study** from beta user (with permission)
4. **CTA:** "Email your toughest business question to council@axcouncil.com"

### X (Twitter) Strategy

1. **Thread** explaining the technology
2. **Screenshots** of personalized responses
3. **Live demo** processing a real question (curated)
4. **Engagement:** Reply to business questions with "we'd answer this with 5 AIs"

### Email Footer Strategy

Add to all company emails:
> 💡 Have a business question? Email council@axcouncil.com for a free AI council analysis

---

## Success Metrics (First 90 Days)

| Metric | Target | Stretch |
|--------|--------|---------|
| Emails received | 500 | 1,000 |
| Corporate leads | 300 | 600 |
| Waiting list signups | 200 | 500 |
| Conversions (registration) | 75 | 150 |
| Paid conversions | 8 | 20 |
| MRR from email leads | $800 | $2,000 |
| CAC via email channel | <$50 | <$25 |

---

## Appendix: Environment Variables Summary

```bash
# ==============================================================================
# EMAIL-TO-COUNCIL ONBOARDING CONFIGURATION
# ==============================================================================

# AgentMail (REQUIRED)
AGENTMAIL_API_KEY=am_live_xxxxx                    # From AgentMail dashboard
AGENTMAIL_INBOX_ADDRESS=council@yourdomain.com     # Your agent inbox
AGENTMAIL_WEBHOOK_SECRET=whsec_xxxxx               # For signature verification

# Lead Enrichment (RECOMMENDED)
APOLLO_API_KEY=your_apollo_key                     # From Apollo.io
FRESHLINK_API_KEY=your_rapidapi_key                # From RapidAPI (optional)

# Application URLs (REQUIRED)
APP_URL=https://app.axcouncil.com                  # For email links
VITE_APP_URL=https://app.axcouncil.com             # Frontend URL

# Monitoring (RECOMMENDED)
SENTRY_DSN=https://xxx@sentry.io/xxx               # Error tracking
SLACK_WEBHOOK_URL=https://hooks.slack.com/xxx      # Alerts
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-31
**Author:** Engineering Team
**Next Review:** After Stage 4 completion
