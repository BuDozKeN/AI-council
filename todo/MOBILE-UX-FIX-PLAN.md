# Mobile UX Fix Plan - AxCouncil
## Priority-Based Remediation for $25M Exit Readiness

**Created**: 2026-01-26
**Target Completion**: 2 weeks for P0-P1, 4 weeks for P2
**Total Issues**: ~550+

---

## Phase 1: Critical Navigation Fixes (P0-P1)
**Timeline**: Days 1-3
**Goal**: Make the app actually usable on mobile

### 1.1 Fix My Company Navigation Bug
**File**: `frontend/src/components/ui/MobileBottomNav.tsx`
**Issue**: Clicking "My Company" opens Settings instead
**Root Cause**: Likely incorrect onClick handler or route

```tsx
// CHECK: Verify the onClick handler routes correctly
<button onClick={() => navigate('/my-company')}>
  My Company
</button>
```

**Steps**:
1. Open `MobileBottomNav.tsx`
2. Find the My Company button onClick handler
3. Verify it navigates to `/my-company` not `/settings`
4. Test all 4 bottom nav buttons (New, Chats, Company, Settings)

---

### 1.2 Fix /my-company Route
**File**: `frontend/src/App.tsx` or router config
**Issue**: /my-company shows landing page instead of My Company

**Steps**:
1. Check route definition in App.tsx
2. Verify `<Route path="/my-company" element={<MyCompany />} />`
3. Check if route requires authentication and redirects
4. Test direct navigation to /my-company when logged in

---

### 1.3 Fix LLM Hub Cards Not Clickable
**File**: `frontend/src/components/settings/LLMHub.tsx` (or similar)
**Issue**: AI Models, Response Styles, AI Personas cards have chevrons but don't respond to clicks

**Steps**:
1. Find the LLM Hub component
2. Check if cards have onClick handlers
3. Verify the navigation/expansion logic
4. Add click handlers if missing:
```tsx
<Card onClick={() => setActiveSection('ai-models')} className="cursor-pointer">
  <CardContent>
    AI Models
    <ChevronRight />
  </CardContent>
</Card>
```

---

### 1.4 Fix Mobile Bottom Nav Visibility
**File**: `frontend/src/components/ui/MobileBottomNav.css`
**Issue**: Nav hidden on viewport > 640px (larger phones like iPhone Pro Max are 430px wide, but landscape or tablets need nav too)

**Current Code**:
```css
.mobile-bottom-nav {
  display: none; /* Hidden on desktop */
}

@media (width <= 640px) {
  .mobile-bottom-nav {
    display: flex;
  }
}
```

**Fix**: Adjust breakpoint or add tablet support
```css
/* Show on mobile and tablet portrait */
@media (width <= 1024px) {
  .mobile-bottom-nav {
    display: flex;
  }
}

/* Hide only on desktop */
@media (width > 1024px) {
  .mobile-bottom-nav {
    display: none;
  }
}
```

---

## Phase 2: Touch Target Violations (P1 - Accessibility)
**Timeline**: Days 4-7
**Goal**: WCAG 2.1 AA compliance (44px minimum)

### 2.1 Audit All Touch Targets < 44px

**Files with violations (51 files, 95 occurrences)**:

Priority files to fix first:
1. `frontend/src/index.css` - 10 violations
2. `frontend/src/components/mycompany/styles/badges-mobile.css` - 6 violations
3. `frontend/src/components/shared/omnibar/layout.css` - 5 violations
4. `frontend/src/components/ui/switch.css` - 4 violations
5. `frontend/src/components/shared/omnibar/mobile.css` - 4 violations

**Fix Pattern**:
```css
/* BEFORE - Too small */
.icon-button {
  min-width: 24px;
  min-height: 24px;
}

/* AFTER - WCAG compliant */
.icon-button {
  min-width: 44px;
  min-height: 44px;
}
```

**Grep Command to Find All**:
```bash
grep -rn "min-\(width\|height\):\s*\(1[0-9]\|2[0-9]\|3[0-9]\|4[0-3]\)px" frontend/src --include="*.css"
```

---

### 2.2 Fix Icon Buttons Specifically

**Common Pattern to Fix**:
```css
/* In index.css - lines 418-450 */
/* These are all too small */
.icon-xs { min-width: 18px; min-height: 18px; }  /* FIX: 44px */
.icon-sm { min-width: 20px; min-height: 20px; }  /* FIX: 44px */
.icon-md { min-width: 16px; min-height: 16px; }  /* FIX: 44px */
```

**Note**: Visual size can stay small, but touch target must be 44px. Use padding:
```css
.icon-button {
  /* Visual size */
  width: 24px;
  height: 24px;
  /* Touch target via padding */
  padding: 10px; /* (44-24)/2 = 10px each side */
  margin: -10px; /* Negative margin to not affect layout */
}
```

---

## Phase 3: CSS Cleanup (!important Abuse)
**Timeline**: Days 8-10
**Goal**: Reduce CSS specificity wars

### 3.1 Fix sonner.css (60 !important usages)
**File**: `frontend/src/components/ui/sonner.css`

**Strategy**:
1. Increase specificity instead of using !important
2. Use CSS custom properties for overrides
3. Scope styles more specifically

**Example Fix**:
```css
/* BEFORE */
.toast {
  background: white !important;
}

/* AFTER - Use higher specificity */
[data-sonner-toast] .toast {
  background: white;
}

/* OR use CSS variables */
:root {
  --toast-bg: white;
}
.toast {
  background: var(--toast-bg);
}
```

### 3.2 Other Files with !important

| File | Count | Action |
|------|-------|--------|
| `design-tokens.css` | 8 | Review necessity |
| `tailwind.css` | 6 | May be required for utility overrides |
| `OnboardingFlow.css` | 2 | Refactor |
| `BottomSheet.css` | 2 | Refactor touch-action |
| `FloatingContextActions.css` | 1 | Refactor |

---

## Phase 4: Modal & Sheet UX Improvements (P2)
**Timeline**: Days 11-14
**Goal**: Native-feeling modal interactions

### 4.1 Add Close Button to Settings Modal
**File**: `frontend/src/components/settings/SettingsResponsive.tsx`

```tsx
// Add explicit close button
<DialogContent>
  <button
    onClick={onClose}
    className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
    aria-label="Close settings"
  >
    <X className="w-5 h-5" />
  </button>
  {/* ... rest of content */}
</DialogContent>
```

### 4.2 Make Drag Handle More Visible
**File**: `frontend/src/components/ui/BottomSheet.css`

```css
/* BEFORE - Too subtle */
.drag-handle {
  width: 32px;
  height: 4px;
  background: var(--color-border-secondary);
}

/* AFTER - More visible */
.drag-handle {
  width: 48px;
  height: 5px;
  background: var(--color-text-tertiary);
  border-radius: 3px;
}
```

### 4.3 Show Bottom Nav When Modal Open
**File**: Multiple modal components

**Strategy**: Use portal to render modals, keep bottom nav in main DOM flow
Or: Add z-index management so bottom nav shows above modal backdrop

---

## Phase 5: Content Display Fixes (P2)
**Timeline**: Days 15-18

### 5.1 Add Horizontal Scroll Indicators for Tables
**File**: `frontend/src/components/ui/Table.css` or chat styles

```css
.table-container {
  position: relative;
  overflow-x: auto;
}

/* Fade indicator on right when more content */
.table-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 24px;
  background: linear-gradient(to right, transparent, var(--color-bg-primary));
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.table-container.has-overflow::after {
  opacity: 1;
}
```

### 5.2 Fix Response Truncation - Add "Read More"
**File**: AI response components

```tsx
const [expanded, setExpanded] = useState(false);
const MAX_LENGTH = 200;

return (
  <div>
    {expanded ? content : content.slice(0, MAX_LENGTH)}
    {content.length > MAX_LENGTH && (
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-brand-primary ml-1"
      >
        {expanded ? 'Show less' : 'Read more...'}
      </button>
    )}
  </div>
);
```

### 5.3 Fix AI Model Badges Scroll Indicator
**File**: Stage 1 or AI badges component

```css
.ai-badges-container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.ai-badges-container::-webkit-scrollbar {
  display: none;
}

/* Visual indicator dots */
.ai-badges-indicator {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
}

.ai-badges-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-secondary);
}

.ai-badges-indicator .dot.active {
  background: var(--color-brand-primary);
}
```

---

## Phase 6: Console & Performance (P2)
**Timeline**: Days 19-21

### 6.1 Fix Excessive Debug Logging
**File**: `frontend/src/App.tsx` and related

```tsx
// Find and wrap debug logs
if (process.env.NODE_ENV === 'development') {
  console.log('[DEBUG]', ...);
}

// Or use a logger utility
import { logger } from '@/utils/logger';
logger.debug('showLandingHero', value); // Only logs in dev
```

### 6.2 Remove Duplicate Console Logs
**Issue**: 44 duplicate "showLandingHero" logs in 20 seconds

**Steps**:
1. Search for `showLandingHero` in codebase
2. Find the component causing repeated logs
3. Check for useEffect missing dependencies or infinite re-renders
4. Add proper memoization or dependency arrays

---

## Phase 7: overflow:hidden Audit (P2)
**Timeline**: Days 22-25

### 7.1 Review All 179 overflow:hidden Usages

**High-Risk Files to Check First**:
1. `UsageMobile.css` - 5 usages
2. `sidebar-mobile.css` - 4 usages
3. `MultiDepartmentSelect.css` - 4 usages

**Check for These Issues**:
- [ ] Can content be scrolled when needed?
- [ ] Does virtual keyboard cause content cut-off?
- [ ] Are focus indicators visible?
- [ ] Can users access all content?

**Fix Pattern**:
```css
/* BEFORE - Blocks all overflow */
.container {
  overflow: hidden;
}

/* AFTER - Allow vertical scroll, clip horizontal */
.container {
  overflow-x: hidden;
  overflow-y: auto;
}

/* OR - Use clip for visual only, not scrolling */
.container {
  overflow: clip;
}
```

---

## Phase 8: position:fixed Review (P2)
**Timeline**: Days 26-28

### 8.1 Check All 29 Fixed Elements for Mobile Issues

**Files to Review**:
| File | Line | Element | Check |
|------|------|---------|-------|
| `App.css` | 48, 106, 220, 256 | Various | Keyboard behavior |
| `MobileBottomNav.css` | 5 | Bottom nav | Safe area inset |
| `ThemeToggle.css` | 8 | Theme button | Z-index conflicts |
| `HelpButton.css` | 11 | Help button | Modal interaction |
| `BottomSheet.css` | 6, 15, 126 | Sheet | Scroll blocking |

**Common Issues to Fix**:
1. Virtual keyboard pushes fixed elements
2. Safe area insets not respected
3. Z-index conflicts with modals
4. Fixed elements blocking scroll

**Fix Pattern for Keyboard**:
```css
/* Use visual viewport for fixed positioning */
.fixed-bottom {
  position: fixed;
  bottom: 0;
  /* Respect safe area */
  padding-bottom: env(safe-area-inset-bottom);
}

/* Handle keyboard */
@supports (height: 100dvh) {
  .fixed-bottom {
    bottom: calc(100vh - 100dvh);
  }
}
```

---

## Testing Checklist

### After Each Phase, Test:
- [ ] iPhone SE (320x568) - Smallest viewport
- [ ] iPhone 14 (390x844) - Standard
- [ ] iPhone 14 Pro Max (430x932) - Largest
- [ ] Pixel 7 (412x915) - Android
- [ ] iPad (768x1024) - Tablet

### Test Scenarios:
- [ ] All navigation paths work
- [ ] Modals open/close properly
- [ ] Forms work with virtual keyboard
- [ ] Scroll works in all areas
- [ ] Touch targets are tappable
- [ ] No content is cut off

---

## Quick Commands

```bash
# Find touch target violations
grep -rn "min-\(width\|height\):\s*\(1[0-9]\|2[0-9]\|3[0-9]\|4[0-3]\)px" frontend/src --include="*.css"

# Find !important usages
grep -rn "!important" frontend/src --include="*.css" | wc -l

# Find position:fixed
grep -rn "position:\s*fixed" frontend/src --include="*.css"

# Find overflow:hidden
grep -rn "overflow:\s*hidden" frontend/src --include="*.css" | wc -l

# Run CSS lint
cd frontend && npm run lint:css
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| P0 Issues | 1 | 0 |
| P1 Issues | 5+ | 0 |
| Touch Target Violations | 95 | 0 |
| !important Usages | 83 | <20 |
| Mobile Interaction Score | 5/10 | 8/10 |
| Gesture Feel Score | 6/10 | 8/10 |

---

## Daily Standup Format

```
Yesterday: [What was fixed]
Today: [What will be fixed]
Blockers: [Any issues]
Tests Passed: [X/Y]
```

---

**Owner**: Development Team
**Reviewer**: QA + Product
**Sign-off Required**: Before $25M due diligence

