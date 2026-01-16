# JS Bundle Optimization Guide

**Status**: Ready to Start
**Priority**: High (affects client experience)
**Estimated Time**: 2-4 hours
**Expected Impact**: 2-3s faster initial load, 745KB → ~400KB main bundle

---

## Current State (2026-01-15)

**Build Output:**
```
dist/assets/index-CmoRa9bv.js          745KB (minified) → 231KB (gzipped)
dist/assets/UsageTab--ztrea-w.js       348KB (minified) → 105KB (gzipped)
dist/assets/MyCompany-BaOSHn6O.js      106KB (minified) →  25KB (gzipped)
```

**Problem:**
- Main bundle includes ALL routes upfront (745KB)
- Users download MyCompany code even if they never visit it
- Slow initial load on 3G/4G networks

---

## Target State

**After optimization:**
```
dist/assets/index-[hash].js            ~300-400KB (main bundle)
dist/assets/MyCompany-[hash].js        ~100KB (lazy loaded)
dist/assets/UsageTab-[hash].js         ~350KB (lazy loaded)
dist/assets/Settings-[hash].js         ~50KB (lazy loaded)
dist/assets/LLMHub-[hash].js           ~25KB (lazy loaded)
```

**Benefits:**
- 50% smaller main bundle
- Faster Time to Interactive (TTI)
- Better Core Web Vitals scores
- Progressive loading (only download what's needed)

---

## Step 1: Analyze Current Bundle (5 min)

Run bundle analyzer to see what's taking up space:

```bash
cd frontend
npm install -D rollup-plugin-visualizer
```

Add to `vite.config.js`:
```js
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    // ... existing plugins
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

Build and view:
```bash
npm run build
# Opens dist/stats.html in browser - shows treemap of bundle
```

**Look for:**
- Large dependencies (markdown parsers, charts, etc.)
- Components that could be lazy-loaded
- Duplicate code across chunks

---

## Step 2: Add Code Splitting for Routes (30 min)

**File:** `frontend/src/App.tsx`

### Current (eager loading):
```tsx
import MyCompany from './components/MyCompany';
import Settings from './components/Settings';
import ChatInterface from './components/ChatInterface';
```

### New (lazy loading):
```tsx
import { lazy, Suspense } from 'react';

// Lazy load heavy routes
const MyCompany = lazy(() => import('./components/MyCompany'));
const Settings = lazy(() => import('./components/Settings'));
const UsageTab = lazy(() => import('./components/mycompany/tabs/UsageTab'));

// Keep lightweight routes eager
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
```

### Wrap routes in Suspense:
```tsx
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/mycompany" element={<MyCompany />} />
    <Route path="/settings" element={<Settings />} />
    {/* ... other routes */}
  </Routes>
</Suspense>
```

**Create a LoadingSpinner component:**

File: `frontend/src/components/ui/LoadingSpinner.tsx`
```tsx
export function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
    </div>
  );
}
```

---

## Step 3: Configure Manual Chunks (15 min)

**File:** `frontend/src/vite.config.js`

Add manual chunk configuration:

```js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'vendor-motion': ['framer-motion'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw'],
          'vendor-monitoring': ['@sentry/react'],

          // Route chunks (these will be lazy loaded)
          'mycompany': [/src\/components\/mycompany/],
          'settings': [/src\/components\/settings/],
          'usage': [/src\/components\/mycompany\/tabs\/UsageTab/],
        },
      },
    },
  },
});
```

---

## Step 4: Lazy Load Heavy Components (20 min)

**Identify heavy components** (from bundle analyzer):
- UsageTab (348KB) - charts library
- MyCompany (106KB) - complex state management
- Settings tabs (various sizes)

**Pattern to use:**

```tsx
// Before (eager)
import UsageTab from './tabs/UsageTab';

// After (lazy)
const UsageTab = lazy(() => import('./tabs/UsageTab'));

// In render:
<Suspense fallback={<TabLoadingSkeleton />}>
  <UsageTab />
</Suspense>
```

**Create loading skeletons:**

File: `frontend/src/components/ui/TabLoadingSkeleton.tsx`
```tsx
export function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <div className="h-8 w-1/3 animate-pulse rounded bg-gray-200" />
      <div className="h-64 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded bg-gray-200" />
    </div>
  );
}
```

---

## Step 5: Test Lazy Loading (20 min)

**Manual testing checklist:**

1. **Test each lazy-loaded route:**
   ```bash
   npm run dev
   # Navigate to /mycompany - should show spinner briefly, then load
   # Navigate to /settings - should show spinner briefly, then load
   ```

2. **Check Network tab (Chrome DevTools):**
   - Initial load: Should download ~400KB main bundle
   - Navigate to /mycompany: Should download MyCompany chunk (~100KB)
   - Navigate to /settings: Should download Settings chunk (~50KB)

3. **Test offline scenario:**
   - Disable network after initial load
   - Try navigating to lazy route → should fail gracefully
   - Re-enable network → should retry and load

4. **Error boundary for lazy loading:**

Add to `App.tsx`:
```tsx
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function LazyLoadError({ error, resetErrorBoundary }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h2>Failed to load page</h2>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

// Wrap Suspense in ErrorBoundary:
<ErrorBoundary FallbackComponent={LazyLoadError}>
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>...</Routes>
  </Suspense>
</ErrorBoundary>
```

---

## Step 6: Build and Verify (10 min)

```bash
npm run build
```

**Check build output:**
```
dist/assets/index-[hash].js           ~300-400KB ✅ (was 745KB)
dist/assets/MyCompany-[hash].js       ~100KB ✅ (lazy loaded)
dist/assets/UsageTab-[hash].js        ~350KB ✅ (lazy loaded)
dist/assets/Settings-[hash].js        ~50KB ✅ (lazy loaded)
```

**Verify totals:**
- Total bundle size should be similar (just split up)
- Main bundle should be 50% smaller
- Check gzipped sizes (more realistic for production)

---

## Step 7: Lighthouse Score (5 min)

Run Lighthouse audit to verify improvements:

```bash
npm run build
npm run preview  # Starts production preview
# Open Chrome DevTools → Lighthouse → Run audit
```

**Expected improvements:**
- **First Contentful Paint (FCP)**: Should improve by 0.5-1s
- **Time to Interactive (TTI)**: Should improve by 1-2s
- **Total Blocking Time (TBT)**: Should decrease
- **Performance Score**: Should increase by 5-10 points

---

## Step 8: Update CI Performance Budget (5 min)

Add JS bundle size check to `.github/workflows/ci.yml`:

```yaml
- name: JS Bundle Size Check
  working-directory: frontend
  run: |
    echo "📦 JS Bundle Performance Budget"

    # Get main bundle size
    MAIN_BUNDLE=$(find dist/assets/index-*.js -type f -exec ls -lh {} \; | awk '{print $5}')
    MAIN_BUNDLE_KB=$(find dist/assets/index-*.js -type f -exec ls -l {} \; | awk '{print $5/1024}')

    echo "Main bundle: ${MAIN_BUNDLE} (${MAIN_BUNDLE_KB}KB)"

    # Budget: 450KB for main bundle (gzipped ~130KB)
    MAX_BUNDLE_KB=450

    if (( $(echo "$MAIN_BUNDLE_KB > $MAX_BUNDLE_KB" | bc -l) )); then
      echo "❌ FAILED: Main bundle exceeds budget of ${MAX_BUNDLE_KB}KB"
      exit 1
    else
      echo "✅ PASSED: Main bundle within budget"
    fi
```

---

## Step 9: Commit and Push (5 min)

```bash
git add -A
git commit -m "perf(bundle): optimize JS bundle with code splitting

- Add lazy loading for MyCompany, Settings, UsageTab routes
- Configure manual chunks for vendor libraries
- Add Suspense boundaries with loading skeletons
- Add error boundaries for lazy load failures
- Reduce main bundle from 745KB → ~400KB (50% reduction)
- Add JS bundle size check to CI

Impact:
- 2-3s faster initial load on 3G
- Improved Lighthouse performance score
- Progressive loading (download what's needed)"

git push -u origin claude/optimize-js-bundle-[session-id]
```

---

## Troubleshooting

### Issue: "Cannot access X before initialization"
**Cause:** Circular dependency in lazy-loaded modules
**Fix:** Move shared code to separate file

### Issue: Lazy route flashes loading spinner
**Cause:** Component loads too fast to see spinner
**Fix:** Add minimum delay (200ms) or remove spinner for fast loads

### Issue: Build fails with "Top-level await"
**Cause:** Dynamic import in non-async context
**Fix:** Wrap in async IIFE or use React.lazy()

### Issue: Chunk names are hashed, hard to debug
**Fix:** Add to vite.config.js:
```js
build: {
  rollupOptions: {
    output: {
      chunkFileNames: 'assets/[name]-[hash].js',
    },
  },
},
```

---

## Success Metrics

**Before:**
- Main bundle: 745KB
- Initial load: ~5s on 3G
- Lighthouse Performance: ~70

**After (target):**
- Main bundle: ~400KB (50% reduction)
- Initial load: ~2-3s on 3G
- Lighthouse Performance: ~80-85

**Verify with:**
```bash
# Bundle size
npm run build && ls -lh dist/assets/index-*.js

# Lighthouse score
npx lighthouse http://localhost:5173 --view

# Real user metrics (after deploy)
# Check Sentry Performance or Vercel Analytics
```

---

## Resources

- [React lazy() docs](https://react.dev/reference/react/lazy)
- [Vite code splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Web.dev: Code splitting](https://web.dev/code-splitting/)
- [Bundle analyzer plugin](https://github.com/btd/rollup-plugin-visualizer)

---

**Status**: Ready to implement
**Next step**: Start with Step 1 (bundle analysis) in a new session
