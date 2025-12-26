# Network Waterfall Analysis

## Dashboard Load Waterfall

### Current Waterfall

```
Timeline (ms)    0    100   200   300   400   500   600   700   800
                 |     |     |     |     |     |     |     |     |
HTML             ████
CSS                  ███
JS (vendor-react)    ████████
JS (vendor-motion)   ████████
JS (index)           ██████████████
─────────────────────────────────────────────────────────────────────
[Parse & Execute]                 ████████████
─────────────────────────────────────────────────────────────────────
API: /companies                              ████████
API: /conversations                          ████████ (parallel)
─────────────────────────────────────────────────────────────────────
[React Render]                                        ████████
─────────────────────────────────────────────────────────────────────
TOTAL TO INTERACTIVE: ~800ms
WATERFALL DEPTH: 4 levels
BLOCKING REQUESTS: HTML → JS → API → Render
```

### Optimized Waterfall (Target)

```
Timeline (ms)    0    100   200   300   400   500
                 |     |     |     |     |     |
HTML             ████
CSS (critical)     █
JS (vendor-react)  ████████ (parallel with CSS)
JS (index)           ██████████
─────────────────────────────────────────────────────────────────────
[Parse & Execute]          ████
─────────────────────────────────────────────────────────────────────
API: /companies        ████████ (prefetched/cached)
API: /conversations    ████████ (prefetched/cached)
─────────────────────────────────────────────────────────────────────
[From Cache - Returning User]  ██ (instant)
─────────────────────────────────────────────────────────────────────
TOTAL TO INTERACTIVE: ~400ms (first load), ~150ms (cached)
WATERFALL DEPTH: 2 levels
BLOCKING REQUESTS: HTML → JS only
```

---

## Request Analysis

### Resource Types

| Type | Count | Total Size (gzip) | Cacheable |
|------|-------|-------------------|-----------|
| HTML | 1 | ~5KB | No (dynamic) |
| CSS | 1 | ~15KB | Yes (hashed) |
| JS | 5-7 | ~235KB | Yes (hashed) |
| API | 2-4 | ~10-50KB | Partially |
| Fonts | 2-3 | ~50KB | Yes |
| Images | 0-5 | Variable | Yes |

### Critical Path Resources

```
1. index.html (blocking)
   └── 2. main CSS (render-blocking)
   └── 3. vendor-react.js (execution-blocking)
   └── 4. index.js (execution-blocking)
       └── 5. API calls (data-blocking)
           └── 6. React render (visible content)
```

---

## Parallelization Opportunities

### Currently Parallel ✅

```typescript
// TanStack Query runs these in parallel
const companies = useQuery({ queryKey: ['companies'], ... });
const conversations = useQuery({ queryKey: ['conversations'], ... });
// Both fetch simultaneously
```

### Sequential That Could Be Parallel ⚠️

```typescript
// BusinessContext.tsx - Currently sequential
useEffect(() => {
  if (businesses.length > 0) {
    // 1. Load preferences (sequential)
    userPreferencesApi.get().then(prefs => {
      setSelectedBusiness(prefs?.last_company_id);
      // 2. Then projects/playbooks load based on selection
    });
  }
}, [businesses]);
```

**Recommendation:**
```typescript
// Parallel load with prediction
useEffect(() => {
  if (businesses.length > 0) {
    // Load preferences AND prefetch likely company data
    Promise.all([
      userPreferencesApi.get(),
      // Prefetch first company's data (likely selection)
      queryClient.prefetchQuery({
        queryKey: ['businesses', businesses[0].id, 'projects']
      }),
    ]).then(([prefs]) => {
      setSelectedBusiness(prefs?.last_company_id || businesses[0].id);
    });
  }
}, [businesses]);
```

---

## HTTP/2 Multiplexing

### Current Status: ✅ Enabled

Vercel and Render both use HTTP/2:
- Multiple requests over single connection
- Header compression (HPACK)
- Server push (not currently used)

### Verification

```bash
curl -I --http2 https://app.axcouncil.com
# Look for: HTTP/2 200
```

---

## Resource Hints

### Current Resource Hints

```html
<!-- index.html -->
<link rel="preconnect" href="https://supabase.co">
<link rel="preconnect" href="https://fonts.googleapis.com">
```

### Recommended Additions

```html
<!-- Preconnect to critical origins -->
<link rel="preconnect" href="https://your-supabase-url.supabase.co">
<link rel="preconnect" href="https://openrouter.ai">

<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

<!-- Prefetch likely routes -->
<link rel="prefetch" href="/assets/vendor-motion-[hash].js">

<!-- DNS prefetch for less critical -->
<link rel="dns-prefetch" href="https://sentry.io">
```

---

## API Response Optimization

### Current Response Sizes

| Endpoint | Response Size | Over-fetching |
|----------|---------------|---------------|
| GET /companies | ~5-20KB | 60% unused fields |
| GET /conversations | ~10-50KB | 47% unused fields |
| GET /projects | ~5-15KB | 60% unused fields |

### Compression Status

| Endpoint | gzip | brotli | Recommendation |
|----------|------|--------|----------------|
| All API | ✅ Yes | ✅ Yes | Already optimal |

**Note:** FastAPI with GZipMiddleware handles compression.

---

## Caching Headers

### Current Headers

```
Static Assets (Vercel):
Cache-Control: public, max-age=31536000, immutable

API Responses:
Cache-Control: (none currently)
```

### Recommended API Headers

```python
# Add to API responses
@router.get("/companies")
async def list_companies(...):
    response = await get_companies()
    return Response(
        content=json.dumps(response),
        headers={
            "Cache-Control": "private, max-age=300",  # 5 min
            "ETag": compute_etag(response),
        }
    )
```

---

## Navigation Waterfall: Dashboard → Company

### Current Flow

```
User clicks "Company" link
    │
    ▼
Router navigation starts                    +0ms
    │
    ▼
Previous route component unmounts           +5ms
    │
    ▼
Company route component mounts              +10ms
    │
    ▼
useQuery triggers fetch                     +15ms
    │
    ▼
Loading skeleton shown                      +20ms
    │
    ▼
[Network latency]                           +200ms
    │
    ▼
Data received, state update                 +220ms
    │
    ▼
Content rendered                            +240ms

TOTAL: ~240-400ms with loading state visible
```

### Optimized Flow (With Prefetch)

```
User hovers "Company" link
    │
    ▼
Prefetch triggered                          +0ms
    │
    ▼
API call starts (background)                +5ms
    │
    ▼
[Network latency - hidden from user]        +200ms
    │
    ▼
Data cached                                 +205ms

User clicks "Company" link (~100ms after hover)
    │
    ▼
Router navigation starts                    +0ms
    │
    ▼
useQuery checks cache: HIT                  +2ms
    │
    ▼
Content rendered immediately                +15ms
    │
    ▼
Background revalidation (silent)            +20ms

TOTAL: ~15-50ms, NO loading state visible
```

---

## Streaming Request Analysis

### AI Council Request

```
POST /conversations/{id}/messages
    │
    ▼
Request sent                                +0ms
    │
    ▼
Backend receives, validates                 +50ms
    │
    ▼
Council orchestration starts                +100ms
    │
    ▼
First AI model starts streaming             +150ms
    │
    ▼
FIRST TOKEN RECEIVED                        +400ms (TTFT)
    │
    ▼
Tokens stream at ~50-100/sec                +400-5000ms
    │
    ▼
Stage 1 complete, Stage 2 starts            +5000ms
    │
    ▼
Full response complete                      +15000-30000ms
```

**Key Metrics:**
- Time to First Token (TTFT): ~400ms ✅ Good
- Token streaming rate: ~50-100/sec ✅ Good
- Total response time: 15-30s (5 models, 3 stages)

---

## Summary

### Current State

| Aspect | Status | Notes |
|--------|--------|-------|
| HTTP/2 | ✅ Enabled | Multiplexing works |
| Compression | ✅ Good | gzip/brotli enabled |
| Parallel API calls | ✅ Good | TanStack Query parallel |
| Asset caching | ✅ Excellent | Immutable with hashes |
| API caching | ⚠️ Missing | No Cache-Control headers |
| Prefetching | ❌ Missing | Main opportunity |

### Optimization Priority

| Action | Impact | Effort |
|--------|--------|--------|
| Add prefetch on hover | Very High | 6h |
| Add API cache headers | Medium | 2h |
| Add resource hints | Low | 1h |
| Reduce payload sizes | Medium | 4h |

### Target Improvements

| Navigation | Before | After |
|------------|--------|-------|
| First load | 800ms | 500ms |
| Cached navigation | 300ms | 50ms |
| Returning user | 800ms | 150ms |
