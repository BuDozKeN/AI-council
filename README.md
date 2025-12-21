# AxCouncil - AI Council Platform

A multi-model AI council platform that enables intelligent conversations with context-aware responses from multiple AI models working together.

## Features

### Core Functionality
- **Multi-Model Council**: Leverages 5 AI models (Claude Opus 4.5, GPT-5.1, Gemini 3 Pro, Grok 4, DeepSeek) for comprehensive responses
- **3-Stage Pipeline**:
  1. **Stage 1**: Individual responses from 5 AI models in parallel
  2. **Stage 2**: Anonymized peer review and ranking
  3. **Stage 3**: Chairman synthesis of final answer
- **Company Context**: Associate conversations with companies, projects, and departments
- **Command Center**: Decisions, playbooks, activity tracking, and team management

### My Company Feature
- **Company Management**: Create and manage company profiles with context
- **Project Management**: Organize work by projects within companies
- **Department Councils**: Configure AI councils for different departments (Marketing, Sales, Legal, etc.)
- **Role-Based Personas**: Assign specific AI personas to department roles
- **Playbooks**: SOPs, frameworks, and policies with auto-injection into council context
- **Decisions**: Save and archive council decisions with department tagging

### Data Architecture (Supabase)

**All context and configuration is stored in Supabase PostgreSQL database.** The `councils/` folder contains legacy templates and is NOT used at runtime.

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `companies` | Company profiles | `name`, `slug`, `context_md` |
| `departments` | Department configs | `name`, `slug`, `context_md`, `company_id` |
| `roles` | AI role personas | `name`, `slug`, `system_prompt`, `department_id` |
| `projects` | Projects within companies | `name`, `context_md`, `company_id` |
| `org_documents` | Playbooks (SOPs, policies) | `title`, `doc_type`, `auto_inject` |
| `knowledge_entries` | Saved decisions | `title`, `summary`, `scope`, `auto_inject` |
| `conversations` | Chat history | `title`, `company_id`, `department_id` |

### Context Injection Order

When you ask the council a question, context is injected in this order:

1. **Company Context** (`companies.context_md`) - Business overview, goals, constraints
2. **Role System Prompt** (`roles.system_prompt`) - AI persona instructions
3. **Department Context** (`departments.context_md`) - Department-specific knowledge
4. **Project Context** (`projects.context_md`) - If a project is selected
5. **Decisions** - Auto-injected prior decisions marked `auto_inject=true`
6. **Playbooks** - SOPs and policies marked `auto_inject=true`

### UI/UX
- **Modern Design System**: Radix UI components with consistent styling
- **Responsive Layout**: Sidebar navigation with collapsible conversation groups
- **Markdown Rendering**: Full markdown support with syntax highlighting
- **Real-time Updates**: Live streaming responses via SSE

## Tech Stack

### Frontend
- **React 19** with Vite
- **Radix UI** for accessible components (Select, Dialog, etc.)
- **Tailwind CSS v4** for styling
- **React Markdown** for content rendering

### Backend
- **FastAPI** (Python) on port 8080
- **OpenRouter API** for multi-model access
- **Supabase** for PostgreSQL database and authentication

### Database
- **Supabase PostgreSQL** with Row Level Security (RLS)
- Multi-tenant data isolation via `company_id`
- Service client for admin operations that bypass RLS

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- OpenRouter API key
- Supabase project (URL and keys)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/AI-council.git
   cd AI-council
   ```

2. **Backend Setup**
   ```bash
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Environment Variables**

   Create a `.env` file in the root directory:
   ```env
   # OpenRouter
   OPENROUTER_API_KEY=your_openrouter_api_key

   # Supabase
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key

   # Optional: Stripe for billing
   STRIPE_SECRET_KEY=your_stripe_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   ```

4. **Database Setup**

   Run the Supabase migrations in order:
   ```bash
   # Apply migrations via Supabase CLI or dashboard
   cd supabase/migrations
   # Apply each .sql file in chronological order
   ```

5. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start the Backend**
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:8080/docs

## Project Structure

```
AI-council/
├── backend/
│   ├── main.py              # FastAPI application entry
│   ├── openrouter.py        # OpenRouter API integration
│   ├── database.py          # Supabase client configuration
│   ├── context_loader.py    # Loads context from Supabase tables
│   ├── knowledge.py         # Knowledge base operations
│   ├── storage.py           # Project/document storage
│   └── routers/
│       ├── company.py       # Company/project/department APIs
│       ├── auth.py          # Authentication endpoints
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── MyCompany.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── ui/          # Reusable UI components
│   │   ├── lib/             # Utilities and design system
│   │   └── api.js           # API client
│   └── package.json
├── supabase/
│   └── migrations/          # Database schema migrations
├── councils/                # LEGACY - not used at runtime
│   ├── departments/         # Template department configs
│   ├── organisations/       # Template org context (deprecated)
│   ├── outputs/             # Output format templates
│   └── styles/              # Writing style templates
└── knowledge-base/          # Exported conversations (local)
```

## Managing Company Context

### Adding/Editing Company Context

All context is managed through the **My Company** interface in the app or directly in Supabase:

1. **Company Context**: Edit `companies.context_md` in Supabase
2. **Department Context**: Edit `departments.context_md` in Supabase
3. **Role Prompts**: Edit `roles.system_prompt` in Supabase
4. **Playbooks**: Create `org_documents` with `auto_inject=true`

**Do NOT edit markdown files in the `councils/` folder** - these are legacy templates and are not read by the application.

### Example: Updating CTO Role Prompt

```sql
UPDATE roles
SET system_prompt = 'Your new CTO instructions here...'
WHERE slug = 'cto';
```

Or use the My Company > Team interface to edit roles.

## Design System

The application follows a consistent design system documented in [`docs/design/`](docs/design/README.md):

- **[Tokens](docs/design/tokens.md)**: Z-index scale, colors, shadows, border radius
- **[Components](docs/design/components.md)**: Spinner, Select components, etc.
- **[Patterns](docs/design/patterns.md)**: Loading states, error handling, modals

## API Endpoints

### Conversations
- `GET /conversations` - List conversations
- `POST /conversations` - Create new conversation
- `POST /conversations/{id}/message` - Send message (SSE streaming)

### Companies
- `GET /companies` - List companies
- `POST /companies` - Create company
- `GET /companies/{id}/projects` - List company projects
- `POST /companies/{id}/projects` - Create project

### Departments
- `GET /departments` - List departments
- `GET /departments/{id}/roles` - List department roles

### Decisions
- `GET /knowledge` - List saved decisions
- `POST /knowledge` - Save decision from council
- `PUT /knowledge/{id}/archive` - Archive a decision

## Performance

The application includes several performance optimizations:

### Backend
- **Connection Pooling**: Supabase clients are cached by token hash (5-minute TTL)
- **GZip Compression**: Responses > 1KB are compressed automatically
- **In-Memory Caching**: TTL-based caches for user, company, and settings data

### Frontend
- **List Virtualization**: Sidebar uses `react-window` for large conversation lists (>30 items)
- **State Consolidation**: Modal state managed via `useReducer` to reduce re-renders
- **Memoization**: Heavy computations wrapped in `useMemo`

See [.github/copilot-instructions.md](.github/copilot-instructions.md#5-performance-optimizations) for implementation details.

## Development & AI Tools

This project is optimized for AI-assisted development.

- **AI Agent Instructions**: See [.github/copilot-instructions.md](.github/copilot-instructions.md) for architectural context and guidelines.
- **Claude Memory**: If using Claude Code CLI, see [docs/CLAUDE_MEMORY.md](docs/CLAUDE_MEMORY.md) to set up persistent project memory.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with AI assistance using Claude Code.
