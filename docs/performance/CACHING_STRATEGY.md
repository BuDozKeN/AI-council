# Caching Strategy

## Current Cache Layers

| Layer | Implemented | Configuration | Effectiveness |
|-------|-------------|---------------|---------------|
| Browser HTTP Cache | ✅ Yes | Vercel defaults | ~80% for assets |
| CDN Cache (Vercel) | ✅ Yes | Edge caching | High |
| Service Worker (PWA) | ✅ Yes | Workbox configured | Good for assets |
| TanStack Query Cache | ✅ Yes | 5min staleTime | Good for API |
| Persistent Cache | ❌ No | Not configured | 0% |
| Backend TTL Cache | ❌ No | Defined but unused | 0% |

---

## Frontend Caching

### TanStack Query Configuration

```typescript
// Current configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 5,       // 5 minutes (was cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query-Specific Cache Configuration

| Query Key | staleTime | gcTime | Prefetch | Persist | Rationale |
|-----------|-----------|--------|----------|---------|-----------|
| `['businesses']` | 5min | 5min | On auth | Yes | Rarely changes |
| `['businesses', id, 'projects']` | 5min | 5min | On hover | Yes | Moderate changes |
| `['businesses', id, 'playbooks']` | 5min | 5min | On hover | Yes | Rarely changes |
| `['conversations']` | 5min | 5min | No | No | Frequent changes |
| `['conversations', id]` | 5min | 5min | On click | No | Contains messages |

### Recommended Configuration

```typescript
// Enhanced configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      gcTime: 1000 * 60 * 30,      // 30 minutes - keep in cache longer
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
```

---

## PWA/Service Worker Caching

### Current Workbox Configuration

```javascript
// vite.config.js
VitePWA({
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          networkTimeoutSeconds: 10,
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
})
```

### Assessment

| Cache | Strategy | TTL | Status |
|-------|----------|-----|--------|
| Static assets | CacheFirst | 30 days | ✅ Good |
| Images | CacheFirst | 30 days | ✅ Good |
| Supabase API | NetworkFirst | 10s timeout | ✅ Good |
| Fonts | CacheFirst | Implicit | ✅ Good |

---

## Backend Cache Layer (UNUSED!)

### Current Implementation

```python
# backend/utils/cache.py
class TTLCache:
    def __init__(self, default_ttl: int = 60, max_size: int = 1000):
        self.cache: Dict[str, Tuple[Any, float]] = {}
        self.default_ttl = default_ttl
        self.max_size = max_size
        self.lock = asyncio.Lock()

# Defined instances (NEVER CALLED)
user_cache = TTLCache(default_ttl=60, max_size=500)       # 1 minute
company_cache = TTLCache(default_ttl=300, max_size=200)   # 5 minutes
settings_cache = TTLCache(default_ttl=30, max_size=500)   # 30 seconds
```

### Problem
The cache is defined but **never used** in any router. Every request hits the database.

### Recommended Activation

```python
# backend/routers/company.py

from backend.utils.cache import company_cache, cached

@router.get("/company/{company_id}/departments")
async def get_departments(company_id: str, user: dict = Depends(get_current_user)):
    cache_key = f"departments:{company_id}"

    # Use cache with fallback to database
    async def fetch_departments():
        db = get_supabase_with_auth(user['access_token'])
        result = db.table('departments').select('*').eq('company_id', company_id).execute()
        return result.data

    departments = await cached(company_cache, cache_key, fetch_departments, ttl=300)
    return {"departments": departments}
```

### High-Value Cache Candidates

| Endpoint | Current | With Cache | Data Volatility |
|----------|---------|------------|-----------------|
| GET /company/{id}/team | 150ms | 5ms | Low |
| GET /company/{id}/departments | 100ms | 5ms | Low |
| GET /company/{id}/playbooks | 200ms | 5ms | Low |
| GET /company/{id}/overview | 400ms (4 queries!) | 10ms | Low |

---

## Recommended Cache Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Browser                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Persistent Cache (localStorage)                │ │
│  │  - TanStack Query persister                                 │ │
│  │  - 24hr TTL                                                  │ │
│  │  - Excludes: conversations (privacy)                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Memory Cache (TanStack Query)                  │ │
│  │  - staleTime: 5min per query type                            │ │
│  │  - gcTime: 30min                                             │ │
│  │  - Background revalidation on stale                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Service Worker (Workbox)                         │ │
│  │  - CacheFirst: Static assets, images                         │ │
│  │  - NetworkFirst: API calls (10s timeout)                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel Edge Cache                             │
│  - Static assets: max-age=31536000, immutable                   │
│  - HTML: no-cache (for SPA routing)                             │
│  - API proxy: Not caching (pass-through)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Render)                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              TTL Cache (In-Memory) - TO ACTIVATE             │ │
│  │  - company_cache: 5min TTL, 200 entries                     │ │
│  │  - user_cache: 1min TTL, 500 entries                        │ │
│  │  - settings_cache: 30s TTL, 500 entries                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                         │
│  - Connection pooling (100 clients, 5min TTL)                   │
│  - Query plan caching (PostgreSQL native)                       │
│  - RLS policy evaluation                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cache-Control Headers

### Current (Vercel Defaults)

| Resource Type | Current Header |
|---------------|----------------|
| HTML | `no-cache` |
| JS (hashed) | `public, max-age=31536000, immutable` |
| CSS (hashed) | `public, max-age=31536000, immutable` |
| Images | `public, max-age=31536000` |
| API | No caching headers |

### Recommended API Headers

```python
# backend/main.py - Add response headers middleware

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)

    # Cache stable GET endpoints
    if request.method == "GET":
        path = request.url.path

        # Long-lived data (departments, team structure)
        if any(p in path for p in ['/departments', '/team', '/playbooks']):
            response.headers["Cache-Control"] = "private, max-age=300"  # 5 min

        # Volatile data (conversations, decisions)
        elif any(p in path for p in ['/conversations', '/decisions']):
            response.headers["Cache-Control"] = "private, no-cache"

    return response
```

---

## Persistent Cache Implementation

### Step 1: Install Dependencies

```bash
npm install @tanstack/query-sync-storage-persister
```

### Step 2: Configure Persister

```typescript
// main.tsx
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'axcouncil-cache-v1',
  throttleTime: 1000, // Debounce writes
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours for persistence
    },
  },
});

// Only persist in browser
if (typeof window !== 'undefined') {
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const key = query.queryKey[0];
        // Don't persist sensitive or volatile data
        if (key === 'conversations') return false;
        if (key === 'user') return false;
        return query.state.status === 'success';
      },
    },
  });
}
```

### Step 3: Clear on Logout

```typescript
// AuthContext.tsx
const signOut = useCallback(async () => {
  // Clear persistent cache on logout
  localStorage.removeItem('axcouncil-cache-v1');
  queryClient.clear();

  await supabase.auth.signOut();
}, [queryClient]);
```

---

## Cache Invalidation Strategy

### Query Key Hierarchy

```
businesses
├── list
├── detail/{id}
├── {companyId}/projects
└── {companyId}/playbooks

conversations
├── list
└── detail/{id}
```

### Invalidation Examples

```typescript
// Invalidate all business-related queries
queryClient.invalidateQueries({ queryKey: ['businesses'] });

// Invalidate specific company's projects
queryClient.invalidateQueries({
  queryKey: ['businesses', companyId, 'projects']
});

// Invalidate after mutation
const mutation = useMutation({
  mutationFn: updateProject,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ['businesses', companyId, 'projects']
    });
  },
});
```

---

## Monitoring Cache Effectiveness

### Add Cache Metrics

```typescript
// utils/cacheMetrics.ts
export function trackCacheHit(queryKey: string[], isHit: boolean) {
  if (import.meta.env.PROD) {
    // Send to analytics
    analytics.track('cache_access', {
      key: queryKey.join(':'),
      hit: isHit,
      timestamp: Date.now(),
    });
  }
}
```

### TanStack Query DevTools

Already configured in development:
```typescript
<ReactQueryDevtools initialIsOpen={false} />
```

---

## Summary

### Current State

| Layer | Status | Effectiveness |
|-------|--------|---------------|
| Browser HTTP | ✅ Working | High for assets |
| Service Worker | ✅ Working | High for assets |
| TanStack Query | ✅ Working | Good for API |
| Persistent Cache | ❌ Missing | 0% |
| Backend Cache | ❌ Unused | 0% |

### After Optimizations

| Layer | Status | Expected Improvement |
|-------|--------|---------------------|
| Browser HTTP | ✅ No change | - |
| Service Worker | ✅ No change | - |
| TanStack Query | ✅ Extended gcTime | Better cache retention |
| Persistent Cache | ✅ Added | Instant returning user loads |
| Backend Cache | ✅ Activated | 40% fewer DB queries |

### Implementation Priority

1. **Day 1:** Activate backend cache for departments/team (4 hours)
2. **Day 2:** Add persistent query cache (3 hours)
3. **Day 3:** Add API cache headers (2 hours)
4. **Day 4:** Test and monitor (2 hours)
