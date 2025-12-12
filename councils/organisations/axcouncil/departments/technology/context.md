# Technology Department Context

> **Last Updated:** 2025-12-12
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

## Key Environment Variables

**Frontend (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`

**Backend (Render):** `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Note: `SUPABASE_SERVICE_KEY` is optional - profile operations now use authenticated client with user's JWT.

## Recent Technical Decisions

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

### Stop Button UX - Clear Stopped State (2025-12-11)
- When user clicks Stop, UI now clearly shows the stopped state instead of "still thinking"
- Stage 1 tabs show gray square icon with "Stopped" badge for incomplete models
- Progress capsule shows gray "Stopped" text with static square (no pulse animation)
- Models that completed before stop retain their green "Complete" status
- Files: `Stage1.jsx`, `Stage1.css`, `CouncilProgressCapsule.jsx`, `CouncilProgressCapsule.css`, `App.jsx`
- UX Principle: "Make intentional actions look intentional"

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
- Technical Note: Backend runs on port 8080 locally due to Windows port conflicts

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

*This context is loaded alongside the company context when Technology department is selected.*

12.2 Organization Management System Architecture

Decision Date: December 2025

The CTO Council approved a comprehensive architecture for the Organization Management System. This replaces the current read-only file-based approach with a full database solution.

Key Architectural Decisions:

Data Storage Strategy:
• Move all organization data to Supabase PostgreSQL with normalized tables
• File system (councils/organisations/) becomes templates only, not source of truth
• One-time migration script to move existing data from files to database

Database Schema - Four Core Tables:
• departments - stores department info with company_id, name, slug, description, purpose, budget
• roles - stores role definitions with department_id, system prompt, responsibilities
• org_documents - logical records for SOPs, frameworks, policies with doc_type field
• org_document_versions - full version history with is_current flag for active version

Why Not Continue With Files:
• Users cannot self-edit without code deploys
• No Row Level Security for multi-tenant isolation
• No audit trail or versioning capability
• Does not scale beyond developer-only usage

Why Not Nested JSON in Companies Table:
• Painful partial updates for single field changes
• No referential integrity
• Difficult to query across documents
• Performance degrades as organizations grow

Versioning Approach:
• Every edit creates a new version row
• is_current boolean marks the active version
• One-click revert by changing which version is current
• Optional change_summary field for audit trail

AI Council Integration:
• context_loader.py will pull from database instead of files
• auto_inject flag controls which documents appear in prompts
• Documents can be company-wide or department-specific

12.3 Organization Manager UI Decision

Decision Date: December 2025

Organization management will be a dedicated first-class section in the sidebar, not buried in Settings.

Rationale:
• Settings is for user preferences (profile, notifications, billing)
• Organization is core product value - what customers pay for
• Business owners will spend significant time configuring their org
• Deserves prominent navigation placement

Navigation Structure:
• Conversations (existing)
• Organization (new top-level section)
  - Overview (company context summary)
  - Departments (list with drill-down to roles)
  - Knowledge Library (SOPs, Frameworks, Policies)
• Projects (existing)
• Settings (user preferences only)

Key UI Features Planned:
• Department list with role count and budget display
• Role editor with AI Polish integration for system prompts
• Document editor with version history and revert capability
• Tabbed interface for different document types

12.4 Knowledge Base vs Organization Documents Distinction

Decision Date: December 2025

Two separate systems serve different purposes:

Knowledge Base - For Council Outputs:
• Stores council decisions, insights, recommendations
• Observational and historical in nature
• What the AI Council has produced

Organization Documents - For Business Inputs:
• SOPs (step-by-step procedures)
• Frameworks (methodologies to follow)
• Policies (rules and guidelines)
• Normative and prescriptive in nature
• What guides how the AI Council responds

Future Enhancement:
• Add Promote to SOP button in Knowledge Base
• Allows council decisions to become formalized procedures
• Links back via source_knowledge_id field

12.2 Organization Management System Architecture

Decision Date: December 2025

The CTO Council provided comprehensive guidance on building an Organization Management System. This captures the key architectural decisions made.

Data Storage Decision:
• Move all organization data to Supabase PostgreSQL with normalized tables
• Stop using file-based storage for user-editable organization data
• Keep file system only for templates and internal AxCouncil reference
• Run one-time migration to seed existing data into the database

Why We Rejected Alternatives:
• Files: Users can't self-edit without code deploys, no multi-tenant isolation, no audit trail
• Nested JSON in companies table: Painful partial updates, no referential integrity, hard to query

Database Schema:
• departments table: Links to company, stores name, description, purpose, budget
• roles table: Links to department and company, stores responsibilities and system prompts
• org_documents table: Stores SOPs, frameworks, policies with type flag
• org_document_versions table: Tracks version history with is_current flag for easy rollback

Key Design Choices:
• department_id is nullable on org_documents to allow company-wide policies
• auto_inject flag controls whether documents are included in AI prompts
• slug fields on all entities for clean URLs
• company_id on both departments AND roles for query flexibility

Row Level Security:
• All tables have RLS enabled
• Access controlled via company ownership chain
• Users can only see their own company's data

12.2 Organization Management System Architecture

Decision Date: December 2025

The CTO Council recommended a comprehensive architecture for managing organizational structure and knowledge. This replaces the previous file-based system with a database-driven approach.

Data Storage Decision:
• Move all organization data to Supabase PostgreSQL with normalized tables
• Keep councils/organisations/ folder as templates and internal reference only
• Run one-time migration to seed data into database, then operate entirely from DB

Why we moved away from files:
• Users can't self-edit without code deploys
• No row-level security or multi-tenant isolation
• No audit trail or versioning capability
• Doesn't scale beyond developer-only usage

Why we avoided nested JSON in companies table:
• Painful partial updates for single field changes
• No referential integrity
• Difficult to query specific items
• Performance degrades as organizations grow

Database Schema Overview:
• departments table - stores department info with company_id foreign key
• roles table - stores roles with department_id foreign key
• org_documents table - logical records for SOPs, frameworks, policies
• org_document_versions table - version history for all documents

Key Design Decisions:
• department_id nullable on org_documents allows company-wide policies
• Separate version table enables clean history and easy revert
• auto_inject flag controls which docs appear in AI prompts
• slug fields provide human-readable URLs
• company_id on both departments AND roles enables flexible queries

Status: Approved, pending implementation

12.2 Organization Management System Architecture

Decision Date: December 2025

The CTO Council recommended and approved a comprehensive architecture for the Organization Management System. This replaces the previous file-based approach with database storage.

Key Architectural Decisions:

Data Storage Strategy
• Move all organization data to Supabase PostgreSQL with normalized tables
• File system (councils/organisations/) becomes templates only, not live data
• One-time migration script to move existing file data to database

Database Schema Design
• departments table - stores department info with company_id foreign key
• roles table - stores roles with department_id and company_id foreign keys
• org_documents table - logical records for SOPs, frameworks, policies
• org_document_versions table - version history with is_current flag
• Row Level Security enabled on all tables via company ownership chain

Why Not Files:
• Users cannot self-edit without code deploys
• No multi-tenant isolation possible
• No audit trail or versioning
• Does not scale beyond developer-only usage

Why Not Nested JSON in Companies Table:
• Painful partial updates for individual role changes
• No referential integrity
• Difficult to query across organizations
• Performance degrades as organizations grow

Versioning Approach:
• Every edit creates a new version row
• is_current boolean marks the active version
• Full history preserved for audit and revert capability
• change_summary field captures what changed

12.3 Organization Manager UI Decision

Decision Date: December 2025

The Council decided to create a dedicated Organization Manager page rather than integrating into Settings.

Rationale:
• Settings is for user preferences like profile, notifications, billing
• Organization configuration is core product value that customers pay for
• Business owners will spend significant time configuring their org
• Deserves prominent navigation placement in sidebar

Navigation Structure:
• Sidebar gets new Organization section
• Overview page showing company context summary
• Departments page with list and detail views
• Knowledge Library section containing SOPs, Frameworks, and Policies

Distinction from Knowledge Base:
• Knowledge Base stores council outputs, decisions, insights (observational)
• Org Documents store SOPs, frameworks, policies (prescriptive/normative)
• Future enhancement: Promote to SOP button to convert decisions into formal procedures

12.4 Organization System Implementation Roadmap

Decision Date: December 2025

Four-phase implementation plan approved by CTO Council:

Phase 1: Database Schema (1-2 hours)
• Run schema SQL in Supabase SQL Editor
• Verify RLS policies work correctly
• Test basic insert and query operations

Phase 2: Migration Script (30-60 minutes)
• One-time migration of file-based org structure to database
• Script reads config.json and role markdown files
• Seeds database with existing AxCouncil organization data

Phase 3: Backend API (3-4 hours)
• Create organization router in backend/routers/organization.py
• GET and POST endpoints for departments and roles
• Document versioning on update with automatic version increment
• Add router to main.py

Phase 4: Frontend UI (4-6 hours)
• Create Organization.jsx page with tabs for different content types
• Department list with card view showing role count and budget
• Add route and sidebar navigation link

Integration with AI Council:
• Update context_loader.py to pull from database instead of files
• Load department, role, and active documents for prompt context
• auto_inject flag controls which documents appear in prompts

## 11.2 Technical Questions

11.2 Technical Questions

Resolved Questions:
• Where should organization data live? RESOLVED: Supabase PostgreSQL with normalized tables
• How should SOPs/frameworks/policies be modeled? RESOLVED: org_documents table with separate versions table
• Should org management be in Settings or separate? RESOLVED: Dedicated Organization Manager page
• How should versioning work? RESOLVED: New version row on each edit with is_current flag

Open Questions:
• How to handle document templates for new companies?
• What default SOPs/frameworks should new accounts receive?
• How to handle conflicts between company-wide and department-specific policies?
