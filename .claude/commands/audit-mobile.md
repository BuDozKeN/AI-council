# Mobile Experience Audit - Native-Quality PWA

You are a mobile-first design expert. This PWA must feel as polished as Revolut, Monzo, or Linear's mobile apps. Enterprise buyers will test this on their phones - it must impress.

**Standard**: If someone can't tell whether this is a native app or web app, we've succeeded.

## Mobile Excellence Checklist

### 1. Touch Targets & Interactions
```
Check for:
- [ ] Minimum 44x44px touch targets (Apple HIG)
- [ ] Adequate spacing between tap targets (8px minimum)
- [ ] No hover-dependent features (touch has no hover)
- [ ] Touch feedback on all interactive elements
- [ ] Swipe gestures where intuitive
- [ ] Pull-to-refresh where appropriate
- [ ] Long-press actions discoverable
- [ ] No accidental tap issues (fat finger friendly)
```

### 2. Responsive Layout
```
Check all breakpoints:
- [ ] 320px (iPhone SE, older devices)
- [ ] 375px (iPhone standard)
- [ ] 390px (iPhone Pro)
- [ ] 428px (iPhone Pro Max)
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape)

For each breakpoint verify:
- No horizontal scroll
- Text readable without zoom
- Images properly scaled
- Layout doesn't break
- Critical actions visible
```

### 3. Navigation Patterns
```
Check for:
- [ ] Bottom navigation for primary actions (thumb zone)
- [ ] Hamburger menu only for secondary items
- [ ] Back navigation predictable
- [ ] Swipe-to-go-back support
- [ ] Tab bar for main sections (if applicable)
- [ ] No nested modals/drawers
- [ ] Breadcrumbs collapse gracefully
```

### 4. Mobile-Specific UI
```
Check for:
- [ ] Sidebar collapses to drawer on mobile
- [ ] Modals are full-screen or bottom-sheet style
- [ ] Dropdowns become native select or bottom sheets
- [ ] Tables become cards/lists
- [ ] Forms are single-column
- [ ] Keyboard doesn't cover inputs
- [ ] Safe area insets respected (notch, home indicator)
```

### 5. Typography for Mobile
```
Check for:
- [ ] Base font size 16px+ (prevents iOS zoom)
- [ ] Line height comfortable for reading
- [ ] Line length max 60-70 characters
- [ ] Headings scale down appropriately
- [ ] No tiny text (<12px)
- [ ] Sufficient contrast on mobile screens
```

### 6. Performance on Mobile
```
Check for:
- [ ] First Contentful Paint <1.8s on 3G
- [ ] Time to Interactive <3.8s on 3G
- [ ] Total bundle size optimized
- [ ] Images lazy-loaded
- [ ] Code splitting effective
- [ ] Offline mode works (PWA)
- [ ] No jank during scroll
- [ ] Animations at 60fps
```

### 7. Forms on Mobile
```
Check for:
- [ ] Correct input types (email, tel, number)
- [ ] Autocomplete attributes set
- [ ] Keyboard type matches input
- [ ] Labels above inputs (not floating)
- [ ] Large enough tap targets for inputs
- [ ] Error messages visible above keyboard
- [ ] Submit button always reachable
- [ ] Autofill works correctly
```

### 8. Gestures & Feedback
```
Check for:
- [ ] Haptic feedback on iOS (where supported)
- [ ] Visual feedback on touch
- [ ] Smooth transitions between states
- [ ] Pull-to-refresh animation
- [ ] Loading spinners/skeletons
- [ ] No 300ms tap delay
- [ ] Double-tap zoom disabled on app-like views
```

### 9. Orientation Support
```
Check for:
- [ ] Portrait mode fully functional
- [ ] Landscape mode works (or gracefully limited)
- [ ] Rotation doesn't break layout
- [ ] Rotation doesn't lose state
- [ ] Keyboard landscape handled
```

### 10. Mobile-Specific Features
```
Check for:
- [ ] PWA manifest configured correctly
- [ ] App icon appropriate for home screen
- [ ] Splash screen configured
- [ ] Status bar styled appropriately
- [ ] Share functionality (Web Share API)
- [ ] Camera access (if needed)
- [ ] Push notifications (if applicable)
- [ ] Add to Home Screen prompt
```

### 11. iOS-Specific Checks
```
Check for:
- [ ] Safe area insets (env(safe-area-inset-*))
- [ ] Rubber-banding scroll feels native
- [ ] No momentum scroll issues
- [ ] Text selection works
- [ ] Copy/paste works
- [ ] Viewport meta tag correct
- [ ] Apple-specific meta tags
- [ ] Status bar appearance
```

### 12. Android-Specific Checks
```
Check for:
- [ ] Hardware back button works
- [ ] Chrome custom tabs for external links
- [ ] Material Design principles where appropriate
- [ ] Proper theme-color meta tag
- [ ] Splash screen colors match
- [ ] No overscroll glow issues
```

## Files to Review

**Layout & Responsive:**
- `frontend/src/App.tsx` - Main layout
- `frontend/src/App.css` - Layout styles
- `frontend/src/styles/tailwind.css` - Mobile utilities
- `frontend/src/index.css` - Mobile base styles

**Components with Mobile Variations:**
- `frontend/src/components/sidebar/` - Mobile drawer
- `frontend/src/components/chat/` - Main interface
- `frontend/src/components/ui/` - Base components
- Modal/dialog components

**PWA Configuration:**
- `frontend/vite.config.js` - PWA plugin config
- `frontend/public/manifest.json` - Web manifest
- Service worker configuration

## Testing Checklist

### Devices to Test (or emulate)
- iPhone SE (smallest)
- iPhone 14/15 Pro (standard)
- iPhone 14/15 Pro Max (large)
- iPad (tablet breakpoint)
- Android phone (Pixel, Samsung)

### Conditions to Test
- [ ] Portrait and landscape
- [ ] With keyboard open
- [ ] With slow network (3G throttle)
- [ ] With offline mode
- [ ] After "Add to Home Screen"
- [ ] Fresh load vs cached

## Output Format

### Mobile Excellence Score: [1-10]
### Native-Feel Score: [1-10]

### Critical Mobile Issues
| Screen | Issue | Device/Viewport | Fix |
|--------|-------|-----------------|-----|

### Touch Target Violations
| Element | Current Size | Required | Location |
|---------|--------------|----------|----------|

### Responsive Breakpoints Broken
| Breakpoint | Issue | Screenshot/Description |
|------------|-------|------------------------|

### Missing Mobile Patterns
| Pattern | Current | Expected (Native-like) |
|---------|---------|------------------------|

### PWA Issues
| Feature | Current State | Fix |
|---------|---------------|-----|

### Performance on Mobile
| Metric | Current | Target |
|--------|---------|--------|

### Priority Fixes
1. **Blocking** (App unusable on mobile)
2. **Major** (Significant friction)
3. **Minor** (Polish issues)

---

Remember: Mobile is not a smaller desktop. It's a different context with different constraints and opportunities.
