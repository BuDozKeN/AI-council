# AxCouncil Login & Onboarding Guide
## For Council Review - December 2025

---

## Executive Summary

This document outlines the current login and onboarding process for AxCouncil PPO (Platform Product Offering). We have **solid authentication infrastructure** but **limited guided onboarding**. Users can sign in within seconds, but the "aha moment" could be faster.

---

## Current User Journey (What We HAVE)

### 1. Authentication Layer ✅ COMPLETE

```
┌─────────────────────────────────────────────────────────────┐
│                      LOGIN SCREEN                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           🌟 AxCouncil                               │    │
│  │         "Welcome back"                               │    │
│  │   "Sign in to continue to AxCouncil"                │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │    🔵 Continue with Google (PRIMARY CTA)     │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │           ─── or continue with email ───            │    │
│  │                                                      │    │
│  │  Email:    [___________________________]            │    │
│  │  Password: [___________________________]            │    │
│  │                                                      │    │
│  │  [Sign In]                                          │    │
│  │                                                      │    │
│  │  Forgot password?  │  Don't have an account? Sign up│    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│                   ✨ Aurora Background ✨                    │
└─────────────────────────────────────────────────────────────┘
```

**Authentication Methods:**
| Method | Status | Time to Sign In |
|--------|--------|-----------------|
| Google OAuth | ✅ Working | ~3 seconds |
| Email/Password | ✅ Working | ~10 seconds |
| Password Reset | ✅ Working | ~60 seconds (email) |

**Technical Stack:**
- Supabase Auth (JWT tokens)
- Row-Level Security (RLS) on all tables
- GDPR/HIPAA compliant logging
- Auto token refresh (60s before expiry)

---

### 2. First-Time User Experience (Post-Login) ✅ BASIC

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING HERO                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    AxCouncil                         │    │
│  │  "What high-stakes decision can we help you solve?" │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │  Ask anything...                       [→]   │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │                                                      │    │
│  │  [Quick] [Full Council]          [Smart Auto ▼]     │    │
│  │                                                      │    │
│  │  Quick Actions:                                      │    │
│  │  💡 "Help me decide..." 💡 "Analyze my..." etc.     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**What Users See:**
1. Intent-first omni-bar (Perplexity-style)
2. Mode toggle: Quick vs Full Council
3. Context selector (Smart Auto default)
4. Quick action chips for inspiration

**Smart Auto Feature:**
- Remembers user's last-used company/department/role
- Persists context across sessions
- Falls back gracefully if no history

---

## What We DON'T HAVE (Gaps for Council)

### ❌ Gap 1: No Guided First-Time Setup

**Current State:**
- User lands on empty omni-bar
- No profile completion prompt
- No company setup wizard
- User must discover features themselves

**Recommendation:**
```
FIRST LOGIN → "Let's set you up!" wizard:
  Step 1: Display name + photo (optional)
  Step 2: Select/create your company
  Step 3: Choose your role
  Step 4: First guided query
```

### ❌ Gap 2: No Company Onboarding Flow

**Current State:**
- Companies exist but no guided creation
- No team invitation flow from onboarding
- User must find Settings > Company manually

**Recommendation:**
- Add "Create Your Company" CTA for new users
- Show team invite modal after first successful query
- Prompt: "Invite your team to make better decisions together"

### ❌ Gap 3: No Progress Indicators

**Current State:**
- No onboarding checklist
- No "you're 50% set up" progress bar
- No gamification elements

**Recommendation:**
```
Profile Setup Checklist:
☑ Create account
☐ Complete profile (name, company, phone)
☐ Set up your first company
☐ Invite a team member
☐ Run your first Council session
☐ Export your first decision log
```

### ❌ Gap 4: No In-App Tooltips/Tours

**Current State:**
- Features are discoverable but not explained
- No "What's this?" tooltips
- No interactive tour on first login

**Recommendation:**
- Add lightweight product tour (3-5 steps max)
- Highlight: Context selector, Mode toggle, Deep links
- Skip button always visible

### ❌ Gap 5: No Email Nurture Sequence

**Current State:**
- Email confirmation only
- No welcome email with getting started tips
- No follow-up if user churns

**Recommendation:**
- Day 0: Welcome email + quick start guide
- Day 1: "Did you know?" feature highlight
- Day 3: "You haven't run a Council yet"
- Day 7: Success story + invite team CTA

---

## Time-to-Value Analysis

### Current Journey:
```
Sign Up → Confirm Email → Login → Stare at Omni-bar → ??? → First Query
         ~60 sec          ~3 sec      ??? unknown
```

**Problem:** Unknown time between login and first value

### Ideal Journey:
```
Sign Up → Login → Quick Win (Guided) → "Wow!" moment → Return tomorrow
         ~3 sec   ~30 sec               ~60 sec
```

---

## Quick Wins (Can Implement Fast)

### Priority 1: Welcome Message
- Show personalized greeting on first login
- "Welcome to AxCouncil! Ask your first question below."
- One-time banner, dismiss on click

### Priority 2: Pre-fill Quick Action
- First-time users see the input pre-filled:
- "Help me decide: [what's your biggest decision this week?]"
- Cursor blinks at the bracket

### Priority 3: Success Celebration
- After first query completes:
- "🎉 Your first Council decision! View your decision log"
- Subtly teaches the feature

### Priority 4: Profile Nudge
- After 2nd session:
- "Complete your profile to personalize recommendations"
- Links to Settings > Profile

---

## Technical Readiness

### Already Built (Backend Ready):
| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| User Profiles | ✅ | ✅ | Ready |
| Company CRUD | ✅ | ✅ | Ready |
| Team Invitations | ✅ | ⚠️ Partial | Needs UI |
| User Preferences | ✅ | ✅ | Ready |
| Session Persistence | ✅ | ✅ | Ready |

### Needs Development:
| Feature | Effort | Impact |
|---------|--------|--------|
| First-run wizard | Medium | High |
| Product tour | Low | Medium |
| Onboarding checklist | Low | Medium |
| Welcome email | Low | High |
| Profile nudges | Low | Medium |

---

## Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/components/Login.jsx` | Authentication UI |
| `frontend/src/AuthContext.jsx` | Auth state management |
| `frontend/src/components/landing/LandingHero.jsx` | First-time landing |
| `frontend/src/components/Settings.jsx` | Profile management |
| `backend/auth.py` | JWT verification |
| `backend/storage.py` | User profile CRUD |

---

## Recommendation for Council

**Immediate (This Sprint):**
1. Add welcome message for first-time users
2. Pre-fill first query suggestion
3. Success celebration after first Council

**Next Sprint:**
1. Simple 3-step onboarding wizard
2. Profile completion nudges
3. Welcome email automation

**Future:**
1. Full product tour
2. Team invitation flow
3. Onboarding analytics

---

## Questions for Council Discussion

1. **Wizard vs. Progressive Disclosure**: Do we force users through setup, or let them explore and nudge later?

2. **Google-First Strategy**: 80%+ of B2B SaaS users prefer Google OAuth. Should we hide email/password behind "Other options"?

3. **Company Requirement**: Should users be required to select/create a company before their first query, or allow "Personal" mode?

4. **Time-to-First-Query**: What's our target? Current: unknown. Goal: <60 seconds?

5. **Invite Flow Priority**: When should we prompt team invites? After 1st query? After profile complete? After 3 sessions?

---

*Document generated for Council review. All technical details verified against current codebase.*
