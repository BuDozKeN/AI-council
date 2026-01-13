# UI Audit - Stripe/Revolut Level Visual Excellence

You are a senior UI designer from a top-tier design agency reviewing this application for visual excellence. The bar is Stripe, Linear, Notion, Revolut - companies known for obsessive attention to visual detail.

**Goal**: Every pixel must be intentional. This UI should make investors and enterprise buyers think "$25M+ company."

## Visual Design Standards

### 1. Design System Consistency & Token Usage
- [ ] All colors use semantic tokens (`--color-*`) from design-tokens.css AND tailwind.css
- [ ] No hardcoded hex values, rgba(), or color names in components
- [ ] Spacing follows 4px grid system (`--space-*`, `--gap-*`, `--stack-*` tokens)
- [ ] Border radius is consistent (`--radius-*` tokens: xs/sm/default/md/lg/xl/2xl/3xl/full)
- [ ] Typography hierarchy uses font tokens (Geist Sans, `--text-*` sizes, `--leading-*` line heights)
- [ ] Shadow usage follows depth system (`--shadow-xs/sm/md/lg/xl/2xl`)
- [ ] Z-index uses semantic scale (`--z-base/above/raised/elevated/header/overlay/sticky/dropdown/modal/toast`)
- [ ] Overlay colors use pre-computed tokens (`--overlay-black-*`, `--overlay-white-*`, `--overlay-[color]-*`)
- [ ] Component-specific tokens used correctly (`--card-padding-*`, `--btn-height-*`, `--input-height-*`)
- [ ] No CSS variables invented in components - must be defined in design-tokens.css or tailwind.css

### 2. Typography Excellence
```
Check for:
- Geist font loading correctly
- Font weights create clear hierarchy (400, 500, 600, 700)
- Line heights optimized for readability
- Letter spacing refined (-0.01em for headings)
- No orphaned words in headings
- Proper text truncation with ellipsis
- Consistent text colors for primary/secondary/muted
```

### 3. Color Harmony
```
Check for:
- Primary accent (indigo) used sparingly for CTAs
- Neutral palette creates calm, professional feel
- Sufficient contrast ratios (4.5:1 minimum)
- Dark mode colors are equally refined (not just inverted)
- Status colors are intuitive (green=success, red=error, amber=warning)
- Department colors are distinguishable and harmonious
- No jarring color combinations
```

### 4. Spacing & Layout
```
Check for:
- Consistent padding within cards/containers
- Proper visual grouping (related items closer)
- Adequate whitespace (premium feel)
- Grid alignment across the interface
- Responsive spacing (tighter on mobile, roomier on desktop)
- No cramped or cluttered areas
- Balanced negative space
```

### 5. Component Polish
```
For each component, verify:
- Hover states are smooth and intentional
- Focus states are visible but elegant
- Active/pressed states provide feedback
- Disabled states are clearly distinguishable
- Loading states are polished (skeletons, spinners)
- Empty states are designed, not default
- Error states are helpful, not alarming
```

### 6. Iconography
```
Check for:
- Consistent icon style (Lucide throughout)
- Appropriate icon sizes (16px, 20px, 24px grid)
- Icons aligned with text baseline
- Meaningful icons (not decorative clutter)
- Consistent stroke weights
- Proper spacing around icons
```

### 7. Animation & Motion
```
Check for:
- Transitions feel natural (ease-out, spring curves)
- Durations are appropriate (150-300ms for micro, 300-500ms for page)
- No jarring or flashy animations
- Reduced motion respected
- Loading animations are subtle
- Hover animations are quick and responsive
- Page transitions are smooth
```

### 8. Visual Hierarchy
```
Check for:
- Clear primary action on each screen
- Secondary actions visually subordinate
- Important information above the fold
- Scanning patterns considered (F-pattern, Z-pattern)
- Visual weight guides the eye correctly
- Nothing competes for attention inappropriately
```

### 9. Dark Mode Excellence
```
Check for:
- Not just "dark" but refined night mode
- Proper contrast maintained
- Shadows adjusted for dark surfaces
- Images/icons work on dark backgrounds
- No "dark mode afterthought" feel
- Equal design attention as light mode
```

### 10. Premium Details
```
The difference between good and great:
- Subtle gradients where appropriate (check stage gradients)
- Refined borders (1px, proper colors using tokens)
- Backdrop blur on overlays/modals (use `backdrop-blur-*` or `--glass-*` tokens)
- Smooth scroll behavior (`scroll-behavior: smooth`, `-webkit-overflow-scrolling: touch`)
- Skeleton loaders match content shape (use `--skeleton-base`, `--skeleton-shimmer`)
- Thoughtful empty states with illustrations/icons
- Micro-interactions that delight (hover transforms, ripples)
- Toast notifications are elegant (proper z-index, animations)
- Form validation is inline and helpful (error states, success states)
- Noise texture applied correctly (use `--noise-texture`, `--noise-opacity-*`)
- Glass morphism used appropriately (check `--glass-bg`, `--glass-border`, `--glass-shadow`)
```

### 11. Mobile-First UI Patterns (CRITICAL)
```
Check mobile responsiveness:
- [ ] Touch targets minimum 44x44px (or opt-out with `no-touch-target` class)
- [ ] Bottom sheets work correctly (drag handle, swipe dismiss)
- [ ] Modals adapt to mobile (full screen or sheet style)
- [ ] Dropdowns/selects are mobile-friendly (proper z-index inside modals)
- [ ] Forms have mobile keyboard optimization (prevent zoom with 16px min font size)
- [ ] Swipe gestures work (swipe to dismiss, swipe to navigate)
- [ ] Mobile landscape orientation handled (reduced heights, horizontal layouts)
- [ ] Tablets get appropriate layouts (not just desktop or mobile)
- [ ] Safe area insets respected (notch/island on iPhone)
```

### 12. CSS Architecture & Organization
```
Check code quality:
- [ ] CSS follows BEM or utility-first patterns consistently
- [ ] Component CSS scoped properly (no global pollution)
- [ ] Specificity managed correctly (no !important except for accessibility)
- [ ] Media queries use consistent breakpoints (640px, 768px, 1024px)
- [ ] CSS layers used correctly (@layer base, components, utilities)
- [ ] No duplicate styles across files
- [ ] Mobile-first approach (base styles for mobile, media queries for desktop)
- [ ] CSS custom properties cascade correctly (light/dark mode)
```

### 13. Component Library Integration (Radix UI + shadcn)
```
Check component patterns:
- [ ] Radix UI primitives used correctly (Dialog, Select, Popover, etc.)
- [ ] CVA (class-variance-authority) used for button/input variants
- [ ] Radix asChild pattern used appropriately
- [ ] Radix Portal used for overlays (escape parent overflow)
- [ ] Focus trapping works in modals/dialogs
- [ ] Keyboard navigation complete (Tab, Escape, Enter)
- [ ] ARIA attributes present and correct
- [ ] Data attributes used for styling (`[data-state]`, `[data-side]`)
```

### 14. Cross-Browser & Device Testing
```
Verify on:
- [ ] Chrome (latest) - desktop and mobile
- [ ] Safari (latest) - desktop and iOS
- [ ] Firefox (latest) - desktop
- [ ] Edge (latest) - desktop
- [ ] Mobile Safari (iOS 15+) - touch interactions, safe areas
- [ ] Chrome Android - touch interactions, keyboard
- [ ] Tablet layouts (iPad, Android tablets)
- [ ] Small phones (iPhone SE, 375px width)
- [ ] Large screens (1920px+, 4K)
```

### 15. Performance as Visual Quality
```
Check performance impacts:
- [ ] Images optimized and lazy-loaded (WebP/AVIF)
- [ ] Fonts loaded efficiently (preload Geist, font-display: swap)
- [ ] No layout shift (CLS score < 0.1)
- [ ] Animations don't cause jank (use transform/opacity only)
- [ ] Critical CSS inlined for fast first paint
- [ ] Large images have blur placeholders
- [ ] SVG icons optimized (no unnecessary paths)
```

### 16. State Consistency Across Components
```
Every component must handle:
- [ ] Default state - clear baseline
- [ ] Hover state - smooth transition
- [ ] Active/pressed state - visual feedback
- [ ] Focus state - visible focus ring (accessibility)
- [ ] Disabled state - clear but not invisible
- [ ] Loading state - skeleton or spinner (not blank)
- [ ] Error state - helpful, not alarming (red with message)
- [ ] Success state - positive feedback (green with message)
- [ ] Empty state - designed, not default (illustration + CTA)
```

## Files to Review

**Core UI Components:**
- `frontend/src/components/ui/*.tsx` - Base components
- `frontend/src/styles/design-tokens.css` - Token definitions
- `frontend/src/styles/tailwind.css` - Custom styles
- `frontend/src/index.css` - Global styles

**Feature Components:**
- `frontend/src/components/chat/` - Main interface
- `frontend/src/components/stage1-3/` - Deliberation stages
- `frontend/src/components/mycompany/` - Settings area
- `frontend/src/components/sidebar/` - Navigation

**Check for Consistency:**
- Button variants across the app
- Card styling patterns
- Modal/dialog designs
- Form input styling
- Table/list styling

## Competitive Benchmark

Compare against:
- **Stripe Dashboard** - Clean, professional, confident
- **Linear** - Minimal, fast, keyboard-first
- **Notion** - Warm, approachable, flexible
- **Revolut** - Modern, bold, trustworthy
- **Figma** - Collaborative, clear, delightful

## Output Format

### Visual Excellence Score: [1-10]
_Overall visual quality compared to Stripe/Linear/Notion/Revolut_

### Design System Score: [1-10]
_Adherence to design tokens and consistency_

### Mobile UI Score: [1-10]
_Mobile responsiveness, touch targets, gestures_

### Performance Score: [1-10]
_Visual performance (CLS, font loading, image optimization)_

---

### ❌ Critical Issues (Fix Immediately)
_Issues that break the experience or look unprofessional_

| Component | Issue | Expected | Recommendation | Severity |
|-----------|-------|----------|----------------|----------|

### ⚠️ Design System Violations
_Hardcoded values, missing tokens, inconsistent patterns_

| Location | Token Violated | Current Value | Correct Token | Impact |
|----------|----------------|---------------|---------------|--------|

### 📱 Mobile UI Issues
_Touch targets, gestures, responsive behavior_

| Component | Issue | Device/Breakpoint | Fix | Priority |
|-----------|-------|-------------------|-----|----------|

### 🎨 Polish Improvements
_Not broken, but could be better_

| Component | Current State | Stripe/Revolut Standard | Effort | Impact |
|-----------|---------------|-------------------------|--------|--------|

### 🌙 Dark Mode Issues
_Dark mode inconsistencies or problems_

| Component | Issue | Light Mode | Dark Mode | Fix |
|-----------|-------|------------|-----------|-----|

### ✨ Animation & Motion Refinements
_Timing, easing, transitions_

| Interaction | Current | Recommended | Reasoning |
|-------------|---------|-------------|-----------|

### 🎯 State Consistency Gaps
_Components missing loading/error/empty/disabled states_

| Component | Missing States | Expected Behavior |
|-----------|----------------|-------------------|

### 🏆 Premium Opportunities
_Quick wins that would elevate the perceived quality_

| Opportunity | Current | Premium Version | Effort | ROI |
|-------------|---------|-----------------|--------|-----|

### 🔍 Cross-Browser Issues
_Browser-specific problems found_

| Browser | Component | Issue | Fix |
|---------|-----------|-------|-----|

### 📊 Component Library Usage
_Radix UI, shadcn, CVA patterns_

| Component | Pattern | Issue/Recommendation |
|-----------|---------|---------------------|

### 🎓 Best Practices Violations
_CSS architecture, accessibility, performance_

| Category | Violation | Best Practice | Fix |
|----------|-----------|---------------|-----|

### 📸 Visual Comparisons Needed
_Specific side-by-side comparisons to gold-standard apps_

| Our Component | Compare To | What to Verify |
|---------------|------------|----------------|

---

### 📋 Summary & Priority Matrix

**Must Fix (P0):** [count] issues
- _Breaks functionality or looks unprofessional_

**Should Fix (P1):** [count] issues
- _Noticeably detracts from premium feel_

**Nice to Have (P2):** [count] improvements
- _Polish and delight enhancements_

### Estimated Effort
- Quick wins (< 1 hour): [count]
- Medium effort (1-4 hours): [count]
- Large effort (> 4 hours): [count]

---

**Remember**: Premium software looks effortless. Every detail should feel intentional, refined, and cohesive. The difference between good and great is in the details most users won't consciously notice but will subconsciously appreciate.
