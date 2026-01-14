# Code Quality Audit Report - AI Council
**Date**: 2026-01-13
**Auditor**: Claude Code
**Scope**: Enterprise-grade code quality assessment for $25M+ valuation

---

## Executive Summary

### Overall Scores
| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| **Code Quality** | 6/10 | 9/10 | ⚠️ NEEDS IMPROVEMENT |
| **Maintainability** | 7/10 | 9/10 | ⚠️ NEEDS IMPROVEMENT |
| **Complexity** | 5/10 | 8/10 | ❌ ACTION REQUIRED |
| **Type Safety** | 4/10 | 9/10 | ❌ ACTION REQUIRED |

### Key Findings
- ✅ **Strengths**: Extensive CI/CD automation, good test coverage framework, comprehensive security scanning
- ⚠️ **Moderate Issues**: 36 print() statements instead of logger, 24 console.log statements in production code
- ❌ **Critical Issues**: 2 functions with EXTREME complexity (F grade, >41), 100+ mypy type errors, 60+ Ruff linting violations

---

## Phase 0: Existing CI/CD Review

### ✅ Automated Checks Already Running

Your project has **excellent CI/CD coverage**:

| Check | Status | Coverage |
|-------|--------|----------|
| ESLint | ✅ Running | Enforced on every PR |
| TypeScript | ✅ Running | `npm run type-check` in CI |
| Prettier | ✅ Running | Auto-format on commit |
| Frontend Tests | ✅ Running | Vitest with coverage |
| Backend Tests | ✅ Running | Pytest (40% coverage) |
| E2E Tests | ✅ Running | Playwright |
| Bandit Security | ✅ Running | Python security scan |
| npm audit | ✅ Running | Frontend vulnerabilities |
| pip-audit | ✅ Running | Backend vulnerabilities |
| Gitleaks | ✅ Running | Secret scanning |
| CodeQL | ✅ Running | SAST analysis |

**Git Hooks**:
- ✅ Pre-commit: lint-staged (ESLint + Prettier auto-fix)
- ✅ Pre-push: Full test suite (ESLint, TypeScript, Vitest, Pytest)

**Note**: GitHub CLI not installed - install with `gh auth login` to view CI status locally

---

## Phase 1: Additional Automated Checks

### Automated Metrics Summary

| Metric | Source | Current | Target | Status |
|--------|--------|---------|--------|--------|
| TypeScript errors | CI (already checked) | Unknown* | 0 | ⚠️ |
| ESLint errors | CI (already checked) | Unknown* | 0 | ⚠️ |
| Stylelint | **NEW** | Not installed | 0 | ❌ |
| Functions complexity >15 | **NEW** | **2 E-grade, 3 D-grade** | 0 | ❌ |
| Functions complexity F-grade | **NEW** | **2 critical** | 0 | ❌ CRITICAL |
| Code duplication % | **NEW** | 0% (check incomplete) | <3% | ⚠️ |
| mypy type errors | **NEW** | **100+** | 0 | ❌ |
| Ruff violations | **NEW** | **60+** | 0 | ❌ |
| console.log statements | **NEW** | **24** | 0 | ❌ |
| print() statements | **NEW** | **36** | 0 | ❌ |
| Backend maintainability | **NEW** | B (65-85) | A (85+) | ⚠️ |

*Note: File `ts-errors.txt` (282 KB) suggests there may be TypeScript errors - needs CI verification

---

## Critical Issues (Must Fix Immediately)

### 1. EXTREME Complexity Functions (F-grade, >41 cyclomatic complexity)

| File | Function | Line | Complexity | Impact | Priority |
|------|----------|------|------------|--------|----------|
| `backend/context_loader.py` | `get_system_prompt_with_context` | 1227 | **F (41+)** | Core prompt generation - hard to debug, high bug risk | 🔴 CRITICAL |
| `backend/routers/ai_utils.py` | `ai_write_assist` | 199 | **F (41+)** | AI writing feature - maintenance nightmare | 🔴 CRITICAL |

**Impact**: Functions this complex are:
- Nearly impossible to test comprehensively
- Breeding ground for bugs
- Hard for new developers to understand
- High risk during refactoring

### 2. Very High Complexity Functions (E-grade, 31-40 complexity)

| File | Function | Line | Complexity | Priority |
|------|----------|------|------------|----------|
| `backend/openrouter.py` | `query_model_stream` | 673 | **E (31-40)** | 🔴 HIGH |
| `backend/council.py` | `stage1_stream_responses` | 94 | **E (31-40)** | 🔴 HIGH |
| `backend/council.py` | `stage2_stream_rankings` | 384 | **E (31-40)** | 🔴 HIGH |

### 3. High Complexity Functions (D-grade, 21-30 complexity)

| File | Function | Line | Complexity | Priority |
|------|----------|------|------------|----------|
| `backend/council.py` | `stage3_stream_synthesis` | 676 | **D (21-30)** | 🟡 MEDIUM |
| `backend/billing.py` | `handle_webhook_event` | 340 | **D (21-30)** | 🟡 MEDIUM |

---

## Code Smells & Quality Issues

### Print Statements (Should Use Logger) - 36 instances

**Files with most violations**:
- `backend/vector_store.py`: 15 print statements (lines 65, 69, 83, 114, 116, 125, 129, 134, 144, 165, 217, 262, 311, 359, 378, 397)
- `backend/cache.py`: 5 print statements (lines 77, 178, 211, 238, 289)
- `backend/llm_config.py`: 3 print statements (lines 104, 106, 109)
- `backend/sentry.py`: 3 print statements (lines 69, 74, 114)

**Impact**:
- Inconsistent logging (mixing print() and logger)
- No structured logging for production debugging
- Can't filter/route logs properly

### Console.log Statements (Production Code) - 24 instances

**Critical violations** (not in logger wrapper):
- `src/components/onboarding/OnboardingFlow.tsx`: 3 instances (lines 161, 290, 337)
- `src/components/mycompany/tabs/LLMHubTab.tsx`: 2 instances (lines 536, 542)
- `src/components/ErrorPage.tsx`: 1 instance (line 24)
- `src/components/ErrorBoundary.tsx`: 1 instance (line 139)

**Acceptable** (in utils/logger.ts wrapper):
- `src/utils/logger.ts`: 4 instances (legitimate wrapper around console API)
- `src/utils/webVitals.ts`, `src/utils/sentry.ts`: Configuration warnings (acceptable)

---

## Type Safety Issues

### mypy Strict Mode Violations - 100+ errors

**Top violations by category**:

1. **Missing type annotations** (40+ instances)
   - `backend/sentry.py`: 15 errors (no return types, untyped functions)
   - `backend/utils/encryption.py`: 10 errors (no return types)
   - `backend/database.py`: 5 errors

2. **Missing library stubs** (30+ instances)
   - `sentry_sdk`, `fastapi`, `pytest`, `pydantic`, `redis`, `qdrant_client`
   - **Fix**: Install type stubs: `pip install types-redis types-requests`

3. **Missing type parameters** (20+ instances)
   - `dict` → `dict[str, Any]`
   - `list` → `list[str]`
   - Examples: `backend/vector_store.py` (lines 180, 226, 271, 320, 401)

4. **`Any` type returns** (10+ instances)
   - `backend/rate_limit.py:24`: Returning `Any` from function declared to return `str`
   - `backend/utils/encryption.py:159, 195`: Returning `Any` instead of `str`

---

## Linting Violations (Ruff)

### Top violations - 60+ issues

1. **Unused imports (F401)** - 30+ instances
   - `backend/attachments.py`: `datetime.datetime` imported but unused
   - `backend/billing.py`: `timedelta`, `mask_email` unused
   - `backend/config.py`: `COUNCIL_MODELS`, `CHAIRMAN_MODELS` unused
   - `backend/routers/company/__init__.py`: 10 unused imports in `__init__`

2. **Undefined names (F821)** - 7 instances
   - `backend/context_loader.py`: `log_app_event`, `log_error` used but not imported (lines 185, 188, 278, 305, 359, 425, 475)

3. **Bare except clauses (E722)** - 5 instances
   - `backend/attachments.py`: Lines 244, 316, 353, 360, 447
   - **Impact**: Catches too broad, can hide bugs

4. **Assigned but never used (F841)** - 4 instances
   - `backend/attachments.py:205`: `upload_result`
   - `backend/openrouter.py:755`: `stream_succeeded`
   - `backend/openrouter.py:840`: `finish_reason`
   - `backend/routers/company/llm_ops.py:791`: `model`

5. **f-strings without placeholders (F541)** - 6 instances
   - Just use regular strings instead

6. **Module imports not at top (E402)** - 5 instances
   - `backend/main.py`: Lines 132, 133, 134, 300, 603
   - `backend/config.py`: Line 136

---

## Code Duplication

**Status**: ⚠️ Incomplete analysis

The jscpd tool only analyzed markdown files (0% duplication found). Need to re-run on TypeScript/Python code:

```bash
# Frontend
npx jscpd src/ --min-lines 10 --min-tokens 50 --ignore "**/*.md,**/*.test.*"

# Backend
pylint backend/ --disable=all --enable=duplicate-code --min-similarity-lines=10
```

---

## Stylelint

**Status**: ❌ Not installed

CSS linting is configured (`.stylelintrc.json` exists) but stylelint is not installed:

```bash
cd frontend && npm install --save-dev stylelint
```

---

## Architecture Issues

### 1. Inconsistent Error Handling
- Mixing bare `except:` with specific exceptions
- Some functions use print(), others use logger
- No centralized error handling pattern

### 2. God Functions
- `get_system_prompt_with_context` (F-grade) does too much
- `ai_write_assist` (F-grade) needs decomposition
- `query_model_stream` (E-grade) handles too many concerns

### 3. Import Organization
- Module-level imports not at top (E402 violations)
- Unused imports cluttering code
- Undefined names suggesting circular import issues

---

## Recommendations by Priority

### 🔴 IMMEDIATE (Week 1) - Blocking Quality Issues

#### 1. Refactor F-grade Functions
**Effort**: 2-3 days
**Risk if ignored**: High bug probability, impossible to maintain

**Files to refactor**:
- `backend/context_loader.py::get_system_prompt_with_context` (line 1227)
  - **Current**: 1 massive function with 41+ decision points
  - **Recommendation**: Split into:
    - `_build_base_context()`
    - `_add_company_context()`
    - `_add_department_context()`
    - `_add_playbooks_context()`
    - `_add_knowledge_context()`
    - `get_system_prompt_with_context()` (orchestrates the above)

- `backend/routers/ai_utils.py::ai_write_assist` (line 199)
  - **Current**: 1 massive function handling multiple AI assist modes
  - **Recommendation**: Extract mode handlers:
    - `_handle_title_mode()`
    - `_handle_autocomplete_mode()`
    - `_handle_polish_mode()`
    - `_handle_brainstorm_mode()`

#### 2. Replace All print() with logger
**Effort**: 4-6 hours
**Files**: 36 instances across 8 files

**Pattern to follow**:
```python
# BAD
print(f"[CACHE] Redis connection failed: {e}")

# GOOD
from backend.security import log_error
log_error("cache", "Redis connection failed", error=e)
```

**Files to fix** (in priority order):
1. `backend/vector_store.py` (15 instances)
2. `backend/cache.py` (5 instances)
3. `backend/llm_config.py` (3 instances)
4. `backend/sentry.py` (3 instances)
5. `backend/model_registry.py` (2 instances)
6. `backend/config.py` (2 instances)
7. `backend/utils/encryption.py` (2 in error messages - acceptable)
8. `backend/mock_llm.py` (1 instance)

#### 3. Remove console.log from Production Code
**Effort**: 2-3 hours
**Files**: 7 production instances (17 acceptable in logger/utils)

**Production code violations to fix**:
```typescript
// File: src/components/onboarding/OnboardingFlow.tsx
// Lines: 161, 290, 337
// Replace with: import { logger } from '@/utils/logger'

// BAD
console.error('Failed to analyze profile:', error);

// GOOD
logger.error('Failed to analyze profile', { error });
```

**Files to fix**:
1. `src/components/onboarding/OnboardingFlow.tsx` (3 instances)
2. `src/components/mycompany/tabs/LLMHubTab.tsx` (2 instances)
3. `src/components/ErrorPage.tsx` (1 instance)
4. `src/components/ErrorBoundary.tsx` (1 instance)

**Keep as-is** (acceptable usage):
- `src/utils/logger.ts` (wrapper around console API)
- `src/utils/webVitals.ts`, `src/utils/sentry.ts`, `src/pwa.ts` (config warnings)
- `src/main.tsx` (chunk load error recovery - production critical)

---

### 🟡 SHORT-TERM (Week 2-3) - Code Health

#### 4. Refactor E-grade Functions (Complexity 31-40)
**Effort**: 1 week
**Files**:
- `backend/openrouter.py::query_model_stream` (line 673)
- `backend/council.py::stage1_stream_responses` (line 94)
- `backend/council.py::stage2_stream_rankings` (line 384)

**Strategy**: Extract helper functions for:
- Error handling logic
- Stream processing
- Response formatting
- Retry logic

#### 5. Fix Ruff Linting Violations
**Effort**: 1-2 days
**Priority fixes**:

1. **Remove unused imports** (30+ instances) - Auto-fixable with `ruff check --fix`
2. **Fix undefined names** (7 instances in `context_loader.py`)
   ```python
   # Add at top of file
   from backend.security import log_app_event, log_error
   ```
3. **Replace bare except** (5 instances in `attachments.py`)
   ```python
   # BAD
   except:
       pass

   # GOOD
   except Exception as e:
       logger.error("Upload failed", error=e)
   ```

#### 6. Add Type Annotations (mypy)
**Effort**: 3-4 days
**Priority files** (most violations):
1. `backend/sentry.py` (15 errors)
2. `backend/utils/encryption.py` (10 errors)
3. `backend/database.py` (5 errors)

**Install missing type stubs**:
```bash
pip install types-redis types-requests types-python-dotenv types-pydantic
```

**Add return type annotations**:
```python
# BAD
def init_sentry():
    pass

# GOOD
def init_sentry() -> None:
    pass
```

#### 7. Fix Type Parameter Violations (20+ instances)
```python
# BAD
def get_data() -> dict:
    return {}

# GOOD
def get_data() -> dict[str, Any]:
    return {}
```

---

### 🟢 LONG-TERM (Week 4+) - Architecture Improvements

#### 8. Refactor D-grade Functions (Complexity 21-30)
**Effort**: 3-4 days
**Files**:
- `backend/council.py::stage3_stream_synthesis` (line 676)
- `backend/billing.py::handle_webhook_event` (line 340)

#### 9. Improve Test Coverage
**Current**: 40% backend coverage
**Target**: 70% (enforced in CI)

**Priority areas** (from `/audit-test-coverage`):
- `backend/auth.py` → 95%
- `backend/council.py` → 90%
- `backend/openrouter.py` → 85%

#### 10. Install and Configure Stylelint
```bash
cd frontend
npm install --save-dev stylelint
npm run lint:css
```

#### 11. Run Full Code Duplication Analysis
```bash
# Frontend (TypeScript)
npx jscpd src/ --min-lines 10 --ignore "**/*.md,**/*.test.*"

# Backend (Python)
pylint backend/ --disable=all --enable=duplicate-code
```

---

## Implementation Plan

### Week 1: Critical Fixes (40 hours)
| Task | Effort | Owner | Status |
|------|--------|-------|--------|
| Refactor `get_system_prompt_with_context` | 12h | TBD | 🔴 Not Started |
| Refactor `ai_write_assist` | 12h | TBD | 🔴 Not Started |
| Replace 36 print() statements | 6h | TBD | 🔴 Not Started |
| Remove 7 console.log statements | 3h | TBD | 🔴 Not Started |
| Fix undefined name errors (F821) | 2h | TBD | 🔴 Not Started |
| Remove bare except clauses | 3h | TBD | 🔴 Not Started |
| Document refactored functions | 2h | TBD | 🔴 Not Started |

### Week 2-3: Code Health (60 hours)
| Task | Effort | Owner | Status |
|------|--------|-------|--------|
| Refactor 3 E-grade functions | 24h | TBD | 🔴 Not Started |
| Remove 30+ unused imports (auto-fix) | 2h | TBD | 🔴 Not Started |
| Add type annotations (mypy) | 24h | TBD | 🔴 Not Started |
| Install type stubs | 1h | TBD | 🔴 Not Started |
| Fix type parameter violations | 6h | TBD | 🔴 Not Started |
| Run code duplication analysis | 2h | TBD | 🔴 Not Started |
| Fix identified duplications | TBD | TBD | 🔴 Not Started |

### Week 4+: Architecture (40 hours)
| Task | Effort | Owner | Status |
|------|--------|-------|--------|
| Refactor 2 D-grade functions | 16h | TBD | 🔴 Not Started |
| Increase test coverage to 70% | 20h | TBD | 🔴 Not Started |
| Install and run Stylelint | 2h | TBD | 🔴 Not Started |
| Code review and documentation | 2h | TBD | 🔴 Not Started |

---

## Success Metrics

### Target Scores (End of Week 4)
| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Code Quality Score | 6/10 | 9/10 | After all fixes complete |
| Complexity Score | 5/10 | 8/10 | No functions >C grade (complexity <11) |
| Type Safety Score | 4/10 | 9/10 | <10 mypy errors, no `Any` returns |
| Maintainability Score | 7/10 | 9/10 | Radon MI >85 (A grade) |

### Quantitative Targets
| Metric | Current | Target | Progress Indicator |
|--------|---------|--------|-------------------|
| F-grade functions | 2 | 0 | Both refactored |
| E-grade functions | 3 | 0 | All refactored |
| D-grade functions | 2 | <2 | Refactored or split |
| print() statements | 36 | 0 | All use logger |
| console.log (production) | 7 | 0 | All use logger wrapper |
| mypy errors (strict) | 100+ | <10 | Type stubs + annotations |
| Ruff violations | 60+ | <5 | Auto-fix + manual fixes |
| Test coverage (backend) | 40% | 70% | Add unit tests |

---

## Tools & Commands Reference

### Run Full Audit
```bash
# From project root
bash scripts/audit-code.sh
```

### Individual Checks
```bash
# Frontend
cd frontend
npx ts-complexity src/**/*.{ts,tsx} --threshold 10
npx jscpd src/ --min-lines 10 --ignore "**/*.md"
grep -rn "console\\.log" src/ --exclude="*.test.*"

# Backend
cd ..
mypy backend/ --strict
ruff check backend/ --output-format=grouped
radon cc backend/ -a --total-average
grep -rn "print(" backend/ --exclude-dir=tests
```

### Auto-fix Where Possible
```bash
# Remove unused imports
ruff check backend/ --fix

# Format code
cd frontend && npm run format
```

---

## Risk Assessment

### High Risk Areas (Refactoring Impact)
| Function | Risk | Mitigation |
|----------|------|------------|
| `get_system_prompt_with_context` | HIGH - Core prompt logic | Add comprehensive tests before refactoring |
| `ai_write_assist` | MEDIUM - User-facing feature | Feature flag + staged rollout |
| `query_model_stream` | HIGH - LLM streaming | Add integration tests, monitor error rates |
| `stage1/2/3_stream_*` | HIGH - Core council logic | Test with all models, verify rankings |

### Testing Strategy for Refactoring
1. **Before**: Capture current behavior with characterization tests
2. **During**: Refactor incrementally with tests passing at each step
3. **After**: Add unit tests for extracted functions
4. **Validation**: Run full E2E suite + manual smoke testing

---

## Conclusion

The codebase has **excellent CI/CD infrastructure** but suffers from **technical debt in code complexity and type safety**. The presence of 2 F-grade functions (complexity >41) is a **critical blocker** for enterprise acquisition due diligence.

**Recommended immediate action**:
1. Dedicate 1 sprint (2 weeks) to refactoring the 2 F-grade and 3 E-grade functions
2. Enforce complexity limits in CI (reject PRs with functions >C grade)
3. Add mypy strict checking to CI pipeline
4. Replace all print()/console.log with structured logging

**After remediation**, the codebase will be in excellent shape for a $25M+ valuation.

---

**Next Steps**: Await approval to begin Week 1 implementation plan.
