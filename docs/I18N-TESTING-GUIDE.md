# i18n Testing Guide

## Quick Test Checklist

Use this checklist to verify i18n works correctly after making changes:

### Basic Functionality
- [ ] Language switcher in Settings works
- [ ] UI updates immediately when switching language
- [ ] Language preference persists after page reload
- [ ] HTML `lang` attribute updates dynamically
- [ ] Browser language detection works on first visit

### Frontend Strings
- [ ] All UI text is translated (no hardcoded English)
- [ ] Error messages display in selected language
- [ ] Success toasts display in selected language
- [ ] Form labels and placeholders translated
- [ ] Button text translated
- [ ] Modal titles and content translated

### Backend Integration
- [ ] API error responses in user's language (check Accept-Language header)
- [ ] Validation errors in user's language
- [ ] Email notifications in user's language (when implemented)

### AI Council i18n
- [ ] Triage analysis in user's language
- [ ] Stage 1 responses in user's language
- [ ] Stage 2 peer review in user's language
- [ ] Stage 3 synthesis in user's language
- [ ] AI personas maintain correct tone in target language

### Formatting
- [ ] Dates formatted correctly for locale (check Conversations list)
- [ ] Relative times correct ("2 hours ago" vs "hace 2 horas")
- [ ] Numbers formatted correctly (thousands separator, decimal)
- [ ] Currency formatted correctly (symbol position)
- [ ] File sizes use correct units

### RTL Support (Arabic, Hebrew)
- [ ] `dir="rtl"` applied when RTL language selected
- [ ] Text flows right-to-left
- [ ] Icons and chevrons flip direction
- [ ] Sidebars appear on right side
- [ ] Padding/margins flipped correctly
- [ ] No horizontal scrollbars on RTL

### SEO
- [ ] `<title>` tag in selected language
- [ ] Meta description translated
- [ ] Open Graph tags translated
- [ ] hreflang links present for all languages (View Source)
- [ ] Canonical URL set correctly

### Edge Cases
- [ ] Long German strings don't break layout
- [ ] Empty states translated
- [ ] Loading skeletons work in all languages
- [ ] Error boundaries show translated messages
- [ ] 404 page translated

## Detailed Testing Procedures

### Test 1: Language Switching Flow

**Objective**: Verify user can switch languages and preference persists

**Steps**:
1. Open app in incognito window (fresh session)
2. Note the default language (should be browser language or English)
3. Go to Settings > General > Language
4. Select "Español"
5. Verify:
   - UI immediately updates to Spanish
   - HTML `lang="es"` (check DevTools)
   - localStorage has `axcouncil_language: "es"`
6. Refresh page
7. Verify language still Spanish
8. Switch back to English
9. Verify language persists after refresh

**Expected**: Language switches immediately, persists across sessions

### Test 2: AI Council in Spanish

**Objective**: Verify AI responds in Spanish when user language is Spanish

**Steps**:
1. Switch to Spanish (Settings > General > Language > Español)
2. Start new conversation
3. Ask in Spanish: "¿Cuáles son las mejores prácticas para lanzar un producto?"
4. Verify:
   - Triage messages in Spanish ("Analizando tu pregunta...")
   - Stage 1 responses in Spanish
   - Stage 2 peer review in Spanish
   - Stage 3 synthesis in Spanish
   - AI maintains professional business tone in Spanish
5. Check that council members understand Spanish context

**Expected**: Full council deliberation in Spanish

### Test 3: Error Handling in Multiple Languages

**Objective**: Verify errors display in user's language

**Steps**:
1. **English**: Try to create a department with empty name
   - Verify error: "Department name is required"
2. Switch to Spanish
3. **Spanish**: Try to create a department with empty name
   - Verify error: "El nombre del departamento es obligatorio"
4. **English**: Try to access non-existent conversation (manipulate URL)
   - Verify 404 error in English
5. Switch to Spanish
6. **Spanish**: Try to access non-existent conversation
   - Verify 404 error in Spanish

**Expected**: All error messages in selected language

### Test 4: Date and Number Formatting

**Objective**: Verify Intl API correctly formats dates/numbers per locale

**Steps**:
1. Create several conversations (to get varied timestamps)
2. **English (US locale)**:
   - Check conversation timestamps: "2 hours ago", "Jan 15, 2024"
   - Numbers: "1,234.56"
3. Switch to Spanish (ES locale):
   - Check conversation timestamps: "hace 2 horas", "15 ene 2024"
   - Numbers: "1.234,56" (if any visible)
4. Check Settings > Usage tab:
   - Cost numbers formatted correctly
   - Dates formatted correctly

**Expected**: Dates and numbers match locale conventions

### Test 5: RTL Layout (Arabic/Hebrew)

**Objective**: Verify RTL languages work correctly

**Prerequisites**: Add Arabic or Hebrew translation (or test with browser console)

**Steps**:
1. Open browser console
2. Run: `document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar';`
3. Verify:
   - Text flows right-to-left
   - Sidebar on right side (or animates from right)
   - Chevron icons point correct direction
   - Modals slide from correct side
   - No horizontal scrollbars
   - Padding/margins correct (buttons have space on correct side)
4. Test interactions:
   - Click conversations (hit target correct)
   - Open modals (animate from correct side)
   - Navigate with keyboard (arrow keys work logically)

**Expected**: Full RTL layout with no visual bugs

### Test 6: SEO Meta Tags

**Objective**: Verify SEO tags update per language

**Steps**:
1. **English**: View page source (Ctrl+U)
   - Verify `<html lang="en">`
   - Verify `<title>` in English
   - Verify `<meta name="description">` in English
   - Verify `<meta property="og:title">` in English
   - Verify hreflang links present for en, es, x-default
2. Switch to Spanish
3. **Spanish**: View page source
   - Verify `<html lang="es">`
   - Verify `<title>` in Spanish
   - Verify `<meta name="description">` in Spanish
   - Verify `<meta property="og:title">` in Spanish
   - Verify `<meta property="og:locale">` is "es"

**Expected**: All SEO tags dynamically update

### Test 7: Missing Translation Fallback

**Objective**: Verify app handles missing translations gracefully

**Steps**:
1. Edit `frontend/src/i18n/locales/es.json`
2. Remove a translation key (e.g., delete `"common.save"`)
3. Switch to Spanish
4. Navigate to page using that key
5. Verify:
   - Falls back to English text for missing key
   - No console errors
   - App doesn't crash
6. Restore the key

**Expected**: Falls back to English, no crashes

### Test 8: Long String Layout Stress Test

**Objective**: Verify UI handles long translations (German is ~30% longer)

**Steps**:
1. Edit `frontend/src/i18n/locales/en.json`
2. Replace a button text with very long string:
   ```json
   {
     "common": {
       "save": "Save this very important document now before it is too late"
     }
   }
   ```
3. Check buttons across app:
   - Do they truncate with ellipsis?
   - Do they wrap gracefully?
   - Do they break layout?
4. Restore original text

**Expected**: Long strings don't break layout (truncate or wrap)

### Test 9: Pluralization

**Objective**: Verify plural forms work correctly

**Steps**:
1. Check conversation count in sidebar:
   - 0 conversations: "No conversations" / "Sin conversaciones"
   - 1 conversation: "1 conversation" / "1 conversación"
   - 5 conversations: "5 conversations" / "5 conversaciones"
2. Check relative time:
   - "1 minute ago" / "hace 1 minuto"
   - "5 minutes ago" / "hace 5 minutos"

**Expected**: Correct plural forms for each language

### Test 10: Mobile i18n

**Objective**: Verify i18n works correctly on mobile

**Steps**:
1. Open app on mobile device or mobile DevTools (375px width)
2. Switch to Spanish
3. Verify:
   - Bottom nav labels translated
   - Sheet headers translated
   - Mobile-specific error messages translated
   - Touch targets still 44px+ (not affected by longer text)
4. Test RTL on mobile (console: `document.documentElement.dir = 'rtl'`)
5. Verify:
   - Swipe gestures work correctly
   - Bottom sheet slides from correct side
   - Mobile nav on correct side

**Expected**: Full mobile i18n support

## Automated Testing

### Unit Tests for i18n

```typescript
// Example: Test translation keys exist
import { describe, it, expect } from 'vitest';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

describe('Translation completeness', () => {
  it('Spanish has all English keys', () => {
    const enKeys = getAllKeys(en);
    const esKeys = getAllKeys(es);

    enKeys.forEach(key => {
      expect(esKeys).toContain(key);
    });
  });
});

function getAllKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).flatMap(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return getAllKeys(obj[key], fullKey);
    }
    return [fullKey];
  });
}
```

### E2E Tests for i18n

```typescript
// Example: Playwright test for language switching
import { test, expect } from '@playwright/test';

test('User can switch to Spanish', async ({ page }) => {
  await page.goto('/');

  // Open settings
  await page.click('[data-testid="settings-button"]');

  // Switch to Spanish
  await page.click('[data-testid="language-selector"]');
  await page.click('text=Español');

  // Verify UI updated
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('[data-testid="save-button"]')).toHaveText('Guardar');

  // Refresh and verify persistence
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
```

## Performance Testing

### Translation Loading Performance

**Metrics to measure**:
- Initial bundle size increase with translations: <50KB per language
- Language switch time: <100ms
- No layout shift when switching languages (CLS = 0)
- Lazy loading of large translation files (if >100KB)

**Tools**:
- Lighthouse (check performance score in both English and Spanish)
- Chrome DevTools Performance tab
- Bundle analyzer to check translation file sizes

## Accessibility Testing

### Screen Reader Testing

**Steps**:
1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Switch to Spanish
3. Navigate app with screen reader
4. Verify:
   - Screen reader pronounces Spanish correctly
   - ARIA labels translated
   - Alt text translated
   - Language switches announced

## Common Issues and Fixes

### Issue: "Showing English instead of Spanish"

**Diagnosis**:
1. Check browser console for i18n errors
2. Verify localStorage has correct language: `localStorage.getItem('axcouncil_language')`
3. Check HTML `lang` attribute: Inspect `<html>` element
4. Verify translation key exists in `es.json`

**Fix**: Clear localStorage, refresh, switch language again

### Issue: "Layout breaks in Spanish"

**Diagnosis**: Spanish text is longer than English, overflowing container

**Fix**:
```css
/* Add to component CSS */
.button {
  min-width: 100px;  /* Prevent too narrow */
  max-width: 200px;  /* Prevent too wide */
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Issue: "RTL layout has horizontal scrollbar"

**Diagnosis**: Element using physical `left`/`right` instead of logical properties

**Fix**: Run CSS conversion script:
```bash
python scripts/convert_css_to_logical.py --file path/to/file.css --apply
```

### Issue: "Dates showing in wrong format"

**Diagnosis**: Not using centralized `formatDate()` utility

**Fix**: Replace manual formatting with utility:
```typescript
// ❌ Bad
new Date().toLocaleDateString();

// ✅ Good
import { formatDate } from '@/lib/formatters';
formatDate(new Date(), 'short');
```

## Regression Testing

After any i18n change, run this quick regression test:

1. **English**: Create conversation, verify all stages work
2. **Spanish**: Create conversation, verify all stages work
3. **English**: Create company, department, role, project
4. **Spanish**: Create company, department, role, project
5. **Both**: Test error cases (empty fields, invalid data)
6. **Both**: Check SEO meta tags (View Source)

**Time estimate**: 10-15 minutes

## Bug Reporting Template

When reporting i18n bugs, include:

```markdown
**Language**: Spanish (es)

**Issue**: Button text overflows container

**Steps to Reproduce**:
1. Switch to Spanish
2. Go to Settings > General
3. Scroll to "Save Settings" button
4. Observe text overflow

**Expected**: Button should truncate or wrap text

**Actual**: Text overflows and breaks layout

**Screenshots**: [attach]

**Browser**: Chrome 120, macOS
**Device**: Desktop, 1920x1080
**Translation key**: settings.saveSettings
```

---

**Next Steps**: After completing testing, update `docs/I18N-TRANSLATION-GUIDE.md` with any new findings or best practices.
