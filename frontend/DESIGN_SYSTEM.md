# AxCouncil Design System

## Overview

This document defines the design tokens and component patterns used throughout the AxCouncil frontend. All new code should follow these guidelines.

## Design Tokens

All design tokens are defined in `src/styles/tailwind.css` under `:root`.

### Z-Index Scale

Use these CSS variables instead of arbitrary z-index values:

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 1 | Default stacking for positioned elements |
| `--z-above` | 2 | Just above siblings (badges, overlays on cards) |
| `--z-raised` | 5 | Slightly elevated (floating action buttons) |
| `--z-elevated` | 10 | Cards, tooltips, popovers |
| `--z-header` | 20 | Fixed headers, navbars |
| `--z-overlay` | 40 | Overlays below sticky elements |
| `--z-sticky` | 50 | Sticky elements (sidebar, headers) |
| `--z-dropdown` | 100 | Dropdowns, context menus |
| `--z-modal` | 1000 | Modal dialogs |
| `--z-modal-dropdown` | 1100 | Dropdowns inside modals |
| `--z-toast` | 1200 | Toast notifications |

```css
/* Good */
.my-modal {
  z-index: var(--z-modal);
}

/* Bad - don't use arbitrary values */
.my-modal {
  z-index: 9999;
}
```

### Shadow Scale

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation (cards) |
| `--shadow-md` | Medium elevation (dropdowns) |
| `--shadow-lg` | High elevation (modals) |
| `--shadow-modal` | Modal dialogs |
| `--shadow-focus` | Focus ring for accessibility |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small elements, badges |
| `--radius-md` | 8px | Default (buttons, inputs) |
| `--radius-lg` | 12px | Cards, modals |
| `--radius-full` | 9999px | Pills, circular elements |

### Color Tokens

#### Text Colors
- `--color-text-primary` - Main text
- `--color-text-secondary` - Supporting text
- `--color-text-tertiary` - Subtle text
- `--color-text-muted` - Disabled/placeholder text
- `--color-text-inverse` - Text on dark backgrounds

#### Background Colors
- `--color-bg-primary` - Main background (white)
- `--color-bg-secondary` - Secondary areas
- `--color-bg-tertiary` - Tertiary/muted areas
- `--color-bg-hover` - Hover states
- `--color-bg-active` - Active/pressed states

#### Brand Colors
- `--color-brand-primary` - Primary blue (#4a90e2)
- `--color-accent` - Orange accent (#f97316)
- `--color-indigo` - Indigo accent (#6366f1)

#### Semantic Colors
- `--color-success` - Success states (#10b981)
- `--color-error` - Error states (#ef4444)
- `--color-warning` - Warning states (#f59e0b)
- `--color-info` - Info states (#3b82f6)

## Component Guidelines

### Buttons

Always use the shadcn Button component:

```tsx
import { Button } from '@/components/ui/button';

// Primary action
<Button variant="default">Submit</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Ghost/subtle action
<Button variant="ghost">More</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Cards

Use the shadcn Card component:

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    {/* Actions */}
  </CardFooter>
</Card>
```

### Forms

Use shadcn form components:
- `<Input>` for text inputs
- `<Select>` for dropdowns
- `<Switch>` for toggles
- `<Dialog>` for modals

## Styling Rules

### DO:
1. Use CSS variables for colors, spacing, z-index
2. Use Tailwind utility classes when appropriate
3. Use shadcn components instead of custom implementations
4. Keep CSS files under 500 lines

### DON'T:
1. Don't use `!important` - fix specificity instead
2. Don't hardcode hex colors - use CSS variables
3. Don't use arbitrary z-index values - use the scale
4. Don't create inline styles - use classes

## File Organization

```
src/
├── styles/
│   └── tailwind.css     # Design tokens + Tailwind config
├── components/
│   └── ui/              # shadcn components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
└── ...
```

## Migration Notes

This codebase is migrating from vanilla CSS to Tailwind + shadcn/ui. When updating existing code:

1. Replace custom button implementations with `<Button>`
2. Replace custom card patterns with `<Card>`
3. Replace hardcoded z-index with `var(--z-*)`
4. Replace hardcoded colors with CSS variables
5. Remove `!important` where possible
