---
name: radix-patterns
description: Radix UI patterns, modal dismissal, fixed-position elements, Framer Motion integration
tags: [radix, modals, dialogs, framer-motion]
---

# Radix UI Patterns

This skill contains patterns for working with Radix UI components in AxCouncil. Load when working on modals, dialogs, or fixed-position elements.

## Fixed-Position Elements + Radix Dialogs (CRITICAL)

**Problem:** When you have a fixed-position element (like ThemeToggle or HelpButton) rendered at the App root level, clicking it while a Radix Dialog/Modal is open will close the modal. Radix detects clicks outside the dialog's DOM tree as "outside clicks".

**Failed approaches (DO NOT try these):**
- ❌ `e.stopPropagation()` on the button - Radix uses capture phase
- ❌ Native event listeners with capture phase - Still detected as outside
- ❌ Rendering into Radix portal (`[data-radix-portal]`) - Creates timing issues
- ❌ Using React Portal to body - Same problem
- ❌ Checking `.theme-toggle-container` in Radix handlers - Event target may differ

**Working solution: Timestamp-based detection**

1. **In the fixed-position component** (e.g., ThemeToggle, HelpButton):
```tsx
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  e.stopPropagation();
  // Set timestamp BEFORE Radix's outside-click detection fires
  (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime = Date.now();
}, []);
```

2. **In App.tsx modal `onClose` handlers**:
```tsx
<Settings
  isOpen={isSettingsOpen}
  onClose={() => {
    const clickTime = (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime;
    if (clickTime && Date.now() - clickTime < 500) {
      return; // Don't close - it was just a theme toggle click
    }
    closeSettings();
  }}
/>
```

3. **Also add checks in AppModal.tsx and BottomSheet.tsx** `onOpenChange`, `onPointerDownOutside`, and `onInteractOutside` handlers.

**Key files implementing this pattern:**
- `ThemeToggle.tsx` - Sets `window.__themeToggleClickTime`
- `HelpButton.tsx` - Sets `window.__helpButtonClickTime`
- `App.tsx` - All modal `onClose` handlers check both timestamps
- `AppModal.tsx` - `onOpenChange` checks both timestamps
- `BottomSheet.tsx` - Overlay click and Radix handlers check both timestamps

**When adding new fixed-position UI elements:**
1. Set a unique timestamp on `window` in `onPointerDown`/`onMouseDown`
2. Add the timestamp check to ALL modal `onClose` handlers in App.tsx
3. Add backup checks in AppModal.tsx and BottomSheet.tsx

**CRITICAL: Child elements need timestamps too!**
```tsx
// The panel container needs timestamp handling
<div className="help-panel"
  onPointerDown={(e) => {
    e.stopPropagation();
    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
  }}
>
  {/* Each button inside also needs it */}
  <button
    onClick={() => handleChange()}
    onPointerDown={(e) => {
      e.stopPropagation();
      (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
    }}
  >
    Option
  </button>
</div>
```

## Radix Select Dropdowns Inside Modals (CRITICAL)

**Problem:** When a Radix Select dropdown is inside a modal, clicking outside the dropdown to dismiss it ALSO closes the parent modal.

**Why it happens:**
1. User clicks outside dropdown → dropdown closes
2. The same click event bubbles up → modal sees it as "click outside" → modal closes
3. By the time modal's handler runs, the dropdown DOM is already gone

**Solution: Timestamp-based detection (already implemented)**

1. **In `select.tsx` SelectContent component**:
```tsx
onPointerDownOutside={(e) => {
  (window as Window & { __radixSelectJustDismissed?: number }).__radixSelectJustDismissed = Date.now();
  onPointerDownOutside?.(e);
}}
```

2. **In modal components (BottomSheet.tsx, AppModal.tsx)**:
```tsx
// In onClick, onInteractOutside, and onPointerDownOutside handlers:
const selectDismissTime = (window as Window & { __radixSelectJustDismissed?: number }).__radixSelectJustDismissed;
if (selectDismissTime && Date.now() - selectDismissTime < 300) {
  e.preventDefault();
  return; // Don't close - dropdown was just dismissed
}
```

**Key files:**
- `select.tsx` - Sets `window.__radixSelectJustDismissed` in SelectContent
- `BottomSheet.tsx` - Checks timestamp in overlay onClick, onInteractOutside, onPointerDownOutside
- `AppModal.tsx` - Should also check this timestamp

## Fixed-Position Elements MUST Use Portals (CRITICAL)

**Problem:** The `.app-wrapper` has `overflow: hidden` which clips ANY element rendered inside it, even with `position: fixed`.

**Solution:** Fixed-position floating elements MUST use `createPortal` to render to `document.body`.

**Example pattern:**
```tsx
import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';

// SSR-safe mount detection
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function FloatingButton() {
  const mounted = useIsMounted();

  if (!mounted) return null;

  const button = (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <button>Click me</button>
    </div>
  );

  return createPortal(button, document.body);
}
```

**Why this happens:**
- `App.tsx` renders inside `<motion.div className="app-wrapper">`
- `app-wrapper` CSS has `overflow: hidden` (in `App.css`)
- Even `position: fixed` elements are clipped by their parent's overflow
- Portal renders directly to `document.body`, outside the app-wrapper DOM tree

**Existing components using this pattern:**
- `ThemeToggle.tsx` - Top-right theme switcher
- `HelpButton.tsx` - Bottom-right help button
- `AppModal.tsx` - Modal dialogs

**If your fixed element is not visible, check:**
1. Is it rendered inside app-wrapper? → Use portal
2. Is `mounted` check missing? → Add `useIsMounted` hook
3. Is z-index too low? → Use 9999 for floating UI
4. Vite HMR caching issue → Restart dev server

## Framer Motion Drag Intercepting Wheel Scroll (CRITICAL)

**Symptom:** In a BottomSheet (mobile modal), mouse wheel scrolling doesn't work. Content scrolls briefly then stops.

**Root Cause:** Framer Motion's `drag="y"` sets `touch-action: pan-x` which interferes with vertical wheel events.

**The Fix:** Add an `onWheel` handler to manually scroll:

```tsx
const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
  const body = bodyRef.current;
  if (!body) return;

  const scrollable = body.querySelector<HTMLElement>('.settings-panel') ||
                     body.querySelector<HTMLElement>('[data-scrollable]') ||
                     body;

  const canScroll = scrollable.scrollHeight > scrollable.clientHeight;
  if (!canScroll) return;

  const atTop = scrollable.scrollTop <= 0;
  const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
  if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;

  e.preventDefault();
  e.stopPropagation();
  scrollable.scrollTop += e.deltaY;
}, []);

<div ref={bodyRef} className="bottom-sheet-body" onWheel={handleWheel}>
```

**CSS companion fix** (in `BottomSheet.css`):
```css
.bottom-sheet-content {
  touch-action: pan-y !important;
}
```

**Files implementing this fix:**
- `BottomSheet.tsx` - `handleWheel` function and `bodyRef`
- `BottomSheet.css` - `touch-action: pan-y !important`

## Framer Motion Drag Blocking Touch Events on Mobile (CRITICAL)

**Symptom:** Interactive elements inside a BottomSheet work on desktop but don't respond to taps on mobile.

**Root Cause:** Framer Motion's `drag="y"` gesture detection intercepts touch events before they reach child elements.

**The Fix - CSS on interactive elements:**
```css
.my-button-inside-bottomsheet {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}
```

**The Fix - Parent container:**
```css
.my-list-container {
  pointer-events: auto;
  touch-action: pan-y;
}
```

**The Fix - Nested Radix Dialogs:**
```typescript
// In AppModal.tsx - shouldIgnoreClose function
const hasOpenBottomSheet = document.querySelector('.bottom-sheet-content, .bottom-sheet-overlay');
if (hasOpenBottomSheet) return true;
```

**NEVER do this on parent containers:**
```tsx
// BAD - Interferes with child touch events
<div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
  <Button>I might not receive taps!</Button>
</div>

// GOOD - Let events flow, handle at the button level
<div>
  <Button onClick={(e) => { e.stopPropagation(); doThing(); }}>I work!</Button>
</div>
```

**Files implementing this pattern:**
- `DepartmentCheckboxItem.css` - Mobile button touch fixes
- `MultiDepartmentSelect.css` - Container touch fixes
- `AppModal.tsx` - Nested BottomSheet detection

## Modal Dismiss UX Patterns

**Click-outside to close (AppModal.tsx):**
- Overlay has explicit `onClick` handler that calls `onClose()`
- `shouldIgnoreClose()` checks for nested dialogs, fixed-position buttons
- Never rely solely on Radix's `onOpenChange` - add explicit handlers

**Mobile swipe-to-dismiss (AppModal.tsx):**
- Drag handle at top of modal with `onTouchStart`/`onTouchEnd`
- Swipe down 60px+ triggers close
- Tap on drag handle also closes (mobile UX pattern)

```tsx
const handleDragHandleTouchEnd = (e: React.TouchEvent) => {
  const deltaY = e.changedTouches[0].clientY - dragStartY.current;
  if (deltaY > 60) onClose?.();
};
```

**CSS for drag handle (AppModal.css):**
```css
.app-modal-drag-handle {
  display: none; /* Hidden on desktop */
}
@media (max-width: 768px) {
  .app-modal-drag-handle {
    display: flex;
    height: 32px;
  }
}
```
