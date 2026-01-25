---
name: react-patterns
description: React hook patterns, useCallback bugs, state management, Vite troubleshooting
tags: [react, hooks, state, debugging]
---

# React Patterns

This skill contains React-specific patterns and common bugs for AxCouncil. Load when debugging React issues.

## useCallback Stale Closure Bug (CRITICAL)

**Symptom:** A React hook with `useCallback` + `useEffect` pattern causes multiple re-renders or stale state reads. Loading skeletons flash multiple times on initial page load.

**Root Cause:** When a function inside `useCallback` reads state variables, it captures their values at creation time. If the callback is in a `useEffect` dependency array and state changes cause the callback to be recreated, the old callback may still be running with stale values.

**Example - Bad Pattern:**
```tsx
// State that's read inside callback
const [dataLoaded, setDataLoaded] = useState(false);

// This captures dataLoaded's value at creation time!
const loadData = useCallback(async () => {
  if (dataLoaded) return; // BUG: May read stale value!
  setLoading(true);
  // ...fetch data...
  setDataLoaded(true);
}, [activeTab]); // dataLoaded NOT in deps to avoid re-trigger

useEffect(() => {
  loadData();
}, [loadData]); // Fires when loadData changes
```

**Solution - Use refs for values read inside callbacks:**
```tsx
// Ref always has current value (no stale closure)
const dataLoadedRef = useRef(false);
const [dataLoaded, setDataLoaded] = useState(false);

const loadData = useCallback(async () => {
  if (dataLoadedRef.current) return; // ✓ Always current!
  setLoading(true);
  // ...fetch data...
  dataLoadedRef.current = true;
  setDataLoaded(true); // Update state for UI reactivity
}, [activeTab]);
```

**Also add concurrent load guard:**
```tsx
const loadingInProgressRef = useRef<string | null>(null);

const loadData = useCallback(async () => {
  const loadKey = `${companyId}-${activeTab}`;
  if (loadingInProgressRef.current === loadKey) return; // Already loading
  loadingInProgressRef.current = loadKey;

  // ...do work...

  loadingInProgressRef.current = null; // Clear guard
}, [companyId, activeTab]);
```

**Key files implementing this pattern:**
- `useCompanyData.ts` - Uses `loadedRef` and `loadingInProgressRef` to prevent skeleton flash

## State Management Patterns

### TanStack Query for Server State

```tsx
// Use TanStack Query for server data
const { data, isLoading, error } = useQuery({
  queryKey: ['companies', userId],
  queryFn: () => fetchCompanies(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### React Context for UI State

```tsx
// Use Context for UI state (not server state)
const { isSettingsOpen, openSettings, closeSettings } = useUIContext();
```

**DON'T duplicate server state in local state:**
```tsx
// BAD: Duplicates TanStack Query data
const [companies, setCompanies] = useState([]);
useEffect(() => {
  setCompanies(queryData);
}, [queryData]);

// GOOD: Use query data directly
const companies = queryData ?? [];
```

## Component Patterns

### CVA (Class Variance Authority) for Variants

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2",
  {
    variants: {
      variant: { default: "btn-variant-default" },
      size: { default: "h-9 px-4" }
    }
  }
)
```

### Button Variants

Use consistent button variants:
- `variant="default"` - Primary actions (indigo/blue filled) - Edit, Save, Submit
- `variant="outline"` - Secondary actions (bordered) - Cancel, Back
- `variant="ghost"` - Tertiary/subtle actions - Close, minor toggles
- `variant="destructive"` - Dangerous actions - Delete, Remove

### Dark Mode

- Class-based switching via `next-themes`
- All components must support both modes
- Test with `.dark` class on root element

### Accessibility Requirements

- 44px minimum touch targets on mobile
- `focus-visible` states on all interactive elements
- Support `prefers-reduced-motion`
- Use `sr-only` for screen reader labels

## Vite HMR Troubleshooting

**Symptom:** A new React component doesn't appear even though:
- Code compiles without errors
- Component is correctly imported and rendered
- CSS is correct
- Build succeeds

**Root Cause:** Vite's Hot Module Replacement (HMR) can serve stale cached code, especially after:
- Adding new components
- Changing import paths
- Modifying CSS files
- Package lock changes

**Solution - In Order of Escalation:**

1. **Hard refresh browser:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Restart Vite dev server:**
   ```bash
   # Stop the running server (Ctrl+C) then:
   npm run dev
   ```

3. **Clear Vite cache and restart:**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

4. **Full clean rebuild:**
   ```bash
   rm -rf node_modules/.vite dist
   npm run build
   npm run dev
   ```

**Debugging Steps:**
1. Check browser DevTools Console for errors
2. Check Elements tab - search for the component's class/data-testid
3. If element exists in DOM but not visible → CSS issue (check z-index, position, overflow)
4. If element doesn't exist in DOM → Component not rendering (check imports, conditionals)
5. Add `console.log` at component start to verify it's being called

**Prevention:**
- After creating new components, do a hard refresh
- If component still missing after code changes, restart dev server
- Watch Vite terminal for "hmr update" messages to confirm changes are detected

## Event Handling Patterns

### stopPropagation Best Practices

**NEVER do this on parent containers:**
```tsx
// BAD - Interferes with child events
<div onClick={(e) => e.stopPropagation()}>
  <Button>I might not work!</Button>
</div>

// GOOD - Handle at the specific element level
<div>
  <Button onClick={(e) => { e.stopPropagation(); doThing(); }}>I work!</Button>
</div>
```

### Timestamp-based Event Detection

For complex event flows (like Radix dialogs + fixed elements):
```tsx
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  e.stopPropagation();
  (window as Window & { __myComponentClickTime?: number }).__myComponentClickTime = Date.now();
}, []);

// Check in handlers that might conflict
const clickTime = (window as Window & { __myComponentClickTime?: number }).__myComponentClickTime;
if (clickTime && Date.now() - clickTime < 500) {
  return; // Ignore - our component was just clicked
}
```

## Import Patterns

### Support Both Module and Direct Execution

```python
# Backend pattern
try:
    from .module import thing
except ImportError:
    from backend.module import thing
```

### Frontend Index Files

Export via `index.ts` in subdirectories:
```tsx
// components/ui/index.ts
export { Button } from './button';
export { Input } from './input';
export { Modal } from './modal';
```

## Error Handling

### Backend - Secure Errors

```python
from security import create_secure_error

# Use secure error factory (sanitizes messages)
raise create_secure_error(404, "Resource not found", log_details={"id": item_id})
```

### Frontend - Error Boundaries

Wrap major sections in error boundaries to prevent full app crashes.

### API Errors

Use TanStack Query's error handling:
```tsx
const { error } = useQuery({...});

if (error) {
  return <ErrorMessage error={error} />;
}
```
