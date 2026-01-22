# Claude Code Commands & Audits Catalog

> A comprehensive list of all Claude Code slash commands available in AxCouncil for automated code review, quality assurance, and comprehensive auditing.

**GitHub Repository**: [https://github.com/BuDozKeN/AI-council](https://github.com/BuDozKeN/AI-council)

**Commands Location**: [`.claude/commands/`](https://github.com/BuDozKeN/AI-council/tree/master/.claude/commands)

---

## Quick Reference

| Category | Commands | Description |
|----------|----------|-------------|
| **Full Audit** | 1 | Complete $25M due diligence review |
| **UX/UI Audits** | 6 | User experience & visual design |
| **Security Audits** | 5 | Application & AI security |
| **Code Quality** | 4 | Architecture & maintainability |
| **Compliance** | 5 | Legal, data, enterprise readiness |
| **Infrastructure** | 6 | DevOps, performance, scalability |
| **AI-Specific** | 3 | LLM operations & ethics |
| **Utilities** | 2 | QA & development helpers |

**Total: 42 commands**

---

## UX/UI Audits

### `/audit-ux` - UX Audit (Frictionless Experience)
**File**: [`audit-ux.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-ux.md)

Comprehensive UX review using Nielsen's 10 Heuristics, cognitive walkthroughs, and the "Mum Test" framework. Evaluates user flows, error handling, microcopy, dark patterns compliance, and AI-specific interaction patterns.

**Key Features**:
- Nielsen's 10 Usability Heuristics scoring
- Cognitive walkthrough for core tasks
- Dark patterns legal compliance audit
- Microcopy & tooltip review
- AI/LLM-specific UX patterns
- $25M due diligence grade standards

---

### `/audit-ui` - UI Audit (Visual Excellence)
**File**: [`audit-ui.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-ui.md)

Visual design review benchmarked against Stripe, Linear, Notion, and Revolut standards. Covers design system consistency, typography, color harmony, spacing, animations, and dark mode quality.

**Key Features**:
- Design token compliance
- Typography & color harmony
- Component polish verification
- Animation & motion review
- Dark mode excellence check
- Premium detail assessment

---

### `/audit-ux-visual` - UX Visual Audit
**File**: [`audit-ux-visual.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-ux-visual.md)

Combined UX and visual design audit focusing on the intersection of usability and aesthetics.

---

### `/audit-mobile` - Mobile Experience Audit
**File**: [`audit-mobile.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-mobile.md)

Native-quality PWA review ensuring the mobile experience rivals apps like Revolut and Monzo. Tests touch targets, responsive layouts, gestures, PWA features, and platform-specific behaviors.

**Key Features**:
- Touch target verification (44x44px minimum)
- Responsive breakpoint testing (320px-1024px)
- iOS/Android specific checks
- PWA manifest & offline capability
- Performance on 3G networks
- Safe area & notch handling

---

### `/audit-mobile-interaction` - Mobile Interaction Patterns
**File**: [`audit-mobile-interaction.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-mobile-interaction.md)

Deep dive into mobile-specific interaction patterns including swipe gestures, pull-to-refresh, haptic feedback, and thumb-zone optimization.

---

### `/audit-a11y` - Accessibility Audit (WCAG 2.1 AA)
**File**: [`audit-a11y.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-a11y.md)

Full WCAG 2.1 Level AA compliance audit covering all four principles: Perceivable, Operable, Understandable, and Robust.

**Key Features**:
- Complete WCAG 2.1 AA checklist
- ARIA implementation review
- Screen reader testing scenarios
- Keyboard navigation verification
- Color contrast validation
- Focus management audit

---

## Security Audits

### `/audit-security` - Security Audit (Banking-Grade)
**File**: [`audit-security.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-security.md)

Comprehensive security audit meeting banking and fintech standards. Covers OWASP Top 10, API Security Top 10, authentication, authorization, data protection, and zero trust principles.

**Key Features**:
- OWASP Top 10 (2021) compliance
- OWASP API Security Top 10 (2023)
- JWT & session management review
- RLS policy verification
- CVSS-aligned severity scoring
- Supply chain security

---

### `/audit-attack` - Attack Simulation (Red Team)
**File**: [`audit-attack.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-attack.md)

Red team penetration testing simulation identifying exploit scenarios, attack chains, and security weaknesses from an attacker's perspective.

---

### `/audit-ai-security` - AI Security Audit
**File**: [`audit-ai-security.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-ai-security.md)

LLM-specific security audit covering prompt injection, data exfiltration, output sanitization, and jailbreak resistance.

---

### `/audit-secrets-management` - Secrets Management Audit
**File**: [`audit-secrets-management.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-secrets-management.md)

Credential handling audit covering secret storage, rotation procedures, exposure prevention, and CI/CD secrets handling.

---

### `/audit-enterprise-sso` - Enterprise SSO Audit
**File**: [`audit-enterprise-sso.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-enterprise-sso.md)

SSO implementation audit covering SAML 2.0, SCIM provisioning, MFA enforcement, and OIDC support for enterprise readiness.

---

## Code Quality Audits

### `/audit-code` - Code Quality Audit
**File**: [`audit-code.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-code.md)

Architecture and code quality review covering patterns, type safety, testing coverage, maintainability, and technical debt.

---

### `/audit-css-architecture` - CSS Architecture Audit
**File**: [`audit-css-architecture.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-css-architecture.md)

CSS codebase audit checking for single source of truth, specificity conflicts, dead CSS elimination, and design token usage.

---

### `/audit-test-coverage` - Test Coverage Audit
**File**: [`audit-test-coverage.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-test-coverage.md)

Testing strategy audit covering unit tests, integration tests, E2E tests, and mutation testing effectiveness.

---

### `/audit-documentation` - Documentation Audit
**File**: [`audit-documentation.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-documentation.md)

Documentation completeness audit for API docs, code comments, README files, and developer guides.

---

## Compliance & Legal Audits

### `/audit-legal-compliance` - Legal Compliance Audit
**File**: [`audit-legal-compliance.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-legal-compliance.md)

Legal compliance audit covering GDPR, CCPA, SOC 2 readiness, and AI-specific regulations.

---

### `/audit-data-portability` - Data Portability Audit
**File**: [`audit-data-portability.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-data-portability.md)

GDPR Article 20 compliance audit for export functionality, deletion verification, and migration capability.

---

### `/audit-data-architecture` - Data Architecture Audit
**File**: [`audit-data-architecture.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-data-architecture.md)

Database and data layer audit covering RLS policies, schema design, multi-tenant isolation, and query performance.

---

### `/audit-license` - License Audit
**File**: [`audit-license.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-license.md)

Open source license compliance audit for all dependencies.

---

### `/audit-vendor-risk` - Vendor Risk Audit
**File**: [`audit-vendor-risk.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-vendor-risk.md)

Third-party vendor risk assessment covering concentration risk, exit strategies, and SLA compliance.

---

## Infrastructure & DevOps Audits

### `/audit-performance` - Performance Audit
**File**: [`audit-performance.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-performance.md)

Performance audit covering Core Web Vitals (LCP, FID, CLS), bundle optimization, API latency, and perceived speed.

---

### `/audit-scalability` - Scalability Audit
**File**: [`audit-scalability.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-scalability.md)

Scale readiness audit covering load testing, database scaling, LLM rate limits, and 100x growth projections.

---

### `/audit-resilience` - Resilience Audit
**File**: [`audit-resilience.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-resilience.md)

System resilience audit covering error handling, observability, circuit breakers, and graceful degradation.

---

### `/audit-disaster-recovery` - Disaster Recovery Audit
**File**: [`audit-disaster-recovery.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-disaster-recovery.md)

DR readiness audit covering RTO/RPO targets, backup strategy, failover capability, and business continuity.

---

### `/audit-devops` - DevOps Audit
**File**: [`audit-devops.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-devops.md)

CI/CD pipeline and DevOps practices audit covering deployment automation, monitoring, and infrastructure as code.

---

### `/audit-infrastructure-cost` - Infrastructure Cost Audit
**File**: [`audit-infrastructure-cost.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-infrastructure-cost.md)

Cloud economics audit covering unit economics, cost optimization, scale projections, and total cost of ownership.

---

## AI-Specific Audits

### `/audit-llm-ops` - LLM Operations Audit
**File**: [`audit-llm-ops.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-llm-ops.md)

LLM operations audit covering token cost tracking, model pricing verification, prompt engineering quality, and circuit breaker reliability.

---

### `/audit-ai-ethics` - AI Ethics Audit
**File**: [`audit-ai-ethics.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-ai-ethics.md)

AI ethics compliance audit covering EU AI Act, bias detection, transparency requirements, and hallucination mitigation.

---

### `/audit-multitenancy` - Multi-tenancy Audit
**File**: [`audit-multitenancy.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-multitenancy.md)

Multi-tenant architecture audit covering tenant isolation, white-label capability, per-tenant configuration, and data segregation.

---

## Business & Product Audits

### `/audit-onboarding` - Onboarding Audit
**File**: [`audit-onboarding.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-onboarding.md)

First-time user experience audit covering the first 5 minutes, aha moment path, progressive disclosure, and sample data.

---

### `/audit-empty-states` - Empty States Audit
**File**: [`audit-empty-states.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-empty-states.md)

Empty state design audit covering first screens, call-to-action clarity, visual design, and no-results handling.

---

### `/audit-copywriting` - Copywriting Audit
**File**: [`audit-copywriting.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-copywriting.md)

Microcopy and voice audit covering every word in the UI, error messages, button labels, and tone consistency.

---

### `/audit-power-user` - Power User Audit
**File**: [`audit-power-user.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-power-user.md)

Power user features audit covering keyboard shortcuts, bulk operations, advanced search, and context menus.

---

### `/audit-emotional-journey` - Emotional Journey Audit
**File**: [`audit-emotional-journey.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-emotional-journey.md)

User emotional journey audit covering feelings at each touchpoint, trust signals, success celebrations, and error recovery.

---

### `/audit-delight` - Delight & Micro-interactions Audit
**File**: [`audit-delight.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-delight.md)

Micro-interaction audit covering animation quality, loading states, success celebrations, and dark mode excellence.

---

### `/audit-competitive` - Competitive Analysis Audit
**File**: [`audit-competitive.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-competitive.md)

Competitive positioning analysis against similar products in the market.

---

### `/audit-billing-economics` - Billing & Economics Audit
**File**: [`audit-billing-economics.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-billing-economics.md)

Billing integration audit covering Stripe setup, revenue protection, abuse prevention, and subscription management.

---

### `/audit-seo` - SEO Audit
**File**: [`audit-seo.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-seo.md)

Search engine optimization audit covering meta tags, structured data, performance, and crawlability.

---

### `/audit-i18n` - Internationalization Audit
**File**: [`audit-i18n.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-i18n.md)

Internationalization readiness audit covering translation completeness, locale handling, and RTL support.

---

### `/audit-api-governance` - API Governance Audit
**File**: [`audit-api-governance.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-api-governance.md)

API design audit covering versioning strategy, response consistency, documentation, and rate limiting.

---

### `/audit-dashboard` - Dashboard Audit
**File**: [`audit-dashboard.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-dashboard.md)

Dashboard UX audit covering data visualization, KPI display, and actionable insights.

---

### `/audit-analytics` - Analytics Audit
**File**: [`audit-analytics.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-analytics.md)

Product analytics implementation audit covering event tracking, user behavior, and data quality.

---

## Comprehensive Audit

### `/audit-full` - Full $25M Due Diligence Audit
**File**: [`audit-full.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/audit-full.md)

Complete due diligence review combining all specialized audits for institutional investment evaluation. Benchmarked against Stripe, Linear, Notion, and Revolut standards.

**Sections**:
- **Part A**: Masterpiece Experience (Delight, Onboarding, Empty States, Copywriting, Power User, Emotional Journey)
- **Part B**: Core Product Quality (Security, Attack Simulation, UI, UX, Mobile, Code, Accessibility, Performance, CSS, LLM Ops, Data, Billing, Resilience, API)
- **Part C**: Enterprise & Compliance (Infrastructure Cost, Vendor Risk, Data Portability, Secrets, Tests, SSO, Legal, DR)
- **Part D**: AI-Specific (AI Security, AI Ethics)
- **Part E**: Growth & Scale (Scalability, Multi-tenancy)

**Output**:
- Investment Readiness Score (1-10)
- Risk Assessment Matrix
- 30-Day Priority Roadmap
- Technical Debt Inventory
- Final Investment Recommendation

---

## Utility Commands

### `/qa` - Pre-Push Quality Check
**File**: [`qa.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/qa.md)

Comprehensive pre-push quality check running the same validations as CI locally. Catches errors before GitHub CI fails.

**Phases**:
1. **Changed Files Inventory** - Risk categorization
2. **Static Analysis** - ESLint, Stylelint, TypeScript, Prettier, tests, build
3. **Critical Manual Checks** - Gatekeepers, breaking changes, migrations, API contracts, observability
4. **Security Quick Scan** - Secrets, SQL injection, XSS
5. **Pre-Push Checklist** - Documentation, commit quality, git sanity

**Time**: 7-12 minutes

---

### `/restart` - Restart Development Servers
**File**: [`restart.md`](https://github.com/BuDozKeN/AI-council/blob/master/.claude/commands/restart.md)

Quick utility to restart frontend (port 5173) and backend (port 8081) development servers without confirmation prompts.

---

## Usage

To run any command in Claude Code, simply type the command name:

```
/audit-ux
/audit-security
/audit-mobile
/qa
```

Commands can be combined for focused reviews:

```
# Before a release
/audit-full

# For UX improvements
/audit-ux
/audit-mobile
/audit-a11y

# For security hardening
/audit-security
/audit-attack
/audit-ai-security
```

---

## Quality Standards

All audits benchmark against these standards:

| Area | Target | Standard |
|------|--------|----------|
| Security | SOC 2 Type II ready | Banking/Fintech grade |
| Performance | LCP <2.5s, FID <100ms, CLS <0.1 | Core Web Vitals |
| Accessibility | WCAG 2.1 AA | Legal compliance |
| Code Coverage | 80%+ | Enterprise standard |
| UX | "Mum Test" pass | Intuitive for all users |
| Visual | Stripe/Linear quality | Premium SaaS standard |

---

## Contributing

Commands are defined as Markdown files in `.claude/commands/`. To add a new audit:

1. Create a new `.md` file in `.claude/commands/`
2. Follow the existing format with clear sections
3. Include output format specification
4. Add to this catalog

---

*Last updated: January 2026*
