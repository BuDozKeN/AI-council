# Implementation Roadmap

## Overview

This roadmap transforms AxCouncil from "good" to "Zeus-tier" performance in a structured 4-phase approach over approximately 3 weeks.

---

## Phase 1: Foundation (Days 1-5)
**Goal:** Activate caching infrastructure, establish measurement baseline

### Day 1: Backend Cache Activation

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Review `backend/utils/cache.py` | P0 | 30min | Understanding |
| Add cache to `/company/{id}/team` | P0 | 1h | High |
| Add cache to `/company/{id}/departments` | P0 | 1h | High |
| Add cache invalidation on updates | P0 | 1h | Required |
| Test cache behavior | P0 | 30min | Verification |

**Deliverable:** Backend responds 40% faster for stable endpoints

### Day 2: Persistent Query Cache

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Install `@tanstack/query-sync-storage-persister` | P0 | 15min | Setup |
| Configure persister in `main.tsx` | P0 | 1h | Core |
| Add cache exclusions (conversations, user) | P0 | 30min | Privacy |
| Add cache clear on logout | P0 | 30min | Security |
| Test persistence across refreshes | P0 | 30min | Verification |

**Deliverable:** Returning users see instant page loads

### Day 3: Prefetch Infrastructure

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Create `usePrefetch.ts` hook | P0 | 1h | Foundation |
| Add prefetch for company data | P0 | 1h | High |
| Add prefetch for projects | P0 | 1h | High |
| Add prefetch for playbooks | P0 | 30min | Medium |

**Deliverable:** Prefetch utilities ready for integration

### Day 4: Navigation Prefetch Integration

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Identify all navigation links | P0 | 30min | Research |
| Add `onMouseEnter` handlers | P0 | 2h | Core |
| Test prefetch behavior | P0 | 1h | Verification |
| Verify cache hits on click | P0 | 30min | Verification |

**Deliverable:** Navigation feels instant (<100ms)

### Day 5: Measurement Baseline

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Run Lighthouse audits (before) | P0 | 30min | Baseline |
| Document navigation times | P0 | 30min | Baseline |
| Record video of current behavior | P0 | 30min | Evidence |
| Set up performance monitoring | P1 | 2h | Tracking |

**Deliverable:** Baseline metrics documented for comparison

---

## Phase 2: Critical Path Optimization (Days 6-10)
**Goal:** Make primary user journeys feel instant

### Day 6: Dashboard Load Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Parallel fetch for initial data | P0 | 2h | High |
| Optimize business context loading | P0 | 2h | High |
| Remove sequential dependencies | P0 | 1h | Medium |

**Deliverable:** Dashboard loads 30% faster

### Day 7: Company Page Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Fix overview 4-query issue | P0 | 3h | Very High |
| Add company data prefetch | P0 | 1h | High |
| Test navigation speed | P0 | 30min | Verification |

**Deliverable:** Company overview loads 75% faster

### Day 8: Projects Page Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Optimize project list query | P0 | 2h | Medium |
| Add project prefetch on hover | P0 | 1h | High |
| Test with large project counts | P0 | 1h | Verification |

**Deliverable:** Projects feel instant

### Day 9: Decisions Page Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Optimize decision list query | P0 | 2h | Medium |
| Add decision prefetch | P0 | 1h | High |
| Optimize conversation loading | P0 | 2h | High |

**Deliverable:** Decisions navigation instant

### Day 10: Loading State Elimination

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Identify remaining loading states | P0 | 30min | Research |
| Replace with cached data | P0 | 2h | High |
| Add skeleton fallbacks only for first load | P0 | 1h | UX |
| Test all navigation paths | P0 | 1h | Verification |

**Deliverable:** Zero loading spinners on cached routes

---

## Phase 3: Polish & Performance (Days 11-14)
**Goal:** Eliminate remaining jank, optimize streaming

### Day 11: Streaming Buffer Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Refactor string buffer → array buffer | P0 | 2h | Memory |
| Add queue backpressure (backend) | P0 | 2h | Stability |
| Test with long responses | P0 | 1h | Verification |

**Deliverable:** 50% memory reduction during streaming

### Day 12: API Response Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Audit SELECT * usage | P1 | 1h | Research |
| Add column projections | P1 | 3h | Payload size |
| Add cache headers | P1 | 1h | HTTP caching |

**Deliverable:** 30% smaller API responses

### Day 13: Bundle Optimization

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Run bundle analyzer | P1 | 30min | Research |
| Add route preloading | P1 | 2h | Perceived speed |
| Review Framer Motion usage | P2 | 2h | Bundle size |

**Deliverable:** Optimized bundle, route preloading

### Day 14: Mobile Performance

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Test on slow 3G | P1 | 1h | Verification |
| Optimize touch interactions | P1 | 2h | UX |
| Verify PWA behavior | P1 | 1h | Offline |

**Deliverable:** Mobile experience verified

---

## Phase 4: Documentation & Demo-Ready (Days 15-17)
**Goal:** Investor-ready documentation and evidence

### Day 15: Complete Documentation

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Finalize AUDIT_REPORT.md | P0 | 2h | Critical |
| Update all detail documents | P0 | 2h | Critical |
| Create BEFORE_AFTER_EVIDENCE.md | P0 | 1h | Critical |

**Deliverable:** Complete documentation suite

### Day 16: Architecture Decision Records

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Write ADR-001: Query Caching | P0 | 1h | Documentation |
| Write ADR-002: Predictive Prefetch | P0 | 1h | Documentation |
| Write ADR-003: Bundle Splitting | P0 | 1h | Documentation |
| Write ADR-004: Streaming Architecture | P0 | 1h | Documentation |
| Write ADR-005: Edge Caching | P0 | 1h | Documentation |

**Deliverable:** Complete ADR library

### Day 17: Demo Preparation

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Record after-optimization videos | P0 | 1h | Evidence |
| Create CTO demo script | P0 | 2h | Presentation |
| Run final Lighthouse audit | P0 | 30min | Metrics |
| Prepare comparison metrics | P0 | 1h | Evidence |

**Deliverable:** Demo-ready application

---

## Success Metrics

### Performance Targets

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Navigation time | 300ms | <100ms | Chrome DevTools |
| Loading states shown | 5+ | 0 (cached) | Visual |
| TTFB | 400ms | <300ms | Lighthouse |
| LCP | 1500ms | <1200ms | Web Vitals |
| Bundle size (gzip) | 235KB | <220KB | Build output |

### Quality Gates

- [ ] All navigation paths feel instant (<100ms when cached)
- [ ] Zero loading spinners on cached content
- [ ] Web Vitals all "Good" rating
- [ ] Mobile Lighthouse score >90
- [ ] All documentation complete
- [ ] Demo script tested and ready

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Cache invalidation bugs | Comprehensive testing, clear invalidation patterns |
| Memory issues from caching | Monitor memory, add size limits |
| Breaking changes | Feature flags, gradual rollout |
| Time overruns | Prioritized backlog, cut low-priority items |

---

## Post-Implementation

### Monitoring Setup

1. **Web Vitals Dashboard**
   - Sentry Performance dashboard configured
   - Alerts for regression

2. **Cache Hit Rate Tracking**
   - Backend cache metrics
   - TanStack Query DevTools in staging

3. **Bundle Size Monitoring**
   - CI check for bundle size regression
   - Alert on >5% increase

### Maintenance

1. **Weekly Performance Review**
   - Check Sentry Web Vitals
   - Review slow query logs
   - Update documentation as needed

2. **Quarterly Audit**
   - Full Lighthouse audit
   - Dependency updates
   - Architecture review

---

## Quick Reference

### Immediate Actions (This Week)
1. Activate backend cache → 40% fewer DB queries
2. Add persistent cache → Instant returning user loads
3. Implement prefetch → Navigation feels instant

### Next Sprint
1. Optimize overview endpoint → 75% faster
2. Streaming buffer fixes → 50% memory reduction
3. API response pruning → 30% smaller payloads

### Backlog
1. Route preloading
2. Framer Motion optimization
3. Context splitting
4. Real-time subscriptions (if needed)
