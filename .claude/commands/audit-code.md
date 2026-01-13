# Code Quality Audit - Enterprise-Grade Standards

You are a principal engineer conducting a code review for a codebase that must pass due diligence for a $25M+ valuation. The code should exemplify best practices that would impress engineers from Stripe, Google, or Netflix.

**Standard**: Code should be so clean that any engineer can understand, modify, and extend it confidently.

**Scope**: This audit focuses on CODE QUALITY ONLY. Other specialized audits cover:
- UI/CSS → `/audit-ui`
- Accessibility → `/audit-a11y`
- Performance/Bundle → `/audit-performance`
- Database/RLS → `/audit-data-architecture`
- API Governance → `/audit-api-governance`
- Testing → `/audit-test-coverage`
- Security → `/audit-security`
- DevOps/CI/CD → `/audit-devops`

---

## Phase 0: Review Existing CI/CD Results (Already Automated!)

**Your project already has extensive automated checks. Review these FIRST:**

### CI/CD Workflows (GitHub Actions)

**View latest CI results:**
```bash
# List recent CI runs
gh run list --repo BuDozKeN/AI-council --limit 5

# View specific run details
gh run view <run-id>

# View failed jobs
gh run view <run-id> --log-failed
```

**What's already checked in CI:**
- ✅ **ESLint** (.github/workflows/ci.yml:52-54) - `npm run lint`
- ✅ **TypeScript** (.github/workflows/ci.yml:56-58) - `npm run type-check`
- ✅ **Prettier** (.github/workflows/ci.yml:60-62) - `npm run format:check`
- ✅ **Frontend Tests** (.github/workflows/ci.yml:64-66) - Vitest with coverage
- ✅ **Backend Tests** (.github/workflows/ci.yml:28-31) - Pytest with 40% coverage
- ✅ **E2E Tests** (.github/workflows/ci.yml:72-106) - Playwright
- ✅ **Build** (.github/workflows/ci.yml:68-70) - Production build
- ✅ **Bandit** (.github/workflows/security.yml:41-73) - Python security scan
- ✅ **npm audit** (.github/workflows/security.yml:108-128) - Frontend vulnerabilities
- ✅ **pip-audit** (.github/workflows/security.yml:131-160) - Backend vulnerabilities
- ✅ **Gitleaks** (.github/workflows/security.yml:76-90) - Secret scanning
- ✅ **CodeQL** (.github/workflows/security.yml:18-38) - SAST analysis

### Git Hooks (Local Automation)

**Pre-commit hook (.husky/pre-commit):**
- Auto-fixes ESLint + Prettier on changed files (lint-staged)

**Pre-push hook (.husky/pre-push):**
- Runs ESLint, TypeScript, Vitest, Pytest before every push
- Prevents broken code from reaching CI

**To run manually:**
```bash
# Trigger pre-commit on all files
cd frontend && npx lint-staged

# Trigger pre-push checks
.husky/pre-push
```

---

## Phase 1: Additional Quality Checks (NOT in CI)

**These checks add value beyond existing automation:**

### Frontend Additional Checks
```bash
cd frontend
mkdir -p ../audit-results

# 1. Complexity analysis (cyclomatic + cognitive)
echo "📊 Analyzing code complexity..."
npx ts-complexity src/**/*.{ts,tsx} --threshold 10 --format table \
  2>&1 | tee ../audit-results/complexity-frontend.txt

# 2. Code duplication detection
echo "🔍 Detecting code duplication..."
npx jscpd src/ --min-lines 10 --min-tokens 50 --format markdown \
  > ../audit-results/duplication-frontend.md

# 3. CSS linting (not enforced in CI)
echo "🎨 Linting CSS..."
npm run lint:css 2>&1 | tee ../audit-results/stylelint.log

# 4. Find console.log/debugger statements
echo "🪲 Finding debug statements..."
grep -rn "console\\.log\|console\\.warn\|console\\.error\|debugger" src/ \
  --exclude-dir=node_modules --exclude="*.test.*" --exclude="*.spec.*" \
  > ../audit-results/console-statements.txt || echo "No console.log found ✅"
```

### Backend Additional Checks
```bash
cd ..

# 1. Type checking with mypy (stricter than current setup)
echo "📘 Running mypy type checking..."
pip install mypy types-redis types-requests 2>/dev/null
mypy backend/ --strict --no-error-summary 2>&1 | tee audit-results/mypy.log || true

# 2. Linting with Ruff (faster, more comprehensive than flake8)
echo "🔧 Running Ruff linter..."
pip install ruff 2>/dev/null
ruff check backend/ --output-format=grouped 2>&1 | tee audit-results/ruff.log || true

# 3. Complexity analysis (Radon)
echo "📊 Analyzing code complexity..."
pip install radon 2>/dev/null
radon cc backend/ -a -nb --total-average 2>&1 | tee audit-results/complexity-backend.log
radon mi backend/ -nb 2>&1 | tee audit-results/maintainability.log

# 4. Duplicate code detection
echo "🔍 Detecting code duplication..."
pip install pylint 2>/dev/null
pylint backend/ --disable=all --enable=duplicate-code --min-similarity-lines=10 \
  2>&1 | tee audit-results/duplication-backend.log || true

# 5. Find print() statements (should use logger)
echo "🪲 Finding print statements..."
grep -rn "print(" backend/ --exclude-dir=__pycache__ --exclude-dir=tests \
  > audit-results/print-statements.txt || echo "No print() found ✅"
```

### Automated Metrics Summary
After running scans, report these metrics:

| Metric | Source | Current | Target | Status |
|--------|--------|---------|--------|--------|
| TypeScript errors | CI (already checked) | ? | 0 | ❌/✅ |
| ESLint errors | CI (already checked) | ? | 0 | ❌/✅ |
| ESLint warnings | CI (already checked) | ? | <10 | ❌/✅ |
| Stylelint errors | **NEW** | ? | 0 | ❌/✅ |
| Functions complexity >10 | **NEW** | ? | 0 | ❌/✅ |
| Functions complexity >15 | **NEW** | ? | 0 | ❌/✅ |
| Code duplication % | **NEW** | ? | <3% | ❌/✅ |
| mypy type errors | **NEW** | ? | 0 | ❌/✅ |
| Ruff violations | **NEW** | ? | 0 | ❌/✅ |
| console.log statements | **NEW** | ? | 0 | ❌/✅ |
| print() statements | **NEW** | ? | 0 | ❌/✅ |
| Backend maintainability | **NEW** | ? | >65 | ❌/✅ |

---

## Phase 2: Manual Code Review Checklist

### 1. Architecture & Structure
```
Check for:
- [ ] Clear separation of concerns
- [ ] Consistent file/folder organization
- [ ] Logical module boundaries
- [ ] No circular dependencies
- [ ] Appropriate abstraction levels
- [ ] Domain-driven design principles
- [ ] Scalable patterns (not over-engineered)
```

### 2. TypeScript Excellence (Frontend)
```
Check for:
- [ ] Strict mode enabled
- [ ] No `any` types (or justified exceptions)
- [ ] Proper interface/type definitions
- [ ] Generic types where reusable
- [ ] Discriminated unions for state
- [ ] Proper null/undefined handling
- [ ] Type guards where needed
- [ ] Exhaustive switch statements
```

### 3. Python Excellence (Backend)
```
Check for:
- [ ] Type hints on all functions
- [ ] Pydantic models for validation
- [ ] Proper async/await patterns
- [ ] Context managers for resources
- [ ] Exception handling best practices
- [ ] Docstrings on public functions
- [ ] No mutable default arguments
- [ ] Proper dependency injection
```

### 4. React Best Practices
```
Check for:
- [ ] Functional components throughout
- [ ] Proper hook usage (deps arrays correct)
- [ ] No unnecessary re-renders
- [ ] Proper key usage in lists
- [ ] Error boundaries implemented
- [ ] Suspense for lazy loading
- [ ] Context used appropriately (not over-used)
- [ ] Custom hooks for reusable logic
- [ ] Proper cleanup in useEffect
```

### 5. State Management
```
Check for:
- [ ] TanStack Query for server state
- [ ] React Context for global UI state
- [ ] Local state where appropriate
- [ ] No prop drilling (use context/composition)
- [ ] Proper cache invalidation
- [ ] Optimistic updates where helpful
- [ ] No duplicate state (single source of truth)
```

### 6. API Design (Backend)
```
Check for:
- [ ] RESTful conventions followed
- [ ] Consistent response formats
- [ ] Proper HTTP status codes
- [ ] Pagination for list endpoints
- [ ] Rate limiting implemented
- [ ] Versioning strategy (if needed)
- [ ] Proper error responses
- [ ] OpenAPI/Swagger documentation
```

### 7. Error Handling
```
Check for:
- [ ] Try/catch at appropriate boundaries
- [ ] Errors are logged with context
- [ ] User-facing errors are helpful
- [ ] System errors don't leak internals
- [ ] Retry logic for transient failures
- [ ] Circuit breakers for external services
- [ ] Graceful degradation
- [ ] Error boundaries in React
```

### 8. Testing Coverage
```
Check for:
- [ ] Unit tests for business logic
- [ ] Integration tests for API endpoints
- [ ] Component tests for UI
- [ ] Mock external dependencies
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] No flaky tests
- [ ] Reasonable coverage percentage
```

### 9. Code Cleanliness
```
Check for:
- [ ] No commented-out code
- [ ] No console.log/print in production (automated: grep)
- [ ] No TODO/FIXME without GitHub issues
- [ ] No dead code paths (unreachable code)
- [ ] No magic numbers (use named constants)
- [ ] Meaningful variable names (no single letters except i, x, y)
- [ ] Functions do one thing (Single Responsibility)
- [ ] Max 100-150 lines per function (ideally <50)
- [ ] No copy-paste code (see duplication report)
```

### 10. Code Duplication (DRY Violations)
```
Check for:
- [ ] Duplicated code blocks >10 lines (automated: jscpd/pylint)
- [ ] Similar functions that should be abstracted
- [ ] Copy-paste patterns across components
- [ ] Repeated logic in hooks that should be shared
- [ ] Duplicated API endpoint patterns
- [ ] Repeated validation logic (should use Pydantic schemas)
- [ ] Similar components that should use composition

**Automated Detection:**
- Frontend: jscpd with --min-lines=10 --min-tokens=50
- Backend: pylint duplicate-code with --min-similarity-lines=10

**Thresholds:**
- <3% duplication: Excellent ✅
- 3-5% duplication: Acceptable ⚠️
- >5% duplication: Needs refactoring ❌
```

### 11. Complexity Metrics & Thresholds
```
**Enforced Complexity Thresholds:**

FAIL (Must fix):
- Cyclomatic complexity >15 per function
- Cognitive complexity >20 per function
- Function length >100 lines
- File length >500 lines
- Nesting depth >4 levels
- Function parameters >5

WARNING (Should fix):
- Cyclomatic complexity 10-15
- Cognitive complexity 15-20
- Function length 50-100 lines
- File length 300-500 lines
- Nesting depth 3-4 levels
- Function parameters 4-5

**Automated Detection:**
- Frontend: ts-complexity (cyclomatic + cognitive)
- Backend: radon cc (cyclomatic complexity)
- Backend: radon mi (maintainability index, target >65)

**Example violations:**
❌ council.py::process_council() - 180 lines, complexity 18
❌ ChatInterface.tsx - 420 lines, should split into smaller components
```

### 12. Maintainability
```
Check for:
- [ ] Self-documenting code
- [ ] Comments explain "why" not "what"
- [ ] Consistent naming conventions
- [ ] Linting rules enforced
- [ ] Formatting consistent (Prettier)
- [ ] Easy to onboard new developers
- [ ] Changes are low-risk
- [ ] Technical debt documented
```

## Files to Review

### Frontend Priority
1. `frontend/src/contexts/` - State management
2. `frontend/src/hooks/` - Custom hooks
3. `frontend/src/components/chat/` - Core functionality
4. `frontend/src/lib/` - Utilities
5. `frontend/src/types/` - Type definitions

### Backend Priority
1. `backend/auth.py` - Authentication
2. `backend/security.py` - Security utilities
3. `backend/council.py` - Core business logic
4. `backend/routers/` - API endpoints
5. `backend/database.py` - Data access

### Configuration
1. `tsconfig.json` - TypeScript config
2. `eslint.config.js` - Linting rules
3. `pyproject.toml` - Python config
4. `vite.config.js` - Build config

## Code Smell Detection

### High Priority Smells
- Long functions (>50 lines)
- Deep nesting (>3 levels)
- Large files (>300 lines)
- Complex conditionals
- Repeated code blocks
- God objects/components
- Feature envy
- Primitive obsession

### Anti-Patterns to Find
- Callback hell
- Prop drilling
- Mutation of props/state
- Side effects in render
- Unhandled promises
- Race conditions
- Memory leaks
- Tight coupling

## Cross-Audit References

If you find issues outside code quality scope, reference these audits:

| Issue Type | Use This Audit |
|------------|---------------|
| CSS hardcoded values, design tokens | `/audit-ui` |
| ARIA, keyboard nav, focus management | `/audit-a11y` |
| Bundle size, lazy loading, Core Web Vitals | `/audit-performance` |
| RLS policies, migrations, indexes | `/audit-data-architecture` |
| API versioning, pagination, error format | `/audit-api-governance` |
| Test coverage, E2E tests, mutation testing | `/audit-test-coverage` |
| SQL injection, XSS, secrets, auth | `/audit-security` |
| CI/CD, deployments, monitoring, secrets | `/audit-devops` |

---

## Output Format

### Code Quality Score: [1-10]
### Maintainability Score: [1-10]
### Complexity Score: [1-10] (based on avg cyclomatic complexity)
### Type Safety Score: [1-10] (based on % without `any` types)

### Automated Metrics Summary
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| TypeScript errors | X | 0 | ❌/✅ |
| ESLint errors/warnings | X / X | 0 / <10 | ❌/✅ |
| Avg cyclomatic complexity | X | <5 | ❌/✅ |
| Functions complexity >15 | X | 0 | ❌/✅ |
| Code duplication % | X% | <3% | ❌/✅ |
| `any` types count | X | 0 | ❌/✅ |
| console.log statements | X | 0 | ❌/✅ |
| Python type hints % | X% | >90% | ❌/✅ |
| Backend maintainability index | X | >65 | ❌/✅ |

### Critical Issues (Must Fix)
| File | Issue | Line(s) | Impact | Fix |
|------|-------|---------|--------|-----|
| path/to/file.ts | 5 uses of `any` type | 10, 25, 42, 67, 89 | Type safety compromised | Add proper types |
| backend/council.py | Function too long (180 lines) | 50-230 | Hard to maintain | Extract into smaller functions |

### Code Smells
| File | Smell | Severity | Refactoring Suggestion |
|------|-------|----------|------------------------|
| ChatInterface.tsx | God component (420 lines) | High | Split into ChatInput, ChatMessages, ChatStages |
| api.ts | Duplicate error handling | Medium | Extract to handleApiError() utility |

### Complexity Report
| File | Function | Cyclomatic | Cognitive | Lines | Action |
|------|----------|------------|-----------|-------|--------|
| council.py | process_council | 18 | 25 | 180 | REFACTOR |
| useMessageStreaming.ts | handleStream | 12 | 16 | 95 | REVIEW |

### Code Duplication Report
| Files | Lines | Similarity | Location | Action |
|-------|-------|------------|----------|--------|
| CompanyForm.tsx ↔ DepartmentForm.tsx | 25 | 92% | Form validation logic | ABSTRACT to useFormValidation hook |
| api.ts ↔ supabase.ts | 15 | 88% | Error handling | CREATE shared handleError() |

### Type Safety Gaps
| File | Issue | Risk | Fix |
|------|-------|------|-----|
| api.ts | `any` used for API responses | Runtime errors | Define ResponseTypes interfaces |
| hooks/useTriage.ts | No return type specified | Inference breaks easily | Add explicit return type |

### Dead Code & Cleanup
| File | Issue | Lines | Action |
|------|-------|-------|--------|
| utils/legacy.ts | Entire file unused | 150 | DELETE |
| ChatInterface.tsx | Commented code | 45-67 | DELETE |
| council.py | `print()` statements | 12, 34, 89 | REPLACE with logger |

### Architecture Issues
| Pattern | Current State | Recommended | Effort |
|---------|---------------|-------------|--------|
| Error handling | Inconsistent try/catch | Centralized error boundary | Medium |
| State management | Mixed useState + Context | Consolidate to Context | High |

### Technical Debt
| Area | Debt Description | Effort to Fix | Risk if Ignored |
|------|------------------|---------------|-----------------|
| Type safety | 47 uses of `any` type | 2-3 days | Runtime errors, harder debugging |
| Code duplication | 8.2% duplicate code | 1 week | Maintenance burden, bug propagation |

### Recommendations Priority
1. **Immediate** (Blocking code quality)
   - Fix all TypeScript errors (currently 12)
   - Remove all console.log statements (currently 23)
   - Refactor functions with complexity >15 (currently 5)

2. **Short-term** (Code health)
   - Reduce code duplication from 8.2% to <3%
   - Add type annotations to remove `any` types
   - Split large files (>300 lines) into smaller modules

3. **Long-term** (Architecture improvements)
   - Standardize error handling patterns
   - Create shared validation utilities
   - Document complex algorithms

### Files Needing Immediate Attention
| File | Issues | Priority | Effort |
|------|--------|----------|--------|
| backend/council.py | High complexity, long functions | High | 1 day |
| frontend/src/components/chat/ChatInterface.tsx | God component, 420 lines | High | 2 days |
| frontend/src/lib/api.ts | 12 uses of `any` | Medium | 4 hours |

---

## Quick Start Script

Create this script as `scripts/audit-code.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Running Code Quality Audit (Beyond CI/CD)"
echo "=============================================="
echo ""

# Step 0: Check CI status
echo "📋 Phase 0: Checking CI/CD status..."
if command -v gh &> /dev/null; then
  echo "Latest CI runs:"
  gh run list --repo BuDozKeN/AI-council --limit 3 || echo "⚠️ Install GitHub CLI for CI status"
else
  echo "⚠️ Install GitHub CLI to view CI status: https://cli.github.com"
fi
echo ""

# Create results directory
mkdir -p audit-results

# Step 1: Frontend additional checks
echo "📊 Phase 1: Frontend Additional Checks..."
cd frontend

echo "  → Complexity analysis..."
npx ts-complexity src/**/*.{ts,tsx} --threshold 10 --format table \
  2>&1 | tee ../audit-results/complexity-frontend.txt || true

echo "  → Code duplication detection..."
npx jscpd src/ --min-lines 10 --min-tokens 50 --format markdown \
  > ../audit-results/duplication-frontend.md || true

echo "  → CSS linting..."
npm run lint:css 2>&1 | tee ../audit-results/stylelint.log || true

echo "  → Finding console.log statements..."
grep -rn "console\\.log\|console\\.warn\|console\\.error\|debugger" src/ \
  --exclude-dir=node_modules --exclude="*.test.*" --exclude="*.spec.*" \
  > ../audit-results/console-statements.txt || echo "  ✅ No console.log found"

cd ..

# Step 2: Backend additional checks
echo ""
echo "🐍 Phase 1: Backend Additional Checks..."

echo "  → Installing tools (if needed)..."
pip install -q mypy types-redis types-requests ruff radon pylint 2>/dev/null || true

echo "  → mypy type checking..."
mypy backend/ --strict --no-error-summary 2>&1 | tee audit-results/mypy.log || true

echo "  → Ruff linting..."
ruff check backend/ --output-format=grouped 2>&1 | tee audit-results/ruff.log || true

echo "  → Complexity analysis..."
radon cc backend/ -a -nb --total-average 2>&1 | tee audit-results/complexity-backend.log || true
radon mi backend/ -nb 2>&1 | tee audit-results/maintainability.log || true

echo "  → Code duplication detection..."
pylint backend/ --disable=all --enable=duplicate-code --min-similarity-lines=10 \
  2>&1 | tee audit-results/duplication-backend.log || true

echo "  → Finding print() statements..."
grep -rn "print(" backend/ --exclude-dir=__pycache__ --exclude-dir=tests \
  > audit-results/print-statements.txt || echo "  ✅ No print() found"

echo ""
echo "✅ Audit complete! Results in audit-results/"
echo "📋 Next: Run '/audit-code' in Claude to analyze results"
echo ""
echo "💡 Tip: CI/CD already checks TypeScript, ESLint, Prettier, Tests, Security"
echo "   This audit adds complexity, duplication, mypy, and ruff analysis"
```

---

Remember: Good code is not clever code. Good code is obvious, boring, and maintainable.

**After this audit:** Run specialized audits for UI, performance, security, etc.
