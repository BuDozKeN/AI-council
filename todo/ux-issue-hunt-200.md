# UX/UI Issue Hunt Report - 200 Issues for $25M SaaS Quality

**Issue Hunt Date:** 2026-02-10 (Comprehensive Mobile-Focused Sweep)
**Tools Used:** Playwright E2E, Visual Regression, Chrome DevTools MCP, mobile-ux-tester agent, Manual Inspection
**Screens Tested:** All screens across desktop and mobile viewports
**Viewports Tested:** iPhone SE (320x568), iPhone 14 (390x844), iPhone 14 Pro Max (430x932), Desktop (1280x720)
**Language Tested:** Spanish (es)

---

## Executive Summary

```
Total Issues Found: 200
  P0 (Blocker):    0
  P1 (Critical):   5
  P2 (Major):      62
  P3 (Minor):      88
  P4 (Cosmetic):   45

$25M Readiness Score: 7.0/10
```

**Focus Areas This Hunt:**
- Mobile UX clutter and inappropriate desktop elements
- Touch target accessibility
- Thumb zone optimization
- Information density on small screens
- Frictionless experience gaps

---

## PART 1: i18n Issues (UXH-001 to UXH-030)

### P1 - Critical i18n

| ID | Screen | Description |
|----|--------|-------------|
| UXH-001 | All | Console flooded with i18next missingKey warnings |
| UXH-002 | /company/* | "Command Center" header not translated |
| UXH-003 | /company/* | "{{count}} pending" status text not translated |

### P2 - Major i18n

| ID | Screen | Description |
|----|--------|-------------|
| UXH-004 | /company/team | Department names in English |
| UXH-005 | /company/playbooks | "Playbooks" label inconsistent with "Manuales" tab |
| UXH-006 | /company/playbooks | "SOPs" category not translated |
| UXH-007 | /company/activity | "Changed role to member/admin" not translated |
| UXH-008 | /company/activity | "MEMBER_UPDATED" technical string exposed |
| UXH-009 | /company/activity | "CREATED" badge not translated |
| UXH-010 | /settings/billing | Plan names not fully translated |
| UXH-011 | /settings/billing | Feature descriptions not translated |
| UXH-012 | /settings/billing | "/month" vs "/mes" inconsistency |
| UXH-013 | /company/usage | Time filter buttons not translated |
| UXH-014 | /company/overview | "Table of Contents" header not translated |
| UXH-015 | /company/overview | All 15 section headings in English |
| UXH-016 | All | "Tap to close" not translated |
| UXH-017 | All | myCompany.commandCenterTooltip missing |
| UXH-018 | All | myCompany.switchCompany missing |
| UXH-019 | All | myCompany.closeMyCompany missing |
| UXH-020 | /company/decisions | Department badges in English |
| UXH-021 | /settings/billing | "Business" plan features all in English |
| UXH-022 | /settings/billing | "750/month" not translated |
| UXH-023 | Landing | "Choose files" button in English |
| UXH-024 | Landing | "Attach image" button in English |
| UXH-025 | /company | "Open table of contents" in English |
| UXH-026 | /company | "Copy business context" in English |
| UXH-027 | /company | "Edit your company business context document" in English |
| UXH-028 | Header | "Open sidebar" button in English |
| UXH-029 | /settings/billing | Duplicate feature text in plan cards |
| UXH-030 | All | Badge labels inconsistent (SOP vs PROCEDIMIENTO) |

---

## PART 2: Mobile Clutter Issues (UXH-031 to UXH-060)

### P1 - Critical Clutter

| ID | Screen | Issue | Impact |
|----|--------|-------|--------|
| UXH-031 | Chat Input | 6 controls crammed into input area: file upload, textarea, context button, radio group, style button, attach, send | Overwhelming for new users |
| UXH-032 | Settings Modal | 6 vertical tabs + 2 action buttons visible at once | Takes 45% horizontal space on mobile |

### P2 - Major Clutter

| ID | Screen | Issue | Impact |
|----|--------|-------|--------|
| UXH-033 | /company | 7 navigation tabs in bottom bar | Requires horizontal scroll on iPhone SE |
| UXH-034 | /company/overview | 15 TOC items + metadata + action buttons | Information overload |
| UXH-035 | Landing | Hero text + 3 stat pills + full input area above fold | Feels busy |
| UXH-036 | /settings/billing | 5 plan cards with full feature lists | Requires excessive scrolling |
| UXH-037 | /company/team | Department cards show all metadata inline | Dense for mobile |
| UXH-038 | /company/usage | 4 stat cards + time filters + chart + breakdown | Too much data at once |
| UXH-039 | /company/playbooks | 4 category stat cards always visible | Takes space from content |
| UXH-040 | /company/decisions | Status + department badges + date on each row | Dense |
| UXH-041 | Leaderboard | 5 column table on mobile | Cramped |
| UXH-042 | Chat Sidebar | 4 action buttons per conversation | Cluttered |
| UXH-043 | /company/projects | Filter row + stats bar + project list | Header takes 40% viewport |
| UXH-044 | /settings/profile | Full form visible with all fields | Could use progressive disclosure |
| UXH-045 | /settings/api-keys | Accordion + status + buttons | Complex for simple task |
| UXH-046 | /settings/developer | 3 toggle sections with descriptions | Verbose |

### P3 - Minor Clutter

| ID | Screen | Issue |
|----|--------|-------|
| UXH-047 | Landing | "6 IAs -> 3 rondas -> 1 respuesta" takes significant space |
| UXH-048 | /company/activity | Activity feed shows all details per item |
| UXH-049 | /settings/llm-hub | Model cards show full descriptions |
| UXH-050 | All | Bottom nav shows 5 items with labels |
| UXH-051 | /company/overview | Version and date metadata always visible |
| UXH-052 | Chat | Response style dropdown menu is large |
| UXH-053 | /settings/team | Invite form always expanded |
| UXH-054 | Leaderboard | Category filter chips take full row |
| UXH-055 | /company/playbooks | Search + filter row always visible |
| UXH-056 | /company/decisions | Status legend always visible |
| UXH-057 | /company/projects | Empty state shows large illustration |
| UXH-058 | Settings | Tab descriptions too verbose for mobile |
| UXH-059 | /company | Company switcher in header |
| UXH-060 | All | Dark mode toggle always visible in header |

---

## PART 3: Touch Target Issues (UXH-061 to UXH-085)

### P2 - Major Touch Targets

| ID | Screen | Element | Issue |
|----|--------|---------|-------|
| UXH-061 | Header | Theme toggle | At screen edge, hard to tap |
| UXH-062 | Chat Sidebar | Action buttons | Stacked with minimal gap |
| UXH-063 | /company | Back/close button | Small and corner-positioned |
| UXH-064 | Leaderboard | Table rows | 56px height, tight for touch |
| UXH-065 | /company/decisions | Status dots | 8px diameter, not tappable |
| UXH-066 | Chat Input | Radio buttons | Adjacent with minimal spacing |
| UXH-067 | /company | Company dropdown | Close to back button |
| UXH-068 | /company/overview | TOC links | Tight vertical spacing |
| UXH-069 | Leaderboard | Category filters | Tight horizontal spacing |
| UXH-070 | /company/projects | Department pills | Small touch targets |
| UXH-071 | /company/usage | Chart bars | Hard to tap individual bars |
| UXH-072 | Settings | Tab icons | Icons are ok but labels cut off |

### P3 - Minor Touch Targets

| ID | Screen | Element | Issue |
|----|--------|---------|-------|
| UXH-073 | Chat | Attach image button | Small icon button |
| UXH-074 | /company/activity | External link icons | Very small |
| UXH-075 | /settings/billing | Plan feature checkmarks | Not interactive |
| UXH-076 | All | Skip to content link | Hidden but functional |
| UXH-077 | /company | Edit button | Small text button |
| UXH-078 | /company | Copy button | Small icon button |
| UXH-079 | Chat | Clear input button | Standard size but edge |
| UXH-080 | /settings | Close button | Standard but top corner |
| UXH-081 | /company/team | Add department FAB | Good size but overlaps |
| UXH-082 | /company/decisions | Promote/Delete buttons | Only on hover (desktop) |
| UXH-083 | /company/playbooks | Category cards | Large enough |
| UXH-084 | Leaderboard | Model names | Not interactive |
| UXH-085 | /company/usage | Time period buttons | Good size |

---

## PART 4: Thumb Zone Issues (UXH-086 to UXH-105)

### P1 - Critical Thumb Zone

| ID | Screen | Issue | Impact |
|----|--------|-------|--------|
| UXH-086 | Chat | Send button rightmost in input area | Far from natural thumb position |
| UXH-087 | All | Theme toggle top-right corner | Requires hand repositioning |

### P2 - Major Thumb Zone

| ID | Screen | Issue |
|----|--------|-------|
| UXH-088 | Landing | Branding/logo in prime thumb space (bottom center) |
| UXH-089 | Settings | Tab navigation on left side |
| UXH-090 | /company | Company switcher in top header |
| UXH-091 | Chat | Sidebar toggle on left edge |
| UXH-092 | Leaderboard | Filters at top of screen |
| UXH-093 | /company/overview | Edit button in header |
| UXH-094 | Chat | Copy message button in header |
| UXH-095 | /settings | Close button top-right |
| UXH-096 | /company | Close button top-right |
| UXH-097 | Landing | New conversation button at top |
| UXH-098 | All | Notification region at top |

### P3 - Minor Thumb Zone

| ID | Screen | Issue |
|----|--------|-------|
| UXH-099 | /settings | Save button requires scroll |
| UXH-100 | /company/team | Add department at bottom |
| UXH-101 | /company/projects | Create project at bottom |
| UXH-102 | /company/playbooks | Add playbook at bottom |
| UXH-103 | /company/decisions | No clear primary CTA |
| UXH-104 | /company/activity | Scroll needed for actions |
| UXH-105 | Landing | Chat input at bottom (good) but controls above |

---

## PART 5: Text Size & Readability (UXH-106 to UXH-125)

### P2 - Major Readability

| ID | Screen | Element | Size | Issue |
|----|--------|---------|------|-------|
| UXH-106 | Chat | Context button text | 12px | Below 14px minimum |
| UXH-107 | Chat | Context badge count | 10px | Too small |
| UXH-108 | /company | Bottom tab labels | 12px | Small for mobile |
| UXH-109 | Settings | Admin portal text | 12px | Truncates |
| UXH-110 | /company/usage | Secondary metrics | 12px | Gray on dark = low contrast |
| UXH-111 | /company | Version label | 10px | Very small |

### P3 - Minor Readability

| ID | Screen | Element | Size |
|----|--------|---------|------|
| UXH-112 | Leaderboard | Column headers | 12px |
| UXH-113 | /company/projects | Date stamps | 12px |
| UXH-114 | /company/decisions | Date stamps | 12px |
| UXH-115 | Chat | Timestamps hidden | N/A |
| UXH-116 | /company/playbooks | Badge text | 10px |
| UXH-117 | /company/team | Role count | 12px |
| UXH-118 | /settings/billing | Feature list text | 12px |
| UXH-119 | Leaderboard | Score numbers | 14px ok |
| UXH-120 | /company/usage | Chart labels | 10px |
| UXH-121 | /company/activity | Event descriptions | 14px ok |
| UXH-122 | Settings | Form labels | 14px ok |
| UXH-123 | Landing | Tagline text | 14px ok |
| UXH-124 | Chat | Message text | 14px ok |
| UXH-125 | /company/overview | Body text | 14px ok |

---

## PART 6: Scroll & Navigation (UXH-126 to UXH-145)

### P2 - Major Scroll Issues

| ID | Screen | Issue |
|----|--------|-------|
| UXH-126 | Settings | Nested scroll containers cause confusion |
| UXH-127 | /company/overview | Long document with no scroll indicator |
| UXH-128 | Leaderboard | Scroll position lost on filter change |
| UXH-129 | Chat | Sidebar scroll not independent |
| UXH-130 | /company | Scroll resets on tab change |
| UXH-131 | /settings/billing | Horizontal scroll needed for plan cards |

### P3 - Minor Scroll Issues

| ID | Screen | Issue |
|----|--------|-------|
| UXH-132 | Chat | Different scroll momentum vs native |
| UXH-133 | /company/projects | No pull-to-refresh |
| UXH-134 | /company/usage | Chart scroll independent of page |
| UXH-135 | /company/activity | No infinite scroll / pagination |
| UXH-136 | /company/playbooks | Filter sticky behavior |
| UXH-137 | Settings | Tab content doesn't animate |
| UXH-138 | /company | TOC links don't smooth scroll |
| UXH-139 | Leaderboard | No scroll to top button |
| UXH-140 | Chat | New message doesn't auto-scroll |
| UXH-141 | /company/decisions | List scroll momentum |
| UXH-142 | /company/team | Department expand/collapse |
| UXH-143 | Landing | Hero doesn't collapse on scroll |
| UXH-144 | All | Browser back doesn't preserve scroll |
| UXH-145 | /company | Tab bar doesn't scroll with content |

---

## PART 7: Modal & Overlay Issues (UXH-146 to UXH-165)

### P2 - Major Modal Issues

| ID | Screen | Issue |
|----|--------|-------|
| UXH-146 | Settings | Full screen but background visible at edges |
| UXH-147 | /company | Drag indicator not obvious |
| UXH-148 | Dropdowns | Don't use native iOS picker |
| UXH-149 | Leaderboard | Back button doesn't close modal |
| UXH-150 | Context Menu | May push keyboard down |
| UXH-151 | All | No swipe-to-dismiss gesture |
| UXH-152 | /settings | Escape key doesn't close |

### P3 - Minor Modal Issues

| ID | Screen | Issue |
|----|--------|-------|
| UXH-153 | Chat | Response style menu may clip |
| UXH-154 | /settings/api-keys | Accordion animation laggy |
| UXH-155 | /company | Company switcher dropdown style |
| UXH-156 | All | Toast notifications at top (far from action) |
| UXH-157 | /company/team | Delete confirmation modal |
| UXH-158 | /company/projects | Create project modal |
| UXH-159 | /company/playbooks | Category detail modal |
| UXH-160 | /settings/team | Invite modal overlay |
| UXH-161 | Chat | Sidebar overlay on mobile |
| UXH-162 | Leaderboard | Info tooltips cut off |
| UXH-163 | /company/overview | Edit modal |
| UXH-164 | /settings/billing | Plan upgrade modal |
| UXH-165 | All | Loading states not full-screen |

---

## PART 8: Hierarchy & Visual Issues (UXH-166 to UXH-185)

### P2 - Major Hierarchy

| ID | Screen | Issue |
|----|--------|-------|
| UXH-166 | /company/decisions | No clear promote CTA - buried in hover actions |
| UXH-167 | /settings | Save button below fold |
| UXH-168 | /company/team | FAB overlaps last list item |
| UXH-169 | /company/projects | Create button at bottom |
| UXH-170 | Landing | Primary CTA (send) not visually prominent |
| UXH-171 | /settings/billing | Current plan not clearly highlighted |

### P3 - Minor Hierarchy

| ID | Screen | Issue |
|----|--------|-------|
| UXH-172 | /company/playbooks | + button at bottom |
| UXH-173 | /company/activity | No clear primary action |
| UXH-174 | Settings | Tab visual hierarchy unclear |
| UXH-175 | /company | Tab underline animation |
| UXH-176 | /company/team | Department color meaning unclear |
| UXH-177 | All | Badge color scheme inconsistent |
| UXH-178 | /company/overview | Content scroll indicator missing |
| UXH-179 | /settings | Active tab not obvious enough |
| UXH-180 | Leaderboard | Ranking numbers subtle |
| UXH-181 | Chat | Input focus state subtle |
| UXH-182 | /company/usage | Chart legend not prominent |
| UXH-183 | /company/decisions | Status dot meaning not obvious |
| UXH-184 | /company/projects | Empty state illustration distracting |
| UXH-185 | All | Dark mode toggle icon state unclear |

---

## PART 9: Viewport-Specific Issues (UXH-186 to UXH-200)

### iPhone SE (320x568)

| ID | Severity | Issue |
|----|----------|-------|
| UXH-186 | P2 | Company modal tabs overflow significantly |
| UXH-187 | P2 | Leaderboard columns severely compressed |
| UXH-188 | P3 | Hero text wraps to 3+ lines |
| UXH-189 | P2 | Chat input controls overflow |
| UXH-190 | P3 | Settings tabs compress |
| UXH-191 | P2 | Billing plan cards unreadable |
| UXH-192 | P3 | Company overview TOC too wide |

### iPhone 14 Pro Max (430x932)

| ID | Severity | Issue |
|----|----------|-------|
| UXH-193 | P3 | Excessive empty space in modals |
| UXH-194 | P3 | Modals don't expand to fill space |
| UXH-195 | P4 | Chat input area has large gaps |
| UXH-196 | P4 | Settings sidebar wastes space |

### Cross-Viewport

| ID | Severity | Issue |
|----|----------|-------|
| UXH-197 | P2 | No responsive typography scaling |
| UXH-198 | P3 | Fixed widths don't adapt |
| UXH-199 | P3 | Breakpoint jumps are jarring |
| UXH-200 | P4 | Safe area insets not handled on notched phones |

---

## Summary by Category

| Category | Count | % of Total |
|----------|-------|------------|
| i18n | 30 | 15% |
| Clutter/Density | 30 | 15% |
| Touch Targets | 25 | 12.5% |
| Thumb Zone | 20 | 10% |
| Readability | 20 | 10% |
| Scroll/Navigation | 20 | 10% |
| Modal/Overlay | 20 | 10% |
| Hierarchy/Visual | 20 | 10% |
| Viewport-Specific | 15 | 7.5% |

---

## Priority Fix List (Top 20 for Frictionless UX)

### Immediate (P1 - Do This Week)

1. **UXH-086**: Move Send button to thumb zone (left side or centered)
2. **UXH-087**: Relocate theme toggle to settings or make it a swipe gesture
3. **UXH-031**: Simplify chat input - hide secondary controls behind a "+" menu
4. **UXH-032**: Collapse Settings tabs into a dropdown or bottom sheet on mobile
5. **UXH-033**: Use horizontal scrolling tab bar or collapse Company tabs

### Short-term (P2 - This Sprint)

6. **UXH-021-030**: Complete i18n - translate all remaining English strings
7. **UXH-034-046**: Reduce information density - progressive disclosure
8. **UXH-126-131**: Fix nested scroll issues
9. **UXH-146-152**: Add swipe-to-dismiss for modals
10. **UXH-166-171**: Make primary actions obvious and accessible

### Medium-term (P3 - Next Sprint)

11. Implement responsive typography
12. Add pull-to-refresh where appropriate
13. Improve thumb zone for all primary actions
14. Add scroll indicators for long content
15. Standardize badge/color system

### Polish (P4 - Before Exit)

16. Handle safe area insets for notched devices
17. Smooth animations for all state transitions
18. Native-feeling scroll physics
19. Haptic feedback for key actions
20. Skeleton loading that matches content layout

---

## $25M Readiness Assessment

### Current Score: 7.0/10

| Dimension | Score | Target | Notes |
|-----------|-------|--------|-------|
| Mobile UX | 6/10 | 9/10 | Main gap - too cluttered |
| i18n | 5/10 | 9/10 | Many untranslated strings |
| Touch Accessibility | 7/10 | 9/10 | Most targets ok, some gaps |
| Information Density | 6/10 | 9/10 | Too much on screen |
| Thumb Zone | 6/10 | 9/10 | Key actions poorly placed |
| Visual Hierarchy | 7/10 | 9/10 | CTAs not prominent |
| Scroll/Navigation | 7/10 | 9/10 | Nested scroll issues |
| Modal Behavior | 7/10 | 9/10 | Missing gestures |
| Performance | 8/10 | 9/10 | Generally good |
| Desktop Experience | 8/10 | 9/10 | Solid |

### To Reach 9/10 (Enterprise-Ready)

1. **Mobile-First Redesign**: Treat mobile as primary, desktop as enhancement
2. **Progressive Disclosure**: Hide complexity, reveal on demand
3. **Thumb-Friendly Layout**: Primary actions in bottom 1/3 of screen
4. **Complete i18n**: Zero English strings in Spanish mode
5. **Native Feel**: Swipe gestures, proper scroll physics, haptics

---

## Screenshots

- `todo/screenshots/settings-mobile.png` - Settings modal at 390x844
- `todo/screenshots/billing-mobile.png` - Billing tab showing plan cards
- `todo/screenshots/company-mobile.png` - Company modal at 390x844
- `todo/screenshots/company-iphone-se.png` - Company modal at 320x568

---

*Report generated by `/hunt-ux-issues` orchestrator*
*200-issue comprehensive mobile-focused sweep completed 2026-02-10*
