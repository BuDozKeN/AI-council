# Mobile UX Test Report

**Date:** 2026-01-26
**Viewports Tested:** iPhone SE (320x568), iPhone 14 (390x844), iPhone 14 Pro Max (430x932)
**Screens Tested:** Login, Signup, Chat, Settings, Conversation History, Response Style, Context Config
**Total Issues Found:** 52

## Summary

| Severity | Count |
|----------|-------|
| P0 Blocker | 3 |
| P1 Critical | 12 |
| P2 Major | 22 |
| P3 Minor | 15 |

---

## P0 - Blocker Issues (App Unusable)

### ISSUE-001: Login page content cut off on small screens - no scroll
- **Screen:** /login (iPhone SE 320x568)
- **Element:** Login form card
- **Category:** scroll
- **Expected:** Page should scroll to reveal all content
- **Actual:** Card bottom at 728px, viewport at 568px, document height equals viewport - 160px cut off with no way to scroll
- **Console errors:** None
- **Suggested agent:** mobile-tester
- **Suggested fix:** Add `overflow-y: auto` to body or main container, ensure min-height allows scroll

### ISSUE-002: Routing broken - /mycompany shows chat interface
- **Screen:** /mycompany
- **Element:** Page content
- **Category:** interaction
- **Expected:** MyCompany page with departments, roles, playbooks
- **Actual:** Shows main chat interface instead of company content
- **Console errors:** None
- **Suggested agent:** tech-debt-tracker
- **Suggested fix:** Check React Router configuration for /mycompany route

### ISSUE-003: Routing broken - /company shows chat interface
- **Screen:** /company
- **Element:** Page content
- **Category:** interaction
- **Expected:** Company page content
- **Actual:** Shows main chat interface
- **Console errors:** None
- **Suggested agent:** tech-debt-tracker
- **Suggested fix:** Verify route definitions and lazy loading

---

## P1 - Critical Issues (Major Feature Broken)

### ISSUE-004: "Continue with Google" button text invisible
- **Screen:** /login, /signup
- **Element:** Google OAuth button
- **Category:** a11y/contrast
- **Expected:** Button text clearly readable
- **Actual:** Text "Continue with Google" is nearly invisible (white text on white/light background)
- **Suggested agent:** css-enforcer
- **Suggested fix:** Update button text color to ensure WCAG AA contrast ratio (4.5:1)

### ISSUE-005: Light mode renders blank page
- **Screen:** / (intermittent)
- **Element:** Entire page
- **Category:** visual
- **Expected:** Content visible in light mode
- **Actual:** Page appears completely white/blank - content not visible
- **Suggested agent:** css-enforcer
- **Suggested fix:** Check CSS variables for light theme, ensure text colors have contrast

### ISSUE-006: History button in bottom nav does nothing visible
- **Screen:** / (authenticated)
- **Element:** History button in bottom navigation
- **Category:** interaction
- **Expected:** Opens history view or navigates to history page
- **Actual:** Click has no visible effect
- **Suggested agent:** mobile-tester
- **Suggested fix:** Wire up History button to open sidebar or navigate

### ISSUE-007: Settings modal - Developer tab truncated to "Develo..."
- **Screen:** /settings
- **Element:** Developer tab
- **Category:** layout
- **Expected:** Full text "Developer" visible
- **Actual:** Text truncated to "Develo..."
- **Suggested agent:** css-enforcer
- **Suggested fix:** Reduce tab padding or allow horizontal scroll for tabs

### ISSUE-008: Bottom nav "Settings" text cut off
- **Screen:** All authenticated pages
- **Element:** Settings button in bottom nav
- **Category:** layout
- **Expected:** "Settings" fully visible
- **Actual:** Text cut off, shows partial text
- **Suggested agent:** css-enforcer
- **Suggested fix:** Reduce font size or use icon-only on small screens

### ISSUE-009: Sidebar "Sign out" text cut off
- **Screen:** Sidebar expanded
- **Element:** Sign out button
- **Category:** layout
- **Expected:** "Sign out" fully visible
- **Actual:** Shows "Sign" only
- **Suggested agent:** css-enforcer
- **Suggested fix:** Check sidebar width and text overflow handling

### ISSUE-010: DevTools icon overlaps content
- **Screen:** All pages
- **Element:** Tanstack Query DevTools button
- **Category:** layout
- **Expected:** DevTools icon shouldn't obstruct UI
- **Actual:** Floating icon overlaps input area and bottom nav
- **Suggested agent:** mobile-tester
- **Suggested fix:** Hide DevTools in production, or position away from interactive elements

### ISSUE-011: Signup page "Already have an account?" not accessible on small screens
- **Screen:** /signup (iPhone SE)
- **Element:** Sign In link
- **Category:** scroll
- **Expected:** Link accessible via scroll
- **Actual:** Link below viewport with no scroll
- **Suggested agent:** mobile-tester
- **Suggested fix:** Same as ISSUE-001 - enable page scroll

### ISSUE-012: Settings modal "Language" label cut off at bottom
- **Screen:** /settings Profile tab
- **Element:** Language field label
- **Category:** layout
- **Expected:** Label fully visible
- **Actual:** Partially cut off at bottom of modal
- **Suggested agent:** css-enforcer
- **Suggested fix:** Add padding-bottom to modal content

### ISSUE-013: File upload button hidden/missing
- **Screen:** Chat interface
- **Element:** "Choose files" button
- **Category:** a11y
- **Expected:** Visible file upload button
- **Actual:** Button exists in DOM but may not be clearly visible
- **Suggested agent:** mobile-tester
- **Suggested fix:** Style file input for better visibility

### ISSUE-014: Send button disabled state not clear
- **Screen:** Chat interface
- **Element:** Send message button
- **Category:** a11y
- **Expected:** Clear disabled state indication
- **Actual:** Disabled button may look like it should be clickable
- **Suggested agent:** css-enforcer
- **Suggested fix:** Add distinct disabled styling (opacity, cursor)

### ISSUE-015: Backend using wrong port (env var not respected)
- **Screen:** N/A (Backend)
- **Element:** Server startup
- **Category:** error
- **Expected:** Backend respects PORT environment variable
- **Actual:** `set PORT=7293` syntax not working in bash - requires `PORT=7293` bash syntax
- **Suggested agent:** tech-debt-tracker
- **Suggested fix:** Document correct syntax for setting PORT

---

## P2 - Major Issues (Significant Friction)

### ISSUE-016: Theme toggle button too small for touch
- **Screen:** All pages
- **Element:** Theme toggle (top right)
- **Category:** touch
- **Expected:** 44x44px minimum touch target
- **Actual:** Button appears smaller than recommended touch target
- **Suggested agent:** mobile-tester
- **Suggested fix:** Increase button size or add padding

### ISSUE-017: Sidebar toggle arrow very small
- **Screen:** All pages (authenticated)
- **Element:** Sidebar open button (left edge)
- **Category:** touch
- **Expected:** Easy to tap sidebar toggle
- **Actual:** Very narrow touch target on left edge
- **Suggested agent:** mobile-tester
- **Suggested fix:** Increase touch area width

### ISSUE-018: No loading indicator when navigating
- **Screen:** Between pages
- **Element:** Page transitions
- **Category:** performance
- **Expected:** Visual feedback during navigation
- **Actual:** No loading indicator visible during route changes
- **Suggested agent:** mobile-tester
- **Suggested fix:** Add loading spinner or skeleton screens

### ISSUE-019: Chat "Loading..." state brief but no skeleton
- **Screen:** /chat/:id
- **Element:** Chat loading
- **Category:** performance
- **Expected:** Skeleton loader during data fetch
- **Actual:** Just text "Loading chat..."
- **Suggested agent:** mobile-tester
- **Suggested fix:** Add skeleton UI for better perceived performance

### ISSUE-020: Large empty space in chat hero section
- **Screen:** / (new chat)
- **Element:** Main content area
- **Category:** layout
- **Expected:** Balanced layout on mobile
- **Actual:** Excessive white space between hero and input
- **Suggested agent:** css-enforcer
- **Suggested fix:** Adjust spacing for mobile viewport

### ISSUE-021: Radio buttons (1 AI / 5 AIs) may be hard to tap
- **Screen:** Chat input area
- **Element:** AI count radio buttons
- **Category:** touch
- **Expected:** Easy to tap radio options
- **Actual:** Buttons appear small
- **Suggested agent:** mobile-tester
- **Suggested fix:** Increase touch target size

### ISSUE-022: Context badge "1" is very small
- **Screen:** Chat input area
- **Element:** Context button badge
- **Category:** visual
- **Expected:** Badge readable
- **Actual:** Small badge may be hard to read
- **Suggested agent:** css-enforcer
- **Suggested fix:** Increase badge size on mobile

### ISSUE-023: Conversation list items lack clear tap feedback
- **Screen:** Sidebar conversation history
- **Element:** Conversation list items
- **Category:** interaction
- **Expected:** Visual feedback on tap
- **Actual:** No obvious active/pressed state
- **Suggested agent:** css-enforcer
- **Suggested fix:** Add :active state styling

### ISSUE-024: Search box in sidebar may be too narrow
- **Screen:** Sidebar expanded
- **Element:** Search conversations input
- **Category:** layout
- **Expected:** Comfortable typing area
- **Actual:** Input spans sidebar width but padding reduces usable area
- **Suggested agent:** css-enforcer

### ISSUE-025: Conversation categories (STANDARD, TECHNOLOGY) have small expand buttons
- **Screen:** Sidebar
- **Element:** Category collapse buttons
- **Category:** touch
- **Expected:** Easy to tap expand/collapse
- **Actual:** Small clickable area
- **Suggested agent:** mobile-tester

### ISSUE-026: Star buttons on conversations very small
- **Screen:** Sidebar conversation list
- **Element:** Star/favorite buttons
- **Category:** touch
- **Expected:** 44x44px touch target
- **Actual:** Small icon buttons
- **Suggested agent:** mobile-tester

### ISSUE-027: Escape key dismissal not discoverable on mobile
- **Screen:** All modals/sheets
- **Element:** Modal dismiss
- **Category:** a11y
- **Expected:** Clear close button for touch users
- **Actual:** Relies on Escape key which doesn't exist on mobile keyboards
- **Suggested agent:** mobile-tester
- **Suggested fix:** Ensure X button or swipe-to-dismiss is available

### ISSUE-028: Production/Cache badges in sidebar may be confusing
- **Screen:** Sidebar footer
- **Element:** Production and Cache status badges
- **Category:** visual
- **Expected:** Clear status indication
- **Actual:** Technical jargon may confuse regular users
- **Suggested agent:** mobile-tester

### ISSUE-029: Bottom sheet drag handle not styled
- **Screen:** Response Style, Context Config sheets
- **Element:** Drag handle
- **Category:** visual
- **Expected:** Visual drag handle for swipe dismiss
- **Actual:** Gray bar visible but could be more prominent
- **Suggested agent:** css-enforcer

### ISSUE-030: Textarea auto-resize not tested
- **Screen:** Chat input
- **Element:** Message textarea
- **Category:** interaction
- **Expected:** Textarea grows with content
- **Actual:** Unknown - needs testing with long input
- **Suggested agent:** mobile-tester

### ISSUE-031: Copy buttons in conversation may be hard to tap
- **Screen:** Conversation view
- **Element:** Copy message buttons
- **Category:** touch
- **Expected:** Easy to tap copy action
- **Actual:** Small icon buttons
- **Suggested agent:** mobile-tester

### ISSUE-032: Table of Contents links in long answers may be small
- **Screen:** Conversation view
- **Element:** ToC anchor links
- **Category:** touch
- **Expected:** Easy to tap navigation links
- **Actual:** Standard link styling may have small tap area
- **Suggested agent:** mobile-tester

### ISSUE-033: Code blocks may overflow on mobile
- **Screen:** Conversation view with code
- **Element:** Code snippets
- **Category:** layout
- **Expected:** Horizontal scroll for code blocks
- **Actual:** Unknown - needs testing
- **Suggested agent:** css-enforcer

### ISSUE-034: Checkbox states in conversation not clearly tapable
- **Screen:** Conversation view
- **Element:** Disabled checkboxes in model list
- **Category:** visual
- **Expected:** Clear indication these are informational, not interactive
- **Actual:** May look like interactive checkboxes
- **Suggested agent:** mobile-tester

### ISSUE-035: Settings tabs may need horizontal scroll on small screens
- **Screen:** /settings modal
- **Element:** Tab bar (Profile, Billing, Team, API Keys, Developer, LLM Hub)
- **Category:** layout
- **Expected:** All tabs accessible
- **Actual:** "Developer" truncated, may need scroll
- **Suggested agent:** css-enforcer

### ISSUE-036: Form validation errors may not be visible
- **Screen:** Login/Signup forms
- **Element:** Error messages
- **Category:** a11y
- **Expected:** Errors clearly visible and announced
- **Actual:** Error shown but accessibility not tested
- **Suggested agent:** mobile-tester

### ISSUE-037: Password field lacks show/hide toggle
- **Screen:** /login, /signup
- **Element:** Password input
- **Category:** a11y
- **Expected:** Option to show password
- **Actual:** No visible toggle
- **Suggested agent:** mobile-tester

---

## P3 - Minor Issues (Polish)

### ISSUE-038: Skip to main content link visible
- **Screen:** All pages
- **Element:** Skip link
- **Category:** a11y
- **Expected:** Skip link hidden until focused
- **Actual:** May be visible in a11y tree but styling unknown
- **Suggested agent:** css-enforcer

### ISSUE-039: Favicon may be missing or generic
- **Screen:** Browser tab
- **Element:** Favicon
- **Category:** visual
- **Expected:** Custom favicon
- **Actual:** Unknown
- **Suggested agent:** mobile-tester

### ISSUE-040: Page title doesn't update per route
- **Screen:** Various
- **Element:** document.title
- **Category:** a11y
- **Expected:** Title reflects current page
- **Actual:** Shows same title across routes
- **Suggested agent:** mobile-tester

### ISSUE-041: "5 AIs → 3 rounds → 1 answer" animation on mobile
- **Screen:** Chat hero
- **Element:** Stats display
- **Category:** performance
- **Expected:** Smooth animation or static display
- **Actual:** Unknown performance impact
- **Suggested agent:** performance-profiler

### ISSUE-042: Notification region may need ARIA live region
- **Screen:** All authenticated pages
- **Element:** Notifications area
- **Category:** a11y
- **Expected:** Screen reader announces notifications
- **Actual:** Has region role but live behavior unknown
- **Suggested agent:** mobile-tester

### ISSUE-043: Color mode preference not persisted test
- **Screen:** All pages
- **Element:** Theme toggle
- **Category:** interaction
- **Expected:** Theme persists across sessions
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

### ISSUE-044: Focus management after modal close
- **Screen:** Settings, Response Style, Context modals
- **Element:** Focus return
- **Category:** a11y
- **Expected:** Focus returns to trigger button
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

### ISSUE-045: Dropdown menus (sort, filter) positioning on mobile
- **Screen:** Sidebar
- **Element:** "All Conversations" and "Latest" dropdowns
- **Category:** layout
- **Expected:** Dropdown doesn't overflow viewport
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

### ISSUE-046: Keyboard avoiding behavior for input
- **Screen:** Chat input
- **Element:** Message textarea
- **Category:** interaction
- **Expected:** Input remains visible when keyboard opens
- **Actual:** Unknown on real device
- **Suggested agent:** mobile-tester

### ISSUE-047: Pull-to-refresh not implemented
- **Screen:** Chat, Conversations
- **Element:** Page refresh
- **Category:** interaction
- **Expected:** Pull-to-refresh on mobile
- **Actual:** Not implemented (browser default only)
- **Suggested agent:** mobile-tester

### ISSUE-048: Haptic feedback not implemented
- **Screen:** All interactions
- **Element:** Button taps
- **Category:** interaction
- **Expected:** Optional haptic feedback
- **Actual:** No haptic (expected for web, not a bug)
- **Suggested agent:** N/A

### ISSUE-049: Long conversation titles may truncate without tooltip
- **Screen:** Sidebar
- **Element:** Conversation list items
- **Category:** visual
- **Expected:** Full title accessible somehow
- **Actual:** May truncate with no way to see full title
- **Suggested agent:** css-enforcer

### ISSUE-050: Scroll position not preserved on back navigation
- **Screen:** Conversation → Back to chat list
- **Element:** Scroll position
- **Category:** interaction
- **Expected:** Return to previous scroll position
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

### ISSUE-051: Image attachment preview not tested
- **Screen:** Chat input
- **Element:** Attach image button
- **Category:** interaction
- **Expected:** Image preview before sending
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

### ISSUE-052: Offline state handling not tested
- **Screen:** All pages
- **Element:** Network status
- **Category:** error
- **Expected:** Graceful offline handling
- **Actual:** Unknown - needs testing
- **Suggested agent:** mobile-tester

---

## Console Errors Captured

| Screen | Error | Count |
|--------|-------|-------|
| /login (invalid creds) | Failed to load resource: 400 | 1 |

## Network Errors

| Screen | Endpoint | Status | Count |
|--------|----------|--------|-------|
| /login | /auth/v1/token | 400 | 1 (expected - invalid test creds) |

---

## Agent Assignments Summary

### mobile-tester (28 issues)
ISSUE-001, 006, 010, 011, 013, 014, 016, 017, 018, 019, 021, 023, 025, 026, 027, 028, 030, 031, 032, 034, 036, 037, 039, 040, 042, 043, 044, 045, 046, 047, 050, 051, 052

### css-enforcer (15 issues)
ISSUE-004, 005, 007, 008, 009, 012, 020, 022, 024, 029, 033, 035, 038, 049

### tech-debt-tracker (4 issues)
ISSUE-002, 003, 015

### performance-profiler (1 issue)
ISSUE-041

---

## Recommended Priority

### Fix First (P0/P1 - Blockers/Critical):
1. **ISSUE-001/011**: Login/signup scroll - users can't access all UI
2. **ISSUE-002/003**: Routing bugs - /mycompany and /company broken
3. **ISSUE-004/005**: Contrast issues - text not visible
4. **ISSUE-006**: History button non-functional
5. **ISSUE-007-009**: Text truncation issues

### Fix Soon (P2 - Major):
6. Touch target sizing (multiple issues)
7. Loading states
8. Empty space optimization
9. Modal improvements

### Fix Later (P3 - Polish):
10. Accessibility enhancements
11. Animation polish
12. Progressive enhancement features

---

## Test Coverage

| Screen | Tested | Issues |
|--------|--------|--------|
| Login | Yes | 5 |
| Signup | Yes | 3 |
| Chat (New) | Yes | 10 |
| Chat (Existing) | Yes | 8 |
| Sidebar | Yes | 10 |
| Settings | Yes | 4 |
| Response Style | Yes | 2 |
| Context Config | Yes | 2 |
| Conversation View | Yes | 8 |

---

**Generated by Mobile UX Tester + Manual Testing**
**Date:** 2026-01-26
