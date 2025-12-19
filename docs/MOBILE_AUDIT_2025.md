# Mobile-First Audit: AI Council (Perplexity-Style)

> **Audit Date:** December 2025
> **Goal:** Make the app feel like Perplexity on mobile - fast, clean, thumb-friendly

---

## Executive Summary

The app has **basic mobile scaffolding** (hamburger menu, sidebar drawer) but the **core experience is broken on mobile**. The chat interface, which is the heart of a Perplexity-like app, has **ZERO mobile responsiveness**.

### Current State

| Area | Status | Verdict |
|------|--------|---------|
| Sidebar | Partial | Drawer works, but filter buttons too small |
| ChatInterface | **BROKEN** | No media queries at all |
| Stage1/2/3 | **BROKEN** | No mobile optimization |
| MyCompany Panel | Good | Has proper mobile styles |
| Touch Targets | Poor | Most buttons < 44px |
| Input Forms | Poor | Not optimized for mobile keyboards |

---

## Critical Issues (Must Fix)

### 1. ChatInterface.css - ZERO Mobile Support

**File:** `frontend/src/components/ChatInterface.css`
**Lines:** 1-1002 (entire file)
**Problem:** This is your MAIN interface and it has **no `@media` queries at all**.

#### What's Broken:

```
Current Desktop Layout:
┌────────────────────────────────────────────────┐
│ [Context: Company ▼] [Dept ▼] [Role ▼] [Cache] │  <- Takes full width on mobile
├────────────────────────────────────────────────┤
│                                                │
│     Chat messages area                         │
│                                                │
├────────────────────────────────────────────────┤
│ [📎] [____________Message input____________]   │  <- 44px left padding WASTED
│                                        [Send]  │  <- Button too small
└────────────────────────────────────────────────┘
```

#### Specific Issues:

| Line | Element | Problem | Fix |
|------|---------|---------|-----|
| 99 | `.messages-container` | `padding: 24px` too much on mobile | Reduce to 12-16px |
| 182 | `.user-message .message-content` | `max-width: 80%` leaves 20% unused | Use 95% on mobile |
| 222-227 | `.context-bar` | Horizontal layout overflows | Stack vertically or hide labels |
| 264-267 | `.company-select` | `min-width: 160px` forces overflow | Use 100% width, full row |
| 475-495 | `.message-input` | `padding-left: 44px` wastes space | Reduce padding, move button |
| 478 | `.message-input` | `min-height: 80px` too tall | Use 60px min on mobile |
| 508-520 | `.send-button` | `padding: 14px 28px` too large | Reduce to 12px 20px |

#### The Fix:

```css
/* Add to ChatInterface.css */
@media (max-width: 768px) {
  .messages-container {
    padding: 12px;
  }

  .user-message .message-content {
    max-width: 95%;
  }

  .context-bar {
    flex-direction: column;
    gap: 8px;
  }

  .context-select-trigger {
    width: 100% !important;
    min-width: 0 !important;
  }

  .input-form {
    padding: 12px;
  }

  .message-input {
    padding: 12px;
    padding-left: 12px; /* Remove image button space on mobile */
    min-height: 60px;
    font-size: 16px; /* Prevents iOS zoom */
  }

  .send-button {
    padding: 12px 20px;
  }

  .empty-state h2 {
    font-size: 18px;
  }

  .empty-state p {
    font-size: 14px;
  }

  /* Mode toggle stacks on mobile */
  .mode-toggle-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .department-pills,
  .role-pills {
    margin-left: 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 480px) {
  .context-bar {
    display: none; /* Or show a collapsed summary */
  }

  .back-to-company-btn {
    font-size: 12px;
    padding: 6px 12px;
  }
}
```

#### What This Fixes:
- Chat input won't overflow on small screens
- User can see more message content
- Context selectors won't force horizontal scroll
- Text input prevents iOS zoom (16px minimum)
- Send button is thumb-friendly

---

### 2. Stage1.css - No Mobile Responsiveness

**File:** `frontend/src/components/Stage1.css`
**Lines:** 1-443
**Problem:** Council responses (the core feature!) don't adapt to mobile.

#### What's Broken:

| Line | Element | Problem |
|------|---------|---------|
| 62-67 | `.tabs` | `flex-wrap: wrap` is ok but tabs still too large |
| 69-78 | `.tab` | `padding: 8px 16px` - tabs overflow on mobile |
| 2 | `.stage` | `padding: 20px` too generous on mobile |
| 36-38 | `.stage-topic` | `max-width: 50%` still too wide, text truncates badly |

#### The Fix:

```css
/* Add to Stage1.css */
@media (max-width: 768px) {
  .stage {
    margin: 12px 0;
    padding: 12px;
  }

  .stage-title {
    font-size: 14px;
    flex-wrap: wrap;
  }

  .stage-topic {
    max-width: 100%;
    flex-basis: 100%;
    margin-left: 0;
    margin-top: 4px;
  }

  .tabs {
    gap: 4px;
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
  }

  .tab {
    padding: 6px 10px;
    font-size: 12px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .tab-content {
    padding: 12px;
  }

  .response-text {
    font-size: 14px;
    line-height: 1.5;
  }

  .code-block-wrapper pre {
    font-size: 12px;
    padding: 28px 8px 8px 8px;
  }
}

@media (max-width: 480px) {
  .tabs {
    /* Show scrollable tabs hint */
    mask-image: linear-gradient(to right, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%);
  }

  .tab {
    padding: 6px 8px;
    font-size: 11px;
  }
}
```

---

### 3. Touch Targets Are Too Small

**Apple/Google Guideline:** Minimum 44x44px touch targets

#### Current Violations:

| Component | Element | Current Size | Required |
|-----------|---------|--------------|----------|
| Sidebar.css:382 | `.export-btn` | 24x24px | 44x44px |
| Sidebar.css:565 | `.hover-action-btn` | 28x28px | 44x44px |
| ChatInterface.css:975 | `.add-project-btn` | 28x28px | 44x44px |
| Sidebar.css:120-137 | `.search-clear` | 20x20px | 44x44px |
| App.css:42 | `.mobile-menu-btn` | 40x40px | 44x44px |

#### The Fix Pattern:

```css
/* Touch target mixin approach */
@media (max-width: 768px) {
  /* Increase all action buttons */
  .hover-action-btn,
  .export-btn,
  .add-project-btn,
  .search-clear {
    min-width: 44px;
    min-height: 44px;
    /* Keep visual size smaller with padding */
    padding: 10px;
  }

  .mobile-menu-btn {
    width: 44px;
    height: 44px;
  }
}
```

---

### 4. Form Inputs Cause iOS Zoom

**Problem:** Any input with `font-size` < 16px triggers iOS Safari zoom.

#### Violations:

| File | Line | Element | Current | Fix |
|------|------|---------|---------|-----|
| Sidebar.css:100 | `.search-input` | 13px | 16px on mobile |
| ChatInterface.css:484 | `.message-input` | 15px | 16px on mobile |

#### The Fix:

```css
@media (max-width: 768px) {
  .search-input,
  .message-input,
  input[type="text"],
  textarea {
    font-size: 16px; /* Prevents iOS zoom */
  }
}
```

---

### 5. Sidebar Filter Row Overflows

**File:** `frontend/src/components/Sidebar.css`
**Lines:** 157-227

**Problem:** The filter triggers are 30px tall with flex-shrink: 0, causing horizontal overflow on small screens.

#### The Fix:

```css
/* Add to Sidebar.css */
@media (max-width: 768px) {
  .sidebar-filter {
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-select-trigger {
    flex: 1 1 45%;
    min-width: 0 !important;
  }

  .sort-select-trigger {
    flex: 1 1 100%;
  }
}
```

---

## Medium Priority Issues

### 6. Empty State Wastes Space

**File:** `frontend/src/components/ChatInterface.css`
**Lines:** 102-156

The empty state icon, title, and hints don't scale down.

```css
@media (max-width: 768px) {
  .empty-state {
    padding: 24px 16px;
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    padding: 12px;
  }

  .empty-state h2 {
    font-size: 18px;
  }

  .empty-state p {
    font-size: 13px;
  }
}
```

---

### 7. Back to Company Button Overlaps Content

**File:** `frontend/src/components/ChatInterface.css`
**Lines:** 12-46

The floating button uses `left: 50%; transform: translateX(-50%)` which works, but on mobile it can overlap message content.

```css
@media (max-width: 768px) {
  .back-to-company-btn {
    position: fixed;
    top: auto;
    bottom: 80px; /* Above input form */
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    font-size: 12px;
    padding: 8px 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}
```

---

### 8. Mode Toggle Pills Overflow

**File:** `frontend/src/components/ChatInterface.css`
**Lines:** 737-870

The mode buttons, department pills, and role pills don't wrap or scroll on narrow screens.

```css
@media (max-width: 768px) {
  .mode-toggle-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .mode-buttons {
    flex-shrink: 0;
  }

  .department-pills,
  .role-pills {
    flex: 1;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin-left: 0;
    scrollbar-width: none;
  }

  .department-pills::-webkit-scrollbar,
  .role-pills::-webkit-scrollbar {
    display: none;
  }
}
```

---

## Low Priority (Nice to Have)

### 9. Add Swipe-to-Close Sidebar

Currently, users must tap the X or overlay to close the sidebar. Add swipe gesture:

```jsx
// In Sidebar.jsx - use a gesture library like @use-gesture/react
import { useDrag } from '@use-gesture/react';

const bind = useDrag(({ movement: [mx], cancel }) => {
  if (mx < -50) {
    onClose();
    cancel();
  }
});

return <aside {...bind()} className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
```

---

### 10. Hide Beta Banner on Mobile Scroll

The beta banner takes 36px of precious mobile viewport. Consider hiding it on scroll:

```css
.beta-banner {
  transition: transform 0.3s ease;
}

.beta-banner.scrolled {
  transform: translateY(-100%);
}
```

---

### 11. Add Pull-to-Refresh on Message List

For Perplexity-like feel, add pull-to-refresh:

```jsx
// Consider using react-pull-to-refresh or similar
import PullToRefresh from 'react-simple-pull-to-refresh';

<PullToRefresh onRefresh={handleRefresh}>
  <div className="messages-container">
    {messages}
  </div>
</PullToRefresh>
```

---

## Perplexity-Specific Recommendations

To truly feel like Perplexity on mobile:

### 1. Search-First Landing

Perplexity shows a big search input centered. Consider:

```css
/* Mobile-first empty state */
@media (max-width: 768px) {
  .empty-state {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 20vh;
  }

  /* Make the input area more prominent when empty */
  .input-form.empty-chat {
    position: fixed;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 500px;
  }
}
```

### 2. Collapsible Context Bar

On mobile, hide context selectors behind a single button:

```jsx
// Mobile: [Customize Context ▼] expands to full options
// Desktop: Show all inline
```

### 3. Bottom Navigation

Consider moving key actions to bottom on mobile:

```
┌─────────────────────────────────┐
│                                 │
│     Chat messages               │
│                                 │
├─────────────────────────────────┤
│ [Input................................]  │
├─────────────────────────────────┤
│ [New] [History] [Company] [Settings]    │  <- Bottom nav
└─────────────────────────────────┘
```

### 4. Haptic Feedback

For native-like feel on actions:

```javascript
// On send, stage complete, etc.
if ('vibrate' in navigator) {
  navigator.vibrate(10);
}
```

---

## Implementation Priority

### Phase 1: Critical (Do First)
1. Add mobile media queries to ChatInterface.css
2. Add mobile media queries to Stage1.css
3. Fix touch target sizes
4. Fix iOS zoom on inputs

### Phase 2: Polish
5. Fix sidebar filter overflow
6. Improve empty state
7. Fix mode toggle overflow

### Phase 3: Delight
8. Add swipe-to-close
9. Consider bottom navigation
10. Add subtle animations

---

## Files to Modify (Summary)

| File | Lines to Add | Priority |
|------|--------------|----------|
| `frontend/src/components/ChatInterface.css` | ~80 lines | CRITICAL |
| `frontend/src/components/Stage1.css` | ~50 lines | CRITICAL |
| `frontend/src/components/Sidebar.css` | ~30 lines | HIGH |
| `frontend/src/App.css` | ~10 lines | MEDIUM |

---

## Testing Checklist

After implementing fixes, test on:

- [ ] iPhone SE (375px) - smallest common phone
- [ ] iPhone 14 Pro (390px) - modern iPhone
- [ ] Pixel 7 (412px) - Android flagship
- [ ] iPad Mini (768px) - tablet breakpoint
- [ ] Galaxy Fold (280px) - extreme narrow case

Use Chrome DevTools device emulator and real devices.

---

## Expected Outcome

After these fixes:

| Metric | Before | After |
|--------|--------|-------|
| Chat usable on mobile | | |
| Touch targets meet guidelines | 30% | 100% |
| iOS zoom issues | 2 inputs | 0 |
| Horizontal scroll bugs | 4 places | 0 |
| Perplexity-like feel | 2/10 | 7/10 |

---

## Quick Wins (< 30 min each)

1. **Add `font-size: 16px` to inputs** (5 min)
2. **Add mobile padding reduction** (10 min)
3. **Add touch target size increases** (15 min)
4. **Add tabs horizontal scroll** (10 min)

These 4 changes alone will make the app 50% more usable on mobile.
