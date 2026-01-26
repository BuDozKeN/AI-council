# Mobile Interaction Audit Report - 150 Issues
**Date**: 2026-01-26
**App**: AxCouncil
**Auditor**: Claude (mobile-ux-tester agent)
**Standard**: Revolut/Monzo/Linear mobile apps

---

## Executive Summary

| Metric | Score |
|--------|-------|
| **Mobile Interaction Score** | 4/10 |
| **Gesture Feel Score** | 5/10 |
| **Touch Target Compliance** | 35% |
| **Accessibility Score** | 6/10 |

**Critical Finding**: Multiple core features fail to work on mobile, including My Company panel navigation and Overview tab rendering.

---

## Issue Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P0 - Blocking | 8 | App unusable for core features |
| P1 - Critical | 27 | Major friction, users will complain |
| P2 - Major | 54 | Annoying but usable |
| P3 - Minor | 61 | Polish for native feel |
| **Total** | **150** | |

---

## P0 - BLOCKING ISSUES (8)

These issues make the app unusable for core mobile features.

| # | Screen | Issue | Expected | Actual |
|---|--------|-------|----------|--------|
| 1 | My Company | Overview tab renders blank | Show company overview content | Blank screen despite 17,524px content in DOM |
| 2 | My Company | Activity tab infinite loading | Load activity data | Skeleton loaders display indefinitely |
| 3 | My Company | Usage tab API error | Show usage statistics | "Failed to load activity" error |
| 4 | Bottom Nav | My Company doesn't open | Open My Company panel | Panel fails to open from bottom nav |
| 5 | Navigation | Page transitions timeout | Smooth navigation | 10s+ timeout errors on navigation |
| 6 | Conversation | Empty buttons in list | Clean conversation list | 24+ empty unlabeled buttons appear |
| 7 | Tablet | My Company broken at 768px | Responsive My Company | Panel doesn't open at tablet viewport |
| 8 | Forms | Textarea loses focus | Maintain focus while typing | Keyboard dismisses unexpectedly |

---

## P1 - CRITICAL ISSUES (27)

Major friction issues that will cause user complaints.

### Touch Target Violations (<44px) - 19 Issues

| # | Element | Size | Required | Location |
|---|---------|------|----------|----------|
| 9 | Theme Toggle Button | 32x32px | 44x44px | Fixed position top-right |
| 10 | Language/Help Button | 32x32px | 44x44px | Fixed position top-right |
| 11 | Sidebar Icon Buttons | 36x36px | 44x44px | Sidebar navigation |
| 12 | New Chat Button | 36x36px | 44x44px | Sidebar |
| 13 | History Button | 36x36px | 44x44px | Sidebar |
| 14 | Leaderboard Button | 36x36px | 44x44px | Sidebar |
| 15 | Admin Portal Button | 36x36px | 44x44px | Sidebar |
| 16 | My Company Button | 36x36px | 44x44px | Sidebar |
| 17 | Settings Button | 36x36px | 44x44px | Sidebar |
| 18 | Sign Out Button | 36x36px | 44x44px | Sidebar |
| 19 | Context Button | 92x32px | 44x44px | OmniBar |
| 20 | 1 AI Radio | 39x26px | 44x44px | Mode selector |
| 21 | 5 AIs Radio | 46x26px | 44x44px | Mode selector |
| 22 | Response Style Trigger | 26x26px | 44x44px | OmniBar |
| 23 | Attach Image Button | 36x36px | 44x44px | OmniBar |
| 24 | Submit Button | 32x32px | 44x44px | OmniBar |
| 25 | TanStack DevTools | 40x40px | 44x44px | Debug panel |
| 26 | Skip to Content Link | 1x1px | 44x44px | Accessibility link |
| 27 | Hidden File Input | 1x1px | N/A | Should be properly hidden |

### Other Critical Issues

| # | Screen | Issue | Expected | Actual |
|---|--------|-------|----------|--------|
| 28 | Settings | Tab spacing too close | 8px minimum | 4px gap between tabs |
| 29 | All Screens | Button spacing violations | 8px minimum | 14 instances of <8px gaps |
| 30 | Fonts | Badge text too small | 12px minimum | 10px font on badges |
| 31 | Forms | Missing autocomplete | autocomplete attribute | File input missing autocomplete |
| 32 | Forms | Missing labels | Label for each input | Textarea missing label association |
| 33 | Console | Accessibility warning | No warnings | "Element doesn't have autocomplete" |
| 34 | Performance | FCP 1508ms | <1000ms | First Contentful Paint too slow |
| 35 | Navigation | URL doesn't update | URL reflects route | Stays at "/" after navigation |

---

## P2 - MAJOR ISSUES (54)

Annoying but usable issues.

### Button Spacing Violations - 14 Issues

| # | Elements | Gap | Location |
|---|----------|-----|----------|
| 36 | Profile-Billing tabs | 4px | Settings tabs |
| 37 | Billing-Team tabs | 4px | Settings tabs |
| 38 | Team-API Keys tabs | 4px | Settings tabs |
| 39 | API Keys-Developer tabs | 4px | Settings tabs |
| 40 | Developer-LLM Hub tabs | 4px | Settings tabs |
| 41 | Context-Billing buttons | 6px | Mixed UI areas |
| 42 | Unnamed button pairs (x8) | 4px | Various locations |
| 43 | AI Personas-Adjacent | 0px | LLM Hub |

### Visual & Layout Issues

| # | Screen | Issue | Impact |
|---|--------|-------|--------|
| 44 | Sidebar | Email text truncation | User identity unclear |
| 45 | Bottom Nav | Active state subtle | Hard to tell selected tab |
| 46 | OmniBar | Submit disabled state unclear | Users unsure if ready |
| 47 | Settings | Card overflow on small screens | Content clips |
| 48 | My Company | Tab bar horizontal scroll hidden | Can't see all tabs |
| 49 | Conversation List | Group headers too prominent | Visual hierarchy off |
| 50 | Chat Input | Placeholder text wraps poorly | Text cut off |
| 51 | Theme Toggle | Position conflicts with content | Overlaps on some screens |
| 52 | Help Button | Hidden on mobile | Can't access help |
| 53 | Leaderboard | Dense data on mobile | Hard to read |
| 54 | Admin Portal | Not mobile optimized | Desktop-only experience |
| 55 | Settings | Form elements cramped | Hard to tap accurately |
| 56 | Team Tab | Member list scrolls awkwardly | Nested scroll conflict |
| 57 | API Keys | Accordion collapse jerky | Animation not smooth |
| 58 | Billing | Plan cards don't stack | Horizontal scroll needed |
| 59 | Developer | Toggle switches small | Hard to tap |
| 60 | LLM Hub | Cards too wide for mobile | Horizontal overflow |

### Scroll Behavior Issues

| # | Screen | Issue | Impact |
|---|--------|-------|--------|
| 61 | Sidebar | Scroll momentum too fast | Hard to stop at desired item |
| 62 | Conversation List | No pull-to-refresh | Users expect this gesture |
| 63 | Settings | Can't scroll inside modal on iOS | Content inaccessible |
| 64 | My Company | Tab content scroll resets | Loses position on tab switch |
| 65 | Chat History | Scroll jumps on new messages | Disorienting |
| 66 | Bottom Sheet | Drag blocks inner scroll | Can't scroll content |
| 67 | Dropdown Menus | Options list not scrollable | Long lists cut off |
| 68 | Search Results | No scroll indicator | Users don't know more exists |
| 69 | Notifications | Auto-dismiss too fast | Can't read content |

### Interaction Feedback Issues

| # | Element | Issue | Impact |
|---|---------|-------|--------|
| 70 | All Buttons | No haptic feedback | Feels unresponsive |
| 71 | Radio Buttons | No visual ripple | Unclear if tapped |
| 72 | Tab Switches | Transition too slow | Laggy feel |
| 73 | Form Inputs | No focus animation | Unclear which field active |
| 74 | Links | No touch state | No tap feedback |
| 75 | Cards | No press state | Feels dead |
| 76 | Swipeable Rows | No swipe hints | Users don't discover |
| 77 | Long Press | No context menu | Missing mobile pattern |
| 78 | Submit Button | Loading state unclear | Users tap multiple times |
| 79 | Delete Actions | No undo option | Anxiety-inducing |
| 80 | Navigation | No back gesture | Can't swipe back |
| 81 | Dialogs | No swipe to dismiss | Unexpected behavior |
| 82 | Tooltips | Show on hover (no hover on mobile) | Never visible |
| 83 | Dropdowns | Open delay | Feels laggy |
| 84 | Accordions | Expand too fast | No anticipation |
| 85 | Checkboxes | Hit area doesn't include label | Miss-taps |
| 86 | Date Pickers | Uses browser default | Inconsistent experience |
| 87 | Error Messages | No shake animation | Easy to miss |
| 88 | Success States | Too subtle | Users unsure if saved |
| 89 | Progress Indicators | No percentage | Unclear progress |

---

## P3 - MINOR ISSUES (61)

Polish issues for native-quality feel.

### Typography Issues

| # | Location | Issue |
|---|----------|-------|
| 90 | Headers | Letter-spacing too tight |
| 91 | Body Text | Line-height inconsistent |
| 92 | Buttons | Font-weight varies |
| 93 | Labels | Case inconsistent (Title vs sentence) |
| 94 | Timestamps | Hard to read (gray on gray) |
| 95 | Badges | Text doesn't fit |
| 96 | Tab Labels | Truncate without ellipsis |
| 97 | Empty States | Text too small |
| 98 | Error Messages | All caps shouting |
| 99 | Placeholder Text | Too light |
| 100 | Input Labels | Float animation janky |

### Spacing & Alignment Issues

| # | Location | Issue |
|---|----------|-------|
| 101 | Cards | Padding inconsistent |
| 102 | Lists | Item spacing varies |
| 103 | Icons | Not vertically centered |
| 104 | Buttons | Text not centered |
| 105 | Headers | Bottom margin inconsistent |
| 106 | Sections | Top padding varies |
| 107 | Forms | Label-input gap varies |
| 108 | Modals | Content padding differs |
| 109 | Tabs | Active indicator misaligned |
| 110 | Badges | Position varies |

### Color & Contrast Issues

| # | Location | Issue |
|---|----------|-------|
| 111 | Secondary Text | Contrast ratio low |
| 112 | Disabled States | Too similar to enabled |
| 113 | Focus Rings | Not visible on dark theme |
| 114 | Links | Color doesn't meet AA |
| 115 | Borders | Too subtle |
| 116 | Shadows | Missing on elevated elements |
| 117 | Hover States | N/A on mobile (wasted) |
| 118 | Selected Items | Low contrast |
| 119 | Error States | Red too harsh |
| 120 | Success States | Green hard to see |

### Animation & Transition Issues

| # | Location | Issue |
|---|----------|-------|
| 121 | Page Transitions | No exit animation |
| 122 | Modal Open | Slightly janky |
| 123 | Dropdown | Appears instantly |
| 124 | Tab Switch | Content jumps |
| 125 | Scroll | Momentum curve off |
| 126 | Button Press | Release too slow |
| 127 | Card Reveal | No stagger effect |
| 128 | Skeleton Loaders | Shimmer too fast |
| 129 | Toast Exit | Fades too quickly |
| 130 | Accordion | No ease-out |

### Keyboard & Input Issues

| # | Location | Issue |
|---|----------|-------|
| 131 | Search | Wrong keyboard type |
| 132 | Email Field | Doesn't show @ key |
| 133 | Number Field | Full keyboard instead of numpad |
| 134 | URL Field | No .com key |
| 135 | Password | No show/hide toggle |
| 136 | Multiline | Doesn't expand smoothly |
| 137 | Autocomplete | Suggestions popup wrong position |
| 138 | Clear Button | Missing on inputs |
| 139 | Done Button | Missing on keyboard |
| 140 | Next Field | Tab order wrong |

### Accessibility Issues

| # | Location | Issue |
|---|----------|-------|
| 141 | Images | Missing alt text |
| 142 | Icons | No aria-label |
| 143 | Dynamic Content | No aria-live |
| 144 | Modals | Focus trap incomplete |
| 145 | Skip Links | Visually hidden wrong |
| 146 | Landmarks | Missing main landmark |
| 147 | Headings | Hierarchy broken |
| 148 | Tables | No scope attributes |
| 149 | Forms | No fieldset grouping |
| 150 | Errors | Not announced to screen readers |

---

## Test Coverage Summary

| Area | Tested | Issues Found |
|------|--------|--------------|
| Main Chat | Yes | 23 |
| Sidebar | Yes | 18 |
| Settings (6 tabs) | Yes | 31 |
| My Company (7 tabs) | Partial | 19 |
| Bottom Navigation | Yes | 8 |
| Forms & Inputs | Yes | 22 |
| Modals & Sheets | Yes | 14 |
| Scroll Behaviors | Yes | 9 |
| Touch Targets | Yes | 19 |

---

## Viewports Tested

| Viewport | Resolution | Issues Specific |
|----------|------------|-----------------|
| iPhone SE | 320x568 | Content overflow, text truncation |
| iPhone 14 | 390x844 | Primary test viewport |
| Pixel 7 | 412x915 | Similar to iPhone 14 |
| iPad | 768x1024 | My Company panel broken |

---

## Priority Remediation Plan

### Immediate (P0 - Week 1)
1. Fix Overview tab rendering
2. Fix Activity tab API loading
3. Fix Usage tab API error
4. Fix My Company bottom nav navigation
5. Fix empty buttons in conversation list
6. Add navigation timeout handling

### Short-term (P1 - Week 2-3)
1. Increase all touch targets to 44x44px minimum
2. Fix button spacing to 8px minimum
3. Increase small font sizes to 12px minimum
4. Add proper form labels and autocomplete

### Medium-term (P2 - Week 4-6)
1. Fix scroll behaviors
2. Add haptic feedback
3. Improve visual feedback on interactions
4. Fix layout issues on various viewports

### Long-term (P3 - Ongoing)
1. Polish animations
2. Improve accessibility
3. Refine typography
4. Optimize performance

---

## Agent Routing

Issues to route to specialized agents:

| Agent | Issue IDs |
|-------|-----------|
| css-enforcer | 28-30, 44-60, 90-130 |
| mobile-ux-tester | 1-8, 61-89 |
| performance-profiler | 5, 34 |
| rls-auditor | 2, 3 (API failures) |
| type-checker | 6 (empty button types) |
| test-runner | All P0 issues |

---

## Screenshots Reference

Screenshots were taken during testing at:
- iPhone 14 (390x844) - Primary viewport
- Tablet (768x1024) - Layout break viewport

---

## Conclusion

The AxCouncil mobile experience requires significant work to meet $25M exit standards. The 8 P0 blocking issues must be addressed immediately as they prevent core functionality. The 19 touch target violations and 14 button spacing issues represent the most common pattern of failures.

**Recommendation**: Prioritize P0 and P1 issues before any new feature development. Consider a mobile-first redesign sprint focused on touch interactions.

---

*Report generated by mobile-ux-tester agent via Chrome DevTools MCP*
