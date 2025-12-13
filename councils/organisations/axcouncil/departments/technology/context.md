# Technology Department Context

> **Last Updated:** 2025-12-13
> **Organisation:** AxCouncil

---

## Department Overview

Technical execution and development guidance for AxCouncil.

## Roles

- **CTO** - Technical strategy and architecture decisions
- **Developer** - Development guidance and code implementation
- **DevOps** - Deployment, infrastructure, and CI/CD

## Production Stack (All LIVE)

| Component | Technology | URL/Details |
|-----------|------------|-------------|
| Frontend | React 19 + Vite + Tailwind v4 | https://ai-council-three.vercel.app |
| Backend | Python 3.10 + FastAPI | https://axcouncil-backend.onrender.com |
| Database | Supabase PostgreSQL | ywoodvmtbkinopixoyfc.supabase.co |
| Auth | Supabase Auth | Email/password + magic links |
| LLM API | OpenRouter | 5 models (Claude, GPT, Gemini, Grok, DeepSeek) |
| Billing | Stripe | Free/Pro ($29)/Enterprise ($99) tiers |

## Local Development

| Component | Port | Command |
|-----------|------|---------|
| Backend | 8080 | `py -m uvicorn backend.main:app --reload --port 8080` |
| Frontend | 5173+ | `cd frontend && npm run dev` |

**Note:** Backend runs on port 8080 (not 8000) to avoid port conflicts with zombie processes on Windows.

## What's Working

- **3-Stage Council Deliberation** - Independent responses → Peer review → Chairman synthesis
- **User Authentication** - Sign up, sign in, password recovery, protected routes
- **Multi-tenant Data** - Users only see their own conversations (RLS enforced)
- **Billing & Subscriptions** - Stripe checkout, usage limits, billing portal
- **Live Streaming** - SSE streaming displays responses in real-time
- **Mock Mode** - Testing without real API calls (`POST /api/mock?enabled=true`)
- **Settings Modal** - Profile management (display name, company, phone, bio) with Billing tab
- **My Company Interface** - COMPLETE - Unified UI for managing organization structure
- **Knowledge Consolidation** - COMPLETE - 3-option save modal, archive/promote decisions

## Key Environment Variables

**Frontend (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

**Backend (Render):** `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Note: `SUPABASE_SERVICE_KEY` is required for archive/promote endpoints that bypass RLS.

---

## Recent Technical Decisions

### Knowledge Consolidation System - COMPLETE (2025-12-13)
- **3-Option Save Modal:** Just Save, Remember (company-wide), Remember for Project
- **Archive Decisions:** Soft delete via `is_active=false` flag, uses service client to bypass RLS
- **Promote to Playbook:** Creates playbook from decision content with link back to source
- **Context Injection:** Prior decisions automatically included in council sessions
- **Styled Action Buttons:** View (blue), Promote (orange), Archive (gray) in Decisions tab
- **RLS Bypass:** Archive and promote endpoints use `get_supabase_service()` for knowledge_entries
- **Files:** `MyCompany.jsx`, `company.py`, `api.js`

### My Company Interface - COMPLETE (2025-12-12)
- **What it does:** Unified interface for managing company organization directly from Supabase database
- **4 Tabs:** Overview, Team, Playbooks, Decisions
- **Key Feature:** Role system prompts now stored in database, editable from UI
- **Architecture:** Per Council recommendation, ALL data comes from Supabase (filesystem is deprecated for runtime)
- **Backend:** New router at `backend/routers/company.py` with full CRUD endpoints
- **Frontend:** `MyCompany.jsx` component with modal views for roles, departments, playbooks
- **Database Tables:** `companies`, `departments`, `roles`, `org_documents`, `org_document_versions`, `decisions`
- **Data Verified:** CTO (2912 chars), Head of AI People & Culture (2265 chars), AI UX/UI Designer (2710 chars) system prompts in Supabase
- **Files:** `MyCompany.jsx`, `MyCompany.css`, `company.py`, organization migrations in `supabase/migrations/`

### Stop Button UX - Clear Stopped State (2025-12-11)
- When user clicks Stop, UI now clearly shows the stopped state instead of "still thinking"
- Stage 1 tabs show gray square icon with "Stopped" badge for incomplete models
- Progress capsule shows gray "Stopped" text with static square (no pulse animation)
- Models that completed before stop retain their green "Complete" status
- Files: `Stage1.jsx`, `Stage1.css`, `CouncilProgressCapsule.jsx`, `CouncilProgressCapsule.css`, `App.jsx`
- UX Principle: "Make intentional actions look intentional"

### Image Upload UX - Frictionless Drag & Drop (2025-12-10)
- Image button moved inside textarea (bottom-left), reducing visual clutter
- Real-time file type detection during drag - shows different overlay:
  - **Blue overlay**: "Drop images here" (valid image files)
  - **Red overlay**: "Only images are supported - PNG, JPG, GIF, or WebP" (invalid files)
- No error banners after drop - user already saw the warning during drag
- Counter-based drag handling prevents flicker when dragging over child elements
- Files: `ImageUpload.jsx`, `ImageUpload.css`, integrated in `ChatInterface.jsx`
- UX Principle: "Feedback at the moment of decision, not after the mistake"

### Council Progress Capsule (2025-12-10)
- Implemented floating status pill that shows what the council is doing at all times
- Human-friendly language: "Gemini and Claude are thinking..." not "Stage 1: 3 of 5"
- Persists through all 3 stages so users never wonder if system is frozen
- Files: `CouncilProgressCapsule.jsx`, `CouncilProgressCapsule.css`, wired into `ChatInterface.jsx`
- UX Principle: "If someone asks what you're waiting for, you should be able to tell them"

### Tailwind CSS v4 Migration
- Upgraded from v3 to v4 with CSS-first configuration
- Uses `@tailwindcss/postcss` plugin instead of `tailwindcss` directly
- Entry point: `@import "tailwindcss"` syntax in tailwind.css
- Shadcn UI components work with preflight disabled

### Settings/Profile Implementation
- Created `user_profiles` table in Supabase with RLS disabled
- Settings modal uses vanilla CSS (Settings.css) instead of Shadcn for reliability
- Profile API uses authenticated client with user's JWT token (not service key)
- Endpoints: `GET/PUT /api/profile`

---

## Architectural Decisions

### Organization Management System (December 2025)

The CTO Council approved a database-driven architecture for managing organizational structure:

**Data Storage Strategy:**
- All organization data lives in Supabase PostgreSQL with normalized tables
- File system (councils/organisations/) is templates only, not source of truth
- One-time migration moved existing data from files to database

**Database Schema - Core Tables:**
- `departments` - department info with company_id, name, slug, description, purpose, budget
- `roles` - role definitions with department_id, system prompt, responsibilities
- `org_documents` - logical records for SOPs, frameworks, policies with doc_type field
- `org_document_versions` - full version history with is_current flag

**Why Not Files:**
- Users cannot self-edit without code deploys
- No Row Level Security for multi-tenant isolation
- No audit trail or versioning capability

**Why Not Nested JSON:**
- Painful partial updates for single field changes
- No referential integrity
- Performance degrades as organizations grow

**Versioning Approach:**
- Every edit creates a new version row
- is_current boolean marks the active version
- One-click revert by changing which version is current

### Organization Manager UI Decision

Organization management is a dedicated first-class section in the sidebar, not buried in Settings.

**Rationale:**
- Settings is for user preferences (profile, notifications, billing)
- Organization is core product value - what customers pay for
- Business owners will spend significant time configuring their org

### Knowledge Base vs Organization Documents

Two separate systems serve different purposes:

**Knowledge Base (Council Outputs):**
- Stores council decisions, insights, recommendations
- Observational and historical in nature
- What the AI Council has produced

**Organization Documents (Business Inputs):**
- SOPs (step-by-step procedures)
- Frameworks (methodologies to follow)
- Policies (rules and guidelines)
- Normative and prescriptive in nature
- What guides how the AI Council responds

---

## Open Questions

- How to handle document templates for new companies?
- What default SOPs/frameworks should new accounts receive?
- How to handle conflicts between company-wide and department-specific policies?

---

*This context is loaded alongside the company context when Technology department is selected.*
