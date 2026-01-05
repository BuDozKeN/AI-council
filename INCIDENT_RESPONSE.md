# Incident Response Plan

> **Last Updated**: 2026-01-05
> **Owner**: Engineering Team
> **Review Frequency**: Quarterly

## Overview

This document defines how we detect, respond to, and recover from incidents affecting AxCouncil. It ensures consistent, efficient incident management and clear communication.

---

## Severity Levels

| Level | Name | Definition | Response Time | Examples |
|-------|------|------------|---------------|----------|
| **SEV1** | Critical | Complete service outage or data breach | < 15 minutes | Database down, security breach, all APIs failing |
| **SEV2** | High | Major feature broken, significant user impact | < 1 hour | LLM queries failing, billing broken, auth issues |
| **SEV3** | Medium | Partial degradation, workaround available | < 4 hours | Slow performance, single model failing, UI bugs |
| **SEV4** | Low | Minor issue, no immediate user impact | < 24 hours | Cosmetic issues, non-critical warnings |

---

## Incident Response Process

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   DETECT    │───▶│   TRIAGE    │───▶│   RESPOND   │───▶│   RESOLVE   │───▶│   REVIEW    │
│             │    │             │    │             │    │             │    │             │
│ Monitoring  │    │ Severity    │    │ Investigate │    │ Fix & Test  │    │ Post-mortem │
│ Alerts      │    │ Assignment  │    │ Communicate │    │ Deploy      │    │ Document    │
│ User Report │    │ Escalation  │    │ Mitigate    │    │ Verify      │    │ Improve     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Phase 1: Detection

### Automated Detection

| Source | What It Monitors | Alert Channel |
|--------|------------------|---------------|
| **Sentry** | Application errors, exceptions | Email, Slack |
| **Render** | Deploy failures, resource exhaustion | Email |
| **Supabase** | Database errors, connection issues | Dashboard |
| **Health Checks** | `/health` endpoint failures | Load balancer |

### Manual Detection

- Customer support tickets
- Social media mentions
- Direct user reports
- Team member observations

### Detection Checklist

When an issue is detected:
- [ ] Note the time of detection
- [ ] Capture initial symptoms
- [ ] Check monitoring dashboards
- [ ] Determine scope (single user vs all users)

---

## Phase 2: Triage

### Severity Assessment

Ask these questions to determine severity:

1. **Is the service completely unavailable?** → SEV1
2. **Is there a security breach or data exposure?** → SEV1
3. **Is a major feature broken for all users?** → SEV2
4. **Is there significant financial impact?** → SEV2
5. **Can users work around the issue?** → SEV3
6. **Is it cosmetic or minor?** → SEV4

### Escalation Matrix

| Severity | Initial Responder | Escalate To | When to Escalate |
|----------|-------------------|-------------|------------------|
| SEV1 | On-call engineer | CTO/Founder | Immediately |
| SEV2 | On-call engineer | Tech Lead | If not resolved in 30 min |
| SEV3 | Any engineer | On-call | If not resolved in 2 hours |
| SEV4 | Any engineer | N/A | Next business day |

### Triage Checklist

- [ ] Assign severity level
- [ ] Identify incident commander
- [ ] Create incident channel (if SEV1/SEV2)
- [ ] Notify stakeholders per escalation matrix

---

## Phase 3: Response

### Incident Commander Responsibilities

The Incident Commander (IC) is responsible for:
1. Coordinating response efforts
2. Making decisions on mitigation steps
3. Managing communication
4. Delegating tasks
5. Tracking timeline

### Response Actions by Severity

#### SEV1 Response (< 15 minutes to start)

1. **Acknowledge** - Confirm you're working on it
2. **Assess** - Check health endpoints, logs, monitoring
3. **Communicate** - Update status page immediately
4. **Mitigate** - Take immediate action to reduce impact
5. **Escalate** - Notify leadership and stakeholders

```bash
# Quick health check
curl https://axcouncil-backend.onrender.com/health
curl https://axcouncil-backend.onrender.com/health/metrics
```

#### SEV2 Response (< 1 hour to start)

1. **Acknowledge** - Confirm you're investigating
2. **Assess** - Identify root cause
3. **Communicate** - Update status page if user-facing
4. **Fix** - Implement solution
5. **Verify** - Confirm fix in production

#### SEV3/SEV4 Response

1. **Acknowledge** - Add to tracking system
2. **Prioritize** - Schedule for appropriate sprint
3. **Fix** - Implement during normal hours
4. **Verify** - Standard QA process

### Communication During Incidents

#### Internal Communication

| Audience | Channel | Frequency | Content |
|----------|---------|-----------|---------|
| Responders | Incident Slack | Continuous | Technical updates |
| Leadership | Email/Slack | Every 30 min (SEV1) | Status summary |
| Full team | Email | Resolution | Summary |

#### External Communication

| Severity | Status Page | Customer Email | Timing |
|----------|-------------|----------------|--------|
| SEV1 | Immediately | If > 30 min | Every 30 min |
| SEV2 | If > 15 min | If > 1 hour | Every hour |
| SEV3 | Optional | No | N/A |
| SEV4 | No | No | N/A |

---

## Phase 4: Resolution

### Resolution Checklist

- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Fix tested in staging (if possible)
- [ ] Fix deployed to production
- [ ] Monitoring confirms resolution
- [ ] Status page updated to "Resolved"
- [ ] Customer communication sent (if needed)

### Verification Steps

```bash
# Verify health endpoints
curl https://axcouncil-backend.onrender.com/health
# Expected: {"status": "healthy"}

# Verify specific functionality
# (depends on what was broken)

# Monitor for 15 minutes after fix
# Check Sentry for new errors
```

---

## Phase 5: Post-Incident Review

### Timeline

| Task | Deadline |
|------|----------|
| Draft post-mortem | 48 hours after resolution |
| Post-mortem meeting | 5 business days after resolution |
| Action items assigned | End of post-mortem meeting |
| Action items completed | Next sprint |

### Post-Mortem Template

```markdown
# Post-Incident Review: [Incident Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: SEVX
- **Impact**: [Who was affected and how]
- **Root Cause**: [Brief description]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Issue detected |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Verified resolved |

## Root Cause Analysis
[Detailed explanation of what went wrong]

## Impact
- Users affected: X
- Revenue impact: $X
- Data loss: None/X records

## What Went Well
- [List positive aspects of the response]

## What Could Be Improved
- [List areas for improvement]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Name] | [Date] | Open |
| [Action 2] | [Name] | [Date] | Open |

## Lessons Learned
[Key takeaways for the team]
```

### Blameless Culture

Our post-mortems are **blameless**:
- Focus on systems, not individuals
- Ask "what failed?" not "who failed?"
- Look for process improvements
- Share learnings openly

---

## On-Call Rotation

### Current Rotation

| Week Starting | Primary | Secondary |
|---------------|---------|-----------|
| TBD | TBD | TBD |

**TODO**: Establish on-call rotation when team size permits.

### On-Call Responsibilities

1. Respond to alerts within SLA
2. Triage and assess severity
3. Coordinate response or escalate
4. Document incident timeline
5. Hand off to next on-call

### On-Call Tools

| Tool | Purpose | Access |
|------|---------|--------|
| Sentry | Error monitoring | https://sentry.io |
| Render | Backend hosting | https://dashboard.render.com |
| Supabase | Database | https://supabase.com/dashboard |
| Status Page | Customer communication | TBD |

---

## Contact Information

### Internal Contacts

| Role | Name | Contact |
|------|------|---------|
| Engineering Lead | TBD | TBD |
| CTO | TBD | TBD |
| On-Call Primary | TBD | TBD |

### Vendor Support

| Vendor | Support URL | Response Time |
|--------|-------------|---------------|
| **Supabase** | https://supabase.com/dashboard/support | 24-48 hours (Pro) |
| **Render** | https://render.com/support | 24 hours |
| **Vercel** | https://vercel.com/support | 24 hours |
| **Stripe** | https://support.stripe.com | 24 hours |
| **OpenRouter** | https://openrouter.ai/docs | Community |
| **Sentry** | https://sentry.io/support | 24 hours (Team) |

---

## Runbooks

Detailed recovery procedures are in [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md):

1. **Database Corruption** - Supabase PITR recovery
2. **Regional Outage** - Wait for provider, update status
3. **LLM Provider Outage** - Circuit breakers auto-handle
4. **Security Breach** - Credential rotation, containment
5. **Accidental Deletion** - PITR or manual recovery
6. **DDoS Attack** - Rate limiting, Cloudflare

---

## Training

### New Team Member Onboarding

1. Read this document
2. Read DISASTER_RECOVERY.md
3. Get access to all monitoring tools
4. Shadow on-call for 1 week
5. Take primary on-call with backup

### Regular Training

| Training | Frequency | Format |
|----------|-----------|--------|
| Runbook review | Quarterly | Team meeting |
| Tabletop exercise | Semi-annually | Facilitated discussion |
| Full DR drill | Annually | Simulated incident |

---

## Metrics & Improvement

### Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **MTTD** | Mean Time to Detect | < 5 minutes |
| **MTTA** | Mean Time to Acknowledge | < 15 minutes (SEV1) |
| **MTTR** | Mean Time to Resolve | < 4 hours (SEV1) |
| **Incident Rate** | SEV1/SEV2 per month | < 2 |

### Tracking

Track all SEV1/SEV2 incidents in:
- Post-mortem documents
- Quarterly incident review

### Continuous Improvement

After each incident:
1. Complete post-mortem
2. Assign action items
3. Track to completion
4. Review in quarterly meeting

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-05 | 1.0 | Initial creation |
