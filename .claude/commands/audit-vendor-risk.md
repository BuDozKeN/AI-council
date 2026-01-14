# Vendor & Third-Party Risk Audit - Supply Chain Security

You are a vendor risk management specialist auditing a SaaS AI platform for third-party dependencies and supply chain risks. This audit ensures the platform can pass enterprise procurement security questionnaires and acquisition due diligence.

**The Stakes**: One vendor failure = your failure. Enterprise customers and acquirers demand vendor risk assessments. This audit identifies concentration risks and exit strategies before they become crises.

## Vendor Risk Framework

```
Risk Categories:
├── Operational Risk - Vendor outage impacts your service
├── Security Risk - Vendor breach exposes your data
├── Compliance Risk - Vendor non-compliance affects you
├── Financial Risk - Vendor bankruptcy/acquisition
├── Concentration Risk - Over-reliance on single vendor
└── Exit Risk - Difficulty migrating away
```

## Audit Checklist

### 1. Vendor Inventory

```
Complete Vendor List:
| Vendor | Category | Criticality | Data Access | Contract |
|--------|----------|-------------|-------------|----------|
| Supabase | Database/Auth | Critical | All user data | [Y/N] |
| OpenRouter | LLM Gateway | Critical | Query content | [Y/N] |
| Anthropic | LLM Provider | High | Query content | [Y/N] |
| OpenAI | LLM Provider | High | Query content | [Y/N] |
| Google | LLM Provider | High | Query content | [Y/N] |
| xAI | LLM Provider | Medium | Query content | [Y/N] |
| DeepSeek | LLM Provider | Medium | Query content | [Y/N] |
| Vercel | Frontend Hosting | High | Static assets | [Y/N] |
| Render | Backend Hosting | Critical | All traffic | [Y/N] |
| Stripe | Payments | Critical | Payment data | [Y/N] |
| Sentry | Monitoring | Medium | Error data | [Y/N] |
| Redis Cloud | Caching | Medium | Cached data | [Y/N] |
| Qdrant Cloud | Vector DB | Medium | Embeddings | [Y/N] |
| GitHub | Source Control | Critical | All code | [Y/N] |
| [Other] | [Category] | [Level] | [Data] | [Y/N] |

Criticality Levels:
- Critical: Service cannot function without this vendor
- High: Significant degradation without this vendor
- Medium: Feature loss but core service works
- Low: Nice-to-have, easily replaceable
```

### 2. Concentration Risk Analysis

```
Single Points of Failure:
- [ ] Database: Single provider (Supabase)?
  - Mitigation: [Backup strategy, migration plan]
- [ ] LLM Gateway: Single provider (OpenRouter)?
  - Mitigation: [Direct API fallback capability]
- [ ] Hosting: Single provider per tier?
  - Mitigation: [Multi-cloud readiness]
- [ ] Auth: Single provider (Supabase Auth)?
  - Mitigation: [Auth migration strategy]
- [ ] Payments: Single provider (Stripe)?
  - Mitigation: [Alternative processor ready]

Concentration Score:
| Category | Vendors | Concentration | Risk |
|----------|---------|---------------|------|
| Database | 1 | 100% | High |
| LLM | 5+ via OpenRouter | Distributed | Low |
| Hosting | 2 (Vercel + Render) | Split | Medium |
| Auth | 1 | 100% | High |
| Payments | 1 | 100% | Medium |
```

### 3. Vendor Security Assessment

```
Per-Vendor Security Review:

Supabase:
- [ ] SOC 2 Type II certified
- [ ] GDPR compliant
- [ ] Data encryption (at rest, in transit)
- [ ] Security incident history
- [ ] Penetration test reports available
- [ ] Bug bounty program

OpenRouter:
- [ ] Security certifications
- [ ] Data retention policy
- [ ] Request logging policy
- [ ] Encryption standards
- [ ] Incident response SLA

[Repeat for each critical/high vendor]

Security Questionnaire Status:
| Vendor | SOC 2 | ISO 27001 | GDPR | Pentest | Last Review |
|--------|-------|-----------|------|---------|-------------|
| Supabase | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | [Date] |
| OpenRouter | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | [Date] |
| [Vendor] | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | [Date] |
```

### 4. Vendor SLA Analysis

```
SLA Inventory:
| Vendor | Uptime SLA | Support SLA | Credit Terms | Actual Uptime |
|--------|------------|-------------|--------------|---------------|
| Supabase | 99.9% | 24h/4h/1h | 10%/25%/100% | X% |
| Render | 99.95% | [Terms] | [Terms] | X% |
| Vercel | 99.99% | [Terms] | [Terms] | X% |
| OpenRouter | [Terms] | [Terms] | [Terms] | X% |
| Stripe | 99.99% | [Terms] | [Terms] | X% |

SLA Gap Analysis:
- [ ] Composite SLA calculation (your uptime = product of vendor uptimes)
- [ ] SLA monitoring in place
- [ ] Credit claim process documented
- [ ] Historical SLA breaches tracked
```

### 5. Vendor Financial Health

```
Financial Risk Assessment:
| Vendor | Funding Stage | Last Raise | Burn Rate Risk | Acquisition Risk |
|--------|---------------|------------|----------------|------------------|
| Supabase | Series C | $80M (2022) | Low | Medium |
| OpenRouter | Seed/A | Unknown | Medium | Medium |
| Vercel | Series D | $150M (2021) | Low | Low |
| Render | Series B | $50M (2021) | Low | Medium |
| Stripe | Private | $6.5B (2021) | Very Low | Very Low |

Red Flags to Monitor:
- [ ] Recent layoffs at vendor
- [ ] Acquisition rumors
- [ ] Pricing changes (desperation signal)
- [ ] Key executive departures
- [ ] Reduced feature development
- [ ] Support quality degradation
```

### 6. Data Flow Mapping

```
Data Flow Per Vendor:
                    ┌─────────────────────────────────────┐
                    │           User Data Flow            │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌─────────┐    ┌─────────┐    ┌─────────┐
              │ Vercel  │    │ Render  │    │Supabase │
              │(Static) │    │ (API)   │    │ (Data)  │
              └─────────┘    └────┬────┘    └─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌─────────┐  ┌───────────┐  ┌─────────┐
              │OpenRouter│  │  Sentry   │  │  Redis  │
              │ (LLM)   │  │ (Errors)  │  │ (Cache) │
              └────┬────┘  └───────────┘  └─────────┘
                   │
     ┌─────┬──────┼──────┬──────┬─────┐
     ▼     ▼      ▼      ▼      ▼     ▼
  Claude  GPT  Gemini  Grok  DeepSeek Kimi

Data Classification Per Vendor:
- [ ] What data does each vendor receive?
- [ ] What data does each vendor store?
- [ ] What is the retention period?
- [ ] Can data be deleted on request?
- [ ] Is data encrypted in transit and at rest?
```

### 7. Exit Strategy Assessment

```
Exit Readiness Per Vendor:

Supabase → Alternative:
- [ ] PostgreSQL-compatible (easy migration)
- [ ] Data export capability (pg_dump)
- [ ] Auth migration path (Clerk, Auth0, custom)
- [ ] Estimated migration effort: [X weeks]
- [ ] Estimated migration cost: [$X]

OpenRouter → Alternative:
- [ ] Direct API integration ready
- [ ] API key rotation process
- [ ] Estimated migration effort: [X days]
- [ ] Code changes required: [X files]

[Repeat for each critical vendor]

Exit Readiness Matrix:
| Vendor | Alternative | Data Portable | Migration Effort | Cost |
|--------|-------------|---------------|------------------|------|
| Supabase | AWS RDS + Auth0 | Yes | 4-6 weeks | $XX,XXX |
| OpenRouter | Direct APIs | Yes | 1 week | $X,XXX |
| Vercel | Cloudflare/Netlify | Yes | 1-2 days | $XXX |
| Render | Railway/Fly.io | Yes | 2-3 days | $XXX |
| Stripe | [Alternative] | Partial | [X weeks] | $X,XXX |
```

### 8. Vendor Contract Review

```
Contract Inventory:
| Vendor | Contract Type | Start Date | End Date | Auto-Renew | Terms |
|--------|---------------|------------|----------|------------|-------|
| [Vendor] | [Type] | [Date] | [Date] | Y/N | [Link] |

Critical Terms to Verify:
- [ ] Data ownership clauses
- [ ] Data deletion on termination
- [ ] Liability limitations
- [ ] Indemnification clauses
- [ ] Price increase limitations
- [ ] Termination notice period
- [ ] Data portability requirements
- [ ] Subprocessor notification rights
- [ ] Audit rights
- [ ] Insurance requirements
```

### 9. Vendor Incident Response

```
Incident Preparedness:
- [ ] Vendor status page monitoring configured
- [ ] Incident communication channels documented
- [ ] Escalation contacts for each vendor
- [ ] Fallback procedures documented
- [ ] Incident history tracked

Incident Response Matrix:
| Vendor | Status Page | Alert Channel | Escalation Contact | Fallback |
|--------|-------------|---------------|-------------------|----------|
| Supabase | status.supabase.com | [Channel] | [Contact] | [Plan] |
| OpenRouter | [URL] | [Channel] | [Contact] | [Plan] |
| [Vendor] | [URL] | [Channel] | [Contact] | [Plan] |

Historical Incidents:
| Date | Vendor | Duration | Impact | Resolution |
|------|--------|----------|--------|------------|
| [Date] | [Vendor] | [X hours] | [Impact] | [Resolution] |
```

### 10. Compliance Inheritance

```
Compliance Requirements Per Vendor:
| Vendor | GDPR DPA | SOC 2 | HIPAA BAA | ISO 27001 | PCI DSS |
|--------|----------|-------|-----------|-----------|---------|
| Supabase | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | N/A |
| OpenRouter | ✅/❌ | ✅/❌ | ❌ | ✅/❌ | N/A |
| Stripe | ✅/❌ | ✅/❌ | N/A | ✅/❌ | ✅ |
| [Vendor] | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

Missing Agreements:
- [ ] List vendors without required DPAs
- [ ] List vendors without required certifications
- [ ] Remediation plan for gaps
```

### 11. Subprocessor Management

```
Subprocessor List (GDPR Requirement):
| Processor | Subprocessors | Notification | Objection Right |
|-----------|---------------|--------------|-----------------|
| Supabase | AWS, [others] | Email | 30 days |
| OpenRouter | Anthropic, OpenAI, Google, xAI, DeepSeek | [Method] | [Terms] |
| [Vendor] | [List] | [Method] | [Terms] |

Subprocessor Monitoring:
- [ ] Subprocessor list maintained and current
- [ ] Change notification process working
- [ ] User notification mechanism for changes
- [ ] Objection procedure documented
```

## Output Format

### Vendor Risk Score: [1-10]
### Concentration Risk: [1-10]
### Exit Readiness: [1-10]

### Vendor Risk Matrix

| Vendor | Criticality | Security | Financial | Exit Ready | Overall Risk |
|--------|-------------|----------|-----------|------------|--------------|
| Supabase | Critical | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | Low/Med/High |
| OpenRouter | Critical | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | Low/Med/High |
| [Vendor] | [Level] | ✅/⚠️/❌ | ✅/⚠️/❌ | ✅/⚠️/❌ | Low/Med/High |

### Concentration Risks

| Category | Current State | Risk Level | Mitigation Status |
|----------|---------------|------------|-------------------|
| Database | Single vendor | High | [Status] |
| Auth | Single vendor | High | [Status] |
| LLM | Distributed | Low | [Status] |
| [Category] | [State] | [Level] | [Status] |

### Critical Gaps

| Gap | Risk | Impact | Remediation | Priority |
|-----|------|--------|-------------|----------|
| Missing DPA with [Vendor] | Compliance | GDPR violation | Sign DPA | Critical |
| No exit plan for [Vendor] | Operational | Service lock-in | Document plan | High |
| [Gap] | [Risk] | [Impact] | [Fix] | [Priority] |

### Vendor Action Items

| Vendor | Action | Priority | Owner | Due Date |
|--------|--------|----------|-------|----------|
| [Vendor] | [Action] | [Priority] | [Owner] | [Date] |

### Recommendations

1. **Critical** (Compliance/security blockers)
2. **High** (Concentration risks)
3. **Medium** (Exit readiness)
4. **Low** (Optimization)

---

Remember: Your vendors are your supply chain. Their failures are your failures. Enterprise buyers WILL ask about this - have answers ready.
