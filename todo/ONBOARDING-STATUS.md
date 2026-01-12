# Onboarding Implementation Status

> **PURPOSE:** This file is the single source of truth for onboarding progress.
> **UPDATE:** Mark items complete as you finish them. Add notes/blockers.
> **NEW SESSION:** Claude should read this file first to understand current state.

---

## Current Phase: BATCH 2 & 3 - LinkedIn + Trial System 🔄 IN PROGRESS

**Started:** 2026-01-13
**Target:** Real API integration, auth gates, trial management
**Status:** Core flow complete. Migration deployed. Profile integration pending.

**PRINCIPLE:** Reuse existing components. NO new components unless absolutely necessary.

---

## Previous Phase: BATCH 1 - Mock Mode UI ✅ COMPLETE

**Started:** 2025-01-13
**Completed:** 2025-01-13
**Target:** Build complete flow with hardcoded data (no APIs)
**Status:** All checks passing

---

## REUSABLE COMPONENTS (DO NOT REBUILD)

| Need | Use This | File |
|------|----------|------|
| URL Input | `OmniBar` (variant="compact") or `FormField` + `Input` | `shared/OmniBar.tsx`, `ui/FormField.tsx` |
| Loading steps | `LoadingState` + custom step list | `ui/LoadingState.tsx` |
| Cards | `Card`, `CardHeader`, `CardContent` | `ui/card.tsx` |
| Buttons | `Button` | `ui/button.tsx` |
| Modals | `AppModal` or `AdaptiveModal` | `ui/AppModal.tsx` |
| Empty/Welcome | `EmptyState` | `ui/EmptyState.tsx` |
| Errors | `ErrorState` | `ui/ErrorState.tsx` |
| Spinner | `Spinner` | `ui/Spinner.tsx` |
| Skeleton | `Skeleton` | `ui/Skeleton.tsx` |

---

## BATCH 1 CHECKLIST (LEAN VERSION)

### 1.1 Types & Mock Data
- [x] Create `frontend/src/components/onboarding/types.ts` (interfaces only)
- [x] Create `frontend/src/components/onboarding/mockData.ts` (2 profiles)

### 1.2 Onboarding Flow (SINGLE FILE)
- [x] Create `frontend/src/components/onboarding/OnboardingFlow.tsx`
- [x] Create `frontend/src/components/onboarding/OnboardingFlow.css`
- [x] State machine with 4 steps: input → loading → preview → ready
- [x] REUSE: `FormField`, `Input`, `Button`, `Card`, `Spinner`
- [x] Loading step: simple checklist with `Spinner` per step
- [x] Preview step: show departments + magic question
- [x] Ready step: CTA to start council

### 1.3 Export & Integration
- [x] Create `frontend/src/components/onboarding/index.ts`
- [x] Add route handling in `App.tsx` (or integrate into landing)
- [x] Test with mock data

### 1.4 Polish
- [x] Test dark mode (verified via browser)
- [x] Verify smooth transitions (Framer Motion animations working)
- [ ] Test mobile (deferred - requires physical device or better viewport emulation)

---

## BATCH 2 CHECKLIST (LinkedIn Integration)

**Status:** IN PROGRESS
**Depends on:** Batch 1 complete
**Started:** 2026-01-13

### 2.1 Backend Endpoint
- [x] Create `backend/routers/onboarding.py`
- [x] `POST /api/onboarding/analyze-profile` endpoint
- [x] Rate limiting (10/min, 50/hour via slowapi)

### 2.2 Profile Scraping
- [x] Choose scraping service: **FreshLink** (confirmed by user)
- [ ] Integrate FreshLink API (placeholder stub in place)
- [x] Handle scrape failures gracefully (falls back to mock data)
- [ ] Create `ThinProfileFallback.tsx` for manual input

### 2.3 Company Enrichment
- [x] Choose enrichment service: **Apollo** (confirmed by user)
- [ ] Integrate Apollo API (placeholder stub in place)
- [ ] Extract: industry, employee count, description

### 2.4 Department Generation
- [x] Rule-based mapping in `backend/routers/onboarding.py`
- [x] Keywords → departments logic
- [x] Size modifiers (Guerrilla/Startup/Scale-up/Enterprise prefixes)

### 2.5 Magic Question Generator
- [x] LLM prompt-based generation in `backend/routers/onboarding.py`
- [x] Uses `utility` model role (via model registry alias)
- [x] Generates personalized strategic question

---

## BATCH 3 CHECKLIST (Trial System)

**Status:** IN PROGRESS
**Depends on:** Batch 1 complete (can parallel with Batch 2)
**Started:** 2026-01-13

### 3.1 Database Schema
- [x] Create migration: `supabase/migrations/20260113100000_user_trials.sql`
- [x] Run migration in Supabase ✅ Deployed 2026-01-13
- [x] RLS policies included in migration

### 3.2 Backend Trial Service
- [x] Create `backend/services/trial.py` - TrialService class
- [x] `check_trial_available(user_id)` method
- [x] `use_trial(user_id, ip_address)` method
- [x] `get_api_key_for_user(user_id)` method

### 3.3 Trial Integration
- [x] Endpoints: `GET /onboarding/trial-status`, `POST /onboarding/use-trial`
- [ ] Modify `conversations.py` to check trial status
- [ ] Use master key for trial runs
- [ ] Mark trial used after successful council run
- [ ] Return 402 when trial exhausted and no API key

### 3.4 Soft Gate Modal
- [x] Create `SoftGateModal.tsx`
- [x] Trigger on "Start Deliberation" when not authenticated
- [x] Google auth as primary CTA
- [x] Show personalized context (company name)

### 3.5 Hard Gate Modal
- [x] Create `HardGateModal.tsx`
- [x] Trigger when trial exhausted and no API key
- [x] "Add API Key" option
- [x] Links to OpenRouter for free API key

### 3.6 Frontend Trial Hook
- [x] API methods in `api.ts`: `getTrialStatus()`, `useTrial()`
- [x] Integrated into OnboardingFlow component
- [ ] Optional: Create standalone `useTrialStatus.ts` hook with TanStack Query caching

---

## BATCH 3.5 CHECKLIST (Profile Integration)

**Status:** IN PROGRESS
**Depends on:** Batch 3 complete
**Started:** 2026-01-13

### 3.5.1 Profile Schema Update
- [x] Add `linkedin_url` field to user profile (VARCHAR, nullable)
- [x] Add `role` field to user profile (VARCHAR, nullable)
- [x] Create migration: `supabase/migrations/20260113300000_profile_fields.sql`
- [x] Run migration in Supabase ✅ Deployed 2026-01-13

### 3.5.2 Backend Profile Router
- [x] Update `ProfileUpdateRequest` Pydantic model with new fields
- [x] Update `get_profile` to return new fields
- [x] Update `update_profile` to handle new fields

### 3.5.3 Frontend Profile UI
- [x] Update `Profile` interface in `useProfile.ts`
- [x] Add LinkedIn URL input field to `ProfileSection.tsx`
- [x] Add Role input field to `ProfileSection.tsx`
- [x] Add i18n translations for new fields (EN + ES)

### 3.5.4 Onboarding → Profile Sync
- [x] After successful sign-in, save onboarding data to profile
- [x] Map: `full_name` → `display_name`, `role` → `role`, `company` → `company`, `linkedin_url` → `linkedin_url`
- [ ] Optional: Add "Re-run onboarding" button in settings

---

## BATCH 4 CHECKLIST (Analytics)

**Status:** NOT STARTED
**Can start:** Anytime (parallel work)

### 4.1 Analytics Setup
- [ ] Choose provider (PostHog recommended)
- [ ] Add to environment variables
- [ ] Create `frontend/src/services/analytics.ts`

### 4.2 Event Tracking
- [ ] `onboarding_start` event
- [ ] `linkedin_submitted` event
- [ ] `profile_loaded` event
- [ ] `auth_modal_shown` event
- [ ] `auth_completed` event
- [ ] `council_run_started` event
- [ ] `council_run_completed` event
- [ ] `hard_gate_shown` event
- [ ] `api_key_added` event

### 4.3 Funnel Dashboard
- [ ] Configure conversion funnel in PostHog
- [ ] Set up weekly report

---

## NOTES & BLOCKERS

### Session Notes
<!-- Add notes from each session here -->

**2025-01-13:** Initial plan created. Starting with Batch 1.

**2025-01-13 (Session 2):** Batch 1 implementation complete!
- Created lean onboarding flow with single `OnboardingFlow.tsx` component
- Reused existing components: `FormField`, `Input`, `Button`, `Card`, `Spinner`
- Added `/start` route to router.tsx
- Integrated into App.tsx with lazy loading
- Mock data ready with 2 profiles (Agency Owner, SaaS CTO)
- TypeScript compiles clean
- **NEXT:** Test the flow at http://localhost:5173/start

**2025-01-13 (Session 3):** QA Complete - All tests passing!
- **Static Analysis:** TypeScript ✓, ESLint ✓, all 145 tests pass ✓
- **Bug Found & Fixed:** `useRouteSync.ts` was redirecting `/start` to `/` - fixed by adding `pathname !== '/start'` condition
- **CSS Lint Fix:** Replaced `!important` with higher specificity selector in OnboardingFlow.css
- **Browser Testing:** All 4 onboarding steps verified (input, loading, preview, ready)
- **Regression Testing:** Settings modal ✓, Company modal ✓, Leaderboard modal ✓
- **Dark Mode:** Verified working correctly
- **Mobile Testing:** Deferred (requires physical device)
- **BATCH 1 COMPLETE** - Ready for Batch 2 when LinkedIn API is chosen

**2026-01-13 (Session 4):** Batch 2 & 3 Backend + Frontend Integration
- **User Decisions:** FreshLink for LinkedIn scraping, Apollo for enrichment, LLM-generated magic questions
- **Backend Created:**
  - `backend/routers/onboarding.py` - Profile analysis endpoint with rate limiting
  - `backend/services/trial.py` - TrialService for managing free trials
  - `backend/services/__init__.py` - Services package
  - `supabase/migrations/20260113100000_user_trials.sql` - Database migration
- **Backend Modified:**
  - `backend/model_registry.py` - Added `magic_question` alias to `utility` role
  - `backend/routers/v1.py` - Registered onboarding router
  - `backend/routers/__init__.py` - Exported onboarding_router
- **Frontend Created:**
  - `SoftGateModal.tsx` + CSS - Auth gate for unauthenticated users
  - `HardGateModal.tsx` + CSS - API key gate for exhausted trials
- **Frontend Modified:**
  - `api.ts` - Added onboarding endpoints and types
  - `OnboardingFlow.tsx` - Connected to real API, integrated gate modals
- **Tests:** All 289 backend + 145 frontend tests pass ✓
- **Remaining:** FreshLink/Apollo API integration (placeholder stubs in place), run migration

**2026-01-13 (Session 5):** QA, Type Fixes, Migration Deployment
- **Type Mismatches Fixed:**
  - `api.ts`: Fixed `OnboardingProfileResponse` to match backend structure
  - `api.ts`: Fixed `TrialStatusResponse` field `trial_available` → `has_trial_available`
  - `OnboardingFlow.tsx`: Updated `convertApiResponse()` to access `response.profile.*`
- **Migration Deployed:** User successfully ran `user_trials` migration in Supabase
- **Complete Flow Trace:** Documented step-by-step onboarding flow
- **Magic Question LLM:** Uses `utility` role → Gemini 2.5 Flash (primary), GPT-4o-mini (fallback)
- **Identified Profile Gaps:**
  - GAP 1: Profile doesn't store `linkedin_url`
  - GAP 2: Onboarding doesn't update user profile after completion
  - GAP 3: No "Re-run onboarding" option in settings
  - GAP 4: Magic question persona not in LLM Hub (acceptable - internal utility)
- **All Tests Pass:** 333 backend + 145 frontend tests ✓
- **Next:** Add linkedin_url and role to profile schema, save onboarding data to profile

**2026-01-13 (Session 5 continued):** Profile Integration Complete
- **Migration Created:** `20260113300000_profile_fields.sql` - adds linkedin_url and role columns
- **Backend Updated:** `profile.py` - ProfileUpdateRequest, get_profile, update_profile handle new fields
- **Frontend Updated:**
  - `useProfile.ts` - Profile interface with new fields
  - `ProfileSection.tsx` - Role and LinkedIn URL input fields added
  - `api.ts` - updateProfile method accepts new fields
  - `OnboardingFlow.tsx` - Saves profile data after successful auth
  - `useProfile.test.js` - Tests updated for new fields
- **i18n:** Added translations for role, rolePlaceholder, linkedinUrl, linkedinPlaceholder (EN + ES)
- **All Tests Pass:** 333 backend + 145 frontend tests ✓
- **Migration Deployed:** profile_fields migration run in Supabase ✅

### Blockers
<!-- List any blockers preventing progress -->

(none currently)

### Decisions Made
<!-- Important decisions to remember -->

1. **Trial cost:** ~$0.50-1.00 per run, treated as CAC
2. **Auth timing:** Soft gate at "Start Deliberation", not earlier
3. **Department logic:** Rules-based first, LLM fallback for edge cases
4. **Scraping service:** FreshLink (confirmed by user)
5. **Enrichment service:** Apollo (confirmed by user)
6. **Magic questions:** LLM-generated (not rule-based templates)

### Questions to Resolve
<!-- Questions that need answers before proceeding -->

1. ~~Which LinkedIn scraping service to use?~~ **RESOLVED: FreshLink**
2. Do we want a subscription tier or BYOK only?
3. PostHog vs simpler analytics (Supabase logs)?
4. FreshLink API key and Apollo API key needed for full integration

---

## FILE LOCATIONS

### Created Files
```
docs/ONBOARDING-IMPLEMENTATION-PLAN.md  ✅ Created 2025-01-13
docs/ONBOARDING-QUICK-START.md          ✅ Created 2025-01-13
todo/ONBOARDING-STATUS.md               ✅ Created 2025-01-13 (this file)

frontend/src/components/onboarding/
├── index.ts                            ✅ Created 2025-01-13
├── types.ts                            ✅ Created 2025-01-13
├── mockData.ts                         ✅ Created 2025-01-13
├── OnboardingFlow.tsx                  ✅ Created 2025-01-13, Modified 2026-01-13
├── OnboardingFlow.css                  ✅ Created 2025-01-13, Modified 2026-01-13
├── SoftGateModal.tsx                   ✅ Created 2026-01-13
├── SoftGateModal.css                   ✅ Created 2026-01-13
├── HardGateModal.tsx                   ✅ Created 2026-01-13
└── HardGateModal.css                   ✅ Created 2026-01-13

backend/routers/
├── onboarding.py                       ✅ Created 2026-01-13
└── v1.py                               ✅ Modified 2026-01-13

backend/services/
├── __init__.py                         ✅ Created 2026-01-13
└── trial.py                            ✅ Created 2026-01-13

supabase/migrations/
├── 20260113100000_user_trials.sql      ✅ Created 2026-01-13, Deployed
└── 20260113300000_profile_fields.sql   ✅ Created 2026-01-13, Deployed

Modified:
├── frontend/src/router.tsx             ✅ Added /start route
├── frontend/src/App.tsx                ✅ Added OnboardingFlow integration
├── frontend/src/api.ts                 ✅ Added onboarding API methods + profile fields
├── frontend/src/i18n/locales/en.json   ✅ Added role, linkedinUrl translations
├── frontend/src/i18n/locales/es.json   ✅ Added role, linkedinUrl translations
├── frontend/src/components/settings/hooks/useProfile.ts    ✅ Added linkedin_url, role fields
├── frontend/src/components/settings/ProfileSection.tsx     ✅ Added role, LinkedIn URL inputs
├── frontend/src/components/settings/hooks/useProfile.test.js ✅ Updated tests
├── backend/model_registry.py           ✅ Added magic_question alias
├── backend/routers/__init__.py         ✅ Exported onboarding_router
└── backend/routers/profile.py          ✅ Added linkedin_url, role fields
```

### Remaining To Be Created
```
backend/services/
├── profile_scraper.py                  ⏳ FreshLink API integration
└── company_enrichment.py               ⏳ Apollo API integration

frontend/src/components/onboarding/
└── ThinProfileFallback.tsx             ⏳ Manual input for thin profiles
```

---

## HOW TO USE THIS FILE

### Starting a New Session
```
1. Read this file first
2. Check "Current Phase" section
3. Look at unchecked items in current batch
4. Check "Notes & Blockers" for context
5. Continue from where we left off
```

### After Completing Work
```
1. Mark completed items with [x]
2. Add session notes with date
3. Update "Blockers" if any
4. Move to next unchecked item
```

### Changing Phases
```
1. Ensure all items in current batch are [x]
2. Update "Current Phase" header
3. Update "Started" date for new phase
```
