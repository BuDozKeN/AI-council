---
name: mobile-debugging
description: Mobile CSS debugging patterns, flex chain bugs, scroll issues, touch targets
tags: [mobile, css, debugging, responsive]
---

# Mobile Debugging Patterns

This skill contains all mobile-specific debugging patterns for AxCouncil. Load this when working on mobile issues.

## Mobile CSS Override Trap (CRITICAL)

**Problem:** Component styles work on desktop but break on mobile, even though you have explicit size rules.

**Root Cause:** Your component's own CSS file likely has mobile media queries that override your desktop rules. When debugging, don't just look at OTHER files overriding yours - check YOUR OWN mobile media queries first!

**Real example from LLM Hub:**
```css
/* Desktop: 180px dropdowns ✓ */
[data-llm-select] .select-trigger {
  width: 180px;
  min-width: 180px;
  max-width: 180px;
}

/* Mobile: YOUR OWN FILE overrides it to 100%! */
@media (max-width: 768px) {
  .llm-model-select.select-trigger {
    width: 100%;      /* ← You did this to yourself */
    min-width: 0;
    max-width: 100%;
  }
}
```

**Debugging checklist when mobile styles don't match desktop:**
1. **Check your own file's media queries FIRST** - search for `@media` in the component's CSS
2. Check parent component CSS files
3. Check global CSS files (select.css, index.css)
4. Use DevTools to see which rule is actually winning

**Prevention:**
- When setting a fixed size that should persist across breakpoints, add a comment: `/* Intentionally fixed - do not override in mobile */`
- When adding mobile overrides, ask: "Should this size really change on mobile, or should it stay consistent?"

## Mobile Touch Targets (CRITICAL)

**Global rule in `index.css` enforces 44px min-height on ALL buttons for mobile (under 640px):**
```css
button:not(.inline-btn):not(.no-touch-target) { min-height: 44px; }
```

**If a button needs to be smaller (e.g., compact tabs, pills, inline actions):**
1. Add `no-touch-target` class to the button element in JSX
2. That's it - no CSS overrides needed

**Example:**
```jsx
// WRONG: Button will be forced to 44px on mobile
<button className="tab">Click</button>

// CORRECT: Button respects your CSS sizing
<button className="tab no-touch-target">Click</button>
```

**DO NOT** try to override with CSS specificity hacks like `min-height: unset` - just use `no-touch-target`.

## Layout & Scrolling Patterns

When building scrollable layouts with cards:

1. **Single scroll container** - Only ONE element should have `overflow-y: auto`. Never nest scroll containers.
2. **Parent is scroll container** - The parent scrolls, children flow naturally inside it.
3. **Alignment via parent padding** - Cards align when parent has consistent padding.
4. **Sticky elements** - Use `position: sticky` inside the scroll container, with solid `background`.

```css
/* CORRECT: Parent scrolls, children flow */
.scroll-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}
.card-inside {
  /* No overflow, no height constraints - just flows naturally */
  padding: var(--card-padding-xl);
}

/* WRONG: Nested scroll containers */
.parent { overflow-y: auto; }
.child { overflow-y: auto; }  /* Creates scroll-in-scroll mess */
```

## Flex Container Chain Bug (CRITICAL)

**Symptom:** Content is not centered or not expanding to fill available space, even though parent containers have `flex: 1` and `align-items: center`.

**Root Cause:** An intermediate wrapper element (often added for accessibility like `<main>` or `<section>`) breaks the flex chain by not having flex properties.

**Real example - Chat interface centering:**
```
.app (flex: 1) → #main-content (NO FLEX!) → .main-content-chat (flex: 1) → .messages-container
                       ↑
              This broke the chain - content appeared left-aligned
```

**The Fix:** Ensure EVERY element in the flex chain has appropriate flex properties:
```css
/* Wrapper elements must participate in the flex chain */
#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;  /* Prevents flex item overflow */
}
```

**Debugging checklist:**
1. Open DevTools → Elements panel
2. Starting from the misaligned element, click each parent going up
3. Check the Computed styles for `display`, `flex`, `width`
4. Look for any element with `display: block` or `flex: 0 1 auto` - that's your culprit
5. Also check for `min-width: auto` which can prevent shrinking

**Prevention:**
- When adding semantic wrappers (`<main>`, `<section>`, `<article>`), immediately add flex styles if inside a flex layout
- Add a comment: `/* Flex chain participant - do not remove flex properties */`
- Test with sidebar collapsed AND expanded - width differences reveal chain breaks

**Key files maintaining the flex chain:**
- `App.css` - `.app`, `#main-content`, `.main-content-chat`
- `ChatInterface.css` - `.chat-interface`
- `MessageList.css` - `.messages-container`

## Nested Scroll Containers Bug (CRITICAL)

**Symptom:** Mouse wheel scrolling doesn't work even though:
- CSS has `overflow-y: auto` ✓
- Content is taller than container ✓
- Wheel events reach the element ✓
- Programmatic scroll (`element.scrollTop = 100`) works ✓

**Root Cause:** A PARENT element also has `overflow-y: auto`. When both parent and child have `overflow: auto`, the browser may not scroll the correct one.

**The Fix:** Set `overflow: hidden` on ALL parent containers - only the innermost scroll target should have `overflow: auto`.

**Real example - Settings modal:**
```css
/* AppModal body has overflow: auto by default */
.app-modal-body { overflow-y: auto; }  /* From AppModal.css */

/* Settings panel also wants to scroll */
.settings-panel { overflow-y: auto; }  /* CONFLICT! */

/* FIX: Override parent to hidden */
.settings-modal-body { overflow: hidden; }  /* Now only .settings-panel scrolls */
```

**Debugging checklist:**
1. Find the element with `overflow-y: auto` that should scroll
2. Check ALL ancestors for `overflow: auto` or `overflow-y: auto`
3. Set `overflow: hidden` on every ancestor up to the modal/sheet container
4. Test with `element.scrollTop = 100` in console - if this works but wheel doesn't, it's a nested scroll issue

**Files with this pattern:**
- `Settings.css` - `.settings-modal-body { overflow: hidden }` for desktop
- `Settings.css` - `.bottom-sheet-body:has(.settings-content) { overflow: hidden }` for mobile

## Flexbox Scroll Chain (CRITICAL)

**Problem:** `overflow-y: auto` on a nested flex item doesn't work - content overflows instead of scrolling.

**Root Cause:** By default, flex items have `min-height: auto` which prevents them from shrinking below their content size. If ANY ancestor is missing `min-height: 0`, the scroll container's height becomes unbounded.

**The Rule:** For `overflow-y: auto` to work on a deeply nested flex item, EVERY flex ancestor must have `min-height: 0`.

```css
/* WRONG: Scroll doesn't work */
.modal-content { display: flex; flex-direction: column; max-height: 85vh; }
.modal-body { flex: 1; }  /* Missing min-height: 0 */
  .inner-container { display: flex; height: 480px; }  /* Fixed height breaks chain */
    .scroll-panel { flex: 1; overflow-y: auto; }  /* Won't scroll! */

/* CORRECT: Complete min-height: 0 chain */
.modal-content { display: flex; flex-direction: column; max-height: 85vh; }
.modal-body { flex: 1; min-height: 0; }  /* ✓ Can shrink */
  .inner-container { display: flex; flex: 1; min-height: 0; max-height: 480px; }  /* ✓ Use max not fixed */
    .scroll-panel { flex: 1; min-height: 0; overflow-y: auto; }  /* ✓ Now scrolls! */
```

**Debugging Checklist:**
1. Find the element with `overflow-y: auto`
2. Walk UP the DOM tree to the root flex container
3. Every flex item in the chain needs `min-height: 0`
4. Replace `height: Xpx` with `max-height: Xpx` on flex items
5. The outermost container needs a height constraint (e.g., `max-height: 85vh`)

**Note:** This is DIFFERENT from "Nested Scroll Containers Bug":
- Nested scroll containers → fix with `overflow: hidden` on parents
- Missing `min-height: 0` → content overflows instead of scrolling

## Mobile Layout Rules

1. **Same structure, adjusted spacing** - Don't restructure HTML for mobile, just adjust CSS
2. **Match padding between siblings** - If header has `padding: 12px 16px`, body should use same horizontal: `padding: X 16px`
3. **Let flexbox handle wrapping** - Use `flex-wrap: wrap` not restructured HTML
4. **Test both viewports** - Always verify changes on both desktop AND mobile

## Mobile Testing Checklist

1. ALWAYS test interactive elements on actual mobile device or Chrome DevTools mobile emulation
2. If desktop works but mobile doesn't, suspect Framer Motion drag interference
3. Check for `touch-action` CSS on parent containers that might block events
4. Check for `stopPropagation` on parent containers
