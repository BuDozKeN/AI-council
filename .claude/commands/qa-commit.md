# QA-Commit - Fast Pre-Commit Quality Check

You are a QA engineer conducting a **rapid quality check** before code is committed. This check must be FAST (< 2 minutes) while catching the most critical errors.

**Philosophy:** Catch **critical bugs** before commit, **comprehensive bugs** before push/deploy.

**Scope:** Focus ONLY on **changed files** and **immediate impacts**. Save comprehensive checks for `/qa`.

---

## Quick Commit Readiness Checklist

### ✅ PHASE 1: Changed Files Inventory (10 seconds)

**Auto-detect changed files:**
```bash
git diff --name-only HEAD
git diff --cached --name-only
```

**Categorize changes:**
- [ ] Frontend files changed: [list]
- [ ] Backend files changed: [list]
- [ ] Database migrations: [list]
- [ ] Config files changed: [list]
- [ ] Test files changed: [list]

**Risk assessment:**
- 🔴 **HIGH**: Database migrations, auth code, security code
- 🟡 **MEDIUM**: API endpoints, business logic, UI components
- 🟢 **LOW**: CSS tweaks, copy changes, test updates

---

## ✅ PHASE 2: Automated Checks (60-90 seconds)

### 2.1 Lint & Format (changed files only)
```bash
# Already runs via lint-staged
npx lint-staged --diff="HEAD"
```
- [ ] ESLint passes on changed files
- [ ] Prettier formatted changed files
- [ ] No new linting errors introduced

### 2.2 TypeScript (changed files + dependencies)
```bash
# Type-check only affected files
cd frontend && npm run type-check
```
- [ ] No TypeScript errors in changed files
- [ ] No type errors in files that import changed files
- [ ] New types properly exported/imported

### 2.3 Quick Test (affected tests only)
```bash
# Run tests related to changed files
npm run test:run -- --changed
pytest backend/tests/ -v --lf --tb=short  # Last failed + related
```
- [ ] Tests related to changed files pass
- [ ] No previously passing tests now fail
- [ ] New tests added for new functions (if applicable)

### 2.4 Import Sanity Check
```bash
# Check for circular dependencies or broken imports
cd frontend && npm run type-check
python -m py_compile backend/**/*.py  # Changed files only
```
- [ ] No circular dependencies introduced
- [ ] All imports resolve correctly
- [ ] No unused imports in changed files

---

## ✅ PHASE 3: Critical Manual Checks (30 seconds)

### 3.1 Security Quick Scan (HIGH-RISK changes only)
**If auth/security code changed:**
- [ ] No hardcoded secrets, API keys, passwords
- [ ] User input validated (no direct use of user input)
- [ ] No SQL string concatenation (use parameterized queries)
- [ ] No `eval()` or `dangerouslySetInnerHTML` without sanitization

**Quick command:**
```bash
# Check for common security issues in changed files
git diff HEAD | grep -E "(password|secret|api_key|eval\(|dangerouslySetInnerHTML)" || echo "No obvious issues"
```

### 3.2 Gatekeeper Quick Check (if applicable)
**If adding new enum/entity (persona, role, department, etc.):**
- [ ] Check for hardcoded lists that might need updating:
  ```bash
  # Search in changed files and related config
  grep -rn "EDITABLE\|ALLOWED\|VISIBLE\|_LIST\|_KEYS" backend/routers/ frontend/src/
  ```
- [ ] New entity added to all necessary mappings?
- [ ] Frontend icon/label mapping updated?
- [ ] Translation keys added (en.json, es.json)?

### 3.3 Breaking Change Detection
**If API/schema/types changed:**
- [ ] Backend API changes have corresponding frontend updates?
- [ ] Database migration has rollback (DOWN migration)?
- [ ] TypeScript types match backend Pydantic models?
- [ ] No removed exports that other files depend on?

**Quick check:**
```bash
# Check if removed any exports
git diff HEAD | grep "^-export"
```

### 3.4 Code Quality Spot Check
**If changed file > 300 lines:**
- [ ] Function length < 50 lines? (Check longest function)
- [ ] Nesting depth < 3 levels? (Count if/for/while nesting)
- [ ] No `any` types added in TypeScript?
- [ ] No commented-out code committed?

**Quick check:**
```bash
# Find functions longer than 50 lines in changed files
git diff HEAD -- '*.ts' '*.tsx' | grep -A 50 "function\|const.*=>"
```

---

## ✅ PHASE 4: Impact Assessment (20 seconds)

### 4.1 Blast Radius
**Who/what is affected by this change?**
- [ ] Single component/function (LOW risk)
- [ ] Shared utility/hook (MEDIUM risk)
- [ ] Core API/database (HIGH risk)

### 4.2 Rollback Safety
- [ ] Can revert this commit without breaking anything?
- [ ] No database migration that can't be rolled back?
- [ ] No removed API that frontend depends on?

### 4.3 Documentation Needed?
- [ ] New environment variable? → Add to `.env.example`
- [ ] New API endpoint? → Add to OpenAPI/Swagger docs
- [ ] New dependency? → Update `package.json` or `requirements.txt`
- [ ] Breaking change? → Update CHANGELOG.md

---

## ⚡ Fast-Fail Criteria (BLOCK COMMIT)

**Do NOT commit if ANY of these are true:**

❌ **TypeScript errors exist**
```bash
cd frontend && npm run type-check
# If exit code != 0 → FAIL
```

❌ **ESLint errors exist**
```bash
cd frontend && npm run lint
# If exit code != 0 → FAIL
```

❌ **Tests fail**
```bash
npm run test:run -- --changed
pytest backend/tests/ --lf
# If exit code != 0 → FAIL
```

❌ **Hardcoded secrets found**
```bash
git diff HEAD | grep -E "(password.*=.*['\"]|api_key.*=.*['\"]|secret.*=.*['\"])"
# If matches found → FAIL
```

❌ **Breaking API changes without migration**
```bash
git diff HEAD | grep -E "^-.*@router\.|^-.*def.*\(.*\):"
# If API endpoint removed without corresponding frontend change → FAIL
```

❌ **Database migration without rollback**
```bash
ls supabase/migrations/*.sql | tail -1 | xargs grep -q "-- DOWN"
# If DOWN migration missing → FAIL
```

---

## 🎯 Commit Decision Matrix

| Scenario | Action |
|----------|--------|
| **All checks pass** | ✅ Commit safely |
| **TypeScript/ESLint/Tests fail** | ❌ BLOCK - Fix before commit |
| **Security issue found** | ❌ BLOCK - Critical fix required |
| **Gatekeeper missing** | ⚠️ WARN - Likely won't work, fix recommended |
| **Breaking change detected** | ⚠️ WARN - Verify frontend updated |
| **Large file (> 300 lines)** | ⚠️ WARN - Consider refactoring |

---

## 📋 Quick QA Report (for commit message)

**After checks complete, output:**

```markdown
## Pre-Commit QA Summary

**Changed Files:** [count] files
**Risk Level:** 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW

**Automated Checks:**
- TypeScript: ✅ PASS / ❌ FAIL
- ESLint: ✅ PASS / ❌ FAIL
- Tests: ✅ X/Y passed / ❌ X/Y failed
- Security Scan: ✅ CLEAR / ⚠️ WARNINGS

**Manual Checks:**
- Gatekeepers: ✅ VERIFIED / ⏭️ SKIPPED / ❌ MISSING
- Breaking Changes: ✅ NONE / ⚠️ DETECTED (frontend updated)
- Code Quality: ✅ GOOD / ⚠️ NEEDS REFACTORING

**Recommendation:**
- ✅ **SAFE TO COMMIT** - All checks pass
- ⚠️ **COMMIT WITH CAUTION** - Warnings present, review before push
- ❌ **DO NOT COMMIT** - Fix errors first
```

---

## 🚀 Integration with Git Workflow

### Option 1: Manual Check (Current)
```bash
# Before committing
/qa-commit

# If passes, then commit
git add .
git commit -m "feat: your change"
```

### Option 2: Automated Hook (Recommended)
**Add to `.husky/pre-commit`:**
```bash
#!/bin/sh
# Run lint-staged (ESLint + Prettier)
cd frontend && npx lint-staged

# Add TypeScript check for changed files
echo "🔍 TypeScript check..."
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Run '/qa-commit' for details."
  exit 1
fi

# Quick test for affected files
echo "🧪 Running affected tests..."
npm run test:run -- --changed --passWithNoTests
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Run '/qa-commit' for details."
  exit 1
fi

echo "✅ Pre-commit checks passed!"
```

### Option 3: Claude-Assisted Hook (Best for learning)
**When about to commit, ask Claude:**
```
/qa-commit
[Claude runs all checks and reports results]
[You decide: commit or fix issues]
```

---

## 📊 Speed Comparison

| Check Type | Time | When to Run |
|------------|------|-------------|
| **`/qa-commit`** | < 2 min | Before every commit |
| **Pre-push hook** | 2-5 min | Before push (automated) |
| **`/qa` (full)** | 1-2 hours | Before deployment/PR |
| **`/audit-code`** | 10-20 min | Weekly or before major release |

---

## 🎓 Philosophy: Defense in Depth

**Quality gates (from loose to strict):**

1. **Pre-commit** (`/qa-commit`): Fast, catches critical bugs ← **YOU ARE HERE**
2. **Pre-push** (git hook): Comprehensive tests, full lint
3. **CI Pipeline**: E2E tests, security scans, coverage
4. **Pre-deploy** (`/qa`): Full 15-phase QA, manual testing
5. **Production**: Monitoring, error tracking, canary deploy

**Think of it like airport security:**
- Pre-commit = Quick metal detector
- Pre-push = Bag X-ray
- CI = Full TSA screening
- /qa = Customs & immigration
- Production = Air marshal on plane

Each layer catches different issues. No single layer catches everything.

---

## 💡 Pro Tips

**Speed up checks:**
- Use `--changed` flag for tests (only run affected tests)
- Use `git diff` to focus on changed lines
- Skip manual checks for trivial changes (CSS tweaks, typos)

**Bypass for emergencies:**
```bash
git commit --no-verify -m "hotfix: critical production bug"
# Only use for REAL emergencies!
```

**Trust your instincts:**
- If change feels risky → Run full `/qa` before commit
- If change is trivial (typo fix) → Skip manual checks
- If touching auth/security → Extra scrutiny required

---

## 🔥 Remember

**Pre-commit QA is about SPEED + CRITICAL ISSUES.**

✅ **DO check:** Syntax, types, tests, security basics, gatekeepers
❌ **DON'T check:** Cross-browser, performance, accessibility (save for `/qa`)

**Goal:** Prevent obviously broken code from being committed.
**Non-goal:** Catch every possible bug (that's what `/qa` is for).

If in doubt, run `/qa-commit` before every commit. It's 2 minutes that could save 2 hours of debugging later. 🚀
