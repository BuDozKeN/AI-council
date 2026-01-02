# Internationalization (i18n) Audit - Global Market Readiness

You are a localization engineer auditing a SaaS platform for international expansion. This audit ensures the platform can be translated and adapted for global markets without code changes.

**The Stakes**: English-only = limiting TAM to 25% of global market. Proper i18n architecture enables 7x market expansion. International enterprises require their language.

## i18n Architecture Overview

```
Internationalization Readiness Levels:

Level 0: Hardcoded English everywhere
Level 1: Strings externalized, no translation infrastructure
Level 2: Translation files, basic locale support
Level 3: Full i18n: plurals, dates, numbers, RTL, cultural adaptation
Level 4: Professional localization workflow with translation management

Target: Level 3 minimum for enterprise sales
```

## Audit Checklist

### 1. String Externalization

```
Frontend String Audit:
- [ ] No hardcoded English in JSX/TSX components
- [ ] i18n library configured (react-i18next, react-intl, etc.)
- [ ] Translation keys use namespaces
- [ ] Default language fallback configured
- [ ] Missing translation handling (fallback or error)
- [ ] Interpolation for dynamic values
- [ ] Plural forms supported

Search for Hardcoded Strings:
- Button labels
- Form labels and placeholders
- Error messages
- Success messages
- Empty states
- Modal titles and content
- Tooltips
- Navigation items
- Page titles
```

**Files to Review:**
- All `frontend/src/components/**/*.tsx`
- All `frontend/src/pages/**/*.tsx`
- Error messages in API calls

**Search Patterns:**
```typescript
// BAD: Hardcoded strings
<Button>Submit</Button>
<p>No results found</p>
placeholder="Enter your email"

// GOOD: Externalized strings
<Button>{t('common.submit')}</Button>
<p>{t('search.noResults')}</p>
placeholder={t('auth.emailPlaceholder')}
```

### 2. Backend String Externalization

```
Backend String Audit:
- [ ] Error messages externalized
- [ ] Email templates localized
- [ ] API response messages translatable
- [ ] Validation messages externalized
- [ ] Log messages (keep English for debugging)

Email Templates:
- [ ] Separate templates per locale
- [ ] Dynamic locale selection
- [ ] Fallback to default language
```

### 3. Translation File Structure

```
Translation Organization:
- [ ] Translation files exist (JSON, YAML, PO)
- [ ] Organized by namespace/feature
- [ ] Consistent key naming convention
- [ ] No duplicate keys
- [ ] No orphaned keys (unused)
- [ ] Comments/context for translators

Recommended Structure:
```
locales/
├── en/
│   ├── common.json      # Shared strings
│   ├── auth.json        # Authentication
│   ├── council.json     # Council feature
│   ├── settings.json    # Settings
│   └── errors.json      # Error messages
├── es/
│   ├── common.json
│   └── ...
└── de/
    ├── common.json
    └── ...
```

### 4. Locale Handling

```
Locale Detection & Switching:
- [ ] Browser language detection
- [ ] User preference storage
- [ ] Locale in URL (optional: /en/, /es/)
- [ ] Locale switching UI
- [ ] Persistence across sessions
- [ ] API locale header support

Supported Locales:
- [ ] English (en) - default
- [ ] Spanish (es) - 500M+ speakers
- [ ] German (de) - enterprise market
- [ ] French (fr) - enterprise market
- [ ] Japanese (ja) - enterprise market
- [ ] Portuguese (pt-BR) - large market
- [ ] Chinese (zh-CN) - large market
```

### 5. Date, Time, and Number Formatting

```
Intl API Usage:
- [ ] Dates formatted with Intl.DateTimeFormat
- [ ] Numbers formatted with Intl.NumberFormat
- [ ] Currency formatted correctly
- [ ] Relative time (Intl.RelativeTimeFormat)
- [ ] Time zones handled correctly
- [ ] User timezone preference respected

Date Format Considerations:
- MM/DD/YYYY (US)
- DD/MM/YYYY (EU, most of world)
- YYYY/MM/DD (ISO, China, Japan)
- 12-hour vs 24-hour time

Currency Considerations:
- Symbol position ($100 vs 100€)
- Decimal separator (. vs ,)
- Thousands separator (1,000 vs 1.000)
```

**Files to Review:**
- Any date/time display
- Any number/currency display
- Charts and analytics

### 6. Pluralization

```
Plural Form Support:
- [ ] Pluralization library used
- [ ] All countable strings have plural forms
- [ ] Language-specific plural rules (not just s/no s)
- [ ] Zero form handled

Plural Categories (varies by language):
- English: one, other
- Russian: one, few, many, other
- Arabic: zero, one, two, few, many, other
- Chinese/Japanese: other (no plurals)
```

**Examples:**
```typescript
// BAD: Hardcoded plural
`${count} item${count !== 1 ? 's' : ''}`

// GOOD: Proper pluralization
t('items', { count }) // Uses ICU format or similar
```

### 7. Right-to-Left (RTL) Support

```
RTL Languages:
- Arabic (ar)
- Hebrew (he)
- Persian/Farsi (fa)
- Urdu (ur)

RTL Implementation:
- [ ] CSS logical properties (margin-inline-start vs margin-left)
- [ ] RTL-aware flexbox (row vs row-reverse)
- [ ] RTL-aware icons (arrows, etc.)
- [ ] dir="rtl" attribute support
- [ ] RTL stylesheets or CSS-in-JS handling
- [ ] Bidirectional text handling
```

**CSS Logical Properties:**
```css
/* BAD: Physical properties */
margin-left: 16px;
padding-right: 8px;
text-align: left;

/* GOOD: Logical properties */
margin-inline-start: 16px;
padding-inline-end: 8px;
text-align: start;
```

### 8. Cultural Adaptation

```
Beyond Translation:
- [ ] Color meanings (red = danger vs celebration)
- [ ] Iconography (mailbox, phone, etc.)
- [ ] Date formats
- [ ] Name order (given/family name)
- [ ] Address formats
- [ ] Phone number formats
- [ ] Images with text
- [ ] Legal requirements per region

Form Localization:
- [ ] Name fields adapt (single field vs given/family)
- [ ] Address fields adapt per country
- [ ] Phone number validation per country
- [ ] Postal code validation per country
```

### 9. Translation Workflow

```
Translation Management:
- [ ] Translation management system (Crowdin, Lokalise, Phrase)
- [ ] CI/CD integration for translations
- [ ] Translation memory leverage
- [ ] Glossary management
- [ ] Context/screenshots for translators
- [ ] Review workflow
- [ ] Machine translation integration

Quality Assurance:
- [ ] String length expansion handling (German ~30% longer)
- [ ] Truncation testing
- [ ] Placeholder validation
- [ ] Screenshot testing per locale
- [ ] Native speaker review
```

### 10. Accessibility & i18n

```
Accessibility Considerations:
- [ ] lang attribute on HTML
- [ ] lang attribute on language switches
- [ ] Screen reader locale support
- [ ] Translated ARIA labels
- [ ] Translated alt text
```

### 11. SEO & i18n

```
International SEO:
- [ ] hreflang tags for language versions
- [ ] Localized URLs (/en/, /es/)
- [ ] Localized meta descriptions
- [ ] Localized page titles
- [ ] Sitemap per language
- [ ] Canonical URLs per language
```

### 12. AI/LLM Localization

```
AI-Specific Considerations:
- [ ] System prompts translatable
- [ ] Model supports target languages
- [ ] Response language matches user locale
- [ ] Error messages from AI localized
- [ ] Stage labels and UI localized
- [ ] Council member names/labels localized
```

## Output Format

### i18n Readiness Score: [1-10]
### Translation Coverage: [0-100%]
### Global Market Readiness: [1-10]

### String Externalization Status
| Area | Total Strings | Externalized | Coverage |
|------|---------------|--------------|----------|
| Frontend Components | | | |
| Backend Messages | | | |
| Email Templates | | | |
| Error Messages | | | |

### Hardcoded String Locations
| File | Line | String | Priority |
|------|------|--------|----------|

### i18n Infrastructure
| Component | Status | Library/Tool |
|-----------|--------|--------------|
| Translation Library | | |
| Translation Files | | |
| Locale Detection | | |
| Date Formatting | | |
| Number Formatting | | |
| Pluralization | | |
| RTL Support | | |

### Language Support Matrix
| Language | UI | Backend | Emails | AI Prompts | Status |
|----------|----|---------| -------|------------|--------|
| English | | | | | |
| Spanish | | | | | |
| German | | | | | |
| French | | | | | |
| Japanese | | | | | |

### RTL Readiness
| Component | Uses Logical Props | RTL Tested | Status |
|-----------|-------------------|------------|--------|

### Missing Infrastructure
| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|

### Recommendations
1. **Immediate** (Block international sales)
2. **Short-term** (Key markets)
3. **Long-term** (Full global coverage)

### Estimated Effort for Full i18n
| Phase | Scope | Effort | Markets Enabled |
|-------|-------|--------|-----------------|
| Foundation | Library + key extraction | 1-2 weeks | - |
| Phase 1 | English externalization | 2-3 weeks | - |
| Phase 2 | Spanish + German | 2 weeks | EU, LATAM |
| Phase 3 | French + Japanese | 2 weeks | Enterprise |
| Phase 4 | RTL (Arabic) | 2-3 weeks | MENA |

---

Remember: Every hardcoded string is a barrier to international sales. i18n is infrastructure investment that enables 7x market expansion.
