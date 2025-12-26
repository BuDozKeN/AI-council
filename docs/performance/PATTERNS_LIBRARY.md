# Performance Patterns Library

A collection of reusable performance patterns for AxCouncil and similar React/FastAPI applications.

---

## Pattern 1: Predictive Prefetching

### When to Use
Any navigation where destination can be predicted from hover intent.

### Implementation

```typescript
// hooks/usePrefetch.ts
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../api';

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchCompany = useCallback((companyId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['businesses', 'detail', companyId],
      queryFn: () => api.getCompany(companyId),
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchProjects = useCallback((companyId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['businesses', companyId, 'projects'],
      queryFn: () => api.listProjects(companyId),
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  return { prefetchCompany, prefetchProjects };
}

// Usage in navigation
function NavLink({ to, companyId, children }) {
  const { prefetchCompany } = usePrefetch();

  return (
    <Link
      to={to}
      onMouseEnter={() => prefetchCompany(companyId)}
      onFocus={() => prefetchCompany(companyId)}
    >
      {children}
    </Link>
  );
}
```

### Metrics Impact
- Navigation time: 300ms → 50ms (83% improvement)
- Loading states: Eliminated on cached routes

---

## Pattern 2: Persistent Query Cache

### When to Use
Applications where users return frequently and data is relatively stable.

### Implementation

```typescript
// main.tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'app-cache-v1',
  throttleTime: 1000,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours for persistence
    },
  },
});

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Don't persist sensitive data
            const key = query.queryKey[0];
            return !['user', 'auth', 'conversations'].includes(key as string);
          },
        },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  );
}
```

### Metrics Impact
- Returning user load time: 2s → 100ms (95% improvement)
- Database queries: Reduced by cached data ratio

---

## Pattern 3: Optimistic UI Updates

### When to Use
Mutations where the outcome is predictable and user expects instant feedback.

### Implementation

```typescript
// mutations/useStarItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useStarItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.starItem(id, starred),

    onMutate: async ({ id, starred }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['items'] });

      // Snapshot current state
      const previousItems = queryClient.getQueryData(['items']);

      // Optimistically update
      queryClient.setQueryData(['items'], (old: Item[]) =>
        old.map(item =>
          item.id === id ? { ...item, starred } : item
        )
      );

      return { previousItems };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousItems) {
        queryClient.setQueryData(['items'], context.previousItems);
      }
      toast.error('Failed to update');
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

### Metrics Impact
- Perceived action time: 500ms → 0ms (instant)
- User confidence: Increased through immediate feedback

---

## Pattern 4: Stale-While-Revalidate

### When to Use
Displaying cached data immediately while fetching fresh data in background.

### Implementation

```typescript
// Already configured in TanStack Query via staleTime
const { data } = useQuery({
  queryKey: ['items'],
  queryFn: fetchItems,
  staleTime: 1000 * 60 * 5,  // Show cached for 5 min
  // After 5 min, show stale data while refetching
});

// For more control
const { data, isFetching, isStale } = useQuery({
  queryKey: ['items'],
  queryFn: fetchItems,
  staleTime: 1000 * 60 * 5,
});

// Show subtle indicator during background refresh
{isStale && isFetching && <RefreshIndicator />}
```

### Metrics Impact
- Time to content: staleTime → 0ms (cached)
- User sees: Immediate data, updates arrive seamlessly

---

## Pattern 5: Route Preloading

### When to Use
Code-split routes that should load before user navigates.

### Implementation

```typescript
// routes.tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Company = lazy(() => import('./pages/Company'));

// Preload functions
const preloadDashboard = () => import('./pages/Dashboard');
const preloadCompany = () => import('./pages/Company');

// Router with preload
const router = createBrowserRouter([
  {
    path: '/dashboard',
    element: <Dashboard />,
    loader: async () => {
      // Preload likely next routes
      preloadCompany();
      return null;
    },
  },
]);

// Or in navigation
function Nav() {
  return (
    <Link
      to="/company"
      onMouseEnter={preloadCompany}
    >
      Company
    </Link>
  );
}
```

### Metrics Impact
- Route load time: 200ms → 0ms (preloaded)
- Bundle still split: Initial load stays fast

---

## Pattern 6: Request Batching

### When to Use
Multiple related queries that can be combined.

### Implementation

```python
# Backend - Batch endpoint
@router.post("/batch")
async def batch_queries(
    queries: List[BatchQuery],
    user: dict = Depends(get_current_user)
):
    db = get_supabase_with_auth(user['access_token'])
    results = {}

    for query in queries:
        if query.type == "departments":
            results["departments"] = await get_departments(db, query.company_id)
        elif query.type == "roles":
            results["roles"] = await get_roles(db, query.company_id)
        # ... more types

    return results
```

```typescript
// Frontend - Batch hook
function useBatchQuery(companyId: string) {
  return useQuery({
    queryKey: ['batch', companyId],
    queryFn: () => api.batchQuery([
      { type: 'departments', companyId },
      { type: 'roles', companyId },
      { type: 'playbooks', companyId },
    ]),
    select: (data) => ({
      departments: data.departments,
      roles: data.roles,
      playbooks: data.playbooks,
    }),
  });
}
```

### Metrics Impact
- Network requests: 4 → 1 (75% reduction)
- Total latency: Sum of all → Max of all

---

## Pattern 7: Skeleton-to-Content Transitions

### When to Use
First-load scenarios where no cached data exists.

### Implementation

```typescript
// components/ItemSkeleton.tsx
function ItemSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
    </div>
  );
}

// components/ItemList.tsx
function ItemList() {
  const { data, isLoading } = useQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
  });

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 5 }).map((_, i) => (
          <ItemSkeleton key={i} />
        ))}
      </>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        {data.map(item => <Item key={item.id} {...item} />)}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Metrics Impact
- CLS: Prevented by skeleton matching content size
- Perceived speed: Immediate visual feedback

---

## Pattern 8: Token Batching for Streaming

### When to Use
SSE/WebSocket streams with high-frequency updates.

### Implementation

```typescript
// hooks/useStreamBatching.ts
function useStreamBatching(onBatch: (tokens: string) => void) {
  const bufferRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length > 0) {
      onBatch(bufferRef.current.join(''));
      bufferRef.current = [];
    }
    rafRef.current = null;
  }, [onBatch]);

  const addToken = useCallback((token: string) => {
    bufferRef.current.push(token);

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return addToken;
}
```

### Metrics Impact
- React renders: Per-token → ~60/sec
- Frame drops: Eliminated via RAF sync

---

## Pattern 9: Backend TTL Cache

### When to Use
Stable data that's expensive to compute but rarely changes.

### Implementation

```python
# utils/cache.py
import asyncio
from typing import Any, Callable, Optional
from datetime import datetime, timedelta

class TTLCache:
    def __init__(self, default_ttl: int = 60):
        self.cache: dict[str, tuple[Any, datetime]] = {}
        self.default_ttl = default_ttl
        self.lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self.lock:
            if key in self.cache:
                value, expires = self.cache[key]
                if datetime.now() < expires:
                    return value
                del self.cache[key]
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        async with self.lock:
            expires = datetime.now() + timedelta(seconds=ttl or self.default_ttl)
            self.cache[key] = (value, expires)

    async def delete(self, key: str):
        async with self.lock:
            self.cache.pop(key, None)

# Usage
cache = TTLCache(default_ttl=300)

async def get_departments(company_id: str):
    cache_key = f"departments:{company_id}"

    cached = await cache.get(cache_key)
    if cached:
        return cached

    result = await fetch_from_db(company_id)
    await cache.set(cache_key, result)
    return result
```

### Metrics Impact
- DB queries: Reduced by cache hit rate
- Response time: 100ms → 5ms (cached)

---

## Pattern 10: Parallel Data Loading

### When to Use
Multiple independent data fetches on page load.

### Implementation

```typescript
// Frontend
function Dashboard() {
  // Run in parallel via React Query
  const companies = useQuery({ queryKey: ['companies'], ... });
  const projects = useQuery({ queryKey: ['projects'], ... });
  const stats = useQuery({ queryKey: ['stats'], ... });

  // All three fetch simultaneously
}

// Or with Promise.all for dependent logic
async function loadDashboardData() {
  const [companies, projects, stats] = await Promise.all([
    api.getCompanies(),
    api.getProjects(),
    api.getStats(),
  ]);
  return { companies, projects, stats };
}
```

```python
# Backend
async def get_overview(company_id: str):
    # Parallel instead of sequential
    dept_count, role_count, doc_count = await asyncio.gather(
        count_departments(company_id),
        count_roles(company_id),
        count_documents(company_id),
    )
    return {
        "departments": dept_count,
        "roles": role_count,
        "documents": doc_count,
    }
```

### Metrics Impact
- Load time: Sum → Max (parallel)
- Example: 100ms + 100ms + 100ms → 100ms

---

## Quick Reference

| Pattern | Use Case | Impact |
|---------|----------|--------|
| Predictive Prefetch | Navigation | 80%+ faster nav |
| Persistent Cache | Returning users | 95% faster return |
| Optimistic Updates | Mutations | Instant feedback |
| Stale-While-Revalidate | Data freshness | Show data immediately |
| Route Preloading | Code-split routes | 0ms route load |
| Request Batching | Multiple queries | 75% fewer requests |
| Skeleton Transitions | First load | No CLS, perceived speed |
| Token Batching | Streaming | 60fps updates |
| TTL Cache (Backend) | Stable data | 95% cache hit |
| Parallel Loading | Independent data | Parallel vs sequential |
