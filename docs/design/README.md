# AI Council Design System

This directory contains the design system documentation for the AI Council frontend.

## Purpose

Maintain visual and behavioral consistency across the application. When adding new UI, check these docs first to use existing patterns rather than creating new ones.

## Documentation

| Document | Contents |
|----------|----------|
| [tokens.md](./tokens.md) | CSS variables: z-index, shadows, radii, colors |
| [components.md](./components.md) | Reusable UI components: Spinner, Selects, etc. |
| [patterns.md](./patterns.md) | UI patterns: loading states, error handling, empty states |

## Quick Reference

### Z-Index Scale

```css
var(--z-base)           /* 1    - Default stacking */
var(--z-sticky)         /* 50   - Sticky headers, floating buttons */
var(--z-dropdown)       /* 100  - Dropdowns, tooltips */
var(--z-modal)          /* 1000 - Modal overlays */
var(--z-modal-dropdown) /* 1100 - Dropdowns inside modals */
var(--z-toast)          /* 1200 - Toast notifications */
```

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/styles/tailwind.css` | CSS variable definitions (tokens) |
| `frontend/src/lib/colors.js` | Department and playbook color utilities |
| `frontend/src/components/ui/Spinner.jsx` | Unified loading spinner |

## Contributing

When adding new design tokens or components:

1. Check if an existing token/component can be used
2. If new, add it to the appropriate file in this directory
3. Update the relevant documentation
4. Use CSS variables for any new values (don't hardcode)
