# Rendering Performance Analysis

## React Rendering Audit

### Component Architecture

| Pattern | Usage | Assessment |
|---------|-------|------------|
| Functional components | 100% | ✅ Modern |
| React.memo | Limited | ⚠️ Opportunity |
| useMemo | Good | ✅ Appropriate |
| useCallback | Good | ✅ Appropriate |
| Context optimization | Partial | ⚠️ Large contexts |

---

## Context Performance Analysis

### Current Contexts

| Context | Consumers | State Size | Update Frequency |
|---------|-----------|------------|------------------|
| AuthContext | ~50+ | Small | Rare |
| BusinessContext | ~30+ | Large | On navigation |
| ConversationContext | ~20+ | Large | On chat actions |
| ThemeContext | ~100+ | Small | Rare |

### BusinessContext Deep Dive

```typescript
// BusinessContext.tsx - 456 lines
const value = useMemo(() => ({
  // 30+ values
  businesses,
  selectedBusiness,
  currentBusiness,
  selectedDepartment,
  selectedRole,
  // ... many more
  loadBusinesses,
  refreshProjects,
  refreshPlaybooks,
}), [
  // 25+ dependencies
  businesses,
  selectedBusiness,
  // ...
]);
```

**Issues:**
1. Large object means frequent re-creation
2. Many dependencies increase change likelihood
3. All consumers re-render on any change

**Recommendation:**
```typescript
// Split into focused contexts
const BusinessStateContext = createContext({});  // Read-only state
const BusinessActionsContext = createContext({}); // Stable actions

// Or use context selectors
import { useContextSelector } from 'use-context-selector';

const selectedBusiness = useContextSelector(
  BusinessContext,
  ctx => ctx.selectedBusiness
);
```

---

## Memoization Audit

### Good: useMemo Usage

```typescript
// BusinessContext.tsx
const availableDepartments = useMemo(() => {
  if (!currentBusiness?.departments?.length) {
    return DEFAULT_DEPARTMENTS;
  }
  return currentBusiness.departments;
}, [currentBusiness]);

const allRoles = useMemo(() => {
  if (!availableDepartments) return [];
  // Expensive computation...
}, [availableDepartments]);
```

### Good: useCallback for Actions

```typescript
// ConversationContext.tsx
const handleSelectConversation = useCallback((id: string) => {
  setCurrentConversation(null);
  setCurrentConversationId(id);
}, []);
```

### Missing: React.memo on List Items

```typescript
// CURRENT: Re-renders on any list change
function ConversationItem({ conversation, onSelect }) {
  return <div onClick={() => onSelect(conversation.id)}>...</div>;
}

// RECOMMENDED: Skip re-render if props unchanged
const ConversationItem = memo(function ConversationItem({
  conversation,
  onSelect
}) {
  return <div onClick={() => onSelect(conversation.id)}>...</div>;
}, (prev, next) => prev.conversation.id === next.conversation.id);
```

---

## Re-render Analysis

### High-Frequency Re-render Candidates

| Component | Trigger | Cause | Fix Priority |
|-----------|---------|-------|--------------|
| Sidebar items | Any context change | Context subscription | Medium |
| Header | Auth/business change | Multiple contexts | Low |
| Message list | New tokens | Expected (streaming) | N/A |
| Navigation | Business selection | Context change | Low |

### Profiling Approach

```typescript
// Add to development only
import { Profiler } from 'react';

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) {
  if (actualDuration > 16) { // > 1 frame
    console.warn(`Slow render: ${id} took ${actualDuration}ms`);
  }
}

<Profiler id="Sidebar" onRender={onRenderCallback}>
  <Sidebar />
</Profiler>
```

---

## Virtual DOM Efficiency

### List Rendering

| List | Max Items | Virtualized | Recommendation |
|------|-----------|-------------|----------------|
| Conversations | 100+ | No | Virtualize if >100 |
| Projects | 50+ | No | OK as-is |
| Decisions | 100+ | No | Virtualize if >100 |
| Messages | Unlimited | No | Virtualize for history |

### Virtualization Implementation

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function ConversationList({ conversations }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Item height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative"
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ConversationItem
              conversation={conversations[virtualItem.index]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Loading State Patterns

### Current Pattern

```typescript
// Good: Skeleton usage
{isLoading ? <ProjectSkeleton /> : <ProjectCard project={project} />}

// Good: Suspense boundaries
<Suspense fallback={<PageSkeleton />}>
  <LazyPage />
</Suspense>
```

### Optimization: Eliminate with Cache

```typescript
// With prefetch + cache, loading states rarely shown
const { data, isLoading, isFetching } = useQuery({
  queryKey: ['projects', companyId],
  queryFn: () => api.getProjects(companyId),
  staleTime: 5 * 60 * 1000,
});

// Show cached data immediately
// Optional: subtle indicator during background refresh
return (
  <>
    {isFetching && !isLoading && <RefreshIndicator />}
    <ProjectList projects={data} />
  </>
);
```

---

## Inline Props Analysis

### Issue: Inline Objects

```typescript
// BAD: New object every render
<Component style={{ margin: 10 }} />
<Component data={{ id: item.id, name: item.name }} />

// GOOD: Stable references
const style = useMemo(() => ({ margin: 10 }), []);
<Component style={style} />
```

### Issue: Inline Functions

```typescript
// BAD: New function every render
<Button onClick={() => handleClick(id)} />

// GOOD: Stable callback
const handleButtonClick = useCallback(() => handleClick(id), [id, handleClick]);
<Button onClick={handleButtonClick} />

// OR: Use data attributes
<Button data-id={id} onClick={handleClick} />
```

---

## Error Boundaries

### Current Implementation

```typescript
// Good: Sentry integration
import * as Sentry from '@sentry/react';

const SentryErrorBoundary = Sentry.ErrorBoundary;

<SentryErrorBoundary
  fallback={<ErrorFallback />}
  onError={(error, componentStack) => {
    console.error('Caught error:', error, componentStack);
  }}
>
  <App />
</SentryErrorBoundary>
```

### Recommendation: Granular Boundaries

```typescript
// Add boundaries around critical sections
<ErrorBoundary fallback={<ChatError />}>
  <ConversationView />
</ErrorBoundary>

<ErrorBoundary fallback={<SidebarError />}>
  <Sidebar />
</ErrorBoundary>
```

---

## Recommendations Summary

| Optimization | Effort | Impact | Priority |
|--------------|--------|--------|----------|
| Add React.memo to list items | 2h | Medium | Medium |
| Split large contexts | 8h | Medium | Low |
| Add virtualization (if needed) | 4h | High (large lists) | Low |
| Eliminate inline objects | 2h | Low | Low |
| Add granular error boundaries | 2h | Low (reliability) | Low |

---

## Performance Profiling Tools

### React DevTools Profiler

1. Install React DevTools browser extension
2. Open DevTools → Profiler tab
3. Click record, perform actions, stop
4. Analyze flame graph for slow components

### Why Did You Render

```typescript
// Development only
import whyDidYouRender from '@welldone-software/why-did-you-render';

if (process.env.NODE_ENV === 'development') {
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}

// Tag components to track
ConversationItem.whyDidYouRender = true;
```

---

## Summary

### Current State: Good

The rendering architecture follows React best practices with:
- Functional components throughout
- Appropriate useMemo/useCallback usage
- Suspense boundaries for code splitting
- Error boundaries with Sentry

### Opportunities

1. **Context splitting** - Reduce scope of re-renders
2. **List item memoization** - Prevent unnecessary item re-renders
3. **Virtualization** - For large lists (if they become an issue)

### Not Urgent

The current rendering performance is adequate. These optimizations become more important at scale (many items, complex UIs, slower devices).
