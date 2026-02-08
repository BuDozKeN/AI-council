---
name: hunt-ux-issues
description: Orchestrated UX/UI issue hunt using ALL testing tools - automated agents, Playwright suites, browser-use, Lighthouse, and manual audit skills
---

# UX/UI Issue Hunt - $25M SaaS Quality Orchestrator

You are a **QA Director** running a comprehensive UX/UI issue hunt across EVERY testing tool available in this repo. Your goal: find every issue that stands between this product and $25M SaaS quality (Stripe, Linear, Notion level).

This is NOT a single audit. This is a **multi-phase campaign** that orchestrates automated agents, E2E test suites, performance tools, and manual inspection into one unified issue backlog.

---

## Phase 1: Automated Sweeps (run in parallel)

Launch these agents and tools simultaneously. They run independently and catch different issue categories.

### 1a. Run Playwright E2E + Accessibility Suite
```bash
cd frontend
npx playwright test e2e/accessibility.spec.ts --reporter=list
npx playwright test e2e/app-loads.spec.ts --reporter=list
npx playwright test e2e/login.spec.ts --reporter=list
npx playwright test e2e/visual-regression-full.spec.ts --reporter=list
```
**Captures:** WCAG violations, JS errors, CSS load failures, touch target violations, color contrast issues, CLS problems, FCP regressions, mobile overflow bugs.

### 1b. Run Lighthouse CI
```bash
cd frontend
npx lhci autorun
```
**Captures:** Performance score, accessibility score, best practices, SEO, Core Web Vitals (FCP, LCP, CLS, TBT).

### 1c. Launch app-explorer agent
Use the Task tool to launch the `app-explorer` agent with this prompt:
> "Explore the entire AxCouncil app at http://localhost:5173. Click every button, open every modal, fill every form, navigate every screen. Report all issues found with severity (P0-P3), screenshots, and reproduction steps. Test both desktop (1280x720) and mobile (390x844) viewports."

**Captures:** Broken buttons, modal issues, form bugs, navigation failures, console errors, network errors, interaction failures.

### 1d. Launch mobile-ux-tester agent
Use the Task tool to launch the `mobile-ux-tester` agent with this prompt:
> "Test the AxCouncil app at http://localhost:5173 across all mobile viewports (iPhone SE 320x568, iPhone 14 390x844, iPhone 14 Pro Max 430x932, Pixel 7 412x915). Test every interaction: buttons, tabs, modals, forms, scroll areas. Report issues with severity ratings."

**Captures:** Mobile-specific interaction bugs, viewport-specific layout breaks, touch target size violations, scroll container issues, keyboard overlay problems.

### 1e. Run browser-use Python explorer (if available)
```bash
python -m backend.automation.explorer --full 2>/dev/null || echo "browser-use not available in this environment"
```
**Captures:** AI-driven exploration findings, interaction anomalies, flow completeness.

---

## Phase 2: Collect & Deduplicate Results

After all Phase 1 tools complete, compile results into a master issue list.

### Issue Schema
For EVERY issue found, record:

| Field | Value |
|-------|-------|
| **ID** | UXH-001, UXH-002, etc. |
| **Source** | Which tool found it (Playwright, Lighthouse, app-explorer, mobile-ux-tester, browser-use, manual) |
| **Screen** | Which screen/URL |
| **Severity** | P0 (blocker), P1 (critical), P2 (major), P3 (minor), P4 (cosmetic) |
| **Category** | interaction, visual, a11y, performance, mobile, layout, content, error-handling |
| **Description** | What's wrong |
| **Expected** | What should happen |
| **Actual** | What actually happens |
| **Viewport** | Desktop/Tablet/Mobile (which device if mobile) |
| **Repro Steps** | How to reproduce |

### Deduplication Rules
- Same element + same issue from different tools = 1 issue (note all sources)
- Same issue at different viewports = 1 issue with "Affects: desktop, mobile"
- Performance issue from both Lighthouse and Playwright = 1 issue, cite both measurements

---

## Phase 3: Manual Deep Inspection

After automated tools have swept, YOU manually inspect the areas they commonly miss:

### 3a. State Transitions
Navigate each screen and verify:
- [ ] Empty state → First item → Full list (does it transition smoothly?)
- [ ] Loading state → Loaded (no layout shift?)
- [ ] Error state → Retry → Success (clear recovery path?)
- [ ] Logged out → Login → First screen (seamless?)

### 3b. Edge Cases
- [ ] Very long text in all input fields (does it truncate gracefully?)
- [ ] Rapid clicking on submit buttons (no double submission?)
- [ ] Browser back/forward (does state preserve?)
- [ ] Refresh on every screen (does it recover?)
- [ ] Slow network simulation (are loading states shown?)

### 3c. Visual Polish (Stripe/Linear standard)
For each screen, ask yourself:
- Is the spacing consistent? (8px grid)
- Is the typography hierarchy clear? (one clear heading, supporting text, body)
- Are interactive elements obviously clickable? (hover states, cursor changes)
- Does dark mode look intentional, not just "inverted"?
- Are animations smooth and purposeful? (not janky or gratuitous)
- Are empty states helpful? (not just "No data")
- Are error messages actionable? (not just "Something went wrong")

### 3d. Cross-Cutting Concerns
- [ ] Design token consistency (no hardcoded colors, use `var(--color-*)`)
- [ ] Touch targets on mobile (44px minimum on ALL interactive elements)
- [ ] Focus indicators visible for keyboard navigation
- [ ] No horizontal scroll on any mobile viewport
- [ ] All modals dismissible via Escape key
- [ ] No console errors on any screen

---

## Phase 4: Generate Report

Produce a final report in this format:

### Executive Summary
```
Issue Hunt Date: [date]
Tools Used: [list all tools that ran]
Screens Tested: [count] / [total]
Total Issues Found: [count]
  P0 (Blocker):    [count]
  P1 (Critical):   [count]
  P2 (Major):      [count]
  P3 (Minor):      [count]
  P4 (Cosmetic):   [count]

$25M Readiness Score: [1-10]
```

### Issue Table (sorted by severity)

| ID | Sev | Category | Screen | Description | Source |
|----|-----|----------|--------|-------------|--------|
| UXH-001 | P0 | interaction | /chat | Send button unresponsive | app-explorer |
| ... | | | | | |

### Scores by Dimension

| Dimension | Score | Target | Gap |
|-----------|-------|--------|-----|
| Visual Polish | ?/10 | 9/10 | |
| Mobile UX | ?/10 | 9/10 | |
| Accessibility | ?/10 | 9/10 | |
| Performance | ?/10 | 9/10 | |
| Error Handling | ?/10 | 8/10 | |
| Interaction Quality | ?/10 | 9/10 | |
| Content/Copy | ?/10 | 8/10 | |

### Priority Fix List (Top 10)

Ordered list of the highest-impact fixes that would most improve the $25M readiness score.

### Tool Coverage Matrix

| Screen | Playwright | Lighthouse | app-explorer | mobile-ux | browser-use | Manual |
|--------|-----------|-----------|-------------|-----------|-------------|--------|
| / (Landing) | x | x | x | x | x | x |
| /mycompany | x | | x | x | x | x |
| ... | | | | | | |

---

## Output Location

Save the full report to: `todo/ux-issue-hunt-report.md`

---

## Important Notes

1. **Don't stop at automated results.** The automated tools find ~60% of issues. Manual inspection catches the rest (polish, feel, edge cases).
2. **Be brutally honest.** A $25M buyer will have their own QA team verify. Under-reporting issues now means surprises later.
3. **Prioritize ruthlessly.** Not every P3 needs fixing before exit. Focus on what a buyer sees in a 30-minute demo.
4. **Compare to Stripe/Linear.** Open stripe.com/dashboard or linear.app in another tab. That's the bar.
5. **Test logged-out AND logged-in states.** The login page is the first thing investors see.
