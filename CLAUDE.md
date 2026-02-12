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
- **Budget**: 1420KB source, 700KB built (CI fails if exceeded)

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

## Git Workflow & Version Control

### Branching Strategy
```
master (main branch - always deployable)
  ├── feature/chat-persistence (feature branch)
  ├── fix/mobile-scroll-bug (fix branch)
  └── refactor/api-structure (refactor branch)
```

**Branch Naming:**
- `feature/*` - New features (`feature/dark-mode`)
- `fix/*` - Bug fixes (`fix/llm-timeout`)
- `refactor/*` - Code quality improvements (`refactor/error-handling`)
- `docs/*` - Documentation only (`docs/api-guide`)

### Commit Message Convention
```
type(scope): description

Details here if needed (wrapped at 72 chars).
Multi-line explanation of WHY, not WHAT.

Fixes #123  (issue reference if applicable)
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `security`

**Examples:**
```
feat(auth): add OAuth integration
fix(modal): close button not responsive on mobile
refactor(api): simplify error handling in routers
docs(claude.md): update bash guidelines
```

### Pull Request Process
1. **Create branch** from `master` with descriptive name
2. **Make focused changes** (one feature/fix per PR)
3. **Run quality checks before pushing:**
   ```bash
   cd frontend && npm run lint && npm run type-check && npm run test:run
   python -m pytest backend/
   ```
4. **Push and open PR** with clear title + description
5. **PR Checks** (auto):
   - Lint errors → must fix
   - Type errors → must fix
   - Tests failing → must fix
   - Coverage < 70% → may fail
6. **Merge** once all checks pass
   - Squash trivial fixes, keep meaningful commits
   - Prefer `Squash and merge` for single-feature PRs
   - Use `Create a merge commit` for multi-commit histories

### Merge Protection Rules
- ✓ Must pass all CI checks (lint, tests, coverage)
- ✓ Must pass pre-push tests (434 tests)
- ✓ Must not exceed CSS budget (1420KB source)
- ✗ Cannot force-push to master
- ✗ Cannot merge with failing security scan

## Database Schema

| Table | Purpose |
|-------|---------|
| `companies` | Company profiles (tenant root) |
| `departments` | Department configs |
| `roles` | AI personas |
| `conversations` | Chat history (RLS filtered) |
| `knowledge_entries` | Saved decisions |

**RLS Policy (enforced on all tables):**
```sql
company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
```
Every query automatically filtered. No manual WHERE clauses needed for company isolation.

**RLS Deep Dive?** Load `.claude/skills/supabase-rls.md`

## Development Workflow

```bash
# 1. Start development
dev.bat

# 2. Make changes + iterate with hot reload
cd frontend && npm run dev

# 3. Before pushing: run full checks
cd frontend && npm run lint && npm run type-check && npm run test:run

# 4. Push (pre-push hook runs full test suite)
git push origin feature/my-feature
```

## CSS Performance Budget

| Metric | Budget | Current |
|--------|--------|---------|
| Source CSS | 1420KB | ~1404KB |
| Built CSS | 700KB | ~700KB |

Exceeding source budget fails CI. Split large components instead of growing single files.

## Common Mistakes to Avoid

| What | Why It's Wrong | How to Fix |
|------|---|---|
| Hardcoded colors in CSS | Breaks theming, accessibility | Use `var(--color-*)` from design-tokens.css |
| `!important` rules | Creates specificity hell | Increase selector specificity instead |
| `useCallback` without refs | Stale state in closures | Use `useRef` for values read in callbacks |
| String concat in SQL | SQL injection | Use parameterized queries always |
| Bypassing RLS | Data leak across tenants | Never skip RLS (requires explicit approval) |
| Exposed errors in API | Security/compliance issue | Use `create_secure_error()` |
| Large CSS files (>300 lines) | Unmaintainable | Split component into smaller pieces |

## Bash Guidelines

### Use Claude Code Tools Instead of Bash Piping
For filtering/searching, prefer specialized tools over piping:

```bash
# ✗ Avoid piping (harder to debug, uses extra processes)
git log | grep "feature"
find . -name "*.tsx" | head -10

# ✓ Use tools instead
git log --grep="feature" -n 10
Glob pattern: **/*.tsx (use the Glob tool in Claude Code)
Grep pattern: feature (use the Grep tool in Claude Code)
```

### When Piping is OK
```bash
# ✓ Fine: Command-specific flags already limit output
git log --oneline -n 20  # Use -n flag, not | head

# ✓ Fine: Chaining simple commands (git operations)
git add . && git commit -m "message" && git push
```

### Why This Matters
- **Clearer intent**: `git log -n 10` obviously shows "last 10 commits"
- **Debuggable**: Failures show exactly which command failed
- **Efficient**: No extra process overhead
- **Claude tools are better**: `Glob`, `Grep`, `Read` give better output than piping

## Essential Commands

```bash
dev.bat                    # Start all services (recommended)
cd frontend && npm run dev # Frontend only
python -m backend.main     # Backend only

git push origin master     # Deploy to Vercel (frontend) + Render (backend)
```

## Documentation Standards

### Code Comments
- **Write comments for the why, not the what:**
  ```tsx
  // ✗ Bad: Just restates code
  // Increment counter
  count++

  // ✓ Good: Explains intent
  // Skip stale entries from previous audit cycles
  entries = entries.filter(e => !e.isStale)
  ```
- **Document complex algorithms** (only 2-3 lines, usually)
- **No JSDoc for obvious functions** (the code should be clear)
- **Use JSDoc for public APIs:**
  ```tsx
  /**
   * Orchestrates 3-stage LLM decision council.
   * @param question - The decision to deliberate
   * @returns Promise<Decision> - Synthesized recommendation
   */
  export async function runCouncil(question: string): Promise<Decision>
  ```

### README Patterns
- **Public libraries**: Full setup, examples, API docs
- **Internal modules**: 2-3 sentence explanation + link to code
- **Example format**: "What it does" → "How to use it" → "Where the code is"

## Feature Flags

```python
from backend.feature_flags import is_enabled

if is_enabled("prompt_caching"):
    # Use cached prompts
    response = await cache_optimized_call()
```

**Active flags:**
- `prompt_caching` - Reuse cached LLM prompts
- `streaming_responses` - Stream model outputs
- `dark_mode` - UI theme support
- `gpt5_model` - GPT-5 model (when available)
- `claude_opus` - Claude Opus routing

## LLM Pipeline Configuration

### 3-Stage Orchestration
| Stage | Role | Models | Purpose |
|-------|------|--------|---------|
| **Stage 1** | Individual analysts | 5 premium | Full deliberation + context absorption |
| **Stage 2** | Peer reviewers | 3 efficient | Challenge assumptions, identify risks |
| **Stage 3** | Chairman | 1 best | Synthesize into final recommendation |

**Prompt caching**: Enabled by default. Reduces API costs + improves latency.
**Config location**: `backend/model_registry.py`

### Adding a New Model
1. Add model definition to `backend/model_registry.py`
2. Test in Stage 3 first (lowest risk)
3. Monitor latency + accuracy before promoting to Stage 1

## Browser Debugging

### Chrome DevTools MCP
```json
{
  "chrome-devtools": {
    "command": "npx",
    "args": ["chrome-devtools-mcp@latest"]
  }
}
```

**Usage:**
1. Run `dev.bat` (starts Chrome with debug port enabled)
2. Take screenshots: `take_screenshot` tool
3. Inspect elements: `take_snapshot` tool
4. Simulate mobile: `emulate` tool
5. Network inspection: `list_network_requests` tool

**Debugging mobile issues?** Load `.claude/skills/mobile-debugging.md`

## Deployment

Push to `master` triggers auto-deployment:
- **Vercel** (frontend): ~2 min
- **Render** (backend): ~3 min

**Rollback**: `git revert HEAD && git push origin master`

## Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend won't start | `rm -rf node_modules && npm install && npm run dev` |
| Backend not responding | `curl http://localhost:8081/health` |
| CSS file > 300 lines | Split component; run `wc -l frontend/src/**/*.css` to find culprit |
| Type errors | `npm run type-check` (fix errors, commit) |
| Test failures | `npm run test:run` (identify failure), `npm run test -- --testPathPattern="File"` (debug) |

## Specialized Tools

For detailed audits, use these:
- `/qa` - Pre-push quality check
- `/audit-security` - Banking-grade security review
- `/audit-mobile` - Mobile UX & responsiveness
- `/audit-performance` - Performance bottlenecks
- `security-guardian` agent - Vulnerability scanning
- `mobile-ux-tester` agent - Mobile UX via Chrome DevTools

Load `.claude/skills/` for deep dives on specific topics.

---

## Quick Links & Context

| Goal | Resource |
|------|----------|
| **$25M Exit Readiness** | See `todo/EXIT-READINESS-25M.md` |
| **Detailed CSS Patterns** | `.claude/skills/css-conventions.md` |
| **React Hook Debugging** | `.claude/skills/react-patterns.md` |
| **Database & RLS** | `.claude/skills/supabase-rls.md` |
| **Mobile Issues** | `.claude/skills/mobile-debugging.md` |
| **Radix UI Patterns** | `.claude/skills/radix-patterns.md` |
| **Exit Prep Checklist** | `.claude/skills/exit-readiness.md` |

**Questions?** Check relevant skill first, then ask for help in your dev session.

---

**Last updated:** 2026-01-28 | **Maintained by:** Development Team
