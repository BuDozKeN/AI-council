# UI Components

Reusable UI components in `frontend/src/components/ui/`.

## Spinner

**File:** `frontend/src/components/ui/Spinner.jsx`

A unified loading spinner with consistent sizing and colors.

### Usage

```jsx
import { Spinner } from '@/components/ui/Spinner';

// Default (medium, blue)
<Spinner />

// With options
<Spinner size="lg" variant="success" label="Saving..." />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | `"md"` | Spinner size |
| `variant` | `"default"` \| `"success"` \| `"brand"` \| `"muted"` | `"default"` | Color variant |
| `label` | `string` | `"Loading"` | Screen reader text |
| `className` | `string` | - | Additional CSS classes |

### Size Reference

| Size | Dimensions |
|------|------------|
| `sm` | 16px |
| `md` | 20px |
| `lg` | 32px |
| `xl` | 40px |

### Variant Colors

| Variant | Color | Use Case |
|---------|-------|----------|
| `default` | Blue | General loading |
| `success` | Green | Success states, completion |
| `brand` | Indigo | Brand-aligned actions |
| `muted` | Gray | Subtle/background loading |

---

## Select Components

**Location:** `frontend/src/components/ui/`

Radix UI-based select components with consistent styling.

### Available Selects

| Component | File | Purpose |
|-----------|------|---------|
| `DepartmentSelect` | `DepartmentSelect.jsx` | Select a single department |
| `MultiDepartmentSelect` | `MultiDepartmentSelect.jsx` | Select multiple departments |
| `StatusSelect` | `StatusSelect.jsx` | Select project/item status |
| `SortSelect` | `SortSelect.jsx` | Sort order selection |

### Styling Notes

All select dropdowns use:
- `border-radius: 12px` for the dropdown
- `z-index: var(--z-modal-dropdown)` when inside modals
- Consistent box-shadow and border colors

---

## LoadingState

**File:** `frontend/src/components/ui/LoadingState.jsx`

Centered loading spinner with optional message. Use instead of custom loading implementations.

### Usage

```jsx
import { LoadingState } from '@/components/ui/LoadingState';

// Basic
<LoadingState />

// With message
<LoadingState message="Loading projects..." />

// With size/variant
<LoadingState size="xl" variant="brand" message="Saving..." />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | - | Optional loading message |
| `size` | `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | `"lg"` | Spinner size |
| `variant` | `"default"` \| `"success"` \| `"brand"` \| `"muted"` | `"default"` | Spinner color |
| `className` | `string` | - | Additional CSS classes |

---

## EmptyState

**File:** `frontend/src/components/ui/EmptyState.jsx`

Empty state with icon, text, and optional action. Use when a list or container has no items.

### Usage

```jsx
import { EmptyState } from '@/components/ui/EmptyState';
import { FolderOpen } from 'lucide-react';

// Basic
<EmptyState
  title="No projects"
  message="Create your first project to get started"
/>

// With custom icon and action
<EmptyState
  icon={FolderOpen}
  title="No projects"
  message="Create your first project to get started"
  action={<Button onClick={handleCreate}>Create Project</Button>}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `React.ComponentType` | `Inbox` | Lucide icon component |
| `title` | `string` | - | Main heading |
| `message` | `string` | - | Secondary description |
| `action` | `React.ReactNode` | - | Action button/element |
| `className` | `string` | - | Additional CSS classes |

---

## ErrorState

**File:** `frontend/src/components/ui/ErrorState.jsx`

Error display with optional retry action. Use for failed data fetches or operations.

### Usage

```jsx
import { ErrorState } from '@/components/ui/ErrorState';

// Basic
<ErrorState message="Failed to load projects" />

// With retry
<ErrorState
  message="Failed to load projects"
  onRetry={() => refetch()}
/>

// Custom title
<ErrorState
  title="Connection lost"
  message="Please check your internet connection"
  onRetry={reconnect}
  retryLabel="Reconnect"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Something went wrong"` | Error heading |
| `message` | `string` | - | Error description |
| `onRetry` | `function` | - | Retry callback (shows button if provided) |
| `retryLabel` | `string` | `"Try again"` | Retry button text |
| `className` | `string` | - | Additional CSS classes |

---

## Creating New Components

When creating a new reusable UI component:

1. Place it in `frontend/src/components/ui/`
2. Use CSS variables from `tailwind.css` for tokens
3. Support size/variant props where appropriate
4. Include proper accessibility attributes (`aria-*`, `role`)
5. Document it in this file
