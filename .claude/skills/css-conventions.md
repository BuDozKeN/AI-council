---
name: css-conventions
description: AxCouncil CSS coding standards, file organization, and budget rules
tags: [css, styling, frontend, budget]
---

# AxCouncil CSS Conventions

This skill contains all CSS conventions for the AxCouncil project. Load this when working on styling.

## File Organization

**CRITICAL RULE**: Every component gets exactly ONE CSS file. No exceptions.

```
Component.tsx → Component.css (ALWAYS paired, same directory)
```

### File Size Limits

- **Maximum 300 lines per CSS file**
- If CSS exceeds 300 lines → component is too complex → split into smaller components
- No mega-files allowed (ChatInterface.css was 3,230 lines - split into 10+ components)

### Where Styles Belong

| Style Type | Location | Example |
|------------|----------|---------|
| **Component-specific** | Component.css | `.chat-interface { }` in ChatInterface.css |
| **Layout** | Tailwind classes in JSX | `className="flex items-center gap-4"` |
| **Colors** | design-tokens.css ONLY | `--color-text-primary`, `--color-bg-card` |
| **Spacing tokens** | design-tokens.css | `--space-4`, `--space-6` |
| **Mobile @media** | Component.css (NOT separate mobile.css) | Mobile styles next to desktop styles |
| **Global reset** | index.css (<200 lines) | CSS reset, base element styles |

### Decision Tree: "Where Do I Put This Style?"

```
Is it a color value (hex/rgb)?
  ├─ YES → design-tokens.css as CSS variable
  └─ NO ↓

Is it layout (flex/grid/spacing)?
  ├─ YES → Tailwind utilities in className
  └─ NO ↓

Is it specific to ONE component?
  ├─ YES → ComponentName.css
  └─ NO ↓

Is it truly global (button reset, body font)?
  ├─ YES → index.css (max 200 lines)
  └─ NO → You probably need ComponentName.css
```

## NEVER Do This

```
❌ Create "shared.css" / "common.css" / "utils.css" (junk drawer antipattern)
❌ Put component styles in index.css
❌ Create separate mobile.css (mobile @media goes in component CSS)
❌ Put styles for ComponentA in ComponentB.css
❌ Split one component's styles across multiple CSS files
❌ Use hardcoded colors (#fff, rgba(255,0,0)) - use CSS variables
❌ Use !important (increase specificity instead)
❌ Exceed 300 lines in a CSS file
```

## ALWAYS Do This

```
✅ Component.tsx → Component.css (1:1 relationship)
✅ Mobile @media queries inside component CSS file
✅ Max 300 lines per CSS file
✅ Use CSS variables for colors: var(--color-text-primary)
✅ Use Tailwind for layout: className="flex gap-4"
✅ Split large components into smaller ones if CSS exceeds 300 lines
✅ Delete unused selectors immediately
```

## Tailwind vs CSS Decision

**Use Tailwind for:**
- Layout (flex, grid, gap)
- Spacing (p-4, m-2, gap-6)
- Responsive utilities (md:flex, lg:grid-cols-3)
- Simple positioning (relative, absolute, fixed)

**Use CSS files for:**
- Complex animations (@keyframes)
- Pseudo-elements (::before, ::after)
- Complex selectors (.parent:has(.child))
- State-based styling ([data-state="open"])
- Component-specific theming
- Hover/focus states with multiple properties

**NEVER do:**
- Same property in BOTH Tailwind AND CSS (creates conflicts)
- Tailwind arbitrary values for colors: `bg-[#fff]` (use CSS variables)

## Breakpoint Standards

**ONLY use these 3 breakpoints:**

```css
/* Mobile-first: default styles are mobile */

@media (min-width: 641px) {
  /* Tablet */
}

@media (min-width: 1025px) {
  /* Desktop */
}
```

**Do NOT use:**
- 768px, 480px, 400px, 360px, 600px, 800px (creates conflicts)
- Max-width queries (use min-width, mobile-first)

## Example: Correct CSS Structure

```css
/* ChatBubble.css - MAX 300 LINES */

/* Base styles (mobile-first) */
.chat-bubble {
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
}

/* Tablet */
@media (min-width: 641px) {
  .chat-bubble {
    padding: var(--space-4);
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .chat-bubble {
    padding: var(--space-6);
  }
}

/* State variations */
.chat-bubble[data-role="assistant"] {
  background: var(--color-bg-secondary);
}

/* Pseudo-elements */
.chat-bubble::before {
  content: '';
  /* ... */
}
```

## CSS Performance Budgets

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| **Source CSS** | 1300KB | ~1255KB | 97% used, ~45KB headroom |
| **Built CSS** | 700KB target | ~700KB | Under target |
| **Gzipped** | N/A | ~110KB | Excellent |

**CI Enforcement**: CI will **FAIL** if source CSS exceeds 1300KB.

### If CI Budget Check Fails

1. Check what changed: `git diff HEAD~1 --stat '*.css'`
2. Measure built bundle: `npm run build && du -ch dist/assets/css/*.css`
3. Identify bloat: Compare file sizes before/after your changes
4. Common fixes:
   - Remove unused CSS
   - Split large component into smaller ones
   - Use existing design tokens instead of creating new ones
   - Check for accidental CSS duplication

## CSS Specificity Notes

When creating variant styles, match the specificity of base styles:

```css
/* Base has 3 class selectors */
.omni-bar-wrapper.council-mode .omni-bar { border: 1px solid var(--color); }

/* Variant must also have 3+ to override */
.omni-bar-wrapper.omni-bar-landing .omni-bar { border: none; }
```

### Available Overlay Variables

Only use these defined overlay variables (from `tailwind.css`):
- `--overlay-white-10`, `--overlay-white-20`, `--overlay-white-40`
- `--overlay-black-10`, `--overlay-black-15`, `--overlay-black-20`, `--overlay-black-30`, `--overlay-black-40`, `--overlay-black-50`

Do NOT use non-existent variables like `--overlay-black-12`.

### Component-Specific Select Styles (LLM Hub Pattern)

**Problem:** Generic `select.css` has mobile styles that override component-specific sizing.

**Solution in `select.css`:**
1. Mobile rules use `:where()` to reduce specificity to 0
2. Components can opt out using `select-trigger--llm-model` class

```css
/* In select.css - :where() makes specificity 0 */
:where(.select-trigger:not(.select-trigger--llm-model)) {
  min-height: 44px;
  height: auto;
}

/* In llm-hub.css - normal specificity beats :where() */
.llm-model-item .llm-model-select.select-trigger {
  height: 36px;
  min-height: 36px;
}
```

```tsx
// In component - add opt-out class
<SelectTrigger className="llm-model-select select-trigger--llm-model">
```

## Enforcement

All CSS rules are enforced by:
- **Stylelint** - Runs on commit and in CI
- **CI Pipeline** - Fails PR if CSS violations detected
- **Pre-commit hooks** - Auto-fixes minor issues

Run `npm run lint:css` before committing.
