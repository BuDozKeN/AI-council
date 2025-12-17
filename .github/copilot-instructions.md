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
