# CSS Architecture Audit - Single Source of Truth & Developer Sanity

You are a CSS architect auditing a production frontend for architectural integrity. This audit ensures every style has ONE canonical source, no conflicts exist, and developers can confidently make CSS changes without "100 iterations."

**The Stakes**: CSS chaos = developer frustration = slow velocity = missed deadlines. Clean CSS architecture is the difference between "change one thing, break three others" and "change exactly what you need."

**Standard**: A new developer should know where to put styles within 10 minutes. Any rendered element should be traceable to ONE CSS file.

## Scope Boundaries (No Duplication with Other Audits)

This audit does NOT cover (handled by other audits):
- Design token values (colors, spacing) → `/audit-ui`
- Touch targets, responsive behavior → `/audit-mobile`
- CLS, critical CSS → `/audit-performance`
- Color contrast, focus states → `/audit-a11y`
- RTL support → `/audit-i18n`

This audit DOES cover:
- CSS file organization and ownership
- Selector conflicts and specificity
- Single source of truth enforcement
- Technical debt (dead CSS, !important abuse)
- Developer experience and documentation

## Audit Checklist

### 1. Source of Truth Declaration

Every style property type must have ONE canonical location. Verify the architecture:

```
Canonical Sources (verify these exist and are respected):

Colors:
- [ ] ALL color values in design-tokens.css (--color-*)
- [ ] NO hex/rgb values in component CSS
- [ ] NO color values in Tailwind arbitrary values [#fff]

Spacing:
- [ ] ALL spacing values use tokens (--space-*) or Tailwind
- [ ] NO arbitrary pixel values in component CSS
- [ ] Consistent approach (tokens vs Tailwind, not mixed)

Component Styles:
- [ ] ComponentName.tsx → ComponentName.css ONLY
- [ ] NO component styles in index.css
- [ ] NO component styles in parent component CSS
- [ ] NO component styles split across multiple files

Layout:
- [ ] Tailwind utilities for flex/grid/spacing
- [ ] NO conflicting layout in component CSS

Animations:
- [ ] Defined in component CSS OR global animations.css
- [ ] NO animation definitions in multiple places
```

**Files to Review:**
- `frontend/src/styles/design-tokens.css`
- `frontend/src/styles/tailwind.css`
- `frontend/src/index.css`
- All `*.css` files in components/

### 2. CSS Ownership Matrix

Map every CSS file to its owner. Flag violations.

```
Build the ownership matrix:

| CSS File | Owner Component(s) | Scope | Violations |
|----------|-------------------|-------|------------|
| Component.css | Component.tsx | Scoped | None |
| index.css | Global | Reset only | Should not style components |
| design-tokens.css | Global | Variables only | Should not have selectors |

Check for:
- [ ] Every CSS file has clear ownership
- [ ] No CSS file styles components it doesn't own
- [ ] No "utility" or "helper" CSS junk drawers
- [ ] index.css is < 200 lines (reset + base only)
```

### 3. Conflict Detection

Systematically find CSS conflicts.

```
Automated/Manual Checks:

Duplicate Selectors:
- [ ] Search for identical selectors across files
- [ ] Flag any selector appearing in 2+ files
- [ ] Document intentional overrides (rare, must be justified)

Tailwind + CSS Conflicts:
- [ ] No property set in BOTH Tailwind class AND CSS file
- [ ] Example violation: className="p-4" + .component { padding: 20px; }

Specificity Wars:
- [ ] Count selectors with specificity > 0,3,0
- [ ] Flag nested selectors deeper than 3 levels
- [ ] Document any intentional high-specificity (must be justified)

!important Audit:
- [ ] List every !important in codebase
- [ ] Target: 0 !important
- [ ] Each !important requires documented justification
- [ ] Maximum acceptable: 5 (for third-party overrides only)
```

**Search Commands:**
```bash
# Find !important usage
grep -r "!important" frontend/src --include="*.css" | wc -l

# Find duplicate selectors (manual review needed)
grep -rh "^\." frontend/src --include="*.css" | sort | uniq -d
```

### 4. Mobile Override Consistency

Verify mobile styles don't fight desktop.

```
Breakpoint Consistency:
- [ ] All breakpoints use same values (768px, 1024px, etc.)
- [ ] No 767px vs 768px conflicts
- [ ] Breakpoint values documented in one place

Override Pattern Check:
- [ ] Mobile overrides use lower specificity (:where())
- [ ] Desktop styles don't need !important to beat mobile
- [ ] Component opt-out patterns documented (no-touch-target, etc.)

Search for violations:
- [ ] Grep for @media with different breakpoint values
- [ ] Check for mobile rules that undo desktop explicitly
- [ ] Flag any "mobile fighting desktop" patterns
```

**Files to Review:**
- `frontend/src/index.css` - Global mobile rules
- `frontend/src/components/ui/*.css` - UI component mobile
- Any file with @media queries

### 5. CSS Technical Debt Metrics

Quantify the debt.

```
Debt Dashboard:

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| !important count | ? | 0 | |
| Duplicate selectors | ? | 0 | |
| Dead CSS selectors | ? | 0 | |
| Avg specificity | ? | < 0,2,0 | |
| Total CSS files | ? | Benchmark | |
| Total CSS lines | ? | Benchmark | |
| CSS bundle size | ?KB | < 50KB | |

Dead CSS Detection:
- [ ] Every selector has matching DOM element
- [ ] No .old, .backup, .unused, .deprecated classes
- [ ] No commented-out CSS blocks
- [ ] No vendor prefixes for supported properties
```

**Tools:**
- Browser DevTools Coverage panel
- PurgeCSS analysis (dry run)
- Manual selector-to-DOM matching for critical files

### 6. Component Variant Patterns

Ensure variants follow consistent patterns.

```
CVA (class-variance-authority) Check:
- [ ] Components with variants use CVA
- [ ] Variant names are semantic (not variant-1, variant-2)
- [ ] Variants defined in ONE location per component
- [ ] No ad-hoc variant classes (.button-blue, .button-special)

Variant Documentation:
- [ ] Each variant has clear purpose
- [ ] Usage examples in Storybook or comments
- [ ] Default variant specified
```

**Components to Review:**
- Button, Input, Select (UI primitives)
- Card, Modal, Sheet (containers)
- Any component with multiple visual states

### 7. Tailwind + CSS Coexistence Rules

Document and enforce the boundary.

```
Coexistence Policy (verify this is documented and followed):

Tailwind ONLY for:
- [ ] Layout (flex, grid, gap)
- [ ] Spacing (p-*, m-*)
- [ ] Responsive utilities (md:, lg:)
- [ ] Simple colors (bg-*, text-* with semantic names)

CSS Files ONLY for:
- [ ] Complex animations
- [ ] Pseudo-elements (::before, ::after)
- [ ] Complex selectors (child combinators, :has())
- [ ] State-based styling (data-*, aria-*)
- [ ] Component-specific theming

NEVER do:
- [ ] Same property in both Tailwind class AND CSS
- [ ] Tailwind arbitrary values for colors [#fff]
- [ ] CSS that duplicates Tailwind utility
```

### 8. Developer Experience Audit

The "10-minute test" for new developers.

```
Documentation Check:
- [ ] "Where do I put styles?" answered in CLAUDE.md
- [ ] CSS naming convention documented
- [ ] Tailwind vs CSS decision tree documented
- [ ] Design token reference accessible

Predictability Check:
For ANY component, can you answer:
- [ ] Where are its styles? (Answer should be: ComponentName.css)
- [ ] What affects its appearance? (Answer should be: 1-2 files max)
- [ ] How do I add a variant? (Answer should be: CVA in component)

Guardrails Check:
- [ ] Stylelint configured and running
- [ ] Stylelint rules match documented conventions
- [ ] CI fails on Stylelint errors
- [ ] Pre-commit hook runs Stylelint
```

**Files to Review:**
- `CLAUDE.md` - CSS section
- `.stylelintrc` or `stylelint.config.js`
- `.husky/pre-commit`
- `.github/workflows/ci.yml`

### 9. Override Chain Analysis (Debugging Tool)

For any "styles not working" situation, provide this analysis format:

```
Override Chain Template:

Target: [selector or element]
Expected: [what you want]
Actual: [what's happening]

Style Sources (in specificity order):
1. [file.css:line] - selector - specificity - property: value
2. [file.css:line] - selector - specificity - property: value
3. [tailwind class] - specificity - property: value

Winner: [which rule wins and why]

Resolution Options:
a) Increase specificity of intended rule (not recommended)
b) Remove conflicting rule from [file]
c) Use CSS layer to control priority
d) Consolidate to single source of truth

Recommended: [option]
```

### 10. CSS File Health Check

Per-file analysis for major CSS files.

```
File Health Template:

| File | Lines | Selectors | !important | Avg Specificity | Health |
|------|-------|-----------|------------|-----------------|--------|
| Component.css | X | Y | Z | 0,N,N | Good/Warning/Bad |

Health Criteria:
- Good: < 300 lines, 0 !important, avg spec < 0,2,0
- Warning: 300-500 lines, 1-2 !important, avg spec < 0,3,0
- Bad: > 500 lines, 3+ !important, avg spec >= 0,3,0

Files requiring immediate attention:
- [ ] List files with "Bad" health
- [ ] Prioritize by usage frequency
```

## Output Format

### CSS Architecture Score: [1-10]
### Developer Experience Score: [1-10]
### Technical Debt Score: [1-10] (higher = less debt)

### Source of Truth Violations
| Property Type | Expected Source | Actual Sources | Files Affected |
|---------------|-----------------|----------------|----------------|

### Conflict Matrix
| Selector | File 1 | File 2 | Conflict Type | Resolution |
|----------|--------|--------|---------------|------------|

### !important Registry
| File | Line | Selector | Justification | Action |
|------|------|----------|---------------|--------|

### Dead CSS Candidates
| File | Selector | Reason Unused | Safe to Remove |
|------|----------|---------------|----------------|

### Technical Debt Summary
| Metric | Current | Target | Gap | Priority |
|--------|---------|--------|-----|----------|

### CSS Ownership Matrix
| CSS File | Owner | Scope | Issues |
|----------|-------|-------|--------|

### Developer Experience Gaps
| Gap | Impact | Fix | Effort |
|-----|--------|-----|--------|

### Recommendations Priority
1. **Critical** (Causing active pain - the "100 iterations" problems)
2. **High** (Will cause pain soon)
3. **Medium** (Technical debt accumulating)
4. **Low** (Polish and consistency)

### Immediate Actions (This Week)
| Action | Impact | File(s) | Effort |
|--------|--------|---------|--------|

### Architecture Improvements (This Month)
| Improvement | Benefit | Approach |
|-------------|---------|----------|

---

## Running This Audit

### Automated Checks (Run First)
```bash
# Count !important
grep -r "!important" frontend/src --include="*.css" | wc -l

# Find potential duplicates (needs manual review)
grep -rh "^\." frontend/src --include="*.css" | sort | uniq -d

# Find hardcoded colors
grep -rE "#[0-9a-fA-F]{3,6}" frontend/src --include="*.css"

# Find hardcoded pixels (excluding 0px, 1px for borders)
grep -rE "[^0-1]px" frontend/src --include="*.css"

# CSS file sizes
find frontend/src -name "*.css" -exec wc -l {} + | sort -n

# CSS bundle size (after build)
ls -la frontend/dist/assets/*.css
```

### Manual Review Order
1. Start with files flagged by automated checks
2. Review largest CSS files first
3. Review most-edited CSS files (git log)
4. Walk through major component CSS files

### Ongoing Monitoring
- Add CSS metrics to CI dashboard
- Review CSS in every PR (file changes)
- Monthly debt check-in

---

Remember: The goal is not perfect CSS - it's predictable CSS. Developers should never wonder "where does this style come from?" or "why won't this style apply?" If they do, architecture has failed.
