# Section Header Padding Fix for Mobile UX

## Issue
Section headers in Settings and My Company had inadequate vertical padding (8px) on mobile devices, making them appear cramped and reducing visual separation from content below.

## Solution
Increased section header padding from 8px (--space-2 / --card-padding-sm) to 16px (--space-4) within mobile media queries (width <= 640px).

## Files Modified

### 1. Settings Component
**File**: `frontend/src/components/settings/SettingsResponsive.css`

**Changes**: Added mobile-specific padding rule to the 640px media query:
```css
/* Section header padding - improve visual separation on mobile (16px instead of 12px) */
.settings-section-header,
.section-header,
.card-header,
.panel-header {
  padding-block: var(--space-4); /* 16px vertical padding */
  margin-bottom: var(--space-3);
}
```

**Target Elements**:
- `.settings-section-header` - Settings tab section headers
- `.section-header` - Generic section headers
- `.card-header` - Card headers in settings
- `.panel-header` - Panel headers

### 2. MyCompany Overview Tab
**File**: `frontend/src/components/mycompany/styles/tabs/overview/context-card.css`

**Changes**: Added mobile-specific padding rule to the 640px media query:
```css
/* Section header padding - improve visual separation on mobile (16px instead of 12px) */
.mc-context-section-header {
  padding-block: var(--space-4); /* 16px vertical padding */
}
```

**Targets**: Context section headers in the Overview tab (company context, decisions, playbooks, etc.)

## CSS Design Tokens Used
- `--space-4`: 16px (default padding)
- `--space-3`: 12px (margin-bottom for separation)
- `padding-block`: Logical property for top/bottom padding (RTL-safe)

## Impact
- **Settings Tab**: Better visual separation between section headers and form fields
- **My Company Overview**: Improved readability of section headers in context cards
- **Mobile Experience**: Reduced crowding and improved touch target clarity
- **Desktop**: No impact (rules only apply at 640px and below)

## Breakpoints
Rules apply to:
- Tablet/Large phones (640px and below)
- Small phones (400px and below) - inherits from parent 640px rule
- Very small phones (360px and below) - inherits from parent 640px rule

## CSS Budget Impact
- Lines added: 15 total (7 to each file)
- CSS budget status: No concerns (both files well under 300-line limit)
- Linting: All rules pass stylelint validation (no !important, proper formatting)

## Testing
- CSS linting: PASS (no errors, pre-existing warnings only)
- TypeScript: PASS (no type errors)
- Syntax validation: PASS (proper CSS formatting)

## Commit
```
e141979 fix(css): Increase section header padding on mobile (16px for better visual separation)
```

## References
- Spacing tokens: `/frontend/src/styles/design-tokens.css`
- Settings component: `/frontend/src/components/settings/`
- MyCompany component: `/frontend/src/components/mycompany/styles/tabs/overview/`
