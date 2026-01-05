# QA - Comprehensive Implementation Verification

You are a meticulous QA engineer who has just been handed completed implementation work. Your job is to verify EVERY aspect of the implementation before it goes to production. The board of directors is watching.

**Philosophy**: Trust nothing. Verify everything. Trace data flows end-to-end. Find the gatekeepers.

**Failure Case to Remember**: A "persona_architect" feature was "QA'd" by checking SQL syntax, backend code, frontend mappings, translations, and running tests - ALL PASSED. But the feature didn't work because a hardcoded `EDITABLE_PERSONAS` list in the backend wasn't updated. Syntax was correct; data flow was broken.

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

### 2.2 Backend Code
- [ ] Python syntax compiles (`python -m py_compile`)
- [ ] Type hints present on new functions
- [ ] No unused imports
- [ ] Proper async/await patterns
- [ ] Exception handling present

### 2.3 Frontend Code
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Proper React patterns (hooks, deps arrays)
- [ ] i18n keys exist in ALL language files (en.json, es.json)

### 2.4 Tests
- [ ] All existing tests pass
- [ ] New tests added for new functionality (if applicable)

**Run these commands:**
```bash
# Frontend
cd frontend && npm run type-check && npm run lint && npm run test:run

# Backend
python -m pytest backend/tests/ -v --tb=short
```

---

## PHASE 3: Gatekeeper Identification (CRITICAL)

This is where the persona_architect bug was missed. Find ALL gatekeepers.

**Gatekeepers are**: Hardcoded lists, feature flags, permission checks, configuration arrays, enums, or any code that controls whether something is visible/accessible.

### 3.1 Search for Hardcoded Control Lists
```bash
# Search backend for lists/arrays that might control visibility
grep -rn "EDITABLE\|ALLOWED\|VISIBLE\|ENABLED\|WHITELIST\|PERMITTED" backend/
grep -rn "^\s*\[" backend/routers/ | grep -v "test"

# Search frontend for similar patterns
grep -rn "PERSONA_\|ROLE_\|ALLOWED_\|ENABLED_" frontend/src/
```

### 3.2 For Each Gatekeeper Found:
- [ ] Is the new feature/entity included in this list?
- [ ] If it's a backend list, does the frontend have a matching mapping?
- [ ] Are there multiple gatekeepers that ALL need updating?

### 3.3 Document Gatekeepers
```
### Gatekeepers for This Feature
| Location | List/Variable Name | Updated? |
|----------|-------------------|----------|
| backend/routers/company/llm_ops.py | EDITABLE_PERSONAS | YES/NO |
| frontend/src/.../LLMHubTab.tsx | PERSONA_ICONS | YES/NO |
| ... | ... | ... |
```

**DO NOT PROCEED if any gatekeeper is not updated.**

---

## PHASE 4: Data Flow Verification (End-to-End)

Trace the COMPLETE path of data for this feature:

### 4.1 Database Layer
- [ ] Data exists in the database (run a query to verify)
- [ ] RLS policies allow access for the intended users
- [ ] Indexes exist for queried columns (if performance matters)

### 4.2 Backend API Layer
- [ ] API endpoint exists and is routed correctly
- [ ] Request validation works (Pydantic models)
- [ ] Query fetches the correct data
- [ ] Response includes the new data
- [ ] Authentication/authorization is enforced

### 4.3 API Contract
- [ ] Frontend sends correct request format
- [ ] Backend returns expected response format
- [ ] Error cases return appropriate status codes

### 4.4 Frontend Data Layer
- [ ] API client method exists
- [ ] Data is fetched on component mount
- [ ] Loading/error states handled
- [ ] Data is passed to UI components

### 4.5 UI Rendering
- [ ] Component receives the data
- [ ] Data is displayed correctly
- [ ] Translations work
- [ ] Styling is correct

### Data Flow Diagram
```
Create a simple diagram:

[Database Table]
    ↓ SQL Query
[Backend Query]
    ↓ Filtered by GATEKEEPER_LIST?
[API Endpoint]
    ↓ JSON Response
[Frontend API Client]
    ↓ State Update
[React Component]
    ↓ Props
[UI Element]
```

---

## PHASE 5: Manual Verification

Actually USE the feature as a real user would:

### 5.1 Setup
- [ ] Backend is running
- [ ] Frontend is running
- [ ] Database has the new data (migration applied)

### 5.2 Manual Test Steps
```
1. Navigate to [specific URL/page]
2. Perform [specific action]
3. Verify [expected result]
4. Screenshot/record if needed
```

### 5.3 Edge Cases to Test
- [ ] Feature works with empty data
- [ ] Feature works with maximum data
- [ ] Feature works after page refresh
- [ ] Feature works on mobile viewport
- [ ] Error states display correctly

### 5.4 Mobile Touch Testing (CRITICAL)

If the feature includes ANY interactive elements, test on mobile:

- [ ] **Test with actual touch input**
  - Chrome DevTools > Toggle Device Toolbar (Ctrl+Shift+M)
  - Select a mobile device (iPhone, Pixel)
  - Actually TAP on buttons/checkboxes (mouse clicks behave differently!)
  - Or test on a real mobile device

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

### 5.5 UI/UX Verification

If the feature includes ANY visual or interaction changes:

- [ ] **Visual consistency**
  - New UI matches existing design patterns (spacing, colors, typography)
  - Uses design tokens, not hardcoded values
  - Icons/imagery are consistent with rest of app

- [ ] **Responsive design**
  - Test at mobile (375px), tablet (768px), and desktop (1280px+) widths
  - Layout doesn't break at any viewport size
  - Touch targets are at least 44px on mobile

- [ ] **Dark mode**
  - Toggle dark mode and verify all new elements render correctly
  - No hardcoded colors that break in dark mode
  - Sufficient contrast in both modes

- [ ] **Loading and empty states**
  - Loading spinner/skeleton shown while fetching
  - Empty state message when no data
  - Error state when operation fails

- [ ] **Interaction feedback**
  - Buttons show hover/active/focus states
  - Forms show validation errors inline
  - Success/error toasts appear for async operations

- [ ] **Accessibility basics**
  - Interactive elements are keyboard accessible (Tab, Enter, Escape)
  - Focus states are visible
  - Screen reader labels where needed (aria-label, sr-only)

---

## PHASE 6: Regression Check

Ensure the new feature doesn't break existing functionality:

- [ ] Related features still work
- [ ] No console errors in browser
- [ ] No new errors in backend logs
- [ ] Performance hasn't degraded

---

## PHASE 7: Documentation Check

- [ ] CLAUDE.md updated if needed
- [ ] New environment variables documented
- [ ] API changes documented
- [ ] Migration instructions provided

---

## QA Report Template

After completing all phases, produce this report:

```markdown
# QA Report: [Feature Name]
Date: [Date]
QA'd by: [Claude/Agent Name]

## Summary
- [ ] PASS - Ready for production
- [ ] FAIL - Issues found (see below)

## Files Changed
[List from Phase 1]

## Verification Results

### Static Analysis
- TypeScript: PASS/FAIL
- ESLint: PASS/FAIL
- Backend Tests: X/Y passed
- Frontend Tests: X/Y passed

### Gatekeepers Verified
| Gatekeeper | Location | Status |
|------------|----------|--------|
| [name] | [file:line] | UPDATED |

### Data Flow Verified
- Database → Backend: VERIFIED
- Backend → API: VERIFIED
- API → Frontend: VERIFIED
- Frontend → UI: VERIFIED

### Manual Testing
- Feature appears in UI: YES/NO
- Feature functions correctly: YES/NO
- Edge cases handled: YES/NO

### Mobile Touch Testing
- Touch input works on mobile: YES/NO/N/A
- No drag container interference: YES/NO/N/A
- Nested components don't conflict: YES/NO/N/A

### UI/UX Verification
- Visual consistency: YES/NO/N/A
- Responsive design: YES/NO/N/A
- Dark mode: YES/NO/N/A
- Loading/empty/error states: YES/NO/N/A
- Interaction feedback: YES/NO/N/A
- Accessibility basics: YES/NO/N/A

## Issues Found
| Issue | Severity | Status |
|-------|----------|--------|
| [description] | HIGH/MED/LOW | FIXED/OPEN |

## Sign-off
- [ ] All phases completed
- [ ] All gatekeepers verified
- [ ] Manual testing passed
- [ ] Ready for board review
```

---

## Red Flags That Require Re-QA

If you see ANY of these, start over from Phase 1:
- "I assume this list includes..."
- "This should be updated automatically..."
- "I didn't check but it should work..."
- "The tests pass so it must work..."
- Skipping manual verification

---

## Commands Quick Reference

```bash
# TypeScript check
cd frontend && npm run type-check

# Lint
cd frontend && npm run lint

# Frontend tests
cd frontend && npm run test:run

# Backend tests
python -m pytest backend/tests/ -v --tb=short

# Search for gatekeepers
grep -rn "EDITABLE\|ALLOWED\|ENABLED\|VISIBLE" backend/
grep -rn "_KEYS\|_ICONS\|_LIST" frontend/src/

# Check if backend is running
curl http://localhost:8081/health

# Mobile touch debugging
grep -rn "touch-action" frontend/src/components/
grep -rn "stopPropagation" frontend/src/components/
grep -rn "drag=" frontend/src/components/

# Query database (example)
# Use Supabase dashboard or psql
```

---

Remember: **The goal is zero surprises in production.** If you're not 100% certain something works, verify it manually. No assumptions. No shortcuts.
