# Mobile Row Height Fix - Touch Target Accessibility

## Summary
Fixed mobile list row heights to meet WCAG 44-48px minimum touch target accessibility requirements across four key components.

## Issues Fixed

### 1. Activity Tab (mycompany/styles/tabs/activity.css)
- **Before:** 42px row height (too small for touch)
- **After:** 52px min-height on `.mc-activity-item`
- **Change:** Added mobile media query (width <= 640px)
- **Impact:** Activity feed rows now meet accessibility standards

### 2. LLM Hub Model Selection (mycompany/styles/tabs/llm-hub/models.css)
- **Before:** 35px row height (too small for touch)
- **After:** 48px min-height on `.llm-model-row`
- **Change:** Added mobile media query (width <= 640px)
- **Impact:** Model selection and fallback chain rows are now touch-friendly

### 3. Conversation List (sidebar/sidebar-conversations.css)
- **Before:** 44px row height (borderline)
- **After:** 52px min-height on `.conversation-item`, 44px on `.group-header`
- **Change:** Added mobile media query (width <= 640px)
- **Impact:** Conversation items have better touch spacing

### 4. Billing Plan Features (BillingPlans.css & BillingSection.css)
- **Before:** 32px row height (too small for touch)
- **After:** 44px min-height on `.plan-features li`
- **Change:** Added mobile media queries (width <= 640px)
- **Impact:** Feature list items are now touch-accessible

## CSS Budget Compliance

| File | Lines | Status | Mobile Rules |
|------|-------|--------|--------------|
| activity.css | 289 | OK | 52px min-height |
| models.css | 177 | OK | 48px min-height |
| sidebar-conversations.css | 291 | OK | 52px min-height |
| BillingPlans.css | 217 | OK | 44px min-height |
| BillingSection.css | 211 | OK | 44px min-height |
| **TOTAL** | **1185** | OK | All compliant |

All files remain within the 300-line per file budget.

## Implementation Details

### Activity Tab
```css
@media (width <= 640px) {
  .mc-activity-item {
    min-height: 52px;
    padding: var(--space-3) var(--space-4);
  }
}
```

### LLM Hub Models
```css
@media (width <= 640px) {
  .llm-model-row {
    min-height: 48px;
    padding: var(--space-3) 0;
  }
}
```

### Conversation List
```css
@media (width <= 640px) {
  .conversation-item { min-height: 52px; padding: var(--space-3); }
  .group-header { min-height: 44px; padding: var(--space-2) var(--space-3); }
}
```

### Billing Features
```css
@media (width <= 640px) {
  .plan-features li {
    min-height: 44px;
    padding: var(--space-3) 0;
    display: flex;
    align-items: center;
  }
}
```

## WCAG Compliance
- All touch targets now meet or exceed 44-48px minimum
- Implemented using CSS variables for spacing consistency
- Mobile-only rules (width <= 640px) maintain desktop behavior
- Semantic spacing tokens ensure alignment with design system

## Testing Recommendations
1. Test on various mobile devices (320px - 640px width)
2. Verify touch responsiveness with actual fingers
3. Check spacing consistency with design tokens
4. Ensure no visual regressions on desktop (no changes applied)

## Files Modified
- frontend/src/components/mycompany/styles/tabs/activity.css
- frontend/src/components/mycompany/styles/tabs/llm-hub/models.css
- frontend/src/components/sidebar/sidebar-conversations.css
- frontend/src/components/BillingPlans.css
- frontend/src/components/settings/BillingSection.css
