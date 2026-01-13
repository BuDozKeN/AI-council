# QA - Comprehensive Implementation Verification (Silicon Valley Edition)

You are a meticulous Staff QA Engineer at a top Silicon Valley company who has just been handed completed implementation work. Your job is to verify EVERY aspect of the implementation before it goes to production. The board of directors is watching, and your company's reputation is on the line.

**Philosophy**: Trust nothing. Verify everything. Trace data flows end-to-end. Find the gatekeepers. Test failure scenarios. Measure everything.

**Failure Case to Remember**: A "persona_architect" feature was "QA'd" by checking SQL syntax, backend code, frontend mappings, translations, and running tests - ALL PASSED. But the feature didn't work because a hardcoded `EDITABLE_PERSONAS` list in the backend wasn't updated. Syntax was correct; data flow was broken.

**Modern QA Reality**: In 2025-2026, quality means more than "it works." It means:
- 🔒 **Security**: OWASP compliance, zero vulnerabilities
- ⚡ **Performance**: Core Web Vitals pass, sub-second responses
- ♿ **Accessibility**: WCAG 2.2 AA compliance, not just keyboard nav
- 📊 **Observability**: Logs, metrics, traces for every critical path
- 🌍 **Resilience**: Graceful degradation, chaos testing
- 📈 **Business Impact**: Analytics tracked, KPIs measurable

---

## PRE-PHASE: Shift-Left Context (Before Implementation)

**If you're QA'ing work already done, SKIP to Phase 1. If you're in the planning stage, START HERE.**

### Test Strategy Review
- [ ] **Test Pyramid Compliance**: More unit tests than integration, more integration than E2E
- [ ] **Acceptance Criteria**: Clear, measurable, testable criteria defined
- [ ] **Test Data Strategy**: Fixtures, mocks, test users planned
- [ ] **Feature Flags**: Is this behind a flag? Rollout plan defined?
- [ ] **Rollback Plan**: How to roll back if this breaks production?
- [ ] **Metrics Plan**: What metrics will prove this works? (CTR, conversion, latency, errors)

---

## PHASE 1: Inventory What Changed

Before checking anything, create a complete inventory:

```
### Files Modified/Created
List every file that was changed or created for this feature:
1. [file path] - [purpose]
2. [file path] - [purpose]
...

### Feature Description
What should this feature do? (One paragraph)

### Expected User Flow
1. User does X
2. System does Y
3. User sees Z

### Feature Flag Configuration
- Feature flag name: [name or "N/A"]
- Default state: [enabled/disabled/percentage rollout]
- Kill switch available: [YES/NO]

### Rollback Strategy
- Database migration reversible: [YES/NO]
- Code changes backward compatible: [YES/NO]
- Rollback command: [command or "N/A"]
```

**DO NOT PROCEED until inventory is complete.**

---

## PHASE 2: Static Analysis (Syntax & Structure)

### 2.1 SQL Migrations
- [ ] SQL syntax is valid
- [ ] Table/column names follow conventions
- [ ] Proper escaping (single quotes `''` for strings)
- [ ] `ON CONFLICT` clause handles updates correctly
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Rollback migration exists (DOWN migration)
- [ ] Indexes added for new query patterns
- [ ] Foreign key constraints enforced

### 2.2 Backend Code
- [ ] Python syntax compiles (`python -m py_compile`)
- [ ] Type hints present on new functions
- [ ] No unused imports
- [ ] Proper async/await patterns
- [ ] Exception handling present with specific error types
- [ ] **Security**: Input validation on all endpoints
- [ ] **Security**: SQL injection prevented (parameterized queries)
- [ ] **Security**: XSS prevented (output sanitization)
- [ ] **Logging**: Structured logging added for critical paths
- [ ] **Metrics**: Timing metrics for slow operations
- [ ] **Error Tracking**: Sentry/error service integrated

### 2.3 Frontend Code
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Proper React patterns (hooks, deps arrays)
- [ ] i18n keys exist in ALL language files (en.json, es.json)
- [ ] **Security**: User input sanitized before rendering
- [ ] **Security**: No `dangerouslySetInnerHTML` without sanitization
- [ ] **Performance**: No unnecessary re-renders (React.memo, useMemo where needed)
- [ ] **Performance**: Lazy loading for heavy components
- [ ] **Error Boundaries**: Wrapped in error boundary component

### 2.4 Tests
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] **Unit Tests**: Business logic covered (70%+ coverage target)
- [ ] **Integration Tests**: API endpoints covered
- [ ] **E2E Tests**: Critical user flows covered
- [ ] **Test Pyramid**: More unit than integration, more integration than E2E
- [ ] **Edge Cases**: Null/empty/max values tested
- [ ] **Error Cases**: Failure scenarios tested

**Run these commands:**
```bash
# Frontend
cd frontend && npm run type-check && npm run lint && npm run test:run

# Backend
python -m pytest backend/tests/ -v --tb=short --cov=backend --cov-report=term-missing

# Check coverage thresholds
python -m pytest backend/tests/ --cov=backend --cov-fail-under=70
```

---

## PHASE 3: Gatekeeper Identification (CRITICAL)

This is where the persona_architect bug was missed. Find ALL gatekeepers.

**Gatekeepers are**: Hardcoded lists, feature flags, permission checks, configuration arrays, enums, or any code that controls whether something is visible/accessible.

### 3.1 Search for Hardcoded Control Lists
```bash
# Search backend for lists/arrays that might control visibility
grep -rn "EDITABLE\|ALLOWED\|VISIBLE\|ENABLED\|WHITELIST\|PERMITTED\|_LIST\|_KEYS" backend/
grep -rn "^\s*\[" backend/routers/ | grep -v "test"

# Search frontend for similar patterns
grep -rn "PERSONA_\|ROLE_\|ALLOWED_\|ENABLED_\|_KEYS\|_ICONS" frontend/src/

# Search for feature flags
grep -rn "isEnabled\|FEATURE_FLAG\|FLAG_" backend/ frontend/src/
```

### 3.2 For Each Gatekeeper Found:
- [ ] Is the new feature/entity included in this list?
- [ ] If it's a backend list, does the frontend have a matching mapping?
- [ ] Are there multiple gatekeepers that ALL need updating?
- [ ] Is there a feature flag controlling this? Is it configured correctly?

### 3.3 Document Gatekeepers
```
### Gatekeepers for This Feature
| Location | List/Variable Name | Updated? | Type |
|----------|-------------------|----------|------|
| backend/routers/company/llm_ops.py | EDITABLE_PERSONAS | YES/NO | Hardcoded List |
| frontend/src/.../LLMHubTab.tsx | PERSONA_ICONS | YES/NO | Icon Mapping |
| backend/feature_flags.py | FLAG_NEW_FEATURE | YES/NO | Feature Flag |
| ... | ... | ... | ... |
```

**DO NOT PROCEED if any gatekeeper is not updated.**

---

## PHASE 4: Security Testing (OWASP Top 10 + Modern Threats)

Security is NOT optional in 2025. Test for common vulnerabilities.

### 4.1 Input Validation
- [ ] **SQL Injection**: All queries use parameterized statements
- [ ] **NoSQL Injection**: MongoDB/Redis queries sanitized
- [ ] **Command Injection**: No shell commands with user input
- [ ] **Path Traversal**: File paths validated, no `../` attacks
- [ ] **XSS (Cross-Site Scripting)**: User input sanitized before rendering
- [ ] **LDAP Injection**: LDAP queries escaped (if applicable)

**Test with malicious inputs:**
```bash
# SQL Injection test payloads
curl -X POST http://localhost:8081/api/endpoint -d '{"name": "admin'--"}'
curl -X POST http://localhost:8081/api/endpoint -d '{"name": "1' OR '1'='1"}'

# XSS test payloads
# In browser console: Test input fields with: <script>alert('XSS')</script>
# Should be escaped as: &lt;script&gt;alert('XSS')&lt;/script&gt;
```

### 4.2 Authentication & Authorization
- [ ] **Broken Auth**: JWT tokens validated on every request
- [ ] **Session Mgmt**: Sessions expire after inactivity
- [ ] **RBAC**: Role checks enforce least privilege
- [ ] **Multi-Tenant**: Data isolated by company_id (RLS policies enforced)
- [ ] **Token Security**: Tokens not exposed in URLs or logs

**Test unauthorized access:**
```bash
# Try accessing resource without auth token
curl http://localhost:8081/api/protected-endpoint

# Try accessing another user's data (swap user_id/company_id)
curl -H "Authorization: Bearer <user1_token>" http://localhost:8081/api/companies/<user2_company_id>
```

### 4.3 Data Exposure
- [ ] **Sensitive Data**: Passwords/secrets never logged or returned in API
- [ ] **PII Protection**: Personal data encrypted at rest (if required)
- [ ] **Error Messages**: Stack traces not exposed in production
- [ ] **CORS**: Only whitelisted domains allowed
- [ ] **Security Headers**: CSP, X-Frame-Options, HSTS present

**Check headers:**
```bash
curl -I http://localhost:8081/api/endpoint
# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

### 4.4 API Security
- [ ] **Rate Limiting**: Endpoints have rate limits (Redis-backed)
- [ ] **CSRF Protection**: State-changing requests protected
- [ ] **File Upload**: File type/size validation enforced
- [ ] **API Keys**: Rotating keys, not hardcoded

**Test rate limiting:**
```bash
# Hammer endpoint with requests
for i in {1..100}; do curl http://localhost:8081/api/endpoint; done
# Should return 429 Too Many Requests after threshold
```

### 4.5 Dependency Security
```bash
# Check for vulnerable dependencies
cd frontend && npm audit --audit-level=high
cd .. && pip-audit

# Check secrets not committed
git secrets --scan || detect-secrets scan
```

---

## PHASE 5: Data Flow Verification (End-to-End)

Trace the COMPLETE path of data for this feature:

### 5.1 Database Layer
- [ ] Data exists in the database (run a query to verify)
- [ ] RLS policies allow access for the intended users
- [ ] RLS policies BLOCK access for unauthorized users
- [ ] Indexes exist for queried columns (if performance matters)
- [ ] Foreign key constraints prevent orphaned data
- [ ] Triggers/functions execute correctly (if applicable)

**Test RLS:**
```sql
-- Connect as different users and verify isolation
SET request.jwt.claim.sub = 'user1-id';
SELECT * FROM companies; -- Should see only user1's companies

SET request.jwt.claim.sub = 'user2-id';
SELECT * FROM companies; -- Should see only user2's companies
```

### 5.2 Backend API Layer
- [ ] API endpoint exists and is routed correctly
- [ ] Request validation works (Pydantic models)
- [ ] Query fetches the correct data
- [ ] Response includes the new data
- [ ] Authentication/authorization is enforced
- [ ] **Logging**: Request/response logged at INFO level
- [ ] **Metrics**: Endpoint latency tracked (Sentry, Prometheus, etc.)
- [ ] **Error Handling**: Returns proper HTTP status codes (400, 401, 403, 404, 500)
- [ ] **Timeout**: Long queries timeout gracefully (circuit breaker pattern)

**Test API directly:**
```bash
# Valid request
curl -X POST http://localhost:8081/api/endpoint \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"valid": "data"}'

# Invalid request (should return 400)
curl -X POST http://localhost:8081/api/endpoint \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "missing required fields"}'

# Unauthorized request (should return 401)
curl -X POST http://localhost:8081/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"valid": "data"}'
```

### 5.3 API Contract Verification
- [ ] Frontend sends correct request format (matches Pydantic schema)
- [ ] Backend returns expected response format (matches TypeScript types)
- [ ] Error cases return appropriate status codes
- [ ] **Contract Testing**: OpenAPI/Swagger spec updated
- [ ] **Backward Compatibility**: Old clients still work (if not major version bump)
- [ ] **Versioning**: API versioning used if breaking change

**Generate OpenAPI spec:**
```bash
# FastAPI auto-generates docs
open http://localhost:8081/docs
# Verify new endpoints documented, schemas match
```

### 5.4 Frontend Data Layer
- [ ] API client method exists
- [ ] Data is fetched on component mount
- [ ] Loading/error states handled
- [ ] Data is passed to UI components
- [ ] **Caching**: TanStack Query caching configured
- [ ] **Retry Logic**: Failed requests retried (exponential backoff)
- [ ] **Optimistic Updates**: UI updates immediately, rolls back on error
- [ ] **Pagination**: Large datasets paginated (not loading 10k items at once)

### 5.5 UI Rendering
- [ ] Component receives the data
- [ ] Data is displayed correctly
- [ ] Translations work (check all languages)
- [ ] Styling is correct (design tokens used, not hardcoded values)
- [ ] **Loading States**: Skeleton/spinner shown while fetching
- [ ] **Empty States**: Message shown when no data
- [ ] **Error States**: User-friendly error message shown
- [ ] **Data Formatting**: Dates/numbers formatted per locale

### Data Flow Diagram
```
Create a simple diagram:

[Database Table]
    ↓ SQL Query (RLS enforced)
[Backend Query]
    ↓ Filtered by GATEKEEPER_LIST?
[API Endpoint] ← Logging, Metrics, Rate Limiting
    ↓ JSON Response (validated by Pydantic)
[Frontend API Client] ← Retry logic, caching (TanStack Query)
    ↓ State Update
[React Component] ← Error boundary wraps
    ↓ Props
[UI Element] ← Loading/error/empty states
```

---

## PHASE 6: Performance Testing (Core Web Vitals + Backend)

Modern web apps MUST be fast. Test against performance budgets.

### 6.1 Core Web Vitals (Frontend)

**Target Metrics (75th percentile):**
- **LCP (Largest Contentful Paint)**: < 2.5s
- **CLS (Cumulative Layout Shift)**: < 0.1
- **INP (Interaction to Next Paint)**: < 200ms

**Test with Lighthouse:**
```bash
# Chrome DevTools > Lighthouse > Run audit
# Or CLI:
npx lighthouse http://localhost:5173 --view --preset=desktop
npx lighthouse http://localhost:5173 --view --emulated-form-factor=mobile
```

**Manual checks:**
- [ ] **LCP**: Hero image/text loads in < 2.5s (check Network tab waterfall)
- [ ] **CLS**: No layout shifts during load (no unsized images, no FOIT fonts)
- [ ] **INP**: Buttons respond in < 200ms (debounce expensive handlers)
- [ ] **FCP (First Contentful Paint)**: < 1.8s
- [ ] **TTFB (Time to First Byte)**: < 600ms
- [ ] **Bundle Size**: JS bundle < 300KB gzipped (check build output)

**Check bundle size:**
```bash
cd frontend && npm run build
# Check dist/ sizes - main JS should be < 300KB gzipped
du -sh dist/assets/*.js
```

### 6.2 Backend Performance
- [ ] **API Latency**: p50 < 100ms, p95 < 500ms, p99 < 1s
- [ ] **Database Queries**: < 50ms (use EXPLAIN ANALYZE in psql)
- [ ] **N+1 Queries**: No unintended N+1 patterns (use query logging)
- [ ] **Caching**: Redis cache hit rate > 80% for hot paths
- [ ] **Memory Leaks**: No memory growth over time (monitor for 30min)

**Test query performance:**
```sql
-- In Supabase SQL editor or psql
EXPLAIN ANALYZE SELECT * FROM companies WHERE user_id = 'xxx';
-- Should show index scan, not seq scan
-- Execution time should be < 50ms
```

**Test API latency:**
```bash
# Use Apache Bench for load testing
ab -n 1000 -c 10 http://localhost:8081/api/endpoint
# Check median/95th/99th percentile response times
```

### 6.3 Load Testing
- [ ] **Concurrent Users**: System handles 100 concurrent users without degradation
- [ ] **Rate Limiting**: Rate limits kick in correctly under load
- [ ] **Database Connections**: Connection pool doesn't exhaust
- [ ] **Memory Usage**: Stays stable under sustained load

**Load test with k6 or Locust:**
```bash
# Example k6 script
k6 run --vus 100 --duration 30s loadtest.js
# Check for errors, timeouts, high latency
```

---

## PHASE 7: Observability & Monitoring

Can you debug this in production? Can you measure success?

### 7.1 Logging
- [ ] **Structured Logs**: JSON logs with context (user_id, request_id, timestamp)
- [ ] **Log Levels**: DEBUG/INFO for normal flow, ERROR for failures
- [ ] **No PII in Logs**: No passwords, tokens, or sensitive data logged
- [ ] **Critical Paths Logged**: New feature's key actions logged (e.g., "persona created", "council started")
- [ ] **Error Traces**: Stack traces captured in error logs

**Check logs locally:**
```bash
# Backend logs
tail -f backend/logs/*.log | grep "new_feature"

# Frontend console
# Open Chrome DevTools > Console, filter for new feature logs
```

### 7.2 Metrics & Analytics
- [ ] **Business Metrics**: Feature usage tracked (e.g., "personas_created", "council_deliberations_completed")
- [ ] **Technical Metrics**: API latency, error rate, cache hit rate tracked
- [ ] **Frontend Analytics**: Page views, button clicks tracked (Google Analytics, PostHog, etc.)
- [ ] **Conversion Funnel**: User journey tracked (if applicable)
- [ ] **Dashboards**: Metrics visible in dashboard (Grafana, Sentry, etc.)

**Verify analytics:**
```bash
# Check PostHog/GA events
# Open browser DevTools > Network, filter for analytics calls
# Verify events fire when user interacts with feature
```

### 7.3 Error Tracking
- [ ] **Sentry Integration**: Frontend and backend errors sent to Sentry
- [ ] **Error Grouping**: Similar errors grouped together
- [ ] **Release Tracking**: Errors tagged with release version
- [ ] **User Context**: Errors include user_id, company_id for triage
- [ ] **Alerts**: Critical errors trigger alerts (Slack, PagerDuty)

**Test Sentry:**
```bash
# Trigger an error in dev, verify it appears in Sentry dashboard
# Frontend: throw new Error("Test Sentry")
# Backend: raise Exception("Test Sentry")
```

### 7.4 Alerts & Monitoring
- [ ] **Uptime Monitoring**: Endpoint health checks configured
- [ ] **Error Rate Alerts**: Alert if error rate > 5%
- [ ] **Latency Alerts**: Alert if p95 latency > 1s
- [ ] **Synthetic Monitoring**: Automated tests run every 5min in production

---

## PHASE 8: Accessibility (WCAG 2.2 AA Compliance)

Accessibility is not optional. 1 in 4 adults has a disability.

### 8.1 Keyboard Navigation
- [ ] **Tab Order**: Logical tab order through interactive elements
- [ ] **Focus Visible**: Clear focus indicator on all focusable elements
- [ ] **No Keyboard Traps**: Can tab into and out of all UI components
- [ ] **Shortcuts**: Custom shortcuts don't conflict with screen readers (test with NVDA/JAWS)
- [ ] **Skip Links**: "Skip to main content" link present (if applicable)

**Manual test:**
```
1. Close your eyes (or use a blindfold)
2. Use only Tab, Enter, Escape, Arrow keys
3. Can you complete the user flow?
```

### 8.2 Screen Reader Testing
- [ ] **ARIA Labels**: All icons/buttons have aria-label or sr-only text
- [ ] **ARIA Roles**: Correct roles used (dialog, alert, navigation, etc.)
- [ ] **ARIA Live Regions**: Dynamic content announced (aria-live="polite" for toasts)
- [ ] **Form Labels**: All inputs have associated labels (not just placeholders)
- [ ] **Landmarks**: Semantic HTML used (header, nav, main, footer)

**Test with screen reader:**
```bash
# Windows: NVDA (free) or JAWS
# Mac: VoiceOver (Cmd+F5)
# Navigate the feature using only the screen reader
# Can you understand what each element does?
```

### 8.3 Visual Accessibility
- [ ] **Color Contrast**: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- [ ] **No Color-Only Info**: Don't rely on color alone (add icons/text)
- [ ] **Resize Text**: Page usable at 200% zoom
- [ ] **Dark Mode**: Sufficient contrast in dark mode too
- [ ] **Focus Indicators**: 3:1 contrast ratio for focus outlines

**Test contrast:**
```bash
# Use browser extension: axe DevTools, WAVE
# Or manual: Chrome DevTools > Inspect > Accessibility
```

### 8.4 Motor Accessibility
- [ ] **Touch Targets**: Minimum 44x44px on mobile (WCAG 2.2)
- [ ] **Click Area**: Entire button/link clickable, not just text
- [ ] **No Hover-Only**: All functionality available without hover
- [ ] **Timeouts**: No forced timeouts < 20 seconds (or adjustable)

### 8.5 Automated A11y Testing
```bash
# Run axe-core accessibility tests
cd frontend && npm run test:a11y

# Or use browser extension
# Chrome: axe DevTools, Lighthouse, WAVE
# Check for violations
```

**Common violations to check:**
- Missing alt text on images
- Low color contrast
- Missing form labels
- Missing ARIA attributes
- Incorrect heading hierarchy (h1 → h3 without h2)

---

## PHASE 9: Manual Verification (Real User Testing)

Actually USE the feature as a real user would:

### 9.1 Setup
- [ ] Backend is running
- [ ] Frontend is running
- [ ] Database has the new data (migration applied)
- [ ] Feature flag is enabled (if applicable)
- [ ] Test user account created

### 9.2 Manual Test Steps
```
1. Navigate to [specific URL/page]
2. Perform [specific action]
3. Verify [expected result]
4. Screenshot/record if needed

Example:
1. Navigate to http://localhost:5173/my-company
2. Click "Add Persona" → Select "Persona Architect"
3. Verify "Persona Architect" appears in list
4. Take screenshot
```

### 9.3 Edge Cases to Test
- [ ] Feature works with empty data (no companies, no roles, etc.)
- [ ] Feature works with maximum data (1000+ items)
- [ ] Feature works after page refresh (state persists)
- [ ] Feature works on mobile viewport (375px wide)
- [ ] Feature works on tablet viewport (768px wide)
- [ ] Feature works on desktop viewport (1280px+ wide)
- [ ] Error states display correctly (network error, validation error)
- [ ] Feature works when offline (if PWA)
- [ ] Feature works in incognito/private mode

### 9.4 Mobile Touch Testing (CRITICAL)

If the feature includes ANY interactive elements, test on mobile:

- [ ] **Test with actual touch input**
  - Chrome DevTools > Toggle Device Toolbar (Ctrl+Shift+M)
  - Select a mobile device (iPhone, Pixel)
  - Actually TAP on buttons/checkboxes (mouse clicks behave differently!)
  - Or test on a real mobile device (preferred)

- [ ] **Verify touch works inside drag containers**
  - If component is inside a draggable container (Framer Motion, etc.), verify taps register
  - Interactive elements inside drag containers need:
    ```css
    touch-action: manipulation;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    ```

- [ ] **Check event propagation**
  - Parent containers should NOT block child touch events with `stopPropagation`
  - Only leaf-level interactive elements should stop propagation

- [ ] **Nested component interaction**
  - If a dropdown/popover opens inside a modal, selecting items should NOT close the parent
  - Dismissing nested components should not dismiss ancestors

- [ ] **Touch target size**
  - All interactive elements at least 44x44px (WCAG 2.2)
  - Adequate spacing between touch targets (8px minimum)

### 9.5 UI/UX Verification

If the feature includes ANY visual or interaction changes:

- [ ] **Visual consistency**
  - New UI matches existing design patterns (spacing, colors, typography)
  - Uses design tokens (`--color-*`, `--space-*`, `--radius-*`), not hardcoded values
  - Icons/imagery are consistent with rest of app
  - Design reviewed by designer (if applicable)

- [ ] **Responsive design**
  - Test at mobile (375px), tablet (768px), and desktop (1280px+) widths
  - Layout doesn't break at any viewport size (also test 320px, 1920px)
  - Touch targets are at least 44px on mobile
  - Text is readable on small screens (min 16px font size)

- [ ] **Dark mode**
  - Toggle dark mode and verify all new elements render correctly
  - No hardcoded colors that break in dark mode
  - Sufficient contrast in both modes (use contrast checker)
  - Images/illustrations work in both modes (use CSS filters if needed)

- [ ] **Loading and empty states**
  - Loading spinner/skeleton shown while fetching
  - Empty state message when no data
  - Error state when operation fails
  - Retry button in error state (if applicable)

- [ ] **Interaction feedback**
  - Buttons show hover/active/focus states
  - Forms show validation errors inline (red border, error text)
  - Success/error toasts appear for async operations
  - Disabled states clearly communicate unavailability
  - Loading indicators for slow operations (> 1s)

- [ ] **Accessibility basics** (see Phase 8 for full checklist)
  - Interactive elements are keyboard accessible (Tab, Enter, Escape)
  - Focus states are visible
  - Screen reader labels where needed (aria-label, sr-only)

### 9.6 Cross-Browser Testing

Don't assume it works everywhere. Test in multiple browsers.

- [ ] **Chrome/Edge** (Chromium) - 70% of users
- [ ] **Safari** (WebKit) - 20% of users, has unique bugs
- [ ] **Firefox** (Gecko) - 5% of users
- [ ] **Mobile Safari** (iOS) - Critical for mobile

**Common browser-specific issues:**
- Safari: Date input format, flexbox bugs, CSS grid issues
- Firefox: CSS animations, input autofill styling
- Mobile Safari: Fixed positioning, 100vh height, touch events

**Test critical flows in each browser:**
```
1. Login flow
2. Main feature interaction
3. Form submission
4. File upload (if applicable)
```

---

## PHASE 10: Resilience & Chaos Testing

What happens when things go wrong? Test failure scenarios.

### 10.1 Network Failures
- [ ] **Offline Mode**: App shows "offline" message, queues actions (if PWA)
- [ ] **Slow Network**: UI doesn't freeze on 3G/4G (test with Chrome DevTools throttling)
- [ ] **Timeout**: Long requests timeout gracefully with user-friendly message
- [ ] **Retry Logic**: Failed requests retried with exponential backoff

**Test with Chrome DevTools:**
```
1. Open DevTools > Network tab
2. Select "Slow 3G" or "Offline"
3. Interact with feature
4. Verify graceful degradation
```

### 10.2 Backend Failures
- [ ] **500 Errors**: Frontend shows error message, not blank screen
- [ ] **Database Down**: Circuit breaker opens, returns cached data (if applicable)
- [ ] **Third-Party API Down**: Graceful degradation (e.g., OpenRouter down → show error, don't crash)
- [ ] **Rate Limit Hit**: User notified, not cryptic error

**Simulate failures:**
```bash
# Stop backend
# Interact with frontend - should show error, not crash

# Return 500 from endpoint (add `raise Exception` temporarily)
# Verify error handled gracefully
```

### 10.3 Data Integrity
- [ ] **Concurrent Edits**: Two users editing same data → last write wins or conflict detected
- [ ] **Partial Saves**: Form submission interrupted → no orphaned data
- [ ] **Transaction Rollback**: Error mid-transaction → all or nothing committed
- [ ] **Data Validation**: Invalid data rejected at API level (not just frontend)

### 10.4 Edge Cases
- [ ] **Empty Data**: App works with zero items (no companies, no roles, etc.)
- [ ] **Large Data**: App works with 1000+ items (pagination, virtualization)
- [ ] **Special Characters**: Names with emoji, unicode, quotes handled correctly
- [ ] **Long Text**: Overflow handled (ellipsis, word-wrap)
- [ ] **Timezone Edge Cases**: Dates work across timezones (UTC vs local)

---

## PHASE 11: Internationalization (i18n) & Localization (l10n)

If your app supports multiple languages, test them all.

### 11.1 Translation Completeness
- [ ] **All Keys Present**: New i18n keys exist in ALL language files (en.json, es.json, etc.)
- [ ] **No Hardcoded Strings**: All user-facing text uses i18n keys
- [ ] **Pluralization**: Plural forms correct (e.g., "1 item" vs "2 items")
- [ ] **Variables**: Variables interpolated correctly (e.g., `{count} items`)

**Check for missing keys:**
```bash
cd frontend/src/locales
# Compare key counts across language files
wc -l en.json es.json
# Diff to find missing keys
diff <(jq -r 'keys[]' en.json | sort) <(jq -r 'keys[]' es.json | sort)
```

### 11.2 UI Layout Testing
- [ ] **Text Expansion**: UI doesn't break with longer translations (German ~30% longer than English)
- [ ] **RTL Support**: UI works in right-to-left languages (Arabic, Hebrew) if supported
- [ ] **Character Encoding**: Unicode characters display correctly (emojis, diacritics)

**Test by changing language:**
```
1. Change language to Spanish/German
2. Navigate through feature
3. Verify layout doesn't break (buttons don't wrap, modals don't overflow)
```

### 11.3 Localization
- [ ] **Date/Time Format**: Formatted per locale (MM/DD/YYYY vs DD/MM/YYYY)
- [ ] **Number Format**: Thousands separator correct (1,000 vs 1.000)
- [ ] **Currency**: Currency symbol correct ($ vs € vs £)
- [ ] **Timezone**: Times displayed in user's timezone (or UTC with clear label)

---

## PHASE 12: Compliance & Privacy (GDPR, CCPA, SOC2)

If your app handles user data, compliance is not optional.

### 12.1 Data Privacy
- [ ] **PII Identified**: Personally Identifiable Information documented (email, name, IP, etc.)
- [ ] **Consent Required**: User consent obtained before collecting PII (if GDPR applies)
- [ ] **Data Minimization**: Only collect data you actually need
- [ ] **Right to Delete**: User can delete their data (GDPR Article 17)
- [ ] **Data Export**: User can export their data (GDPR Article 20)
- [ ] **Privacy Policy**: Privacy policy updated if new data collected

### 12.2 Data Retention
- [ ] **Retention Policy**: Data deleted after retention period (e.g., 90 days for logs)
- [ ] **Soft Deletes**: Important data soft-deleted (flagged as deleted, not hard-deleted)
- [ ] **Audit Logs**: Compliance actions logged (data access, deletion, export)

### 12.3 Third-Party Data Sharing
- [ ] **Subprocessors Listed**: Third-party services listed in privacy policy (OpenRouter, Supabase, Sentry, etc.)
- [ ] **Data Processing Agreements**: DPAs in place with third parties (if GDPR)
- [ ] **Data Transfer**: International data transfers compliant (EU-US Data Privacy Framework)

### 12.4 Security Controls (SOC2)
- [ ] **Audit Logs**: User actions logged for compliance audits
- [ ] **Access Controls**: RBAC enforced, least privilege principle
- [ ] **Encryption**: Data encrypted at rest and in transit
- [ ] **Incident Response**: Security incident playbook exists

---

## PHASE 13: Feature Flags & Rollout Strategy

How will this be deployed? Can you roll back quickly?

### 13.1 Feature Flag Verification
- [ ] **Flag Exists**: Feature flag configured in `backend/feature_flags.py`
- [ ] **Default State**: Default is OFF (enabled via env var or admin panel)
- [ ] **Frontend Check**: Frontend checks flag before rendering feature
- [ ] **Backend Check**: Backend checks flag before executing logic
- [ ] **Kill Switch**: Can disable feature instantly without deploying

**Test flag:**
```bash
# Disable flag
export FLAG_NEW_FEATURE=false
# Restart backend
# Verify feature hidden in UI

# Enable flag
export FLAG_NEW_FEATURE=true
# Restart backend
# Verify feature appears
```

### 13.2 Rollout Plan
- [ ] **Percentage Rollout**: Can roll out to 10%, 50%, 100% of users
- [ ] **Canary Deployment**: Can deploy to staging first, then production
- [ ] **Monitoring Dashboard**: Metrics visible during rollout (error rate, latency, usage)
- [ ] **Rollback Plan**: Can roll back in < 5 minutes if issues found

### 13.3 Database Migration Safety
- [ ] **Forward Compatible**: Old code works with new schema (during deployment)
- [ ] **Backward Compatible**: New code works with old schema (if rollback needed)
- [ ] **Rollback Migration**: DOWN migration exists and tested
- [ ] **Data Migration**: Large data migrations run in batches (not blocking)

**Test rollback:**
```bash
# Apply migration
supabase db push

# Verify feature works

# Rollback migration
supabase db rollback

# Verify app still works (feature hidden but no crashes)
```

---

## PHASE 14: Regression Testing

Ensure the new feature doesn't break existing functionality:

### 14.1 Smoke Tests
- [ ] **Core Flows**: Login, navigation, main features still work
- [ ] **Related Features**: Features that share code/data still work
- [ ] **No Console Errors**: No new errors in browser console
- [ ] **No Backend Errors**: No new errors in backend logs

**Run existing E2E tests:**
```bash
cd frontend && npm run test:e2e
# Or Playwright/Cypress test suite
```

### 14.2 Visual Regression
- [ ] **No Layout Shifts**: Existing pages look the same
- [ ] **No Style Leaks**: New CSS doesn't affect other components
- [ ] **Icons/Images**: No broken images or missing icons

**Use visual regression tools:**
```bash
# Percy, Chromatic, or manual screenshot comparison
npx playwright test --update-snapshots
# Review screenshot diffs
```

### 14.3 Performance Regression
- [ ] **Bundle Size**: JS bundle hasn't grown > 10%
- [ ] **API Latency**: Endpoints not slower than baseline
- [ ] **Database Queries**: No new slow queries added

**Compare before/after:**
```bash
# Before feature
cd frontend && npm run build
du -sh dist/assets/*.js  # Note size

# After feature
npm run build
du -sh dist/assets/*.js  # Compare
```

---

## PHASE 15: Documentation & Knowledge Transfer

Future you will thank you for documenting this.

### 15.1 Code Documentation
- [ ] **CLAUDE.md Updated**: New patterns, gotchas, or conventions documented
- [ ] **README Updated**: New setup steps, env vars, or dependencies documented
- [ ] **Inline Comments**: Complex logic has explanatory comments
- [ ] **OpenAPI Spec**: New API endpoints documented in Swagger/OpenAPI

### 15.2 Runbooks
- [ ] **Deployment Steps**: How to deploy this feature (migrations, env vars, etc.)
- [ ] **Rollback Steps**: How to roll back if things break
- [ ] **Troubleshooting**: Common issues and solutions documented
- [ ] **Monitoring**: What metrics to watch, what alerts to expect

### 15.3 Knowledge Transfer
- [ ] **Demo Recording**: Screen recording of feature in action (for stakeholders)
- [ ] **Architecture Diagram**: Updated if new services/components added
- [ ] **Decision Log**: Key decisions documented (why X over Y?)

---

## QA Report Template

After completing all phases, produce this comprehensive report:

```markdown
# QA Report: [Feature Name]
Date: [Date]
QA'd by: [Your Name]
Time Spent: [X hours]
Risk Level: [LOW/MEDIUM/HIGH]

---

## Executive Summary

### Status
- [ ] ✅ PASS - Ready for production
- [ ] ⚠️ PASS WITH CAVEATS - Minor issues, acceptable risk
- [ ] ❌ FAIL - Critical issues found, do not deploy

### Key Findings
- [Brief summary of testing results]
- [Highlight any critical issues]
- [Risk assessment]

### Recommendation
[Deploy immediately / Deploy with monitoring / Do not deploy - fix issues first]

---

## Files Changed
[List from Phase 1]

**Lines of Code Changed:**
- Frontend: +XXX -YYY lines
- Backend: +XXX -YYY lines
- Tests: +XXX -YYY lines

**Complexity Score:** [Low/Medium/High]
*(Based on cyclomatic complexity, number of dependencies, etc.)*

---

## Phase 2: Static Analysis ✅/❌

### Code Quality
- TypeScript: ✅ PASS / ❌ FAIL (X errors)
- ESLint: ✅ PASS / ❌ FAIL (X errors)
- Backend Tests: ✅ X/Y passed / ❌ X/Y failed
- Frontend Tests: ✅ X/Y passed / ❌ X/Y failed
- Code Coverage: X% (target 70%)

### Security Scan
- SQL Injection: ✅ SAFE / ❌ VULNERABLE
- XSS: ✅ SAFE / ❌ VULNERABLE
- Input Validation: ✅ PASS / ⚠️ NEEDS IMPROVEMENT
- Output Sanitization: ✅ PASS / ⚠️ NEEDS IMPROVEMENT

---

## Phase 3: Gatekeepers Verified ✅/❌

| Gatekeeper | Location | Status | Notes |
|------------|----------|--------|-------|
| [name] | [file:line] | ✅ UPDATED | [any notes] |
| [name] | [file:line] | ❌ MISSING | **BLOCKER** |

**Overall:** ✅ All gatekeepers updated / ❌ Missing gatekeepers (see above)

---

## Phase 4: Security Testing ✅/❌

### OWASP Top 10
- A01: Broken Access Control: ✅ PASS / ❌ FAIL
- A02: Cryptographic Failures: ✅ PASS / ❌ FAIL
- A03: Injection: ✅ PASS / ❌ FAIL
- A04: Insecure Design: ✅ PASS / ❌ FAIL
- A05: Security Misconfiguration: ✅ PASS / ❌ FAIL
- A06: Vulnerable Components: ✅ PASS / ❌ FAIL (npm audit found X issues)
- A07: Authentication Failures: ✅ PASS / ❌ FAIL
- A08: Software & Data Integrity: ✅ PASS / ❌ FAIL
- A09: Logging Failures: ✅ PASS / ❌ FAIL
- A10: Server-Side Request Forgery: ✅ PASS / N/A

### Authentication & Authorization
- JWT Validation: ✅ PASS / ❌ FAIL
- Multi-Tenant Isolation: ✅ PASS / ❌ FAIL (can access other user's data)
- RLS Policies: ✅ PASS / ❌ FAIL

### Rate Limiting
- API Rate Limits: ✅ ENFORCED / ❌ BYPASSED
- Test: Sent 100 requests in 10s → [Result]

---

## Phase 5: Data Flow Verified ✅/❌

### End-to-End Trace
- Database → Backend: ✅ VERIFIED / ❌ BROKEN
- Backend → API: ✅ VERIFIED / ❌ BROKEN
- API → Frontend: ✅ VERIFIED / ❌ BROKEN
- Frontend → UI: ✅ VERIFIED / ❌ BROKEN

### API Contract
- Request Format: ✅ MATCHES / ❌ MISMATCH
- Response Format: ✅ MATCHES / ❌ MISMATCH
- Error Handling: ✅ CORRECT / ❌ INCORRECT STATUS CODES

---

## Phase 6: Performance Testing ✅/❌

### Core Web Vitals (Lighthouse Score: X/100)
- LCP: X.Xs (target < 2.5s) ✅ / ❌
- CLS: X.XX (target < 0.1) ✅ / ❌
- INP: XXXms (target < 200ms) ✅ / ❌
- FCP: X.Xs (target < 1.8s) ✅ / ❌
- TTFB: XXXms (target < 600ms) ✅ / ❌

### Backend Performance
- API Latency (p50): XXms (target < 100ms) ✅ / ❌
- API Latency (p95): XXXms (target < 500ms) ✅ / ❌
- API Latency (p99): XXXms (target < 1s) ✅ / ❌
- Database Query Time: XXms (target < 50ms) ✅ / ❌

### Bundle Size
- Main JS Bundle: XXX KB gzipped (target < 300KB) ✅ / ❌
- Change from Baseline: +XX KB (+X%) ⚠️ if > 10%

### Load Testing
- Concurrent Users: Tested with XXX users
- Error Rate Under Load: X% (target < 1%) ✅ / ❌
- Throughput: XXX requests/sec

---

## Phase 7: Observability ✅/❌

### Logging
- Structured Logs: ✅ JSON FORMAT / ❌ PLAIN TEXT
- Log Levels: ✅ APPROPRIATE / ⚠️ TOO VERBOSE
- PII in Logs: ✅ NONE FOUND / ❌ FOUND (CRITICAL!)
- Critical Paths Logged: ✅ YES / ❌ NO

### Metrics
- Business Metrics: ✅ TRACKED / ❌ NOT TRACKED
- Technical Metrics: ✅ TRACKED / ❌ NOT TRACKED
- Dashboards: ✅ EXIST / ❌ MISSING

### Error Tracking
- Sentry Integration: ✅ WORKING / ❌ BROKEN
- Test Error Sent: ✅ RECEIVED / ❌ NOT RECEIVED
- Release Tagging: ✅ ENABLED / ❌ DISABLED

---

## Phase 8: Accessibility (WCAG 2.2 AA) ✅/❌

### Automated Testing
- axe DevTools: X violations found
  - Critical: X
  - Serious: X
  - Moderate: X
  - Minor: X

### Manual Testing
- Keyboard Navigation: ✅ PASS / ❌ FAIL (keyboard trap found)
- Screen Reader (NVDA): ✅ PASS / ❌ FAIL (missing labels)
- Color Contrast: ✅ PASS / ❌ FAIL (contrast ratio too low)
- Touch Targets: ✅ PASS (all > 44px) / ❌ FAIL (found buttons < 44px)

### Compliance
- WCAG 2.2 Level AA: ✅ COMPLIANT / ❌ NON-COMPLIANT
- Major Issues: [List any blocking issues]

---

## Phase 9: Manual Testing ✅/❌

### Feature Functionality
- Feature appears in UI: ✅ YES / ❌ NO
- Feature functions correctly: ✅ YES / ❌ NO
- Edge cases handled: ✅ YES / ⚠️ SOME ISSUES

### Mobile Touch Testing
- Touch input works on mobile: ✅ YES / ❌ NO / N/A
- No drag container interference: ✅ YES / ❌ NO / N/A
- Nested components don't conflict: ✅ YES / ❌ NO / N/A

### UI/UX Verification
- Visual consistency: ✅ YES / ❌ NO / N/A
- Responsive design: ✅ YES / ❌ NO (breaks at Xpx)
- Dark mode: ✅ YES / ❌ NO (colors broken)
- Loading/empty/error states: ✅ YES / ❌ MISSING
- Interaction feedback: ✅ YES / ❌ NO (no hover states)
- Accessibility basics: ✅ YES / ❌ NO (see Phase 8)

### Cross-Browser Testing
- Chrome: ✅ PASS / ❌ FAIL
- Safari: ✅ PASS / ❌ FAIL
- Firefox: ✅ PASS / ❌ FAIL
- Mobile Safari: ✅ PASS / ❌ FAIL / ⚠️ NOT TESTED

---

## Phase 10: Resilience Testing ✅/❌

### Network Failures
- Offline Mode: ✅ HANDLED / ❌ CRASHES
- Slow Network (3G): ✅ HANDLED / ❌ FREEZES
- Timeout: ✅ HANDLED / ❌ HANGS FOREVER
- Retry Logic: ✅ WORKS / ❌ DOESN'T RETRY

### Backend Failures
- 500 Errors: ✅ HANDLED / ❌ BLANK SCREEN
- Database Down: ✅ HANDLED / ❌ CRASHES
- Third-Party API Down: ✅ HANDLED / ❌ CASCADING FAILURE

---

## Phase 11: Internationalization ✅/❌

### Translation Completeness
- All Keys Present: ✅ YES / ❌ MISSING (X keys missing in [lang])
- No Hardcoded Strings: ✅ NONE / ❌ FOUND X HARDCODED STRINGS

### Layout Testing
- Text Expansion: ✅ NO BREAKS / ❌ BREAKS IN [lang]
- RTL Support: ✅ PASS / ❌ FAIL / N/A

---

## Phase 12: Compliance & Privacy ✅/❌

### GDPR Compliance
- PII Identified: ✅ DOCUMENTED / ❌ NOT DOCUMENTED
- Consent Obtained: ✅ YES / ❌ NO / N/A
- Right to Delete: ✅ IMPLEMENTED / ❌ NOT IMPLEMENTED
- Data Export: ✅ IMPLEMENTED / ❌ NOT IMPLEMENTED

### Data Retention
- Retention Policy: ✅ DEFINED / ❌ UNDEFINED
- Audit Logs: ✅ ENABLED / ❌ DISABLED

---

## Phase 13: Feature Flags & Rollout ✅/❌

### Feature Flag
- Flag Exists: ✅ YES / ❌ NO
- Default State: OFF ✅ / ON ❌ (should default OFF)
- Kill Switch Works: ✅ TESTED / ❌ NOT TESTED

### Rollout Plan
- Percentage Rollout: ✅ SUPPORTED / ❌ NOT SUPPORTED
- Monitoring Dashboard: ✅ READY / ❌ NOT READY
- Rollback Plan: ✅ DOCUMENTED / ❌ NOT DOCUMENTED

### Migration Safety
- Forward Compatible: ✅ YES / ❌ NO
- Backward Compatible: ✅ YES / ❌ NO
- Rollback Migration: ✅ EXISTS / ❌ MISSING

---

## Phase 14: Regression Testing ✅/❌

### Smoke Tests
- Core Flows: ✅ PASS / ❌ FAIL (X tests failed)
- Related Features: ✅ PASS / ❌ BROKEN
- Console Errors: ✅ NONE / ❌ FOUND X ERRORS
- Backend Errors: ✅ NONE / ❌ FOUND X ERRORS

### Performance Regression
- Bundle Size Change: +XX KB (+X%) ✅ / ⚠️ > 10%
- API Latency Change: +XXms (+X%) ✅ / ⚠️ SLOWER

---

## Phase 15: Documentation ✅/❌

- CLAUDE.md Updated: ✅ / ❌ / N/A
- README Updated: ✅ / ❌ / N/A
- OpenAPI Spec Updated: ✅ / ❌ / N/A
- Runbook Created: ✅ / ❌
- Demo Recording: ✅ / ❌ / N/A

---

## Issues Found

| # | Issue Description | Severity | Phase | Status | Notes |
|---|-------------------|----------|-------|--------|-------|
| 1 | [description] | 🔴 CRITICAL | [phase] | FIXED / OPEN | [notes] |
| 2 | [description] | 🟠 HIGH | [phase] | FIXED / OPEN | [notes] |
| 3 | [description] | 🟡 MEDIUM | [phase] | FIXED / OPEN | [notes] |
| 4 | [description] | 🔵 LOW | [phase] | FIXED / OPEN | [notes] |

**Severity Definitions:**
- 🔴 **CRITICAL**: Blocks deployment, data loss, security breach, complete feature failure
- 🟠 **HIGH**: Major functionality broken, poor UX, performance degradation > 50%
- 🟡 **MEDIUM**: Minor functionality broken, acceptable workaround exists
- 🔵 **LOW**: Cosmetic issues, edge cases, nice-to-have improvements

---

## Risk Assessment

### Technical Risks
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]

### Business Risks
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]

### Deployment Risks
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]

---

## Recommended Rollout Strategy

**Phase 1: Canary (1-5% of users, 24 hours)**
- Monitor: [metrics to watch]
- Rollback if: [conditions]

**Phase 2: Staged (25% of users, 48 hours)**
- Monitor: [metrics to watch]
- Rollback if: [conditions]

**Phase 3: Full (100% of users)**
- Monitor: [metrics to watch]
- Post-launch review: [date]

---

## Sign-off Checklist

### QA Engineer
- [ ] All phases completed
- [ ] All critical issues fixed or documented
- [ ] All gatekeepers verified
- [ ] Manual testing passed
- [ ] Security scan passed
- [ ] Performance benchmarks met
- [ ] Accessibility compliant
- [ ] Documentation complete

### Recommendation
[x] ✅ **APPROVED FOR PRODUCTION** - Ready to deploy
[ ] ⚠️ **APPROVED WITH MONITORING** - Deploy with close monitoring
[ ] ❌ **NOT APPROVED** - Fix issues before deployment

---

**QA Engineer Signature:** [Your Name]
**Date:** [Date]
**Time Spent:** [X hours]

---

## Post-Deployment Monitoring Plan

### First 24 Hours
- [ ] Monitor error rate (target < 1%)
- [ ] Monitor p95 latency (target < 500ms)
- [ ] Monitor feature usage (analytics)
- [ ] Check Sentry for new errors
- [ ] Review user feedback (support tickets, social media)

### First Week
- [ ] Review dashboards daily
- [ ] A/B test results (if applicable)
- [ ] User engagement metrics
- [ ] Performance trends

### First Month
- [ ] Feature adoption rate
- [ ] Remove feature flag (if stable)
- [ ] Retrospective meeting
- [ ] Update runbooks based on incidents

---

## Appendix

### Test Evidence
- [Link to test results]
- [Link to Lighthouse report]
- [Link to axe DevTools report]
- [Screenshots of feature in action]
- [Video demo recording]

### Test Data
- Test user: [email]
- Test company: [ID]
- Test environment: [staging/production]

### Tools Used
- Lighthouse: [version]
- axe DevTools: [version]
- Chrome DevTools: [version]
- NVDA: [version]
- k6/Locust: [version]
```

---

## Red Flags That Require Re-QA

If you see ANY of these, start over from Phase 1:
- ❌ "I assume this list includes..."
- ❌ "This should be updated automatically..."
- ❌ "I didn't check but it should work..."
- ❌ "The tests pass so it must work..."
- ❌ Skipping manual verification
- ❌ "It works on my machine"
- ❌ "We'll fix it after launch"
- ❌ "Security testing takes too long, skip it"
- ❌ "Accessibility is nice-to-have, ship without it"
- ❌ "Just deploy to 100%, what could go wrong?"

---

## Commands Quick Reference

```bash
# ====================
# STATIC ANALYSIS
# ====================

# TypeScript check
cd frontend && npm run type-check

# Lint
cd frontend && npm run lint

# Frontend tests with coverage
cd frontend && npm run test:run --coverage

# Backend tests with coverage
python -m pytest backend/tests/ -v --tb=short --cov=backend --cov-report=term-missing

# Check coverage threshold
python -m pytest backend/tests/ --cov=backend --cov-fail-under=70

# ====================
# SECURITY TESTING
# ====================

# Dependency audit
cd frontend && npm audit --audit-level=high
pip-audit

# Secrets scanning
detect-secrets scan --baseline .secrets.baseline

# SQL injection test (manual)
curl -X POST http://localhost:8081/api/endpoint -H "Content-Type: application/json" -d '{"name": "admin'\''--"}'

# Test rate limiting
for i in {1..100}; do curl http://localhost:8081/api/endpoint; done

# Check security headers
curl -I http://localhost:8081/api/endpoint

# ====================
# GATEKEEPER HUNTING
# ====================

# Search for gatekeepers
grep -rn "EDITABLE\|ALLOWED\|ENABLED\|VISIBLE\|_LIST\|_KEYS" backend/
grep -rn "PERSONA_\|ROLE_\|ALLOWED_\|ENABLED_\|_KEYS\|_ICONS" frontend/src/

# Search for feature flags
grep -rn "isEnabled\|FEATURE_FLAG\|FLAG_" backend/ frontend/src/

# ====================
# PERFORMANCE TESTING
# ====================

# Lighthouse audit
npx lighthouse http://localhost:5173 --view --preset=desktop
npx lighthouse http://localhost:5173 --view --emulated-form-factor=mobile

# Bundle size check
cd frontend && npm run build && du -sh dist/assets/*.js

# Load testing with Apache Bench
ab -n 1000 -c 10 http://localhost:8081/api/endpoint

# Database query performance
# In psql or Supabase SQL editor:
# EXPLAIN ANALYZE SELECT * FROM companies WHERE user_id = 'xxx';

# ====================
# ACCESSIBILITY TESTING
# ====================

# Automated a11y tests
cd frontend && npm run test:a11y

# Or use browser extensions:
# - axe DevTools
# - WAVE
# - Lighthouse (Accessibility section)

# ====================
# OBSERVABILITY
# ====================

# Check backend health
curl http://localhost:8081/health

# View backend logs
tail -f backend/logs/*.log | grep "new_feature"

# Test Sentry error tracking
# In code: raise Exception("Test Sentry")
# Check Sentry dashboard for error

# ====================
# MOBILE/TOUCH TESTING
# ====================

# Search for touch-related code
grep -rn "touch-action\|stopPropagation\|drag=" frontend/src/components/

# Chrome DevTools mobile emulation
# Ctrl+Shift+M → Select device → Test with touch

# ====================
# DATABASE TESTING
# ====================

# Test RLS policies (in Supabase SQL editor)
# SET request.jwt.claim.sub = 'user-id';
# SELECT * FROM companies; -- Should see only user's data

# Apply migration
supabase db push

# Rollback migration
supabase db rollback

# ====================
# FEATURE FLAG TESTING
# ====================

# Disable feature flag
export FLAG_NEW_FEATURE=false
python -m backend.main

# Enable feature flag
export FLAG_NEW_FEATURE=true
python -m backend.main

# ====================
# REGRESSION TESTING
# ====================

# Run E2E tests
cd frontend && npm run test:e2e

# Visual regression (Playwright)
npx playwright test --update-snapshots

# ====================
# I18N TESTING
# ====================

# Check for missing translation keys
cd frontend/src/locales
diff <(jq -r 'keys[]' en.json | sort) <(jq -r 'keys[]' es.json | sort)

# ====================
# CHAOS TESTING
# ====================

# Simulate slow network (Chrome DevTools)
# DevTools > Network > Throttling > Slow 3G

# Simulate backend failure
# Stop backend, interact with frontend

# Simulate 500 error
# Add: raise Exception("Test error handling")
# Verify error handled gracefully
```

---

## Advanced QA Techniques (For Complex Features)

### Contract Testing (Pact)
For microservices or complex frontend-backend contracts:
```bash
# Generate contract tests
npm run test:contract
# Verify provider (backend) honors contract
# Verify consumer (frontend) sends correct requests
```

### Visual Regression Testing (Percy, Chromatic)
For UI-heavy features:
```bash
npx percy snapshot screenshots/
# Compares screenshots across commits
# Flags visual changes for review
```

### Mutation Testing (Stryker)
For critical business logic:
```bash
npx stryker run
# Mutates code to verify tests catch bugs
# If mutation not caught, tests are weak
```

### Chaos Engineering (Chaos Toolkit)
For resilience testing:
```bash
chaos run experiments/api-failure.json
# Randomly kills services, injects latency
# Verifies system degrades gracefully
```

---

## QA Metrics to Track

### Test Coverage
- Unit test coverage: > 70%
- Integration test coverage: > 50%
- E2E test coverage: Critical paths covered

### Quality Metrics
- Bug escape rate: < 5% (bugs found in production vs caught in QA)
- Defect density: < 1 bug per 100 LOC
- Mean time to detect (MTTD): < 24 hours
- Mean time to repair (MTTR): < 4 hours

### Performance Metrics
- Lighthouse score: > 90
- Core Web Vitals: All pass
- API latency: p95 < 500ms
- Error rate: < 1%

---

## Remember: Quality is a Team Sport

**QA is not a checkpoint at the end. It's a mindset throughout development.**

- 👨‍💻 **Developers**: Write tests WHILE coding, not after
- 🎨 **Designers**: Include accessibility in designs, not as afterthought
- 📊 **PMs**: Define measurable acceptance criteria upfront
- 🔒 **Security**: Review PRs for vulnerabilities, run SAST tools
- 📈 **Data**: Instrument analytics BEFORE launch, not after

**The goal is zero surprises in production.** If you're not 100% certain something works, verify it manually. No assumptions. No shortcuts. Ship quality code. 🚀
