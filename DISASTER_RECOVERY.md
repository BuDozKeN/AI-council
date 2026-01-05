# Disaster Recovery Runbook

> **Last Updated**: 2026-01-05
> **Owner**: Engineering Team
> **Review Frequency**: Quarterly

## Recovery Objectives

| Metric | Target | Current Status |
|--------|--------|----------------|
| **RTO** (Recovery Time Objective) | < 4 hours | Untested - verify quarterly |
| **RPO** (Recovery Point Objective) | < 1 hour | Supabase PITR enabled |

## Quick Reference

### Emergency Contacts

| Service | Support URL | Priority |
|---------|-------------|----------|
| **Supabase** | https://supabase.com/dashboard/support | Database issues |
| **Render** | https://render.com/support | Backend API issues |
| **Vercel** | https://vercel.com/support | Frontend issues |
| **Stripe** | https://support.stripe.com | Billing issues |
| **OpenRouter** | https://openrouter.ai/docs | LLM API issues |
| **Sentry** | https://sentry.io/support | Error tracking |

### Status Page

**TODO**: Configure status page at one of:
- https://www.atlassian.com/software/statuspage (Statuspage.io)
- https://instatus.com (Free tier available)
- https://betterstack.com/status-page

---

## Scenario 1: Database Corruption / Data Loss

### Symptoms
- Application errors mentioning database connection failures
- Missing or corrupted data reported by users
- Sentry alerts for PostgreSQL errors

### Severity: SEV1 (Critical)

### Recovery Steps

#### 1. Assess the Damage (5 minutes)
```bash
# Check Supabase dashboard for database health
# URL: https://supabase.com/dashboard/project/ywoodvmtbkinopixoyfc

# Check recent migrations that may have caused issues
ls -la supabase/migrations/
```

#### 2. Enable Maintenance Mode (2 minutes)
```bash
# Option A: Scale Render service to 0
# Dashboard: https://dashboard.render.com → axcouncil-backend → Settings → Scale to 0

# Option B: Update environment variable
# Set MAINTENANCE_MODE=true in Render dashboard
```

#### 3. Identify Recovery Point (5 minutes)
- Check Supabase dashboard → Database → Backups
- Identify the last known good state (before corruption)
- Note the timestamp for PITR

#### 4. Initiate Point-in-Time Recovery (15-60 minutes)
```
Supabase Dashboard → Database → Backups → Point-in-time recovery

Select timestamp BEFORE the corruption event
Wait for restoration to complete
```

#### 5. Validate Recovery (15 minutes)
```sql
-- Verify core tables have data
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM knowledge_entries;

-- Check for recent data (should match expected timestamp)
SELECT MAX(created_at) FROM conversations;
```

#### 6. Resume Service (5 minutes)
```bash
# Scale Render service back up
# Dashboard: https://dashboard.render.com → axcouncil-backend → Scale to 1

# Or remove MAINTENANCE_MODE environment variable
```

#### 7. Post-Incident
- [ ] Update status page
- [ ] Notify affected users
- [ ] Schedule post-mortem
- [ ] Document actual recovery time

---

## Scenario 2: Regional Outage (AWS/GCP Region Down)

### Symptoms
- Complete service unavailability
- Health checks failing
- Cloud provider status page shows regional issues

### Severity: SEV1 (Critical)

### Current Architecture Limitations
- **Frontend**: Vercel Edge (multi-region) ✅
- **Backend**: Render (single region) ❌
- **Database**: Supabase (single region) ❌

### Recovery Steps

#### 1. Confirm Regional Outage (5 minutes)
Check provider status pages:
- AWS: https://health.aws.amazon.com
- GCP: https://status.cloud.google.com
- Render: https://status.render.com
- Supabase: https://status.supabase.com

#### 2. Update Status Page (2 minutes)
Post incident on status page:
```
Title: Service Degradation - Regional Outage
Status: Major Outage
Message: We are experiencing service disruption due to a regional
cloud provider outage. Our team is monitoring the situation.
ETA for resolution depends on provider recovery.
```

#### 3. Wait for Provider Recovery
- Monitor provider status pages
- Update status page every 30 minutes
- Prepare customer communication

#### 4. Verify Service Recovery (10 minutes)
```bash
# Check health endpoints
curl https://axcouncil-backend.onrender.com/health
curl https://axcouncil-backend.onrender.com/health/ready

# Verify database connectivity
curl https://axcouncil-backend.onrender.com/health/metrics
```

#### 5. Post-Incident
- [ ] Update status page to resolved
- [ ] Send customer notification
- [ ] Evaluate multi-region migration

### Future Mitigation
- Evaluate Render multi-region or Fly.io
- Consider Supabase read replicas
- Implement DNS-based failover

---

## Scenario 3: LLM Provider Outage (OpenRouter Down)

### Symptoms
- Council queries timing out or failing
- Circuit breakers tripping (visible in `/health/metrics`)
- Sentry alerts for OpenRouter errors

### Severity: SEV2 (High)

### Automatic Mitigations (Already Implemented)
- Circuit breakers prevent cascade failures
- Per-model isolation (one model failing doesn't block others)
- Chairman fallback chain for Stage 3

### Recovery Steps

#### 1. Check Circuit Breaker Status (2 minutes)
```bash
curl https://axcouncil-backend.onrender.com/health/metrics | jq '.circuit_breakers'
```

Expected output during outage:
```json
{
  "summary": { "total": 5, "closed": 2, "open": 3, "half_open": 0 },
  "models": {
    "claude-3-5-sonnet": { "state": "open", "seconds_until_recovery": 45 }
  }
}
```

#### 2. Check OpenRouter Status (2 minutes)
- OpenRouter Status: https://status.openrouter.ai
- Check which specific models are affected

#### 3. Update Status Page (if prolonged)
```
Title: Degraded Performance - AI Response Delays
Status: Partial Outage
Message: Some AI models are experiencing delays. The system is
automatically routing to available models. Response times may
be slower than usual.
```

#### 4. Monitor Recovery
Circuit breakers will automatically:
1. Open after 5 consecutive failures
2. Wait 60 seconds
3. Allow 3 test requests (half-open)
4. Close if tests succeed

#### 5. No Manual Intervention Needed
The system is designed to self-heal. Only escalate if:
- All 5 council models are down simultaneously
- Outage lasts > 1 hour
- Customer complaints increase significantly

---

## Scenario 4: Security Breach / Compromised Credentials

### Symptoms
- Unusual API activity in logs
- Customer reports of unauthorized access
- Sentry alerts for authentication failures
- Billing anomalies

### Severity: SEV1 (Critical)

### Recovery Steps

#### 1. Contain the Breach (Immediately)

**Rotate All API Keys:**
```bash
# 1. OpenRouter API Key
# Generate new key: https://openrouter.ai/keys
# Update in Render: OPENROUTER_API_KEY

# 2. Supabase Service Role Key (if compromised)
# Supabase Dashboard → Settings → API → Generate new key
# Update in Render: SUPABASE_SERVICE_ROLE_KEY

# 3. Stripe API Keys
# Stripe Dashboard → Developers → API keys → Roll keys
# Update in Render: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# 4. Sentry DSN (if exposed)
# Sentry Dashboard → Settings → Client Keys → Rotate
```

**Force Logout All Users:**
```sql
-- In Supabase SQL Editor
-- Invalidate all refresh tokens
DELETE FROM auth.refresh_tokens;
```

#### 2. Preserve Evidence (15 minutes)
```bash
# Export recent logs from Render
# Dashboard → Logs → Export last 24 hours

# Export Supabase audit logs
# Dashboard → Database → Logs

# Screenshot any suspicious activity
```

#### 3. Assess Scope (30 minutes)
- Which credentials were compromised?
- What data was potentially accessed?
- How many users affected?
- Timeline of unauthorized access

#### 4. Notify Affected Parties
- **Internal**: Notify team immediately
- **Users**: Within 72 hours (GDPR requirement)
- **Regulators**: If required by jurisdiction

#### 5. Remediate
- [ ] Patch vulnerability that led to breach
- [ ] Implement additional monitoring
- [ ] Review access controls
- [ ] Update security policies

#### 6. Post-Incident
- [ ] Complete incident report
- [ ] External security audit (if major breach)
- [ ] Update SECURITY_CHANGELOG.md

---

## Scenario 5: Accidental Data Deletion

### Symptoms
- User reports missing data
- Application errors for specific resources
- Audit logs show DELETE operations

### Severity: SEV2 (High)

### Recovery Steps

#### 1. Stop Further Damage (2 minutes)
If deletion is ongoing (e.g., runaway script):
```bash
# Scale down backend
# Render Dashboard → Scale to 0
```

#### 2. Identify Deleted Data (10 minutes)
```sql
-- Check Supabase audit logs (if enabled)
-- Dashboard → Database → Logs

-- Check application logs in Render
-- Look for DELETE operations with user/resource IDs
```

#### 3. Point-in-Time Recovery (if extensive)
Use Supabase PITR to restore to before deletion.

#### 4. Selective Recovery (if limited)
For small amounts of data, manually reconstruct from:
- User exports (if they saved their data)
- Sentry breadcrumbs (request payloads)
- Application logs

#### 5. Prevent Recurrence
- [ ] Add soft-delete pattern (is_deleted flag instead of DELETE)
- [ ] Add confirmation dialogs for bulk operations
- [ ] Implement audit logging

---

## Scenario 6: DDoS Attack / Traffic Spike

### Symptoms
- Elevated latency
- 503 errors from rate limiting
- Unusual traffic patterns
- Render resource exhaustion

### Severity: SEV2 (High)

### Automatic Mitigations (Already Implemented)
- Rate limiting per user (5 queries/minute for council)
- Rate limiting per endpoint (see API Governance)
- Vercel Edge caching for frontend

### Recovery Steps

#### 1. Confirm Attack vs Legitimate Traffic (5 minutes)
```bash
# Check rate limit metrics
curl https://axcouncil-backend.onrender.com/health/metrics

# Check Render metrics
# Dashboard → Metrics → Request count, latency
```

#### 2. Increase Rate Limit Strictness (if needed)
Temporarily reduce limits in Render environment:
```
RATE_LIMIT_COUNCIL=2  # Reduce from 5/minute
```

#### 3. Enable Cloudflare (if not already)
- Add Cloudflare in front of Render
- Enable "Under Attack Mode"
- Configure WAF rules

#### 4. Scale Up (if legitimate traffic)
```bash
# Render Dashboard → Scale → Increase instances
# Or upgrade to higher tier
```

#### 5. Post-Incident
- [ ] Analyze traffic patterns
- [ ] Implement IP-based blocking if malicious
- [ ] Consider CDN caching for API responses

---

## Health Check Reference

### Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Full health check | `{"status": "healthy"}` |
| `/health/live` | Liveness probe | `{"status": "alive"}` |
| `/health/ready` | Readiness probe | `{"status": "ready"}` |
| `/health/metrics` | Observability | Circuit breakers, cache stats |

### Interpreting Health Status

| Status | Meaning | Action |
|--------|---------|--------|
| `healthy` | All systems operational | None |
| `degraded` | Some circuit breakers open | Monitor, self-healing |
| `unhealthy` | Database unavailable | Investigate immediately |
| `draining` | Graceful shutdown in progress | Wait for completion |

---

## Communication Templates

### Status Page - Investigating
```
Title: Investigating Service Issues
Status: Investigating
Message: We are investigating reports of [service degradation/errors/slowness].
Our team is actively working on this issue. Updates will follow.
```

### Status Page - Identified
```
Title: Issue Identified - [Brief Description]
Status: Identified
Message: We have identified the cause of the current issues as [root cause].
Our team is implementing a fix. Estimated resolution: [time].
```

### Status Page - Resolved
```
Title: Resolved - [Brief Description]
Status: Resolved
Message: The issue affecting [service] has been resolved.
All systems are now operational. We apologize for any inconvenience.

Root cause: [brief explanation]
Duration: [start time] to [end time]
```

### Customer Email - Incident Notification
```
Subject: [AxCouncil] Service Incident - [Date]

Dear Customer,

We experienced a service incident today that may have affected your experience.

What happened: [brief description]
Duration: [start] to [end]
Impact: [what users experienced]
Resolution: [what we did to fix it]

We apologize for any inconvenience this may have caused. If you have any
questions, please contact support@axcouncil.com.

Best regards,
The AxCouncil Team
```

---

## DR Testing Schedule

| Test Type | Frequency | Last Tested | Next Due |
|-----------|-----------|-------------|----------|
| Backup Restoration | Quarterly | Never | 2026-01-31 |
| Failover Test | Quarterly | Never | 2026-01-31 |
| Tabletop Exercise | Semi-annually | Never | 2026-03-31 |
| Full DR Drill | Annually | Never | 2026-06-30 |

### Backup Restoration Test Procedure

1. Create test project in Supabase (non-production)
2. Initiate PITR to test project
3. Verify data integrity
4. Document recovery time
5. Delete test project

### Tabletop Exercise Topics
- Database corruption scenario
- Regional outage scenario
- Security breach scenario
- LLM provider outage scenario

---

## Appendix: Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Render | Database connection |
| `SUPABASE_KEY` | Render | Database auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Render | Admin operations |
| `OPENROUTER_API_KEY` | Render | LLM API access |
| `STRIPE_SECRET_KEY` | Render | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Render | Webhook verification |
| `SENTRY_DSN` | Render | Error tracking |
| `ENVIRONMENT` | Render | production/development |

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-05 | 1.0 | Initial creation |
