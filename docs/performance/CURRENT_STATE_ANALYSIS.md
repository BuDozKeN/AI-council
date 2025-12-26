# Current State Analysis

## Project Overview

AxCouncil is an AI-powered decision-making platform that assembles a virtual "council" of AI advisors to provide multi-perspective analysis on business decisions.

---

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vite + React)                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ TanStack    │ │ Contexts    │ │ Lazy Routes │ │ PWA/SW     │ │
│  │ Query       │ │ (Auth, Biz) │ │ (Code Split)│ │ (Workbox)  │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
└─────────┼───────────────┼───────────────┼──────────────┼────────┘
          │               │               │              │
          ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Layer (api.ts)                         │
│        Token injection, streaming handlers, error handling       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Routers     │ │ Security    │ │ AI Council  │ │ Cache      │ │
│  │ (11 total)  │ │ (RLS, Rate) │ │ (Streaming) │ │ (Unused!)  │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
└─────────┼───────────────┼───────────────┼──────────────┼────────┘
          │               │               │              │
          ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + Auth)                  │
│        RLS policies, Connection pooling, Real-time (unused)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure Assessment

### Frontend Structure (`/frontend/src/`)

```
src/
├── api.ts                    # Centralized API calls + streaming
├── App.tsx                   # Route definitions, lazy loading
├── AuthContext.tsx           # Auth state, JWT management
├── main.tsx                  # Entry point, providers, Web Vitals
├── supabase.ts               # Supabase client configuration
│
├── components/               # UI components
│   ├── ui/                   # Base components (shadcn/ui)
│   ├── council/              # AI Council specific
│   ├── layout/               # Layout components
│   └── [feature]/            # Feature-specific components
│
├── contexts/                 # React contexts
│   ├── BusinessContext.tsx   # Company/project state
│   └── ConversationContext.tsx # Chat state + mutations
│
├── hooks/                    # Custom hooks
│   ├── queries/              # TanStack Query hooks
│   │   ├── useCompany.ts
│   │   ├── useConversations.ts
│   │   └── useProjects.ts
│   ├── useMessageStreaming.ts # SSE streaming handler
│   └── [other hooks]
│
├── pages/                    # Route pages (lazy loaded)
│   ├── Dashboard.tsx
│   ├── Company.tsx
│   ├── Projects.tsx
│   ├── Decisions.tsx
│   └── [other pages]
│
├── utils/                    # Utility functions
│   ├── webVitals.ts          # Core Web Vitals tracking
│   ├── logger.ts             # Structured logging
│   └── sentry.ts             # Error tracking
│
└── types/                    # TypeScript definitions
```

### Backend Structure (`/backend/`)

```
backend/
├── main.py                   # FastAPI app, middleware stack
├── database.py               # Supabase connection pooling
├── security.py               # Auth, validation, rate limiting
├── council.py                # Multi-model AI streaming
├── openrouter.py             # AI provider integration
│
├── routers/                  # API endpoints
│   ├── company.py            # 41 endpoints (largest)
│   ├── conversations.py      # 11 endpoints
│   ├── projects.py           # 9 endpoints
│   ├── knowledge.py          # 7 endpoints
│   └── [other routers]
│
└── utils/
    ├── cache.py              # TTL cache (NOT USED!)
    └── storage.py            # Message storage helpers
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.x | UI framework |
| Vite | 5.4.x | Build tool |
| TanStack Query | 5.x | Data fetching/caching |
| Framer Motion | 11.x | Animations |
| Tailwind CSS | 3.4.x | Styling |
| shadcn/ui | Latest | Component library |
| Sentry | 8.x | Error tracking |
| web-vitals | 4.x | Performance monitoring |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Runtime |
| FastAPI | 0.109.x | API framework |
| Supabase | Latest | Database + Auth |
| SlowAPI | 0.1.x | Rate limiting |
| httpx | 0.27.x | HTTP client |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting |
| Render | Backend hosting |
| Supabase | Database + Auth |
| OpenRouter | AI provider proxy |
| Sentry | Error monitoring |

---

## Data Flow Analysis

### Authentication Flow
```
User Login
    │
    ▼
Supabase Auth (signInWithPassword/OAuth)
    │
    ▼
JWT Token Stored (Supabase manages)
    │
    ▼
AuthContext provides getAccessToken()
    │
    ▼
api.ts injects Bearer token to all requests
    │
    ▼
Backend validates JWT, applies RLS
```

### Data Fetching Flow
```
Component Mounts
    │
    ▼
useQuery hook triggered
    │
    ├── Cache HIT → Return cached data
    │
    └── Cache MISS
         │
         ▼
    API call via api.ts
         │
         ▼
    Backend router
         │
         ▼
    Supabase with RLS
         │
         ▼
    Response cached (5min staleTime)
         │
         ▼
    Component renders with data
```

### AI Streaming Flow
```
User Sends Message
    │
    ▼
POST /conversations/{id}/messages
    │
    ▼
Backend creates SSE stream
    │
    ▼
Stage 1: 5 Council Models (parallel, staggered)
    │    └── Tokens streamed via SSE
    │
    ▼
Stage 2: Peer Rankings (5 models rank responses)
    │    └── Tokens streamed via SSE
    │
    ▼
Stage 3: Chairman Synthesis
    │    └── Final response streamed
    │
    ▼
Frontend batches tokens (requestAnimationFrame)
    │
    ▼
UI updates at 60fps
```

---

## Current Performance Characteristics

### Strengths

1. **TanStack Query Configuration**
   - 5-minute staleTime (appropriate for business data)
   - Query key factories for consistent invalidation
   - Optimistic updates on mutations

2. **Code Splitting**
   - All major routes lazy-loaded
   - Vendor chunks separated (react, motion, markdown, radix)
   - Dynamic imports for heavy components

3. **PWA Ready**
   - Workbox service worker configured
   - CacheFirst for static assets
   - NetworkFirst for API calls

4. **Connection Pooling**
   - Backend pools Supabase clients
   - 5-minute TTL, max 100 clients
   - Automatic cleanup

### Weaknesses

1. **No Prefetching**
   - Data only fetched on click
   - Visible loading states on navigation
   - TanStack Query prefetch capabilities unused

2. **Backend Cache Unused**
   - TTLCache defined but never called
   - Every request hits database
   - Departments, team data refetched constantly

3. **No Persistent Cache**
   - Memory cache lost on refresh
   - Returning users wait for refetch
   - No IndexedDB/localStorage persistence

4. **Streaming Buffers**
   - String concatenation (O(n²) memory)
   - Unbounded queues
   - No backpressure handling

---

## Separation of Concerns Assessment

| Layer | Location | Assessment |
|-------|----------|------------|
| UI Components | `/frontend/src/components/` | ✅ Well-organized by feature |
| Business Logic | `/frontend/src/contexts/` | ✅ Centralized, memoized |
| Data Access | `/frontend/src/hooks/queries/` | ✅ TanStack Query pattern |
| State Management | Contexts + TanStack Query | ✅ Appropriate split |
| API Layer | `/frontend/src/api.ts` | ✅ Centralized, typed |
| Utilities | `/frontend/src/utils/` | ✅ Pure functions |
| Backend Routing | `/backend/routers/` | ⚠️ company.py is large (41 endpoints) |
| Backend Security | `/backend/security.py` | ✅ Comprehensive |
| Backend Data | `/backend/database.py` | ✅ Clean abstraction |

---

## Code Quality Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| TypeScript coverage | ~95% | ✅ Excellent |
| ESLint compliance | Yes | ✅ Good |
| Component size | Avg 150 lines | ✅ Manageable |
| Max file size | ~800 lines (company.py) | ⚠️ Could split |
| Test coverage | Limited | ⚠️ Opportunity |
| Error handling | Comprehensive | ✅ Good |
| Logging | Structured (logger.ts) | ✅ Good |

---

## Dependency Health

### Production Dependencies (25)
- All dependencies are well-maintained
- No deprecated packages
- No known critical vulnerabilities
- React 18.3 (current stable)
- Vite 5.4 (current stable)

### Notable Dependencies

| Package | Size Impact | Assessment |
|---------|-------------|------------|
| framer-motion | ~30KB gzip | Could optimize |
| react-markdown | ~25KB gzip | Necessary for AI output |
| @sentry/react | ~15KB gzip | Required for monitoring |
| @tanstack/react-query | ~12KB gzip | Essential, well worth it |

---

## Summary

The AxCouncil codebase follows modern React/FastAPI patterns and is well-architected for a SaaS application. The main optimization opportunities are:

1. **Activate backend caching** - Already built, just unused
2. **Add prefetching** - TanStack Query supports this natively
3. **Persistent cache** - Standard pattern, easy to add
4. **Buffer optimization** - Known patterns for streaming

These are enhancements to an already solid foundation, not fundamental fixes.
