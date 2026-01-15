# Design Tokens Documentation

> **Enterprise-Grade Design System** - Single Source of Truth for AxCouncil Visual Language

This document provides comprehensive documentation for all design tokens in the AxCouncil design system. These tokens ensure consistency, maintainability, and scalability across the entire application.

---

## Table of Contents

- [Overview](#overview)
- [Token Files](#token-files)
- [Spacing System](#spacing-system)
- [Typography](#typography)
- [Colors](#colors)
- [Border Radius](#border-radius)
- [Shadows](#shadows)
- [Animation](#animation)
- [Component Tokens](#component-tokens)
- [Usage Guidelines](#usage-guidelines)
- [TypeScript Integration](#typescript-integration)

---

## Overview

Design tokens are the visual design atoms of the design system — specifically, they are named entities that store visual design attributes. We use them in place of hard-coded values (such as hex values for color or pixel values for spacing) to maintain a scalable and consistent visual system.

### Benefits

- **Consistency**: Same spacing/colors across all components
- **Maintainability**: Change once, update everywhere
- **Type Safety**: TypeScript autocomplete for all tokens
- **Scalability**: Easy to add new variants without breaking existing code
- **Collaboration**: Designers and developers speak the same language

### Token Organization

Tokens are organized into two files:

1. **`design-tokens.css`** - Core tokens (spacing, typography, radius, shadows, animations)
2. **`tailwind.css`** - Color palettes, z-index scale, overlay utilities

---

## Token Files

### design-tokens.css

**Location**: `frontend/src/styles/design-tokens.css`

Contains:
- Spacing scale (4px base unit)
- Typography (fonts, sizes, weights, line heights, letter spacing)
- Border radius
- Shadows
- Animation durations and easing
- Component-specific tokens (buttons, inputs, cards, etc.)

### tailwind.css

**Location**: `frontend/src/styles/tailwind.css`

Contains:
- Z-index scale (layering system)
- Color palettes (brand, semantic, department, tag colors)
- Overlay utilities (transparent blacks/whites)
- Semantic color mappings

---

## Spacing System

AxCouncil uses a **4px base unit** spacing system for mathematical consistency.

### Base Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0 | No spacing |
| `--space-1` | 4px | Micro spacing, tight gaps |
| `--space-2` | 8px | Compact spacing |
| `--space-3` | 12px | Default small spacing |
| `--space-4` | 16px | Standard spacing |
| `--space-5` | 20px | Comfortable spacing |
| `--space-6` | 24px | Large spacing |
| `--space-8` | 32px | Extra large spacing |
| `--space-10` | 40px | Section spacing |
| `--space-12` | 48px | Major section spacing |
| `--space-16` | 64px | Hero spacing |

### Semantic Spacing

Instead of using raw spacing scale values, prefer semantic tokens that convey intent:

#### Card Padding

```css
--card-padding-sm: var(--space-3);  /* 12px - compact cards */
--card-padding: var(--space-4);     /* 16px - default cards */
--card-padding-lg: var(--space-5);  /* 20px - large cards */
--card-padding-xl: var(--space-6);  /* 24px - hero/feature cards */
```

#### Gap (horizontal spacing)

```css
--gap-xs: var(--space-1);   /* 4px - tight spacing */
--gap-sm: var(--space-2);   /* 8px - compact spacing */
--gap: var(--space-3);      /* 12px - default spacing */
--gap-md: var(--space-4);   /* 16px - comfortable spacing */
--gap-lg: var(--space-6);   /* 24px - section spacing */
--gap-xl: var(--space-8);   /* 32px - major section spacing */
```

#### Stack (vertical spacing)

```css
--stack-xs: var(--space-1);  /* 4px */
--stack-sm: var(--space-2);  /* 8px */
--stack: var(--space-3);     /* 12px */
--stack-md: var(--space-4);  /* 16px */
--stack-lg: var(--space-6);  /* 24px */
```

### Usage Example

```css
/* ❌ BAD: Hardcoded pixel values */
.card {
  padding: 16px;
  gap: 12px;
}

/* ✅ GOOD: Semantic tokens */
.card {
  padding: var(--card-padding);
  gap: var(--gap);
}

/* ✅ BETTER: Tailwind utilities for layout */
<div className="p-4 gap-3">...</div>
```

---

## Typography

AxCouncil uses **Geist** as the primary font with **Inter** as a fallback, optimized for premium readability.

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | Geist, Inter, system UI | Body text, UI elements |
| `--font-mono` | Geist Mono, JetBrains Mono | Code blocks, monospace |

### Font Sizes

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | 12px | Captions, badges, labels |
| `--text-sm` | 14px | Secondary text, small UI |
| `--text-base` | 16px | Body text (default) |
| `--text-lg` | 18px | Emphasized body text |
| `--text-xl` | 20px | Small headings, titles |
| `--text-2xl` | 24px | Section headings |
| `--text-3xl` | 30px | Page headings |
| `--text-4xl` | 36px | Hero headings |
| `--text-5xl` | 48px | Display headings |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-normal` | 400 | Body text, paragraphs |
| `--font-medium` | 500 | Emphasized text, labels |
| `--font-semibold` | 600 | Headings, buttons |
| `--font-bold` | 700 | Strong emphasis, CTAs |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-none` | 1 | Icons, badges (tight) |
| `--leading-tight` | 1.2 | Headings |
| `--leading-snug` | 1.35 | Small headings, labels |
| `--leading-normal` | 1.5 | Body text (default) |
| `--leading-relaxed` | 1.625 | Long-form content |
| `--leading-loose` | 1.8 | Spacious reading |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tighter` | -0.03em | Large headings |
| `--tracking-tight` | -0.02em | Medium headings |
| `--tracking-normal` | -0.01em | Body text |
| `--tracking-wide` | 0.025em | Uppercase labels |
| `--tracking-wider` | 0.05em | Very loose spacing |

### Usage Example

```css
/* Heading style */
h1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  letter-spacing: var(--tracking-tighter);
}

/* Body text */
p {
  font-size: var(--text-base);
  font-weight: var(--font-normal);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
}
```

---

## Colors

Colors are organized into semantic categories. **Always use CSS variables, never hardcode hex/RGB values.**

### Background Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-bg-base` | `#fff` | `#191919` | Main background |
| `--color-bg-subtle` | `#fafafa` | `#202020` | Sidebar, secondary areas |
| `--color-bg-muted` | `#f5f5f5` | `#2f2f2f` | Cards, elevated surfaces |
| `--color-bg-emphasis` | `#ebebeb` | `#373737` | Hover states, active |
| `--color-bg-canvas` | `#f9fafb` | `#121212` | Page canvas |

### Text Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-text-default` | `#37352f` | `#ffffffcf` | Primary text |
| `--color-text-muted` | `#6b6b6b` | `#ffffff80` | Secondary text |
| `--color-text-subtle` | `#9b9b9b` | `#ffffff52` | Tertiary, placeholders |
| `--color-text-disabled` | `#c7c7c7` | `#fff3` | Disabled state |
| `--color-text-inverse` | `#fff` | `#191919` | On dark backgrounds |

### Border Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-border-default` | `#e8e8e8` | `#ffffff14` | Default borders |
| `--color-border-muted` | `#f0f0f0` | `#ffffff0a` | Subtle dividers |
| `--color-border-emphasis` | `#d4d4d4` | `#ffffff24` | Emphasized borders |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-success` | `#0f7b6c` | `#4dab9a` | Success states |
| `--color-success-subtle` | `#e6f4f1` | `#1f3733` | Success backgrounds |
| `--color-warning` | `#cb912f` | `#e9a94b` | Warning states |
| `--color-warning-subtle` | `#fbf3db` | `#3d3222` | Warning backgrounds |
| `--color-error` | `#e03e3e` | `#ff6b6b` | Error states |
| `--color-error-subtle` | `#fbe4e4` | `#4a2c2c` | Error backgrounds |
| `--color-info` | `#337ea9` | `#6cb6d9` | Info states |
| `--color-info-subtle` | `#ddebf1` | `#253743` | Info backgrounds |

### Brand Colors

Defined in `tailwind.css`:

```css
--color-primary: #6366f1;  /* Indigo - Brand color */
--color-accent: #6366f1;   /* Same as primary for consistency */
```

### Usage Example

```css
/* ❌ BAD: Hardcoded colors */
.button {
  background-color: #6366f1;
  color: #fff;
}

/* ✅ GOOD: CSS variables */
.button {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}
```

---

## Border Radius

Notion-inspired soft, approachable corners.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0 | Sharp corners |
| `--radius-xs` | 2px | Indicators, progress bars |
| `--radius-sm` | 4px | Badges, tags, code blocks |
| `--radius-default` | 6px | Small buttons, menu items |
| `--radius-md` | 8px | Buttons, inputs, dropdowns |
| `--radius-lg` | 12px | Cards, panels |
| `--radius-xl` | 16px | Modals, sheets |
| `--radius-2xl` | 20px | Hero sections, landing cards |
| `--radius-3xl` | 24px | Mobile sheets, dialogs |
| `--radius-full` | 9999px | Pills, avatars, circular |

### Semantic Tokens

```css
--card-radius: var(--radius-lg);      /* 12px */
--modal-radius: var(--radius-xl);     /* 16px */
```

---

## Shadows

Premium layered shadows for depth and elevation.

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Minimal elevation (1-2px) |
| `--shadow-sm` | Subtle elevation (4-8px) |
| `--shadow-md` | Medium elevation (8-16px) |
| `--shadow-lg` | High elevation (16-32px) |
| `--shadow-xl` | Very high elevation (24-48px) |
| `--shadow-2xl` | Maximum elevation (32-64px) |
| `--shadow-focus` | Accessibility focus ring |
| `--shadow-focus-error` | Error state focus ring |

### Semantic Tokens

```css
--modal-shadow: var(--shadow-2xl);  /* Maximum depth for modals */
```

### Dark Mode

Shadows are automatically adjusted in dark mode with higher opacity for visibility.

---

## Animation

Spring-like premium motion for buttery smooth interactions.

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 0ms | No animation |
| `--duration-fast` | 150ms | Quick interactions |
| `--duration-normal` | 250ms | Default animations |
| `--duration-slow` | 400ms | Deliberate transitions |
| `--duration-slower` | 500ms | Slow reveals |

### Easing Functions

| Token | Character | Usage |
|-------|-----------|-------|
| `--ease-default` | Smooth snappy spring | Default transitions |
| `--ease-in` | Accelerate | Exits, fade outs |
| `--ease-out` | Decelerate | Entrances, fade ins |
| `--ease-in-out` | Smooth S-curve | Reversible animations |
| `--ease-spring` | Bouncy overshoot | Playful interactions |
| `--ease-snappy` | Quick responsive | Button clicks |
| `--ease-gentle` | Gentle deceleration | Smooth reveals |
| `--ease-bounce` | Bounce effect | Celebrations |

### Usage Example

```css
/* Smooth button hover */
.button {
  transition:
    background-color var(--duration-normal) var(--ease-default),
    transform var(--duration-fast) var(--ease-snappy);
}

.button:hover {
  transform: scale(1.02);
}

/* Modal entrance */
.modal {
  animation: fadeIn var(--duration-slow) var(--ease-gentle);
}
```

---

## Component Tokens

Pre-configured tokens for common components.

### Buttons

```css
--btn-height-sm: 32px;
--btn-height-md: 36px;
--btn-height-lg: 44px;
--btn-padding-sm: var(--space-2) var(--space-3);
--btn-padding-md: var(--space-2) var(--space-4);
--btn-padding-lg: var(--space-3) var(--space-6);
```

### Inputs

```css
--input-height-sm: 32px;
--input-height-md: 40px;
--input-height-lg: 48px;
--input-padding: var(--space-2) var(--space-3);
```

### Cards

```css
--card-radius: var(--radius-lg);     /* 12px */
--card-padding: var(--space-4);      /* 16px */
--card-padding-lg: var(--space-5);   /* 20px */
--card-padding-xl: var(--space-6);   /* 24px */
```

### Modals

```css
--modal-padding: var(--space-6);     /* 24px */
--modal-radius: var(--radius-xl);    /* 16px */
--modal-shadow: var(--shadow-2xl);   /* Maximum depth */
```

### Sidebar

```css
--sidebar-width: 280px;
--sidebar-width-collapsed: 60px;
--sidebar-bg: var(--color-bg-subtle);
--sidebar-border: var(--color-border-default);
```

---

## Usage Guidelines

### 1. Always Use CSS Variables

```css
/* ❌ NEVER do this */
.card {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
}

/* ✅ ALWAYS do this */
.card {
  padding: var(--card-padding);
  background: var(--color-bg-base);
  border-radius: var(--card-radius);
}
```

### 2. Prefer Semantic Tokens

```css
/* ❌ Not ideal - raw scale values */
.card {
  padding: var(--space-4);
}

/* ✅ Better - semantic intent */
.card {
  padding: var(--card-padding);
}
```

### 3. Use Tailwind for Layout

```tsx
/* ✅ Tailwind utilities for layout */
<div className="flex items-center gap-4 p-6 rounded-lg bg-card">
  <Button>Click me</Button>
</div>
```

### 4. Component-Specific CSS for Complex Styles

```css
/* For complex interactions, animations, pseudo-elements */
.tooltip::before {
  content: '';
  border-color: var(--color-bg-emphasis) transparent;
  transition: opacity var(--duration-fast) var(--ease-default);
}
```

---

## TypeScript Integration

All design tokens have TypeScript type definitions for autocomplete and type safety.

### Import Types

```typescript
import type { DesignToken, CSSVar } from '@/types/design-tokens';
```

### Usage in Styled Components

```typescript
import { cssVar } from '@/types/design-tokens';

const Button = styled.button`
  padding: ${cssVar('--btn-padding-md')};
  color: ${cssVar('--color-text-default')};
  border-radius: ${cssVar('--radius-md')};
`;
```

### Usage in Inline Styles

```typescript
import type { DesignToken } from '@/types/design-tokens';

const style: React.CSSProperties = {
  padding: 'var(--space-4)' as DesignToken,
  color: 'var(--color-text-default)' as DesignToken,
};
```

### Helper Functions

```typescript
import { cssVar, cssVarWithFallback } from '@/types/design-tokens';

// Simple usage
const color = cssVar('--color-bg-base');
// Returns: 'var(--color-bg-base)'

// With fallback
const colorSafe = cssVarWithFallback('--color-bg-base', '#fff');
// Returns: 'var(--color-bg-base, #fff)'
```

---

## Visual Reference

### Color Swatches

**Light Mode**
```
Background:  ███ --color-bg-base (#fff)
             ███ --color-bg-subtle (#fafafa)
             ███ --color-bg-muted (#f5f5f5)

Text:        ███ --color-text-default (#37352f)
             ███ --color-text-muted (#6b6b6b)
             ███ --color-text-subtle (#9b9b9b)

Semantic:    ███ --color-success (#0f7b6c)
             ███ --color-warning (#cb912f)
             ███ --color-error (#e03e3e)
             ███ --color-primary (#6366f1)
```

**Dark Mode**
```
Background:  ███ --color-bg-base (#191919)
             ███ --color-bg-subtle (#202020)
             ███ --color-bg-muted (#2f2f2f)

Text:        ███ --color-text-default (#ffffffcf)
             ███ --color-text-muted (#ffffff80)
             ███ --color-text-subtle (#ffffff52)

Semantic:    ███ --color-success (#4dab9a)
             ███ --color-warning (#e9a94b)
             ███ --color-error (#ff6b6b)
             ███ --color-primary (#6366f1)
```

---

## Maintenance

### Adding New Tokens

1. **Add to CSS file** (`design-tokens.css` or `tailwind.css`)
2. **Add to TypeScript types** (`src/types/design-tokens.d.ts`)
3. **Update this documentation**
4. **Run tests** (`npm run test:run`)

### Deprecating Tokens

1. **Mark as deprecated** in CSS comments
2. **Add deprecation warning** in Stylelint plugin
3. **Update documentation**
4. **Create migration guide** for existing usage

---

## Performance

- **Bundle Impact**: CSS variables have zero runtime cost
- **Browser Support**: 99%+ global support (IE11 excluded)
- **Build Size**: Variables are preserved in production (no bloat)
- **Runtime**: Variables evaluate at native CSS speed

---

## Resources

- **Source Files**:
  - [`design-tokens.css`](./design-tokens.css)
  - [`tailwind.css`](./tailwind.css)
  - [`design-tokens.d.ts`](../types/design-tokens.d.ts)

- **Related Documentation**:
  - [CLAUDE.md CSS Architecture](../../CLAUDE.md#css-file-organization)
  - [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)

---

**Last Updated**: 2026-01-15
**Maintained By**: AxCouncil Engineering Team
