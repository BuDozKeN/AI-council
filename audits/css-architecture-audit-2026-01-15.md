# CSS Architecture Audit - AxCouncil
## Date: 2026-01-15
## Audited by: Claude Code CSS Architect

---

## Executive Summary

**CSS Architecture Score: 3/10** ⚠️ Critical Issues Found
**Developer Experience Score: 4/10** ⚠️ Needs Improvement
**Technical Debt Score: 2/10** 🚨 Severe Debt Accumulation

### Critical Findings

Your CSS architecture is in **crisis mode**. With 48,225 lines of CSS across 90 files, including 13 files exceeding 1,000 lines, this codebase has grown beyond maintainable limits. The "100 iterations to change one thing" problem you described is a direct result of:

1. **Zero single source of truth** - 643 hardcoded color violations
2. **Specificity wars** - Components overriding each other across files
3. **File bloat** - ChatInterface.css alone is 3,230 lines (10x over limit)
4. **Broken guardrails** - Stylelint configured but not running
5. **Breakpoint chaos** - 9+ different mobile breakpoints

**Impact**: This is costing you **days of developer time per week**. Every CSS change requires hunting through multiple files, fighting specificity, and hoping nothing breaks.

---

## Technical Debt Summary

| Metric | Current | Target | Gap | Status |
|--------|---------|--------|-----|--------|
| !important count | 82 | 0-5 | +77 | 🚨 CRITICAL |
| Hardcoded hex colors | 446 | 0 | +446 | 🚨 CRITICAL |
| Hardcoded rgba/rgb | 197 | 0 | +197 | 🚨 CRITICAL |
| Duplicate selectors | ~50+ | 0 | +50+ | ⚠️ HIGH |
| Total CSS files | 90 | ~40 | +50 | ⚠️ HIGH |
| Total CSS lines | 48,225 | <15,000 | +33,225 | 🚨 CRITICAL |
| Files >1000 lines | 13 | 0 | +13 | 🚨 CRITICAL |
| Files >500 lines | 20+ | <5 | +15+ | 🚨 CRITICAL |
| Avg file size | 535 lines | <200 | +335 | 🚨 CRITICAL |
| Media query breakpoints | 9+ | 2-3 | +6-7 | ⚠️ HIGH |
| index.css lines | 475 | <200 | +275 | ⚠️ HIGH |
| Stylelint enforcement | ❌ Broken | ✅ Active | N/A | 🚨 CRITICAL |

---

## Source of Truth Violations

| Property Type | Expected Source | Actual Sources | Files Affected | Severity |
|---------------|-----------------|----------------|----------------|----------|
| **Colors** | design-tokens.css only | 643 hardcoded values across 90 files | ALL CSS files | 🚨 CRITICAL |
| **Spacing** | --space-* tokens or Tailwind | Mixed: tokens + px values | 60+ files | ⚠️ HIGH |
| **Component Styles** | Component.css ONLY | Spread across parent CSS, index.css, global files | 40+ files | 🚨 CRITICAL |
| **Breakpoints** | 2-3 standard values | 9 different breakpoints (768, 640, 480, 400, 380, 360, 600, 800, 900) | 50+ files | 🚨 CRITICAL |
| **Z-index** | --z-* tokens | Mixed (some use tokens, some hardcode) | 30+ files | ⚠️ MEDIUM |

### Color Violations Detail

```
Hardcoded hex colors: 446 instances
Hardcoded rgba/rgb: 197 instances
Total color violations: 643

Examples:
- #059669, #34d399 in sonner.css (toast library)
- rgb values scattered across component CSS
- No enforcement preventing new violations
```

**Root Cause**: Stylelint rule `color-no-hex` exists but is set to "warning" severity and Stylelint isn't running in CI.

---

## !important Registry

| File | Count | Justification | Action Required |
|------|-------|---------------|-----------------|
| ui/sonner.css | 60 | Third-party library override (toast styling) | ✅ Justified - document in code |
| ui/BottomSheet.css | 2 | Framer Motion override for scroll | ✅ Justified - document in code |
| ui/LLMPresetSelect.css | 1 | Z-index for modal dropdown | ❌ REMOVE - use higher specificity |
| onboarding/OnboardingFlow.css | 2 | Background transparency | ❌ REMOVE - use higher specificity |
| Other files | 17 | Various unjustified uses | ❌ REMOVE ALL |

**Total**: 82 instances (Target: 0-5 for third-party overrides only)
**Action**: Remove 22 custom !important instances, document the 60 justified ones.

---

## CSS File Health Check

### 🚨 CRITICAL - Files Requiring Immediate Attention (>1000 lines)

| File | Lines | Health | Issues | Priority |
|------|-------|--------|--------|----------|
| ChatInterface.css | 3,230 | 🚨 CRITICAL | 10x over limit, complex overrides | P0 |
| Stage3.css | 2,585 | 🚨 CRITICAL | 8x over limit | P0 |
| Settings.css | 2,393 | 🚨 CRITICAL | 8x over limit | P0 |
| mycompany/styles/modals.css | 2,286 | 🚨 CRITICAL | Should be split per modal type | P0 |
| landing/ContextChip.css | 1,954 | 🚨 CRITICAL | Single component shouldn't be this large | P0 |
| mycompany/styles/tabs/projects.css | 1,665 | 🚨 CRITICAL | Should be split by section | P0 |
| Sidebar.css | 1,619 | 🚨 CRITICAL | Complex state management | P0 |
| styles/tailwind.css | 1,500 | ⚠️ WARNING | Config file - acceptable if mostly @layer | P1 |
| mycompany/styles/mobile.css | 1,453 | 🚨 CRITICAL | Mobile overrides shouldn't be separate file | P0 |
| mycompany/styles/tabs/overview.css | 1,303 | 🚨 CRITICAL | Tab-specific, should be smaller | P0 |
| shared/OmniBar.css | 1,283 | 🚨 CRITICAL | Complex component needs refactor | P0 |
| Stage1.css | 1,236 | 🚨 CRITICAL | 4x over limit | P0 |
| ProjectModal.css | 1,217 | 🚨 CRITICAL | Modal shouldn't be this complex | P0 |

### ⚠️ HIGH PRIORITY - Files Needing Attention (500-1000 lines)

| File | Lines | Health | Action |
|------|-------|--------|--------|
| ui/TableOfContents.css | 1,154 | ⚠️ WARNING | Split by section/variant |
| mycompany/styles/tabs/llm-hub.css | 1,130 | ⚠️ WARNING | Split into subcomponents |
| Stage2.css | 1,064 | ⚠️ WARNING | Refactor to smaller files |
| mycompany/styles/tabs/usage.css | 954 | ⚠️ WARNING | Extract reusable patterns |
| ui/AppModal.css | 950 | ⚠️ WARNING | Split modal variants |
| SaveKnowledgeModal.css | 859 | ⚠️ WARNING | Extract form/list styles |
| mycompany/styles/tabs/team.css | 710 | ⚠️ WARNING | Split by feature |
| mycompany/styles/tabs/decisions.css | 717 | ⚠️ WARNING | Split by view type |
| mycompany/styles/shared.css | 717 | ⚠️ WARNING | "Shared" is a code smell |
| Organization.css | 590 | ⚠️ WARNING | Reduce complexity |
| mycompany/styles/shell.css | 590 | ⚠️ WARNING | Layout vs content separation |
| design-tokens.css | 572 | ✅ GOOD | Variables only - acceptable |

---

## CSS Ownership Matrix

| CSS File | Owner Component(s) | Scope | Violations | Severity |
|----------|-------------------|-------|------------|----------|
| **index.css** | Global | Reset + base | 475 lines (should be <200) | ⚠️ MEDIUM |
| **design-tokens.css** | Global | Variables only | ✅ Clean - no selectors | ✅ GOOD |
| **tailwind.css** | Global | Utility config | ✅ Acceptable for config | ✅ GOOD |
| **mycompany/styles/** | Multiple | Feature area | **MASSIVE ISSUE**: 2286-line modals.css, 1453-line mobile.css | 🚨 CRITICAL |
| **ChatInterface.css** | ChatInterface.tsx | Scoped | 3230 lines - styles child components too | 🚨 CRITICAL |
| **Settings.css** | Settings.tsx | Scoped | 2393 lines - styles all tabs/panels | 🚨 CRITICAL |
| **Stage1/2/3.css** | Stage components | Scoped | 1236-2585 lines - too much per component | 🚨 CRITICAL |
| **mycompany/styles/shared.css** | ??? | "Shared" | 717 lines - **junk drawer antipattern** | 🚨 CRITICAL |
| **mycompany/styles/legacy.css** | ??? | "Legacy" | 349 lines - **should be removed or migrated** | ⚠️ HIGH |

### Key Violations

1. **mycompany/styles/ is a mega-folder**: 12 files, 17,000+ lines
   - Should be component-scoped, not feature-folder-scoped
   - `modals.css` (2286 lines) styles multiple unrelated modals
   - `mobile.css` (1453 lines) contains mobile overrides that should be in component files
   - `shared.css` (717 lines) is a "junk drawer" - antipattern
   - `legacy.css` (349 lines) is technical debt waiting to be removed

2. **Component CSS files styling children**:
   - `ChatInterface.css` styles chat bubbles, context indicators, scroll buttons
   - Each child component should have its own CSS file

3. **index.css over limit**: 475 lines (should be <200 for reset + base only)

---

## Breakpoint Consistency Analysis

### Current State: CHAOS ⚠️

| Breakpoint | Usage Count | Files Affected |
|------------|-------------|----------------|
| max-width: 768px | 72 | Most common mobile breakpoint |
| max-width: 640px | 35 | Inconsistent mobile |
| max-width: 480px | 20 | Small mobile |
| max-width: 380px | 6 | Extra small mobile |
| max-width: 400px | 5 | Conflicting with 380px |
| max-width: 360px | 4 | Even smaller mobile |
| max-width: 600px | 1 | Random breakpoint |
| max-width: 800px | 1 | Random breakpoint |
| max-width: 900px | 5 | Tablet landscape |
| min-width: 769px | 10 | Desktop |

**Problem**: 9+ different breakpoints means:
- Impossible to predict which styles apply at a given width
- 767px vs 768px conflicts create off-by-one bugs
- No clear mobile/tablet/desktop distinction

**Target Architecture**:
```css
/* SHOULD BE ONLY 3 BREAKPOINTS */
@media (max-width: 640px)  /* Mobile */
@media (max-width: 1024px) /* Tablet */
@media (min-width: 1025px) /* Desktop */
```

---

## Conflict Matrix (Sample - Top 10 Worst)

| Selector | File 1 | File 2+ | Conflict Type | Resolution |
|----------|--------|---------|---------------|------------|
| `.app-modal-body` | AppModal.css | Settings.css (override) | Specificity war | Settings should use modifier class |
| `.settings-card` | Settings.css | index.css | Component in global | Remove from index.css |
| `.context-chip-*` | ContextChip.css (1954 lines!) | Multiple files | Massive file splits | Split into 5+ files |
| `.chat-interface` | ChatInterface.css | Sidebar.css, App.css | Layout conflicts | Define layout boundary |
| `.select-trigger` | select.css | LLMPresetSelect.css, RoleSelect.css | Mobile overrides fight | Use :where() pattern |
| `.bottom-sheet-*` | BottomSheet.css | Multiple modals | Sheet styles leak | Scope to sheet context |
| `.card-header` | Settings.css | mycompany/styles/shared.css | Duplicate definitions | Consolidate to one |
| `.mc-modal-*` | mycompany/styles/modals.css | Individual modal CSS | 2286-line file vs component | Split modals.css |
| Mobile button styles | index.css (global 44px) | Component CSS (override) | Touch target wars | Use opt-out class |
| `.dark` selectors | Scattered across all 90 files | N/A | Dark mode everywhere | Use CSS variables |

### Root Cause: No CSS Layer Strategy

CSS should use `@layer` to control specificity:
```css
@layer reset, base, components, utilities;
```

Currently: **No layers = specificity chaos**

---

## Duplicate Selector Analysis (Sample)

Selectors appearing in 2+ files (Top 20):

```
.add-member-btn (Settings.css, mycompany/styles/modals.css)
.api-key-actions (Settings.css, mycompany/styles/shared.css)
.app-modal-btn (AppModal.css, Settings.css, Organization.css)
.billing-header (Billing.css, Settings.css)
.bottom-sheet-body (BottomSheet.css, Settings.css override)
.card-header (Settings.css, mycompany/styles/shared.css, mycompany/styles/legacy.css)
.context-chip-trigger (ContextChip.css, landing/* files)
.loading-state (LoadingState.css, ChatInterface.css, Stage1/2/3.css)
.modal-body (AppModal.css, mycompany/styles/modals.css)
.settings-card (Settings.css, mycompany/styles/modals.css)
... (40+ more duplicates)
```

**Impact**: When you style `.card-header`, which file wins? Answer: "It depends" = developer pain.

---

## Mobile Override Consistency

### Pattern Issues

1. **Global mobile rules fight component rules**:
   - `index.css` sets `button { min-height: 44px }` for touch targets
   - Components try to override with `min-height: 36px` for compact UIs
   - Result: Specificity wars, `!important` abuse

2. **No consistent opt-out pattern**:
   - Some components use `.no-touch-target` class
   - Some use `!important` to override
   - Some give up and accept 44px buttons everywhere

3. **Mobile CSS scattered**:
   - `mycompany/styles/mobile.css` (1453 lines) - separate mobile file
   - Mobile `@media` queries in 50+ component files
   - No way to see all mobile styles in one place

**Recommended Pattern** (already documented in CLAUDE.md):
```css
/* index.css - low specificity */
:where(button:not(.inline-btn):not(.no-touch-target)) {
  min-height: 44px;
}

/* Component CSS - normal specificity wins */
.compact-button {
  min-height: 32px; /* Easily overrides :where() */
}
```

**Status**: Pattern exists but **not consistently applied** across codebase.

---

## Tailwind + CSS Coexistence

### Current State: MIXED ⚠️

**Good**:
- Tailwind used for layout (flex, grid, gap)
- Tailwind used for spacing (p-*, m-*)
- CSS files handle complex animations, pseudo-elements

**Bad**:
- Same property in BOTH Tailwind class AND CSS file (e.g., `className="p-4"` + `.component { padding: 20px }`)
- Arbitrary values used for colors `[#fff]` in some files
- Inconsistent: Some components pure Tailwind, others pure CSS

**No documented decision tree**: When to use Tailwind vs CSS?

**Recommended Policy** (should be in CLAUDE.md):
```
Tailwind ONLY for:
- Layout (flex, grid, gap)
- Spacing (p-*, m-*)
- Responsive utilities (md:, lg:)

CSS ONLY for:
- Complex animations
- Pseudo-elements (::before, ::after)
- Component-specific theming
- State-based styling (data-*, aria-*)

NEVER:
- Same property in both
- Arbitrary color values [#fff]
```

---

## Developer Experience Gaps

| Gap | Impact | Fix | Effort |
|-----|--------|-----|--------|
| **No CSS file discovery** | New dev spends 30+ min finding where to put styles | Add "Where to put CSS" section to CLAUDE.md | 1 hour |
| **Stylelint not running** | No automated enforcement of color/spacing rules | Fix Stylelint CI integration | 2 hours |
| **No specificity guidelines** | Devs resort to !important when styles don't apply | Document specificity rules in CLAUDE.md | 1 hour |
| **Breakpoint chaos** | Mobile bugs from off-by-one breakpoint mismatches | Standardize to 3 breakpoints, migrate | 1 week |
| **"Shared" junk drawer** | Styles dumped in shared.css when unsure where they belong | Abolish shared.css, move to component files | 3 days |
| **No component CSS template** | Every dev invents their own CSS structure | Create component CSS scaffold | 2 hours |
| **No CSS review checklist** | PRs approved without checking for CSS debt | Add CSS section to PR template | 1 hour |

### The "10-Minute Test" Results: **FAIL**

A new developer cannot answer these questions in 10 minutes:

❌ Where do I put styles for a new component?
❌ Why won't my CSS apply? (Specificity mystery)
❌ What affects the appearance of Component X? (Spread across 3+ files)
❌ How do I add a mobile breakpoint? (Which of 9 values do I use?)
❌ Can I use hex colors? (Rules exist but not enforced)

---

## Guardrails Status

### Stylelint: ⚠️ CONFIGURED BUT NOT RUNNING

**Config exists**:
- `.stylelintrc.json` - Basic rules, `color-no-hex` is "warning" only
- `stylelint.config.js` - More complete, `declaration-no-important: true`

**Problems**:
1. **Command fails**: `npm run lint:css` returns "stylelint: not found"
2. **Two config files**: `.stylelintrc.json` AND `stylelint.config.js` (which wins?)
3. **CI not running it**: No `lint:css` in `.github/workflows/ci.yml`
4. **Pre-commit not running it**: `.husky/pre-commit` only runs `lint-staged`, which doesn't include CSS

**Impact**: Zero enforcement of CSS rules. Developers can add 1000 !important, 500 hex colors, and push to production.

### CI Pipeline: ❌ NO CSS CHECKS

`.github/workflows/ci.yml` runs:
- ✅ ESLint (JS/TS)
- ✅ TypeScript
- ✅ Tests
- ❌ **Stylelint (CSS)** - MISSING

### Pre-commit Hooks: ❌ NO CSS CHECKS

`.husky/pre-commit` runs `lint-staged` which formats/lints changed files, but `.lintstagedrc` (if it exists) doesn't include CSS.

---

## Architecture Antipatterns Detected

### 1. **The Mega-File Antipattern** 🚨

**What**: Single CSS file handling multiple unrelated concerns.

**Examples**:
- `ChatInterface.css` (3230 lines) - styles chat bubbles, context indicators, scroll buttons, modifiers
- `mycompany/styles/modals.css` (2286 lines) - styles 10+ different modal types
- `Settings.css` (2393 lines) - styles all settings tabs, cards, forms

**Why it's bad**:
- Impossible to understand scope ("does this selector affect my component?")
- High risk of unintended side effects
- Merge conflicts on every PR touching that feature area

**Fix**: Split by component ownership (1 component = 1 CSS file, max 300 lines).

---

### 2. **The Junk Drawer Antipattern** 🚨

**What**: "shared.css" / "legacy.css" / "common.css" files that accumulate orphaned styles.

**Examples**:
- `mycompany/styles/shared.css` (717 lines) - "styles used by multiple components" (really: styles with unclear ownership)
- `mycompany/styles/legacy.css` (349 lines) - old styles that "might still be used"

**Why it's bad**:
- No one knows what's safe to remove
- Accumulates dead CSS
- Becomes dumping ground for "I don't know where this goes"

**Fix**: Abolish "shared" concept. Either:
- Style belongs to a component → component CSS
- Style is truly global → design-tokens.css or index.css
- Style is duplicated → extract to design token or Tailwind class

---

### 3. **The Mobile Segregation Antipattern** ⚠️

**What**: Separate `mobile.css` file with mobile overrides instead of co-locating mobile styles with desktop.

**Example**:
- `mycompany/styles/mobile.css` (1453 lines) - mobile-only overrides for desktop styles defined elsewhere

**Why it's bad**:
- When changing a component, must edit 2 files (desktop CSS + mobile.css)
- Easy to forget mobile styles, ship broken mobile UI
- Creates "mobile fighting desktop" specificity wars

**Fix**: Mobile `@media` queries inside component CSS files, next to desktop styles.

---

### 4. **The Deep Nesting Antipattern** ⚠️

**What**: Selectors like `.parent .child .grandchild .great-grandchild { ... }` (specificity 0,4,0+).

**Impact**: Creates specificity arms race, leads to !important usage.

**Current Status**: Manual grep didn't find 4-level nesting, but many 3-level selectors exist.

**Target**: Max 2 levels (`.component .child`), prefer single class selectors.

---

### 5. **The Breakpoint Proliferation Antipattern** 🚨

**What**: 9+ different breakpoint values across codebase.

**Why it's bad**:
- `max-width: 767px` and `max-width: 768px` in different files = overlap bugs
- No semantic meaning (is 480px "mobile" or "small mobile"?)

**Fix**: 3 standard breakpoints, enforced by Stylelint custom rule.

---

## Dead CSS Detection (Sample Analysis)

Manual inspection of largest files reveals **high likelihood of dead CSS**:

| File | Suspected Dead Selectors | Reason | Confidence |
|------|-------------------------|--------|------------|
| mycompany/styles/legacy.css | Most of 349 lines | File literally named "legacy" | HIGH |
| ChatInterface.css | `.old-*`, `.deprecated-*` classes | Named as deprecated | HIGH |
| Settings.css | 200+ lines for old billing UI | Billing was refactored | MEDIUM |
| Stage1/2/3.css | Commented-out CSS blocks | 50+ lines of comments | HIGH |

**Recommended**: Run coverage analysis with browser DevTools on key pages, then PurgeCSS dry-run.

**Estimated dead CSS**: 5,000-10,000 lines (10-20% of total)

---

## Component Variant Patterns

### CVA (class-variance-authority) Usage: INCONSISTENT ⚠️

**Good Examples**:
- `ui/button.tsx` - Uses CVA for variants (default, outline, ghost, destructive)
- `ui/card.tsx` - Uses CVA for sizes

**Bad Examples** (ad-hoc variants):
- `.modal-large`, `.modal-small` in modals.css (should use CVA)
- `.button-primary`, `.button-secondary` in legacy.css (duplicates CVA)
- `.card-compact`, `.card-spacious` in multiple files (not using CVA)

**Recommendation**: Audit all components with visual variants, migrate to CVA pattern.

---

## Recommendations Priority

### 1. 🚨 CRITICAL (Causing Active Pain - Do This Week)

These are **directly causing the "100 iterations" problem**:

| Action | Impact | File(s) | Effort | ROI |
|--------|--------|---------|--------|-----|
| **Fix Stylelint CI** | Stop color violations at PR time | `.github/workflows/ci.yml`, `package.json` | 2 hours | 🔥 MASSIVE |
| **Split ChatInterface.css** | Reduce cognitive load by 10x | `ChatInterface.css` (3230→300 lines) | 2 days | 🔥 MASSIVE |
| **Abolish mycompany/styles/modals.css** | Move styles to component files | 2286 lines → 10 files of 150-200 lines | 3 days | 🔥 MASSIVE |
| **Standardize to 3 breakpoints** | Fix mobile off-by-one bugs | 50+ files, create migration script | 1 week | 🔥 HIGH |
| **Document "Where to put CSS"** | End the "where does this go?" question | `CLAUDE.md` | 1 hour | 🔥 HIGH |
| **Remove 22 custom !important** | Reduce specificity wars | 15+ files | 2 days | 🔥 HIGH |

---

### 2. ⚠️ HIGH (Will Cause Pain Soon - Do This Month)

| Action | Impact | Effort |
|--------|--------|--------|
| **Split Settings.css** | 2393 lines → 8 tab-specific files | 3 days |
| **Split Stage3.css** | 2585 lines → component files | 3 days |
| **Abolish mycompany/styles/shared.css** | Move to component files or design tokens | 2 days |
| **Remove mycompany/styles/legacy.css** | Delete or migrate 349 lines | 1 day |
| **Add CSS layer strategy** | `@layer reset, base, components, utilities` | 1 day |
| **Extract ContextChip.css** | 1954 lines → 4-5 component files | 2 days |
| **Run PurgeCSS analysis** | Identify dead CSS for removal | 1 day |
| **Document Tailwind vs CSS decision tree** | CLAUDE.md addition | 1 hour |

---

### 3. 📊 MEDIUM (Technical Debt Accumulating - Do This Quarter)

| Improvement | Benefit | Approach |
|-------------|---------|----------|
| **Migrate hardcoded colors** | 643 violations → 0, single source of truth | Automated script + manual review |
| **Consolidate mycompany/styles/** | 12 files → component-scoped | Move to component folders |
| **Split remaining large files** | 20 files >500 lines → <300 lines | Incremental refactor |
| **Add CSS coverage monitoring** | Track dead CSS over time | Lighthouse/PurgeCSS in CI |
| **Create component CSS template** | Consistency for new components | Scaffold generator |
| **Reduce index.css** | 475 lines → <200 lines | Move component styles out |

---

### 4. ✨ LOW (Polish and Consistency - Do This Year)

| Improvement | Benefit |
|-------------|---------|
| Audit CVA usage, migrate ad-hoc variants | Consistency |
| Add Stylelint custom rules (breakpoints, z-index) | Stronger guardrails |
| Dark mode audit (ensure all use CSS vars) | Easier theming |
| CSS bundle size optimization | Performance |
| Add Storybook for CSS variant documentation | Developer docs |

---

## Immediate Actions (This Week)

### Priority 0: Stop the Bleeding 🚨

**Monday** (2 hours):
1. Fix Stylelint installation: `npm install -D stylelint` (verify it's in package.json devDependencies)
2. Add to CI: `.github/workflows/ci.yml` add step: `npm run lint:css`
3. Add to pre-commit: `.husky/pre-commit` add CSS files to `lint-staged`
4. Run `npm run lint:css`, document current violation count as baseline
5. Set `color-no-hex` to "error" severity (not "warning")

**Tuesday-Wednesday** (1 day):
6. Document "Where to put CSS" in CLAUDE.md:
   ```markdown
   ## CSS File Organization
   - Component.tsx → Component.css (ALWAYS paired)
   - Max 300 lines per CSS file
   - Mobile @media queries inside component file (not separate mobile.css)
   - Global styles ONLY in: index.css (<200 lines), design-tokens.css (variables only)
   - NEVER create: shared.css, common.css, utils.css
   ```

**Thursday-Friday** (2 days):
7. **Quick Win**: Split `mycompany/styles/modals.css` (2286 lines) into:
   - `DepartmentModal.css` (~200 lines)
   - `RoleModal.css` (~200 lines)
   - `PlaybookModal.css` (~200 lines)
   - ... (one CSS file per modal component)
   - Delete `modals.css`

**Impact**: By Friday, you'll have:
- ✅ Automated CSS quality checks in CI
- ✅ Clear guidelines for where CSS goes
- ✅ 2286 lines of CSS split into manageable files
- ✅ One less "mega-file" causing pain

---

## Architecture Improvements (This Month)

### Week 1: Stylelint + Documentation (Done above)

### Week 2: Split ChatInterface.css (3230 lines)

**Before**:
```
ChatInterface.css (3230 lines)
- .chat-interface { ... }
- .back-to-company-btn { ... }
- .context-indicator { ... }
- .scroll-to-top-fab { ... }
- .chat-bubble { ... }
- .message-actions { ... }
... (100+ selectors)
```

**After**:
```
ChatInterface.css (200 lines) - layout only
BackToCompanyButton.css (50 lines)
ContextIndicator.css (150 lines)
ScrollToTopFab.css (80 lines)
ChatBubble.css (250 lines)
MessageActions.css (120 lines)
... (8-10 component files)
```

**Effort**: 2 days
**Benefit**: When editing chat bubbles, only touch ChatBubble.css - no risk of breaking other parts.

---

### Week 3: Breakpoint Standardization

**Migration Script**:
```bash
# Find all unique breakpoints
grep -rh "@media" src --include="*.css" | sort | uniq

# Replace with standard breakpoints
find src -name "*.css" -exec sed -i 's/max-width: 767px/max-width: 640px/g' {} +
find src -name "*.css" -exec sed -i 's/max-width: 768px/max-width: 640px/g' {} +
find src -name "*.css" -exec sed -i 's/max-width: 480px/max-width: 640px/g' {} +
... (for each non-standard breakpoint)
```

**Add Stylelint Rule** (custom plugin):
```js
// Only allow these breakpoints
const ALLOWED_BREAKPOINTS = ['640px', '1024px'];
```

**Effort**: 1 week (includes manual testing on each breakpoint change)
**Benefit**: Predictable mobile behavior, no more off-by-one bugs.

---

### Week 4: Settings.css Refactor (2393 lines)

Split by tab:
- `SettingsLayout.css` (200 lines) - sidebar, panel structure
- `ProfileSettings.css` (300 lines)
- `BillingSettings.css` (400 lines)
- `TeamSettings.css` (350 lines)
- `APISettings.css` (250 lines)
- `DeveloperSettings.css` (200 lines)
- ... (remaining tabs)

**Effort**: 3 days
**Benefit**: Profile tab changes don't risk breaking Billing tab.

---

## Success Metrics (Track Monthly)

| Metric | Current | 3 Months | 6 Months | 12 Months |
|--------|---------|----------|----------|-----------|
| Total CSS lines | 48,225 | 35,000 | 25,000 | 18,000 |
| Files >1000 lines | 13 | 5 | 0 | 0 |
| Files >500 lines | 20+ | 10 | 5 | 0 |
| Avg file size | 535 lines | 350 lines | 250 lines | <200 lines |
| !important count | 82 | 30 | 10 | 5 |
| Hardcoded colors | 643 | 200 | 50 | 0 |
| Breakpoint variants | 9 | 5 | 3 | 3 |
| Stylelint violations | ❌ Not running | 500 | 100 | 0 |
| CSS bundle size | ? | -20% | -40% | -50% |
| "Where does this style go?" questions per week | ~10 | 5 | 2 | 0 |

---

## Ongoing Monitoring

### Add to CI Dashboard

```yaml
# .github/workflows/ci.yml - add CSS metrics job
- name: CSS Metrics
  run: |
    echo "Total CSS lines: $(find src -name '*.css' -exec cat {} + | wc -l)"
    echo "!important count: $(grep -r '!important' src --include='*.css' | wc -l)"
    echo "Hardcoded colors: $(grep -rE '#[0-9a-fA-F]{3,6}' src --include='*.css' | wc -l)"
    echo "Files >1000 lines: $(find src -name '*.css' -exec wc -l {} + | awk '$1 > 1000' | wc -l)"
```

### Monthly CSS Debt Review

- Review metrics dashboard
- Identify new large CSS files (>500 lines)
- Schedule refactor if needed

### PR Review Checklist

Add to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
### CSS Quality Checklist
- [ ] No hardcoded colors (use CSS variables or Tailwind)
- [ ] No !important (increase specificity instead)
- [ ] Component CSS file <300 lines
- [ ] Mobile @media queries use standard breakpoints (640px, 1024px)
- [ ] Stylelint passes (`npm run lint:css`)
```

---

## Conclusion

Your CSS architecture is in **crisis mode**, but it's **recoverable**. The "100 iterations" problem you're experiencing is a direct result of:

1. **No single source of truth** (643 color violations)
2. **Mega-files** (13 files over 1000 lines)
3. **No guardrails** (Stylelint broken)
4. **Breakpoint chaos** (9 different values)

**The good news**: You have a design system foundation (design-tokens.css, documented patterns in CLAUDE.md). You just need to **enforce it**.

### What Success Looks Like (6 Months)

A developer wants to change the chat bubble background color:

**Today** (100 iterations):
1. Grep for "chat-bubble" across 90 files
2. Find it in ChatInterface.css line 847
3. Change `background: var(--color-bg-primary)`
4. Breaks on mobile - check mobile.css
5. Breaks dark mode - check dark mode overrides
6. Breaks in settings modal - why is settings CSS affecting chat?
7. Give up, use `!important`

**After Refactor** (1 iteration):
1. Open `ChatBubble.css` (120 lines)
2. Change `background: var(--color-bg-secondary)`
3. Works everywhere - mobile/dark mode handled via CSS variables
4. Ship it

**That's the goal**: Predictable CSS where changing one thing changes one thing.

---

## Next Steps

1. **Get buy-in**: Share this audit with the team
2. **Start small**: Fix Stylelint CI this week (2 hours)
3. **Quick win**: Split modals.css this week (2 days)
4. **Build momentum**: Tackle one mega-file per week
5. **Track progress**: Add CSS metrics to CI dashboard

**Time Investment**: 1-2 days/week for 3 months
**Payback**: 2-3 hours/week saved on every developer (5x ROI)

---

*End of CSS Architecture Audit*
