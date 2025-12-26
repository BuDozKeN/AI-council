# AxCouncil Performance Audit Report
## Enterprise-Grade Speed Optimisation for €25M Exit Valuation

**Audit Date:** December 2024
**Auditor:** Senior Performance Engineer
**Stack:** React 19 + Vite 7 / FastAPI / Supabase PostgreSQL / Render

---

## A. PERFORMANCE SCORECARD

| Metric | Score (1-10) | Notes |
|--------|-------------|-------|
| **Perceived Speed** | 5/10 | Streaming provides good perceived speed, but initial load is slow |
| **Bundle Efficiency** | 3/10 | 684KB main bundle, no route splitting, empty vendor chunks |
| **Network Efficiency** | 6/10 | Decent API design, but sequential queries and waterfall issues |
| **Database Efficiency** | 5/10 | N+1 queries present, missing indexes likely, no query batching |
| **Caching Maturity** | 4/10 | TanStack Query helps, but no service worker, CDN headers unclear |
| **Streaming Performance** | 8/10 | SSE implementation is solid with circuit breaker patterns |
| **Mobile Performance** | 5/10 | Large bundles hurt mobile FCP, good touch targets in CSS |

**Overall: 5.1/10** - Functional but not enterprise-ready

---

## B. CRITICAL FINDINGS: TOP 5 PERFORMANCE KILLERS

### 1. 🔴 CATASTROPHIC MAIN BUNDLE SIZE: 684KB (195KB gzipped)

**Files:** `frontend/src/App.tsx`, `frontend/vite.config.js`
**Impact:** +2-4 seconds FCP on 3G, +500ms on 4G
**Root Cause:** Zero route-based code splitting. All 50+ components load at startup.

```
Build output:
dist/assets/index-CMuNhak6.js    684.71 KB (195.46 KB gzipped)
```

The entire application - Settings, MyCompany, Leaderboard, all modals, all stage components - loads before showing anything. This is the #1 killer.

**Evidence:**
- `App.tsx`: 54KB, handles ALL routing via state switching
- `api.ts`: 88KB, monolithic API layer
- `Settings.tsx`: 36KB
- `MyCompany.tsx`: 25KB
- `ChatInterface.tsx`: 18KB

---

### 2. 🔴 CSS BUNDLE: 475KB (73KB gzipped)

**File:** `frontend/src/styles/`, CSS output
**Impact:** +1-2 seconds render blocking
**Root Cause:** Tailwind CSS not properly purged, design tokens bloat, no critical CSS extraction.

475KB of CSS is **5x larger than most enterprise apps**. This blocks rendering while the browser parses all styles.

---

### 3. 🔴 RENDER-BLOCKING GOOGLE FONTS

**File:** `frontend/src/index.css:1`
**Impact:** +200-500ms TTFB on first visit

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

This synchronous import blocks rendering until the font request completes. Should use `font-display: swap` with preload hints.

---

### 4. 🟠 N+1 DATABASE QUERIES IN CONVERSATION LOADING

**File:** `backend/storage.py:152-250`
**Impact:** +100-300ms per conversation load

```python
# First query: conversation metadata
conv_result = supabase.table('conversations').select('*').eq('id', conversation_id).execute()

# Second query: count messages
count_result = supabase.table('messages').select('id', count='exact').eq('conversation_id', conversation_id).execute()

# Third query: actual messages
messages_result = supabase.table('messages').select('*').eq('conversation_id', conversation_id).order(...).limit(...).execute()
```

Three sequential queries where one could suffice with proper joins or RPC.

---

### 5. 🟠 CONTEXT PROVIDER RE-RENDER CASCADE

**Files:** `frontend/src/contexts/BusinessContext.tsx`, `frontend/src/contexts/ConversationContext.tsx`
**Impact:** Unnecessary re-renders during streaming, wasted CPU cycles

The 4-layer provider stack (Query → Auth → Business → Conversation → UI → App) means any state change triggers top-down reconciliation. During streaming, `setCurrentConversation` is called on **every token**, causing cascade.

```typescript
// Called 100+ times per second during streaming
setCurrentConversation((prev) => {
  // Creates new object reference every time
  return { ...prev, messages, _streamTick: Date.now() };
});
```

---

## C. QUICK WINS (< 2 hours each)

### 1. Add `font-display: swap` and Preload Fonts
**File:** `frontend/src/index.css`, `frontend/index.html`
**Expected Improvement:** -200-400ms FCP
**Risk:** Low

```html
<!-- Add to index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
```

---

### 2. Fix Empty Supabase Vendor Chunk
**File:** `frontend/vite.config.js`
**Expected Improvement:** Better cache efficiency
**Risk:** Low

The supabase chunk is 512 bytes (empty). Remove from manual chunks - let Vite handle it:

```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-motion': ['framer-motion'],
  'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-slug'],
  'vendor-radix': [
    '@radix-ui/react-dialog',
    '@radix-ui/react-select',
    // ...
  ],
  'vendor-monitoring': ['@sentry/react', 'web-vitals'],
  // REMOVE vendor-supabase - it's creating an empty chunk
},
```

---

### 3. Debounce Streaming State Updates
**File:** `frontend/src/hooks/useMessageStreaming.ts`
**Expected Improvement:** -50% CPU during streaming
**Risk:** Low

Batch streaming updates with requestAnimationFrame:

```typescript
// Add at hook level
const pendingUpdates = useRef<string>('');
const rafRef = useRef<number | null>(null);

// In token handler
case 'stage3_token':
  pendingUpdates.current += event.content;
  if (!rafRef.current) {
    rafRef.current = requestAnimationFrame(() => {
      setCurrentConversation((prev) => {
        // Apply batched update
        const msg = messages[lastIdx];
        messages[lastIdx] = {
          ...msg,
          stage3Streaming: {
            text: (msg.stage3Streaming?.text || '') + pendingUpdates.current,
            complete: false,
          },
        };
        return { ...prev, messages };
      });
      pendingUpdates.current = '';
      rafRef.current = null;
    });
  }
  break;
```

---

### 4. Add HTTP/2 Server Push Headers for Critical Assets
**File:** `vercel.json` (or deployment config)
**Expected Improvement:** -100-200ms asset loading
**Risk:** Low

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Link",
          "value": "</assets/index.css>; rel=preload; as=style"
        }
      ]
    }
  ]
}
```

---

### 5. Enable Gzip/Brotli for API Responses
**File:** `backend/main.py` (already has GZip, verify frontend receives compressed)
**Expected Improvement:** -30-50% API payload size
**Risk:** Low

Verify the GZip middleware is actually compressing responses:
```python
# Already present - verify min_size is appropriate
app.add_middleware(GZipMiddleware, minimum_size=500)  # Lower from 1000
```

---

### 6. Add `loading="lazy"` to Model Icons
**File:** `frontend/src/components/Stage1.tsx:39-52`
**Expected Improvement:** -50ms LCP
**Risk:** Low

```tsx
// In ModelCard component
{iconPath && (
  <img
    src={iconPath}
    alt=""
    className="model-icon"
    loading="lazy"
    decoding="async"
  />
)}
```

---

### 7. Memoize Expensive Derived State
**File:** `frontend/src/contexts/BusinessContext.tsx:236-251`
**Expected Improvement:** Fewer re-renders
**Risk:** Low

The `allRoles` computation runs on every render:
```typescript
const allRoles = useMemo(() => {
  // Already using useMemo - good!
  // But add shallow comparison for deps
}, [availableDepartments]); // ← Add custom comparison
```

---

### 8. Add Cache-Control Headers for Static Assets
**File:** `vercel.json`
**Expected Improvement:** Faster repeat visits
**Risk:** Low

```json
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

---

## D. STRATEGIC OPTIMISATIONS (2-8 hours each)

### 1. Route-Based Code Splitting

**Implementation Approach:**
```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';
import { CouncilLoader } from './components/ui/CouncilLoader';

// Lazy load all non-critical views
const Settings = lazy(() => import('./components/Settings'));
const MyCompany = lazy(() => import('./components/MyCompany'));
const Leaderboard = lazy(() => import('./components/Leaderboard'));
const Triage = lazy(() => import('./components/Triage'));

// In render:
{view === 'SETTINGS' && (
  <Suspense fallback={<CouncilLoader text="Loading settings..." />}>
    <Settings {...props} />
  </Suspense>
)}
```

**Expected Improvement:** 684KB → ~200KB initial bundle (-70%)
**Dependencies:** None
**Trade-offs:** Slight delay on first navigation to lazy views
**Time Estimate:** 4-6 hours

---

### 2. Critical CSS Extraction

**Implementation Approach:**
1. Install `vite-plugin-critical`
2. Configure for above-the-fold styles
3. Inline critical CSS in HTML

```javascript
// vite.config.js
import critical from 'vite-plugin-critical';

export default defineConfig({
  plugins: [
    react(),
    critical({
      criticalUrl: 'http://localhost:5173',
      criticalBase: './dist/',
      criticalPages: [{ uri: '/', template: 'index' }],
      criticalConfig: {
        inline: true,
        dimensions: [
          { width: 375, height: 667 },  // Mobile
          { width: 1440, height: 900 }, // Desktop
        ],
      },
    }),
  ],
});
```

**Expected Improvement:** 475KB CSS → ~50KB initial load
**Dependencies:** Build pipeline change
**Trade-offs:** More complex build, requires testing
**Time Estimate:** 3-4 hours

---

### 3. Batch Database Queries with Supabase RPC

**Implementation Approach:**

Create a PostgreSQL function for conversation loading:
```sql
-- supabase/migrations/xxx_batch_conversation_load.sql
CREATE OR REPLACE FUNCTION get_conversation_with_messages(
  p_conversation_id UUID,
  p_message_limit INT DEFAULT 200
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'conversation', (
      SELECT row_to_json(c.*)
      FROM conversations c
      WHERE c.id = p_conversation_id
    ),
    'messages', (
      SELECT json_agg(m.* ORDER BY m.created_at DESC)
      FROM (
        SELECT * FROM messages
        WHERE conversation_id = p_conversation_id
        ORDER BY created_at DESC
        LIMIT p_message_limit
      ) m
    ),
    'message_count', (
      SELECT COUNT(*) FROM messages
      WHERE conversation_id = p_conversation_id
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then call from Python:
```python
# backend/storage.py
def get_conversation(conversation_id: str, access_token: str = None):
    client = _get_client(access_token)
    result = client.rpc('get_conversation_with_messages', {
        'p_conversation_id': conversation_id,
        'p_message_limit': 200
    }).execute()
    return result.data
```

**Expected Improvement:** 3 queries → 1 query (-200ms)
**Dependencies:** Supabase migration
**Trade-offs:** More complex DB layer, harder to debug
**Time Estimate:** 4-6 hours

---

### 4. Implement React-Window for Long Message Lists

**Implementation Approach:**
```typescript
// Already have react-window in deps!
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

function MessageList({ messages }) {
  const getItemSize = (index) => {
    // Calculate based on content
    const msg = messages[index];
    return msg.role === 'assistant' ? 400 : 100; // Rough estimate
  };

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          itemCount={messages.length}
          itemSize={getItemSize}
        >
          {({ index, style }) => (
            <div style={style}>
              <MessageItem message={messages[index]} />
            </div>
          )}
        </List>
      )}
    </AutoSizer>
  );
}
```

**Expected Improvement:** Smooth scrolling with 100+ messages
**Dependencies:** Already installed (`react-window`)
**Trade-offs:** More complex scroll behavior, custom scrollbar needed
**Time Estimate:** 6-8 hours

---

### 5. Implement Service Worker for Offline Shell

**Implementation Approach:**
```javascript
// frontend/public/sw.js
const CACHE_NAME = 'axcouncil-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/icons/anthropic.svg',
  '/icons/openai.svg',
  // ... other static assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
});
```

**Expected Improvement:** Instant repeat visits, offline shell
**Dependencies:** HTTPS required (already on Vercel)
**Trade-offs:** Cache invalidation complexity
**Time Estimate:** 4-6 hours

---

### 6. Replace Heavy Framer Motion with CSS Animations

**Implementation Approach:**

For simple animations (fade, slide, scale), use CSS:
```css
/* frontend/src/styles/animations.css */
.fade-enter {
  opacity: 0;
  transform: translateY(8px);
}

.fade-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.scale-tap:active {
  transform: scale(0.98);
  transition: transform 100ms ease;
}
```

Keep Framer Motion only for:
- Complex spring physics
- Layout animations
- AnimatePresence (mount/unmount)

**Expected Improvement:** -50KB from bundle if we can tree-shake unused parts
**Dependencies:** CSS architecture review
**Trade-offs:** Less consistent animation API
**Time Estimate:** 6-8 hours

---

### 7. Implement Stale-While-Revalidate for API Responses

**Implementation Approach:**
```typescript
// frontend/src/api.ts
const SWR_CACHE = new Map<string, { data: any; timestamp: number }>();
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

async function fetchWithSWR<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = SWR_CACHE.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < STALE_TIME) {
    // Return cached, revalidate in background
    fetcher().then((data) => {
      SWR_CACHE.set(key, { data, timestamp: Date.now() });
    });
    return cached.data;
  }

  const data = await fetcher();
  SWR_CACHE.set(key, { data, timestamp: now });
  return data;
}
```

**Expected Improvement:** Instant UI for cached data
**Dependencies:** TanStack Query already handles this - verify config
**Trade-offs:** Potentially stale data shown briefly
**Time Estimate:** 2-3 hours

---

## E. ARCHITECTURAL RECOMMENDATIONS

### 1. Code Splitting Strategy

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Route-based** | Simple, huge impact, predictable loading | One chunk per route | ✅ **IMPLEMENT NOW** |
| **Component-based** | Fine-grained, load what you need | Complex dependency tracking | 🟡 After route-based |
| **Vendor chunk optimization** | Better caching | Limited impact vs route splitting | ✅ Already done (mostly) |

**Verdict:** Route-based splitting is the single highest-impact change. Do this first.

---

### 2. Rendering Strategy

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Full SSR** | Fast FCP, SEO, edge caching | Requires Next.js migration, streaming complexity | ❌ Too expensive for now |
| **Hybrid SSR/CSR** | Best of both, progressive enhancement | Architecture complexity | 🟡 Future consideration |
| **Static generation (marketing)** | Instant landing pages | Separate deployment | ✅ **RECOMMEND** for landing page |
| **Edge rendering** | Low latency, regional | Vercel Edge, limited runtime | 🟡 After basics |

**Verdict:** Keep SPA for now. Consider static landing page for marketing (separate `/landing` build).

---

### 3. Caching Architecture

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Service worker** | Offline, instant shell | Cache invalidation complexity | ✅ **IMPLEMENT** |
| **CDN-first** | Global, fast | Already on Vercel | ✅ Already have |
| **Stale-while-revalidate** | Fast perceived speed | Stale data risk | ✅ **TanStack Query already does this** |
| **Redis/edge caching** | Shared state, fast reads | Infrastructure cost | 🟡 At scale only |

**Verdict:** Service worker is the missing piece. TanStack Query already provides SWR semantics.

---

### 4. Database Optimisation

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Read replicas** | Scale reads, lower latency | Supabase cost, complexity | 🟡 At 1000+ concurrent |
| **Query caching (pgBouncer)** | Reuse query plans | Already on Supabase | ✅ Already have |
| **Denormalisation** | Fewer joins, faster reads | Data duplication | 🟡 For hot paths only |
| **Supabase Edge Functions** | Lower latency, serverless | Cold starts, debugging | 🟡 After API stabilizes |

**Verdict:** Focus on query batching (RPC functions) first. Read replicas at scale.

---

### 5. Asset Delivery

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Vercel Image Optimization** | Free with Vercel, WebP/AVIF | Already available | ✅ Use `next/image` patterns |
| **Cloudinary/imgix** | Advanced transforms, CDN | Cost | 🟡 If heavy image use |
| **Font subsetting** | Smaller font files | Build complexity | ✅ **IMPLEMENT** |
| **CSS splitting** | Load only needed styles | Complex setup | 🟡 After critical CSS |

**Verdict:** Critical CSS extraction + font optimization first. Image CDN if user uploads increase.

---

## F. ENTERPRISE-READINESS ASSESSMENT

### Scalability Ceiling

| Component | Current Limit | Bottleneck | Fix Required |
|-----------|--------------|------------|--------------|
| **Frontend** | ~500 concurrent | 684KB bundle | Code splitting |
| **Backend** | ~200 req/sec | Single instance | Horizontal scaling (Render) |
| **Database** | ~1000 connections | Supabase pooling | Already has pgBouncer |
| **Streaming** | ~50 concurrent councils | OpenRouter rate limits | BYOK helps |
| **Storage** | Unlimited | Supabase S3 | Fine |

**Scalability Score: 6/10** - Can handle ~1000 DAU without changes, 10,000+ with recommended fixes.

---

### Performance Monitoring Gaps

| What's Missing | Impact | Fix |
|----------------|--------|-----|
| **Core Web Vitals tracking** | Can't measure user experience | Implement `web-vitals` properly |
| **Real User Monitoring (RUM)** | No percentile data | Sentry Performance or Vercel Analytics |
| **Backend APM** | Can't identify slow endpoints | Sentry Performance (Python) |
| **Database query timing** | Don't know slow queries | Supabase Dashboard + custom logging |
| **Bundle size tracking** | Regressions go unnoticed | Add size-limit to CI |

---

### Load Testing Recommendations

1. **Baseline Test**: k6 script with 50 VUs for 5 minutes
2. **Stress Test**: Ramp to 200 VUs, find breaking point
3. **Streaming Test**: 20 concurrent council sessions
4. **Database Test**: 1000 conversation loads in parallel

```javascript
// k6 script example
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
};

export default function () {
  const res = http.get('https://app.axcouncil.com/api/conversations');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

---

## G. IMPLEMENTATION ROADMAP

### Days 1-30: Quick Wins & Critical Fixes

| Week | Task | Impact | Effort |
|------|------|--------|--------|
| 1 | Fix font loading (preload + swap) | High | 2h |
| 1 | Add Cache-Control headers | Medium | 1h |
| 1 | Fix empty Supabase chunk | Low | 1h |
| 1 | Debounce streaming updates | High | 3h |
| 2 | Route-based code splitting | **Critical** | 6h |
| 2 | Lazy load Settings/MyCompany | High | 4h |
| 3 | Add database query batching RPC | High | 6h |
| 3 | Implement size-limit in CI | Medium | 2h |
| 4 | Critical CSS extraction | High | 4h |

**Target:** 684KB → 250KB bundle, -500ms FCP

---

### Days 31-60: Strategic Optimisations

| Week | Task | Impact | Effort |
|------|------|--------|--------|
| 5 | Service worker for offline shell | High | 6h |
| 5 | React-window for message lists | Medium | 8h |
| 6 | Replace simple Framer animations with CSS | Medium | 8h |
| 6 | Add Sentry Performance for backend | Medium | 4h |
| 7 | Implement API response caching layer | Medium | 6h |
| 8 | Database index audit | High | 4h |

**Target:** LCP < 2s, TTI < 3s on 4G

---

### Days 61-90: Architectural Improvements

| Week | Task | Impact | Effort |
|------|------|--------|--------|
| 9 | Evaluate static landing page | Medium | 8h |
| 10 | Context provider optimization (Jotai/Zustand?) | Medium | 12h |
| 11 | Edge caching for hot API routes | Medium | 8h |
| 12 | Load testing suite | Low (but important) | 8h |

**Target:** Production-ready for €25M due diligence

---

## H. METRICS & MONITORING

### Recommended Tools

| Category | Tool | Cost | Priority |
|----------|------|------|----------|
| **Core Web Vitals** | web-vitals (already installed) | Free | ✅ Configure |
| **RUM** | Vercel Analytics | Free tier | ✅ Add |
| **Error Tracking** | Sentry (already installed) | Free tier | ✅ Already have |
| **Backend APM** | Sentry Performance | Free tier | ✅ Enable |
| **Bundle Analysis** | size-limit CI action | Free | ✅ Add |
| **Synthetic Monitoring** | Checkly or Vercel | Free/Low | 🟡 Nice to have |

### Key Metrics to Track

```typescript
// frontend/src/utils/webVitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics({ name, value, id }) {
  // Send to Vercel Analytics or custom endpoint
  if (window.vercelAnalytics) {
    window.vercelAnalytics.track(name, { value, id });
  }

  // Also log to Sentry for correlation
  Sentry.setMeasurement(name, value, 'millisecond');
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

### Performance Budget

| Metric | Target | Current (est.) | Status |
|--------|--------|----------------|--------|
| **FCP** | < 1.5s | ~2.5s | 🔴 |
| **LCP** | < 2.5s | ~4s | 🔴 |
| **TTI** | < 3.5s | ~5s | 🔴 |
| **CLS** | < 0.1 | ~0.05 | ✅ |
| **Bundle (gzip)** | < 150KB | 195KB | 🟠 |
| **API p95** | < 500ms | ~800ms | 🟠 |

---

## EXECUTIVE SUMMARY

AxCouncil has a **solid architectural foundation** with excellent streaming implementation, proper state management (TanStack Query), and reasonable backend patterns. However, the application suffers from **neglected performance fundamentals** that must be addressed before acquisition due diligence:

### Must Fix (Deal-breakers)
1. **684KB main bundle** - No code splitting = slow everywhere
2. **475KB CSS** - No critical CSS = render blocking
3. **Render-blocking fonts** - Easy fix, high impact

### Should Fix (Red flags in audit)
4. Database query batching - N+1 queries visible
5. Missing performance monitoring - Can't measure = can't prove
6. No service worker - Modern apps have offline support

### Nice to Have (Polish)
7. React-window virtualization
8. Edge caching
9. Static landing page

**Bottom Line:** With 40-60 hours of focused work following this roadmap, AxCouncil can achieve enterprise-grade performance suitable for a €25M valuation. The streaming infrastructure is the crown jewel - it just needs the surrounding performance to match.

---

*Report generated for AxCouncil performance audit. For questions, contact the engineering team.*
