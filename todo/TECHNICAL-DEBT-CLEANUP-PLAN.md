# Technical Debt Cleanup Plan

> Generated: 2026-01-20
> Status: Ready for execution
> Total Issues: 17 categories, 80+ individual items

---

## Executive Summary

This document outlines technical debt found during a comprehensive codebase audit. Issues are categorized by risk level and include specific file locations, rationale for why they're problems, and safe execution order.

**Key Metrics:**
- 8 duplicate "_refactored" files creating confusion
- 80+ hardcoded values that should be config-driven
- 5 unused npm/pip packages adding bloat
- 4 deprecated API methods still being called
- 900+ variable naming inconsistencies
- 15+ debug logs leaking to production console

---

## TOP 3 LEAST RISKY UPDATES (Start Here)

These changes have **ZERO runtime impact** and cannot break anything.

### 1. Remove Unused Celebration Functions

**Risk Level:** NONE - Functions are exported but never imported anywhere

**Location:** `frontend/src/lib/celebrate.ts`

**What to remove:**
```typescript
// Lines 19-95: Remove these 5 functions
export function celebrateSuccess() { ... }
export function celebrateMilestone() { ... }
export function celebrateWinner() { ... }
export function celebrateFireworks() { ... }
export function celebrateSparkle() { ... }

// Lines 97-104: Remove the namespace export
export const celebrate = {
  success: celebrateSuccess,
  milestone: celebrateMilestone,
  winner: celebrateWinner,
  fireworks: celebrateFireworks,
  sparkle: celebrateSparkle,
  councilComplete: celebrateCouncilComplete,
};
```

**Keep only:**
```typescript
export function celebrateCouncilComplete() { ... }  // Used in Stage3Content.tsx:99
```

**Verification:**
```bash
# Confirm no imports of removed functions
grep -r "celebrateSuccess\|celebrateMilestone\|celebrateWinner\|celebrateFireworks\|celebrateSparkle" frontend/src --include="*.tsx" --include="*.ts"
# Should return 0 results outside celebrate.ts
```

**Why it's safe:** These functions were prepared for future gamification features that were never implemented. The only used function is `celebrateCouncilComplete()` called once in Stage3Content.tsx.

**Impact:** ~100 lines removed, ~3KB bundle savings

---

### 2. Remove Unused OG Image Functions

**Risk Level:** NONE - Functions exist but are never called

**Location:** `frontend/src/lib/seo/ogImageConfig.ts`

**What to remove:**
```typescript
// Lines 112-137: Remove these 3 functions
export function generateDynamicOGImageUrl(params: OGImageParams): string { ... }
export function getTwitterCardType(route: string): 'summary' | 'summary_large_image' { ... }
export function getOGImageForRoute(route: string): string { ... }
```

**Verification:**
```bash
# Confirm no imports
grep -r "generateDynamicOGImageUrl\|getTwitterCardType\|getOGImageForRoute" frontend/src --include="*.tsx" --include="*.ts"
# Should return 0 results outside ogImageConfig.ts
```

**Why it's safe:** This was infrastructure built for dynamic OG image generation that was never wired up. The SEO components use static images directly.

**Impact:** ~50 lines removed, cleaner API surface

---

### 3. Remove Debug console.log from useImpersonation

**Risk Level:** VERY LOW - Only removes logging, zero functional change

**Location:** `frontend/src/hooks/useImpersonation.ts`

**What to remove:** All 15+ console.log statements:
```typescript
// Remove lines like:
console.log('[useImpersonation] Starting check...');
console.log('[useImpersonation] Session found:', { userId, targetUserId, ... });
console.log('[useImpersonation] Clearing session...');
// etc.
```

**Verification:**
```bash
# Count console.logs before
grep -c "console.log" frontend/src/hooks/useImpersonation.ts
# Should go from ~15 to 0

# Run tests to verify no functional change
cd frontend && npm run test:run -- useImpersonation
```

**Why it's safe:** These are debugging statements that log impersonation session details to browser console. Removing them has zero functional impact - the hook works exactly the same, just silently.

**Security bonus:** Stops leaking admin session details to browser DevTools.

**Impact:** ~30 lines removed, improved security posture

---

## PHASE 1: Zero-Risk Cleanup (Week 1)

All items in this phase can be done without any functional testing beyond "does it compile?"

### 1.1 Dead Code Removal

| Item | File | Lines | Verification |
|------|------|-------|--------------|
| Unused celebration functions | `frontend/src/lib/celebrate.ts` | 19-104 | grep for imports |
| Unused OG image functions | `frontend/src/lib/seo/ogImageConfig.ts` | 112-137 | grep for imports |
| Unused webShare functions | `frontend/src/lib/webShare.ts` | shareConversation, shareText, sharePage, copyToClipboard | grep for imports |
| Debug console.logs | `frontend/src/hooks/useImpersonation.ts` | ~15 statements | functional test |

**Rationale:** These are exports/statements that have zero callers. Removing them cannot break anything because nothing depends on them.

### 1.2 Backend print() → logger

| File | Issue | Fix |
|------|-------|-----|
| `backend/ai_i18n.py` | print() for translation logs | Use `logger.debug()` |
| `backend/services/email.py:169-177` | 7 print() for email preview | Use `logger.info()` |
| `backend/i18n.py` | print() for i18n errors | Use `logger.warning()` |

**Rationale:** Changing print() to logger has no functional impact - same output, but now controllable via log levels.

### 1.3 Root Utility Script Cleanup

| File | Action | Rationale |
|------|--------|-----------|
| `main.py` | Delete | Contains only `print("Hello")` |
| `check_context.py` | Move to `scripts/` or delete | One-off audit script |
| `create_project.py` | Move to `scripts/` or delete | Unused utility |
| `fix_selects.py` | Delete | Completed migration script |

**Rationale:** These files clutter the repo root and confuse new developers about entry points.

---

## PHASE 2: Low-Risk Consolidation (Week 2)

### 2.1 Rename _refactored Files

This is a **rename only** operation - no code changes.

| Current Name | New Name | Imported By |
|--------------|----------|-------------|
| `council_stage1_refactored.py` | `council_stage1.py` | `council.py` |
| `council_stage2_refactored.py` | `council_stage2.py` | `council.py` |
| `context_loader_refactored.py` | `context_loader_impl.py` | `context_loader.py` |
| `openrouter_stream_refactored.py` | `openrouter_stream.py` | `openrouter.py` |
| `routers/company/activity_refactored.py` | `activity_impl.py` | `activity.py` |
| `routers/company/utils_refactored.py` | `company_utils.py` | `utils.py` |
| `routers/projects_refactored.py` | `projects_impl.py` | `projects.py` |
| `routers/ai_utils_refactored.py` | `ai_utils_impl.py` | `ai_utils.py` |

**Execution:**
```bash
# For each file:
git mv backend/council_stage1_refactored.py backend/council_stage1.py
# Update import in council.py
# Run tests
```

**Rationale:** The "_refactored" suffix implies temporary state. These are permanent extractions and should have clear names indicating their purpose.

### 2.2 Remove Unused Dependencies

**NPM (frontend/package.json):**
```bash
npm uninstall postcss-rtlcss  # Custom postcss-strip-rtl.js handles RTL
npm uninstall geist           # Font loaded from Google Fonts CDN
```

**Pip (requirements.txt / pyproject.toml):**
```bash
pip uninstall apscheduler     # Zero imports - scheduling never implemented
pip uninstall email-validator # Pydantic EmailStr handles this
```

**Verification:**
```bash
# NPM - check no imports
grep -r "postcss-rtlcss\|from 'geist'" frontend/src
# Pip - check no imports
grep -r "from apscheduler\|import apscheduler\|from email_validator\|import email_validator" backend/
```

**Rationale:** Unused dependencies slow down installs, increase attack surface, and confuse dependency audits.

### 2.3 Sync requirements.txt with pyproject.toml

**Discrepancies found:**

| Package | requirements.txt | pyproject.toml | Action |
|---------|------------------|----------------|--------|
| stripe | >=14.0.0 | >=7.0.0 | Update pyproject.toml to >=14.0.0 |
| sentry-sdk | >=2.0.0 | NOT PRESENT | Add to pyproject.toml |
| cryptography | >=42.0.0 | NOT PRESENT | Add to pyproject.toml |

**Rationale:** Single source of truth prevents "works on my machine" deployment failures.

---

## PHASE 3: Medium-Risk Refactoring (Week 3-4)

### 3.1 Migrate Deprecated API Methods

**Current state:**
```
createDepartment() → createCompanyDepartment()  (wrapper)
updateDepartment() → updateCompanyDepartment()  (wrapper)
addRole() → createCompanyRole()                 (wrapper)
updateRole() → updateCompanyRole()              (wrapper)
```

**Files to update:**
1. `frontend/src/components/Organization.tsx` - Uses old methods
2. `frontend/src/hooks/queries/useCompany.ts` - Uses old methods

**Execution:**
1. Update callers to use new method names
2. Run full test suite
3. Remove deprecated wrappers from `api.ts`

**Rationale:** Double indirection creates confusion and maintenance burden. The deprecated methods exist only for backward compatibility with callers that should have been migrated.

### 3.2 Move Hardcoded URLs to Environment

**Location:** `backend/main.py:265-277`

**Current:**
```python
origins = [
    'http://localhost:5173',
    'http://localhost:5174',
    # ... more hardcoded
    'https://ai-council-three.vercel.app',
]
```

**Target:**
```python
origins = os.getenv('CORS_ORIGINS', '').split(',')
if not origins or origins == ['']:
    origins = ['http://localhost:5173']  # Dev default only
```

**.env addition:**
```
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,https://ai-council-three.vercel.app
```

**Rationale:** New deployments shouldn't require code changes. Environment-driven config is 12-factor app standard.

### 3.3 Move Pricing to Database/Config

**Location:** `backend/config.py:234-240`

**Current:**
```python
"price_monthly": 2900,  # Hardcoded $29
"price_monthly": 9900,  # Hardcoded $99
```

**Options:**
1. **Database table:** `subscription_tiers` with pricing columns
2. **Environment vars:** `PRO_PRICE_MONTHLY=2900`
3. **Stripe sync:** Fetch from Stripe product catalog

**Recommended:** Option 3 (Stripe sync) - Stripe is source of truth for billing anyway.

**Rationale:** Price changes are business decisions that shouldn't require deployments. A/B testing pricing becomes possible.

---

## PHASE 4: Higher-Risk Standardization (Month 2)

### 4.1 Variable Naming Consistency

**Scope:** 900+ instances of mixed camelCase/snake_case

**Strategy:**
1. Create API response transformer that converts snake_case → camelCase
2. Update frontend to expect camelCase consistently
3. Add ESLint rule to enforce camelCase in frontend

**Files with highest inconsistency:**
- API response handlers
- React component props
- TypeScript interfaces

**Rationale:** Bug prevention. Destructuring `{ company_id }` when API returns `companyId` causes silent failures.

### 4.2 Feature Flag Cleanup

**Dead flags to remove:**
```python
# backend/feature_flags.py
"multi_company": False,  # Never checked anywhere
"export_pdf": False,     # Never checked anywhere
```

**Unused hook to evaluate:**
```typescript
// frontend/src/hooks/useFeatureFlags.ts
// Exported but never imported - either use or delete
```

**Rationale:** Dead feature flags create false expectations. New developers think features exist when they don't.

### 4.3 Model Pricing Dynamic Fetch

**Location:** `backend/routers/company/utils.py:241-249`

**Current:** Hardcoded pricing per model
**Target:** Fetch from OpenRouter API or cache in Redis

**Rationale:** OpenRouter updates pricing regularly. Hardcoded prices become inaccurate, causing user trust issues.

---

## Verification Checklist

Before each phase, run:

```bash
# Frontend
cd frontend
npm run lint
npm run type-check
npm run test:run

# Backend
cd ..
python -m pytest backend/tests/ -v

# Full E2E (if available)
npm run test:e2e
```

---

## Risk Matrix

| Phase | Risk | Rollback Difficulty | Testing Required |
|-------|------|---------------------|------------------|
| Phase 1 | NONE | Trivial (git revert) | Compile check |
| Phase 2 | LOW | Easy (git revert) | Unit tests |
| Phase 3 | MEDIUM | Moderate | Integration tests |
| Phase 4 | HIGHER | Complex | Full regression |

---

## Tracking

Use this checklist to track progress:

### Phase 1 (Zero Risk)
- [ ] Remove unused celebration functions
- [ ] Remove unused OG image functions
- [ ] Remove debug console.logs from useImpersonation
- [ ] Convert backend print() to logger
- [ ] Clean up root utility scripts

### Phase 2 (Low Risk)
- [ ] Rename _refactored files
- [ ] Remove unused npm packages
- [ ] Remove unused pip packages
- [ ] Sync requirements.txt with pyproject.toml

### Phase 3 (Medium Risk)
- [ ] Migrate deprecated API method callers
- [ ] Move CORS URLs to environment
- [ ] Move pricing to Stripe/config

### Phase 4 (Higher Risk)
- [ ] Standardize variable naming
- [ ] Clean up dead feature flags
- [ ] Implement dynamic model pricing

---

## Appendix: Full File Location Reference

### Dead Code Locations
| Issue | File | Lines |
|-------|------|-------|
| Unused celebrate functions | `frontend/src/lib/celebrate.ts` | 19-104 |
| Unused OG image functions | `frontend/src/lib/seo/ogImageConfig.ts` | 112-137 |
| Unused webShare functions | `frontend/src/lib/webShare.ts` | all exports |
| Debug console.logs | `frontend/src/hooks/useImpersonation.ts` | 129-330 |
| Backend print statements | `backend/ai_i18n.py`, `backend/services/email.py`, `backend/i18n.py` | various |

### Hardcoded Values Locations
| Issue | File | Lines |
|-------|------|-------|
| CORS origins | `backend/main.py` | 265-277 |
| Subscription pricing | `backend/config.py` | 234-240 |
| Model pricing | `backend/routers/company/utils.py` | 241-249 |
| Circuit breaker config | `backend/openrouter.py` | 271-273 |
| Rate limits | `backend/routers/council.py` | various |
| Timeouts | `backend/openrouter.py` | 198, 356 |

### Deprecated Code Locations
| Issue | File | Lines |
|-------|------|-------|
| createDepartment wrapper | `frontend/src/api.ts` | 1072-1085 |
| updateDepartment wrapper | `frontend/src/api.ts` | 1087-1100 |
| addRole wrapper | `frontend/src/api.ts` | 1102-1115 |
| updateRole wrapper | `frontend/src/api.ts` | 1117-1130 |
| Callers in Organization | `frontend/src/components/Organization.tsx` | various |
| Callers in useCompany | `frontend/src/hooks/queries/useCompany.ts` | various |

### Duplicate Files Locations
| Refactored File | Original Importer |
|-----------------|-------------------|
| `backend/council_stage1_refactored.py` | `backend/council.py` |
| `backend/council_stage2_refactored.py` | `backend/council.py` |
| `backend/context_loader_refactored.py` | `backend/context_loader.py` |
| `backend/openrouter_stream_refactored.py` | `backend/openrouter.py` |
| `backend/routers/company/activity_refactored.py` | `backend/routers/company/activity.py` |
| `backend/routers/company/utils_refactored.py` | `backend/routers/company/utils.py` |
| `backend/routers/projects_refactored.py` | `backend/routers/projects.py` |
| `backend/routers/ai_utils_refactored.py` | `backend/routers/ai_utils.py` |
