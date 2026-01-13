# Code Quality Audit - Action Plan

**Generated**: 2026-01-13
**Priority**: 🔴 HIGH - Blocking enterprise acquisition readiness

---

## Executive Summary

**Critical Finding**: 2 functions with EXTREME complexity (F-grade, >41 cyclomatic complexity) + 100+ type errors

**Recommendation**: Dedicate 2-week sprint to address critical issues before proceeding with acquisition discussions.

---

## Week 1: Critical Fixes (40 hours)

### 🔴 Priority 1: Refactor F-Grade Functions (24 hours)

#### Task 1.1: Refactor `get_system_prompt_with_context` (12h)
**File**: `backend/context_loader.py:1227`
**Complexity**: F-grade (>41 decision points)
**Risk**: HIGH - Core prompt generation logic

**Approach**:
1. Write characterization tests to capture current behavior
2. Extract into smaller functions:
   - `_build_base_context()` - Base system prompt
   - `_add_company_context()` - Company-specific context
   - `_add_department_context()` - Department context
   - `_add_playbooks_context()` - Playbook/SOP context
   - `_add_knowledge_context()` - Knowledge base context
   - `get_system_prompt_with_context()` - Orchestrator (target <15 complexity)
3. Add unit tests for each extracted function
4. Validate with E2E tests

**Acceptance Criteria**:
- [ ] Main function complexity <15 (C-grade or better)
- [ ] 5+ extracted helper functions with <10 complexity each
- [ ] 90%+ test coverage on refactored code
- [ ] All existing E2E tests pass

#### Task 1.2: Refactor `ai_write_assist` (12h)
**File**: `backend/routers/ai_utils.py:199`
**Complexity**: F-grade (>41 decision points)
**Risk**: MEDIUM - User-facing feature

**Approach**:
1. Write tests for each AI assist mode (title, autocomplete, polish, brainstorm)
2. Extract mode handlers:
   - `_handle_title_mode(request, context)`
   - `_handle_autocomplete_mode(request, context)`
   - `_handle_polish_mode(request, context)`
   - `_handle_brainstorm_mode(request, context)`
   - `ai_write_assist()` - Route to appropriate handler
3. Add integration tests
4. Feature flag for staged rollout

**Acceptance Criteria**:
- [ ] Main function complexity <10 (B-grade or better)
- [ ] 4 mode handlers with <15 complexity each
- [ ] Integration tests for each mode
- [ ] Feature flag: `ENABLE_NEW_AI_ASSIST=true`

---

### 🔴 Priority 2: Logging Cleanup (9 hours)

#### Task 2.1: Replace print() with logger (6h)
**Files**: 36 instances across 8 files
**Risk**: LOW - Quality/debuggability issue

**Priority order**:
1. `backend/vector_store.py` (15 instances)
2. `backend/cache.py` (5 instances)
3. `backend/llm_config.py` (3 instances)
4. `backend/sentry.py` (3 instances)
5. `backend/model_registry.py` (2 instances)
6. `backend/config.py` (2 instances)
7. `backend/mock_llm.py` (1 instance)

**Pattern**:
```python
# Before
print(f"[CACHE] Redis connection failed: {e}")

# After
from backend.security import log_error
log_error("cache", "Redis connection failed", error=str(e))
```

**Acceptance Criteria**:
- [ ] Zero `print(` in backend/ (excluding tests and error message strings)
- [ ] All logs use structured logging via security.py
- [ ] Search command returns no results: `grep -rn "print(" backend/ --exclude-dir=tests`

#### Task 2.2: Remove console.log from production (3h)
**Files**: 7 instances in production code (17 acceptable in utils)

**Files to fix**:
1. `src/components/onboarding/OnboardingFlow.tsx` (3 instances)
2. `src/components/mycompany/tabs/LLMHubTab.tsx` (2 instances)
3. `src/components/ErrorPage.tsx` (1 instance)
4. `src/components/ErrorBoundary.tsx` (1 instance)

**Pattern**:
```typescript
// Before
console.error('Failed to analyze profile:', error);

// After
import { logger } from '@/utils/logger';
logger.error('Failed to analyze profile', { error });
```

**Acceptance Criteria**:
- [ ] Zero `console.log/warn/error` outside of `utils/logger.ts` wrapper
- [ ] All components use `import { logger } from '@/utils/logger'`
- [ ] Search returns only utils: `grep -rn "console\\." src/ --exclude-dir=utils`

---

### 🔴 Priority 3: Quick Wins (7 hours)

#### Task 3.1: Fix undefined names (2h)
**File**: `backend/context_loader.py`
**Errors**: 7 instances of `log_app_event` and `log_error` used but not imported

**Fix**:
```python
# Add at top of file
from backend.security import log_app_event, log_error
```

**Acceptance Criteria**:
- [ ] `ruff check backend/context_loader.py` returns no F821 errors
- [ ] All tests pass

#### Task 3.2: Replace bare except (3h)
**File**: `backend/attachments.py`
**Errors**: 5 instances (lines 244, 316, 353, 360, 447)

**Fix**:
```python
# Before
try:
    upload_result = ...
except:
    pass

# After
try:
    upload_result = ...
except Exception as e:
    log_error("attachments", "Upload failed", error=str(e))
    raise
```

**Acceptance Criteria**:
- [ ] Zero `E722` errors in `ruff check backend/`
- [ ] All exception paths logged
- [ ] Tests validate error handling

#### Task 3.3: Documentation (2h)
- [ ] Update `backend/context_loader.py` docstrings
- [ ] Update `backend/routers/ai_utils.py` docstrings
- [ ] Add architecture decision record (ADR) for refactoring approach

---

## Week 2-3: Code Health (60 hours)

### 🟡 Priority 4: Refactor E-Grade Functions (24h)

**Functions** (Complexity 31-40):
1. `backend/openrouter.py::query_model_stream` (line 673) - 8h
2. `backend/council.py::stage1_stream_responses` (line 94) - 8h
3. `backend/council.py::stage2_stream_rankings` (line 384) - 8h

**Approach**: Extract helpers for error handling, streaming, response formatting, retry logic

**Acceptance Criteria**:
- [ ] All functions <25 complexity (C-grade or better)
- [ ] Unit tests for extracted logic
- [ ] E2E tests pass

---

### 🟡 Priority 5: Type Safety (30h)

#### Task 5.1: Install type stubs (1h)
```bash
pip install types-redis types-requests types-python-dotenv types-pydantic
```

#### Task 5.2: Add type annotations (24h)
**Priority files**:
1. `backend/sentry.py` (15 errors) - 8h
2. `backend/utils/encryption.py` (10 errors) - 6h
3. `backend/database.py` (5 errors) - 4h
4. Other files - 6h

**Pattern**:
```python
# Before
def get_data():
    return {}

# After
def get_data() -> dict[str, Any]:
    return {}
```

**Acceptance Criteria**:
- [ ] `mypy backend/ --strict` returns <10 errors
- [ ] All public functions have return type annotations
- [ ] All dict/list types have type parameters

#### Task 5.3: Remove unused imports (2h)
```bash
ruff check backend/ --fix
```

**Acceptance Criteria**:
- [ ] Zero F401 (unused import) errors
- [ ] Imports organized (isort)

#### Task 5.4: Fix type parameter violations (3h)
**Pattern**: Add `[str, Any]` to all `dict` and `list` types

**Acceptance Criteria**:
- [ ] Zero "Missing type parameters" errors in mypy

---

### 🟡 Priority 6: Code Duplication Analysis (3h)

#### Task 6.1: Run full duplication scan (1h)
```bash
# Frontend
npx jscpd src/ --min-lines 10 --ignore "**/*.md,**/*.test.*"

# Backend
pylint backend/ --disable=all --enable=duplicate-code --min-similarity-lines=10
```

#### Task 6.2: Refactor duplications (2h)
**Target**: <3% code duplication

**Acceptance Criteria**:
- [ ] Frontend duplication <3%
- [ ] Backend duplication <3%
- [ ] Shared logic extracted to utils/helpers

---

## Week 4+: Architecture (40 hours)

### 🟢 Priority 7: Remaining Complexity (16h)

**Functions** (D-grade, Complexity 21-30):
1. `backend/council.py::stage3_stream_synthesis` (line 676) - 8h
2. `backend/billing.py::handle_webhook_event` (line 340) - 8h

**Target**: <20 complexity (C-grade or better)

---

### 🟢 Priority 8: Test Coverage (20h)

**Current**: 40% backend
**Target**: 70% backend (enforced in CI)

**Priority modules**:
1. `backend/auth.py` → 95%
2. `backend/council.py` → 90%
3. `backend/openrouter.py` → 85%
4. `backend/context_loader.py` → 80%

---

### 🟢 Priority 9: Tooling (4h)

#### Task 9.1: Install Stylelint (2h)
```bash
cd frontend && npm install --save-dev stylelint
npm run lint:css
```

#### Task 9.2: Add complexity check to CI (2h)
**Goal**: Reject PRs with functions >C grade (complexity >10)

```yaml
# .github/workflows/ci.yml
- name: Check code complexity
  run: |
    radon cc backend/ --total-average --show-complexity -nc 11
```

---

## Success Metrics

### End of Week 1
| Metric | Target | How to Verify |
|--------|--------|---------------|
| F-grade functions | 0 | `radon cc backend/ \| grep " F"` returns nothing |
| print() statements | 0 | `grep -rn "print(" backend/ --exclude-dir=tests` returns nothing |
| console.log (production) | 0 | `grep -rn "console\." src/ --exclude-dir=utils` returns nothing |
| Undefined names (F821) | 0 | `ruff check backend/context_loader.py` clean |
| Bare except (E722) | 0 | `ruff check backend/attachments.py` clean |

### End of Week 2-3
| Metric | Target | How to Verify |
|--------|--------|---------------|
| E-grade functions | 0 | `radon cc backend/ \| grep " E"` returns nothing |
| mypy errors (strict) | <10 | `mypy backend/ --strict` |
| Unused imports | 0 | `ruff check backend/ \| grep F401` returns nothing |
| Code duplication | <3% | `jscpd` and `pylint` reports |

### End of Week 4
| Metric | Target | How to Verify |
|--------|--------|---------------|
| D-grade functions | <2 | `radon cc backend/ \| grep " D"` returns <2 |
| Test coverage (backend) | 70% | `pytest --cov` report |
| Stylelint errors | 0 | `npm run lint:css` clean |

---

## Commands Cheat Sheet

### Verify Fixes
```bash
# Check complexity
radon cc backend/ -a --total-average

# Check for F/E grade functions
radon cc backend/ | grep -E " [FE]"

# Check type safety
mypy backend/ --strict | head -20

# Check linting
ruff check backend/ --output-format=grouped

# Check for print()
grep -rn "print(" backend/ --exclude-dir=tests --exclude-dir=__pycache__

# Check for console.log
grep -rn "console\." src/ --exclude-dir=node_modules --exclude-dir=utils

# Check code duplication
npx jscpd src/ --min-lines 10 --ignore "**/*.md"
pylint backend/ --disable=all --enable=duplicate-code
```

### Auto-fix
```bash
# Fix imports
ruff check backend/ --fix

# Format code
cd frontend && npm run format
cd .. && ruff format backend/
```

### Run Tests
```bash
# Backend
pytest backend/tests/ -v

# Frontend
cd frontend && npm run test:run

# E2E
cd frontend && npm run test:e2e
```

---

## Ownership & Timeline

| Phase | Duration | Owner | Start Date | End Date | Status |
|-------|----------|-------|------------|----------|--------|
| Week 1: Critical Fixes | 5 days | TBD | TBD | TBD | 🔴 Not Started |
| Week 2-3: Code Health | 10 days | TBD | TBD | TBD | 🔴 Not Started |
| Week 4+: Architecture | 5 days | TBD | TBD | TBD | 🔴 Not Started |

---

## Risk Mitigation

### High-Risk Refactorings

| Function | Risk | Mitigation Strategy |
|----------|------|---------------------|
| `get_system_prompt_with_context` | HIGH | 1. Capture behavior with tests<br>2. Refactor incrementally<br>3. Feature flag for rollback<br>4. Monitor LLM output quality |
| `ai_write_assist` | MEDIUM | 1. Feature flag: `ENABLE_NEW_AI_ASSIST`<br>2. Staged rollout (10% → 50% → 100%)<br>3. A/B test metrics |
| `query_model_stream` | HIGH | 1. Add integration tests<br>2. Monitor error rates in prod<br>3. Canary deployment |
| Council stage functions | HIGH | 1. Test with all models<br>2. Verify ranking correctness<br>3. Shadow mode comparison |

### Rollback Plan

If issues arise post-deployment:
1. **Immediate**: Feature flags → disable new code paths
2. **Within 1 hour**: Git revert + redeploy
3. **Within 4 hours**: Hotfix if needed
4. **Post-incident**: Review test coverage gaps

---

## Next Steps

1. **Assign owners** to Week 1 tasks
2. **Set start date** (recommended: next sprint)
3. **Create GitHub issues** for each task
4. **Set up daily standups** during Week 1 (critical phase)
5. **Schedule code review** for refactored functions
6. **Plan production deployment** with monitoring

---

## Questions for Stakeholders

1. **Timeline**: Can we dedicate 1-2 sprints to this work?
2. **Resources**: Who will own the refactoring work?
3. **Testing**: Do we have staging environment for validation?
4. **Monitoring**: Do we have alerts on LLM output quality?
5. **Rollout**: Can we use feature flags for gradual rollout?

---

**Awaiting approval to proceed with Week 1 implementation.**
