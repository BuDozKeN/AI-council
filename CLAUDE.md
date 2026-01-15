# CLAUDE.md - AxCouncil Development Guide

> This file provides context for Claude Code to maintain consistency across development sessions.

## CRITICAL: Working Directory Verification

Before starting ANY work, Claude Code MUST verify:
1. The `.claude-workspace` file exists in the current working directory
2. If it does NOT exist, STOP and ask the user: "Is this the correct/primary repo folder?"
3. If the user has multiple clones, help them consolidate into ONE folder

**Why this matters:** Multiple copies of this repo have caused work to be split across folders, requiring manual merging. Only ONE folder should be the primary workspace.

**The `.claude-workspace` file:**
- Should exist ONLY in the primary/canonical clone
- Is NOT path-specific (works on any computer/terminal)
- If you find multiple folders with this file, consolidate work and delete duplicates

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

## New Computer/Terminal Setup (Full Sync)

When setting up on a new computer or terminal to reach the current development state:

### Step 1: Install Prerequisites

**Required software:**
- Node.js v18+ - https://nodejs.org/
- Python 3.10+ - https://www.python.org/
- Git - https://git-scm.com/
- Google Chrome - https://www.google.com/chrome/

### Step 2: Install GitHub CLI (Required for CI Automation)

**Windows (winget):**
```bash
winget install --id GitHub.cli
```

**macOS:**
```bash
brew install gh
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh
```

### Step 3: Authenticate GitHub CLI

```bash
gh auth login --web --git-protocol https
```
This opens a browser - authorize with your GitHub account.

**Verify authentication:**
```bash
gh auth status
```

### Step 4: Clone and Install Project

```bash
# Clone repository
git clone https://github.com/BuDozKeN/AI-council.git
cd AI-council

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
pip install -e ".[dev]"

# Install pre-commit hooks (optional but recommended)
pre-commit install
```

### Step 5: Set Up Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env and fill in:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
# - OPENROUTER_API_KEY
```

### Step 6: Configure MCP Servers for Claude Code

The `.mcp.json` file is already in the repo. After cloning, **restart VS Code** (or your IDE) to activate the MCP servers:
- **GitHub MCP** - Enables Claude to check CI status, read workflow logs
- **Supabase MCP** - Database schema introspection
- **Chrome DevTools MCP** - Browser debugging (requires Chrome with debug port)

### Step 7: Verify Setup

```bash
# Check GitHub CLI works
gh run list --repo BuDozKeN/AI-council --limit 3

# Run tests locally
cd frontend && npm run test:run

# Start development environment (Windows)
cd .. && dev.bat

# OR manually:
# Terminal 1: cd frontend && npm run dev
# Terminal 2: python -m backend.main
```

### CI Automation Workflow

Once set up, Claude Code can automatically:
1. **Check CI status:** `gh run list --repo BuDozKeN/AI-council`
2. **Get failure logs:** `gh run view <run-id> --log-failed`
3. **Fix issues and push**
4. **Watch CI pass:** `gh run watch <run-id> --exit-status`

**No more manual copy/paste of CI errors!**

---

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
| Caching | Redis Cloud (LLM response caching, rate limiting) |
| Vector DB | Qdrant Cloud (semantic search, RAG) |
| Monitoring | Sentry |

## Cloud Infrastructure

### Redis Cloud (Caching)
- **Provider**: Redis Cloud (redis.io)
- **Region**: europe-west1 (GCP)
- **Tier**: Free (30MB)
- **Purpose**: LLM response caching, rate limiting, session caching
- **Dashboard**: https://app.redislabs.com

**Configuration** (in `.env`):
```
REDIS_URL=redis://default:<password>@redis-16432.c327.europe-west1-2.gce.cloud.redislabs.com:16432
REDIS_ENABLED=true
REDIS_DEFAULT_TTL=3600      # 1 hour default
REDIS_LLM_CACHE_TTL=1800    # 30 minutes for LLM responses
```

### Qdrant Cloud (Vector Database)
- **Provider**: Qdrant Cloud (cloud.qdrant.io)
- **Region**: europe-west3 (GCP)
- **Tier**: Free (1GB)
- **Purpose**: Semantic search, RAG retrieval, knowledge embeddings
- **Dashboard**: https://cloud.qdrant.io

**Configuration** (in `.env`):
```
QDRANT_URL=https://<cluster-id>.europe-west3-0.gcp.cloud.qdrant.io
QDRANT_API_KEY=<jwt-token>
QDRANT_ENABLED=true
```

**Collections**:
| Collection | Purpose |
|------------|---------|
| `conversations` | Semantic search of past council discussions |
| `knowledge_entries` | RAG retrieval of saved decisions |
| `org_documents` | Document embeddings (playbooks, SOPs) |

### Graceful Degradation
Both services are optional - the app works without them:
- **Redis disabled**: No caching, slightly higher API costs
- **Qdrant disabled**: No semantic search, standard keyword matching only

Set `REDIS_ENABLED=false` or `QDRANT_ENABLED=false` to disable.

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
│   ├── cache.py           # Redis caching module
│   ├── vector_store.py    # Qdrant vector DB module
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

### CSS File Organization

**CRITICAL RULE**: Every component gets exactly ONE CSS file. No exceptions.

#### File Naming and Location

```
Component.tsx → Component.css (ALWAYS paired, same directory)
```

**Examples:**
- `ChatInterface.tsx` → `ChatInterface.css`
- `SaveKnowledgeModal.tsx` → `SaveKnowledgeModal.css`
- `DepartmentCard.tsx` → `DepartmentCard.css`

#### File Size Limits

- **Maximum 300 lines per CSS file**
- If CSS exceeds 300 lines → component is too complex → split into smaller components
- No mega-files allowed (ChatInterface.css was 3,230 lines - split into 10+ components)

#### Where Styles Belong

| Style Type | Location | Example |
|------------|----------|---------|
| **Component-specific** | Component.css | `.chat-interface { }` in ChatInterface.css |
| **Layout** | Tailwind classes in JSX | `className="flex items-center gap-4"` |
| **Colors** | design-tokens.css ONLY | `--color-text-primary`, `--color-bg-card` |
| **Spacing tokens** | design-tokens.css | `--space-4`, `--space-6` |
| **Mobile @media** | Component.css (NOT separate mobile.css) | Mobile styles next to desktop styles |
| **Global reset** | index.css (<200 lines) | CSS reset, base element styles |

#### Decision Tree: "Where Do I Put This Style?"

```
Is it a color value (hex/rgb)?
  ├─ YES → design-tokens.css as CSS variable
  └─ NO ↓

Is it layout (flex/grid/spacing)?
  ├─ YES → Tailwind utilities in className
  └─ NO ↓

Is it specific to ONE component?
  ├─ YES → ComponentName.css
  └─ NO ↓

Is it truly global (button reset, body font)?
  ├─ YES → index.css (max 200 lines)
  └─ NO → You probably need ComponentName.css
```

#### NEVER Do This ❌

```
❌ Create "shared.css" / "common.css" / "utils.css" (junk drawer antipattern)
❌ Put component styles in index.css
❌ Create separate mobile.css (mobile @media goes in component CSS)
❌ Put styles for ComponentA in ComponentB.css
❌ Split one component's styles across multiple CSS files
❌ Use hardcoded colors (#fff, rgba(255,0,0)) - use CSS variables
❌ Use !important (increase specificity instead)
❌ Exceed 300 lines in a CSS file
```

#### ALWAYS Do This ✅

```
✅ Component.tsx → Component.css (1:1 relationship)
✅ Mobile @media queries inside component CSS file
✅ Max 300 lines per CSS file
✅ Use CSS variables for colors: var(--color-text-primary)
✅ Use Tailwind for layout: className="flex gap-4"
✅ Split large components into smaller ones if CSS exceeds 300 lines
✅ Delete unused selectors immediately
```

#### Tailwind vs CSS Decision

**Use Tailwind for:**
- Layout (flex, grid, gap)
- Spacing (p-4, m-2, gap-6)
- Responsive utilities (md:flex, lg:grid-cols-3)
- Simple positioning (relative, absolute, fixed)

**Use CSS files for:**
- Complex animations (@keyframes)
- Pseudo-elements (::before, ::after)
- Complex selectors (.parent:has(.child))
- State-based styling ([data-state="open"])
- Component-specific theming
- Hover/focus states with multiple properties

**NEVER do:**
- Same property in BOTH Tailwind AND CSS (creates conflicts)
- Tailwind arbitrary values for colors: `bg-[#fff]` (use CSS variables)

#### Breakpoint Standards

**ONLY use these 3 breakpoints:**

```css
/* Mobile-first: default styles are mobile */

@media (min-width: 641px) {
  /* Tablet */
}

@media (min-width: 1025px) {
  /* Desktop */
}
```

**Do NOT use:**
- 768px, 480px, 400px, 360px, 600px, 800px (creates conflicts)
- Max-width queries (use min-width, mobile-first)

#### Example: Correct CSS Structure

```css
/* ChatBubble.css - MAX 300 LINES */

/* Base styles (mobile-first) */
.chat-bubble {
  padding: var(--space-3);
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
}

/* Tablet */
@media (min-width: 641px) {
  .chat-bubble {
    padding: var(--space-4);
  }
}

/* Desktop */
@media (min-width: 1025px) {
  .chat-bubble {
    padding: var(--space-6);
  }
}

/* State variations */
.chat-bubble[data-role="assistant"] {
  background: var(--color-bg-secondary);
}

/* Pseudo-elements */
.chat-bubble::before {
  content: '';
  /* ... */
}
```

#### Enforcement

All CSS rules are enforced by:
- **Stylelint** - Runs on commit and in CI
- **CI Pipeline** - Fails PR if CSS violations detected
- **Pre-commit hooks** - Auto-fixes minor issues
- **PR reviews** - Human check for file organization

Run `npm run lint:css` before committing.

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

### Mobile CSS Override Trap (CRITICAL)

**Problem:** Component styles work on desktop but break on mobile, even though you have explicit size rules.

**Root Cause:** Your component's own CSS file likely has mobile media queries that override your desktop rules. When debugging, don't just look at OTHER files overriding yours - check YOUR OWN mobile media queries first!

**Real example from LLM Hub:**
```css
/* Desktop: 180px dropdowns ✓ */
[data-llm-select] .select-trigger {
  width: 180px;
  min-width: 180px;
  max-width: 180px;
}

/* Mobile: YOUR OWN FILE overrides it to 100%! */
@media (max-width: 768px) {
  .llm-model-select.select-trigger {
    width: 100%;      /* ← You did this to yourself */
    min-width: 0;
    max-width: 100%;
  }
}
```

**Debugging checklist when mobile styles don't match desktop:**
1. **Check your own file's media queries FIRST** - search for `@media` in the component's CSS
2. Check parent component CSS files
3. Check global CSS files (select.css, index.css)
4. Use DevTools to see which rule is actually winning

**Prevention:**
- When setting a fixed size that should persist across breakpoints, add a comment: `/* Intentionally fixed - do not override in mobile */`
- When adding mobile overrides, ask: "Should this size really change on mobile, or should it stay consistent?"

### Mobile Touch Targets (CRITICAL)

**Global rule in `index.css` enforces 44px min-height on ALL buttons for mobile (under 640px):**
```css
button:not(.inline-btn):not(.no-touch-target) { min-height: 44px; }
```

**If a button needs to be smaller (e.g., compact tabs, pills, inline actions):**
1. Add `no-touch-target` class to the button element in JSX
2. That's it - no CSS overrides needed

**Example:**
```jsx
// WRONG: Button will be forced to 44px on mobile
<button className="tab">Click</button>

// CORRECT: Button respects your CSS sizing
<button className="tab no-touch-target">Click</button>
```

**DO NOT** try to override with CSS specificity hacks like `min-height: unset` - just use `no-touch-target`.

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

### Nested Scroll Containers Bug (CRITICAL)

**Symptom:** Mouse wheel scrolling doesn't work even though:
- CSS has `overflow-y: auto` ✓
- Content is taller than container (`scrollHeight > clientHeight`) ✓
- Wheel events reach the element ✓
- Programmatic scroll (`element.scrollTop = 100`) works ✓

**Root Cause:** A PARENT element also has `overflow-y: auto` (or `overflow: auto`). When both parent and child have `overflow: auto`, the browser may not scroll the correct one, even if the parent's content fits.

**The Fix:** Set `overflow: hidden` on ALL parent containers - only the innermost scroll target should have `overflow: auto`.

**Real example - Settings modal:**
```css
/* AppModal body has overflow: auto by default */
.app-modal-body { overflow-y: auto; }  /* From AppModal.css */

/* Settings panel also wants to scroll */
.settings-panel { overflow-y: auto; }  /* CONFLICT! */

/* FIX: Override parent to hidden */
.settings-modal-body { overflow: hidden; }  /* Now only .settings-panel scrolls */
```

**Debugging checklist:**
1. Find the element with `overflow-y: auto` that should scroll
2. Check ALL ancestors for `overflow: auto` or `overflow-y: auto`
3. Set `overflow: hidden` on every ancestor up to the modal/sheet container
4. Test with `element.scrollTop = 100` in console - if this works but wheel doesn't, it's a nested scroll issue

**Files with this pattern:**
- `Settings.css` - `.settings-modal-body { overflow: hidden }` for desktop
- `Settings.css` - `.bottom-sheet-body:has(.settings-content) { overflow: hidden }` for mobile

### Framer Motion Drag Intercepting Wheel Scroll (CRITICAL)

**Symptom:** In a BottomSheet (mobile modal), mouse wheel scrolling doesn't work even after fixing nested scroll containers. Content scrolls briefly then stops, or doesn't scroll at all.

**Root Cause:** Framer Motion's `drag="y"` on the BottomSheet container sets `touch-action: pan-x` which can interfere with vertical wheel events. The drag gesture detection intercepts wheel events before they reach the scroll container.

**The Fix:** Add an `onWheel` handler to the BottomSheet body that manually scrolls the content:

```tsx
// In BottomSheet.tsx - SheetContent component
const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
  const body = bodyRef.current;
  if (!body) return;

  // Find the scrollable element inside
  const scrollable = body.querySelector<HTMLElement>('.settings-panel') ||
                     body.querySelector<HTMLElement>('[data-scrollable]') ||
                     body;

  const canScroll = scrollable.scrollHeight > scrollable.clientHeight;
  if (!canScroll) return;

  // Check boundaries - let default behavior at edges
  const atTop = scrollable.scrollTop <= 0;
  const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
  if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;

  // Manually scroll
  e.preventDefault();
  e.stopPropagation();
  scrollable.scrollTop += e.deltaY;
}, []);

// Apply to body div
<div ref={bodyRef} className="bottom-sheet-body" onWheel={handleWheel}>
```

**CSS companion fix** (in `BottomSheet.css`):
```css
.bottom-sheet-content {
  touch-action: pan-y !important; /* Override Framer Motion's pan-x */
}
```

**Why this happens:**
1. Framer Motion `drag="y"` enables vertical drag-to-dismiss
2. It sets inline `touch-action: pan-x` to prevent browser vertical scroll during drag
3. This inadvertently blocks wheel events from reaching nested scroll containers
4. The CSS override helps touch devices, but desktop wheel events need the JS handler

**Files implementing this fix:**
- `BottomSheet.tsx` - `handleWheel` function and `bodyRef`
- `BottomSheet.css` - `touch-action: pan-y !important`

### Framer Motion Drag Blocking Touch Events on Mobile (CRITICAL)

**Symptom:** Interactive elements (buttons, checkboxes) inside a BottomSheet work on desktop but don't respond to taps on mobile. You can see the elements, they look correct, but tapping does nothing.

**Root Cause:** Framer Motion's `drag="y"` gesture detection intercepts touch events before they reach child elements. Combined with nested Radix Dialogs (e.g., a BottomSheet inside an AppModal), touch events get blocked or misrouted.

**The Fix - CSS on interactive elements:**
```css
/* Add to any interactive element inside a Framer Motion drag container */
.my-button-inside-bottomsheet {
  touch-action: manipulation;  /* Critical - ensures touch events work */
  -webkit-tap-highlight-color: transparent;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}
```

**The Fix - Parent container:**
```css
/* Add to the container holding interactive elements */
.my-list-container {
  pointer-events: auto;
  touch-action: pan-y;
}
```

**The Fix - Nested Radix Dialogs:**
When a BottomSheet opens inside an AppModal, prevent the parent from closing:
```typescript
// In AppModal.tsx - shouldIgnoreClose function
const hasOpenBottomSheet = document.querySelector('.bottom-sheet-content, .bottom-sheet-overlay');
if (hasOpenBottomSheet) return true;
```

**NEVER do this on parent containers:**
```tsx
// BAD - This can interfere with child touch events
<div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
  <Button>I might not receive taps!</Button>
</div>

// GOOD - Let events flow, handle at the button level
<div>
  <Button onClick={(e) => { e.stopPropagation(); doThing(); }}>I work!</Button>
</div>
```

**Mobile Testing Checklist:**
1. ALWAYS test interactive elements on actual mobile device or Chrome DevTools mobile emulation
2. If desktop works but mobile doesn't, suspect Framer Motion drag interference
3. Check for `touch-action` CSS on parent containers that might block events
4. Check for `stopPropagation` on parent containers

**Files implementing this pattern:**
- `DepartmentCheckboxItem.css` - Mobile button touch fixes
- `MultiDepartmentSelect.css` - Container touch fixes
- `AppModal.tsx` - Nested BottomSheet detection

### Flexbox Scroll Chain (CRITICAL)

**Problem:** `overflow-y: auto` on a nested flex item doesn't work - content overflows instead of scrolling.

**Root Cause:** By default, flex items have `min-height: auto` which prevents them from shrinking below their content size. If ANY ancestor in the flex chain is missing `min-height: 0`, the scroll container's height becomes unbounded and `overflow-y: auto` has nothing to overflow from.

**The Rule:** For `overflow-y: auto` to work on a deeply nested flex item, EVERY flex ancestor must have `min-height: 0`.

```css
/* WRONG: Scroll doesn't work */
.modal-content { display: flex; flex-direction: column; max-height: 85vh; }
.modal-body { flex: 1; }  /* Missing min-height: 0 */
  .inner-container { display: flex; height: 480px; }  /* Fixed height breaks chain */
    .scroll-panel { flex: 1; overflow-y: auto; }  /* Won't scroll! */

/* CORRECT: Complete min-height: 0 chain */
.modal-content { display: flex; flex-direction: column; max-height: 85vh; }
.modal-body { flex: 1; min-height: 0; }  /* ✓ Can shrink */
  .inner-container { display: flex; flex: 1; min-height: 0; max-height: 480px; }  /* ✓ Use max not fixed */
    .scroll-panel { flex: 1; min-height: 0; overflow-y: auto; }  /* ✓ Now scrolls! */
```

**Debugging Checklist:**
1. Find the element with `overflow-y: auto`
2. Walk UP the DOM tree to the root flex container
3. Every flex item in the chain needs `min-height: 0`
4. Replace `height: Xpx` with `max-height: Xpx` on flex items (fixed heights break flex sizing)
5. The outermost container needs a height constraint (e.g., `max-height: 85vh`)

**Note:** This is a DIFFERENT issue from "Nested Scroll Containers Bug" above. Both can cause scroll to fail:
- Nested scroll containers → fix with `overflow: hidden` on parents
- Missing `min-height: 0` → content overflows instead of scrolling

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

### Fixed-Position Elements + Radix Dialogs (CRITICAL)

**Problem:** When you have a fixed-position element (like ThemeToggle or HelpButton) rendered at the App root level, clicking it while a Radix Dialog/Modal is open will close the modal. This happens because Radix detects clicks outside the dialog's DOM tree as "outside clicks" and triggers `onOpenChange(false)`.

**Failed approaches (DO NOT try these):**
- ❌ `e.stopPropagation()` on the button - Radix uses capture phase
- ❌ Native event listeners with capture phase - Still detected as outside
- ❌ Rendering into Radix portal (`[data-radix-portal]`) - Creates timing issues
- ❌ Using React Portal to body - Same problem
- ❌ Checking `.theme-toggle-container` in Radix handlers - Event target may differ

**Working solution: Timestamp-based detection**

1. **In the fixed-position component** (e.g., ThemeToggle, HelpButton):
```tsx
const handlePointerDown = useCallback((e: React.PointerEvent) => {
  e.stopPropagation();
  // Set timestamp BEFORE Radix's outside-click detection fires
  (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime = Date.now();
}, []);
```

2. **In App.tsx modal `onClose` handlers**:
```tsx
<Settings
  isOpen={isSettingsOpen}
  onClose={() => {
    // Check if the fixed element was clicked within last 500ms
    const clickTime = (window as Window & { __themeToggleClickTime?: number }).__themeToggleClickTime;
    if (clickTime && Date.now() - clickTime < 500) {
      return; // Don't close - it was just a theme toggle click
    }
    closeSettings();
  }}
/>
```

3. **Also add checks in AppModal.tsx and BottomSheet.tsx** `onOpenChange`, `onPointerDownOutside`, and `onInteractOutside` handlers as backup.

**Key files implementing this pattern:**
- `ThemeToggle.tsx` - Sets `window.__themeToggleClickTime`
- `HelpButton.tsx` - Sets `window.__helpButtonClickTime` (language selector button)
- `App.tsx` - All modal `onClose` handlers check both timestamps
- `AppModal.tsx` - `onOpenChange` checks both timestamps
- `BottomSheet.tsx` - Overlay click and Radix handlers check both timestamps

**When adding new fixed-position UI elements:**
1. Set a unique timestamp on `window` in `onPointerDown`/`onMouseDown`
2. Add the timestamp check to ALL modal `onClose` handlers in App.tsx
3. Add backup checks in AppModal.tsx and BottomSheet.tsx

**CRITICAL: Child elements need timestamps too!**
If your fixed-position component has interactive children (buttons, panels, inputs), EVERY interactive child must also set the timestamp. Example from HelpButton:
```tsx
// The panel container needs timestamp handling
<div className="help-panel"
  onPointerDown={(e) => {
    e.stopPropagation();
    (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
  }}
>
  {/* Each button inside also needs it */}
  <button
    onClick={() => handleChange()}
    onPointerDown={(e) => {
      e.stopPropagation();
      (window as Window & { __helpButtonClickTime?: number }).__helpButtonClickTime = Date.now();
    }}
  >
    Option
  </button>
</div>
```
Without this, clicking child elements will close parent modals because the click still registers as "outside" the modal.

### Radix Select Dropdowns Inside Modals (CRITICAL)

**Problem:** When a Radix Select dropdown is inside a modal (AppModal or BottomSheet), clicking outside the dropdown to dismiss it ALSO closes the parent modal. This happens because:
1. User clicks outside dropdown → dropdown closes
2. The same click event bubbles up → modal sees it as "click outside" → modal closes
3. By the time modal's handler runs, the dropdown DOM is already gone, so checking for `[data-radix-select-content]` fails

**Solution: Timestamp-based detection (already implemented)**

1. **In `select.tsx` SelectContent component** - sets timestamp when dropdown is dismissed:
```tsx
onPointerDownOutside={(e) => {
  (window as Window & { __radixSelectJustDismissed?: number }).__radixSelectJustDismissed = Date.now();
  onPointerDownOutside?.(e);
}}
```

2. **In modal components (BottomSheet.tsx, AppModal.tsx)** - check the timestamp:
```tsx
// In onClick, onInteractOutside, and onPointerDownOutside handlers:
const selectDismissTime = (window as Window & { __radixSelectJustDismissed?: number }).__radixSelectJustDismissed;
if (selectDismissTime && Date.now() - selectDismissTime < 300) {
  e.preventDefault();
  return; // Don't close - dropdown was just dismissed
}
```

**Key files implementing this pattern:**
- `select.tsx` - Sets `window.__radixSelectJustDismissed` in SelectContent
- `BottomSheet.tsx` - Checks timestamp in overlay onClick, onInteractOutside, onPointerDownOutside
- `AppModal.tsx` - Should also check this timestamp

**When adding Select components inside modals:**
- The fix is already in place globally via select.tsx and modal components
- If you create a new modal component, remember to add the timestamp check

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

## Automated Safeguards (Vibe Coder Protection)

This project has comprehensive automation to catch mistakes before they reach production.

### Local Hooks (Git)

| Hook | Trigger | What It Does |
|------|---------|--------------|
| `pre-commit` | `git commit` | Lint-staged (format/lint changed files) |
| `commit-msg` | `git commit` | Validates commit message (min 10 chars, blocks vague messages) |
| `pre-push` | `git push` | Runs full test suite (289 backend + 145 frontend tests) |

### CI Pipeline (GitHub Actions)

| Workflow | Runs On | Checks |
|----------|---------|--------|
| `ci.yml` | Every PR/push | ESLint, TypeScript, 434 tests, 70% coverage, E2E |
| `security.yml` | Every PR/push + weekly | CodeQL, Bandit, Gitleaks, dependency audit |

### Coverage Thresholds

- **Backend**: 70% minimum (enforced in CI)
- **Frontend**: Coverage reported, trending up

### Branch Protection (GitHub Settings)

**Recommended settings for `master` branch:**
1. Go to: GitHub → Settings → Branches → Add rule
2. Branch name pattern: `master`
3. Enable:
   - [x] Require a pull request before merging
   - [x] Require status checks to pass before merging
     - Select: `Backend Tests`, `Frontend Lint, Test & Build`, `E2E Tests`
   - [x] Require conversation resolution before merging
   - [x] Do not allow bypassing the above settings

### Dependency Updates

- **Dependabot** runs weekly (Monday) for npm, pip, and GitHub Actions
- Security-critical packages prioritized
- Auto-creates PRs with `chore(deps)` prefix

### Files to Know About

| File | Purpose |
|------|---------|
| `.husky/pre-commit` | Lint-staged on commit |
| `.husky/commit-msg` | Commit message validation |
| `.husky/pre-push` | Full test suite before push |
| `.github/workflows/ci.yml` | Main CI pipeline |
| `.github/workflows/security.yml` | Security scanning |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist template |
| `.github/CODEOWNERS` | Required reviewers for critical files |
| `.github/dependabot.yml` | Automated dependency updates |

### Protection Summary

```
You write code
      ↓
[pre-commit] → Format & lint
      ↓
[commit-msg] → Validate message
      ↓
git push
      ↓
[pre-push] → 434 tests locally
      ↓
GitHub PR created
      ↓
[CI] → Lint, TypeScript, tests, 70% coverage, E2E
[Security] → CodeQL, Bandit, secrets, deps
      ↓
✅ All green → Merge allowed
❌ Any red → Merge blocked
```

**Result**: You can "vibe code" and the automation catches mistakes.

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

**IMPORTANT - Authentication Handling:**
- The Chrome debug profile at `%USERPROFILE%\.axcouncil-chrome-debug` persists login sessions
- Usually the user is already logged in - check the page first
- **If you see a login screen, AUTO-LOGIN using credentials from `.env`:**
  1. Read `.env` file to get `DEV_LOGIN_EMAIL` and `DEV_LOGIN_PASSWORD`
  2. Use Chrome DevTools MCP to fill the email field and click Continue
  3. Fill the password field and click Sign In
  4. NEVER ask the user for credentials - they are stored in `.env`
- The `.env` file is gitignored so credentials are safe

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
- If login session appears lost, close ALL Chrome windows and restart via `dev.bat` - the persistent profile should restore the session

## Architecture Decisions

1. **Multi-tenant by design** - All data filtered by ownership via RLS
2. **Stateless API** - JWT-based auth, no server sessions
3. **Streaming first** - Real-time token streaming for LLM responses
4. **Resilience patterns** - Circuit breaker, timeouts, graceful degradation
5. **Mobile-first** - Base styles for mobile, enhanced on desktop

## Feature Flags

Runtime toggles for gradual rollouts, A/B testing, and kill switches.

### Backend Usage

```python
from backend.feature_flags import is_enabled, get_flags

# Check a single flag
if is_enabled("advanced_search"):
    # use advanced search logic

# Get all flags
flags = get_flags()  # {"prompt_caching": True, "advanced_search": False, ...}
```

### Frontend Usage

```tsx
import { useFeatureFlags } from './hooks';

function MyComponent() {
  const { flags, isEnabled } = useFeatureFlags();

  // Check a specific flag
  if (isEnabled('command_palette')) {
    return <CommandPalette />;
  }

  // Or use flags directly
  return flags.dark_mode ? <DarkUI /> : <LightUI />;
}
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/feature-flags` | Get all flags `{flags: {name: bool}}` |
| `GET /api/feature-flags/definitions` | Get flags with metadata (for admin UI) |

### Adding New Flags

1. Add to `FEATURE_FLAG_DEFINITIONS` in `backend/feature_flags.py`:
   ```python
   "my_new_feature": (
       "FLAG_MY_NEW_FEATURE",  # env var name
       False,                   # default value
       "Description of feature" # for admin UI
   ),
   ```

2. Set in `.env` or environment:
   ```
   FLAG_MY_NEW_FEATURE=true
   ```

3. Use in code (backend or frontend)

### Current Flags

| Flag | Default | Description |
|------|---------|-------------|
| `prompt_caching` | true | LLM prompt caching for cost savings |
| `stage2_ranking` | true | Stage 2 peer ranking |
| `streaming_responses` | true | Streaming token responses |
| `command_palette` | true | Cmd+K command palette |
| `dark_mode` | true | Dark mode toggle |
| `advanced_search` | false | Semantic search in knowledge base |
| `multi_company` | false | Multi-company switching |
| `export_pdf` | false | PDF export of conversations |
| `gpt5_model` | true | GPT-5 model in council |
| `claude_opus` | true | Claude Opus model in council |

## LLM Model Configuration

### Model Registry

Models are configured in two places with database taking priority:

| Source | File | Purpose |
|--------|------|---------|
| Database | `model_registry` table | Production config, runtime updates |
| Fallbacks | `backend/model_registry.py` | Used if DB unavailable |

**Key roles:**
- `council_member` - Stage 1 deliberation (5 premium models)
- `stage2_reviewer` - Stage 2 peer review (3 cheap models)
- `chairman` - Stage 3 synthesis
- `triage`, `title_generator`, `ai_polish`, etc. - Utility tasks

### Changing Models

1. **Database (preferred):** Update `model_registry` table in Supabase
2. **Code fallbacks:** Edit `FALLBACK_MODELS` in `backend/model_registry.py`
3. **SQL migrations:** Add to `supabase/migrations/` for tracked changes

### Cost Optimization

The 3-stage pipeline is optimized for cost:

| Stage | Models | Cost Strategy |
|-------|--------|---------------|
| Stage 1 | 5 premium models | Full power for quality responses |
| Stage 2 | 3 cheap models | Grok Fast, DeepSeek, GPT-4o-mini for ranking |
| Stage 3 | 1 chairman | Single model synthesizes final answer |

**Prompt Caching:**
- Enabled by default (`ENABLE_PROMPT_CACHING=true`)
- Supports: Claude, GPT, DeepSeek (explicit `cache_control`)
- Auto-cached: Gemini, Grok (implicit caching, no config needed)
- Toggle: Settings → Developer → Prompt Caching
- Kill switch: Set `ENABLE_PROMPT_CACHING=false` in `.env`

**Config files:**
- `backend/config.py` - `CACHE_SUPPORTED_MODELS`, feature flags, Redis/Qdrant config
- `backend/council.py` - 3-stage orchestration
- `backend/openrouter.py` - API calls, caching logic
- `backend/cache.py` - Redis caching module (LLM responses, rate limiting)
- `backend/vector_store.py` - Qdrant vector DB module (semantic search, embeddings)

See `todo/LLM-COST-OPTIMIZATION-PLAN.md` for detailed optimization documentation.

## Deployment

### Vercel (Frontend)
- Auto-deploys on push to `master`
- Build command: `cd frontend && npm run build`
- Output directory: `frontend/dist`

### Render (Backend)
- Service: `axcouncil-backend` at https://axcouncil-backend.onrender.com
- **Auto-deploys** on push to `master` when backend files change (via GitHub Actions)
- Workflow: `.github/workflows/deploy-backend.yml`
- Includes health check verification after deployment
- Or deploy via [Render Dashboard](https://dashboard.render.com)

### GitHub Secrets Required

| Secret | Purpose | How to Set |
|--------|---------|------------|
| `RENDER_DEPLOY_HOOK` | Triggers Render deployment | GitHub repo → Settings → Secrets → Actions → New |

**RENDER_DEPLOY_HOOK value:**
```
https://api.render.com/deploy/srv-d4pfrai4i8rc73e6h28g?key=M17Ys96WsOs
```

### Deploy Commands
```bash
# Push to master (triggers BOTH Vercel + Render auto-deploy)
git push origin master

# Manual Render deploy (if needed)
curl -s -X POST "https://api.render.com/deploy/srv-d4pfrai4i8rc73e6h28g?key=M17Ys96WsOs"
```

### Deployment Flow
```
Push to master
    ↓
CI runs (lint, tests, build)
    ↓
If backend/** changed → deploy-backend.yml triggers
    ↓
Render deploy hook called
    ↓
Wait 60s for Render to start
    ↓
Health check loop (10 retries, 30s interval)
    ↓
✅ Deployment verified healthy
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

### Component-Specific Select Styles (LLM Hub Pattern)

**Problem:** The generic `select.css` has mobile styles that override component-specific sizing. CSS load order and bundling make it unpredictable which styles "win".

**Solution implemented in `select.css`:**
1. Mobile rules use `:where()` to reduce specificity to 0
2. Components can opt out using `select-trigger--llm-model` class
3. Component CSS (like `llm-hub.css`) easily overrides due to higher specificity

```css
/* In select.css - :where() makes specificity 0 */
:where(.select-trigger:not(.select-trigger--llm-model)) {
  min-height: 44px;
  height: auto;
}

/* In llm-hub.css - normal specificity beats :where() */
.llm-model-item .llm-model-select.select-trigger {
  height: 36px;
  min-height: 36px;
}
```

```tsx
// In component - add opt-out class
<SelectTrigger className="llm-model-select select-trigger--llm-model">
```

**Key files:**
- `select.css` - Base Select styles with `:where()` mobile rules
- `llm-hub.css` - LLM Hub specific sizing
- `LLMHubTab.tsx` - Uses `select-trigger--llm-model` class

### Fixed-Position Elements MUST Use Portals (CRITICAL)

**Problem:** The `.app-wrapper` has `overflow: hidden` which clips ANY element rendered inside it, even with `position: fixed`. Fixed positioning does NOT escape parent overflow constraints in React because the element is still a DOM child.

**Solution:** Fixed-position floating elements (buttons, modals, tooltips) MUST use `createPortal` to render to `document.body`.

**Example pattern (see `ThemeToggle.tsx` and `HelpButton.tsx`):**

```tsx
import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';

// SSR-safe mount detection (required for portal)
const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

export function FloatingButton() {
  const mounted = useIsMounted();

  // Don't render until mounted (SSR safety)
  if (!mounted) return null;

  const button = (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      <button>Click me</button>
    </div>
  );

  // CRITICAL: Render via portal to escape app-wrapper overflow
  return createPortal(button, document.body);
}
```

**Why this happens:**
- `App.tsx` renders inside `<motion.div className="app-wrapper">`
- `app-wrapper` CSS has `overflow: hidden` (in `App.css`)
- Even `position: fixed` elements are clipped by their parent's overflow
- Portal renders directly to `document.body`, outside the app-wrapper DOM tree

**Existing components using this pattern:**
- `ThemeToggle.tsx` - Top-right theme switcher
- `HelpButton.tsx` - Bottom-right help button
- `AppModal.tsx` - Modal dialogs

**If your fixed element is not visible, check:**
1. Is it rendered inside app-wrapper? → Use portal
2. Is `mounted` check missing? → Add `useIsMounted` hook
3. Is z-index too low? → Use 9999 for floating UI
4. **Vite HMR caching issue** → Restart dev server (see troubleshooting below)

### Troubleshooting: Component Not Appearing Despite Correct Code

**Symptom:** A new React component (e.g., floating button) doesn't appear even though:
- Code compiles without errors
- Component is correctly imported and rendered
- CSS is correct
- Build succeeds

**Root Cause:** Vite's Hot Module Replacement (HMR) can sometimes serve stale cached code, especially after:
- Adding new components
- Changing import paths
- Modifying CSS files
- Package lock changes

**Solution - In Order of Escalation:**

1. **Hard refresh browser:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Restart Vite dev server:**
   ```bash
   # Stop the running server (Ctrl+C) then:
   npm run dev
   ```

3. **Clear Vite cache and restart:**
   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

4. **Full clean rebuild:**
   ```bash
   rm -rf node_modules/.vite dist
   npm run build
   npm run dev
   ```

**Debugging Steps:**
1. Check browser DevTools Console for errors
2. Check Elements tab - search for the component's class/data-testid
3. If element exists in DOM but not visible → CSS issue (check z-index, position, overflow)
4. If element doesn't exist in DOM → Component not rendering (check imports, conditionals)
5. Add `console.log` at component start to verify it's being called

**Prevention:**
- After creating new components, do a hard refresh
- If component still missing after code changes, restart dev server
- Watch Vite terminal for "hmr update" messages to confirm changes are detected

### useCallback Stale Closure Bug (CRITICAL)

**Symptom:** A React hook with `useCallback` + `useEffect` pattern causes multiple re-renders or stale state reads. Loading skeletons flash multiple times on initial page load.

**Root Cause:** When a function inside `useCallback` reads state variables, it captures their values at creation time. If the callback is in a `useEffect` dependency array and state changes cause the callback to be recreated, the old callback may still be running with stale values.

**Example - Bad Pattern:**
```tsx
// State that's read inside callback
const [dataLoaded, setDataLoaded] = useState(false);

// This captures dataLoaded's value at creation time!
const loadData = useCallback(async () => {
  if (dataLoaded) return; // BUG: May read stale value!
  setLoading(true);
  // ...fetch data...
  setDataLoaded(true);
}, [activeTab]); // dataLoaded NOT in deps to avoid re-trigger

useEffect(() => {
  loadData();
}, [loadData]); // Fires when loadData changes
```

**Solution - Use refs for values read inside callbacks:**
```tsx
// Ref always has current value (no stale closure)
const dataLoadedRef = useRef(false);
const [dataLoaded, setDataLoaded] = useState(false);

const loadData = useCallback(async () => {
  if (dataLoadedRef.current) return; // ✓ Always current!
  setLoading(true);
  // ...fetch data...
  dataLoadedRef.current = true;
  setDataLoaded(true); // Update state for UI reactivity
}, [activeTab]);
```

**Also add concurrent load guard:**
```tsx
const loadingInProgressRef = useRef<string | null>(null);

const loadData = useCallback(async () => {
  const loadKey = `${companyId}-${activeTab}`;
  if (loadingInProgressRef.current === loadKey) return; // Already loading
  loadingInProgressRef.current = loadKey;

  // ...do work...

  loadingInProgressRef.current = null; // Clear guard
}, [companyId, activeTab]);
```

**Key files implementing this pattern:**
- `useCompanyData.ts` - Uses `loadedRef` and `loadingInProgressRef` to prevent skeleton flash

### Modal Dismiss UX Patterns

**Click-outside to close (AppModal.tsx):**
- Overlay has explicit `onClick` handler that calls `onClose()`
- `shouldIgnoreClose()` checks for nested dialogs, fixed-position buttons
- Never rely solely on Radix's `onOpenChange` - add explicit handlers

**Mobile swipe-to-dismiss (AppModal.tsx):**
- Drag handle at top of modal with `onTouchStart`/`onTouchEnd`
- Swipe down 60px+ triggers close
- Tap on drag handle also closes (mobile UX pattern)

```tsx
// Swipe detection on drag handle
const handleDragHandleTouchEnd = (e: React.TouchEvent) => {
  const deltaY = e.changedTouches[0].clientY - dragStartY.current;
  if (deltaY > 60) onClose?.();
};
```

**CSS for drag handle (AppModal.css):**
```css
.app-modal-drag-handle {
  display: none; /* Hidden on desktop */
}
@media (max-width: 768px) {
  .app-modal-drag-handle {
    display: flex;
    height: 32px;
    /* Visual handle bar via ::before */
  }
}
```
