# ADR-005: Edge Caching Strategy

## Status
Partially Implemented

## Context

AxCouncil is deployed on Vercel (frontend) and Render (backend). Both support edge caching, but we need a coherent strategy for different resource types.

### Current State
- Static assets: Properly cached with immutable headers
- HTML: No caching (SPA needs fresh entry point)
- API responses: No cache headers set
- Images: Cached via Vercel edge

### Goals
1. Maximize cache hit rate for stable resources
2. Ensure users get fresh content when needed
3. Reduce origin server load
4. Improve global latency

## Decision

Implement a tiered edge caching strategy based on resource mutability.

### Tier 1: Immutable Assets (Aggressive Caching)

```
Static JS/CSS with content hash
Cache-Control: public, max-age=31536000, immutable
```

**Resources:**
- `*.js` with hash in filename
- `*.css` with hash in filename
- Fonts (woff2)
- Static images

### Tier 2: Stable Data (Medium Caching)

```
Stable API responses
Cache-Control: private, max-age=300, stale-while-revalidate=60
```

**Endpoints:**
- `/api/company/{id}/departments`
- `/api/company/{id}/team`
- `/api/company/{id}/playbooks`

### Tier 3: Dynamic Data (Short/No Caching)

```
Frequently changing data
Cache-Control: private, no-cache
```

**Endpoints:**
- `/api/conversations`
- `/api/decisions`
- Real-time data

### Tier 4: User-Specific (No Edge Caching)

```
Personalized content
Cache-Control: private, no-store
```

**Endpoints:**
- `/api/user/profile`
- Any authenticated mutations

## Implementation

### Vercel Configuration

```json
// vercel.json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Backend Headers

```python
# backend/middleware/caching.py
from fastapi import Request, Response

STABLE_ENDPOINTS = ['/departments', '/team', '/playbooks']

@app.middleware("http")
async def cache_headers(request: Request, call_next):
    response = await call_next(request)

    if request.method == "GET":
        path = request.url.path

        # Stable data - medium cache
        if any(ep in path for ep in STABLE_ENDPOINTS):
            response.headers["Cache-Control"] = "private, max-age=300"

        # Dynamic data - no cache
        elif '/conversations' in path or '/decisions' in path:
            response.headers["Cache-Control"] = "private, no-cache"

    return response
```

### ETag Support

```python
import hashlib

def add_etag(response, data):
    etag = hashlib.md5(str(data).encode()).hexdigest()
    response.headers["ETag"] = f'"{etag}"'
    return response

# In endpoint
@router.get("/company/{id}/team")
async def get_team(...):
    data = await fetch_team()
    response = JSONResponse(data)
    return add_etag(response, data)
```

## Consequences

### Positive
- Reduced origin load for stable data
- Faster responses from edge for cached content
- Bandwidth savings from 304 responses
- Better global performance

### Negative
- Complexity in cache invalidation
- Potential for stale data (mitigated by short TTL)
- Must coordinate with frontend caching

### Neutral
- Need to monitor cache hit rates
- May need to adjust TTLs based on data patterns

## Cache Invalidation

### On Mutation
When data changes, clients should:
1. Invalidate TanStack Query cache
2. Next request gets fresh data (bypass edge if needed)

### Force Fresh
```typescript
// Add header to bypass edge cache
const response = await fetch(url, {
  headers: {
    'Cache-Control': 'no-cache'
  }
});
```

## Monitoring

### Vercel Analytics
- Cache hit rate per route
- Edge vs origin response times
- Bandwidth by cache status

### Custom Tracking
```typescript
// Track cache effectiveness
const cacheStatus = response.headers.get('x-vercel-cache');
analytics.track('api_request', {
  path,
  cacheStatus, // HIT, MISS, STALE, etc.
  responseTime,
});
```

## Related Documents
- [CACHING_STRATEGY.md](../CACHING_STRATEGY.md)
- [ADR-001-query-caching.md](./ADR-001-query-caching.md)
- [NETWORK_WATERFALL.md](../NETWORK_WATERFALL.md)

## References
- [Vercel Edge Caching](https://vercel.com/docs/edge-network/caching)
- [HTTP Caching - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [stale-while-revalidate](https://web.dev/stale-while-revalidate/)
