# CSS Optimization Phase 2 - Roadmap (Future Work)

**Status**: Scheduled for future sprint
**Prerequisite**: Phase 1 merged (PR #XX)
**Estimated Effort**: 5-6 hours
**Expected Result**: 668KB → 400KB (~40% total reduction)

---

## Context

Phase 1 achieved **668KB** built CSS (down from 773KB, -14%).
Phase 2 aims for **400KB** through architectural changes (lazy loading, code splitting).

Current breakdown:
- MyCompany.css: 214KB (32%)
- index.css: 199KB (30%)
- ChatInterface.css: 150KB (22%)
- Other: 105KB (16%)

---

## Task 1: Lazy-Load MyCompany Tab CSS (-100KB)

**Problem**: All MyCompany tab CSS loads when route opens, even if user never visits certain tabs.

**Solution**: Split tab CSS into lazy-loaded chunks.

### Implementation Steps

1. **Update Vite config** (`frontend/vite.config.ts`):

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split MyCompany tabs
          if (id.includes('/tabs/usage/')) return 'usage-tab';
          if (id.includes('/tabs/llm-hub/')) return 'llm-hub-tab';
          if (id.includes('/tabs/projects/')) return 'projects-tab';
          if (id.includes('/tabs/decisions/')) return 'decisions-tab';
          if (id.includes('/tabs/team/')) return 'team-tab';
          if (id.includes('/tabs/playbooks/')) return 'playbooks-tab';
          if (id.includes('/tabs/activity/')) return 'activity-tab';
          if (id.includes('/tabs/overview/')) return 'overview-tab';

          // Keep existing vendor chunks
          if (id.includes('node_modules')) {
            // ... existing vendor splitting
          }
        }
      }
    }
  }
});
```

2. **Verify tab components are already lazy-loaded** (likely already done):

```typescript
// In MyCompany.tsx
const UsageTab = lazy(() => import('./tabs/UsageTab'));
const LLMHubTab = lazy(() => import('./tabs/LLMHubTab'));
const ProjectsTab = lazy(() => import('./tabs/ProjectsTab'));
// etc.
```

3. **Test each tab** to ensure CSS loads correctly when clicked.

### Expected Results

- Initial MyCompany load: ~114KB (down from 214KB)
- Each tab loads its own CSS on-demand:
  - Usage tab: +30KB
  - LLM Hub: +25KB
  - Projects: +20KB
  - Decisions: +15KB
  - Other tabs: +10KB combined

**Savings**: -100KB initial load

**Time**: 2 hours (config + testing)

---

## Task 2: Split Deliberation Stage CSS (-69KB)

**Problem**: All Stage1, Stage2, Stage3 CSS loads with ChatInterface route.

**Solution**: Lazy-load stages as user progresses through deliberation.

### Implementation Steps

1. **Update imports in ChatInterface.tsx**:

```typescript
// Before
import Stage1 from './stage1/Stage1';
import Stage2 from './stage2/Stage2';
import Stage3 from './stage3/Stage3';

// After
const Stage1 = lazy(() => import('./stage1/Stage1'));
const Stage2 = lazy(() => import('./stage2/Stage2'));
const Stage3 = lazy(() => import('./stage3/Stage3'));
```

2. **Wrap stage components in Suspense**:

```typescript
<Suspense fallback={<CouncilLoader message="Loading stage..." />}>
  {stage === 1 && <Stage1 />}
  {stage === 2 && <Stage2 />}
  {stage === 3 && <Stage3 />}
</Suspense>
```

3. **Verify Vite splits the CSS** (should happen automatically).

4. **Test deliberation flow** to ensure smooth transitions.

### Expected Results

- Initial ChatInterface load: ~81KB (down from 150KB)
- Stage 1 loads: +25KB
- Stage 2 loads: +22KB
- Stage 3 loads: +22KB

**Savings**: -69KB initial load

**Time**: 1 hour (implementation + testing)

---

## Task 3: Optimize Dark Mode Duplication (-50KB)

**Problem**: Every color token defined twice (`:root` and `.dark`).

**Solution**: Use `@media (prefers-color-scheme: dark)` for base theme, keep `.dark` for user toggle.

### Implementation Steps

1. **Update `frontend/src/styles/tailwind.css`**:

```css
/* Light mode (default) */
:root {
  --color-bg-primary: #fff;
  --color-text-primary: #333;
  /* ... */
}

/* Auto dark mode (respects OS preference) */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --color-bg-primary: #0f172a;
    --color-text-primary: #f8fafc;
    /* ... */
  }
}

/* User override (manual toggle) */
html.dark {
  --color-bg-primary: #0f172a;
  --color-text-primary: #f8fafc;
  /* ... */
}
```

2. **Add `.light` class support** to ThemeToggle component:

```typescript
// In ThemeToggle.tsx
const setTheme = (theme: 'light' | 'dark' | 'system') => {
  if (theme === 'system') {
    document.documentElement.classList.remove('light', 'dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }
};
```

3. **Test all three modes**:
   - System (auto-detects OS preference)
   - Light (forced light mode)
   - Dark (forced dark mode)

### Expected Results

- Reduces duplication of ~400 color tokens
- Dark mode still works (user toggle preserved)
- Auto dark mode for users who prefer it

**Savings**: -50KB

**Time**: 1 hour (refactor + testing)

---

## Task 4: Tiered Token Loading (-50KB initial load)

**Problem**: All 913 design tokens load upfront, even if user never visits certain features.

**Solution**: Split tokens into critical/enhanced/advanced tiers.

### Implementation Steps

1. **Create `frontend/src/styles/critical-tokens.css`** (50KB):

```css
/* Load immediately - core app needs these */
:root {
  /* Spacing */
  --space-0, --space-1, --space-2, --space-3, --space-4, --space-6, --space-8;

  /* Core colors */
  --color-bg-primary, --color-bg-secondary, --color-text-primary, --color-text-secondary;
  --color-brand-primary, --color-success, --color-warning, --color-error;

  /* Typography */
  --font-sans, --font-mono, --text-sm, --text-base, --text-lg;

  /* Common overlays */
  --overlay-black-10, --overlay-black-20, --overlay-white-10, --overlay-white-20;

  /* Shadows, radius */
  --shadow-sm, --shadow-md, --radius-default, --radius-lg;
}
```

2. **Create `frontend/src/styles/enhanced-tokens.css`** (100KB):

```css
/* Load with MyCompany route */
:root {
  /* Department colors, KB colors, stage colors */
  /* Advanced overlays, extended color palette */
  /* Activity feed tokens, usage chart tokens */
}
```

3. **Update imports**:

```typescript
// In main.tsx (always loaded)
import './styles/critical-tokens.css';
import './styles/tailwind.css'; // Base Tailwind

// In MyCompany.tsx (lazy loaded)
import './styles/enhanced-tokens.css';
```

4. **Audit token usage** to ensure correct splitting:

```bash
# Find which tokens are used in landing/chat vs MyCompany
grep -r "var(--color-" src/components/ChatInterface --include="*.css" | sort -u
grep -r "var(--color-" src/components/mycompany --include="*.css" | sort -u
```

### Expected Results

- Initial load: 50KB tokens (critical only)
- MyCompany route: +100KB tokens (enhanced)
- **Total unchanged**, but better UX (faster initial load)

**Savings**: -50KB initial page load

**Time**: 1.5 hours (splitting + testing)

---

## Phase 2 Summary

| Task | Savings | Effort | Priority |
|------|---------|--------|----------|
| **1. Lazy-load MyCompany tabs** | -100KB | 2 hrs | High |
| **2. Split deliberation stages** | -69KB | 1 hr | High |
| **3. Optimize dark mode** | -50KB | 1 hr | Medium |
| **4. Tiered token loading** | -50KB initial | 1.5 hrs | Low |
| **TOTAL** | **-269KB** | **5.5 hrs** | |

**Result**: 668KB → **399KB** (~40% total reduction)

---

## Testing Checklist (Phase 2)

After each task:

- [ ] Build: `npm run build`
- [ ] Measure: `du -ch dist/assets/css/*.css | tail -1`
- [ ] Visual test: `npm run preview` → Check affected routes
- [ ] Dark mode: Toggle theme → Verify styles load
- [ ] Mobile: Test responsive layouts
- [ ] Network tab: Verify CSS chunks load on-demand
- [ ] Lighthouse: Check CSS performance score

---

## Success Criteria

- [ ] Built CSS bundle <450KB total
- [ ] Initial page load CSS <150KB
- [ ] All routes render correctly
- [ ] Dark mode toggle still works
- [ ] No layout shifts or missing styles
- [ ] CI performance budget passes
- [ ] Lazy-loaded chunks appear in Network tab

---

## Rollback Plan

If anything breaks:

```bash
git revert <commit-hash>
npm run build
```

Each task should be committed separately for easy rollback.

---

## Notes for Future Claude Code Session

When starting Phase 2:

1. Read this file first (`todo/CSS-PHASE2-ROADMAP.md`)
2. Start with Task 1 (lazy-load tabs) - biggest impact, lowest risk
3. Commit each task separately
4. Test thoroughly between tasks
5. Update this file with actual results vs estimates

**Branch name suggestion**: `claude/css-phase2-lazy-loading-XXXXX`

---

## Questions for User (Before Starting Phase 2)

1. Is 400KB target critical, or is 668KB acceptable?
2. What's the priority: initial load speed vs total bundle size?
3. Should we implement all 4 tasks, or just Tasks 1-2 (high priority)?
4. Any specific features that should NOT be lazy-loaded?

---

**Phase 1 Results**: 773KB → 668KB (-105KB, -14%)
**Phase 2 Target**: 668KB → 400KB (-268KB, -40%)
**Combined**: 773KB → 400KB (-373KB, -48% total) 🎯
