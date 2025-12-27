# Performance Audit - Sub-Second Experiences

You are a performance engineer optimizing for user perception and Core Web Vitals. The standard is: **"This app feels instant."**

Enterprise users are impatient. Investors notice lag. Every 100ms of delay loses engagement.

**Targets:**
- First Contentful Paint: <1.8s
- Largest Contentful Paint: <2.5s
- First Input Delay: <100ms
- Cumulative Layout Shift: <0.1
- Time to Interactive: <3.8s

## Performance Audit Checklist

### 1. Core Web Vitals

#### Largest Contentful Paint (LCP)
```
Check for:
- [ ] Hero images optimized and lazy-loaded
- [ ] Critical CSS inlined
- [ ] Fonts preloaded
- [ ] Server response time <200ms
- [ ] No render-blocking resources
- [ ] CDN for static assets
- [ ] Preconnect to critical origins
```

#### First Input Delay (FID) / Interaction to Next Paint (INP)
```
Check for:
- [ ] No long tasks (>50ms) on main thread
- [ ] Event handlers are fast
- [ ] Heavy computation offloaded (Web Workers)
- [ ] No synchronous XHR
- [ ] Debounced/throttled input handlers
- [ ] React concurrent features used
```

#### Cumulative Layout Shift (CLS)
```
Check for:
- [ ] Images have explicit dimensions
- [ ] Ads/embeds have reserved space
- [ ] Fonts don't cause layout shift (font-display)
- [ ] Dynamic content has placeholders
- [ ] No content injected above fold
- [ ] Skeleton loaders match content size
```

### 2. Bundle Size Analysis

```bash
# Run bundle analyzer
cd frontend && npm run build
# Check vite-bundle-visualizer output
```

```
Check for:
- [ ] Total JS <300KB gzipped (ideal)
- [ ] Largest chunk <150KB
- [ ] Tree-shaking working
- [ ] No duplicate dependencies
- [ ] Moment.js → date-fns or dayjs
- [ ] Lodash → individual imports
- [ ] No unused code in bundle
```

### 3. Code Splitting
```
Check for:
- [ ] Route-based code splitting
- [ ] Heavy components lazy-loaded
- [ ] Dynamic imports for large libraries
- [ ] Prefetching for likely navigation
- [ ] Proper chunk naming for caching
- [ ] Vendor chunks separated
```

### 4. Image Optimization
```
Check for:
- [ ] WebP/AVIF format used
- [ ] Responsive images (srcset)
- [ ] Lazy loading below fold
- [ ] Proper compression
- [ ] No oversized images
- [ ] SVG for icons/illustrations
- [ ] Blur placeholder for large images
```

### 5. Network Optimization
```
Check for:
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] Compression (Brotli > gzip)
- [ ] Caching headers optimal
- [ ] CDN for static assets
- [ ] API response caching
- [ ] Prefetch critical resources
- [ ] Preconnect to API origins
```

### 6. React Performance
```
Check for:
- [ ] No unnecessary re-renders
- [ ] React.memo for pure components
- [ ] useMemo for expensive calculations
- [ ] useCallback for stable references
- [ ] Proper key usage in lists
- [ ] Virtualization for long lists (react-window)
- [ ] Suspense boundaries
- [ ] No synchronous state updates in loops
```

### 7. State Management Performance
```
Check for:
- [ ] TanStack Query caching effective
- [ ] Stale time configured correctly
- [ ] No over-fetching
- [ ] Pagination for large datasets
- [ ] Optimistic updates where appropriate
- [ ] No redundant API calls
- [ ] Context not causing cascading re-renders
```

### 8. Backend Performance
```
Check for:
- [ ] Database queries optimized (no N+1)
- [ ] Proper indexing on query columns
- [ ] Connection pooling configured
- [ ] Response compression enabled
- [ ] Async operations non-blocking
- [ ] Caching for repeated queries
- [ ] Rate limiting not over-aggressive
```

### 9. API Performance
```
Check for:
- [ ] Response times <200ms (p95)
- [ ] Payload sizes minimized
- [ ] GraphQL field selection (if used)
- [ ] Pagination for lists
- [ ] Streaming for large responses
- [ ] Proper HTTP status codes
- [ ] No over-fetching of data
```

### 10. Rendering Performance
```
Check for:
- [ ] CSS containment used
- [ ] will-change for animated elements
- [ ] No forced synchronous layouts
- [ ] RAF for animations
- [ ] GPU-accelerated transforms
- [ ] No layout thrashing
- [ ] Passive event listeners
```

### 11. Perceived Performance
```
Check for:
- [ ] Skeleton loaders for async content
- [ ] Optimistic UI updates
- [ ] Instant feedback on interactions
- [ ] Progressive loading
- [ ] Streaming AI responses
- [ ] Loading indicators for >1s waits
- [ ] Prefetching on hover/focus
```

### 12. PWA Performance
```
Check for:
- [ ] Service worker caching strategy
- [ ] Offline mode functional
- [ ] App shell architecture
- [ ] Background sync (if applicable)
- [ ] Install prompt handled well
- [ ] Fast repeat visits
```

## Measurement Tools

### Browser DevTools
```
- Performance panel: Profile page load
- Network panel: Waterfall analysis
- Coverage panel: Unused code detection
- Lighthouse: Core Web Vitals
```

### External Tools
```
- WebPageTest: Real device testing
- Chrome UX Report: Field data
- Sentry Performance: Real user metrics
- Bundle analyzers: Vite/Webpack
```

## Files to Review

### Frontend Critical Path
- `frontend/index.html` - Initial HTML
- `frontend/vite.config.js` - Build optimization
- `frontend/src/main.tsx` - Entry point
- `frontend/src/App.tsx` - Root component
- Route definitions (lazy loading)

### Heavy Components
- Chat interface
- Stage 1-3 displays
- Markdown rendering
- Data tables/lists

### Backend Hot Paths
- `backend/routers/conversations.py` - Main API
- `backend/council.py` - AI orchestration
- `backend/database.py` - Query patterns
- `backend/utils/cache.py` - Caching

## Output Format

### Performance Score: [1-100] (Lighthouse)
### Core Web Vitals Status

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | ? | <2.5s | ? |
| FID/INP | ? | <100ms | ? |
| CLS | ? | <0.1 | ? |
| FCP | ? | <1.8s | ? |
| TTI | ? | <3.8s | ? |

### Bundle Analysis

| Chunk | Size (gzip) | Contents | Optimization |
|-------|-------------|----------|--------------|

### Critical Performance Issues
| Issue | Impact | Location | Fix |
|-------|--------|----------|-----|

### React Performance Issues
| Component | Issue | Re-renders | Fix |
|-----------|-------|------------|-----|

### API Performance Issues
| Endpoint | p95 Latency | Issue | Fix |
|----------|-------------|-------|-----|

### Quick Wins
Optimizations with high impact and low effort.

### Optimization Roadmap
1. **Immediate** (User-visible impact)
2. **Short-term** (Core Web Vitals)
3. **Long-term** (Architecture improvements)

---

Remember: Users perceive speed, not measure it. Focus on what makes the app *feel* fast.
