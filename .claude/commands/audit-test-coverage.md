# Test Coverage Audit - Quality Assurance & Confidence

You are a QA architect auditing test coverage for an enterprise SaaS platform. This audit ensures the codebase has sufficient testing to maintain quality during rapid development and provide confidence for acquirers.

**The Stakes**: Low test coverage = high risk = lower valuation. Every untested code path is a potential production incident. Acquirers check coverage metrics as a quality signal.

## Testing Pyramid Overview

```
                    /\
                   /  \        E2E Tests (Playwright)
                  /____\       - Critical user journeys
                 /      \      - 5-10 flows max
                /        \
               /__________\    Integration Tests
              /            \   - API endpoints
             /              \  - Component integration
            /________________\
           /                  \ Unit Tests
          /                    \ - Pure functions
         /                      \ - Business logic
        /__________________________\ - Hooks
```

**Target Coverage:**
- Unit Tests: ≥80% line coverage
- Integration Tests: All critical API paths
- E2E Tests: Top 5 user journeys
- Visual Regression: Key component states

## Audit Checklist

### 1. Backend Unit Tests (Python)

```
Run coverage analysis:
cd backend && pytest --cov=. --cov-report=html --cov-report=term-missing

Check for:
- [ ] Overall coverage percentage (target: ≥80%)
- [ ] Critical paths tested (auth, billing, council)
- [ ] Edge cases covered (empty inputs, errors, limits)
- [ ] Security functions tested (auth.py, security.py)
- [ ] Business logic tested (council.py, context_loader.py)
- [ ] Database operations tested (with mocking)
- [ ] API endpoint tests (with TestClient)
```

**Critical Files to Test:**
| File | Priority | Current Coverage | Target |
|------|----------|------------------|--------|
| `backend/auth.py` | Critical | ? | 95% |
| `backend/security.py` | Critical | ? | 95% |
| `backend/council.py` | Critical | ? | 90% |
| `backend/openrouter.py` | Critical | ? | 85% |
| `backend/context_loader.py` | High | ? | 80% |
| `backend/routers/*.py` | High | ? | 80% |
| `backend/knowledge.py` | Medium | ? | 75% |

**Test Categories:**
- [ ] Happy path tests
- [ ] Error handling tests
- [ ] Boundary condition tests
- [ ] Authentication/authorization tests
- [ ] Rate limiting tests
- [ ] Circuit breaker tests

### 2. Frontend Unit Tests (Vitest)

```
Run coverage analysis:
cd frontend && npm run test:coverage

Check for:
- [ ] Overall coverage percentage (target: ≥70%)
- [ ] React hooks tested (useMessageStreaming, useTriage, etc.)
- [ ] Utility functions tested (lib/*)
- [ ] Context providers tested
- [ ] Component logic tested (not just rendering)
```

**Files to Review:**
- `frontend/vitest.config.ts` - Test configuration
- `frontend/src/**/*.test.ts(x)` - Test files
- `frontend/src/test/` - Test utilities

**Critical Hooks to Test:**
| Hook | Priority | Tested | Coverage |
|------|----------|--------|----------|
| `useMessageStreaming` | Critical | ? | ? |
| `useTriage` | Critical | ? | ? |
| `useAuth` | Critical | ? | ? |
| `useBusiness` | High | ? | ? |
| `useCompany` | High | ? | ? |

**Critical Utils to Test:**
| Utility | Priority | Tested | Coverage |
|---------|----------|--------|----------|
| API client (`api.ts`) | Critical | ? | ? |
| Supabase client | Critical | ? | ? |
| Date/time utils | Medium | ? | ? |
| Formatting utils | Medium | ? | ? |

### 3. Integration Tests

```
API Endpoint Testing:
- [ ] All REST endpoints have integration tests
- [ ] Authentication flows tested end-to-end
- [ ] Error responses validated
- [ ] Rate limiting behavior verified
- [ ] Database state verified after operations

Frontend Integration:
- [ ] Component + hook integration
- [ ] Context provider integration
- [ ] API mocking with MSW
- [ ] State management flows
```

**Critical API Endpoints to Test:**
| Endpoint | Method | Priority | Tested |
|----------|--------|----------|--------|
| `/api/v1/conversations` | POST | Critical | ? |
| `/api/v1/conversations/stream` | POST | Critical | ? |
| `/api/v1/billing/checkout` | POST | Critical | ? |
| `/api/v1/company/{id}/context` | GET | High | ? |
| `/api/v1/knowledge` | CRUD | High | ? |
| `/api/v1/attachments/upload` | POST | Medium | ? |

### 4. End-to-End Tests (Playwright)

```
Check for:
- [ ] Playwright configured and running
- [ ] Critical user journeys covered
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile viewport testing
- [ ] Visual regression snapshots
- [ ] Accessibility testing (axe-core)
```

**Critical User Journeys:**
| Journey | Priority | Tested | Status |
|---------|----------|--------|--------|
| Sign up → First query | Critical | ? | ? |
| Login → Council query → View stages | Critical | ? | ? |
| Settings → Update company context | High | ? | ? |
| Upgrade → Stripe checkout | Critical | ? | ? |
| Knowledge → Save decision | High | ? | ? |
| Mobile → Full flow | High | ? | ? |

**E2E Test Structure:**
```typescript
// Example critical path test
test('user can submit council query and see all stages', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="omni-bar-input"]', 'Should we expand to Europe?');
  await page.click('[data-testid="submit-button"]');

  // Stage 1: Council deliberation
  await expect(page.locator('[data-testid="stage-1"]')).toBeVisible();

  // Stage 2: Peer review
  await expect(page.locator('[data-testid="stage-2"]')).toBeVisible();

  // Stage 3: Synthesis
  await expect(page.locator('[data-testid="stage-3"]')).toBeVisible();
});
```

### 5. Visual Regression Testing

```
Check for:
- [ ] Chromatic, Percy, or similar configured
- [ ] Key component states captured
- [ ] Dark mode snapshots
- [ ] Mobile viewport snapshots
- [ ] Error state snapshots
- [ ] Loading state snapshots
```

**Components Needing Visual Tests:**
| Component | States | Priority |
|-----------|--------|----------|
| OmniBar | Default, focused, with content, loading | Critical |
| Stage 1/2/3 | Loading, streaming, complete | Critical |
| Modal dialogs | All variants | High |
| Settings | All tabs | Medium |
| Empty states | All variants | Medium |

### 6. Mutation Testing

```
Check for:
- [ ] Mutation testing configured (Stryker, mutmut)
- [ ] Mutation score ≥50%
- [ ] Critical paths have high mutation resistance
- [ ] Tests catch actual bugs, not just coverage

Run mutation testing:
# Frontend
npx stryker run

# Backend
mutmut run --paths-to-mutate=backend/
```

### 7. Load/Performance Testing

```
Check for:
- [ ] Load testing tool configured (k6, Artillery, Locust)
- [ ] Baseline performance documented
- [ ] Stress test scenarios defined
- [ ] Performance regression tests in CI

Key Metrics to Test:
- API response time under load (p95 < 500ms)
- Concurrent user capacity
- Database query performance
- LLM streaming latency
```

### 8. Security Testing

```
Check for:
- [ ] SAST (Static Application Security Testing) in CI
- [ ] DAST (Dynamic Application Security Testing) configured
- [ ] Dependency vulnerability scanning (npm audit, safety)
- [ ] Secret scanning (detect-secrets, gitleaks)
- [ ] SQL injection tests
- [ ] XSS prevention tests
- [ ] Authentication bypass tests
```

### 9. Accessibility Testing

```
Check for:
- [ ] axe-core or similar in E2E tests
- [ ] Keyboard navigation tests
- [ ] Screen reader compatibility tests
- [ ] Color contrast verification
- [ ] WCAG 2.1 AA automated checks
```

### 10. Test Infrastructure

```
Check for:
- [ ] CI/CD runs tests on every PR
- [ ] Test parallelization configured
- [ ] Flaky test detection/quarantine
- [ ] Test results reporting (Allure, etc.)
- [ ] Coverage reporting in PRs
- [ ] Test database/fixtures setup
- [ ] Mocking infrastructure (MSW, etc.)
```

**CI Configuration Files:**
- `.github/workflows/test.yml`
- `vitest.config.ts`
- `pytest.ini` or `pyproject.toml`
- `playwright.config.ts`

## Test Quality Metrics

### Coverage Targets
| Category | Current | Target | Status |
|----------|---------|--------|--------|
| Backend Unit | ?% | 80% | ? |
| Frontend Unit | ?% | 70% | ? |
| Integration | ?% | 60% | ? |
| E2E Journeys | ?/5 | 5/5 | ? |
| Mutation Score | ?% | 50% | ? |

### Test Health Metrics
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Flaky test rate | ?% | <2% | ? |
| Average test time | ?s | <5min | ? |
| Tests per PR | ? | 100% | ? |
| Coverage trend | ? | Increasing | ? |

## Output Format

### Test Coverage Score: [1-10]
### Test Quality Score: [1-10]
### Acquisition Confidence: [1-10]

### Coverage Summary
| Area | Files | Lines | Branches | Functions |
|------|-------|-------|----------|-----------|
| Backend | | | | |
| Frontend | | | | |
| Total | | | | |

### Critical Gaps (Untested Critical Paths)
| Area | File/Function | Risk | Priority |
|------|---------------|------|----------|

### Missing Test Categories
| Category | Status | Priority | Effort |
|----------|--------|----------|--------|
| Frontend Unit Tests | | | |
| E2E Tests | | | |
| Visual Regression | | | |
| Load Testing | | | |
| Mutation Testing | | | |

### Test Infrastructure Gaps
| Infrastructure | Status | Impact |
|----------------|--------|--------|
| CI/CD Integration | | |
| Coverage Reporting | | |
| Flaky Test Management | | |
| Test Parallelization | | |

### Recommended Test Plan
1. **Week 1**: Set up frontend unit testing infrastructure
2. **Week 2**: Add critical hook and utility tests
3. **Week 3**: Set up Playwright E2E framework
4. **Week 4**: Add critical journey tests
5. **Ongoing**: Maintain ≥80% coverage on new code

### Files Needing Immediate Tests
| File | Risk Level | Suggested Tests |
|------|------------|-----------------|

---

Remember: Tests are documentation that runs. They prove the system works. Low coverage = high risk = low valuation.
