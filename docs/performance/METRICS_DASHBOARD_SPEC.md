# Metrics Dashboard Specification

## Overview

This document specifies the monitoring and metrics infrastructure to track AxCouncil performance in production.

---

## Current Monitoring Stack

| Tool | Purpose | Status |
|------|---------|--------|
| Sentry | Error tracking | ✅ Configured |
| Web Vitals | Core metrics | ✅ Configured |
| Sentry Performance | Transaction tracing | ✅ Configured |
| Custom Analytics | - | ❌ Not implemented |

---

## Metrics to Track

### Core Web Vitals

| Metric | Collection | Target | Alert Threshold |
|--------|------------|--------|-----------------|
| LCP | web-vitals | <2500ms | >4000ms |
| INP | web-vitals | <200ms | >500ms |
| CLS | web-vitals | <0.1 | >0.25 |
| TTFB | web-vitals | <600ms | >1000ms |
| FCP | web-vitals | <1800ms | >3000ms |

### Custom Metrics

| Metric | Purpose | Target |
|--------|---------|--------|
| Navigation time | Route transitions | <100ms (cached) |
| API response time | Backend performance | <200ms |
| Cache hit rate | Cache effectiveness | >80% |
| TTFT (AI) | Time to first AI token | <500ms |
| Stream complete | Full AI response | <30s |

---

## Sentry Configuration

### Current Setup

```typescript
// utils/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://...@sentry.io/...',
  tracesSampleRate: 0.1,  // 10% of transactions
  profilesSampleRate: 0.1,
  integrations: [
    Sentry.browserTracingIntegration({
      enableLongTask: true,
    }),
  ],
});
```

### Recommended Enhancements

```typescript
// Enhanced configuration
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.VITE_VERSION,

  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  integrations: [
    Sentry.browserTracingIntegration({
      enableLongTask: true,
    }),
    // Add: Capture console errors
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
  ],

  // Custom tags
  initialScope: {
    tags: {
      component: 'frontend',
    },
  },

  // Before send hook for PII filtering
  beforeSend(event) {
    // Remove sensitive data
    return event;
  },
});
```

---

## Web Vitals Dashboard

### Current Implementation

```typescript
// utils/webVitals.ts
function sendToAnalytics(metric) {
  // Dev: Console logging
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value}`);
    return;
  }

  // Prod: Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'web-vitals',
    message: `${metric.name}: ${metric.value}`,
    level: metric.rating === 'poor' ? 'warning' : 'info',
  });

  // Poor metrics as measurements
  if (metric.rating === 'poor') {
    Sentry.setMeasurement(metric.name, metric.value, 'millisecond');
  }

  // SessionStorage for debugging
  sessionStorage.setItem('webVitals', JSON.stringify({...}));
}
```

### Enhanced Implementation

```typescript
// Track all metrics, not just poor ones
function sendToAnalytics(metric) {
  // Always send to Sentry measurements
  Sentry.setMeasurement(
    metric.name,
    metric.value,
    metric.name === 'CLS' ? '' : 'millisecond'
  );

  // Add to active transaction
  const transaction = Sentry.getCurrentHub().getScope().getTransaction();
  if (transaction) {
    transaction.setMeasurement(metric.name, metric.value);
  }

  // Custom endpoint for detailed analytics
  if (import.meta.env.PROD) {
    fetch('/api/analytics/vitals', {
      method: 'POST',
      body: JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        page: window.location.pathname,
        timestamp: Date.now(),
        sessionId: getSessionId(),
      }),
      keepalive: true,
    });
  }
}
```

---

## Backend Monitoring

### Request Metrics

```python
# backend/middleware/metrics.py
import time
from fastapi import Request
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter('http_requests_total', 'Total requests', ['method', 'path', 'status'])
REQUEST_LATENCY = Histogram('http_request_latency_seconds', 'Request latency', ['method', 'path'])

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    latency = time.time() - start

    REQUEST_COUNT.labels(
        method=request.method,
        path=request.url.path,
        status=response.status_code
    ).inc()

    REQUEST_LATENCY.labels(
        method=request.method,
        path=request.url.path
    ).observe(latency)

    return response
```

### Database Metrics

```python
# Track query performance
async def log_query_metrics(query_name: str, duration: float):
    if duration > 0.1:  # > 100ms
        logger.warning(f"Slow query: {query_name} took {duration:.2f}s")
```

---

## Alert Configuration

### Sentry Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Error spike | >10 errors/min | Slack notification |
| LCP degradation | P75 > 4000ms | Email to team |
| High error rate | >5% error rate | PagerDuty |
| New error type | New exception | Slack notification |

### Custom Alert Rules

```yaml
# Alert configuration
alerts:
  - name: "LCP Degradation"
    metric: "lcp"
    condition: "p75 > 4000"
    window: "5m"
    action: "slack"

  - name: "API Latency Spike"
    metric: "api_latency"
    condition: "p95 > 1000"
    window: "5m"
    action: "slack"

  - name: "Cache Hit Rate Drop"
    metric: "cache_hit_rate"
    condition: "< 50%"
    window: "15m"
    action: "email"
```

---

## Dashboard Layout

### Executive Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    AXCOUNCIL PERFORMANCE                     │
├───────────────┬───────────────┬───────────────┬─────────────┤
│ LCP: 1.5s     │ INP: 80ms     │ CLS: 0.05     │ TTFB: 300ms │
│ ✅ Good       │ ✅ Good       │ ✅ Good       │ ✅ Good     │
├───────────────┴───────────────┴───────────────┴─────────────┤
│                                                             │
│  [Performance Trend Graph - 7 days]                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Top Slow Transactions          │ Error Rate                 │
│ 1. /api/council (2.5s)        │ ████░░░░░░ 0.5%            │
│ 2. /api/projects (0.5s)       │                            │
│ 3. /api/company (0.3s)        │                            │
└─────────────────────────────────────────────────────────────┘
```

### Technical Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    TECHNICAL METRICS                         │
├─────────────────────────────────────────────────────────────┤
│ API Response Times (P50 / P95 / P99)                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Histogram: Response time distribution]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Cache Performance                                           │
│ Hit Rate: 85%  │  Memory: 45MB  │  Entries: 1,234          │
├─────────────────────────────────────────────────────────────┤
│ Database                                                    │
│ Queries/sec: 150  │  Avg Time: 25ms  │  Connections: 45    │
├─────────────────────────────────────────────────────────────┤
│ AI Streaming                                                │
│ Avg TTFT: 400ms  │  Avg Total: 15s  │  Success Rate: 99.5% │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Enhanced Sentry (Day 1)

1. Update Sentry configuration with enhanced options
2. Add custom measurements for navigation timing
3. Configure alert rules

### Phase 2: Custom Metrics Endpoint (Day 2)

```typescript
// Frontend: Send metrics
async function trackMetric(name: string, value: number, tags?: object) {
  await fetch('/api/analytics/metric', {
    method: 'POST',
    body: JSON.stringify({ name, value, tags, timestamp: Date.now() }),
    keepalive: true,
  });
}

// Usage
trackMetric('navigation_time', 150, { from: '/dashboard', to: '/company' });
trackMetric('cache_hit', 1, { queryKey: 'companies' });
```

### Phase 3: Dashboard Setup (Day 3)

1. Create Sentry Performance dashboard
2. Add Web Vitals widgets
3. Configure scheduled reports

---

## Accessing Metrics

### Sentry Performance

1. Navigate to Sentry → Performance
2. Filter by transaction or Web Vitals
3. View trends, P50/P95/P99

### DevTools Access

```javascript
// In browser console
JSON.parse(sessionStorage.getItem('webVitals'));
// Returns: { LCP: {...}, INP: {...}, CLS: {...}, ... }
```

### API Endpoint (Future)

```bash
GET /api/analytics/summary
# Returns: { vitals: {...}, apiMetrics: {...}, cacheStats: {...} }
```

---

## Summary

### Current Coverage: Good

- ✅ Error tracking (Sentry)
- ✅ Web Vitals collection
- ✅ Transaction tracing
- ⚠️ No custom metrics endpoint
- ⚠️ No dashboard yet

### Recommended Additions

| Priority | Addition | Effort |
|----------|----------|--------|
| Medium | Custom metrics endpoint | 4h |
| Medium | Sentry dashboard setup | 2h |
| Low | Backend metrics (Prometheus) | 4h |
| Low | Automated reports | 2h |
