# AI Council Frontend

React 19 frontend application for the AI Council platform.

## Technology Stack

- **React 19** with Vite for fast development
- **Radix UI** for accessible, unstyled UI primitives
- **Tailwind CSS 4** for styling
- **Supabase** for authentication and real-time features
- **React Markdown** with remark-gfm for markdown rendering
- **Framer Motion** for animations
- **Lucide React** for icons
- **Sonner** for toast notifications
- **next-themes** for dark/light theme support

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/           # React components
│   ├── ChatInterface.jsx    # Main chat interface
│   ├── MyCompany.jsx        # Company management
│   ├── Sidebar.jsx          # Navigation sidebar
│   ├── CuratorPanel.jsx     # Context curation
│   ├── KnowledgeBase.jsx    # Knowledge management
│   └── ui/                  # Reusable UI components
│       ├── DepartmentSelect.jsx
│       ├── select.jsx
│       ├── dialog.jsx
│       └── button.jsx
├── lib/                  # Utilities
│   ├── DESIGN_SYSTEM.md     # Design system documentation
│   ├── colors.js            # Color utilities
│   ├── smartTextToMarkdown.js
│   └── utils.js
├── api.js                # API client
└── App.jsx               # Root component
```

## Design System

See [DESIGN_SYSTEM.md](./src/lib/DESIGN_SYSTEM.md) for comprehensive design guidelines including:
- Color philosophy and palettes
- Department and playbook type colors
- Component patterns (cards, modals, buttons, etc.)
- Typography scale
- Spacing system
- Animation guidelines

## Key Features

- **Real-time Streaming**: Live AI responses with streaming support
- **Multi-stage Council**: Visual representation of triage, responses, and synthesis
- **Context Management**: Company, project, and department context
- **Knowledge Base**: Save and organize conversation insights
- **Image Upload**: Support for image attachments and analysis
- **Responsive Design**: Works on desktop and mobile devices
- **Theme Support**: Dark and light themes

## Environment Variables

The frontend requires backend API endpoints. The API base URL is configured in `src/api.js`:

```javascript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
```

**Note:** By default, the frontend expects the backend on port 8080, but the backend's `main.py` runs on port 8001 by default. To fix this:

**Option 1:** Set `VITE_API_URL` environment variable:
```bash
# In frontend/.env or frontend/.env.local
VITE_API_URL=http://localhost:8001
```

**Option 2:** Run the backend on port 8080:
```bash
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080
```

For Supabase authentication, you'll need to configure your Supabase project URL and anon key in the frontend code.

## Development Tips

- Use the design system colors from `lib/colors.js` instead of hardcoding colors
- Follow the component patterns documented in `DESIGN_SYSTEM.md`
- Test with both dark and light themes
- Ensure all components are accessible (use Radix UI primitives)
