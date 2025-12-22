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

## Sidebar

**Location:** `frontend/src/components/sidebar/`

The conversation history sidebar with virtualized list, search, filtering, and mobile support.

### Sub-components

| Component | File | Purpose |
|-----------|------|---------|
| `ConversationItem` | `ConversationItem.jsx` | Individual conversation row with hover actions |
| `ConversationContextMenu` | `ConversationContextMenu.jsx` | Right-click context menu for conversation actions |
| `VirtualizedConversationList` | `VirtualizedConversationList.jsx` | Performance-optimized list using react-window |

### Features

- **Search & Filters:** Search conversations, filter by starred/archived, sort by date/title
- **Virtualization:** Uses react-window for performance with large conversation lists
- **Keyboard Navigation:** Arrow keys navigate, Enter selects, Escape clears search
- **Inline Actions:** Star, archive, rename, delete on hover (desktop)
- **Mobile Long-press:** 500ms long-press triggers context menu (industry standard)
- **Drag and Drop:** Drag conversations between department groups (desktop only)

### Mobile Behavior

On screens < 768px:
- Inline hover actions are hidden
- Long-press (500ms) opens context menu with all actions
- Haptic feedback via `navigator.vibrate()` on supported devices
- Touch scroll detection cancels long-press if user moves > 10px

### Context Menu Actions

| Action | Description |
|--------|-------------|
| Rename | Inline edit of conversation title |
| Star/Unstar | Toggle star status |
| Archive/Unarchive | Toggle archive status |
| Export | Download conversation as file |
| Delete | Remove with undo toast |

### Delete Behavior

Deletion uses optimistic UI with undo:
1. Conversation removed immediately from UI
2. Toast appears with "Undo" button (5s timeout)
3. If undone, conversation restored; otherwise deleted from backend

### Drag and Drop

Move conversations between department groups by dragging:
1. Hover over a conversation to reveal the drag handle (grip icon on left)
2. Drag the conversation - it tilts slightly (-2deg) and becomes semi-transparent for visual feedback
3. Drag over a different department group - target highlights with blue dashed outline
4. Drop to move - department updates optimistically with backend sync via `PATCH /api/conversations/{id}/department`
5. Group counts update immediately to reflect the change

**Visual Effects:**
- Dragging item: `rotate(-2deg) scale(1.02)`, 70% opacity, elevated shadow
- Drop target: Blue dashed outline with subtle background highlight

**Implementation:**
- Hook: `useDragAndDrop` in `frontend/src/hooks/useDragAndDrop.js`
- CSS: `.conversation-item.dragging` and `.conversation-group.drop-target` in `Sidebar.css`
- Backend: `PATCH /api/conversations/{id}/department` endpoint

**Note:** Drag and drop is disabled on mobile (< 768px). Use context menu instead.

---

## Skeleton Components

**File:** `frontend/src/components/ui/Skeleton.jsx`

Placeholder loading states that match content dimensions.

### Usage

```jsx
import { Skeleton } from '@/components/ui/Skeleton';

// Basic rectangle
<Skeleton className="h-4 w-[200px]" />

// Circle (avatar)
<Skeleton className="h-12 w-12 rounded-full" />

// Card placeholder
<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
</div>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Width, height, and shape classes |

### Styling

Uses CSS animation for shimmer effect. Inherits rounded corners from className.

---

## Toast Notifications

**File:** `frontend/src/components/ui/sonner.jsx`

Toast notifications using the sonner library with dark mode support.

### Usage

```jsx
import { toast } from '@/components/ui/sonner';

// Success
toast.success('Changes saved');

// Error
toast.error('Failed to save');

// With undo action
toast('Conversation deleted', {
  action: {
    label: 'Undo',
    onClick: () => restoreConversation(id),
  },
});

// Custom duration
toast.success('Copied!', { duration: 2000 });
```

### Configuration

The `<Toaster />` component is placed in App.jsx:
- Position: bottom-right
- Theme: auto-detects dark mode from document class
- Styling: Uses CSS variables for theme consistency

### Common Patterns

| Pattern | Use Case |
|---------|----------|
| `toast.success()` | Successful operations |
| `toast.error()` | Failed operations |
| `toast()` with action | Destructive actions with undo |

---

## Creating New Components

When creating a new reusable UI component:

1. Place it in `frontend/src/components/ui/`
2. Use CSS variables from `tailwind.css` for tokens
3. Support size/variant props where appropriate
4. Include proper accessibility attributes (`aria-*`, `role`)
5. Document it in this file
