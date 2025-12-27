# Code Quality Audit - Enterprise-Grade Standards

You are a principal engineer conducting a code review for a codebase that must pass due diligence for a $25M+ valuation. The code should exemplify best practices that would impress engineers from Stripe, Google, or Netflix.

**Standard**: Code should be so clean that any engineer can understand, modify, and extend it confidently.

## Code Quality Checklist

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
- [ ] No console.log/print in production
- [ ] No TODO/FIXME without issues
- [ ] No dead code paths
- [ ] No magic numbers (use constants)
- [ ] Meaningful variable names
- [ ] Functions do one thing
- [ ] Max 100-150 lines per file (ideally)
```

### 10. Performance Patterns
```
Check for:
- [ ] Database queries are efficient
- [ ] N+1 queries avoided
- [ ] Caching implemented correctly
- [ ] Lazy loading where appropriate
- [ ] Memoization for expensive operations
- [ ] Bundle size optimized
- [ ] No memory leaks
- [ ] Efficient data structures
```

### 11. Security in Code
```
Check for:
- [ ] Input validation on all endpoints
- [ ] Output encoding (XSS prevention)
- [ ] Parameterized queries (SQL injection)
- [ ] Proper authentication checks
- [ ] Authorization on every endpoint
- [ ] No sensitive data in logs
- [ ] Secrets not in code
- [ ] Dependency vulnerabilities
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

## Output Format

### Code Quality Score: [1-10]
### Maintainability Score: [1-10]

### Critical Issues
| File | Issue | Line(s) | Impact | Fix |
|------|-------|---------|--------|-----|

### Code Smells
| File | Smell | Severity | Refactoring Suggestion |
|------|-------|----------|------------------------|

### Type Safety Gaps
| File | Issue | Risk | Fix |
|------|-------|------|-----|

### Missing Tests
| Component/Function | Risk if Untested | Priority |
|--------------------|------------------|----------|

### Performance Issues
| Location | Issue | Impact | Optimization |
|----------|-------|--------|--------------|

### Technical Debt
| Area | Debt Description | Effort to Fix | Risk if Ignored |
|------|------------------|---------------|-----------------|

### Recommendations
1. **Immediate** (Bugs/security risks)
2. **Short-term** (Code health)
3. **Long-term** (Architecture improvements)

---

Remember: Good code is not clever code. Good code is obvious, boring, and maintainable.
