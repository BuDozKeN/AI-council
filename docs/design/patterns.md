# UI Patterns

Common UI patterns and how to implement them consistently.

## Loading States

**Status: Partially standardized**

Use the `<Spinner />` component for all loading indicators.

### Current Pattern

```jsx
import { Spinner } from '@/components/ui/Spinner';

function MyComponent() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return <div>Content</div>;
}
```

### Planned: LoadingState Component

Once implemented, use:

```jsx
import { LoadingState } from '@/components/ui/LoadingState';

if (loading) {
  return <LoadingState message="Loading projects..." />;
}
```

### Don't Do This

```jsx
// Wrong - custom loading implementation
if (loading) {
  return <div className="loading-spinner">Loading...</div>;
}

// Wrong - inline spinner without Spinner component
if (loading) {
  return <div className="animate-spin">...</div>;
}
```

---

## Error States

**Status: Not standardized**

Currently each component implements its own error UI. Work towards consolidation.

### Current Pattern (varies by component)

```jsx
if (error) {
  return (
    <div className="text-red-500 p-4">
      Error: {error.message}
      <button onClick={retry}>Retry</button>
    </div>
  );
}
```

### Planned: ErrorState Component

```jsx
import { ErrorState } from '@/components/ui/ErrorState';

if (error) {
  return (
    <ErrorState
      message={error.message}
      onRetry={() => refetch()}
    />
  );
}
```

---

## Empty States

**Status: Not standardized**

Shown when a list or container has no items.

### Current Pattern (varies)

```jsx
if (items.length === 0) {
  return (
    <div className="text-center text-gray-500 p-8">
      No items found
    </div>
  );
}
```

### Planned: EmptyState Component

```jsx
import { EmptyState } from '@/components/ui/EmptyState';

if (items.length === 0) {
  return (
    <EmptyState
      icon={InboxIcon}
      title="No projects"
      message="Create your first project to get started"
      action={
        <Button onClick={() => setShowCreate(true)}>
          Create Project
        </Button>
      }
    />
  );
}
```

---

## Modal Patterns

### Z-Index Handling

Modals use `var(--z-modal)`. Dropdowns inside modals use `var(--z-modal-dropdown)`.

```css
.my-modal-overlay {
  z-index: var(--z-modal);
}

/* If you have a Select inside the modal */
.my-modal .select-dropdown {
  z-index: var(--z-modal-dropdown);
}
```

### Nested Modals

When a modal opens another modal (e.g., confirmation dialog):

- Parent modal: `var(--z-modal)`
- Child modal: `var(--z-modal-dropdown)`

This ensures the child appears above the parent.

---

## Form Patterns

### Input Focus States

Use consistent focus ring:

```css
.input:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
}
```

### Validation Errors

```css
.input.error {
  border-color: #ef4444;
}

.input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
```

---

## Animation Patterns

### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.15s ease-out;
}
```

### Slide In (for dropdowns)

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Duration Guidelines

| Animation Type | Duration |
|----------------|----------|
| Micro-interactions (hover, focus) | 0.1-0.15s |
| Dropdowns, tooltips | 0.15s |
| Modals, panels | 0.2s |
| Page transitions | 0.3s |

---

## Anti-Patterns (Don't Do)

### Z-Index Arms Race

```css
/* Wrong */
z-index: 9999 !important;

/* Right */
z-index: var(--z-modal-dropdown);
```

### Hardcoded Colors in CSS

```css
/* Wrong */
color: #6366f1;

/* Right - use existing variable or add a new token */
color: var(--primary);
```

### Component-Specific Loading Styles

```css
/* Wrong - don't create custom loading classes */
.my-component-loading { ... }
.other-component-loading { ... }

/* Right - use the Spinner component */
```
