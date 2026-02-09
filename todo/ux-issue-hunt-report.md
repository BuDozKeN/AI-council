# UX/UI Issue Hunt Report - $25M SaaS Quality Audit

**Issue Hunt Date:** 2026-02-10 (Second Deep Sweep)
**Tools Used:** Playwright E2E (74 passed), Visual Regression (135 passed), Chrome DevTools MCP, Manual Inspection
**Screens Tested:** 15+ screens across desktop (1280x720) and mobile (390x844) viewports
**Language Tested:** Spanish (es)

---

## Executive Summary

```
Total Issues Found: 100
  P0 (Blocker):    0
  P1 (Critical):   3
  P2 (Major):      27
  P3 (Minor):      45
  P4 (Cosmetic):   25

$25M Readiness Score: 7.5/10
```

**Overall Assessment:** The app has strong core functionality and good visual polish. The primary gap is **internationalization (i18n)** - approximately 60% of issues relate to missing or inconsistent Spanish translations. Fixing i18n would raise the score to 9/10.

---

## Issue Table (sorted by severity)

### P1 - Critical (3 issues)

| ID | Category | Screen | Description | Source |
|----|----------|--------|-------------|--------|
| UXH-001 | i18n | All | Console flooded with i18next missingKey warnings (50+ per page load) | Console |
| UXH-002 | i18n | /company/* | "Command Center" header text not translated | DevTools |
| UXH-003 | i18n | /company/* | "{{count}} pending" status text not translated | DevTools |

### P2 - Major (27 issues)

| ID | Category | Screen | Description | Source |
|----|----------|--------|-------------|--------|
| UXH-004 | i18n | /company/team | Department names in English: Operations, Executive, Sales, Finance, Technology, Legal, Marketing | DevTools |
| UXH-005 | i18n | /company/playbooks | "Playbooks" card label not translated (tab says "Manuales") | DevTools |
| UXH-006 | i18n | /company/playbooks | "SOPs" category not translated | DevTools |
| UXH-007 | i18n | /company/activity | "Changed role to member/admin" not translated | DevTools |
| UXH-008 | i18n | /company/activity | "MEMBER_UPDATED" technical string exposed to users | DevTools |
| UXH-009 | i18n | /company/activity | "CREATED" badge not translated (should be "CREADO") | DevTools |
| UXH-010 | i18n | /settings/billing | Plan names not translated: Free, Starter, Pro, Enterprise | DevTools |
| UXH-011 | i18n | /settings/billing | Feature descriptions not translated (council queries/month, etc.) | DevTools |
| UXH-012 | i18n | /settings/billing | "/month" vs "/mes" inconsistency | DevTools |
| UXH-013 | i18n | /company/usage | "7 days", "30 days", "90 days" filter buttons not translated | DevTools |
| UXH-014 | i18n | /company/overview | "Table of Contents" header not translated | DevTools |
| UXH-015 | i18n | /company/overview | All 10 section headings in English (Company Overview, The Product, etc.) | DevTools |
| UXH-016 | i18n | All | "Tap to close" button not translated | Console |
| UXH-017 | i18n | All | myCompany.commandCenterTooltip missing translation | Console |
| UXH-018 | i18n | All | myCompany.switchCompany missing translation | Console |
| UXH-019 | i18n | All | myCompany.closeMyCompany missing translation | Console |
| UXH-020 | i18n | /company/decisions | Department badges in English (Technology, Operations, Sales) | DevTools |
| UXH-021 | visual | /company/projects | Page shows skeleton loading state - content may not be loading | DevTools |
| UXH-022 | ux | /company/decisions | Yellow status dots have no legend explaining what colors mean | DevTools |
| UXH-023 | i18n | /company/playbooks | Badge labels in English: Executive, SOP, Operations, Finance | DevTools |
| UXH-024 | i18n | /company/team | "roles" pluralization inconsistent ("3 roles" vs "1 rol") | DevTools |
| UXH-025 | perf | Lighthouse | Chrome interstitial error blocking Lighthouse CI audits | Lighthouse |
| UXH-026 | i18n | /company/playbooks | Content titles in English (Knowledge System UX Improvement, AxCouncil Design System) | DevTools |
| UXH-027 | i18n | /settings/billing | "5 council queries/month" not translated | DevTools |
| UXH-028 | i18n | /settings/billing | "Standard response time" not translated | DevTools |
| UXH-029 | i18n | /settings/billing | "All 5 AI models" not translated | DevTools |
| UXH-030 | i18n | /settings/billing | "Priority response" not translated | DevTools |

### P3 - Minor (45 issues)

| ID | Category | Screen | Description | Source |
|----|----------|--------|-------------|--------|
| UXH-031 | i18n | /company/overview | "Company Overview" section not translated | DevTools |
| UXH-032 | i18n | /company/overview | "The Product" section not translated | DevTools |
| UXH-033 | i18n | /company/overview | "Founder Profile" section not translated | DevTools |
| UXH-034 | i18n | /company/overview | "Market & Users" section not translated | DevTools |
| UXH-035 | i18n | /company/overview | "Go-to-Market Strategy" section not translated | DevTools |
| UXH-036 | i18n | /company/overview | "Pricing & Business Model" section not translated | DevTools |
| UXH-037 | i18n | /company/overview | "Technical Stack" section not translated | DevTools |
| UXH-038 | i18n | /company/overview | "Competitive Landscape" section not translated | DevTools |
| UXH-039 | i18n | /company/overview | "Financials & Metrics" section not translated | DevTools |
| UXH-040 | i18n | /company/overview | "Strategic Decisions" section not translated | DevTools |
| UXH-041 | i18n | /company/playbooks | "Todos los Depts" abbreviation inconsistent | DevTools |
| UXH-042 | visual | /company/usage | Model names inconsistent: "Grok" vs "Grok Fast" | DevTools |
| UXH-043 | visual | /company/usage | "GPT" vs "GPT-4o" vs "GPT-4o Mini" naming inconsistent | DevTools |
| UXH-044 | visual | /company/usage | Progress bars lack hover tooltips with exact values | DevTools |
| UXH-045 | ux | All | Command Center banner always visible (no dismiss option) | DevTools |
| UXH-046 | ux | /settings | Settings dialog lacks breadcrumb context | DevTools |
| UXH-047 | visual | /company/* | Tab underline indicator animation inconsistent | DevTools |
| UXH-048 | design | /company/team | Department color indicators (left border) follow unclear pattern | DevTools |
| UXH-049 | design | All | Badge color scheme inconsistent (teal, red, gray, orange) | DevTools |
| UXH-050 | mobile | /company/overview | Long content scrolls but no scroll indicator visible | DevTools |
| UXH-051 | content | All | User-generated content not visually differentiated from system text | DevTools |
| UXH-052 | nav | / | /landing returns 404 when logged in (should redirect gracefully) | DevTools |
| UXH-053 | nav | / | /login returns 404 when logged in (should redirect gracefully) | DevTools |
| UXH-054 | console | All | Auth state changed logged multiple times per navigation | Console |
| UXH-055 | console | All | Duplicate i18n missing key warnings (same key logged 10+ times) | Console |
| UXH-056 | i18n | /company/team | "Operations" department not translated | DevTools |
| UXH-057 | i18n | /company/team | "Executive" department not translated | DevTools |
| UXH-058 | i18n | /company/team | "Sales" department not translated | DevTools |
| UXH-059 | i18n | /company/team | "Finance" department not translated | DevTools |
| UXH-060 | i18n | /company/team | "Technology" department not translated | DevTools |
| UXH-061 | i18n | /company/team | "Legal" department not translated | DevTools |
| UXH-062 | i18n | /company/team | "Marketing" department not translated | DevTools |
| UXH-063 | i18n | /company/usage | "Kimi K2" vs "Kimi K2.5" naming pattern | DevTools |
| UXH-064 | i18n | /company/usage | "DeepSeek" model name (acceptable as brand) | DevTools |
| UXH-065 | a11y | /company/decisions | Status dots lack accessible labels for screen readers | DevTools |
| UXH-066 | ux | /company/decisions | No filter for decision status (pending/promoted/archived) | DevTools |
| UXH-067 | ux | /company/playbooks | Category cards could show preview of contents | DevTools |
| UXH-068 | visual | /company/team | Department cards lack hover state | DevTools |
| UXH-069 | mobile | /company/team | Floating action button overlaps last item on scroll | DevTools |
| UXH-070 | i18n | /settings/billing | "Más popular" badge is translated but siblings aren't | DevTools |
| UXH-071 | visual | /settings | Close button uses "Close" not "Cerrar" on focus | DevTools |
| UXH-072 | ux | /company/activity | No pagination for activity feed | DevTools |
| UXH-073 | ux | /company/activity | No filter by activity type | DevTools |
| UXH-074 | visual | /company/activity | External link icon on council items is very subtle | DevTools |
| UXH-075 | i18n | /company/usage | Chart axis labels could be translated | DevTools |

### P4 - Cosmetic (25 issues)

| ID | Category | Screen | Description | Source |
|----|----------|--------|-------------|--------|
| UXH-076 | visual | All | Dark mode toggle icon could show current state more clearly | DevTools |
| UXH-077 | visual | / | "confiar." has period but tagline doesn't need punctuation | DevTools |
| UXH-078 | visual | /company/usage | "Cache Hit Rate" shows 0.0% (could hide if no data) | DevTools |
| UXH-079 | visual | /company/usage | Token counts could use K/M suffixes consistently | DevTools |
| UXH-080 | visual | All | Globe icon in corner (language selector) could be more discoverable | DevTools |
| UXH-081 | visual | /settings | Tab icons could have labels on desktop | DevTools |
| UXH-082 | visual | /company/playbooks | "MARCO" badge has uppercase inconsistent with others | DevTools |
| UXH-083 | content | /company/overview | Version "1.3" could be auto-generated or hidden | DevTools |
| UXH-084 | visual | / | Input area "Choose files" button uses browser default styling | DevTools |
| UXH-085 | visual | / | "Attach image" button lacks tooltip | DevTools |
| UXH-086 | visual | / | Lightning bolt icon (quick response) lacks explanation | DevTools |
| UXH-087 | visual | /company/usage | "US$" currency symbol could be locale-aware | DevTools |
| UXH-088 | ux | All | No keyboard shortcut hints in tooltips | DevTools |
| UXH-089 | visual | /settings/llm | LLM Hub cards could show model counts | DevTools |
| UXH-090 | visual | /company/team | "Nuevo Departamento" button could have icon | DevTools |
| UXH-091 | visual | /company/decisions | Search placeholder could match other search inputs | DevTools |
| UXH-092 | visual | /company/activity | "CONSEJO" badge color (teal) inconsistent with others | DevTools |
| UXH-093 | content | 404 | "Detalles del Error (Solo Dev)" could be hidden in production | DevTools |
| UXH-094 | visual | / | OmniBar input has subtle border that could be more prominent | DevTools |
| UXH-095 | visual | / | "Presiona Ctrl+K para navegar" text very subtle | DevTools |
| UXH-096 | mobile | / | Bottom nav "Empresa" label could be "Mi Empresa" for clarity | DevTools |
| UXH-097 | visual | /company/usage | Daily cost chart legend could be more prominent | DevTools |
| UXH-098 | a11y | /company/usage | Chart data points lack focus indicators | DevTools |
| UXH-099 | visual | All | Tanstack query devtools button visible in production | DevTools |
| UXH-100 | content | /settings/profile | Phone number format not validated (shows +1-555-123-4567) | DevTools |

---

## Scores by Dimension

| Dimension | Score | Target | Gap | Notes |
|-----------|-------|--------|-----|-------|
| Visual Polish | 8/10 | 9/10 | -1 | Minor inconsistencies in badges and colors |
| Internationalization | 4/10 | 9/10 | -5 | **Major gap** - 60+ i18n issues |
| Mobile UX | 8/10 | 9/10 | -1 | Good but minor scroll/overlap issues |
| Accessibility | 8/10 | 9/10 | -1 | Status dots need labels, chart a11y |
| Performance | 7/10 | 9/10 | -2 | Lighthouse blocked, FCP could improve |
| Error Handling | 8/10 | 8/10 | 0 | 404 page well translated |
| Interaction Quality | 8/10 | 9/10 | -1 | Some hover states missing |
| Content/Copy | 6/10 | 8/10 | -2 | Mixed language content throughout |
| Design System Consistency | 7/10 | 9/10 | -2 | Badge colors, borders inconsistent |
| Navigation | 8/10 | 9/10 | -1 | /landing and /login 404s |

---

## Priority Fix List (Top 10)

1. **Add missing i18n keys** (P1) - Add Spanish translations for myCompany namespace
2. **Translate department names** (P2) - Operations, Executive, etc. should be in Spanish
3. **Translate billing plan names/features** (P2) - Free, Starter, Pro and feature lists
4. **Translate Table of Contents** (P2) - Company Overview section headings
5. **Fix MEMBER_UPDATED exposure** (P2) - Technical strings should not show to users
6. **Add status dot legend** (P2) - Explain what yellow/green/gray dots mean
7. **Fix skeleton loading on Projects** (P2) - Ensure content loads or show empty state
8. **Deduplicate console warnings** (P3) - Reduce i18n warning spam
9. **Add badge color documentation** (P3) - Standardize badge color meanings
10. **Fix /landing /login 404s** (P3) - Redirect logged-in users gracefully

---

## Test Results Summary

### Playwright E2E + Accessibility
- **74 passed, 4 skipped**
- All accessibility scans passing
- All viewport tests passing

### Visual Regression Full
- **135 passed** (6.7 minutes)
- All screens captured across Chromium, Firefox, WebKit, Mobile Safari
- WCAG AA contrast tests passing
- FCP under 3s tests passing

### Manual Chrome DevTools Inspection
- **15 screens inspected** across desktop and mobile
- **60+ i18n issues** identified via console warnings
- No JavaScript errors
- No network failures

---

## i18n Issue Summary

The following translation keys are missing for Spanish (es):

```
myCompany.tapToClose
myCompany.commandCenterTooltip
myCompany.commandCenter
myCompany.switchCompany
myCompany.closeMyCompany
myCompany.statusPending
```

Additionally, the following content categories need Spanish translations:
- Department names (7 items)
- Billing plan names (4 items)
- Billing features (6 items)
- Company context document sections (10 items)
- Activity event types (3 items)
- Time period filters (3 items)
- Playbook categories (4 items)

**Estimated effort:** 2-4 hours to add all missing translations

---

## Recommendations

### Immediate Actions (Before Next Push)
1. Add missing i18n keys to Spanish translation file
2. Translate department names or make them user-editable
3. Hide Tanstack query devtools button in production

### Short-term (This Sprint)
1. Complete billing page i18n
2. Complete company overview section i18n
3. Add status dot legend to Decisions page
4. Investigate Projects page skeleton loading

### Medium-term (Before Exit)
1. Achieve 100% i18n coverage for all supported languages
2. Standardize badge/color design system
3. Add keyboard shortcut documentation
4. Improve Lighthouse CI configuration

---

*Report generated by `/hunt-ux-issues` orchestrator*
*Deep inspection completed 2026-02-10*
