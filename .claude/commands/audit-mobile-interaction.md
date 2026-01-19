# Mobile Interaction Behavior Audit - Touch Gesture & Navigation Testing

You are a mobile QA engineer conducting BEHAVIORAL testing on a $25M mobile-first product. This is NOT a visual audit - this is about **how the app responds to real human finger interactions**.

**Standard**: Revolut, Monzo, Linear mobile apps. If a gesture feels wrong or unexpected, it fails.

---

## Why This Audit Exists

Visual audits miss critical issues:
- Elements disappearing when they shouldn't
- Scroll hijacking (page scrolls wrong direction)
- Accidental dismissal (modals closing unexpectedly)
- Gesture conflicts (swipe-to-dismiss blocking scroll)
- Dead zones where taps don't register
- Erratic behaviors that frustrate users

**The goal**: Simulate a real human using their thumb to navigate, and catch EVERY unexpected behavior.

---

## Pre-Audit Setup

### 1. Chrome DevTools Mobile Emulation

```
REQUIRED STEPS:
1. Ensure dev.bat or start-chrome-debug.bat is running
2. Navigate to http://localhost:5173
3. Open DevTools (F12)
4. Toggle Device Toolbar (Ctrl+Shift+M)
5. Select: iPhone 14 Pro (390x844)
6. Enable: Touch simulation
7. Throttle: Mid-tier mobile (optional but recommended)
```

### 2. Test Viewports

Test ALL of these viewports:
```
- iPhone SE:       320x568  (smallest common)
- iPhone 14:       390x844  (standard)
- iPhone 14 Pro Max: 430x932  (largest)
- Pixel 7:         412x915  (Android standard)
- Tablet:          768x1024 (iPad portrait)
```

### 3. Authentication

If the app requires login:
1. Check `.env` for `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD`
2. Auto-login using those credentials
3. Never ask user for credentials

---

## Part 1: Scroll Behavior Testing

For EACH scrollable area in the app, test these behaviors:

### 1.1 Vertical Scroll

```
Test Actions:
1. Swipe UP slowly (finger drag)
2. Swipe UP quickly (flick)
3. Swipe DOWN slowly
4. Swipe DOWN quickly
5. Stop scroll mid-momentum (touch to stop)
6. Scroll to top boundary (rubber-band/bounce)
7. Scroll to bottom boundary

Expected Behaviors:
- [ ] Scroll follows finger precisely (no lag)
- [ ] Momentum feels natural (iOS-like deceleration)
- [ ] Can stop momentum with touch
- [ ] Boundaries have subtle bounce (not hard stop)
- [ ] No scroll hijacking (doesn't change direction)
- [ ] Content doesn't disappear during scroll
- [ ] Headers/footers stay fixed if intended
- [ ] No jank or stutter (60fps)

Red Flags:
- Scroll jumps or stutters
- Scroll in wrong direction
- Content flashes/disappears
- Can't stop momentum
- Sticky elements don't stick
```

### 1.2 Horizontal Scroll (Carousels, Tabs)

```
Test Actions:
1. Swipe LEFT on carousel/tabs
2. Swipe RIGHT on carousel/tabs
3. Partial swipe (don't complete)
4. Fast flick through multiple items

Expected Behaviors:
- [ ] Swipe sensitivity appropriate (not too sensitive)
- [ ] Snaps to items cleanly
- [ ] Partial swipe returns to original position
- [ ] Doesn't conflict with vertical scroll
- [ ] Visual indicator of scroll position
- [ ] Can't over-scroll past boundaries

Red Flags:
- Vertical scroll when trying to swipe horizontally
- Items don't snap cleanly
- Gets stuck between items
```

### 1.3 Nested Scroll Areas

```
Test Actions:
1. Find scroll-within-scroll (modal with list, etc.)
2. Scroll the inner area
3. Try to scroll outer area from inner
4. Scroll to inner boundary, keep scrolling

Expected Behaviors:
- [ ] Inner scroll takes priority when active
- [ ] Can escape to outer scroll naturally
- [ ] No fighting between scroll areas
- [ ] Clear visual indication of which scrolls

Red Flags:
- Both areas scroll simultaneously
- Can't scroll inner area at all
- Stuck in inner scroll, can't exit
- Framer Motion drag conflicts with scroll
```

---

## Part 2: Tap/Touch Testing

### 2.1 Basic Tap Response

```
Test Actions (for EVERY interactive element):
1. Single tap (normal)
2. Tap and hold briefly
3. Tap edge of button
4. Tap rapidly multiple times
5. Tap while scrolling

Expected Behaviors:
- [ ] Immediate visual feedback (<100ms)
- [ ] No 300ms tap delay
- [ ] Edge taps register correctly
- [ ] Double-tap doesn't cause issues
- [ ] Tap during scroll is ignored (scroll priority)

Red Flags:
- Delay before action
- No visual feedback
- Edge taps miss
- Accidental double-actions
- Tap registers as scroll
```

### 2.2 Touch Target Size

```
Minimum Requirements:
- Interactive elements: 44x44px (Apple HIG)
- Spacing between targets: 8px minimum
- Thumb zone: Critical actions in bottom 1/3

Test Actions:
1. Measure touch targets in DevTools
2. Try tapping close together buttons
3. Test with simulated "fat finger"

Red Flags:
- Touch target < 44px
- Buttons too close together
- Important actions in hard-to-reach areas
```

### 2.3 Long Press

```
Test Actions:
1. Long press on text (should select)
2. Long press on buttons (should NOT trigger)
3. Long press on images
4. Long press on list items

Expected Behaviors:
- [ ] Text selection works
- [ ] Context menu appears where appropriate
- [ ] Buttons don't trigger on long press
- [ ] Clear feedback during long press
```

---

## Part 3: Modal/Overlay Behavior

### 3.1 Modal Dismissal

```
Test Actions:
1. Tap outside modal (overlay area)
2. Swipe down on modal header
3. Press back button (Android)
4. Press X button
5. Complete action (should close)

Expected Behaviors:
- [ ] ALL methods work to close
- [ ] Only ONE modal closes at a time (not whole stack)
- [ ] Animation is smooth
- [ ] No data loss on dismiss
- [ ] Focus returns to previous element

Red Flags:
- Modal closes unexpectedly
- Can't close modal (trapped)
- Multiple modals close at once
- Focus goes somewhere unexpected
- ThemeToggle/HelpButton clicks close modal
```

### 3.2 Bottom Sheet Behavior

```
Test Actions:
1. Swipe down on drag handle
2. Swipe down 60px+ (should dismiss)
3. Swipe down 30px (should snap back)
4. Tap on drag handle
5. Scroll content inside bottom sheet
6. Scroll to top, keep scrolling up

Expected Behaviors:
- [ ] Drag handle clearly visible
- [ ] Swipe threshold feels right
- [ ] Partial swipe snaps back
- [ ] Content scroll works inside
- [ ] Can't dismiss while scrolling content
- [ ] Smooth animation on dismiss

Red Flags:
- Can't scroll content inside
- Dismisses too easily
- Dismisses when trying to scroll
- No visual drag handle
- Framer Motion drag blocks scroll
```

### 3.3 Stacked Overlays

```
Test Actions:
1. Open modal
2. Open another modal from first
3. Tap outside
4. Close inner modal
5. Close outer modal

Expected Behaviors:
- [ ] Can stack modals if design allows
- [ ] Each closes independently
- [ ] Background modals dim appropriately
- [ ] Can navigate back through stack

Red Flags:
- Whole stack closes on outside tap
- Z-index issues (wrong modal on top)
- Can interact with background modal
```

---

## Part 4: Navigation Gestures

### 4.1 Swipe Navigation

```
Test Actions:
1. Swipe from left edge (back gesture)
2. Swipe from right edge (forward if applicable)
3. Swipe partially (should cancel)

Expected Behaviors:
- [ ] Edge swipe recognized
- [ ] Visual preview during swipe
- [ ] Partial swipe cancels
- [ ] Animation matches native feel

Red Flags:
- Edge swipe not recognized
- Conflicts with content swipe
- No preview animation
```

### 4.2 Tab/Segment Navigation

```
Test Actions:
1. Tap each tab
2. Swipe between tabs (if supported)
3. Tap active tab
4. Rapid tab switching

Expected Behaviors:
- [ ] Immediate tab switch
- [ ] Active state clear
- [ ] Content transitions smoothly
- [ ] No flash of loading state
- [ ] State preserved when returning to tab

Red Flags:
- Delay on tab switch
- Content flashes/reloads
- Lost scroll position
- No active indicator
```

---

## Part 5: Form Interactions

### 5.1 Input Focus

```
Test Actions:
1. Tap input field
2. Check keyboard type (email, number, etc.)
3. Tap another field
4. Tap outside all fields
5. Submit form

Expected Behaviors:
- [ ] Keyboard appears
- [ ] Correct keyboard type
- [ ] Input scrolls into view
- [ ] Keyboard doesn't cover input
- [ ] Can dismiss keyboard

Red Flags:
- Input hidden by keyboard
- Wrong keyboard type
- Can't scroll while keyboard open
- Form jumps around
```

### 5.2 Dropdown/Select

```
Test Actions:
1. Tap select dropdown
2. Scroll options
3. Select option
4. Tap outside to close

Expected Behaviors:
- [ ] Native select OR custom bottom sheet on mobile
- [ ] Options scrollable if many
- [ ] Selection immediate
- [ ] Closes on selection
- [ ] Closes on outside tap (without closing parent modal)

Red Flags:
- Desktop dropdown on mobile
- Can't scroll options
- Parent modal closes when selecting
```

---

## Part 6: Specific Problem Patterns

These are KNOWN mobile interaction bugs. Test explicitly.

### 6.1 Framer Motion Drag Conflicts

```
If app uses Framer Motion (bottom sheets, drawers):

Test Actions:
1. Try scrolling inside draggable container
2. Try tapping buttons inside draggable
3. Mouse wheel scroll in bottom sheet

Expected Behaviors:
- [ ] Scroll works inside drag container
- [ ] Buttons respond to taps
- [ ] Mouse wheel works (for desktop testing)

Red Flags:
- Drag gesture steals scroll
- Buttons don't respond on mobile
- touch-action CSS conflicts
```

### 6.2 Fixed Position Element Conflicts

```
If app has ThemeToggle, HelpButton, or similar:

Test Actions:
1. Open a modal
2. Click fixed-position button
3. Modal should NOT close

Expected Behaviors:
- [ ] Fixed buttons work with modal open
- [ ] Modal stays open
- [ ] Button action completes

Red Flags:
- Modal closes when clicking fixed button
- Button action doesn't complete
```

### 6.3 Radix Dialog Outside Click

```
If using Radix UI dialogs:

Test Actions:
1. Open dialog
2. Click outside on overlay
3. Click on nested select dropdown
4. Close dropdown
5. Check if dialog is still open

Expected Behaviors:
- [ ] Overlay click closes dialog
- [ ] Nested dropdown doesn't close dialog
- [ ] Focus management correct

Red Flags:
- Dialog closes when dropdown closes
- Can't click nested interactive elements
```

---

## Part 7: Edge Cases

### 7.1 Device Rotation

```
Test Actions:
1. Use app in portrait
2. Rotate to landscape
3. Continue using
4. Rotate back

Expected Behaviors:
- [ ] Layout adapts or gracefully limits
- [ ] No data loss
- [ ] Scroll position preserved
- [ ] Modals reposition correctly

Red Flags:
- Layout breaks
- State lost
- Modal goes off-screen
```

### 7.2 Multi-Touch

```
Test Actions:
1. Pinch zoom gesture
2. Two-finger scroll
3. Touch with multiple fingers

Expected Behaviors:
- [ ] Pinch zoom disabled or intentional
- [ ] No accidental multi-touch actions
- [ ] UI doesn't break

Red Flags:
- Unintended zoom
- UI breaks with multi-touch
```

### 7.3 App Background/Foreground

```
Test Actions:
1. Use app
2. Switch to another app
3. Switch back

Expected Behaviors:
- [ ] State preserved
- [ ] No re-authentication needed
- [ ] Resume from same screen

Red Flags:
- Lost state
- Forced re-login
- Wrong screen shown
```

---

## Chrome DevTools Testing Commands

Use these tools during audit:

```javascript
// Take accessibility snapshot
mcp__chrome-devtools__take_snapshot

// Take screenshot for report
mcp__chrome-devtools__take_screenshot

// Simulate tap
mcp__chrome-devtools__click({ uid: "element-uid" })

// Fill input
mcp__chrome-devtools__fill({ uid: "element-uid", value: "text" })

// Hover (for testing hover states)
mcp__chrome-devtools__hover({ uid: "element-uid" })

// Press key
mcp__chrome-devtools__press_key({ key: "Escape" })

// Scroll - use evaluate_script for scroll testing
mcp__chrome-devtools__evaluate_script({
  function: `() => {
    const el = document.querySelector('.scroll-container');
    el.scrollTop += 100;
    return el.scrollTop;
  }`
})

// Check for gesture issues
mcp__chrome-devtools__list_console_messages

// Check network for failed requests
mcp__chrome-devtools__list_network_requests
```

---

## Output Format

### Mobile Interaction Score: [1-10]

### Gesture Feel Score: [1-10]
(How native does it feel? 10 = can't tell from native app)

### Critical Interaction Bugs (Severity 4)
| Screen | Behavior | Expected | Actual | Steps to Reproduce |
|--------|----------|----------|--------|-------------------|

### Major Interaction Issues (Severity 3)
| Screen | Behavior | Expected | Actual | Steps to Reproduce |
|--------|----------|----------|--------|-------------------|

### Minor Interaction Issues (Severity 2)
| Screen | Behavior | Expected | Actual | Steps to Reproduce |
|--------|----------|----------|--------|-------------------|

### Scroll Behavior Report
| Area | Vertical | Horizontal | Nested | Notes |
|------|----------|------------|--------|-------|

### Modal/Overlay Report
| Modal | Tap-Outside | Swipe-Dismiss | Stack Behavior | Issues |
|-------|-------------|---------------|----------------|--------|

### Touch Target Violations
| Element | Current Size | Location | Risk Level |
|---------|--------------|----------|------------|

### Gesture Conflict Report
| Component | Gesture | Conflicts With | Resolution |
|-----------|---------|----------------|------------|

### Screenshots
[Include screenshots of problematic behaviors]

### Test Coverage
| Area | Tested | Passed | Issues |
|------|--------|--------|--------|
| Main Chat | [ ] | [ ] | |
| Sidebar | [ ] | [ ] | |
| Modals | [ ] | [ ] | |
| Bottom Sheets | [ ] | [ ] | |
| Settings | [ ] | [ ] | |
| MyCompany | [ ] | [ ] | |
| Forms | [ ] | [ ] | |
| Dropdowns | [ ] | [ ] | |

### Priority Fixes

1. **P0 - Blocking**: App unusable on mobile
2. **P1 - Critical**: Major friction, users will complain
3. **P2 - Major**: Annoying but usable
4. **P3 - Minor**: Polish for native feel

---

## Quick Reference: Common Fixes

### Framer Motion Drag Blocking Scroll
```css
.scroll-container {
  touch-action: pan-y !important;
}
```

### Touch Targets Too Small
```css
button {
  min-height: 44px;
  min-width: 44px;
}
```

### Modal Closes on Fixed Button Click
```tsx
// Set timestamp on pointer down
(window as any).__buttonClickTime = Date.now();

// Check in modal onClose
if (Date.now() - window.__buttonClickTime < 500) return;
```

### Select Closes Parent Modal
```tsx
// Already implemented in select.tsx via __radixSelectJustDismissed
```

---

## Sources & Best Practices

Research from:
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [Thumb Zone UX 2025](https://medium.com/design-bootcamp/the-thumb-zone-ux-in-2025-why-your-mobile-app-needs-to-rethink-ergonomics-now-9d1828f42bd9)
- [Accidental Overlay Dismissal - NN/g](https://www.nngroup.com/articles/accidental-overlay-dismissal/)
- [Scrolljacking 101 - NN/g](https://www.nngroup.com/articles/scrolljacking-101/)
- [Handling Accidental Taps - Baymard](https://baymard.com/blog/handling-accidental-taps-on-touch-devices)
- [Gesture Navigation Impact on UX](https://www.sidekickinteractive.com/designing-your-app/how-gesture-navigation-impacts-mobile-ux/)

---

**Remember**: A $25M mobile product must feel like it was built mobile-first, not adapted from desktop. Every gesture should feel intentional, responsive, and natural.
