# CLAUDE.md - AxCouncil Development Guide

> Concise context for Claude Code. Detailed patterns are in `.claude/skills/`.

## CRITICAL: Working Directory Verification

Before starting ANY work, verify `.claude-workspace` file exists. If not, ask: "Is this the correct/primary repo folder?"

## Quick Start

### Prerequisites
- Node.js v18+, Python 3.10+, Git, Google Chrome

### Installation
```bash
cd AI-council
cd frontend && npm install && cd ..
pip install -e ".[dev]"
pre-commit install  # optional
```

### Starting Development
```bash
dev.bat  # Windows: Starts Chrome+Backend+Frontend

# Or manually:
cd frontend && npm run dev     # Terminal 1
python -m backend.main         # Terminal 2
```

### Environment Variables
Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL` - Usually `http://localhost:8081`
- `OPENROUTER_API_KEY`

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

## Agents (Specialized Workers)

Run specialized agents for complex tasks:

| Agent | Purpose |
|-------|---------|
| `security-guardian` | Security monitoring, vulnerability detection |
| `css-enforcer` | CSS budget and convention enforcement |
| `mobile-tester` | Mobile responsiveness testing |
| `council-ops` | LLM costs and pipeline health |
| `enterprise-readiness` | $25M exit checklist tracking |
| `web-researcher` | Search for latest security/tech updates |

## Frontend Conventions (Summary)

### CSS Rules (See skill for details)
- **One CSS file per component**: `Component.tsx` → `Component.css`
- **Max 300 lines** per CSS file
- **No hardcoded colors**: Use `var(--color-*)` tokens
- **3 breakpoints only**: default (mobile), 641px (tablet), 1025px (desktop)
- **Budget**: 1300KB source, 700KB built

### Styling Priority
1. Tailwind utilities for layout
2. CSS variables for colors/spacing
3. Component CSS files for complex styles

### Design Tokens
```css
color: var(--color-text-primary);
background: var(--color-bg-primary);
padding: var(--space-4);
```

## Backend Conventions (Summary)

### Router Pattern
```python
@router.get("/")
async def list_items(user: dict = Depends(get_current_user)):
    return await get_items_for_user(user["id"])  # Always filter by ownership
```

### Database
- Use parameterized queries (never string concatenation)
- Service client for admin ops, auth client for user queries
- All tables have RLS enforcing multi-tenant isolation

### Error Handling
```python
raise create_secure_error(404, "Resource not found", log_details={"id": item_id})
```

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
| Source CSS | 1300KB | ~1255KB |
| Built CSS | 700KB | ~700KB |

CI fails if source CSS exceeds 1300KB.

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
