# CLAUDE.md - AxCouncil Development Guide

> **Quick reference for development standards.** Detailed patterns are in `.claude/skills/`. For $25M exit readiness, see `todo/EXIT-READINESS-25M.md`.

## ⚡ Quick Setup Check

Before starting work, verify:
- [ ] You're in the `AI-council` directory
- [ ] `.claude-workspace` file exists
- [ ] `.env` is configured (copy from `.env.example`)

If any are missing, ask: "Is this the correct repository folder?"

## Quick Start

### Prerequisites
- **Node.js** v18+ (frontend tooling)
- **Python** 3.10+ (backend + LLM pipeline)
- **Git** (version control)
- **Google Chrome** (debugging with Chrome DevTools MCP)

### Installation (One-time Setup)
```bash
# Install frontend dependencies
cd frontend && npm install && cd ..

# Install backend + dev tools
pip install -e ".[dev]"

# Optional: Git hooks for pre-commit checks
pre-commit install
```

### Starting Development (Pick One)
```bash
# ✓ Recommended: Start all services at once
dev.bat

# Or manually in separate terminals:
cd frontend && npm run dev     # Terminal 1: Frontend (http://localhost:5173)
python -m backend.main         # Terminal 2: Backend (http://localhost:8081)
```

### Environment Variables
Copy `.env.example` to `.env`:
| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | ✓ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✓ | Supabase public key |
| `VITE_API_URL` | ✓ | Backend URL (usually `http://localhost:8081`) |
| `OPENROUTER_API_KEY` | ✓ | LLM API access |

**Troubleshooting Setup?** Check `.claude/skills/` for detailed guides on specific issues.

## Project Overview

AxCouncil: AI-powered decision council orchestrating multiple LLMs (Claude, GPT, Gemini, Grok, DeepSeek) through a 3-stage pipeline: individual responses → peer review → synthesis.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, TypeScript 5.9, Tailwind v4, Radix UI |
| Backend | FastAPI, Python 3.10+ |
| Database | Supabase (PostgreSQL + RLS) |
| Caching | Redis Cloud |
| Vector DB | Qdrant Cloud |

## Directory Structure

```
AI-council/
├── frontend/src/
│   ├── components/    # UI components (ui/, chat/, mycompany/, stage1-3/)
│   ├── styles/        # Design tokens
│   ├── hooks/         # Custom hooks
│   └── contexts/      # React contexts
├── backend/
│   ├── routers/       # API endpoints
│   ├── council.py     # 3-stage orchestration
│   └── openrouter.py  # LLM API calls
└── supabase/          # Database config
```

## Skills (Detailed Patterns)

Detailed patterns are extracted to skills. Load when relevant:

| Skill | Use When |
|-------|----------|
| `.claude/skills/css-conventions.md` | Working on styling, CSS budget |
| `.claude/skills/mobile-debugging.md` | Mobile issues, scroll bugs, flex chain |
| `.claude/skills/radix-patterns.md` | Modals, dialogs, fixed-position elements |
| `.claude/skills/react-patterns.md` | Hook bugs, state management |
| `.claude/skills/supabase-rls.md` | Database, authorization, RLS |
| `.claude/skills/exit-readiness.md` | $25M exit prep, enterprise features |

## Agents (Specialized Workers)

Run specialized agents for complex tasks:

| Agent | Purpose |
|-------|---------|
| `security-guardian` | Security monitoring, vulnerability detection |
| `css-enforcer` | CSS budget and convention enforcement |
| `mobile-tester` | Mobile responsiveness testing |
| `mobile-ux-tester` | Automated mobile UX testing via Chrome DevTools |
| `council-ops` | LLM costs and pipeline health |
| `enterprise-readiness` | $25M exit checklist tracking |
| `web-researcher` | Search for latest security/tech updates |

## Code Style & Organization

### Naming Conventions
| Category | Pattern | Example |
|----------|---------|---------|
| **Components** | PascalCase | `ChatInterface.tsx`, `UserProfile.tsx` |
| **Functions/Hooks** | camelCase | `getChatHistory()`, `useUserContext()` |
| **CSS Variables** | kebab-case, prefixed | `--color-text-primary`, `--space-4` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT_MS` |
| **Files** | Match export | Component.tsx, Component.css (paired) |
| **Routes** | kebab-case | `/chat-sessions`, `/user-settings` |

### File Organization - Frontend
```
src/
├── components/
│   ├── ui/              # Basic UI (Button, Modal, etc.)
│   ├── chat/            # Chat-specific components
│   ├── mycompany/       # Company/org features
│   └── stage[1-3]/      # Council pipeline stages
├── hooks/               # Custom hooks (one hook per file)
├── contexts/            # React contexts (one context per file)
├── styles/              # Global: index.css, design-tokens.css
└── types/               # Shared TypeScript types
```

### File Organization - Backend
```
backend/
├── routers/             # API endpoints (one router = one resource)
├── services/            # Business logic
├── models/              # Data models + validation
├── core/                # Infrastructure (auth, db, errors)
├── council.py           # 3-stage LLM orchestration
└── openrouter.py        # LLM API integration
```

## Frontend Conventions

### CSS Rules (See `.claude/skills/css-conventions.md` for details)
- **One CSS file per component**: `Component.tsx` → `Component.css` (paired, same directory)
- **Max 300 lines** per CSS file (if larger, component is too complex → split it)
- **No hardcoded colors**: Use `var(--color-*)` tokens from design-tokens.css
- **3 breakpoints only**: `default` (mobile), `641px` (tablet), `1025px` (desktop)
- **Budget**: 1350KB source, 700KB built (CI fails if exceeded)

### Styling Priority (in order)
1. Tailwind utilities for **layout** (flex, grid, spacing via className)
2. CSS variables for **colors & spacing** (design-tokens.css)
3. Component CSS files for **complex styles** (animations, interactions)

### Design Tokens Pattern
```tsx
// In TSX
<div className="flex gap-4 p-6">
  <span style={{ color: 'var(--color-text-primary)' }}>Hello</span>
</div>

// In CSS
.my-component {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  padding: var(--space-4);
}
```

### React Component Pattern
```tsx
// Component.tsx
import { ComponentProps } from 'react';
import './Component.css';

interface Props {
  title: string;
  onAction?: () => void;
}

export function Component({ title, onAction }: Props) {
  return (
    <div className="flex items-center gap-4">
      <h1>{title}</h1>
      {onAction && <button onClick={onAction}>Action</button>}
    </div>
  );
}
```
**Hooks patterns?** Load `.claude/skills/react-patterns.md`

### TypeScript Requirements
- ✓ Strict mode enabled (`tsconfig.json: "strict": true`)
- ✓ No `any` types (use `unknown` + type guards if needed)
- ✓ Export types for all props interfaces
- ✓ Type external data at system boundaries (API responses, props)
- ✗ Don't over-type internal implementation details

## Backend Conventions

### API Router Pattern
```python
# routers/items.py
from fastapi import APIRouter, Depends
from backend.core.auth import get_current_user

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/")
async def list_items(user: dict = Depends(get_current_user)):
    """List all items for current user. RLS enforced automatically."""
    return await get_items_for_user(user["id"])

@router.post("/")
async def create_item(
    data: ItemCreate,
    user: dict = Depends(get_current_user)
):
    """Create item owned by current user. Company isolation via RLS."""
    return await save_item(data, user["id"])
```

**Rules:**
- Always filter by user ownership in queries
- All table access automatically filtered by RLS policy
- Never bypass RLS unless admin operation with explicit approval

### Request/Response Format
```python
# ✓ Good: Consistent API responses
{
  "success": true,
  "data": { ... },  # or null if empty
  "error": null     # or error object
}

# Error response (automatic via create_secure_error)
{
  "success": false,
  "data": null,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User-friendly error message"
  }
}
```

### Database Best Practices
- **Always use parameterized queries** (never string concatenation)
  ```python
  # ✓ Good
  query = "SELECT * FROM items WHERE id = %s AND user_id = %s"
  result = await db.fetch(query, item_id, user_id)

  # ✗ Never do this
  query = f"SELECT * FROM items WHERE id = {item_id}"
  ```
- **Use auth client for user queries** (automatically filters by RLS)
- **Use service client only for admin operations** (requires explicit reason)
- **All tables have RLS enforcing multi-tenant isolation**

### Error Handling Pattern
```python
# ✓ Good: Secure error without exposing internals
from backend.core.errors import create_secure_error

@router.get("/{id}")
async def get_item(id: str, user: dict = Depends(get_current_user)):
    item = await db.fetch_one("SELECT * FROM items WHERE id = %s", id)
    if not item:
        raise create_secure_error(
            404,
            "Item not found",
            log_details={"id": id, "user_id": user["id"]}
        )
    return item
```

### Logging Pattern
```python
import logging
logger = logging.getLogger(__name__)

# Log important actions
logger.info(f"User {user_id} created item {item_id}")
logger.warning(f"Invalid model selected: {model_name}")
logger.error(f"Database error: {error}", exc_info=True)
```

**Security rules?** Load `.claude/skills/supabase-rls.md`

## Database Schema

| Table | Purpose |
|-------|---------|
| `companies` | Company profiles |
| `departments` | Department configs |
| `roles` | AI personas |
| `conversations` | Chat history |
| `knowledge_entries` | Saved decisions |

**RLS Policy**: `company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())`

## CSS Performance Budgets

| Metric | Budget | Current |
|--------|--------|---------|
| Source CSS | 1350KB | ~1309KB |
| Built CSS | 700KB | ~700KB |

CI fails if source CSS exceeds 1350KB.

## Testing

```bash
cd frontend
npm run test        # Watch mode
npm run test:run    # Single run
npm run lint        # ESLint
npm run lint:css    # Stylelint
npm run type-check  # TypeScript
```

## Common Pitfalls (Quick Reference)

**Frontend:**
- Don't hardcode colors - use CSS variables
- Don't skip mobile testing
- Don't use `!important` - increase specificity instead

**Backend:**
- Don't expose internal errors - use `create_secure_error()`
- Don't bypass RLS unless admin operation requires it

**For detailed debugging patterns, load the relevant skill.**

## Key Commands

```bash
# Development
dev.bat                       # Start all services
cd frontend && npm run dev    # Frontend only
python -m backend.main        # Backend only

# Quality
cd frontend && npm run lint && npm run type-check

# Build
cd frontend && npm run build
```

## Automated Safeguards

| Hook | Trigger | Action |
|------|---------|--------|
| `pre-commit` | git commit | Lint-staged |
| `commit-msg` | git commit | Validate message |
| `pre-push` | git push | Run 434 tests |

| CI Workflow | Checks |
|-------------|--------|
| `ci.yml` | Lint, TypeScript, tests, 70% coverage |
| `security.yml` | CodeQL, Bandit, Gitleaks |

## MCP Servers

```json
{
  "supabase": { "type": "http", "url": "https://mcp.supabase.com/..." },
  "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest"] }
}
```

For browser debugging, run `dev.bat` and Chrome will have debug port enabled.

## Feature Flags

```python
from backend.feature_flags import is_enabled
if is_enabled("advanced_search"):
    # use feature
```

Key flags: `prompt_caching`, `streaming_responses`, `dark_mode`, `gpt5_model`, `claude_opus`

## LLM Model Configuration

| Stage | Models | Strategy |
|-------|--------|----------|
| Stage 1 | 5 premium | Full deliberation |
| Stage 2 | 3 cheap | Peer review |
| Stage 3 | 1 chairman | Synthesis |

Prompt caching enabled by default. Config in `backend/model_registry.py`.

## Deployment

- **Frontend**: Vercel, auto-deploys on push to master
- **Backend**: Render, auto-deploys via GitHub Actions

```bash
git push origin master  # Triggers both
```

## Claude Code Hooks

Hooks auto-run during sessions:
- **SessionStart**: Shows CSS budget reminder
- **PostToolUse (Write/Edit)**: Warns if CSS file exceeds 300 lines
- **PreToolUse (Bash)**: Blocks dangerous git commands

## Audit Commands

45+ audit commands available. Key ones:
- `/qa` - Pre-push quality check
- `/audit-security` - Banking-grade security audit
- `/audit-css-architecture` - CSS audit
- `/audit-mobile` - Mobile experience audit
- `/daily-health` - Daily health check
- `/security-watch` - Security monitoring

---

**Target**: $25M exit. See `todo/EXIT-READINESS-25M.md` for checklist.

**For detailed patterns**: Load relevant skill from `.claude/skills/`
