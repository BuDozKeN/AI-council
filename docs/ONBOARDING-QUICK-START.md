# Onboarding Implementation - Quick Start Guide

> TL;DR for developers implementing the Zero Friction onboarding

## The User Journey (5 min max)

```
[Landing] → [Paste LinkedIn] → [Magic Mirror Loading] → [Council Preview]
                                                              ↓
                                              [Click "Start Deliberation"]
                                                              ↓
                                              [Soft Gate: Google Auth]
                                                              ↓
                                              [Council Runs (FREE)]
                                                              ↓
                                              [Try 2nd Query → Hard Gate]
```

---

## Batch 1: Mock Mode UI (START HERE)

**Goal:** Build the flow with hardcoded data. No APIs needed.

### Files to Create

```bash
# Create the folder structure
mkdir -p frontend/src/components/onboarding
```

| File | Purpose | Priority |
|------|---------|----------|
| `LinkedInInput.tsx` | URL input + validation | 1 |
| `MagicMirrorLoader.tsx` | Animated "construction" sequence | 2 |
| `CouncilPreview.tsx` | Show departments + magic question | 3 |
| `OnboardingFlow.tsx` | State machine orchestrating steps | 4 |
| `mockData.ts` | Hardcoded test profiles | 1 |

### Mock Profile (Copy-Paste Ready)

```typescript
// mockData.ts
export const MOCK_PROFILE = {
  full_name: "Sarah Jenkins",
  role: "Founder & CEO",
  company: "Elevate Digital",
  industry: "Marketing Services",
  employees: 12,
  bio: "Founder of a boutique SEO agency focused on FinTech.",
  magic_question: "How can Elevate Digital transition from founder-led sales to a scalable outbound system without sacrificing the high-touch consultancy brand?",
  departments: [
    { id: "1", name: "Executive Strategy", icon: "chess-queen", purpose: "High-level strategic decisions" },
    { id: "2", name: "Agency Operations", icon: "cog", purpose: "Day-to-day operational efficiency" },
    { id: "3", name: "New Business", icon: "rocket", purpose: "Revenue growth and client acquisition" }
  ]
};
```

### LinkedInInput Component (Minimal)

```tsx
// LinkedInInput.tsx
import { useState } from 'react';
import './LinkedInInput.css';

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function LinkedInInput({ onSubmit, isLoading }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!url.includes('linkedin.com/in/')) {
      setError('Please enter a valid LinkedIn profile URL');
      return;
    }
    setError('');
    onSubmit(url);
  };

  return (
    <div className="linkedin-input-container">
      <h1>Build your personal AI Board of Directors</h1>
      <p className="subtitle">in 30 seconds</p>

      <div className="input-wrapper">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste your LinkedIn URL"
          disabled={isLoading}
        />
        <button onClick={handleSubmit} disabled={isLoading || !url}>
          {isLoading ? 'Assembling...' : 'Assemble Council'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

### MagicMirrorLoader Steps

```typescript
const LOADING_STEPS = [
  { id: 'profile', label: 'Analyzing profile...' },
  { id: 'company', label: 'Extracting company context from {company}...' },
  { id: 'dept1', label: 'Recruiting Head of Strategy...' },
  { id: 'dept2', label: 'Recruiting Operations Lead...' },
  { id: 'chairman', label: 'Briefing the Chairman...' },
];

// Animate through steps with 1-2s delay each
// Total: 5-8 seconds
// Show checkmarks as each completes
```

### CouncilPreview Layout

```
┌────────────────────────────────────────────────┐
│  Welcome, Sarah. Your Council is assembled.    │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Strategy │ │Operations│ │New Biz   │       │
│  │    ♕     │ │    ⚙     │ │    🚀    │       │
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                │
├────────────────────────────────────────────────┤
│  Your Council has identified a strategic       │
│  priority for Elevate Digital:                 │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ How can Elevate Digital transition from  │ │
│  │ founder-led sales to a scalable outbound │ │
│  │ system without sacrificing the high-     │ │
│  │ touch consultancy brand?                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│           [ Start Deliberation ]              │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Batch 3: Trial System (Do This Early)

### Database Migration

```sql
-- Run in Supabase SQL editor
CREATE TABLE IF NOT EXISTS user_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trial_type VARCHAR(50) NOT NULL DEFAULT 'onboarding_council',
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, trial_type)
);

-- RLS
ALTER TABLE user_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trials"
    ON user_trials FOR SELECT
    USING (auth.uid() = user_id);
```

### Backend Check

```python
# In conversations.py send_message_stream

async def get_api_key_for_request(user_id: str) -> tuple[str, bool]:
    """Returns (api_key, is_trial)"""
    # Check if trial available
    trial = await supabase.table('user_trials')\
        .select('id')\
        .eq('user_id', user_id)\
        .eq('trial_type', 'onboarding_council')\
        .execute()

    if len(trial.data) == 0:
        # Trial available - use master key
        return os.environ['OPENROUTER_API_KEY'], True

    # Check for user's own key
    user_key = await get_user_api_key(user_id)
    if user_key:
        return user_key, False

    # No key, no trial
    return None, False
```

---

## Integration Points

### Where to Add Onboarding

1. **Landing Page** (`LandingHero.tsx`):
   - Add "Get Started Free" button
   - Routes to `/onboarding`

2. **App Router** (`App.tsx`):
   - Add route for `/onboarding`
   - Conditionally show onboarding for new users

3. **Auth Flow** (`AuthContext.tsx`):
   - After auth complete, check if user has company
   - If no company, redirect to onboarding

### Existing Components to Reuse

- `OmniBar` styling for input
- `CouncilLoader` animation concepts
- `AppModal` for gates
- `Button` variants
- Aurora background effects

---

## Testing Checklist

### Batch 1 Complete When:
- [ ] Can paste LinkedIn URL and see validation
- [ ] Loading animation plays through all 5 steps
- [ ] Council preview shows mock departments
- [ ] Magic question appears pre-filled
- [ ] "Start Deliberation" button works
- [ ] Flow works on mobile

### Batch 3 Complete When:
- [ ] Auth modal appears on "Start Deliberation"
- [ ] Google auth works from modal
- [ ] First council run succeeds (trial used)
- [ ] Second query shows hard gate
- [ ] API key entry modal works

---

## Quick Commands

```bash
# Start dev environment
dev.bat

# Test onboarding route (after implementing)
# Navigate to http://localhost:5173/onboarding

# Check trial table in Supabase
# SELECT * FROM user_trials;
```

---

## Next Steps After Batch 1

1. **Get feedback** on the mock flow
2. **Add analytics** (even just console.log for now)
3. **Build trial system** (Batch 3)
4. **Then** integrate real LinkedIn API (Batch 2)

The mock flow lets you validate UX before spending money on APIs.
