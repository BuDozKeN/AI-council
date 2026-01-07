# SEO & URL Routing Implementation Plan

> **Created:** 2026-01-05
> **Status:** Implemented (2026-01-07)
> **Priority:** Critical (Blocks both UX and SEO)

---

## Problem Statement

1. **UX Issue:** Pressing F5 (refresh) loses navigation state - user is sent back to hero page regardless of which section they were viewing (Settings, MyCompany, etc.)

2. **SEO Issue:** Google sees the entire app as ONE page because every view shares the same URL (`https://axcouncil.vercel.app/`). The site is essentially invisible to search engines.

**Root Cause:** No URL-based routing - all navigation is state-based via `useModalState` hook.

---

## Solution Overview

Implement React Router with browser history (path-based routing) to:
- Preserve navigation state across page refreshes
- Enable deep linking and bookmarking
- Make pages indexable by search engines
- Support browser back/forward buttons

---

## Phase 1: URL Routing Foundation (Day 1)

### 1.1 Install React Router

```bash
cd frontend
npm install react-router-dom
```

### 1.2 Define URL Structure

| Route | Component/View | Notes |
|-------|----------------|-------|
| `/` | Landing Hero / Chat | Main entry point |
| `/chat` | New conversation | Redirects to `/chat/:id` after creation |
| `/chat/:conversationId` | Specific conversation | Deep-linkable conversations |
| `/settings` | Settings modal/page | Default to first tab |
| `/settings/:tab` | Settings specific tab | `profile`, `api-keys`, `billing`, `team`, `developer` |
| `/company` | MyCompany modal/page | Default to `overview` tab |
| `/company/:tab` | MyCompany specific tab | `overview`, `team`, `projects`, `playbooks`, `decisions`, `usage`, `llm-hub` |
| `/company/:tab/:itemId` | Specific item view | e.g., `/company/decisions/abc123` |
| `/leaderboard` | Leaderboard | Model performance rankings |

### 1.3 Create Router Configuration

**File:** `frontend/src/router.tsx` (NEW)

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { ChatView } from './views/ChatView';
import { SettingsView } from './views/SettingsView';
import { CompanyView } from './views/CompanyView';
import { LeaderboardView } from './views/LeaderboardView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <ChatView /> },
      { path: 'chat', element: <ChatView /> },
      { path: 'chat/:conversationId', element: <ChatView /> },
      { path: 'settings', element: <SettingsView /> },
      { path: 'settings/:tab', element: <SettingsView /> },
      { path: 'company', element: <CompanyView /> },
      { path: 'company/:tab', element: <CompanyView /> },
      { path: 'company/:tab/:itemId', element: <CompanyView /> },
      { path: 'leaderboard', element: <LeaderboardView /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
```

### 1.4 Update main.tsx

**File:** `frontend/src/main.tsx`

```tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

// Replace <App /> with <RouterProvider router={router} />
```

### 1.5 Refactor App.tsx

**Current:** App.tsx manages all modal state and renders everything
**New:** App.tsx becomes a layout wrapper, child routes handle views

Key changes:
- Remove modal state management for routed views
- Use `<Outlet />` for child route rendering
- Keep shared components (Sidebar, Header) in App.tsx
- Navigation functions become `navigate()` calls

---

## Phase 2: Migrate Views to Routes (Day 1-2)

### 2.1 Create View Components

Create `frontend/src/views/` directory with:

| File | Purpose |
|------|---------|
| `ChatView.tsx` | Wraps ChatInterface, reads `:conversationId` from URL |
| `SettingsView.tsx` | Wraps Settings, reads `:tab` from URL |
| `CompanyView.tsx` | Wraps MyCompany, reads `:tab` and `:itemId` from URL |
| `LeaderboardView.tsx` | Wraps Leaderboard |

### 2.2 ChatView Implementation

```tsx
// frontend/src/views/ChatView.tsx
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useConversation } from '../contexts/ConversationContext';
import ChatInterface from '../components/ChatInterface';
import LandingHero from '../components/landing/LandingHero';

export function ChatView() {
  const { conversationId } = useParams();
  const { currentConversation, loadConversation } = useConversation();

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  // Show hero for new conversations, chat for existing
  if (!conversationId && (!currentConversation || currentConversation.isTemp)) {
    return <LandingHero />;
  }

  return <ChatInterface />;
}
```

### 2.3 SettingsView Implementation

```tsx
// frontend/src/views/SettingsView.tsx
import { useParams, useNavigate } from 'react-router-dom';
import Settings from '../components/settings';

const TAB_MAP = {
  'profile': 0,
  'api-keys': 1,
  'billing': 2,
  'team': 3,
  'developer': 4,
};

export function SettingsView() {
  const { tab } = useParams();
  const navigate = useNavigate();

  const initialTab = tab ? TAB_MAP[tab] ?? 0 : 0;

  const handleClose = () => navigate('/');
  const handleTabChange = (tabIndex: number) => {
    const tabName = Object.keys(TAB_MAP)[tabIndex];
    navigate(`/settings/${tabName}`, { replace: true });
  };

  return (
    <Settings
      isOpen={true}
      onClose={handleClose}
      initialTab={initialTab}
      onTabChange={handleTabChange}
    />
  );
}
```

### 2.4 CompanyView Implementation

```tsx
// frontend/src/views/CompanyView.tsx
import { useParams, useNavigate } from 'react-router-dom';
import MyCompany from '../components/MyCompany';

const TAB_MAP = {
  'overview': 'overview',
  'team': 'team',
  'projects': 'projects',
  'playbooks': 'playbooks',
  'decisions': 'decisions',
  'usage': 'usage',
  'llm-hub': 'llm-hub',
};

export function CompanyView() {
  const { tab, itemId } = useParams();
  const navigate = useNavigate();

  const handleClose = () => navigate('/');
  const handleTabChange = (tabName: string) => {
    navigate(`/company/${tabName}`, { replace: true });
  };
  const handleItemSelect = (tabName: string, id: string) => {
    navigate(`/company/${tabName}/${id}`);
  };

  return (
    <MyCompany
      isOpen={true}
      onClose={handleClose}
      initialTab={tab || 'overview'}
      initialItemId={itemId}
      onTabChange={handleTabChange}
      onItemSelect={handleItemSelect}
    />
  );
}
```

### 2.5 Update Navigation Throughout App

Replace all modal open/close with navigation:

```tsx
// Before (state-based)
const { openSettings } = useModalState();
<button onClick={() => openSettings()}>Settings</button>

// After (route-based)
const navigate = useNavigate();
<button onClick={() => navigate('/settings')}>Settings</button>
```

**Files to update:**
- `Sidebar.tsx` - Navigation buttons
- `MobileBottomNav.tsx` - Mobile navigation
- `ChatInterface.tsx` - Any settings/company links
- `Stage3Actions.tsx` - Save to knowledge base links
- `OmniBar.tsx` - Any navigation triggers

---

## Phase 3: Handle Edge Cases (Day 2)

### 3.1 Conversation Auto-Creation

When user types in OmniBar on `/`:
1. Create new conversation
2. Navigate to `/chat/:newId`
3. Send message

### 3.2 Deep Link to Conversation from URL Params

Support `?conversation=id` for backwards compatibility:
```tsx
// In router or ChatView
const [searchParams] = useSearchParams();
const legacyConversationId = searchParams.get('conversation');
if (legacyConversationId) {
  navigate(`/chat/${legacyConversationId}`, { replace: true });
}
```

### 3.3 Protected Routes (Auth Check)

Some routes require authentication:
```tsx
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/" replace />;

  return children;
}
```

### 3.4 Modal vs Page Decision

**Decision needed:** Should Settings/Company be:
- **Full page routes** (replace content area)
- **Modal overlays with URL sync** (current modal UX, but URL changes)

**Recommendation:** Modal overlays with URL sync (Hybrid approach)
- Keeps current UX users are familiar with
- URL still changes for refresh/bookmarking
- Back button closes modal

---

## Phase 4: SEO Foundation (Day 2-3)

### 4.1 Create robots.txt

**File:** `frontend/public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /chat/
Disallow: /settings/
Disallow: /company/

# Only index the landing page for now
# App pages require authentication

Sitemap: https://axcouncil.vercel.app/sitemap.xml
```

### 4.2 Create sitemap.xml

**File:** `frontend/public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://axcouncil.vercel.app/</loc>
    <lastmod>2026-01-05</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 4.3 Add Structured Data

**File:** `frontend/index.html` (add before `</head>`)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AxCouncil",
  "description": "AI-powered decision council platform that orchestrates multiple LLM models for strategic decision making",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://axcouncil.vercel.app",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": {
    "@type": "Organization",
    "name": "AxCouncil"
  }
}
</script>
```

### 4.4 Add Canonical URL (Dynamic)

Create a hook or component to set canonical URL per route:

```tsx
// frontend/src/hooks/useCanonical.ts
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useCanonical() {
  const location = useLocation();

  useEffect(() => {
    const baseUrl = 'https://axcouncil.vercel.app';
    const canonical = document.querySelector('link[rel="canonical"]');

    if (canonical) {
      canonical.setAttribute('href', `${baseUrl}${location.pathname}`);
    } else {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = `${baseUrl}${location.pathname}`;
      document.head.appendChild(link);
    }
  }, [location.pathname]);
}
```

### 4.5 Create OG Image

**File:** `frontend/public/og-image.png`

Create 1200x630px image with:
- AxCouncil logo
- Tagline: "Strategic AI Advisory Platform"
- Visual of the 5 AI models

---

## Phase 5: Testing & Verification (Day 3)

### 5.1 Manual Testing Checklist

- [ ] `/` loads hero page
- [ ] `/chat` loads chat interface
- [ ] `/chat/:id` loads specific conversation
- [ ] `/settings` opens settings (profile tab)
- [ ] `/settings/api-keys` opens settings on API keys tab
- [ ] `/company` opens MyCompany (overview tab)
- [ ] `/company/decisions` opens decisions tab
- [ ] `/company/decisions/:id` opens specific decision
- [ ] `/leaderboard` opens leaderboard
- [ ] F5 on any page preserves location
- [ ] Back button works correctly
- [ ] Forward button works correctly
- [ ] Direct URL paste works (deep linking)
- [ ] Invalid routes redirect to `/`

### 5.2 Update E2E Tests

Add tests for new routing:
```ts
test('settings route loads settings page', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('refresh preserves location', async ({ page }) => {
  await page.goto('/settings/api-keys');
  await page.reload();
  await expect(page.getByRole('tab', { name: /api keys/i })).toHaveAttribute('aria-selected', 'true');
});
```

### 5.3 Verify SEO Elements

- [ ] robots.txt accessible at `/robots.txt`
- [ ] sitemap.xml accessible at `/sitemap.xml`
- [ ] Structured data validates (Google Rich Results Test)
- [ ] OG tags render correctly (Facebook Debugger)
- [ ] Canonical URL updates per route

---

## Implementation Order

### Day 1 (Foundation) - COMPLETED 2026-01-07
1. [x] Install react-router-dom
2. [x] Create router.tsx with route definitions
3. [x] Update main.tsx to use RouterProvider
4. [x] Create useRouteSync hook (hybrid approach - no separate view components needed)
5. [x] Refactor App.tsx to use router navigation
6. [x] Test basic navigation works

### Day 2 (Migration) - COMPLETED 2026-01-07
7. [x] Update Sidebar navigation to use navigate() (via App.tsx handlers)
8. [x] Update MobileBottomNav to use navigate() (via App.tsx handlers)
9. [x] Handle conversation creation flow with routing
10. [x] Handle deep links and URL params
11. [x] Add canonical URL hook (useCanonical)
12. [ ] Test F5 refresh preserves state (pending manual test)

### Day 3 (SEO & Polish) - COMPLETED 2026-01-07
13. [x] Create robots.txt
14. [x] Create sitemap.xml
15. [x] Add structured data to index.html
16. [ ] Create OG image (pending - design needed)
17. [ ] Update/add E2E tests (pending)
18. [ ] Final testing and bug fixes (pending)

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/router.tsx` | Route configuration |
| `frontend/src/views/ChatView.tsx` | Chat route wrapper |
| `frontend/src/views/SettingsView.tsx` | Settings route wrapper |
| `frontend/src/views/CompanyView.tsx` | MyCompany route wrapper |
| `frontend/src/views/LeaderboardView.tsx` | Leaderboard route wrapper |
| `frontend/src/views/index.ts` | View exports |
| `frontend/src/hooks/useCanonical.ts` | Dynamic canonical URL |
| `frontend/public/robots.txt` | Crawler instructions |
| `frontend/public/sitemap.xml` | Page discovery |
| `frontend/public/og-image.png` | Social sharing image |

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/main.tsx` | RouterProvider instead of App |
| `frontend/src/App.tsx` | Layout wrapper with Outlet |
| `frontend/src/components/Sidebar.tsx` | navigate() instead of modal state |
| `frontend/src/components/ui/MobileBottomNav.tsx` | navigate() instead of modal state |
| `frontend/src/hooks/useModalState.ts` | May be simplified or removed |
| `frontend/index.html` | Add structured data |

---

## Rollback Plan

If issues arise:
1. The routing changes are additive (new files)
2. Keep useModalState working during transition
3. Can revert main.tsx to use App directly
4. All changes isolated to frontend - no backend changes

---

## Success Criteria

- [ ] User can refresh (F5) on any page and stay on that page
- [ ] User can bookmark any section and return to it
- [ ] User can share URLs to specific views
- [ ] Back/forward browser buttons work correctly
- [ ] All existing functionality continues to work
- [ ] robots.txt and sitemap.xml are accessible
- [ ] No console errors related to routing

---

## Notes

- **Vercel SPA Config:** Already handles client-side routing (returns index.html for all routes)
- **Custom Domain:** When ready, update sitemap.xml and canonical URLs
- **i18n:** Consider `/en/settings`, `/es/settings` structure later
- **Analytics:** URL changes will auto-track in GA4/Sentry when implemented

---

## Related Documents

- [AUDIT_DASHBOARD.md](AUDIT_DASHBOARD.md) - SEO audit score: 3/10
- Council prompt for routing decision (sent 2026-01-05)
