# Audit Dashboard - Executive & Developer Command Center

You are running a comprehensive audit suite for AxCouncil. This command produces a single, actionable dashboard that serves both the board of directors and the development team.

## Your Mission

1. Run all relevant audits (or specified subset)
2. Produce `AUDIT_DASHBOARD.md` with executive summary + actionable findings
3. Track historical scores for trend analysis
4. Output clickable file:line references for VS Code

## Output Format

Generate `AUDIT_DASHBOARD.md` in the repository root with this EXACT structure:

```markdown
# AxCouncil Audit Dashboard

> Last Updated: [YYYY-MM-DD HH:MM UTC]
> Auditor: Claude Code
> Branch: [current branch]

---

## Executive Summary

### Overall Health: [X/10] [↑/↓/→ change from last run]

| Category | Score | Trend | Critical | High | Medium |
|----------|-------|-------|----------|------|--------|
| Security | X/10 | ↑/↓/→ | N | N | N |
| Code Quality | X/10 | ↑/↓/→ | N | N | N |
| UI/UX | X/10 | ↑/↓/→ | N | N | N |
| Performance | X/10 | ↑/↓/→ | N | N | N |
| Accessibility | X/10 | ↑/↓/→ | N | N | N |
| Mobile | X/10 | ↑/↓/→ | N | N | N |
| LLM Operations | X/10 | ↑/↓/→ | N | N | N |
| Data Architecture | X/10 | ↑/↓/→ | N | N | N |
| Billing | X/10 | ↑/↓/→ | N | N | N |
| Resilience | X/10 | ↑/↓/→ | N | N | N |
| API Governance | X/10 | ↑/↓/→ | N | N | N |

### Key Metrics
- **Total Findings**: N (Critical: N, High: N, Medium: N, Low: N)
- **Fixed Since Last Run**: N
- **New Since Last Run**: N
- **$25M Readiness**: [Ready / Near Ready / Needs Work / Critical Gaps]

---

## Score History

| Date | Overall | Sec | Code | UI | Perf | A11y | Mobile | LLM | Data | Bill | Resil | API |
|------|---------|-----|------|-----|------|------|--------|-----|------|------|-------|-----|
| [DATE] | X.X | X | X | X | X | X | X | X | X | X | X | X |

---

## Critical Issues (Fix Immediately)

> These block $25M readiness. Address within 24-48 hours.

### [ISSUE-001] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:123`
- **Impact**: [Business impact description]
- **Risk**: [What happens if not fixed]
- **Owner**: [Unassigned / Name]
- **Status**: [Open / In Progress]

---

## High Priority (This Sprint)

> Address within current sprint cycle.

### [ISSUE-002] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:456`
- **Impact**: [Description]
- **Owner**: [Unassigned / Name]
- **Status**: [Open / In Progress]

---

## Medium Priority (Next Sprint)

> Plan for next sprint.

### [ISSUE-003] [Category]: [Brief Title]
- **Location**: `path/to/file.ts:789`
- **Impact**: [Description]
- **Status**: [Open]

---

## Low Priority (Backlog)

> Track but don't prioritize.

- [Brief description] - `file:line`
- [Brief description] - `file:line`

---

## Category Deep Dives

<details>
<summary>Security (X/10) - Click to expand</summary>

### Findings
1. [Finding with location]
2. [Finding with location]

### Recommendations
- [Recommendation]

</details>

<details>
<summary>Code Quality (X/10) - Click to expand</summary>

[Same structure]

</details>

[Repeat for each category]

---

## Audit Methodology

This dashboard consolidates findings from 14 specialized audits:
- Security, Attack Simulation, UI, UX, Mobile, Code Quality
- Accessibility, Performance, LLM Operations, Data Architecture
- Billing Economics, Resilience, API Governance, Full Due Diligence

Each audit follows Silicon Valley / $25M enterprise standards.

---

## How to Fix Issues

1. **Click** any `file:line` link → VS Code opens the file
2. **Review** the code at that location
3. **Tell Claude**: "Fix this [issue type] issue"
4. **Verify**: Run `/audit-dashboard` again

---

## Next Scheduled Audit

[Recommended: Weekly on Mondays]
```

## Audit Execution Process

### Step 1: Run Core Audits
Execute these audits and collect findings:

**Tier 1 - Always Run:**
- Security (OWASP, auth, data protection)
- Code Quality (TypeScript, Python, architecture)
- Performance (Core Web Vitals, bundle size)

**Tier 2 - Weekly:**
- UI/UX (design system, user experience)
- Accessibility (WCAG 2.1 AA)
- Mobile (PWA, responsive)

**Tier 3 - Bi-Weekly:**
- LLM Operations (token costs, model performance)
- Data Architecture (RLS, schema)
- Resilience (error handling, observability)
- Billing (revenue protection)
- API Governance (versioning, consistency)

### Step 2: Score Each Category
Use this rubric:
- **10/10**: No findings, exceeds standards
- **8-9/10**: Minor issues only, production ready
- **6-7/10**: Some high-priority issues, needs attention
- **4-5/10**: Critical issues present, significant risk
- **1-3/10**: Major problems, not production ready

### Step 3: Prioritize Findings
Assign priority based on:
- **Critical**: Security vulnerabilities, data leaks, revenue loss
- **High**: User-facing bugs, performance issues, compliance gaps
- **Medium**: Code quality, maintainability, minor UX issues
- **Low**: Polish, optimization, nice-to-haves

### Step 4: Generate Dashboard
1. Create/update `AUDIT_DASHBOARD.md` in repo root
2. Preserve score history (append new row, keep last 10)
3. Update all findings with current status
4. Calculate trends from previous scores

### Step 5: Summary Stats
Calculate:
- Overall score (weighted average)
- Change from last run
- Fixed vs new issues
- $25M readiness assessment

## Files to Analyze

Review these key areas during audit:

**Frontend:**
- `frontend/src/components/` - All UI components
- `frontend/src/contexts/` - State management
- `frontend/src/styles/` - Design system
- `frontend/src/hooks/` - Custom hooks

**Backend:**
- `backend/routers/` - All API endpoints
- `backend/auth.py` - Authentication
- `backend/security.py` - Security utilities
- `backend/council.py` - LLM orchestration
- `backend/database.py` - Data access

**Infrastructure:**
- `supabase/migrations/` - Database schema
- `.github/workflows/` - CI/CD
- Configuration files

## Important Guidelines

1. **Be Specific**: Every finding must have a file:line location
2. **Be Actionable**: Describe what to fix, not just what's wrong
3. **Be Consistent**: Use same scoring rubric every time
4. **Be Honest**: Don't inflate scores - board needs truth
5. **Track History**: Always preserve and update score history

## Output Location

Save dashboard to: `AUDIT_DASHBOARD.md` (repository root)

---

Remember: This dashboard is for board presentation AND developer action. Make it clear, honest, and actionable.
