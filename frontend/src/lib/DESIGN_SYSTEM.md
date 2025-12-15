# AI Council Design System

This document defines the visual language and component patterns for consistent UI across the application.

---

## 1. Color Philosophy

### Core Principle
Colors communicate **meaning**, not decoration. Each color family has a purpose:

| Color Family | Purpose | Use Cases |
|--------------|---------|-----------|
| **Green** | Positive, success, creation | Promoted, Created, Active |
| **Red** | Destructive, danger, removal | Deleted, Error, Critical |
| **Blue** | Neutral action, information | Saved, Info, Primary actions |
| **Yellow/Amber** | Caution, modification, pending | Updated, Warning, In progress |
| **Gray** | Inactive, archived, disabled | Archived, Disabled, Secondary |
| **Purple** | Special, premium, policy | Policy type, Premium features |

---

## 2. Action Badge Colors

Used in Activity logs, status indicators, and action feedback.

```javascript
const ACTION_COLORS = {
  deleted:  { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },  // Red
  promoted: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },  // Green
  saved:    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },  // Blue
  created:  { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },  // Green
  updated:  { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },  // Yellow
  archived: { bg: '#f5f5f4', text: '#78716c', border: '#d6d3d1' },  // Gray
};
```

### Badge CSS Pattern
```css
.badge {
  font-size: 10px;
  padding: 2px 8px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## 3. Department Colors

Departments use a rotating 8-color palette. Colors are assigned based on department ID hash for consistency.

**Import:** `import { getDeptColor } from '../lib/colors';`

| # | Name | Background | Text | Border | Hover |
|---|------|------------|------|--------|-------|
| 1 | Amber | `#fef3c7` | `#92400e` | `#fcd34d` | `#fde68a` |
| 2 | Blue | `#dbeafe` | `#1e40af` | `#93c5fd` | `#bfdbfe` |
| 3 | Green | `#dcfce7` | `#166534` | `#86efac` | `#bbf7d0` |
| 4 | Pink | `#fce7f3` | `#9d174d` | `#f9a8d4` | `#fbcfe8` |
| 5 | Indigo | `#e0e7ff` | `#3730a3` | `#a5b4fc` | `#c7d2fe` |
| 6 | Yellow | `#fef9c3` | `#854d0e` | `#fde047` | `#fef08a` |
| 7 | Teal | `#ccfbf1` | `#115e59` | `#5eead4` | `#99f6e4` |
| 8 | Rose | `#ffe4e6` | `#9f1239` | `#fda4af` | `#fecdd3` |

### Usage
```javascript
const colors = getDeptColor(department.id);
// Returns: { bg, text, border, hoverBg }

// Apply to element:
<span style={{ background: colors.bg, color: colors.text }}>
  {department.name}
</span>
```

### Department Badge CSS
```css
.dept-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.dept-badge:hover {
  filter: brightness(0.95);
}
```

---

## 4. Playbook Type Colors

Three document types with distinct visual identity.

**Import:** `import { getPlaybookTypeColor } from '../lib/colors';`

| Type | Background | Text | Shadow |
|------|------------|------|--------|
| **SOP** | `#dbeafe` | `#1d4ed8` | `rgba(29, 78, 216, 0.15)` |
| **Framework** | `#fef3c7` | `#b45309` | `rgba(180, 83, 9, 0.15)` |
| **Policy** | `#f3e8ff` | `#7c3aed` | `rgba(124, 58, 237, 0.15)` |

### Type Badge CSS
```css
.type-badge {
  font-size: 10px;
  padding: 3px 8px;
  font-weight: 700;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 2px var(--shadow-color);
}
```

---

## 5. Component Patterns

### 5.1 List Items

Standard pattern for clickable list rows:

```css
.list-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.15s ease;
}

.list-item:hover {
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transform: translateX(2px);
}
```

### 5.2 Cards

For content containers:

```css
.card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-elevated {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

### 5.3 Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  max-height: 85vh;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

---

## 6. Buttons

### Primary (Orange brand color)
```css
.btn-primary {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
}
```

### Secondary
```css
.btn-secondary {
  background: white;
  color: #374151;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}
```

### Danger
```css
.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fee2e2;
}
```

---

## 7. Dropdowns / Selects

### Trigger
```css
.select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

/* When value is selected, fill with that item's color */
.select-trigger.has-selection {
  border: 1px solid currentColor;
}
```

### Dropdown Panel
```css
.select-content {
  z-index: 9999;
  max-height: 300px;
  min-width: 8rem;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: white;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  animation: dropdownIn 0.15s ease-out;
}

@keyframes dropdownIn {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

### Dropdown Items
```css
.select-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.1s ease;
}

/* Hover: use item's hover color */
.select-item[data-highlighted] {
  background: var(--item-hover-bg, #f3f4f6);
}

/* Selected: use item's main color */
.select-item[data-state="checked"] {
  background: var(--item-checked-bg, #f3f4f6);
  color: var(--item-checked-text, #374151);
}
```

---

## 8. Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

### Scale
| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 | 24px | 700 | #111827 |
| H2 | 20px | 600 | #1f2937 |
| H3 | 16px | 600 | #374151 |
| Body | 14px | 400 | #4b5563 |
| Small | 12px | 400 | #6b7280 |
| Micro | 10px | 500 | #9ca3af |

---

## 9. Spacing

Use 4px base unit:

| Name | Value | Use |
|------|-------|-----|
| xs | 4px | Tight gaps |
| sm | 8px | Between related items |
| md | 16px | Section padding |
| lg | 24px | Card padding |
| xl | 32px | Major sections |

---

## 10. Status Indicators

### Dot Indicators
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.active { background: #10b981; }
.status-dot.pending { background: #f59e0b; }
.status-dot.inactive { background: #9ca3af; }
.status-dot.error { background: #ef4444; }
```

### Left Border Accent (like Team list)
```css
.list-item-accented {
  border-left: 3px solid var(--accent-color);
  padding-left: 16px;
}
```

---

## 11. Animations

### Standard Transitions
```css
/* Micro interactions */
transition: all 0.15s ease;

/* Modal/overlay fade */
transition: opacity 0.2s ease;

/* Slide in */
transition: transform 0.2s ease-out;
```

### Hover Lift
```css
.hoverable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

---

## 12. File Organization

```
frontend/src/lib/
├── colors.js          # Color definitions & helpers
├── utils.js           # cn() and other utilities
└── DESIGN_SYSTEM.md   # This file

frontend/src/components/ui/
├── DepartmentSelect.jsx
├── DepartmentSelect.css
├── select.jsx         # Base Radix select wrapper
└── [future components]
```

---

## 13. Implementation Checklist

When building new components:

- [ ] Import colors from `lib/colors.js`, don't hardcode
- [ ] Use `getDeptColor(id)` for department-specific colors
- [ ] Use `getPlaybookTypeColor(type)` for SOP/Framework/Policy
- [ ] Follow ACTION_COLORS for status badges
- [ ] Use CSS custom properties for dynamic theming
- [ ] Apply standard border-radius (6px small, 8px medium, 12px large, 16px cards)
- [ ] Use 4px spacing grid
- [ ] Add hover states with 0.15s transitions
- [ ] Test with all 8 department colors
- [ ] Ensure z-index for dropdowns is 9999 (above modals at 1100)
