# Internationalization (i18n) Translation Guide

## Overview

AxCouncil now has comprehensive internationalization support, enabling the platform to serve users in multiple languages with proper RTL support for Arabic and Hebrew.

## Architecture Summary

### Frontend i18n
- **Library**: i18next + react-i18next
- **Supported Languages**: English (en), Spanish (es) - **100% complete**
- **Planned Languages**: German (de), French (fr), Portuguese (pt-BR), Japanese (ja), Chinese (zh-CN), Arabic (ar)
- **Translation Files**: `frontend/src/i18n/locales/{lang}.json`
- **Type Safety**: Full TypeScript support with `i18n.d.ts`

### Backend i18n
- **System**: Custom JSON-based translation system
- **Location**: `backend/locales/{lang}.json`
- **Usage**: `from backend.i18n import t, get_locale_from_request`

### AI Prompt i18n
- **System**: Custom JSON-based AI prompt translations
- **Location**: `backend/ai_prompts/{lang}.json`
- **Usage**: `from backend.ai_i18n import get_localized_prompt`

## Adding a New Language

### Step 1: Add Frontend Translation File

1. **Create translation file**:
   ```bash
   cp frontend/src/i18n/locales/en.json frontend/src/i18n/locales/de.json
   ```

2. **Translate all strings** in the new file to target language

3. **Update i18n configuration** (`frontend/src/i18n/index.ts`):
   ```typescript
   // Import the new translation
   import de from './locales/de.json';

   // Add to supportedLanguages array
   export const supportedLanguages = [
     { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
     { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
     { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' }, // New!
   ];

   // Add to resources
   i18n.init({
     resources: {
       en: { translation: en },
       es: { translation: es },
       de: { translation: de }, // New!
     },
     // ...
   });
   ```

### Step 2: Add Backend Translation File

1. **Create backend translation file**:
   ```bash
   cp backend/locales/en.json backend/locales/de.json
   ```

2. **Translate error messages and success messages** to target language

3. **No code changes needed** - the backend i18n system auto-detects available locales

### Step 3: Add AI Prompt Translation File

1. **Create AI prompt file**:
   ```bash
   cp backend/ai_prompts/en.json backend/ai_prompts/de.json
   ```

2. **Translate all AI system prompts** to target language

3. **Critical**: AI prompts must maintain the same tone, expertise, and structure as English

4. **Update supported locales** in `backend/ai_i18n.py`:
   ```python
   SUPPORTED_LOCALES = ['en', 'es', 'de']  # Add 'de'
   ```

### Step 4: Test the New Language

```bash
# Start dev server
cd frontend && npm run dev

# Switch language in Settings > General > Language
# Test:
# - UI displays correctly
# - Error messages in target language
# - AI council responds in target language
# - SEO meta tags in target language
# - Date/time/number formatting correct for locale
```

## Translation File Structure

### Frontend Translation Keys

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "auth": {
    "signIn": "Sign In",
    "signOut": "Sign Out"
  },
  "council": {
    "stage1": "Individual Responses",
    "stage2": "Peer Review",
    "stage3": "Final Synthesis"
  },
  "errors": {
    "generic": "Something went wrong"
  },
  "seo": {
    "defaultTitle": "AxCouncil - AI Decision Council",
    "defaultDescription": "Make better decisions..."
  }
}
```

### Backend Error Messages

```json
{
  "errors": {
    "not_found": "Resource not found",
    "unauthorized": "Unauthorized access",
    "validation_failed": "Validation failed"
  },
  "success": {
    "created": "{resource} created successfully",
    "updated": "{resource} updated successfully"
  }
}
```

### AI Prompt Structure

```json
{
  "council_chairman": "You are the Council Chairman...",
  "business_strategist": {
    "name": "Business Strategist",
    "description": "Documents company information clearly",
    "prompt": "You are a Business Strategist..."
  },
  "context_templates": {
    "company": "Company context: {name}...",
    "department": "Department: {name}..."
  }
}
```

## Translation Best Practices

### 1. Variable Interpolation

**Use curly braces** for variables:
```json
{
  "greeting": "Hello, {name}!",
  "itemCount": "You have {count} items",
  "fileSize": "File size: {size} MB"
}
```

**Usage in React**:
```typescript
t('greeting', { name: 'Alice' })  // "Hello, Alice!"
t('itemCount', { count: 5 })      // "You have 5 items"
```

### 2. Pluralization

**Use ICU format** for plural forms:
```json
{
  "items_one": "{{count}} item",
  "items_other": "{{count}} items",
  "minutesAgo_one": "{{count}} minute ago",
  "minutesAgo_other": "{{count}} minutes ago"
}
```

**Usage**:
```typescript
t('items', { count: 1 })  // "1 item"
t('items', { count: 5 })  // "5 items"
```

### 3. Context-Specific Translations

**Avoid generic keys**, use specific contexts:
```json
// ❌ Bad - Too generic
{
  "name": "Name"
}

// ✅ Good - Context-specific
{
  "auth": {
    "userName": "User name",
    "fullName": "Full name"
  },
  "company": {
    "companyName": "Company name"
  }
}
```

### 4. Preserve HTML and Markdown

**Keep HTML tags** in translations:
```json
{
  "welcomeMessage": "Welcome to <strong>AxCouncil</strong>!",
  "helpText": "Click **Save** to continue."
}
```

### 5. Cultural Adaptation

**Not just translation** - adapt for culture:
- Date formats (MM/DD/YYYY vs DD/MM/YYYY)
- Number formats (1,000.50 vs 1.000,50)
- Currency symbols ($100 vs 100€)
- Icons (mailbox, phone designs vary)
- Color meanings (red = danger vs celebration)

## RTL (Right-to-Left) Support

### CSS Logical Properties

All CSS has been converted to **logical properties** for RTL support:

```css
/* ❌ Old physical properties (don't use) */
margin-left: 16px;
padding-right: 8px;
text-align: left;
left: 0;

/* ✅ New logical properties (RTL-ready) */
margin-inline-start: 16px;
padding-inline-end: 8px;
text-align: start;
inset-inline-start: 0;
```

### Testing RTL Mode

```typescript
// In browser console or DevTools
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'ar';
```

**What to check**:
- [ ] Text flows right-to-left
- [ ] Icons and arrows flip correctly
- [ ] Margins/padding flip
- [ ] Scrollbars on left side
- [ ] Navigation menus on right side

## Date, Time, and Number Formatting

### Use Centralized Formatters

```typescript
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
} from '@/lib/formatters';

// Dates
formatDate(new Date(), 'short');        // "1/15/24" (US) or "15/1/24" (EU)
formatRelativeTime(new Date());         // "just now", "2 hours ago"

// Numbers
formatNumber(1234.56, 2);               // "1,234.56" (US) or "1.234,56" (EU)
formatCurrency(99.99, 'USD');           // "$99.99" (US) or "99,99 $" (EU)
formatPercent(0.75, 1);                 // "75.0%" (US) or "75,0%" (EU)

// File sizes
formatFileSize(1536000);                // "1.5 MB"
```

**Always use these** instead of `toLocaleString()` or manual formatting!

## SEO and i18n

### Using SEO Hooks

```typescript
import { useFullSEO } from '@/hooks';

function MyPage() {
  useFullSEO({
    title: t('seo.myPageTitle'),
    description: t('seo.myPageDescription'),
  });

  // ...
}
```

**This automatically adds**:
- Dynamic `<title>` tag
- Meta description
- Open Graph tags (og:title, og:description, og:image, og:locale)
- Twitter Card tags
- hreflang links for all supported languages
- Canonical URL

### hreflang Links

Automatically generated for each supported language:
```html
<link rel="alternate" hreflang="en" href="https://axcouncil.vercel.app/?lang=en" />
<link rel="alternate" hreflang="es" href="https://axcouncil.vercel.app/?lang=es" />
<link rel="alternate" hreflang="x-default" href="https://axcouncil.vercel.app/" />
```

## Translation Workflow (Professional)

### Recommended: Crowdin Integration

1. **Create Crowdin project** (free for open source, $50/mo for private)
2. **Upload source files** (`en.json`)
3. **Translators work in Crowdin** with context and screenshots
4. **Auto-sync to GitHub** via PR when translations complete

### Manual Translation Process

1. **Extract new strings** to `en.json`
2. **Commit English strings** first
3. **Create translation task** (GitHub Issue or Notion doc)
4. **Hire professional translators** (Upwork, Gengo, etc.)
5. **Provide context**: Screenshots, description, tone guidance
6. **Review translations** with native speaker
7. **Test** thoroughly before merging

## Common Translation Tasks

### Adding a New String

1. **Add to English** (`frontend/src/i18n/locales/en.json`):
   ```json
   {
     "newFeature": {
       "title": "New Feature Title",
       "description": "This is a new feature description"
     }
   }
   ```

2. **Add to all other languages** (Spanish, etc.):
   ```json
   {
     "newFeature": {
       "title": "Título de Nueva Función",
       "description": "Esta es una descripción de nueva función"
     }
   }
   ```

3. **Use in component**:
   ```typescript
   const { t } = useTranslation();
   return <h1>{t('newFeature.title')}</h1>;
   ```

### Updating an Existing String

1. **Update English first**
2. **Update all other languages**
3. **Search codebase** for usages to ensure context still correct

### Removing Unused Strings

1. **Search codebase** to confirm not used:
   ```bash
   grep -r "oldString" frontend/src/
   ```

2. **Remove from all language files** if unused

3. **Keep commonly reusable strings** even if temporarily unused

## Quality Assurance

### Translation Checklist

- [ ] All strings externalized (no hardcoded English)
- [ ] Consistent terminology across app
- [ ] Proper pluralization rules
- [ ] Variable interpolation works
- [ ] Date/time/number formatting correct
- [ ] UI layout doesn't break with longer translations (German ~30% longer)
- [ ] Tone matches brand voice
- [ ] Cultural adaptations applied
- [ ] Native speaker review complete

### Testing Checklist

- [ ] Switch to target language in Settings
- [ ] Test all major flows (sign up, create conversation, etc.)
- [ ] Check error messages display in target language
- [ ] Verify AI responds in target language
- [ ] Test date/number formatting
- [ ] Check SEO meta tags (View Source)
- [ ] Test on mobile and desktop
- [ ] For RTL: Enable `dir="rtl"` and verify layout

## Troubleshooting

### String Not Translating

1. **Check translation key exists** in `{lang}.json`
2. **Verify exact key path**: `t('section.subsection.key')`
3. **Check i18n initialization** in browser console: `window.i18n`
4. **Clear cache** and refresh

### Layout Broken in Translation

**Problem**: German text too long, breaks UI

**Solution**:
- Use CSS `overflow: hidden; text-overflow: ellipsis;`
- Or allow wrapping with `word-break: break-word;`
- Or redesign layout to be flexible

### RTL Layout Issues

**Problem**: Margins/padding don't flip in RTL

**Solution**: Run CSS conversion script:
```bash
python scripts/convert_css_to_logical.py --apply
```

## Resources

- **i18next Documentation**: https://www.i18next.com/
- **React i18next**: https://react.i18next.com/
- **ICU Message Format**: https://unicode-org.github.io/icu/userguide/format_parse/messages/
- **Crowdin**: https://crowdin.com/
- **Google Translate (quick drafts only)**: https://translate.google.com/
- **Professional translation services**: Gengo, Smartling, Phrase

## Maintenance

### Monthly Review

- [ ] Check for untranslated strings
- [ ] Review translation quality with native speakers
- [ ] Update outdated translations
- [ ] Add new languages based on user demographics

### When Adding New Features

1. **Externalize all strings immediately** (don't hardcode)
2. **Add to English first**, then translate
3. **Test in all supported languages** before merging
4. **Update this guide** if adding new translation patterns

---

**Questions?** Open an issue or contact the i18n team.
