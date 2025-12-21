# AI Agent Instructions for AI-Council

This document guides AI agents (GitHub Copilot, Claude, Cursor, etc.) on how to work effectively in this codebase.

## 0. INTERACTION PROTOCOL (CRITICAL)
**Role**: You are the Lead Architect and Senior Developer for AI-Council.
**Trigger**: When the user requests a code change, feature, or fix (a "vibe request"):
1.  **STOP**: Do not generate code immediately.
2.  **TRANSLATE**: Restate the user's request as a formal "Technical Specification".
    *   Identify the specific files to be modified.
    *   Explain the logic flow changes.
    *   Highlight potential risks or side effects.
3.  **CONFIRM**: Present this plan to the user and ask: *"Does this plan match your intent? Say 'Go' to implement."*
4.  **EXECUTE**: Only write the code after the user confirms.

## 1. Project Architecture

### Core Concept
**AI-Council** is a multi-model decision-making platform.
*   **Backend**: FastAPI (`backend/`) serving a REST API.
*   **Frontend**: React + Vite + Tailwind (`frontend/`).
*   **Database**: Supabase (PostgreSQL).
*   **AI Logic**: A 3-stage pipeline (`backend/council.py`) orchestrating 5 different LLMs.

### Key Data Flows
1.  **Context Injection**: `backend/context_loader.py` builds a prompt by layering:
    *   Company Context -> Role Persona -> Department Context -> Project Context -> Decisions/Playbooks.
2.  **Council Execution**:
    *   **Stage 1**: Parallel generation from 5 models.
    *   **Stage 2**: Peer review (anonymized).
    *   **Stage 3**: Chairman synthesis.
3.  **Storage**: All configurations (prompts, contexts) are in DB tables (`companies`, `roles`, `departments`), NOT in code files.

## 2. Critical Developer Workflows

### Backend
*   **Run Server**: `uvicorn backend.main:app --reload` (Port 8000).
*   **Database**:
    *   Schema is in `backend/migrations/` and `supabase/migrations/`.
    *   **Always** check `backend/database.py` for connection logic (uses `python-dotenv`).
*   **Dependencies**: Managed in `requirements.txt`.

### Frontend
*   **Run Dev**: `npm run dev` (Port 5173).
*   **Build**: `npm run build`.
*   **Styling**: Tailwind CSS. Use `className` for all styling; avoid custom CSS files.

### Memory & Context
*   **Claude Memory**: If using Claude CLI, refer to `docs/CLAUDE_MEMORY.md` to seed project context.
*   **Context Files**: `*.md` files in `councils/` are LEGACY templates. Runtime context comes from the Database. **Do not edit `councils/` files expecting runtime changes.**

## 3. Project Conventions

*   **Path Handling**: Always use `pathlib.Path` for file operations.
*   **Environment**: `.env` file is expected in the project root.
*   **API Routes**: Defined in `backend/routers/` or directly in `backend/main.py` (legacy routes being migrated).
*   **Supabase Client**: Use `backend.database.get_supabase()` for RLS-enabled client, `get_supabase_service()` for admin tasks.

## 4. Common Pitfalls
*   **Legacy Code**: `councils/` folder is for reference/seeding only.
*   **Async/Await**: The entire backend is async. Ensure DB calls are awaited.
*   **CORS**: Configured in `backend/main.py`. If adding a new frontend port, update `CORS_ORIGINS`.

## 5. Performance Optimizations

### Backend Performance

#### Connection Pooling (`backend/database.py`)
*   Supabase clients are cached by token hash with TTL-based expiration.
*   Configuration: `POOL_MAX_SIZE=100`, `POOL_TTL=300s`, `POOL_CLEANUP_INTERVAL=60s`.
*   Use `get_supabase_with_auth(token)` for user-authenticated operations - it reuses clients.
*   Thread-safe via `threading.Lock()`.

#### GZip Compression (`backend/main.py`)
*   All responses > 1000 bytes are GZip compressed.
*   Added via `GZipMiddleware(minimum_size=1000)`.

#### In-Memory Caching (`backend/utils/cache.py`)
*   `TTLCache` class for frequently accessed data.
*   Pre-configured caches: `user_cache` (60s), `company_cache` (300s), `settings_cache` (30s).
*   Use `@cached(cache_instance, key_fn)` decorator for easy caching.

### Frontend Performance

#### State Management (`frontend/src/hooks/useModalState.js`)
*   Modal-related state consolidated into single `useReducer` hook.
*   Reduces re-renders by grouping related state updates.
*   Actions: `openLeaderboard`, `closeLeaderboard`, `openSettings`, `closeSettings`, `openProjectModal`, `closeProjectModal`, `openMyCompany`, `closeMyCompany`, etc.

#### List Virtualization (`frontend/src/components/sidebar/VirtualizedConversationList.jsx`)
*   Uses `react-window` (v2) for rendering only visible sidebar items.
*   Only activates when conversation count > 30.
*   Handles mixed row heights (group headers vs conversation items).

#### Memoization Patterns
*   Heavy computations in tabs (ProjectsTab, DecisionsTab) wrapped in `useMemo`.
*   Components that receive object/array props use `React.memo`.
*   Always place `useMemo`/`useCallback` BEFORE any early returns in components.

### Performance Guidelines for New Code
1.  **Backend**: Use `@cached` decorator for DB queries that don't need real-time data.
2.  **Frontend**: Wrap expensive computations in `useMemo`, event handlers in `useCallback`.
3.  **Lists**: Consider virtualization for lists > 50 items.
4.  **State**: Group related state into reducers when > 5 related useState calls.
