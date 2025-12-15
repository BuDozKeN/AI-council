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

### UI/UX
- **Modern Design System**: Radix UI components with consistent styling
- **Responsive Layout**: Sidebar navigation with collapsible conversation groups
- **Markdown Rendering**: Full markdown support with syntax highlighting
- **Real-time Updates**: Live streaming responses with progress indicators

## Tech Stack

### Frontend
- **React 18** with Vite
- **Radix UI** for accessible components (Select, Dialog, etc.)
- **Tailwind CSS** for styling
- **React Markdown** for content rendering

### Backend
- **FastAPI** (Python)
- **OpenRouter API** for multi-model access
- **SQLite** with SQLAlchemy for persistence

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- OpenRouter API key

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

   # Set environment variables
   export OPENROUTER_API_KEY=your_api_key_here
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start the Backend**
   ```bash
   python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:8000/docs

## Project Structure

```
AI-council/
├── backend/
│   ├── main.py           # FastAPI application entry
│   ├── openrouter.py     # OpenRouter API integration
│   ├── models.py         # SQLAlchemy models
│   ├── database.py       # Database configuration
│   └── routers/          # API route handlers
│       ├── company.py    # Company/project/department APIs
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── ChatInterface.jsx
│   │   │   ├── MyCompany.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── ui/       # Reusable UI components
│   │   ├── lib/          # Utilities and design system
│   │   └── api.js        # API client
│   └── package.json
├── councils/
│   ├── departments/      # Department configurations
│   ├── organisations/    # Organization-specific context
│   ├── outputs/          # Output templates
│   └── styles/           # Writing styles
└── knowledge-base/       # Exported conversations
```

## Design System

The application follows a consistent design system documented in `frontend/src/lib/DESIGN_SYSTEM.md`:

- **Colors**: Orange/amber primary, gray neutrals, semantic colors
- **Border Radius**: 12px for dropdowns/cards, 8px for items, 16px for pills
- **Shadows**: Consistent elevation system
- **Typography**: Inter/system fonts with defined scale

## API Endpoints

### Conversations
- `GET /conversations` - List conversations
- `POST /conversations` - Create new conversation
- `POST /conversations/{id}/message` - Send message

### Companies
- `GET /companies` - List companies
- `POST /companies` - Create company
- `GET /companies/{id}/projects` - List company projects
- `POST /companies/{id}/projects` - Create project

### Departments
- `GET /departments` - List departments
- `GET /departments/{id}/roles` - List department roles
- `GET /departments/{id}/channels` - List department channels

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with AI assistance using Claude Code.
