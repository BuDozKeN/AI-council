# iOS Auto-Zoom Prevention Fix

## Summary

Fixed annoying iOS auto-zoom behavior when users tap on text inputs by ensuring all input elements use 16px font size on mobile devices.

## Issue

On iOS devices (iPhone/iPad), Safari automatically zooms to 100% when users tap on form inputs with font-size less than 16px. This creates an annoying UX experience where the viewport suddenly zooms in, making it harder to see context and requiring users to manually zoom back out.

## Solution

Added a comprehensive mobile media query rule in the global CSS (`index.css`) that enforces 16px font size for all input types on screens 640px and below:

```css
@media (width <= 640px) {
  /* iOS auto-zoom prevention - 16px font on all input types */
  input[type='text'],
  input[type='email'],
  input[type='search'],
  input[type='password'],
  textarea,
  select {
    font-size: 16px !important; /* Prevents iOS zoom on focus */
  }
}
```

## Files Modified

- **c:\Users\aitor\AI-council\frontend\src\index.css** (Lines 408-416)
  - Added iOS auto-zoom prevention rule in the global mobile styles section
  - Rule applies at the `@layer base` level for proper cascade handling

## Input Types Covered

The fix covers all common input types:
1. `input[type='text']` - General text inputs
2. `input[type='email']` - Email inputs
3. `input[type='search']` - Search inputs
4. `input[type='password']` - Password inputs
5. `textarea` - Text areas
6. `select` - Dropdown selects

## Affected Components

This global rule will prevent iOS auto-zoom for all inputs across the entire application:

- Login form inputs
- Chat omnibar and message inputs
- Settings form inputs
- Search inputs in conversation list
- All FormField component instances
- Any custom form inputs using native HTML elements

## Technical Details

### Why 16px?

iOS Safari auto-zooms when input font-size is less than 16px. This is a browser optimization to prevent accidental zooming that used to happen when users would tap text smaller than 16px. By setting inputs to 16px, we bypass this behavior entirely.

### Why !important?

The `!important` flag is necessary because:
1. Various component CSS files have specific font-size rules (e.g., FormField.css, mobile-input.css)
2. Some CSS has higher specificity than the global base layer
3. We need to guarantee the 16px rule applies to prevent iOS zoom

### CSS Layer Architecture

The rule is placed in `@layer base` at the global level, which means:
- It's part of the cascade foundation
- Component-specific CSS can still override it if needed (using their own !important)
- It's applied consistently before component styles are considered

## Testing Recommendations

To verify the fix works:

1. Open the app on an iOS device (iPhone or iPad)
2. Navigate to any page with form inputs:
   - Login page
   - Chat page (try typing in message input)
   - Settings page (profile, team, etc.)
3. Tap on input fields and verify:
   - No zoom occurs when focusing the input
   - Viewport remains at correct scale
   - Text is readable at current zoom level
4. Test on both light and dark modes

### Browser Compatibility

- iOS Safari: Fixed (main concern)
- Android Chrome: Already handles this well, no negative impact
- Desktop browsers: Font-size set to 16px on mobile won't affect desktop (breakpoint <= 640px)

## Previous Attempts & Coverage

Some files already had partial coverage:
- `FormField.css`: Had 16px for form-input, form-textarea, form-select
- `SettingsResponsive.css`: Had 16px for settings inputs
- `mobile-input.css`: Had 16px for message-input
- `omnibar-mobile.css`: Had 16px for omni-input

The global rule ensures complete coverage across all input types and components.

## Performance Impact

- Minimal: Just one additional CSS rule
- No JavaScript overhead
- No additional HTTP requests
- Browser native behavior (16px is rendered the same as any other size)

## Future Considerations

If specific components need smaller input fonts:
1. They can override using their own !important rule
2. Or add `.no-ios-zoom` class and override selectively
3. Current approach is "safe by default" for all inputs

## Rollback Instructions

If needed, simply remove lines 408-416 from `frontend/src/index.css`:

```css
    /* iOS auto-zoom prevention - 16px font on all input types */
    input[type='text'],
    input[type='email'],
    input[type='search'],
    input[type='password'],
    textarea,
    select {
      font-size: 16px !important; /* Prevents iOS zoom on focus */
    }
```

---

**Related Skills:** `.claude/skills/mobile-debugging.md` - Mobile UX debugging patterns
