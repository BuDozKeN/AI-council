# UX/UI Visual Audit - January 19, 2026

> **Audit Type:** Visual Screen-by-Screen Review
> **Auditor:** Claude Code (Chrome DevTools MCP)
> **Viewports Tested:** Desktop (1440×900), Mobile (375×812)
> **Standard:** $25M Silicon Valley Due Diligence Grade

---

## Executive Summary

| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| Overall UX Score | 6.5/10 | 8/10 | 🟡 Needs Work |
| Visual Polish | 7/10 | 9/10 | 🟡 Good but inconsistent |
| Mobile Experience | 5.5/10 | 8/10 | 🔴 Significant issues |
| Enterprise Ready | 6/10 | 8/10 | 🟡 Close but not there |
| **$25M Worthy?** | **Not Yet** | Yes | Fixable with focused effort |

**Total Issues Found:** 24
- Critical: 2
- Major: 7
- Minor: 9
- Cosmetic: 6

---

## 🔴 CRITICAL Issues (Fix Within 24-48 Hours)

### UXUI-001: LLM Hub Settings Tab Broken
- **Location:** Settings → LLM Hub tab
- **Screenshot:** Shows "Unable to load configuration" error
- **Impact:** Core feature appears completely broken; users cannot configure AI models
- **User Impact:** Destroys trust in product reliability
- **Technical:** API endpoint likely failing or missing authentication
- **Fix Required:**
  - [ ] Debug backend endpoint for LLM Hub configuration
  - [ ] Add meaningful error message explaining the issue
  - [ ] Add retry mechanism with exponential backoff
  - [ ] Add fallback UI showing cached/default configuration
- **Files to Check:**
  - `frontend/src/components/settings/LLMHubTab.tsx`
  - `backend/routers/` - relevant endpoint
- **Status:** 🔴 Open

### UXUI-002: Empty Pink/Orange Square in My Company Header
- **Location:** My Company modal → Header, next to "AxCouncil" title
- **Screenshot:** Small colored square appears to be broken image/loading state
- **Impact:** Looks like a bug on every My Company screen visit
- **User Impact:** Creates impression of unfinished/buggy product
- **Fix Required:**
  - [ ] Identify what icon/image should load there
  - [ ] Add proper loading state or fallback
  - [ ] If no icon needed, remove the placeholder entirely
- **Files to Check:**
  - `frontend/src/components/mycompany/MyCompanyHeader.tsx` or similar
  - Check for `<img>` tags with missing src
- **Status:** 🔴 Open

---

## 🟠 MAJOR Issues (Fix This Sprint)

### UXUI-003: Grammatical Error "1 roles"
- **Location:** My Company → Team tab → Any department with single role
- **Observed:** "Sales 1 roles" instead of "Sales 1 role"
- **Impact:** Makes product look unpolished/unprofessional
- **Fix Required:**
  - [ ] Add pluralization logic: `${count} ${count === 1 ? 'role' : 'roles'}`
- **Files to Check:**
  - `frontend/src/components/mycompany/TeamTab.tsx`
  - Search for: "roles" string interpolation
- **Status:** 🟠 Open

### UXUI-004: Inconsistent Number Colors in Summary Cards
- **Location:** My Company → Projects tab, Playbooks tab, Usage tab
- **Observed:** Numbers are different colors (blue, green, yellow, white) with no legend
- **Projects:** 8 (blue), 9 (green), 0 (gray), 17 (yellow)
- **Playbooks:** 4 (blue), 1 (white), 2 (green), 1 (white)
- **Impact:** Users cannot understand what colors mean - confusion
- **Fix Required:**
  - [ ] Option A: Make all numbers the same color (consistent)
  - [ ] Option B: Add a legend explaining the color system
  - [ ] Option C: Use color only for the selected filter, gray for others
- **Files to Check:**
  - `frontend/src/components/mycompany/ProjectsTab.tsx`
  - `frontend/src/components/mycompany/PlaybooksTab.tsx`
  - `frontend/src/components/mycompany/UsageTab.tsx`
- **Status:** 🟠 Open

### UXUI-005: Cache Hit Rate 0% Shown in GREEN
- **Location:** My Company → Usage tab → "Cache Hit Rate" card
- **Observed:** "0.0%" displayed in green color
- **Impact:** 0% cache hit is BAD but green implies GOOD - misleading
- **Fix Required:**
  - [ ] Implement threshold-based coloring:
    - Red: 0-30%
    - Yellow: 30-70%
    - Green: 70-100%
- **Files to Check:**
  - `frontend/src/components/mycompany/UsageTab.tsx`
  - Look for Cache Hit Rate display component
- **Status:** 🟠 Open

### UXUI-006: Activity Log Shows Technical Jargon
- **Location:** My Company → Activity tab
- **Observed:** Shows "MEMBER_UPDATED" instead of human-readable text
- **Also:** "CREATED" badge appears on "Changed role" events (contradictory)
- **Impact:** Users see database terminology, breaks immersion
- **Fix Required:**
  - [ ] Map technical event types to human-readable strings:
    - `MEMBER_UPDATED` → "Role changed"
    - `MEMBER_CREATED` → "Member added"
    - `PLAYBOOK_CREATED` → "Playbook created"
  - [ ] Fix badge logic: UPDATED events should show "UPDATED" badge
- **Files to Check:**
  - `frontend/src/components/mycompany/ActivityTab.tsx`
  - Activity event type mapping/translation
- **Status:** 🟠 Open

### UXUI-007: Mobile Sidebar Doesn't Auto-Close
- **Location:** Mobile view → Sidebar open → Click Settings
- **Observed:** Sidebar remains visible behind the Settings bottom sheet
- **Impact:** Visual clutter, confusing layering, unprofessional
- **Fix Required:**
  - [ ] Auto-dismiss sidebar when opening Settings modal
  - [ ] Auto-dismiss sidebar when opening My Company modal
  - [ ] Or: Settings/My Company should push sidebar closed
- **Files to Check:**
  - `frontend/src/components/sidebar/Sidebar.tsx`
  - `frontend/src/components/settings/Settings.tsx`
  - Mobile responsive logic
- **Status:** 🟠 Open

### UXUI-008: Billing Tab Missing Current Plan Indicator
- **Location:** Settings → Billing tab
- **Observed:** Shows Free, Pro ($29), Enterprise ($99) plans but no indication of current plan
- **Also:** No upgrade/downgrade buttons visible
- **Also:** Progress bar shown for "Unlimited" plan - contradictory
- **Impact:** Users don't know their current status or how to change it
- **Fix Required:**
  - [ ] Add "Current Plan" badge to the active plan
  - [ ] Add "Upgrade" button to higher plans
  - [ ] Add "Downgrade" or "Contact Sales" to lower plans
  - [ ] Hide progress bar when plan is unlimited
- **Files to Check:**
  - `frontend/src/components/settings/BillingTab.tsx`
  - User subscription state management
- **Status:** 🟠 Open

### UXUI-009: Confetti Animation Fires 3 Times Per Query
- **Location:** Chat interface → During council response
- **Observed:** Confetti celebration after Stage 1, Stage 2, AND final answer
- **Impact:** May feel excessive/childish for enterprise users
- **Fix Required:**
  - [ ] Option A: Only show confetti on final answer
  - [ ] Option B: Make confetti a user preference (Settings toggle)
  - [ ] Option C: More subtle animation for intermediate stages
- **Files to Check:**
  - `frontend/src/components/chat/` - confetti trigger logic
  - `frontend/src/components/stage1/`, `stage2/`, `stage3/`
- **Status:** 🟠 Open

---

## 🟡 MINOR Issues (Fix Next Sprint)

### UXUI-010: Settings Save Button Not Visible Initially
- **Location:** Settings → Profile tab (desktop)
- **Observed:** "Save Changes" button requires scrolling to see
- **Fix:** Consider sticky footer with save button, or show above fold
- **Status:** 🟡 Open

### UXUI-011: Phone Field Missing Format Placeholder
- **Location:** Settings → Profile → Phone field
- **Observed:** Empty field with no format hint
- **Fix:** Add placeholder: "+1 (555) 123-4567"
- **Status:** 🟡 Open

### UXUI-012: Inconsistent Tagging in Decisions List
- **Location:** My Company → Decisions tab
- **Observed:** Some decisions have department tags, others don't
- **Fix:** Ensure consistent treatment - either all have tags or use different indicator
- **Status:** 🟡 Open

### UXUI-013: Yellow Dots in Decisions Unexplained
- **Location:** My Company → Decisions tab → Left side of each item
- **Observed:** Yellow/orange dots with no legend
- **Fix:** Add tooltip explaining meaning (status? priority? new?)
- **Status:** 🟡 Open

### UXUI-014: Usage Chart Missing X-Axis Date Labels
- **Location:** My Company → Usage tab → Daily Cost chart
- **Observed:** Bar chart shows bars but no date labels
- **Fix:** Add date labels below each bar or on hover
- **Status:** 🟡 Open

### UXUI-015: "Press Ctrl+K to navigate" Random Placement
- **Location:** Landing page, floating below input
- **Observed:** Text appears disconnected from any UI element
- **Fix:** Integrate into input placeholder or move to subtle tooltip
- **Status:** 🟡 Open

### UXUI-016: Mobile Input Bar Icons Cramped
- **Location:** Mobile landing page → Bottom input bar
- **Observed:** Too many icons squeezed into small space
- **Fix:** Progressive disclosure - essential icons visible, rest in overflow menu
- **Status:** 🟡 Open

### UXUI-017: Response Mode Labels Unclear
- **Location:** Chat input → "1 AI" / "5 AIs" toggle
- **Observed:** No explanation of what each mode does
- **Fix:** Add tooltip: "1 AI = Fast single response" / "5 AIs = Full council deliberation"
- **Status:** 🟡 Open

### UXUI-018: Mobile Settings Tab Icons Have No Labels
- **Location:** Mobile → Settings bottom sheet → Left sidebar
- **Observed:** Only icons visible, no text labels
- **Fix:** Either add labels below icons or show on long-press/hover
- **Status:** 🟡 Open

---

## ⚪ COSMETIC Issues (Polish When Time Permits)

### UXUI-019: "Command Center" Label Confusing
- **Location:** My Company header → "AxCouncil Command Center"
- **Issue:** What does "Command Center" mean? Unclear terminology
- **Fix:** Simplify to "AxCouncil" or "Company Settings"
- **Status:** ⚪ Open

### UXUI-020: Table of Contents Yellow Underline
- **Location:** My Company → Overview → Table of Contents links
- **Issue:** Gold/yellow underline inconsistent with blue accent elsewhere
- **Fix:** Use standard blue accent color or remove underline
- **Status:** ⚪ Open

### UXUI-021: Quote Marks Inconsistent in Decisions
- **Location:** My Company → Decisions
- **Observed:** "Unified Knowledge Management UI Flow" has quotes, others don't
- **Fix:** Consistent formatting - either all quoted or none
- **Status:** ⚪ Open

### UXUI-022: "CREATED" Badge on Update Events
- **Location:** My Company → Activity → "Changed role" events
- **Issue:** Badge says "CREATED" but action is "Changed" (update)
- **Fix:** Use "UPDATED" badge for changes
- **Status:** ⚪ Open

### UXUI-023: Session Token Display Format Inconsistent
- **Location:** Chat interface → Session cost bar
- **Observed:** "98.9K tokens" with "US$0.290" - mixed formats
- **Fix:** Consistent format: "~99K tokens ($0.29)" or "98,900 tokens (US$0.29)"
- **Status:** ⚪ Open

### UXUI-024: Missing No-Results States
- **Location:** Various search/filter contexts
- **Issue:** Not verified - need to test empty search results
- **Fix:** Add helpful empty states with suggestions
- **Status:** ⚪ Needs Verification

---

## Screens Audited

### Desktop (1440×900)
- [x] Landing page (logged in state)
- [x] My Company → Overview tab
- [x] My Company → Team tab
- [x] My Company → Team → Department expanded (Operations)
- [x] My Company → Projects tab
- [x] My Company → Playbooks tab
- [x] My Company → Decisions tab
- [x] My Company → Activity tab
- [x] My Company → Usage tab
- [x] Settings → Profile tab
- [x] Settings → Billing tab
- [x] Settings → Developer tab
- [x] Settings → LLM Hub tab (ERROR STATE)
- [x] Chat interface → Query submitted
- [x] Chat interface → Stage 1 loading
- [x] Chat interface → Stage 2 loading
- [x] Chat interface → Stage 3 loading
- [x] Chat interface → Complete response

### Mobile (375×812)
- [x] Landing page
- [x] Sidebar opened
- [x] Settings bottom sheet

### NOT YET AUDITED (Next Pass Required)
- [ ] Login page (logged out state)
- [ ] Sign up flow
- [ ] Password reset flow
- [ ] History sidebar - conversation list interactions
- [ ] Leaderboard
- [ ] All dropdown menus in chat input (Company, Project, Departments, Roles, Playbooks)
- [ ] Response style dropdown
- [ ] Conversation detail - expand Stage 1 (5 AI responses)
- [ ] Conversation detail - expand Stage 2 (peer reviews)
- [ ] Save Answer flow - all dropdowns
- [ ] My Company → New Department flow
- [ ] My Company → New Role flow
- [ ] My Company → Edit Business Context
- [ ] My Company → New Project flow
- [ ] My Company → New Playbook flow
- [ ] Settings → Team tab
- [ ] Settings → API Keys tab
- [ ] Error states (network error, 500 error, 404)
- [ ] Empty states (no conversations, no projects, no decisions)
- [ ] Mobile - all the above screens
- [ ] Dark mode vs Light mode comparison
- [ ] Keyboard navigation (Tab order)
- [ ] Command palette (Ctrl+K)

---

## Priority Action Items

### This Week (Critical + High Priority)
1. [ ] Fix LLM Hub configuration loading - UXUI-001
2. [ ] Fix company icon placeholder - UXUI-002
3. [ ] Fix "1 roles" pluralization - UXUI-003
4. [ ] Fix cache hit rate coloring - UXUI-005
5. [ ] Fix activity log jargon - UXUI-006
6. [ ] Add current plan indicator - UXUI-008

### Next Week (Medium Priority)
7. [ ] Standardize number colors in stats cards - UXUI-004
8. [ ] Fix mobile sidebar auto-close - UXUI-007
9. [ ] Review confetti frequency - UXUI-009
10. [ ] Add missing tooltips and hints - UXUI-010 through UXUI-017

### Backlog (Low Priority)
11. [ ] Cosmetic consistency fixes - UXUI-019 through UXUI-024
12. [ ] Complete audit of remaining screens

---

## How to Verify Fixes

After fixing an issue, run the visual audit again:
```
/audit-ux-visual
```

Or for a quick check of specific area:
```
# Use Chrome DevTools MCP to navigate and screenshot
1. Navigate to the affected screen
2. Take screenshot
3. Verify issue is resolved
4. Update this document status: Open → Fixed
```

---

## Notes for Next Audit

1. **Be more thorough:** Click EVERY button, dropdown, link
2. **Test all states:** Empty, loading, error, success
3. **Test both themes:** Light and dark mode
4. **Test all viewports:** Desktop, tablet, mobile
5. **Test keyboard:** Tab navigation, shortcuts
6. **Test edge cases:** Long text, special characters, rapid clicks

---

*Document created: 2026-01-19*
*Last updated: 2026-01-19*
*Next scheduled audit: 2026-01-26*
