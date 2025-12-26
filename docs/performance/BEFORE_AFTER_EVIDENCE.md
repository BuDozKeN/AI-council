# Before/After Evidence

This document collects visual and metric evidence of performance improvements.

---

## Evidence Collection Checklist

For each optimization, capture:

- [ ] Video recording of before behavior
- [ ] Video recording of after behavior
- [ ] DevTools screenshots (Network/Performance)
- [ ] Lighthouse scores before and after
- [ ] Web Vitals metrics comparison

---

## Baseline Measurements (Before Optimizations)

### Lighthouse Scores

| Category | Score | Notes |
|----------|-------|-------|
| Performance | ~75-85 | Estimated |
| Accessibility | ~90+ | Good |
| Best Practices | ~95+ | Good |
| SEO | ~90+ | Good |

### Core Web Vitals

| Metric | Value | Rating |
|--------|-------|--------|
| LCP | ~1500ms | Good |
| INP | ~80ms | Good |
| CLS | ~0.05 | Good |
| TTFB | ~300ms | Good |

### Navigation Timing

| Path | Time | Loading States |
|------|------|----------------|
| Dashboard load | ~1200ms | 1 spinner |
| Dashboard → Company | ~300ms | 1 skeleton |
| Company → Projects | ~250ms | 1 skeleton |
| Projects → Decision | ~200ms | 1 skeleton |

### Network Analysis

| Metric | Value |
|--------|-------|
| Total requests (dashboard) | 8-12 |
| Total transfer size | ~300KB |
| Time to interactive | ~2500ms |
| Largest resource | vendor-react.js (~45KB) |

---

## After Optimizations (To Be Filled)

### Phase 1: Caching Infrastructure

**Optimization:** Backend cache + Persistent query cache

**Lighthouse Scores:**
| Category | Before | After | Change |
|----------|--------|-------|--------|
| Performance | TBD | TBD | TBD |

**Core Web Vitals:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP | TBD | TBD | TBD |

**Navigation Timing:**
| Path | Before | After | Change |
|------|--------|-------|--------|
| Return visit load | TBD | TBD | TBD |

---

### Phase 2: Prefetching

**Optimization:** Hover-based prefetching

**Navigation Timing:**
| Path | Before | After | Change |
|------|--------|-------|--------|
| Dashboard → Company | 300ms | TBD | TBD |
| Company → Projects | 250ms | TBD | TBD |

**Loading States Visible:**
| Path | Before | After |
|------|--------|-------|
| Cached nav | 1 skeleton | 0 |

---

### Phase 3: Streaming Optimization

**Optimization:** Buffer optimization

**Memory During AI Response:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Peak memory | ~100MB | TBD | TBD |
| GC pauses | TBD | TBD | TBD |

---

## Video Recording Guidelines

### Tools
- Chrome DevTools Recorder
- Loom or screen recording software
- Mobile device screen recording

### What to Capture

**Before Recording:**
1. Clear cache
2. Open DevTools Network tab
3. Enable "Disable cache" in DevTools
4. Set network throttling to "Fast 3G" (for consistency)

**Recording Sequence:**
1. Start recording
2. Navigate to dashboard
3. Wait for full load
4. Navigate to Company
5. Wait for full load
6. Navigate to Projects
7. Wait for full load
8. Stop recording

**Filename Convention:**
```
before_[optimization-name]_[date].mp4
after_[optimization-name]_[date].mp4
```

---

## Screenshot Guidelines

### DevTools Screenshots

1. **Network Tab:**
   - Show full waterfall
   - Include timing column
   - Show total transfer size and time

2. **Performance Tab:**
   - Record page load
   - Show main thread activity
   - Highlight long tasks

3. **Memory Tab:**
   - Heap snapshot before action
   - Heap snapshot during action
   - Heap snapshot after action

### Lighthouse Screenshots

1. Run Lighthouse in incognito mode
2. Use "Performance" category only for speed
3. Use "Applied throttling" (not simulated)
4. Save full HTML report

---

## Metric Comparison Template

Use this template for each optimization:

```markdown
## [Optimization Name]

### Summary
- **Implementation Date:** [Date]
- **Key Improvement:** [Description]
- **Overall Impact:** [High/Medium/Low]

### Metrics Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| LCP | Xms | Xms | X% |
| Navigation | Xms | Xms | X% |
| Bundle Size | XKB | XKB | X% |

### Visual Evidence

**Before:**
![Before screenshot](./screenshots/before-[name].png)

**After:**
![After screenshot](./screenshots/after-[name].png)

### Video Comparison

- Before: [Link to video]
- After: [Link to video]

### Notes
[Any observations or caveats]
```

---

## Evidence Storage

Store all evidence in:
```
docs/performance/
├── screenshots/
│   ├── before-cache-activation.png
│   ├── after-cache-activation.png
│   └── ...
├── videos/
│   ├── before-prefetch.mp4
│   ├── after-prefetch.mp4
│   └── ...
└── reports/
    ├── lighthouse-before-2025-01.html
    ├── lighthouse-after-2025-01.html
    └── ...
```

---

## Summary Table (To Be Updated)

| Optimization | Before | After | Evidence |
|--------------|--------|-------|----------|
| Backend cache | - | - | Pending |
| Persistent cache | - | - | Pending |
| Prefetching | - | - | Pending |
| Buffer optimization | - | - | Pending |
| Overview endpoint | - | - | Pending |

---

*This document will be updated as optimizations are implemented and measured.*
