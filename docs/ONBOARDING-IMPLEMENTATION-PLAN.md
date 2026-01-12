# Zero Friction Onboarding - Implementation Plan

> Based on Council Synthesis: "Show value before asking for commitment"

## Overview

This document breaks down the onboarding implementation into 4 realistic batches, each building on the previous. The goal is to convert users in 5 minutes using the "Magic Mirror" strategy.

**Core Philosophy:** Progressive Disclosure - Reveal the magic step-by-step to build anticipation.

---

## Current State Analysis

### What Already Exists (Leverage These)
- ✅ Google OAuth (instant auth)
- ✅ Perplexity-style landing with OmniBar
- ✅ 3-stage council execution with streaming
- ✅ Company/department/role management (backend)
- ✅ CouncilLoader with animated icons
- ✅ Beautiful Aurora background effects
- ✅ Supabase RLS for multi-tenant isolation

### What Needs to Be Built
- ❌ LinkedIn URL input flow
- ❌ Profile scraping/enrichment API
- ❌ "Magic Mirror" loading animation
- ❌ Auto-department generation logic
- ❌ Magic question generator
- ❌ Trial flag system (`has_used_trial`)
- ❌ Soft/Hard gate modals
- ❌ Analytics event tracking

---

## Batch 1: Mock Mode UI (Foundation)

**Goal:** Build the complete onboarding flow with hardcoded data. No APIs required.

**Duration Estimate:** 1-2 days focused work

### 1.1 New Components to Create

```
frontend/src/components/onboarding/
├── OnboardingFlow.tsx        # Main orchestrator
├── LinkedInInput.tsx         # Step 1: URL input
├── MagicMirrorLoader.tsx     # Step 2: Construction animation
├── CouncilPreview.tsx        # Step 3: Dashboard with magic Q
└── OnboardingGate.tsx        # Step 4: Auth/trial gate
```

### 1.2 LinkedInInput Component

**Purpose:** Single input field for LinkedIn URL

```tsx
// LinkedInInput.tsx
interface LinkedInInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

// UI Elements:
// - Headline: "Build your personal AI Board of Directors in 30 seconds."
// - Single input field with LinkedIn icon
// - Submit button: "Assemble Council"
// - Validation: Must be linkedin.com/in/... URL
```

**Styling:**
- Reuse OmniBar styling for consistency
- Aurora background from landing page
- Center-aligned, minimal layout

### 1.3 MagicMirrorLoader Component

**Purpose:** Theatrical loading that shows "the work being done"

**Critical UX:** This is NOT a spinner. It's a reveal sequence.

```tsx
// MagicMirrorLoader.tsx
interface LoaderStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete';
}

const STEPS: LoaderStep[] = [
  { id: 'profile', label: 'Analyzing profile...', status: 'pending' },
  { id: 'company', label: 'Extracting company context from {companyName}...', status: 'pending' },
  { id: 'dept1', label: 'Recruiting Head of Sales...', status: 'pending' },
  { id: 'dept2', label: 'Recruiting Chief Strategist...', status: 'pending' },
  { id: 'chairman', label: 'Briefing the Chairman...', status: 'pending' },
];

// Visual behavior:
// - Each step animates in sequence
// - Checkmark appears when complete
// - Terminal/high-tech aesthetic
// - Minimum 5-8 seconds total (artificial delay if API too fast)
```

**Animation Style Options:**
1. Terminal/CLI style (green text on dark)
2. Notion-like checklist with smooth checkmarks
3. Org chart "building" visually

### 1.4 CouncilPreview Component

**Purpose:** The "hook" - shows their personalized council + magic question

```tsx
// CouncilPreview.tsx
interface CouncilPreviewProps {
  profile: {
    name: string;
    role: string;
    company: string;
    industry: string;
  };
  departments: Department[];
  magicQuestion: string;
  onStartDeliberation: () => void;
}

// Layout:
// - Header: "Welcome, {Name}. Your Council is assembled."
// - Department cards (3-5) with icons
// - Magic question pre-filled in chat-like input
// - CTA button: "Start Deliberation"
```

### 1.5 Mock Data (Hardcoded)

Create mock profiles for testing:

```typescript
// frontend/src/components/onboarding/mockData.ts

export const MOCK_PROFILES = {
  agencyOwner: {
    full_name: "Sarah Jenkins",
    role: "Founder & CEO",
    company: "Elevate Digital",
    industry: "Marketing Services",
    employees: 12,
    bio: "Founder of a boutique SEO agency focused on FinTech...",
    magic_question: "How can Elevate Digital transition from founder-led sales to a scalable outbound system without sacrificing the high-touch consultancy brand?",
    departments: [
      { name: "Executive Strategy", icon: "chess-queen" },
      { name: "Agency Operations", icon: "cog" },
      { name: "New Business", icon: "rocket" }
    ]
  },
  saasCTO: {
    full_name: "David Chen",
    role: "CTO",
    company: "CloudFlow",
    industry: "SaaS / Logistics",
    employees: 150,
    bio: "Technical leader managing a team of 40...",
    magic_question: "Evaluate the trade-offs of rewriting our legacy logistics engine in Rust vs. refactoring the existing Python codebase, considering our Series C timeline of 9 months.",
    departments: [
      { name: "Engineering Architecture", icon: "code" },
      { name: "Product Strategy", icon: "lightbulb" },
      { name: "DevOps & Infrastructure", icon: "server" }
    ]
  }
};
```

### 1.6 Routing Integration

```tsx
// In App.tsx or router config
// New route: /onboarding or /start
// Landing page gets a prominent "Get Started" button linking here
```

### 1.7 Deliverables Checklist

- [ ] `LinkedInInput.tsx` - URL input with validation
- [ ] `MagicMirrorLoader.tsx` - Animated construction sequence
- [ ] `CouncilPreview.tsx` - Dashboard with departments + magic Q
- [ ] `mockData.ts` - Hardcoded test profiles
- [ ] `OnboardingFlow.tsx` - State machine orchestrating steps
- [ ] CSS files for each component
- [ ] Integration with existing landing page
- [ ] Mobile responsive design

---

## Batch 2: LinkedIn Integration & Data Enrichment

**Goal:** Replace mock data with real profile scraping

**Dependency:** Batch 1 complete

### 2.1 LinkedIn Data Strategy

**Option A: FreshLink API (Recommended)**
- Third-party LinkedIn scraping service
- Cost: ~$0.01-0.05 per lookup
- Reliable, no auth needed from user

**Option B: LinkedIn OAuth**
- User grants access to their profile
- More friction (requires LinkedIn app approval)
- Access to more data (connections, activity)

**Option C: Manual Input Fallback**
- If scraping fails, show form
- "Tell us about yourself" with 3-4 fields

### 2.2 Backend Endpoint

```python
# backend/routers/onboarding.py

@router.post("/analyze-profile")
async def analyze_linkedin_profile(
    request: LinkedInProfileRequest,
    user: dict = Depends(get_current_user_optional)  # Auth optional for first analysis
):
    """
    1. Scrape LinkedIn URL via FreshLink
    2. Enrich with Apollo for company data
    3. Generate departments via rule-based logic
    4. Generate magic question via LLM
    5. Return complete profile
    """

    # Step 1: Scrape profile
    profile = await freshlink_scrape(request.linkedin_url)

    # Step 2: Enrich company data
    company = await apollo_enrich(profile.company_name)

    # Step 3: Generate departments (rules-based first)
    departments = generate_departments(
        role=profile.title,
        industry=company.industry,
        employee_count=company.employees
    )

    # Step 4: Magic question (LLM call)
    magic_question = await generate_magic_question(profile, company)

    return OnboardingProfile(
        name=profile.name,
        role=profile.title,
        company=company.name,
        industry=company.industry,
        departments=departments,
        magic_question=magic_question
    )
```

### 2.3 Department Generation Logic

```python
# backend/services/department_generator.py

ROLE_DEPARTMENT_MAP = {
    # Founder/CEO roles
    ("founder", "ceo", "owner"): [
        "Executive Strategy",
        "Sales & Revenue",
        "Operations"
    ],
    # Marketing roles
    ("cmo", "marketing", "growth"): [
        "Brand Strategy",
        "Performance Marketing",
        "Content Operations"
    ],
    # Technical roles
    ("cto", "engineering", "developer", "technical"): [
        "Architecture & Systems",
        "DevOps & Infrastructure",
        "Product Engineering"
    ],
    # Sales roles
    ("sales", "revenue", "business development"): [
        "Outbound Strategy",
        "Deal Desk",
        "Account Management"
    ]
}

SIZE_MODIFIERS = {
    "small": (0, 20),      # "Guerrilla" prefix
    "mid": (21, 100),      # No prefix
    "enterprise": (101, float('inf'))  # "Enterprise" prefix
}
```

### 2.4 Magic Question Prompt

```python
MAGIC_QUESTION_PROMPT = """
You are an expert consultant. Based on this LinkedIn profile:
- Role: {role}
- Company: {company}
- Industry: {industry}
- Employee Count: {employees}
- Bio: {bio}

Generate ONE "Magic Question" that this person is likely losing sleep over right now.

Rules:
1. It must be specific to their stage and company size
2. It must be high-stakes (decisions that matter)
3. It must be open-ended (not yes/no)
4. Reference their company name and industry specifics
5. Maximum 2 sentences

Format: Return only the question text, nothing else.
"""
```

### 2.5 Fallback Flow

```tsx
// ThinProfileFallback.tsx
// Shown when LinkedIn data is insufficient (< 300 chars bio)

interface ThinProfileFallbackProps {
  partialProfile: Partial<Profile>;
  onComplete: (enrichedProfile: Profile) => void;
}

// Form fields:
// - "What's your main focus right now?" (textarea)
// - "What's your biggest challenge?" (optional)
// - Industry dropdown (if not detected)
```

### 2.6 Deliverables Checklist

- [ ] `POST /api/onboarding/analyze-profile` endpoint
- [ ] FreshLink integration (or chosen scraping service)
- [ ] Apollo enrichment integration
- [ ] `department_generator.py` with rule-based logic
- [ ] Magic question LLM prompt and generation
- [ ] `ThinProfileFallback.tsx` component
- [ ] Error handling for failed scrapes
- [ ] Rate limiting (prevent abuse)

---

## Batch 3: Trial System & Gates

**Goal:** Implement the "Scholarship Model" - first run free, then gate

**Dependency:** Batch 1 complete (Batch 2 can be parallel)

### 3.1 Database Schema Updates

```sql
-- Migration: add_trial_tracking.sql

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN DEFAULT FALSE;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Or use a separate table for more flexibility:
CREATE TABLE user_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trial_type VARCHAR(50) NOT NULL DEFAULT 'onboarding_council',
    used_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    UNIQUE(user_id, trial_type)
);
```

### 3.2 Backend Trial Logic

```python
# backend/services/trial.py

class TrialService:

    async def check_trial_available(self, user_id: str) -> bool:
        """Check if user has remaining trial runs."""
        result = await supabase.table('user_trials')\
            .select('id')\
            .eq('user_id', user_id)\
            .eq('trial_type', 'onboarding_council')\
            .execute()
        return len(result.data) == 0

    async def use_trial(self, user_id: str, ip: str = None):
        """Mark trial as used."""
        await supabase.table('user_trials').insert({
            'user_id': user_id,
            'trial_type': 'onboarding_council',
            'ip_address': ip
        }).execute()

    async def get_api_key_for_user(self, user_id: str) -> str:
        """
        Returns the API key to use for this user:
        - Master key if trial available
        - User's own key if trial used
        - None if no key and trial used
        """
        if await self.check_trial_available(user_id):
            return os.environ['MASTER_OPENROUTER_KEY']

        user_key = await self.get_user_api_key(user_id)
        return user_key  # May be None
```

### 3.3 Soft Gate (Auth Modal)

**Trigger:** User clicks "Start Deliberation" without being logged in

```tsx
// SoftGateModal.tsx
interface SoftGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthComplete: () => void;
  profile: Profile;  // Show personalized context
}

// Copy:
// "Save your Board's first report."
// "Your personalized council for {Company} is ready."
// Button: "Continue with Google" (primary)
// Link: "Sign up with email" (secondary)
```

**UX Notes:**
- Show their profile/company name in the modal (personalized)
- One-click Google auth is primary
- Don't mention API keys or payment yet

### 3.4 Hard Gate (Upgrade Modal)

**Trigger:** User attempts second query OR trial already used

```tsx
// HardGateModal.tsx
interface HardGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddApiKey: () => void;
  onUpgrade: () => void;
}

// Copy:
// "Your Council has finished its pro-bono session."
// "To keep your Board of Directors on retainer:"
//
// Option 1: "Add your OpenRouter API key" (BYOK - pay only for usage)
// Option 2: "Upgrade to Pro" (if you have a subscription tier)
//
// Subtext: "Average cost per council run: ~$0.50"
```

### 3.5 Trial Flag Integration in Council Endpoint

```python
# backend/routers/conversations.py

@router.post("/message/stream")
async def send_message_stream(
    request: MessageRequest,
    user: dict = Depends(get_current_user)
):
    trial_service = TrialService()

    # Check if user can run council
    api_key = await trial_service.get_api_key_for_user(user['id'])

    if api_key is None:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail={
                "error": "trial_exhausted",
                "message": "Please add an API key to continue"
            }
        )

    # If using master key, mark trial as used after successful completion
    is_trial = api_key == os.environ['MASTER_OPENROUTER_KEY']

    # ... run council with api_key ...

    if is_trial:
        await trial_service.use_trial(user['id'])
```

### 3.6 Frontend Trial State

```tsx
// hooks/useTrialStatus.ts

interface TrialStatus {
  hasTrialAvailable: boolean;
  hasApiKey: boolean;
  canRunCouncil: boolean;
  isLoading: boolean;
}

export function useTrialStatus(): TrialStatus {
  // Fetch from /api/user/trial-status endpoint
  // Cache with TanStack Query
}
```

### 3.7 Deliverables Checklist

- [ ] `user_trials` table migration
- [ ] `TrialService` class in backend
- [ ] `GET /api/user/trial-status` endpoint
- [ ] `SoftGateModal.tsx` component
- [ ] `HardGateModal.tsx` component
- [ ] `useTrialStatus` hook
- [ ] Integration in council execution flow
- [ ] 402 error handling in frontend
- [ ] Rate limiting by IP for unauthenticated analysis

---

## Batch 4: Analytics & Observability

**Goal:** Track drop-offs and conversion funnel

**Dependency:** Batch 1 complete

### 4.1 Event Definitions

```typescript
// frontend/src/services/analytics.ts

type OnboardingEvent =
  | { event: 'onboarding_start'; source: 'landing' | 'direct' }
  | { event: 'linkedin_submitted'; linkedin_url_valid: boolean }
  | { event: 'profile_loaded'; has_thin_data: boolean; company?: string }
  | { event: 'fallback_shown'; reason: 'thin_profile' | 'scrape_failed' }
  | { event: 'auth_modal_shown' }
  | { event: 'auth_completed'; method: 'google' | 'email' }
  | { event: 'council_run_started'; is_trial: boolean }
  | { event: 'council_run_completed'; duration_ms: number }
  | { event: 'hard_gate_shown' }
  | { event: 'api_key_added' }
  | { event: 'upgraded_to_pro' };
```

### 4.2 Analytics Options

**Option A: PostHog (Recommended)**
- Self-hostable
- Session recordings
- Funnel analysis built-in
- Free tier generous

**Option B: Supabase Logs**
- Already have Supabase
- Simple table insert
- Build own dashboard

**Option C: Mixpanel/Amplitude**
- More enterprise
- Better for retention analysis

### 4.3 Implementation (PostHog Example)

```typescript
// frontend/src/services/analytics.ts

import posthog from 'posthog-js';

export const analytics = {
  init() {
    if (import.meta.env.VITE_POSTHOG_KEY) {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: 'https://app.posthog.com',
        capture_pageview: false  // Manual control
      });
    }
  },

  track(event: OnboardingEvent) {
    posthog.capture(event.event, event);
  },

  identify(userId: string, traits?: Record<string, any>) {
    posthog.identify(userId, traits);
  }
};
```

### 4.4 Funnel Dashboard Requirements

Track these conversion rates:
1. **Landing → LinkedIn Input**: % who start onboarding
2. **LinkedIn → Profile Loaded**: % successful scrapes
3. **Profile → Auth**: % who click "Start Deliberation"
4. **Auth → Completed**: % who finish Google auth
5. **Completed → Council Run**: % who actually run council
6. **Council → Second Run**: % who attempt second query (hit gate)
7. **Gate → Conversion**: % who add API key or upgrade

### 4.5 Deliverables Checklist

- [ ] Analytics service setup (PostHog or chosen tool)
- [ ] Event tracking throughout onboarding flow
- [ ] User identification on auth complete
- [ ] Funnel dashboard configuration
- [ ] Error logging integration (Sentry events)
- [ ] Weekly drop-off report (can be manual initially)

---

## Implementation Order Recommendation

```
Week 1:
├── Batch 1 (Mock Mode UI) - PRIORITY
└── Start Batch 4 analytics setup (parallel)

Week 2:
├── Batch 3 (Trial System) - PRIORITY
└── Continue Batch 4 event integration

Week 3:
├── Batch 2 (LinkedIn Integration)
└── Final polish and testing

Week 4:
├── A/B testing different flows
└── Optimize based on analytics
```

### Reasoning:
1. **Batch 1 first** - You can start user testing immediately with mock data
2. **Batch 3 before Batch 2** - Trial system works with mock data, no API needed
3. **Batch 2 last** - Real scraping is the hardest, and you don't need it to validate the flow
4. **Batch 4 parallel** - Analytics should be in from day 1

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| LinkedIn blocks scraping | FreshLink handles this; have manual fallback ready |
| Trial abuse (bots) | Rate limit by IP; require auth before council run |
| High CAC from trial runs | Track cost per user; adjust if needed |
| Thin profile data | Always have fallback form ready |
| Users bounce at auth | Make auth modal beautiful, show value received |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Landing → Council Run | 30% | TBD |
| Auth completion rate | 80% | TBD |
| Trial → Paid conversion | 10% | TBD |
| Time to first value | < 60 seconds | TBD |
| Cost per trial run | < $1.00 | ~$0.50-0.80 |

---

## Files to Create Summary

### Frontend
```
frontend/src/components/onboarding/
├── OnboardingFlow.tsx
├── OnboardingFlow.css
├── LinkedInInput.tsx
├── LinkedInInput.css
├── MagicMirrorLoader.tsx
├── MagicMirrorLoader.css
├── CouncilPreview.tsx
├── CouncilPreview.css
├── OnboardingGate.tsx
├── ThinProfileFallback.tsx
├── mockData.ts
└── index.ts

frontend/src/hooks/
├── useTrialStatus.ts
└── useOnboarding.ts

frontend/src/services/
└── analytics.ts
```

### Backend
```
backend/routers/
└── onboarding.py

backend/services/
├── trial.py
├── department_generator.py
├── profile_scraper.py
└── magic_question.py

supabase/migrations/
└── 20250114_add_trial_tracking.sql
```

---

*Document created: 2025-01-13*
*Last updated: 2025-01-13*
*Author: Council + Claude Code*
