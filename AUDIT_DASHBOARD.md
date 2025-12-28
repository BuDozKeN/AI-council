# AxCouncil Audit Dashboard

> Last Updated: [Not yet run]
> Last Audit: [None]
> Branch: master

---

## Executive Summary

### Overall Health: --/10

| Category | Score | Trend | Critical | High | Medium | Last Checked |
|----------|-------|-------|----------|------|--------|--------------|
| Security | --/10 | -- | -- | -- | -- | -- |
| Code Quality | --/10 | -- | -- | -- | -- | -- |
| UI/UX | --/10 | -- | -- | -- | -- | -- |
| Performance | --/10 | -- | -- | -- | -- | -- |
| Accessibility | --/10 | -- | -- | -- | -- | -- |
| Mobile | --/10 | -- | -- | -- | -- | -- |
| LLM Operations | --/10 | -- | -- | -- | -- | -- |
| Data Architecture | --/10 | -- | -- | -- | -- | -- |
| Billing | --/10 | -- | -- | -- | -- | -- |
| Resilience | --/10 | -- | -- | -- | -- | -- |
| API Governance | --/10 | -- | -- | -- | -- | -- |

### Key Metrics
- **Total Findings**: --
- **Fixed Since Last Run**: --
- **New This Run**: --
- **$25M Readiness**: [Run /audit-dashboard to assess]

---

## Score History

| Date | Scope | Overall | Sec | Code | UI | Perf | A11y | Mobile | LLM | Data | Bill | Resil | API |
|------|-------|---------|-----|------|-----|------|------|--------|-----|------|------|-------|-----|
| -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- | -- |

---

## Critical Issues (Fix Immediately)

> Run `/audit-dashboard` to populate findings.

No audit has been run yet.

---

## High Priority (This Sprint)

> Run `/audit-dashboard` to populate findings.

---

## Medium Priority (Next Sprint)

> Run `/audit-dashboard` to populate findings.

---

## Low Priority (Backlog)

> Run `/audit-dashboard` to populate findings.

---

## Category Deep Dives

<details>
<summary>Security (--/10) - Not yet audited</summary>

Run `/audit-dashboard security` to populate.

</details>

<details>
<summary>Code Quality (--/10) - Not yet audited</summary>

Run `/audit-dashboard code` to populate.

</details>

<details>
<summary>UI/UX (--/10) - Not yet audited</summary>

Run `/audit-dashboard ui ux` to populate.

</details>

<details>
<summary>Performance (--/10) - Not yet audited</summary>

Run `/audit-dashboard perf` to populate.

</details>

<details>
<summary>Accessibility (--/10) - Not yet audited</summary>

Run `/audit-dashboard a11y` to populate.

</details>

<details>
<summary>Mobile (--/10) - Not yet audited</summary>

Run `/audit-dashboard mobile` to populate.

</details>

<details>
<summary>LLM Operations (--/10) - Not yet audited</summary>

Run `/audit-dashboard llm-ops` to populate.

</details>

<details>
<summary>Data Architecture (--/10) - Not yet audited</summary>

Run `/audit-dashboard data` to populate.

</details>

<details>
<summary>Billing (--/10) - Not yet audited</summary>

Run `/audit-dashboard billing` to populate.

</details>

<details>
<summary>Resilience (--/10) - Not yet audited</summary>

Run `/audit-dashboard resilience` to populate.

</details>

<details>
<summary>API Governance (--/10) - Not yet audited</summary>

Run `/audit-dashboard api` to populate.

</details>

---

## How to Use This Dashboard

### Running Audits (Selective)

```
/audit-dashboard                    # Full audit (all categories)
/audit-dashboard security           # Security only
/audit-dashboard security code      # Security + Code quality
/audit-dashboard llm-ops billing    # LLM + Billing only
```

### Available Categories

| Shorthand | What It Checks |
|-----------|----------------|
| `security` | OWASP, auth, data protection |
| `attack` | Penetration testing |
| `code` | TypeScript/Python patterns |
| `ui` | Visual design, design system |
| `ux` | User experience, mum test |
| `mobile` | PWA, responsive, touch |
| `a11y` | WCAG 2.1 AA |
| `perf` | Core Web Vitals, bundle |
| `llm-ops` | Token costs, models |
| `data` | RLS, schema, multi-tenancy |
| `billing` | Revenue, Stripe, abuse |
| `resilience` | Error handling, observability |
| `api` | Versioning, consistency |

### Fixing Issues

1. **Click** any `file:line` link → VS Code opens the file at that line
2. **Review** the code at that location
3. **Tell Claude**: "Fix this issue" (Claude can see the code)
4. **Verify**: Run `/audit-dashboard [category]` again - score updates, finding disappears

### Recommended Schedule

| When | Command | Why |
|------|---------|-----|
| Monday | `/audit-dashboard` | Full weekly audit |
| After security PR | `/audit-dashboard security` | Verify no regressions |
| After refactoring | `/audit-dashboard code perf` | Check quality + performance |
| After migrations | `/audit-dashboard data` | Verify RLS + schema |
| After prompt changes | `/audit-dashboard llm-ops` | Check costs + reliability |
| Before board meeting | `/audit-dashboard` | Full refresh for presentation |

---

## Standards

All audits measure against $25M / Silicon Valley standards:
- **Security**: OWASP Top 10, SOC 2 readiness
- **Code**: Enterprise TypeScript/Python patterns
- **UI/UX**: Stripe, Linear, Notion, Revolut level polish
- **Performance**: Core Web Vitals green scores
- **Accessibility**: WCAG 2.1 Level AA
- **Mobile**: Native-quality PWA experience

**Target**: Every category ≥8/10 for investment readiness.
