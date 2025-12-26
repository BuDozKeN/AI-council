# ADR-001: Query Caching Strategy

## Status
Proposed

## Context

AxCouncil makes numerous API calls to fetch business data (companies, projects, departments, etc.). Currently, each navigation or page load triggers fresh API requests, even for data that rarely changes.

### Current State
- TanStack Query configured with 5-minute staleTime
- No persistent cache across page refreshes
- Backend TTL cache defined but unused
- Users see loading states on every navigation

### Problems
1. Unnecessary database load for stable data
2. Visible loading states degrade perceived performance
3. Returning users must wait for full data refetch
4. Network latency directly impacts every navigation

## Decision

Implement a multi-layer caching strategy:

### Layer 1: TanStack Query In-Memory Cache (Existing)
- Keep 5-minute staleTime for most queries
- Extend gcTime to 30 minutes
- Add query-specific configurations

### Layer 2: Persistent Browser Cache (New)
- Use `@tanstack/query-sync-storage-persister`
- Persist to localStorage
- 24-hour max age
- Exclude sensitive data (user, conversations)

### Layer 3: Backend TTL Cache (Activate)
- Activate existing `backend/utils/cache.py`
- Cache stable data: departments, team structure, playbooks
- 5-minute TTL for most data
- Invalidate on mutations

### Layer 4: Predictive Prefetching (New)
- Prefetch on hover (desktop) and focus (mobile)
- Prefetch likely next pages based on current location
- Use TanStack Query's `prefetchQuery`

## Consequences

### Positive
- Navigation feels instant for cached data (<100ms)
- Returning users see immediate content
- 40% fewer database queries
- Better user experience

### Negative
- Increased complexity in cache invalidation
- localStorage usage (~1-5MB)
- Potential for stale data display (mitigated by background revalidation)

### Neutral
- Need to monitor cache hit rates
- May need to tune TTL values based on usage patterns

## Implementation

### Phase 1: Backend Cache Activation
```python
# backend/routers/company.py
from backend.utils.cache import company_cache

@router.get("/company/{id}/team")
async def get_team(company_id: str, ...):
    cached = await company_cache.get(f"team:{company_id}")
    if cached:
        return cached
    result = await fetch_from_db(...)
    await company_cache.set(f"team:{company_id}", result, ttl=300)
    return result
```

### Phase 2: Persistent Cache
```typescript
// main.tsx
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'axcouncil-cache-v1',
});

persistQueryClient({ queryClient, persister, maxAge: 86400000 });
```

### Phase 3: Prefetching
```typescript
// hooks/usePrefetch.ts
export function usePrefetch() {
  const queryClient = useQueryClient();
  return {
    prefetchCompany: (id) => queryClient.prefetchQuery({
      queryKey: ['companies', id],
      queryFn: () => api.getCompany(id),
    }),
  };
}
```

## Metrics

### Success Criteria
- Cache hit rate > 80% for stable data
- Navigation time < 100ms for cached routes
- Zero loading states on cached navigations
- Return visit load time < 200ms

### Monitoring
- Track cache hit/miss in Sentry
- Monitor localStorage usage
- Alert on cache hit rate drops

## Related Documents
- [CACHING_STRATEGY.md](../CACHING_STRATEGY.md)
- [DATA_FETCHING_AUDIT.md](../DATA_FETCHING_AUDIT.md)
- [PATTERNS_LIBRARY.md](../PATTERNS_LIBRARY.md)

## References
- [TanStack Query Persistence](https://tanstack.com/query/latest/docs/react/plugins/persistQueryClient)
- [Stale-While-Revalidate](https://web.dev/stale-while-revalidate/)
