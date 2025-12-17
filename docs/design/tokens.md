# Design Tokens

Design tokens are the single source of truth for visual values. They're defined as CSS variables in `frontend/src/styles/tailwind.css`.

## Z-Index Scale

**Status: Standardized**

All z-index values use CSS variables. Never use hardcoded numbers.

| Token | Value | Use Case |
|-------|-------|----------|
| `--z-base` | 1 | Default stacking within a component |
| `--z-sticky` | 50 | Sticky headers, floating action buttons |
| `--z-dropdown` | 100 | Dropdowns, tooltips, popovers |
| `--z-modal` | 1000 | Modal overlays and dialogs |
| `--z-modal-dropdown` | 1100 | Dropdowns that appear inside modals |
| `--z-toast` | 1200 | Toast notifications (always on top) |

### Usage

```css
/* Correct */
.my-modal {
  z-index: var(--z-modal);
}

/* Wrong - don't do this */
.my-modal {
  z-index: 9999;
}
```

### When to Use Each Level

- **z-base**: Elements that need to stack above siblings but stay within their container
- **z-sticky**: Elements that stick during scroll (sticky headers, copy buttons)
- **z-dropdown**: Any overlay that appears on hover/click but isn't a full modal
- **z-modal**: Full-screen overlays with backdrop blur/dim
- **z-modal-dropdown**: For `<Select>` or other dropdowns rendered inside a modal
- **z-toast**: System notifications that must appear above everything

---

## Shadows

**Status: Tokens defined, migration gradual**

Shadow tokens are now available. Use these instead of arbitrary box-shadow values.

| Token | Value | Use Case |
|-------|-------|----------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation (buttons, inputs) |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards, dropdowns |
| `--shadow-lg` | `0 10px 25px -5px rgba(0,0,0,0.15)` | Popovers, elevated panels |
| `--shadow-modal` | `0 20px 60px rgba(0,0,0,0.3)` | Modal dialogs |
| `--shadow-focus` | `0 0 0 3px rgba(99,102,241,0.1)` | Focus rings |

### Usage

```css
/* Correct */
.my-card {
  box-shadow: var(--shadow-md);
}

.my-modal {
  box-shadow: var(--shadow-modal);
}

input:focus {
  box-shadow: var(--shadow-focus);
}

/* Wrong - don't do this */
.my-card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Migration

Existing code still has ~112 unique shadow values. When modifying a file, migrate its shadows to use tokens.

---

## Border Radius

**Status: Tokens defined, migration gradual**

Border radius tokens are now available. Use these instead of arbitrary pixel values.

| Token | Value | Use Case |
|-------|-------|----------|
| `--radius-sm` | `4px` | Small chips, badges, code blocks |
| `--radius-md` | `8px` | Buttons, inputs, list items |
| `--radius-lg` | `12px` | Cards, dropdowns, modals |
| `--radius-full` | `9999px` | Circular elements, pills, avatars |

### Usage

```css
/* Correct */
.my-button {
  border-radius: var(--radius-md);
}

.my-dropdown {
  border-radius: var(--radius-lg);
}

.my-avatar {
  border-radius: var(--radius-full);
}

/* Wrong - don't do this */
.my-button {
  border-radius: 8px;
}
```

### Migration

Existing code still has 13 different radius values. When modifying a file, migrate to tokens.

---

## Colors

**Status: Partially standardized**

### Standardized (use these)

Semantic colors are defined in `tailwind.css`:

```css
--background    /* Page background */
--foreground    /* Primary text */
--muted         /* Muted backgrounds */
--muted-foreground /* Secondary text */
--border        /* Border color */
--destructive   /* Error/danger actions */
```

### Department Colors

Use `getDeptColor(deptId)` from `frontend/src/lib/colors.js`:

```jsx
import { getDeptColor } from '@/lib/colors';

const colors = getDeptColor(department.id);
// Returns: { bg, text, border, hoverBg }
```

### Playbook Type Colors

Use `getPlaybookTypeColor(type)` from `frontend/src/lib/colors.js`:

```jsx
import { getPlaybookTypeColor } from '@/lib/colors';

const colors = getPlaybookTypeColor('sop'); // or 'framework', 'policy'
// Returns: { bg, text, border, hoverBg, shadowColor }
```

### Not Standardized

There are still ~1,500 hardcoded hex values in CSS files. When modifying a file, prefer migrating colors to CSS variables or the utilities above.

---

## Adding New Tokens

1. Add the CSS variable to `frontend/src/styles/tailwind.css` under `:root`
2. Document it in this file
3. Update existing usages gradually (no big-bang refactor needed)
