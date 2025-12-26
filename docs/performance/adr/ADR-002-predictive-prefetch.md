# ADR-002: Predictive Prefetching

## Status
Proposed

## Context

Users experience visible loading states when navigating between pages. Even with good API response times (~200ms), the round-trip latency is noticeable and makes the application feel slower than native alternatives.

### Current State
- Data fetching begins when component mounts
- Users see loading skeletons during fetch
- No prediction of user intent
- TanStack Query's prefetch capability unused

### User Experience Issue
```
Click → Router transition → Component mount → Data fetch → Loading state → Content
                                                   └── 200-400ms visible ──┘
```

### Opportunity
User intent can often be predicted:
- Hover on navigation item = likely click
- Focus on link = likely click
- Current page predicts next page (Dashboard → Company is common)

## Decision

Implement predictive prefetching based on user intent signals:

### Primary Strategy: Hover/Focus Prefetch
Prefetch data when user hovers over or focuses on a navigation link.

```typescript
<NavLink
  to="/company"
  onMouseEnter={() => prefetchCompany(companyId)}
  onFocus={() => prefetchCompany(companyId)}
>
  Company
</NavLink>
```

### Secondary Strategy: Route-Based Prefetch
Prefetch likely next routes based on current location.

| Current Route | Prefetch |
|---------------|----------|
| /dashboard | First company data |
| /company/{id} | Projects list |
| /projects | First project details |

### Technical Implementation

Create `usePrefetch` hook:
```typescript
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchCompany = useCallback((companyId: string) => {
    // Don't refetch if already cached and fresh
    const existing = queryClient.getQueryData(['companies', companyId]);
    if (existing) return;

    queryClient.prefetchQuery({
      queryKey: ['companies', companyId],
      queryFn: () => api.getCompany(companyId),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  return { prefetchCompany, prefetchProjects, ... };
}
```

### Route Preloading
Preload route code bundles alongside data:

```typescript
const preloadCompany = () => import('./pages/Company');

<NavLink
  to="/company"
  onMouseEnter={() => {
    preloadCompany(); // Load code
    prefetchCompany(companyId); // Load data
  }}
>
```

## Consequences

### Positive
- Navigation feels instant (<50ms with cached data)
- Loading states eliminated for predicted navigations
- Better perceived performance
- No wasted requests (prefetch is conditional)

### Negative
- Some prefetches may not be used (wasted bandwidth)
- Increased API calls (mitigated by caching)
- More complex navigation components

### Neutral
- Must handle race conditions (prefetch in progress when clicking)
- Mobile needs different triggers (no hover)

## Implementation Details

### Desktop (Hover)
- 50ms debounce on hover (prevent accidental triggers)
- Prefetch on `mouseenter`
- Cancel on `mouseleave` (if still pending)

### Mobile (Touch)
- Prefetch on `touchstart` for quick taps
- Prefetch on navigation item focus
- Consider predictive prefetch based on scroll position

### Prefetch Budget
Limit concurrent prefetches:
```typescript
const MAX_CONCURRENT_PREFETCHES = 2;
const prefetchQueue = [];
```

## Metrics

### Success Criteria
- 80% of navigations use cached data
- Average navigation time < 100ms (cached)
- Zero loading states for common paths

### Monitoring
- Track prefetch hit rate (prefetch → click)
- Track wasted prefetches (prefetch → no click)
- Monitor API call volume increase

## Alternatives Considered

### Service Worker Prefetch
- Pro: Works offline
- Con: More complex, less granular control
- Decision: Use TanStack Query for now, add SW later

### Speculative Loading
- Pro: Preload everything
- Con: Wasteful, high bandwidth
- Decision: Only prefetch on intent signals

### Link Prefetch HTML
- Pro: Browser-native
- Con: Less control, no data prefetch
- Decision: Use JavaScript for unified approach

## Related Documents
- [ADR-001-query-caching.md](./ADR-001-query-caching.md)
- [NETWORK_WATERFALL.md](../NETWORK_WATERFALL.md)
- [PATTERNS_LIBRARY.md](../PATTERNS_LIBRARY.md)

## References
- [Quicklink by Google](https://github.com/GoogleChromeLabs/quicklink)
- [Guess.js](https://guess-js.github.io/)
- [TanStack Query Prefetching](https://tanstack.com/query/latest/docs/react/guides/prefetching)
