# Audit Dashboard - Executive & Developer Command Center

You are running the AxCouncil audit dashboard. This command supports **selective audits** - run all or just the ones you need.

## Usage

```
/audit-dashboard                          # Full audit (all categories)
/audit-dashboard security                 # Security only
/audit-dashboard security code            # Security + Code quality
/audit-dashboard llm-ops billing data     # LLM + Billing + Data architecture
```

## Available Audit Categories (28 Total)

### Core Product Quality (13)
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `security` | Security | OWASP, auth, data protection |
| `attack` | Attack Simulation | Penetration testing |
| `code` | Code Quality | TypeScript/Python patterns |
| `ui` | UI Excellence | Visual design, design system |
| `ux` | UX Quality | User experience, mum test |
| `mobile` | Mobile | PWA, responsive, touch |
| `a11y` | Accessibility | WCAG 2.1 AA |
| `perf` | Performance | Core Web Vitals, bundle |
| `llm-ops` | LLM Operations | Token costs, models, **pricing verification** |
| `data` | Data Architecture | RLS, schema, multi-tenancy |
| `billing` | Billing Economics | Revenue, Stripe, abuse |
| `resilience` | Resilience | Error handling, observability |
| `api` | API Governance | Versioning, consistency |

### Enterprise & Compliance (5)
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `legal` | Legal & Compliance | GDPR, CCPA, SOC 2, HIPAA readiness |
| `license` | Open Source License | License compliance, SBOM, IP risk |
| `sso` | Enterprise SSO | SAML, OIDC, SCIM, MFA |
| `dr` | Disaster Recovery | RTO/RPO, backups, business continuity |
| `multitenancy` | Multi-Tenancy | White-label, tenant isolation |

### AI-Specific (2)
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `ai-security` | AI Prompt Injection | LLM attack vectors, data exfil |
| `ai-ethics` | AI Quality & Ethics | Hallucination, bias, EU AI Act |

### Engineering Excellence (3)
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `tests` | Test Coverage | Unit, integration, E2E, mutation |
| `devops` | DevOps/CI-CD | DORA metrics, deployment velocity |
| `docs` | Documentation | API docs, user guides, runbooks |

### Growth & Market (5)
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `i18n` | Internationalization | Translation, RTL, locale handling |
| `scale` | Scalability | Load testing, 10x/100x readiness |
| `analytics` | Analytics | Event tracking, funnels, metrics |
| `seo` | SEO | Meta tags, Core Web Vitals, structured data |
| `competitive` | Competitive Intel | Feature parity, differentiation |

### Meta
| Shorthand | Full Name | What It Checks |
|-----------|-----------|----------------|
| `all` | Full Audit | All 28 categories |

## Your Mission

Based on the categories specified (or all if none specified):

1. **Run ONLY the specified audits**
2. **Update ONLY those sections** in `AUDIT_DASHBOARD.md`
3. **Preserve other sections** from previous runs (don't blank them out)
4. **Recalculate overall score** based on all current section scores
5. **Update timestamp** to reflect this partial run

## Execution Rules

### If specific categories provided:
```
/audit-dashboard security code
```
1. Run security audit → Update Security row + Security deep dive
2. Run code audit → Update Code Quality row + Code deep dive
3. Keep all other rows (UI, Mobile, etc.) unchanged from previous run
4. Recalculate overall score from all rows
5. Add/update findings only for security and code
6. Preserve findings from other categories

### If no categories (full run):
```
/audit-dashboard
```
1. Run ALL audits
2. Update ALL sections
3. Fresh findings list
4. Complete score recalculation

## Reading Existing Dashboard

Before updating, READ the existing `AUDIT_DASHBOARD.md` to:
1. Get previous scores for unchanged categories
2. Get previous findings for unchanged categories
3. Get score history table
4. Preserve any manually added notes

## Output Format

Update `AUDIT_DASHBOARD.md` in the repository root:

```markdown
# AxCouncil Audit Dashboard

> Last Updated: [YYYY-MM-DD HH:MM UTC]
> Last Audit: [Categories that were run, e.g., "security, code" or "full"]
> Branch: [current branch]

---

## Executive Summary

### Overall Health: [X/10] [↑/↓/→ change]

| Category | Score | Trend | Critical | High | Medium | Last Checked |
|----------|-------|-------|----------|------|--------|--------------|
| Security | X/10 | ↑/↓/→ | N | N | N | [date] |
| Code Quality | X/10 | ↑/↓/→ | N | N | N | [date] |
| UI/UX | X/10 | ↑/↓/→ | N | N | N | [date] |
| Performance | X/10 | ↑/↓/→ | N | N | N | [date] |
| Accessibility | X/10 | ↑/↓/→ | N | N | N | [date] |
| Mobile | X/10 | ↑/↓/→ | N | N | N | [date] |
| LLM Operations | X/10 | ↑/↓/→ | N | N | N | [date] | <!-- Includes pricing verification -->
| Data Architecture | X/10 | ↑/↓/→ | N | N | N | [date] |
| Billing | X/10 | ↑/↓/→ | N | N | N | [date] |
| Resilience | X/10 | ↑/↓/→ | N | N | N | [date] |
| API Governance | X/10 | ↑/↓/→ | N | N | N | [date] |

> Categories not run in this audit retain their previous scores and "Last Checked" dates.

### Key Metrics
- **Total Findings**: N (Critical: N, High: N, Medium: N, Low: N)
- **Fixed Since Last Run**: N
- **New This Run**: N
- **$25M Readiness**: [Ready / Near Ready / Needs Work / Critical Gaps]

---

## Score History

| Date | Audit Scope | Overall | Sec | Code | UI | Perf | A11y | Mobile | LLM | Data | Bill | Resil | API |
|------|-------------|---------|-----|------|-----|------|------|--------|-----|------|------|-------|-----|
| [DATE] | [scope] | X.X | X | X | X | X | X | X | X | X | X | X | X |

---

## Critical Issues (Fix Immediately)

> These block $25M readiness. Address within 24-48 hours.

### [ISSUE-001] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:123`
- **Impact**: [Business impact]
- **Risk**: [What happens if not fixed]
- **Found**: [Date first found]
- **Status**: [Open / In Progress / Fixed]

---

## High Priority (This Sprint)

### [ISSUE-002] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:456`
- **Impact**: [Description]
- **Found**: [Date]
- **Status**: [Open / In Progress]

---

## Medium Priority (Next Sprint)

### [ISSUE-003] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:789`
- **Impact**: [Description]
- **Status**: [Open]

---

## Low Priority (Backlog)

- [Category] [Brief description] - `file:line`

---

## Category Deep Dives

<details>
<summary>Security (X/10) - Last checked: [date]</summary>

### Findings
1. [Finding] - `file:line`

### Recommendations
- [Recommendation]

</details>

<details>
<summary>Code Quality (X/10) - Last checked: [date]</summary>

### Findings
1. [Finding] - `file:line`

</details>

[Continue for all categories - preserve unchanged ones from previous run]

---

## Quick Reference

### Run Specific Audits
```
/audit-dashboard security           # After security changes
/audit-dashboard code perf          # After refactoring
/audit-dashboard llm-ops            # After prompt changes
/audit-dashboard data               # After migrations
/audit-dashboard                    # Full weekly audit
```

### Fix Issues
1. Click `file:line` → Opens in VS Code
2. Tell Claude "fix this issue"
3. Run `/audit-dashboard [category]` to verify

---

## Audit Standards

All audits measure against $25M / Silicon Valley standards:
- **Security**: OWASP Top 10, SOC 2 readiness
- **Code**: Enterprise patterns, strict TypeScript
- **UI/UX**: Stripe, Linear, Notion, Revolut level
- **Performance**: Core Web Vitals green
- **Accessibility**: WCAG 2.1 Level AA

**Target**: Every category ≥8/10 for investment readiness.
```

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 10/10 | Exceptional, exceeds standards |
| 8-9/10 | Production ready, minor issues |
| 6-7/10 | Needs attention, some high-priority issues |
| 4-5/10 | Significant risk, critical issues present |
| 1-3/10 | Major problems, not production ready |

## Priority Classification

| Priority | Criteria | Response Time |
|----------|----------|---------------|
| Critical | Security vulnerabilities, data leaks, revenue loss | 24-48 hours |
| High | User-facing bugs, performance, compliance | This sprint |
| Medium | Code quality, maintainability, minor UX | Next sprint |
| Low | Polish, optimization, nice-to-haves | Backlog |

## Files to Analyze Per Category

### Core Product Quality

#### security
- `backend/auth.py`, `backend/security.py`
- `backend/routers/*.py` (auth checks)
- `supabase/migrations/*` (RLS policies)

#### code
- `frontend/src/**/*.ts{x}` (TypeScript)
- `backend/**/*.py` (Python)
- Config files

#### ui, ux
- `frontend/src/components/**`
- `frontend/src/styles/**`

#### perf
- `frontend/vite.config.js`
- Bundle analysis
- API response times

#### mobile
- Responsive styles
- Touch targets
- PWA config

#### a11y
- Component ARIA
- Keyboard navigation
- Color contrast

#### llm-ops
- `backend/council.py`
- `backend/openrouter.py`
- `backend/model_registry.py`
- `backend/routers/company/utils.py` - **Verify pricing tables online**
- `frontend/src/components/stage3/Stage3Content.tsx` - **Verify pricing matches backend**
- **REQUIRED**: Use WebSearch to verify all model pricing against OpenRouter/official docs

#### data
- `supabase/migrations/**`
- `backend/database.py`
- RLS policies

#### billing
- `backend/routers/billing.py`
- Stripe integration

#### resilience
- Error handling patterns
- Circuit breakers
- Health checks

#### api
- `backend/routers/**`
- Response formats
- Versioning

### Enterprise & Compliance

#### legal
- Privacy Policy, Terms of Service
- Cookie consent implementation
- Data processing documentation
- Compliance certifications

#### license
- `package.json`, `package-lock.json`
- `requirements.txt`, `pyproject.toml`
- NOTICE files, license attributions

#### sso
- `backend/auth.py` - Auth flows
- Supabase Auth configuration
- SSO/SAML/OIDC endpoints (if any)

#### dr
- Backup configurations
- Recovery runbooks
- Incident response plan

#### multitenancy
- `supabase/migrations/*` (RLS policies)
- `backend/database.py` - Tenant context
- Branding/customization capabilities

### AI-Specific

#### ai-security
- `backend/council.py` - Prompt construction
- `backend/context_loader.py` - Context injection
- System prompts - Injection protection

#### ai-ethics
- AI output quality metrics
- Bias testing scenarios
- Transparency/disclosure in UI

### Engineering Excellence

#### tests
- `frontend/vitest.config.ts`
- `backend/tests/**`
- Test coverage reports

#### devops
- `.github/workflows/**`
- `render.yaml`, `vercel.json`
- Deployment scripts

#### docs
- `README.md`, `CLAUDE.md`
- API documentation (`/api/docs`)
- User guides, runbooks

### Growth & Market

#### i18n
- All `frontend/src/components/**/*.tsx` for hardcoded strings
- Locale configuration files
- Translation infrastructure

#### scale
- Database query performance
- Load testing results
- Capacity planning docs

#### analytics
- Event tracking implementation
- Analytics tool configuration
- Dashboard definitions

#### seo
- `frontend/index.html` - Meta tags
- `frontend/public/` - robots.txt, sitemap
- Schema.org structured data

#### competitive
- Product comparison analysis
- Feature matrix
- Market positioning

## Important Rules

1. **Always read existing dashboard first** - Preserve unchanged sections
2. **Every finding needs file:line** - Must be clickable in VS Code
3. **Update "Last Checked" date** - Only for categories you ran
4. **Preserve score history** - Append new row, keep last 10
5. **Be honest** - Don't inflate scores
6. **LLM-ops requires WebSearch** - Always verify model pricing online before reporting

---

Remember: Selective audits let you iterate fast. Full audits ensure nothing is missed. Use both strategically.
