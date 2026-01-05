# Contributing to AxCouncil

Thank you for your interest in contributing to AxCouncil! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Commit Messages](#commit-messages)

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

---

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AI-council.git
   cd AI-council
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/BuDozKeN/AI-council.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Setup

### Prerequisites

- Node.js v18+
- Python 3.10+
- Git
- Google Chrome (for MCP DevTools)

### Installation

```bash
# Frontend dependencies
cd frontend
npm install
cd ..

# Backend dependencies
pip install -e ".[dev]"

# Pre-commit hooks (recommended)
pre-commit install
```

### Running Locally

**Windows (recommended):**
```bash
dev.bat
```

**Manual:**
```bash
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Backend
python -m backend.main
```

See [CLAUDE.md](CLAUDE.md) for detailed setup instructions.

---

## Code Style

### Frontend (TypeScript/React)

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (runs on commit via lint-staged)
- **Linting**: ESLint with recommended rules
- **Styling**: Tailwind CSS + CSS variables from design tokens

```bash
# Check linting
cd frontend && npm run lint

# Check types
npm run type-check

# Format code
npm run format
```

**Key conventions:**
- Use CSS variables for colors, spacing, radius (never hardcode)
- Use semantic tokens from `frontend/src/styles/tailwind.css`
- Prefer Tailwind utilities for layout
- Support both light and dark modes

### Backend (Python)

- **Python**: 3.10+ with type hints
- **Formatting**: Black (88 char line length)
- **Linting**: Ruff
- **Imports**: isort

```bash
# Format
black backend/

# Lint
ruff check backend/

# Sort imports
isort backend/
```

**Key conventions:**
- Use `pathlib.Path` for file operations
- Use async/await for all database operations
- Use `get_supabase_with_auth()` for user-scoped queries
- Never log sensitive data (use `mask_*` functions)

---

## Making Changes

### Before You Start

1. **Check existing issues** - Your idea may already be discussed
2. **Open an issue first** for major changes to discuss the approach
3. **Keep changes focused** - One feature/fix per PR

### Branch Naming

Use descriptive branch names:
- `feature/add-dark-mode`
- `fix/login-redirect-loop`
- `docs/update-readme`
- `refactor/simplify-auth-flow`

### File Organization

```
AI-council/
├── frontend/src/
│   ├── components/     # React components
│   │   ├── ui/         # Reusable UI primitives
│   │   └── ...         # Feature components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities
│   ├── styles/         # CSS and design tokens
│   └── contexts/       # React contexts
├── backend/
│   ├── routers/        # API endpoints
│   ├── utils/          # Helper functions
│   └── migrations/     # Database migrations
└── supabase/
    └── migrations/     # Supabase SQL migrations
```

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

2. **Run all checks**:
   ```bash
   # Frontend
   cd frontend
   npm run lint
   npm run type-check
   npm run test:run

   # Backend
   cd ..
   black --check backend/
   ruff check backend/
   ```

3. **Test your changes** manually in the browser

### PR Requirements

- [ ] Clear title describing the change
- [ ] Description explaining what and why
- [ ] Link to related issue (if applicable)
- [ ] All CI checks passing
- [ ] No merge conflicts with master
- [ ] Screenshots for UI changes

### PR Title Format

```
type: brief description

Examples:
feat: add dark mode toggle
fix: resolve login redirect loop
docs: update API documentation
refactor: simplify authentication flow
test: add unit tests for council.py
chore: update dependencies
```

### Review Process

1. **Automated checks** run on every PR
2. **Code review** by maintainers
3. **Address feedback** with new commits (don't force push)
4. **Squash and merge** once approved

---

## Testing Requirements

### Frontend

```bash
cd frontend

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# With coverage
npm run test:coverage
```

- Write tests for new components in `*.test.tsx` files
- Use Vitest + Testing Library
- Mock API calls with MSW

### Backend

```bash
# Run tests
pytest backend/tests/

# With coverage
pytest --cov=backend backend/tests/
```

- Write tests for new endpoints
- Test both success and error cases
- Mock external services (OpenRouter, Supabase)

### What to Test

- **Must test**: New API endpoints, business logic, security-sensitive code
- **Should test**: UI components with complex logic
- **Nice to have**: Integration tests, E2E tests

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no feature/fix |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```
feat(auth): add Google OAuth login

fix(sidebar): prevent conversation list overflow

docs: add API endpoint documentation

refactor(council): simplify stage 2 ranking logic

test(knowledge): add unit tests for entry creation
```

---

## Getting Help

- **Questions?** Open a [Discussion](https://github.com/BuDozKeN/AI-council/discussions)
- **Found a bug?** Open an [Issue](https://github.com/BuDozKeN/AI-council/issues)
- **Security issue?** See [SECURITY.md](docs/SECURITY.md) for responsible disclosure

---

## Recognition

Contributors are recognized in:
- Release notes
- README contributors section (coming soon)

Thank you for contributing to AxCouncil!
