# CLAUDE.md - AxCouncil Development Guide

> This file provides context for Claude Code to maintain consistency across development sessions.

## Quick Start (New Terminal/Session)

### Prerequisites

1. **Node.js** (v18+) - [Download](https://nodejs.org/)
2. **Python** (3.10+) - [Download](https://www.python.org/)
3. **Git** - [Download](https://git-scm.com/)
4. **Google Chrome** - For MCP DevTools integration

### Installation (First Time Only)

```bash
# Clone and enter project
git clone <repo-url>
cd AI-council

# Frontend dependencies
cd frontend
npm install
cd ..

# Backend dependencies (from project root)
pip install -e ".[dev]"

# Pre-commit hooks (optional but recommended)
pre-commit install
```

### Starting Development

**One-click startup (Windows - recommended):**
```bash
dev.bat
```
This starts Chrome (debug mode), Backend, and Frontend together.

**Manual startup:**
```bash
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Backend (from project root)
python -m backend.main

# Terminal 3: Chrome with debugging (for Claude browser access)
start-chrome-debug.bat
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` - Supabase project
- `VITE_API_URL` - Usually `http://localhost:8081`
- `OPENROUTER_API_KEY` - For LLM API access

## Project Overview

AxCouncil is an AI-powered decision council platform that orchestrates multiple LLM models (Claude, GPT, Gemini, Grok, DeepSeek) through a 3-stage deliberation pipeline: individual responses → peer review → synthesis.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, TypeScript 5.9 |
| Styling | Tailwind CSS v4, Radix UI, Framer Motion |
| State | TanStack Query v5 + React Context |
| Backend | FastAPI, Python 3.10+ |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (JWT) |
| Monitoring | Sentry |

## Directory Structure

```
AI-council/
├── frontend/              # React SPA
│   ├── src/
│   │   ├── components/    # UI components
│   │   │   ├── ui/        # Base shadcn/ui components
│   │   │   ├── chat/      # Chat interface
│   │   │   ├── mycompany/ # Company management
│   │   │   └── stage1-3/  # Deliberation stages
│   │   ├── styles/        # Design tokens
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilities
│   │   └── contexts/      # React contexts
│   └── package.json
├── backend/               # FastAPI API
│   ├── routers/           # API endpoints
│   │   └── company/       # Sub-routers
│   ├── utils/             # Helpers
│   └── migrations/        # SQL schemas
├── supabase/              # Database config
└── councils/              # Legacy templates (not runtime)
```

## Frontend Conventions

### Design System

The design system uses semantic CSS tokens. Always use these patterns:

```css
/* DO: Use semantic tokens */
color: var(--color-text-primary);
background: var(--color-bg-primary);
padding: var(--space-4);
border-radius: var(--radius-md);

/* DON'T: Hardcode values */
color: #37352f;
padding: 16px;
```

**Key token files:**
- `frontend/src/styles/design-tokens.css` - Core tokens
- `frontend/src/styles/tailwind.css` - Tailwind config + custom layers

### Styling Priority

1. **Tailwind utilities** for layout and responsive design
2. **CSS variables** from design-tokens.css for colors, spacing, radius
3. **Scoped CSS files** only for complex interactions/animations

```tsx
// Preferred pattern
<div className="flex items-center gap-4 p-6 rounded-lg bg-card">
  <Button variant="default">Action</Button>
</div>
```

### Component Patterns

- Use Radix UI primitives with custom styling
- Use CVA (class-variance-authority) for component variants
- Pair complex components with `.css` files (e.g., `Modal.tsx` + `Modal.css`)
- Export via `index.ts` in subdirectories

```tsx
// Button variant pattern (CVA)
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2",
  {
    variants: {
      variant: { default: "btn-variant-default" },
      size: { default: "h-9 px-4" }
    }
  }
)
```

### Dark Mode

- Class-based switching via `next-themes`
- All components must support both modes
- Test with `.dark` class on root element

### Accessibility Requirements

- 44px minimum touch targets on mobile
- `focus-visible` states on all interactive elements
- Support `prefers-reduced-motion`
- Use `sr-only` for screen reader labels

### State Management

- **TanStack Query** for server state (with IndexedDB persistence)
- **React Context** for auth, business data, UI state
- Don't duplicate server state in local state

## Backend Conventions

### API Structure

```python
# Router pattern
from fastapi import APIRouter, Depends
from auth import get_current_user

router = APIRouter(prefix="/api/resource", tags=["resource"])

@router.get("/")
async def list_items(user: dict = Depends(get_current_user)):
    # Always filter by user ownership
    return await get_items_for_user(user["id"])
```

### Database Patterns

```python
# Always use parameterized queries
supabase.table("items").select("*").eq("company_id", company_id).execute()

# Use service client only for admin operations
from database import get_supabase_service
service = get_supabase_service()

# Use auth client for user-scoped queries (respects RLS)
from database import get_supabase_with_auth
client = get_supabase_with_auth(user["access_token"])
```

### Pydantic Models

Define request/response models in each router file:

```python
class CreateItemRequest(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
```

### Error Handling

```python
from security import create_secure_error

# Use secure error factory (sanitizes messages)
raise create_secure_error(404, "Resource not found", log_details={"id": item_id})
```

### Import Pattern

Support both module and direct execution:

```python
try:
    from .module import thing
except ImportError:
    from backend.module import thing
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `companies` | Company profiles with context |
| `departments` | Department configurations |
| `roles` | AI personas with system prompts |
| `org_documents` | Playbooks (SOPs, policies) |
| `knowledge_entries` | Saved decisions |
| `conversations` | Chat history |

### RLS Policy

All tables enforce multi-tenant isolation:
```sql
company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
```

## Testing

### Frontend

```bash
cd frontend
npm run test        # Watch mode
npm run test:run    # Single run
npm run test:coverage
```

- Vitest + Testing Library
- MSW for API mocking
- JSDOM environment

### Linting

```bash
cd frontend
npm run lint        # ESLint
npm run lint:css    # Stylelint
npm run type-check  # TypeScript
npm run format      # Prettier
```

Pre-commit hooks run `lint-staged` automatically.

## Common Pitfalls

### Frontend

- **Don't** hardcode colors - use `--color-*` or `--overlay-*` tokens (NEVER use `rgba()`, `#hex`, or color names)
- **Don't** use `!important` - increase selector specificity instead
- **Don't** skip dark mode testing
- **Don't** use arbitrary pixel values - use spacing tokens
- **Don't** forget mobile touch targets (44px min)
- **Do** use Tailwind for layout, tokens for theming
- **Do** check mobile viewport when making CSS changes

### Layout & Scrolling Patterns

When building scrollable layouts with cards:

1. **Single scroll container** - Only ONE element should have `overflow-y: auto`. Never nest scroll containers.
2. **Parent is scroll container** - The parent scrolls, children flow naturally inside it.
3. **Alignment via parent padding** - Cards align when parent has consistent padding. Don't mix card margins with parent padding.
4. **Sticky elements** - Use `position: sticky` inside the scroll container, with solid `background` to cover content scrolling behind.

```css
/* CORRECT: Parent scrolls, children flow */
.scroll-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}
.card-inside {
  /* No overflow, no height constraints - just flows naturally */
  padding: var(--card-padding-xl);
}

/* WRONG: Nested scroll containers */
.parent { overflow-y: auto; }
.child { overflow-y: auto; }  /* Creates scroll-in-scroll mess */
```

### Button Variants

Use consistent button variants:
- `variant="default"` - Primary actions (indigo/blue filled) - Edit, Save, Submit
- `variant="outline"` - Secondary actions (bordered) - Cancel, Back
- `variant="ghost"` - Tertiary/subtle actions - Close, minor toggles
- `variant="destructive"` - Dangerous actions - Delete, Remove

### Mobile Layout Rules

1. **Same structure, adjusted spacing** - Don't restructure HTML for mobile, just adjust CSS
2. **Match padding between siblings** - If header has `padding: 12px 16px`, body should use same horizontal: `padding: X 16px`
3. **Let flexbox handle wrapping** - Use `flex-wrap: wrap` not restructured HTML
4. **Test both viewports** - Always verify changes on both desktop AND mobile

### Backend

- **Don't** expose internal errors - use `create_secure_error()`
- **Don't** bypass RLS unless admin operation requires it
- **Don't** store sensitive data without encryption
- **Do** filter all queries by user/company ownership
- **Do** use rate limiting on public endpoints

## Key Commands

```bash
# ONE-CLICK DEV ENVIRONMENT (recommended)
dev.bat                       # Starts Chrome+Backend+Frontend, enables Claude browser access

# Individual services (if needed separately)
cd frontend && npm run dev    # Frontend only
python -m backend.main        # Backend only (run from project root)
start-chrome-debug.bat        # Chrome with debug port only

# Full lint check
cd frontend && npm run lint && npm run type-check

# Build for production
cd frontend && npm run build

# Kill stale processes on ports (Windows)
netstat -ano | findstr :8081  # Find PID
taskkill //F //PID <pid>      # Kill it

# Regenerate secrets baseline (if pre-commit fails)
detect-secrets scan --baseline .secrets.baseline
```

## Environment Variables

See `.env.example` for required variables:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` - Backend API base
- `VITE_SENTRY_DSN` - Error tracking
- `OPENROUTER_API_KEY` - LLM access

## MCP Servers (Claude Code Integration)

The project has two MCP servers configured in `.mcp.json`:

### Configuration File (`.mcp.json`)

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=ywoodvmtbkinopixoyfc"
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"]
    }
  }
}
```

### 1. Supabase MCP
Enables Claude to query the database schema and generate accurate TypeScript types.
- **No setup required** - Works automatically via HTTP connection
- Provides schema introspection for all tables (companies, departments, roles, etc.)

### 2. Chrome DevTools MCP
Enables Claude to read browser console logs, network requests, and take screenshots.

**Setup for browser debugging:**
1. Run `dev.bat` (recommended) OR `start-chrome-debug.bat` separately
2. Chrome must be running with `--remote-debugging-port=9222`
3. Navigate to your app in that Chrome instance (http://localhost:5173)

**Available tools:**
- `mcp__chrome-devtools__take_snapshot` - Get page accessibility tree
- `mcp__chrome-devtools__take_screenshot` - Capture the current page
- `mcp__chrome-devtools__list_console_messages` - Read console logs/errors
- `mcp__chrome-devtools__list_network_requests` - See all network requests
- `mcp__chrome-devtools__click`, `fill`, `hover` - Interact with elements

**Troubleshooting:**
- If Chrome DevTools MCP doesn't connect, ensure no other Chrome instance is running
- Kill stale Chrome processes: Close all Chrome windows, then run `start-chrome-debug.bat`
- The `dev.bat` script auto-kills stale processes on ports 9222, 8081, 5173

## Architecture Decisions

1. **Multi-tenant by design** - All data filtered by ownership via RLS
2. **Stateless API** - JWT-based auth, no server sessions
3. **Streaming first** - Real-time token streaming for LLM responses
4. **Resilience patterns** - Circuit breaker, timeouts, graceful degradation
5. **Mobile-first** - Base styles for mobile, enhanced on desktop

## Deployment

### Vercel (Frontend)
- Auto-deploys on push to `master`
- Build command: `cd frontend && npm run build`
- Output directory: `frontend/dist`

### Render (Backend)
- Deploy trigger URL configured in project
- Manual deploy: `curl -s -X POST "https://api.render.com/deploy/srv-cskimfrtq21c73fdr250?key=oNABP2tPJo0"`
- Or deploy via Render dashboard

### Deploy Commands
```bash
# Push to master (triggers Vercel auto-deploy)
git push origin master

# Trigger Render deploy
curl -s -X POST "https://api.render.com/deploy/srv-cskimfrtq21c73fdr250?key=oNABP2tPJo0"
```

## CSS Specificity Notes

When creating variant styles for components, match the specificity of base styles:

```css
/* Base has 3 class selectors */
.omni-bar-wrapper.council-mode .omni-bar { border: 1px solid var(--color); }

/* Variant must also have 3+ to override */
.omni-bar-wrapper.omni-bar-landing .omni-bar { border: none; }

/* Cover all state combinations */
.omni-bar-wrapper.omni-bar-landing .omni-bar,
.omni-bar-wrapper.omni-bar-landing.has-content .omni-bar,
.omni-bar-wrapper.omni-bar-landing.council-mode .omni-bar { ... }
```

### Available CSS Overlay Variables
Only use these defined overlay variables (from `tailwind.css`):
- `--overlay-white-10`, `--overlay-white-20`, `--overlay-white-40`
- `--overlay-black-10`, `--overlay-black-15`, `--overlay-black-20`, `--overlay-black-30`, `--overlay-black-40`, `--overlay-black-50`

Do NOT use non-existent variables like `--overlay-black-12` or `--overlay-black-18`.
