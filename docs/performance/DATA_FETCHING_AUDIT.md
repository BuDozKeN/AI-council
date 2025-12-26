# Data Fetching Audit

## Pattern Distribution

| Pattern | Count | Files | Assessment |
|---------|-------|-------|------------|
| useQuery (TanStack) | 15+ | hooks/queries/*.ts, contexts/*.tsx | ✅ Target pattern |
| useMutation (TanStack) | 8+ | contexts/ConversationContext.tsx | ✅ Good |
| Direct fetch in api.ts | 30+ | api.ts | ✅ Centralized |
| SSE Streaming | 2 | api.ts, useMessageStreaming.ts | ✅ Good |
| useEffect + fetch | 2 | Legacy components | ⚠️ Migrate |

---

## TanStack Query Configuration

### QueryClient Setup

```typescript
// main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Assessment

| Setting | Value | Assessment |
|---------|-------|------------|
| staleTime | 5 minutes | ✅ Good for business data |
| cacheTime | 5 minutes (default) | ⚠️ Could extend to 30min |
| retry | 1 | ✅ Reasonable |
| refetchOnWindowFocus | false | ✅ Prevents unnecessary refetches |
| refetchOnReconnect | true (default) | ✅ Good |

---

## Query Key Factory Pattern ✅

```typescript
// hooks/queries/useConversations.ts
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
};

// hooks/queries/useCompany.ts
export const businessKeys = {
  all: ['businesses'] as const,
  list: () => [...businessKeys.all, 'list'] as const,
  detail: (id: string) => [...businessKeys.all, 'detail', id] as const,
  projects: (companyId: string) => [...businessKeys.all, companyId, 'projects'] as const,
  playbooks: (companyId: string) => [...businessKeys.all, companyId, 'playbooks'] as const,
};
```

**Assessment:** ✅ Excellent pattern - enables precise cache invalidation

---

## Data Fetching Examples

### Good Pattern: useQuery with staleTime

```typescript
// BusinessContext.tsx
const {
  data: businesses = [],
  isLoading: isLoadingBusinesses,
  error: businessesError,
} = useQuery({
  queryKey: businessKeys.list(),
  queryFn: () => api.listBusinesses(),
  enabled: isAuthenticated,
  staleTime: 1000 * 60 * 5, // 5 minutes
});
```

### Good Pattern: Optimistic Updates

```typescript
// ConversationContext.tsx
const starMutation = useMutation({
  mutationFn: ({ id, starred }) => api.starConversation(id, starred),
  onMutate: async ({ id, starred }) => {
    await queryClient.cancelQueries({ queryKey: conversationKeys.lists() });
    const previousConversations = conversations;
    // Optimistic update
    setConversations(prev =>
      prev.map(conv => conv.id === id ? { ...conv, is_starred: starred } : conv)
    );
    return { previousConversations };
  },
  onError: (err, _, context) => {
    // Rollback on error
    if (context?.previousConversations) {
      setConversations(context.previousConversations);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
  },
});
```

---

## Missing: Prefetching

### Current State
No prefetching implemented. Data fetched only on navigation.

### Recommended Implementation

```typescript
// hooks/usePrefetch.ts
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { businessKeys } from './queries/useCompany';
import { conversationKeys } from './queries/useConversations';

export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchCompany = (companyId: string) => {
    queryClient.prefetchQuery({
      queryKey: businessKeys.detail(companyId),
      queryFn: () => api.getCompany(companyId),
      staleTime: 1000 * 60 * 5,
    });
  };

  const prefetchProjects = (companyId: string) => {
    queryClient.prefetchQuery({
      queryKey: businessKeys.projects(companyId),
      queryFn: () => api.listProjects(companyId),
      staleTime: 1000 * 60 * 5,
    });
  };

  const prefetchConversation = (conversationId: string) => {
    queryClient.prefetchQuery({
      queryKey: conversationKeys.detail(conversationId),
      queryFn: () => api.getConversation(conversationId),
      staleTime: 1000 * 60 * 5,
    });
  };

  return {
    prefetchCompany,
    prefetchProjects,
    prefetchConversation,
  };
}
```

### Integration with Navigation

```typescript
// components/Navigation/NavLink.tsx
import { usePrefetch } from '../../hooks/usePrefetch';

export function NavLink({ to, companyId, children }) {
  const { prefetchCompany, prefetchProjects } = usePrefetch();

  const handleMouseEnter = () => {
    if (to.includes('/company')) {
      prefetchCompany(companyId);
    } else if (to.includes('/projects')) {
      prefetchProjects(companyId);
    }
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

**Impact:** Navigation would feel instant (<100ms) instead of showing loading states

---

## Missing: Persistent Cache

### Current State
Memory-only cache, lost on page refresh.

### Recommended Implementation

```typescript
// main.tsx
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'axcouncil-query-cache',
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

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // Only persist stable data
      return query.queryKey[0] !== 'conversations'; // Don't persist chat messages
    },
  },
});
```

**Impact:** Returning users see instant page loads with stale data, then background refresh

---

## API Layer Analysis

### Centralized API (`api.ts`)

**Strengths:**
- All API calls in one place
- Token injection handled centrally
- Typed responses
- Error handling standardized

**Structure:**
```typescript
const api = {
  // Auth
  getAuthToken: () => tokenGetter?.(),

  // Companies
  listBusinesses: () => apiFetch('/companies'),
  getCompany: (id) => apiFetch(`/company/${id}`),

  // Projects
  listProjects: (companyId) => apiFetch(`/company/${companyId}/projects`),

  // Conversations
  listConversations: (options) => apiFetch('/conversations', { params: options }),
  getConversation: (id) => apiFetch(`/conversations/${id}`),

  // Streaming
  sendMessageStream: (id, message, options) => streamingFetch(/*...*/),
};
```

---

## Waterfall/Sequential Fetching Issues

### Issue: Business Context Initial Load

```typescript
// Current: Sequential due to dependencies
1. Load user auth → getSession()
2. Load businesses → api.listBusinesses()
3. Load user preferences → userPreferencesApi.get()
4. Apply selected business
5. Load projects → api.listProjects(selectedBusiness)
6. Load playbooks → api.getCompanyPlaybooks(selectedBusiness)
```

**Problem:** Steps 5-6 wait for step 4, adding latency

### Recommendation: Parallel + Default

```typescript
// Recommended: Load in parallel with defaults
Promise.all([
  api.listBusinesses(),
  userPreferencesApi.get(),
]).then(([businesses, prefs]) => {
  const selectedId = prefs?.last_company_id || businesses[0]?.id;
  // Immediately prefetch projects/playbooks for likely company
  if (selectedId) {
    queryClient.prefetchQuery({ queryKey: businessKeys.projects(selectedId), ... });
    queryClient.prefetchQuery({ queryKey: businessKeys.playbooks(selectedId), ... });
  }
});
```

---

## Error Handling

### Current Pattern (Good)

```typescript
// ConversationContext.tsx
useEffect(() => {
  if (conversationError) {
    log.error('Failed to load conversation:', conversationError);
    setCurrentConversationId(null);
    toast.error("We couldn't load that conversation. Please try again.");
  }
}, [conversationError]);
```

### Retry Configuration

```typescript
// Query-specific retry
const { data } = useQuery({
  queryKey: ['critical-data'],
  queryFn: fetchCriticalData,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

## Streaming Fetch Analysis

### Current Implementation

```typescript
// api.ts - sendMessageStream
async function sendMessageStream(conversationId, message, options) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: options.signal, // AbortController support
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes('\n\n')) {
      const eventEnd = buffer.indexOf('\n\n');
      const eventText = buffer.slice(0, eventEnd);
      buffer = buffer.slice(eventEnd + 2);
      // Parse SSE event
    }
  }
}
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| AbortController | ✅ | Cancellation supported |
| SSE Parsing | ✅ | Correct double-newline handling |
| Token Batching | ✅ | Via useMessageStreaming RAF |
| Error Recovery | ⚠️ | Could add reconnection |
| Buffer Growth | ⚠️ | String concat is O(n²) |

---

## Recommendations Summary

| Priority | Recommendation | Effort | Impact |
|----------|----------------|--------|--------|
| HIGH | Add prefetch on hover | 6h | Instant navigation feel |
| HIGH | Add persistent cache | 3h | Instant returning user loads |
| MEDIUM | Parallel initial load | 2h | Faster first paint |
| MEDIUM | Extend cacheTime to 30min | 1h | Fewer refetches |
| LOW | Streaming buffer optimization | 4h | Memory efficiency |

---

## Implementation Priority

### Week 1
1. ✅ Install `@tanstack/query-sync-storage-persister`
2. ✅ Configure persistent cache
3. ✅ Create `usePrefetch` hook
4. ✅ Add prefetch to navigation links

### Week 2
1. Parallel initial data loading
2. Streaming buffer refactor
3. Add retry with backoff for critical queries
