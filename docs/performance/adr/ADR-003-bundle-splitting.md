# ADR-003: Bundle Splitting Strategy

## Status
Accepted (Implemented)

## Context

Single-page applications can suffer from large initial bundle sizes, leading to slow first loads especially on mobile networks. AxCouncil needs to balance feature richness with fast loading.

### Initial Analysis
- React + dependencies: ~150KB gzip
- Framer Motion: ~30KB gzip
- React Markdown: ~25KB gzip
- Other vendors: ~30KB gzip
- App code: ~100KB gzip
- **Total potential bundle: ~335KB gzip**

### Goals
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Support slow 3G connections

## Decision

Implement a multi-layer bundle splitting strategy using Vite's rollup configuration.

### Layer 1: Vendor Chunk Separation

Split stable vendor code into separate chunks for optimal caching:

```javascript
// vite.config.js
rollupOptions: {
  output: {
    manualChunks: {
      'vendor-react': ['react', 'react-dom', 'react-router-dom'],
      'vendor-motion': ['framer-motion'],
      'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw'],
      'vendor-radix': ['@radix-ui/react-*'],
      'vendor-monitoring': ['@sentry/react', 'web-vitals'],
    }
  }
}
```

### Layer 2: Route-Based Code Splitting

Lazy load all page components:

```typescript
// App.tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Company = lazy(() => import('./pages/Company'));
const Projects = lazy(() => import('./pages/Projects'));
// ... all routes lazy loaded
```

### Layer 3: Component-Level Splitting

Lazy load heavy components within pages:

```typescript
// Within a page component
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const MarkdownRenderer = lazy(() => import('./components/MarkdownRenderer'));
```

### Layer 4: Suspense Boundaries

Provide meaningful loading states:

```typescript
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    ...
  </Routes>
</Suspense>
```

## Resulting Bundle Structure

```
dist/
├── index.html                    # Entry
├── assets/
│   ├── index-[hash].js          # App code (~100KB)
│   ├── vendor-react-[hash].js   # React core (~45KB)
│   ├── vendor-motion-[hash].js  # Animations (~30KB)
│   ├── vendor-markdown-[hash].js # Markdown (~25KB)
│   ├── vendor-radix-[hash].js   # UI components (~20KB)
│   ├── vendor-monitoring-[hash].js # Sentry (~15KB)
│   ├── page-dashboard-[hash].js # Route chunk
│   ├── page-company-[hash].js   # Route chunk
│   └── ...
```

## Consequences

### Positive
- Initial load reduced to ~160KB (index + vendor-react)
- Vendor chunks cached separately (year-long cache)
- Routes load on-demand
- Updates only invalidate changed chunks

### Negative
- More HTTP requests (mitigated by HTTP/2)
- Complexity in chunk configuration
- Must manage Suspense boundaries

### Neutral
- Need to monitor chunk sizes over time
- May need to adjust splitting as app grows

## Cache Strategy

| Chunk Type | Cache-Control | Rationale |
|------------|---------------|-----------|
| vendor-* | immutable, 1 year | Never changes for same hash |
| page-* | immutable, 1 year | Content-hash in filename |
| index | short, with revalidation | Entry point, changes often |

## Monitoring

### Bundle Size Budget

```json
{
  "budgets": [
    { "type": "initial", "maximumWarning": "200kb", "maximumError": "300kb" },
    { "type": "anyScript", "maximumWarning": "100kb", "maximumError": "150kb" }
  ]
}
```

### CI Check

```bash
# Add to CI pipeline
npx vite-bundle-analyzer --mode production
# Fail if main chunk > 150KB gzip
```

## Related Documents
- [BUNDLE_ANALYSIS.md](../BUNDLE_ANALYSIS.md)
- [NETWORK_WATERFALL.md](../NETWORK_WATERFALL.md)

## References
- [Vite Code Splitting](https://vitejs.dev/guide/build.html#chunking-strategy)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Web.dev Code Splitting](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
