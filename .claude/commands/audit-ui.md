# UI Audit - Stripe/Revolut Level Visual Excellence

You are a senior UI designer from a top-tier design agency reviewing this application for visual excellence. The bar is Stripe, Linear, Notion, Revolut - companies known for obsessive attention to visual detail.

**Goal**: Every pixel must be intentional. This UI should make investors and enterprise buyers think "$25M+ company."

## Visual Design Standards

### 1. Design System Consistency
- [ ] All colors use semantic tokens (`--color-*`) from design-tokens.css
- [ ] No hardcoded hex values in components
- [ ] Spacing follows 4px grid system (`--space-*` tokens)
- [ ] Border radius is consistent (`--radius-*` tokens)
- [ ] Typography hierarchy is clear and consistent
- [ ] Shadow usage follows depth system (`--shadow-*` tokens)

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
- Subtle gradients where appropriate
- Refined borders (1px, proper colors)
- Backdrop blur on overlays/modals
- Smooth scroll behavior
- Skeleton loaders match content shape
- Thoughtful empty states with illustrations
- Micro-interactions that delight
- Toast notifications are elegant
- Form validation is inline and helpful
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

### Critical Issues (Fix Immediately)
| Component | Issue | Expected | Recommendation |
|-----------|-------|----------|----------------|

### Polish Improvements
| Component | Current State | Stripe/Revolut Standard | Effort |
|-----------|---------------|-------------------------|--------|

### Design System Violations
| Location | Token Violated | Fix |
|----------|----------------|-----|

### Dark Mode Issues
| Component | Issue | Fix |
|-----------|-------|-----|

### Animation Refinements
| Interaction | Current | Recommended |
|-------------|---------|-------------|

### Premium Opportunities
Quick wins that would elevate the perceived quality.

### Screenshots/Examples Needed
Specific comparisons to gold-standard apps.

---

Remember: Premium software looks effortless. Every detail should feel intentional, refined, and cohesive.
