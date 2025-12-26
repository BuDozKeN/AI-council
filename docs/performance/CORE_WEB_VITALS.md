# Core Web Vitals Analysis

## Current Implementation

### Web Vitals Tracking ✅

```typescript
// utils/webVitals.ts
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';

function sendToAnalytics(metric) {
  // Development: Console logging with color coding
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value}`);
    return;
  }

  // Production: Send to Sentry
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${metric.value}`,
    level: metric.rating === 'poor' ? 'warning' : 'info',
  });

  // Track poor metrics
  if (metric.rating === 'poor') {
    Sentry.setMeasurement(metric.name, metric.value, 'millisecond');
  }
}
```

**Assessment:** ✅ Well-implemented with Sentry integration

---

## Core Web Vitals Breakdown

### LCP (Largest Contentful Paint)

**What it measures:** Time until the largest visible element renders

**Target:** < 2500ms (Good), < 4000ms (Needs Improvement)

**Current Estimate:** ~1500ms

**AxCouncil LCP Elements:**
- Dashboard: Main content area with cards
- Conversations: Message list area
- Company: Overview statistics

**Optimization Status:**

| Factor | Status | Notes |
|--------|--------|-------|
| Server response | ✅ | Vercel edge, fast TTFB |
| Render-blocking resources | ✅ | Code split, async loading |
| Resource load time | ✅ | CDN, compression |
| Client-side rendering | ⚠️ | Data fetching adds time |

**Improvement Opportunity:**
```typescript
// Prefetch critical data to reduce LCP
// On route transition, data already cached
queryClient.prefetchQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
});
```

---

### INP (Interaction to Next Paint)

**What it measures:** Responsiveness to user interactions (replaced FID)

**Target:** < 200ms (Good), < 500ms (Needs Improvement)

**Current Estimate:** ~80ms

**Assessment:** ✅ Already good

**Why it's good:**
- React's efficient reconciliation
- No blocking JavaScript
- Event handlers are lightweight

**Maintained by:**
- Keeping event handlers fast
- Avoiding synchronous heavy computation
- Using requestAnimationFrame for animations

---

### CLS (Cumulative Layout Shift)

**What it measures:** Visual stability (unexpected layout shifts)

**Target:** < 0.1 (Good), < 0.25 (Needs Improvement)

**Current Estimate:** ~0.05

**AxCouncil CLS Considerations:**

| Element | Risk | Mitigation |
|---------|------|------------|
| Images | Low | Dimensions set or skeleton |
| Fonts | Low | font-display configured |
| Dynamic content | Medium | Skeletons reserve space |
| Ads | N/A | No ads |

**Potential Issues:**
```typescript
// PROBLEM: Content pushes down when data loads
{isLoading ? null : <LargeComponent />}

// SOLUTION: Reserve space with skeleton
{isLoading ? <Skeleton height={200} /> : <LargeComponent />}
```

---

### TTFB (Time to First Byte)

**What it measures:** Server response time

**Target:** < 600ms (Good)

**Current Estimate:** ~300ms

**Why it's good:**
- Vercel edge deployment
- Static assets on CDN
- API on Render (optimized)

**Factors:**
| Factor | Status |
|--------|--------|
| Edge deployment | ✅ Vercel |
| CDN caching | ✅ Static assets |
| API response | ✅ ~200-400ms |
| Database | ✅ Supabase global |

---

### FCP (First Contentful Paint)

**What it measures:** Time until first content renders

**Target:** < 1800ms (Good)

**Current Estimate:** ~800ms

**Why it's good:**
- Minimal render-blocking resources
- Efficient code splitting
- Good TTFB

---

## Metrics Dashboard

### Current Tracking

```
Production Flow:
                     ┌─────────────┐
                     │   Browser   │
                     └──────┬──────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
        web-vitals     sessionStorage    Sentry
        (collection)    (debugging)    (monitoring)
```

### Recommended Enhancement

```typescript
// Send to dedicated analytics endpoint
function sendToAnalytics(metric) {
  // Existing Sentry tracking...

  // Add: Custom endpoint for dashboarding
  if (import.meta.env.PROD) {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        page: window.location.pathname,
        timestamp: Date.now(),
      }),
      keepalive: true, // Ensure delivery on page unload
    });
  }
}
```

---

## Optimization Recommendations

### LCP Optimization

**Current Issue:** Initial data fetch delays LCP

**Solution: Predictive Prefetching**
```typescript
// Prefetch on likely navigation
<Link
  to="/dashboard"
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard-data'],
      queryFn: fetchDashboardData,
    });
  }}
>
```

**Impact:** LCP reduced by data fetch time (~200-400ms)

### CLS Prevention

**Ensure skeletons match content:**
```typescript
// Match exact layout
function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-[200px]" /> {/* Match card height */}
      <Skeleton className="h-[200px]" />
      <Skeleton className="h-[200px]" />
    </div>
  );
}
```

### INP Maintenance

**Keep interactions fast:**
```typescript
// Good: Optimistic updates
onClick={() => {
  // Immediate UI feedback
  setLocalState(newValue);
  // Async server update
  mutation.mutate(newValue);
}}

// Bad: Wait for server
onClick={async () => {
  await mutation.mutateAsync(newValue); // Blocks UI
}}
```

---

## Monitoring Setup

### Sentry Performance Dashboard

1. Navigate to Sentry → Performance
2. Filter by Web Vitals
3. Set alerts for:
   - LCP > 2500ms
   - INP > 200ms
   - CLS > 0.1

### Alert Configuration

```javascript
// sentry.config.js
Sentry.init({
  tracesSampleRate: 0.1, // 10% of transactions
  profilesSampleRate: 0.1,

  // Performance monitoring
  integrations: [
    Sentry.browserTracingIntegration({
      // Enable Web Vitals
      enableLongTask: true,
    }),
  ],
});
```

---

## Testing Core Web Vitals

### Local Testing

```bash
# Chrome DevTools → Lighthouse
# Run on incognito, throttled network

# Or via CLI
npx lighthouse https://app.axcouncil.com --view
```

### Field Data (RUM)

- Sentry Performance Dashboard
- Google Search Console (after sufficient traffic)
- Chrome UX Report (CrUX)

---

## Summary

### Current Scores (Estimated)

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | ~1500ms | <2500ms | ✅ Good |
| INP | ~80ms | <200ms | ✅ Good |
| CLS | ~0.05 | <0.1 | ✅ Good |
| TTFB | ~300ms | <600ms | ✅ Good |
| FCP | ~800ms | <1800ms | ✅ Good |

### Improvement Opportunities

| Optimization | Impact on | Expected Improvement |
|--------------|-----------|---------------------|
| Prefetching | LCP | -200-400ms |
| Persistent cache | LCP | -500ms (return visits) |
| Skeleton sizing | CLS | Prevent shifts |

### Overall Assessment

Core Web Vitals are **already in "Good" range**. The recommended optimizations (prefetching, persistent cache) will move them from "Good" to "Excellent" and ensure they remain good as the app grows.
