# AxCouncil - AI Council Platform

A multi-model AI council platform that enables intelligent conversations with context-aware responses from multiple AI models working together.

## Features

### Core Functionality
- **Multi-Model Council**: Leverages multiple AI models (GPT-4, Claude, Gemini, etc.) for comprehensive responses
- **3-Stage Pipeline**: Triage -> Individual Responses -> Synthesized Answer
- **Company Context**: Associate conversations with companies, projects, and departments
- **Knowledge Consolidation**: Decisions, archives, and knowledge base management

### My Company Feature
- **Company Management**: Create and manage company profiles with context
- **Project Management**: Organize work by projects within companies
- **Department Councils**: Configure AI councils for different departments (Marketing, Sales, Legal, etc.)
- **Role-Based Personas**: Assign specific AI personas to department roles
- **Channel Support**: Department-specific channels (Email, LinkedIn, etc.)
- **Technology Stack**: Track and consolidate technology decisions
- **Playbooks**: Manage SOPs, Frameworks, and Policies
- **Decisions Archive**: Track and promote decisions to playbooks
- **Activity Logging**: Comprehensive audit trail of all changes

### Curator & Knowledge
- **Context Curation**: AI-powered context suggestions and management
- **Knowledge Base**: Extract and save insights from conversations
- **Project Reports**: Generate comprehensive project summaries
- **Conversation Export**: Export conversations to markdown format

### UI/UX
- **Modern Design System**: Radix UI components with consistent styling
- **Responsive Layout**: Sidebar navigation with collapsible conversation groups
- **Markdown Rendering**: Full markdown support with syntax highlighting
- **Real-time Updates**: Live streaming responses with progress indicators
- **Image Upload**: Support for image attachments and AI-powered analysis
- **Dark/Light Theme**: Theme support via next-themes

## Tech Stack

### Frontend
- **React 19** with Vite
- **Radix UI** for accessible components (Select, Dialog, etc.)
- **Tailwind CSS** for styling
- **React Markdown** for content rendering
- **Supabase** client for authentication and storage

### Backend
- **FastAPI** (Python)
- **OpenRouter API** for multi-model access
- **Supabase** for database, authentication, and storage
- **Stripe** for billing integration

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- OpenRouter API key
- Supabase account and project
- Stripe account (for billing features)

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

   # Set environment variables (create a .env file)
   # Copy .env.example to .env and fill in your values
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

**Option 1: Using the start script (recommended)**
```bash
./start.sh
```
This will start both backend and frontend servers.

**Option 2: Manual startup**

1. **Start the Backend**
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8001
   - API Docs: http://localhost:8001/docs

## Project Structure

```
AI-council/
├── backend/
│   ├── main.py              # FastAPI application entry
│   ├── openrouter.py        # OpenRouter API integration
│   ├── database.py          # Supabase database configuration
│   ├── storage.py           # Supabase storage operations
│   ├── auth.py              # Authentication helpers
│   ├── billing.py           # Stripe billing integration
│   ├── council.py           # Council orchestration logic
│   ├── triage.py            # Message triage system
│   ├── curator.py           # Context curation system
│   ├── knowledge.py         # Knowledge base management
│   ├── attachments.py       # File upload handling
│   ├── image_analyzer.py    # Image analysis with AI
│   ├── context_loader.py    # Business context loading
│   ├── org_sync.py          # Organization synchronization
│   ├── leaderboard.py       # Model performance tracking
│   └── routers/
│       └── company.py       # Company/department/project APIs
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── MyCompany.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── CuratorPanel.jsx
│   │   │   ├── KnowledgeBase.jsx
│   │   │   └── ui/          # Reusable UI components
│   │   │       ├── DepartmentSelect.jsx
│   │   │       ├── select.jsx
│   │   │       ├── dialog.jsx
│   │   │       └── button.jsx
│   │   ├── lib/             # Utilities and design system
│   │   │   ├── DESIGN_SYSTEM.md
│   │   │   ├── colors.js
│   │   │   ├── smartTextToMarkdown.js
│   │   │   └── utils.js
│   │   └── api.js           # API client
│   └── package.json
├── councils/
│   ├── departments/         # Department configurations
│   ├── organisations/       # Organization-specific context
│   ├── outputs/             # Output templates
│   └── styles/              # Writing styles
├── migrations/              # Database migration scripts
├── supabase/                # Supabase configuration
│   └── migrations/          # Supabase migrations
├── knowledge-base/          # Exported conversations
├── start.sh                 # Convenience startup script
├── pyproject.toml           # Python project metadata
└── requirements.txt         # Python dependencies
```

## Design System

The application follows a consistent design system documented in `frontend/src/lib/DESIGN_SYSTEM.md`:

- **Colors**: Orange/amber primary, gray neutrals, semantic colors
- **Border Radius**: 12px for dropdowns/cards, 8px for items, 16px for pills
- **Shadows**: Consistent elevation system
- **Typography**: System fonts with defined scale

## Configuration

### Environment Variables

All required environment variables are documented in `.env.example`. Copy this file to `.env` and configure:

**Required:**
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key

**Optional:**
- `SUPABASE_SERVICE_KEY` - For admin operations
- `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - For billing
- `MOCK_LLM` - Set to "true" for testing without API calls

### Database Setup

The application uses Supabase for data persistence. Database migrations are located in:
- `supabase/migrations/` - Supabase-specific migrations
- `migrations/` - Application-level migrations

Run migrations through your Supabase dashboard or CLI.

## Deployment

The application is designed for deployment on:
- **Frontend**: Vercel (configured via `vercel.json`)
- **Backend**: Any platform supporting Python/FastAPI (Render, Railway, etc.)

Ensure all environment variables are configured in your deployment platform.

## API Endpoints

### Core System
- `GET /health` - Health check endpoint
- `GET /` - Root health check

### Conversations
- `GET /api/conversations` - List conversations (with search, filters, sorting)
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/{id}` - Get conversation details
- `POST /api/conversations/{id}/message` - Send message (full council)
- `POST /api/conversations/{id}/message/stream` - Send message with streaming
- `POST /api/conversations/{id}/chat/stream` - Chat with Chairman only
- `POST /api/conversations/{id}/star` - Star/unstar conversation
- `POST /api/conversations/{id}/archive` - Archive/unarchive conversation
- `DELETE /api/conversations/{id}` - Delete conversation
- `POST /api/conversations/bulk-delete` - Bulk delete conversations
- `GET /api/conversations/{id}/export` - Export conversation as markdown

### Companies & Projects
- `GET /api/companies/{id}/projects` - List company projects
- `POST /api/companies/{id}/projects` - Create project
- `GET /api/projects/{id}` - Get project details
- `POST /api/projects/extract` - Extract knowledge from project conversations
- `GET /api/projects/{id}/report` - Generate project report

### Company Management (via company router)
- `GET /api/company/{id}/overview` - Get company overview
- `PUT /api/company/{id}/context` - Update company context
- `GET /api/company/{id}/team` - List team members
- `POST /api/company/{id}/departments` - Create department
- `PUT /api/company/{id}/departments/{dept_id}` - Update department
- `POST /api/company/{id}/departments/{dept_id}/roles` - Create role
- `PUT /api/company/{id}/departments/{dept_id}/roles/{role_id}` - Update role
- `GET /api/company/{id}/departments/{dept_id}/roles/{role_id}` - Get role details

### Playbooks (SOPs, Frameworks, Policies)
- `GET /api/company/{id}/playbooks` - List playbooks (with filters)
- `GET /api/company/{id}/playbooks/tags` - Get all playbook tags
- `POST /api/company/{id}/playbooks` - Create playbook
- `PUT /api/company/{id}/playbooks/{playbook_id}` - Update playbook
- `DELETE /api/company/{id}/playbooks/{playbook_id}` - Delete playbook

### Decisions & Technology
- `GET /api/company/{id}/decisions` - List decisions (with filters)
- `POST /api/company/{id}/decisions` - Create decision
- `POST /api/company/{id}/decisions/{decision_id}/promote` - Promote to playbook
- `GET /api/company/{id}/decisions/{decision_id}` - Get decision details
- `POST /api/company/{id}/decisions/{decision_id}/archive` - Archive decision
- `DELETE /api/company/{id}/decisions/{decision_id}` - Delete decision

### Activity & History
- `GET /api/company/{id}/activity` - Get activity log
- `GET /api/conversations/{id}/curator-history` - Get curation history
- `POST /api/conversations/{id}/curator-history` - Save curation history

### Business Context
- `GET /api/businesses` - List available businesses
- `POST /api/businesses/{id}/departments` - Create department
- `POST /api/businesses/{id}/sync-org` - Sync organization from files
- `PUT /api/businesses/{id}/departments/{dept_id}` - Update department
- `POST /api/businesses/{id}/departments/{dept_id}/roles` - Create role
- `PUT /api/businesses/{id}/departments/{dept_id}/roles/{role_id}` - Update role
- `GET /api/businesses/{id}/departments/{dept_id}/roles/{role_id}/context` - Get role context
- `GET /api/context/{id}/section/{section}` - Get context section
- `POST /api/context/apply-suggestion` - Apply context suggestion
- `GET /api/context/{id}/last-updated` - Get last update timestamp

### Triage & Analysis
- `POST /api/triage/analyze` - Analyze message for triage
- `POST /api/triage/continue` - Continue with triaged message

### Curation
- `POST /api/conversations/{id}/curate` - Curate conversation context

### Knowledge Base
- `POST /api/knowledge` - Save knowledge entry
- `GET /api/knowledge/{company_id}` - List knowledge entries
- `GET /api/conversations/{id}/knowledge-count` - Count knowledge entries
- `DELETE /api/knowledge/{entry_id}` - Delete knowledge entry
- `POST /api/knowledge/extract` - Extract knowledge from conversation

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard data
- `GET /api/leaderboard/overall` - Get overall rankings
- `GET /api/leaderboard/department/{dept}` - Get department rankings

### Billing (Stripe Integration)
- `GET /api/billing/plans` - List available plans
- `GET /api/billing/subscription` - Get user subscription
- `GET /api/billing/can-query` - Check if user can query
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Access billing portal
- `POST /api/billing/webhook` - Stripe webhook handler

### User Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

### Attachments & Images
- `POST /api/attachments/upload` - Upload attachment
- `GET /api/attachments/{id}` - Get attachment metadata
- `GET /api/attachments/{id}/url` - Get attachment download URL
- `DELETE /api/attachments/{id}` - Delete attachment

### Settings
- `GET /api/settings/mock-mode` - Get mock mode status
- `POST /api/settings/mock-mode` - Toggle mock mode

### Utilities
- `POST /api/utils/polish-text` - Polish text with AI

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with AI assistance using Claude Code.
