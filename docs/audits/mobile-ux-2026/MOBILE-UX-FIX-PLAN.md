# Mobile UX Fix Plan - Implementation Roadmap

## Overview

This plan addresses all 52 issues found during mobile UX testing, organized into 5 phases by priority and dependency. Each phase builds on the previous one.

**Estimated Total Effort:** 3-4 days of focused work
**Critical Path:** Phase 1 → Phase 2 → Phase 3 (can parallelize 4 & 5)

---

## Phase 1: Blockers & Critical Routing (Day 1 Morning)

### 1.1 Fix Login/Signup Page Scroll (P0)
**Issues:** ISSUE-001, ISSUE-011
**Files:** `frontend/src/components/auth/AuthPage.css` or layout component

**Problem:** Content overflows viewport on small screens with no scroll

**Fix:**
```css
/* In the auth page container */
.auth-page {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Or on body/html if needed */
html, body {
  overflow-y: auto;
  height: auto;
  min-height: 100%;
}
```

**Verification:** Test on iPhone SE (320x568) - all content should be scrollable

---

### 1.2 Fix Routing for /mycompany and /company (P0)
**Issues:** ISSUE-002, ISSUE-003
**Files:** `frontend/src/App.tsx` or `frontend/src/routes/`

**Problem:** Routes show chat interface instead of actual content

**Investigation Steps:**
1. Check route definitions in router config
2. Verify lazy-loaded components are importing correctly
3. Check if route guards are redirecting incorrectly
4. Verify the MyCompany component exists and exports properly

**Likely Fix:**
```tsx
// In App.tsx or routes config
<Route path="/mycompany" element={<MyCompanyPage />} />
<Route path="/company" element={<Navigate to="/mycompany" replace />} />
```

**Verification:** Navigate to /mycompany - should see Departments/Roles/Playbooks

---

### 1.3 Fix "Continue with Google" Button Contrast (P1)
**Issues:** ISSUE-004
**Files:** `frontend/src/components/auth/GoogleButton.css` or similar

**Problem:** White text on white/light background

**Fix:**
```css
.google-oauth-button {
  background: white;
  color: #1f2937; /* Dark gray text */
  border: 1px solid #e5e7eb;
}

/* Or if using a transparent/gradient overlay */
.google-oauth-button span {
  color: #374151;
  font-weight: 500;
}
```

**Verification:** Text clearly visible in both light and dark modes

---

### 1.4 Fix Light Mode Blank Page (P1)
**Issues:** ISSUE-005
**Files:** `frontend/src/styles/` CSS variable definitions

**Problem:** Page renders blank in light mode (contrast issue)

**Investigation:**
1. Check CSS custom properties for `--color-text-primary` in light theme
2. Verify card backgrounds have proper contrast
3. Check for missing light mode overrides

**Fix:** Ensure all text colors have proper contrast in light mode theme

---

## Phase 2: Navigation & Text Truncation (Day 1 Afternoon)

### 2.1 Fix History Button Functionality (P1)
**Issues:** ISSUE-006
**Files:** `frontend/src/components/navigation/BottomNav.tsx`

**Problem:** History button click does nothing

**Fix Options:**
```tsx
// Option A: Open sidebar with history tab
const handleHistoryClick = () => {
  setSidebarOpen(true);
  // Or trigger sidebar history focus
};

// Option B: Navigate to a history page
const handleHistoryClick = () => {
  navigate('/history');
};
```

---

### 2.2 Fix Settings Tab Truncation (P1)
**Issues:** ISSUE-007
**Files:** `frontend/src/components/settings/SettingsTabs.css`

**Problem:** "Developer" shows as "Develo..."

**Fix:**
```css
.settings-tabs {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Hide scrollbar */
}

.settings-tabs::-webkit-scrollbar {
  display: none;
}

.settings-tab {
  flex-shrink: 0;
  white-space: nowrap;
  padding: var(--space-2) var(--space-3);
  font-size: 0.875rem; /* Slightly smaller on mobile */
}

@media (max-width: 640px) {
  .settings-tab {
    padding: var(--space-2);
    font-size: 0.75rem;
  }
}
```

---

### 2.3 Fix Bottom Navigation Text Truncation (P1)
**Issues:** ISSUE-008
**Files:** `frontend/src/components/navigation/BottomNav.css`

**Problem:** "Settings" text cut off

**Fix:**
```css
@media (max-width: 380px) {
  .bottom-nav-item {
    flex-direction: column;
    gap: 2px;
  }

  .bottom-nav-label {
    font-size: 0.625rem; /* 10px */
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Or use icons only on very small screens */
@media (max-width: 320px) {
  .bottom-nav-label {
    display: none;
  }
}
```

---

### 2.4 Fix Sidebar "Sign out" Truncation (P1)
**Issues:** ISSUE-009
**Files:** `frontend/src/components/sidebar/Sidebar.css`

**Problem:** Shows "Sign" instead of "Sign out"

**Fix:**
```css
.sidebar-footer-button {
  white-space: nowrap;
  overflow: visible;
}

/* Or ensure minimum width */
.sidebar {
  min-width: 200px;
}
```

---

### 2.5 Fix Settings Modal Bottom Cutoff (P1)
**Issues:** ISSUE-012
**Files:** `frontend/src/components/settings/SettingsModal.css`

**Problem:** "Language" label cut off at bottom

**Fix:**
```css
.settings-modal-content {
  padding-bottom: var(--space-8);
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
```

---

## Phase 3: DevTools & Touch Targets (Day 2 Morning)

### 3.1 Hide DevTools in Production (P1)
**Issues:** ISSUE-010
**Files:** `frontend/src/App.tsx` or `frontend/src/main.tsx`

**Problem:** Tanstack Query DevTools overlaps UI

**Fix:**
```tsx
// Only show in development
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

{import.meta.env.DEV && (
  <ReactQueryDevtools
    initialIsOpen={false}
    position="bottom-left" // Move away from bottom-right
  />
)}
```

---

### 3.2 Increase Theme Toggle Touch Target (P2)
**Issues:** ISSUE-016
**Files:** `frontend/src/components/ThemeToggle.css`

**Fix:**
```css
.theme-toggle {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
}
```

---

### 3.3 Increase Sidebar Toggle Touch Target (P2)
**Issues:** ISSUE-017
**Files:** `frontend/src/components/sidebar/SidebarToggle.css`

**Fix:**
```css
.sidebar-toggle {
  width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Invisible touch area extension */
.sidebar-toggle::before {
  content: '';
  position: absolute;
  left: -10px;
  top: -10px;
  right: -10px;
  bottom: -10px;
}
```

---

### 3.4 Increase Radio Button Touch Targets (P2)
**Issues:** ISSUE-021
**Files:** `frontend/src/components/chat/AISelector.css`

**Fix:**
```css
.ai-selector-option {
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
}

.ai-selector-option label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  /* Extend clickable area */
  padding: var(--space-2);
  margin: calc(-1 * var(--space-2));
}
```

---

### 3.5 Fix All Small Touch Targets (P2)
**Issues:** ISSUE-025, ISSUE-026, ISSUE-031, ISSUE-032
**Files:** Various component CSS files

**Global Fix - Add to base styles:**
```css
/* Ensure all interactive elements meet 44px minimum */
button,
[role="button"],
a,
input[type="checkbox"],
input[type="radio"] {
  min-height: 44px;
  min-width: 44px;
}

/* For icon-only buttons, use padding */
.icon-button {
  padding: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## Phase 4: Layout & Visual Polish (Day 2 Afternoon)

### 4.1 Fix Chat Hero Empty Space (P2)
**Issues:** ISSUE-020
**Files:** `frontend/src/components/chat/ChatHero.css`

**Fix:**
```css
@media (max-width: 640px) {
  .chat-hero {
    padding-top: var(--space-8);
    padding-bottom: var(--space-4);
  }

  .chat-hero-title {
    font-size: 1.5rem; /* Smaller on mobile */
  }
}
```

---

### 4.2 Add Loading States (P2)
**Issues:** ISSUE-018, ISSUE-019
**Files:** Create `frontend/src/components/ui/Skeleton.tsx`

**Fix:**
```tsx
// Add skeleton components for loading states
export const ChatSkeleton = () => (
  <div className="chat-skeleton">
    <div className="skeleton-header" />
    <div className="skeleton-message" />
    <div className="skeleton-message" />
  </div>
);

// Use in chat loading
{isLoading ? <ChatSkeleton /> : <ChatContent />}
```

---

### 4.3 Add Tap Feedback (P2)
**Issues:** ISSUE-023
**Files:** `frontend/src/styles/base.css`

**Fix:**
```css
/* Active state for all interactive elements */
button:active,
[role="button"]:active,
.clickable:active {
  transform: scale(0.98);
  opacity: 0.9;
}

/* For list items */
.conversation-item:active {
  background: var(--color-bg-hover);
}
```

---

### 4.4 Fix Context Badge Size (P2)
**Issues:** ISSUE-022
**Files:** `frontend/src/components/chat/ContextButton.css`

**Fix:**
```css
.context-badge {
  min-width: 20px;
  min-height: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}
```

---

### 4.5 Improve Bottom Sheet Drag Handle (P2)
**Issues:** ISSUE-029
**Files:** `frontend/src/components/ui/Sheet.css`

**Fix:**
```css
.sheet-drag-handle {
  width: 48px;
  height: 5px;
  background: var(--color-border);
  border-radius: 3px;
  margin: var(--space-2) auto var(--space-4);
}
```

---

## Phase 5: Accessibility & Polish (Day 3)

### 5.1 Fix File Upload Visibility (P1)
**Issues:** ISSUE-013
**Files:** `frontend/src/components/chat/FileUpload.css`

**Fix:**
```css
.file-upload-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

/* Hide native input, style custom button */
.file-upload-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
```

---

### 5.2 Improve Disabled Button Styling (P1)
**Issues:** ISSUE-014
**Files:** `frontend/src/components/ui/Button.css`

**Fix:**
```css
button:disabled,
button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

### 5.3 Add Password Visibility Toggle (P2)
**Issues:** ISSUE-037
**Files:** `frontend/src/components/auth/PasswordInput.tsx`

**Fix:**
```tsx
const [showPassword, setShowPassword] = useState(false);

<div className="password-input-wrapper">
  <input
    type={showPassword ? "text" : "password"}
    {...props}
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? <EyeOff /> : <Eye />}
  </button>
</div>
```

---

### 5.4 Fix Modal Close Button Visibility (P2)
**Issues:** ISSUE-027
**Files:** `frontend/src/components/ui/Sheet.tsx`

**Fix:**
```tsx
// Ensure X button is always visible on mobile
<Sheet>
  <SheetHeader>
    <SheetTitle>{title}</SheetTitle>
    <SheetClose className="sheet-close-button">
      <X size={24} />
      <span className="sr-only">Close</span>
    </SheetClose>
  </SheetHeader>
  ...
</Sheet>
```

---

### 5.5 Fix Focus Management (P3)
**Issues:** ISSUE-044
**Files:** Modal/Sheet components

**Fix:**
```tsx
// Store trigger ref
const triggerRef = useRef<HTMLButtonElement>(null);

// Return focus on close
const handleClose = () => {
  setOpen(false);
  triggerRef.current?.focus();
};
```

---

### 5.6 Fix Page Titles (P3)
**Issues:** ISSUE-040
**Files:** `frontend/src/hooks/useDocumentTitle.ts`

**Fix:**
```tsx
// Create hook
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title ? `${title} - AxCouncil` : 'AxCouncil';
  }, [title]);
};

// Use in pages
useDocumentTitle('Settings');
useDocumentTitle('My Company');
```

---

## Implementation Checklist

### Phase 1 (Blockers) - MUST DO FIRST
- [ ] Fix auth page scroll (ISSUE-001, 011)
- [ ] Fix /mycompany routing (ISSUE-002, 003)
- [ ] Fix Google button contrast (ISSUE-004)
- [ ] Fix light mode blank page (ISSUE-005)

### Phase 2 (Navigation)
- [ ] Fix History button (ISSUE-006)
- [ ] Fix Settings tab truncation (ISSUE-007)
- [ ] Fix bottom nav truncation (ISSUE-008)
- [ ] Fix sidebar sign out (ISSUE-009)
- [ ] Fix settings modal scroll (ISSUE-012)

### Phase 3 (Touch Targets)
- [ ] Hide DevTools in prod (ISSUE-010)
- [ ] Theme toggle size (ISSUE-016)
- [ ] Sidebar toggle size (ISSUE-017)
- [ ] Radio button sizes (ISSUE-021)
- [ ] All icon buttons (ISSUE-025, 026, 031, 032)

### Phase 4 (Layout)
- [ ] Chat hero spacing (ISSUE-020)
- [ ] Loading skeletons (ISSUE-018, 019)
- [ ] Tap feedback (ISSUE-023)
- [ ] Context badge (ISSUE-022)
- [ ] Sheet drag handle (ISSUE-029)

### Phase 5 (Accessibility)
- [ ] File upload visibility (ISSUE-013)
- [ ] Disabled button styling (ISSUE-014)
- [ ] Password toggle (ISSUE-037)
- [ ] Modal close buttons (ISSUE-027)
- [ ] Focus management (ISSUE-044)
- [ ] Page titles (ISSUE-040)

---

## Testing Protocol

After each phase, verify fixes with:

1. **iPhone SE (320x568)** - Smallest viewport
2. **iPhone 14 (390x844)** - Standard mobile
3. **iPhone 14 Pro Max (430x932)** - Large mobile

### Test Commands
```bash
# Start dev environment
cd frontend && npm run dev -- --port 9347

# In another terminal, start Chrome DevTools MCP
# Then use mobile-ux-tester agent to verify fixes
```

---

## Quick Wins (Can Do Anytime)

These are independent fixes that can be done in any order:

1. **DevTools position** - 2 min fix
2. **Touch target CSS** - 5 min global fix
3. **Page titles** - 10 min hook + usage
4. **Disabled button styling** - 2 min CSS
5. **Tap feedback** - 3 min CSS

---

## Notes

- All CSS changes should respect the 300-line budget per file
- Use CSS variables from `frontend/src/styles/` design tokens
- Test in both light and dark modes
- Run `npm run lint:css` after CSS changes
- Run `npm run type-check` after TypeScript changes

**Priority:** Fix Phase 1 blockers immediately - they prevent users from using the app on small phones.
