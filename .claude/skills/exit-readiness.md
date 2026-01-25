---
name: exit-readiness
description: $25M exit readiness checklist, priorities, and enterprise requirements
tags: [exit, enterprise, valuation, due-diligence]
---

# Exit Readiness Skill - $25M Target

This skill encodes the key priorities and requirements for achieving a $25M exit valuation. Load when working on enterprise features or preparing for due diligence.

## Exit Valuation Formula

For AI SaaS products:
```
Valuation = ARR × Revenue Multiple (typically 10-15x for AI)
Target: $25M = ~$2M ARR needed
```

## Priority Tiers

### Tier 1: Revenue Infrastructure (Critical)
Without these, no exit is possible:

- [ ] **Billing System** - Stripe integration, subscription management
- [ ] **Usage Metering** - Track LLM tokens, API calls per customer
- [ ] **Multi-tenant Isolation** - Complete data separation per company
- [ ] **SLA Compliance** - 99.9% uptime capability
- [ ] **Audit Logging** - Every action tracked for compliance

### Tier 2: Enterprise Features (High Value)
These command premium pricing:

- [ ] **SSO/SAML** - Enterprise authentication
- [ ] **RBAC** - Role-based access control
- [ ] **Admin Portal** - Company-level management
- [ ] **Data Export** - GDPR compliance, portability
- [ ] **Custom Branding** - White-label capability
- [ ] **API Access** - Programmatic integration

### Tier 3: Security & Compliance (Due Diligence)
Acquirers will audit these:

- [ ] **SOC 2 Type II** - Or clear path to certification
- [ ] **Penetration Testing** - Third-party security audit
- [ ] **GDPR Compliance** - EU data protection
- [ ] **Incident Response Plan** - Documented procedures
- [ ] **Business Continuity** - Disaster recovery tested

### Tier 4: Technical Excellence (Multiplier)
These increase valuation multiple:

- [ ] **Test Coverage** - 80%+ coverage
- [ ] **CI/CD Pipeline** - Automated deployment
- [ ] **Monitoring** - Observability stack
- [ ] **Documentation** - API docs, architecture docs
- [ ] **Clean Codebase** - Low technical debt

## Due Diligence Checklist

### Code Quality
- [ ] No critical security vulnerabilities
- [ ] Test suite passes consistently
- [ ] No hardcoded secrets in codebase
- [ ] Dependencies up to date
- [ ] No GPL-licensed dependencies (or cleared)

### Data & Privacy
- [ ] Data processing agreement template
- [ ] Privacy policy current
- [ ] Cookie consent implemented
- [ ] Data retention policies defined
- [ ] Right to deletion implemented

### Business
- [ ] Customer contracts standardized
- [ ] IP ownership clear
- [ ] No open-source license violations
- [ ] Vendor contracts reviewed
- [ ] Employee/contractor IP assignments

### Infrastructure
- [ ] Infrastructure as Code
- [ ] Disaster recovery tested
- [ ] Backup verification
- [ ] Security headers configured
- [ ] Rate limiting in place

## Key Files

| Document | Location |
|----------|----------|
| Exit Roadmap | `todo/EXIT-READINESS-25M.md` |
| Security Audit | `SECURITY_AUDIT.md` |
| Incident Response | `INCIDENT_RESPONSE.md` |
| Disaster Recovery | `DISASTER_RECOVERY.md` |

## Audit Commands for Exit Readiness

Run these regularly:

```bash
/audit-security          # Banking-grade security check
/audit-enterprise-sso    # SSO/SAML readiness
/audit-legal-compliance  # GDPR, privacy compliance
/audit-data-portability  # Export capabilities
/audit-multitenancy      # Tenant isolation
/audit-disaster-recovery # DR procedures
/audit-scalability       # Growth capacity
```

## Enterprise Pricing Tiers (Typical)

| Tier | Price/mo | Features |
|------|----------|----------|
| Starter | $99 | 5 users, basic council |
| Professional | $499 | 25 users, API access |
| Enterprise | $2,000+ | Unlimited, SSO, SLA |

**Target**: 100 Enterprise customers × $2K = $2.4M ARR = $25M+ valuation

## Red Flags for Acquirers

Avoid these issues:

1. **Security vulnerabilities** - Any critical/high issues
2. **Customer concentration** - >30% revenue from one customer
3. **Technical debt** - Unmaintainable codebase
4. **Key person risk** - All knowledge in one person
5. **Open source violations** - GPL contamination
6. **Incomplete contracts** - Missing IP assignments

## Quick Wins for Valuation

High-impact, relatively easy:

1. **Add usage analytics** - Show growth metrics
2. **Document architecture** - Reduce key person risk
3. **Security audit** - Third-party validation
4. **Customer testimonials** - Social proof
5. **API documentation** - Developer-friendly

## Sprint Planning

### 90-Day Exit Prep Sprint

**Month 1: Foundation**
- Complete security audit
- Implement audit logging
- Document architecture

**Month 2: Enterprise**
- SSO/SAML integration
- Admin portal enhancements
- Usage metering

**Month 3: Polish**
- Third-party pen test
- SOC 2 preparation
- Customer success stories

## Metrics to Track

| Metric | Target | Why |
|--------|--------|-----|
| MRR Growth | 15%+ m/m | Shows trajectory |
| Churn Rate | <5% | Customer satisfaction |
| NPS Score | 50+ | Recommendation likelihood |
| Uptime | 99.9%+ | Reliability |
| Response Time | <200ms | Performance |
| Test Coverage | 80%+ | Code quality |

## Related Agents

- `enterprise-readiness` - Tracks overall exit progress
- `security-guardian` - Monitors security posture
- `council-ops` - Tracks LLM costs and margins
