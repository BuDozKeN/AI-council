# QA - Pre-Push Quality Check (Silicon Valley Edition)

You are a QA engineer running final checks before code is pushed to GitHub. Your job is to catch errors BEFORE CI fails.

**Goal:** Run the same checks as GitHub CI locally + critical manual checks CI can't do.

**Time:** 7-12 minutes (comprehensive but fast enough for pre-push)

**Philosophy:** Fail fast locally, prevent production bugs, protect users.

---

## When to Run This

**RUN `/qa` in these situations:**
- ✅ After finishing coding, before `git push`
- ✅ Before creating a PR
- ✅ After fixing a bug, before committing the fix

**DON'T run for:**
- ❌ Trivial changes (typo fixes, comment updates) - just push
- ❌ Work in progress - commit often, QA before push

---

## Phase 1: Changed Files Inventory (10 seconds)

**What changed?**
```bash
git diff --name-only origin/$(git symbolic-ref --short HEAD) 2>/dev/null || git diff --name-only HEAD
```

**Categorize by risk:**
- 🔴 **HIGH RISK**: Database migrations, auth code, security code, API changes
- 🟡 **MEDIUM RISK**: Business logic, UI components, new features
- 🟢 **LOW RISK**: CSS, copy changes, test updates

**Output:**
```
Changed files:
- backend/routers/company/personas.py (MEDIUM)
- frontend/src/components/LLMHub.tsx (MEDIUM)
- supabase/migrations/20250114_add_persona.sql (HIGH)

Overall risk: HIGH (due to database migration)
```

---

## Phase 2: Static Analysis - Same as CI (3-5 minutes)

These are the SAME checks GitHub CI runs. Run them locally to catch issues early.

### 2.1 Frontend Checks
```bash
cd frontend

# ESLint (same as CI)
npm run lint

# Stylelint - CSS lint (same as CI) 🆕
npm run lint:css

# TypeScript (same as CI)
npm run type-check

# Prettier (same as CI)
npm run format:check

# Tests - OPTIMIZED: Only affected tests (30s vs 2-3min)
npm run test:run -- --changed --changedSince=origin/main --passWithNoTests
```

**Checklist:**
- [ ] ESLint passes (0 errors)
- [ ] Stylelint passes (0 CSS errors) 🆕
- [ ] TypeScript compiles (0 errors)
- [ ] Prettier formatted (0 files need formatting)
- [ ] Affected tests pass (X/X passed)

**If any fail:** ❌ **STOP** - Fix before continuing

**💡 Pro tip:** First time using `--changed`? It only runs tests for files you modified (10x faster).

### 2.2 Backend Checks
```bash
# Backend tests - OPTIMIZED: Only affected tests
# First-time setup: pip install pytest-testmon
pytest backend/tests/ --testmon -v --tb=short

# Coverage check (CI requires 40%+)
pytest backend/tests/ --cov=backend --cov-report=term-missing --cov-fail-under=40
```

**Checklist:**
- [ ] Affected tests pass (X/X passed)
- [ ] Coverage ≥ 40% (CI requirement)

**If any fail:** ❌ **STOP** - Fix before continuing

**💡 Pro tip:** `pytest-testmon` tracks which tests cover which code. After first run, only affected tests run.

### 2.3 Build Check
```bash
# Ensure frontend builds successfully (same as CI)
cd frontend && npm run build
```

**Checklist:**
- [ ] Build completes without errors
- [ ] No build warnings about missing dependencies

**If fails:** ❌ **STOP** - Fix before continuing

### 2.4 CSS Source Budget Check (same as CI) 🆕

**Why:** CI enforces a 1200KB CSS source budget. Exceeding it fails the build.

```bash
cd frontend

# Calculate total CSS source size (same check as CI)
CSS_SIZE=$(find src -name '*.css' -type f -exec cat {} + | wc -c)
CSS_KB=$((CSS_SIZE / 1024))
MAX_CSS_KB=1200

echo "📦 CSS Source Size: ${CSS_KB}KB / ${MAX_CSS_KB}KB"

if [ $CSS_KB -gt $MAX_CSS_KB ]; then
  echo "❌ FAIL: CSS budget exceeded (${CSS_KB}KB > ${MAX_CSS_KB}KB)"
  echo "Actions:"
  echo "  1. Remove unused CSS"
  echo "  2. Split large components"
  echo "  3. Use existing design tokens instead of new ones"
  exit 1
else
  REMAINING=$((MAX_CSS_KB - CSS_KB))
  PERCENT=$((CSS_KB * 100 / MAX_CSS_KB))
  echo "✅ PASS: ${PERCENT}% used, ${REMAINING}KB remaining"
fi

# Check for files over 800 lines (hard limit, excludes tailwind.css)
echo ""
echo "🔍 Checking for oversized CSS files (>800 lines)..."
LARGE_FILES=$(find src -name '*.css' -type f ! -name 'tailwind.css' -exec wc -l {} + | awk '$1 > 800 && $2 !~ /total/ {print "  ❌ " $1 " lines: " $2}')
if [ -n "$LARGE_FILES" ]; then
  echo "$LARGE_FILES"
  echo "❌ FAIL: Files over 800 lines must be split"
  exit 1
else
  echo "✅ All CSS files under 800 lines"
fi
```

**Checklist:**
- [ ] CSS source < 1200KB
- [ ] No CSS files > 800 lines (except tailwind.css)

**If fails:** ❌ **STOP** - CI will fail. Reduce CSS before pushing.

### 2.5 Accessibility Check (axe-core)

**Why:** Catches 40% of accessibility issues automatically. Prevents ADA lawsuits.

**Only if UI changed:**
```bash
if git diff --name-only HEAD | grep -qE "frontend/src/.*\.(tsx|jsx)"; then
  echo "♿ Running accessibility scan..."

  cd frontend

  # Install axe-core if not present
  npm list @axe-core/cli &>/dev/null || npm install -D @axe-core/cli

  # Run axe against built files
  npx @axe-core/cli dist --exit

  if [ $? -ne 0 ]; then
    echo "❌ Accessibility violations found"
    echo "Fix issues or run: npx @axe-core/cli dist --save violations.json"
    exit 1
  fi

  echo "✅ Accessibility check passed"
fi
```

**Checklist:**
- [ ] No critical a11y violations (color contrast, missing ARIA labels, keyboard traps)
- [ ] If violations found, fix or document as acceptable

**Common fixes:**
- Low contrast text: Adjust colors in design tokens
- Missing ARIA labels: Add `aria-label` to icon buttons
- Keyboard traps: Ensure Tab/Escape work in modals

**If fails:** ⚠️ **WARNING** - Fix before deploy (won't block push, but should fix)

### 2.6 Bundle Size Regression Check

**Why:** Prevents performance degradation. Every 1KB = ~1ms slower load on 3G.

**Only if frontend changed:**
```bash
if git diff --name-only HEAD | grep -qE "frontend/"; then
  echo "📦 Checking bundle size..."

  cd frontend

  # Get current bundle size (sum of all JS files in bytes)
  current_size=$(du -sb dist/assets/*.js 2>/dev/null | awk '{sum+=$1} END {print sum}')

  if [ -z "$current_size" ]; then
    echo "⚠️ No build found - run 'npm run build' first"
    exit 0
  fi

  # Get baseline from file (or use current if first run)
  baseline_file="/tmp/qa-bundle-baseline.txt"
  if [ -f "$baseline_file" ]; then
    baseline_size=$(cat "$baseline_file")
  else
    baseline_size=$current_size
    echo "$current_size" > "$baseline_file"
    echo "✅ Baseline set: $current_size bytes"
    exit 0
  fi

  # Calculate % increase
  increase=$(awk "BEGIN {printf \"%.1f\", ($current_size - $baseline_size) / $baseline_size * 100}")

  echo "Bundle size: $current_size bytes (baseline: $baseline_size bytes)"

  # Warn if > 10% increase
  if (( $(awk "BEGIN {print ($increase > 10)}") )); then
    echo "⚠️ WARNING: Bundle grew by ${increase}% (target: < 10%)"
    echo "Consider:"
    echo "  - Code splitting: Use React.lazy() for large components"
    echo "  - Tree shaking: Remove unused imports"
    echo "  - Lazy loading: Load heavy libraries on-demand"
    read -p "Continue anyway? (y/N): " confirm
    [[ "$confirm" != "y" ]] && exit 1
  else
    echo "✅ Bundle size acceptable (+${increase}%)"
  fi

  # Update baseline for next run
  echo "$current_size" > "$baseline_file"
fi
```

**Checklist:**
- [ ] Bundle growth < 10% from baseline
- [ ] If > 10%, code splitting or lazy loading added

**If fails:** ⚠️ **WARNING** - Review before deploy (won't block, but should investigate)

---

## Phase 3: Critical Manual Checks (3-5 minutes)

These are checks CI **cannot do** - they require human judgment or context awareness.

### 3.1 Gatekeeper Verification (CRITICAL)

**Remember the `EDITABLE_PERSONAS` bug!** If you're adding a new entity (persona, role, department, etc.), check for hardcoded lists.

**Search for gatekeepers:**
```bash
# Backend gatekeepers
grep -rn "EDITABLE\|ALLOWED\|VISIBLE\|ENABLED\|_LIST\|_KEYS" backend/routers/ | grep -v test

# Frontend gatekeepers
grep -rn "PERSONA_\|ROLE_\|ALLOWED_\|ENABLED_\|_KEYS\|_ICONS" frontend/src/components/ frontend/src/lib/
```

**For EACH gatekeeper found, verify:**
- [ ] Is the new entity included in the list?
- [ ] If backend list exists, does frontend have matching mapping?
- [ ] Are translation keys added (en.json, es.json)?

**Example:**
```
Found gatekeepers:
- backend/routers/company/personas.py:15: EDITABLE_PERSONAS = ["ceo", "cto", ...]
  → ✅ "persona_architect" is in the list
- frontend/src/components/PersonaIcon.tsx:8: PERSONA_ICONS = { ceo: "👔", ... }
  → ❌ MISSING "persona_architect" - ADD IT!
```

**If gatekeeper missing:** ⚠️ **HIGH RISK** - Feature will appear in DB but not in UI

### 3.2 Breaking Change Detection

**If you changed API endpoints, database schema, or TypeScript types:**

**Check for breaking changes:**
```bash
# Did you remove any exports?
git diff origin/$(git symbolic-ref --short HEAD) | grep "^-export"

# Did you change API routes?
git diff origin/$(git symbolic-ref --short HEAD) -- backend/routers/ | grep "@router\."

# Did you change database schema?
git diff origin/$(git symbolic-ref --short HEAD) -- supabase/migrations/
```

**For EACH breaking change:**
- [ ] Frontend updated to match new API?
- [ ] Database migration has rollback (DOWN migration)?
- [ ] No removed exports that other files depend on?

**Example:**
```
Breaking change detected:
- backend/routers/personas.py: Removed endpoint DELETE /api/personas/{id}
  → Check: Is frontend still calling this? Search: grep -r "DELETE.*personas" frontend/src/
  → Result: ✅ Frontend already removed calls
```

### 3.3 Database Migration Safety Check 🆕 (CRITICAL)

**Why:** One bad migration = hours of downtime + data loss. This prevents disasters.

**Only if migration exists:**
```bash
if git diff --name-only HEAD | grep -q "supabase/migrations/"; then
  echo "🗄️ Database migration detected - running safety checks..."

  latest_migration=$(ls -t supabase/migrations/*.sql 2>/dev/null | head -1)

  if [ -z "$latest_migration" ]; then
    echo "⚠️ WARNING: No migration file found in supabase/migrations/"
    exit 0
  fi

  echo "Checking: $latest_migration"

  # CRITICAL CHECK 1: Rollback (DOWN migration)
  if ! grep -q "-- DOWN" "$latest_migration"; then
    echo "❌ BLOCK: No DOWN migration found"
    echo "Add a '-- DOWN' section with rollback commands:"
    echo ""
    echo "-- DOWN"
    echo "ALTER TABLE users DROP COLUMN new_column;"
    echo ""
    exit 1
  fi

  # CRITICAL CHECK 2: Destructive operations
  if grep -qE "DROP (COLUMN|TABLE)|TRUNCATE" "$latest_migration"; then
    echo "⚠️ WARNING: Destructive operation detected (DROP/TRUNCATE)"
    echo "This operation is IRREVERSIBLE. Ensure you have:"
    echo "  1. Database backup"
    echo "  2. Data export if needed"
    echo "  3. Product manager approval"
    cat "$latest_migration" | grep -E "DROP|TRUNCATE"
    echo ""
    read -p "Continue with destructive migration? (yes/NO): " confirm
    [[ "$confirm" != "yes" ]] && exit 1
  fi

  # WARNING CHECK: Adding NOT NULL without DEFAULT
  if grep -qE "ADD COLUMN.*NOT NULL" "$latest_migration" | grep -qv "DEFAULT"; then
    echo "⚠️ WARNING: Adding NOT NULL column without DEFAULT value"
    echo "This will FAIL if table has existing rows"
    echo "Add DEFAULT value or make column nullable initially"
  fi

  echo "✅ Migration safety checks passed"
  echo "Remember to test:"
  echo "  1. Apply migration: supabase db push"
  echo "  2. Verify data: Run test queries"
  echo "  3. Test rollback: Use DOWN migration"
fi
```

**Checklist:**
- [ ] DOWN migration exists (rollback possible)
- [ ] No DROP TABLE/COLUMN without backup
- [ ] No NOT NULL without DEFAULT on existing tables
- [ ] Migration tested locally (applied + rolled back)

**If fails:** ❌ **BLOCK** - Fix migration before push

**Common migration mistakes:**
- ❌ `DROP COLUMN email` → Data lost forever
- ✅ `ADD COLUMN email_new` → Safe, can rollback
- ❌ `ADD COLUMN age INT NOT NULL` → Fails on existing rows
- ✅ `ADD COLUMN age INT DEFAULT 0` → Safe for existing rows

### 3.4 API Contract Validation 🆕

**Why:** Prevents runtime errors from type mismatches (frontend expects `userId`, backend sends `user_id`).

**Only if API changed:**
```bash
if git diff --name-only HEAD | grep -q "backend/routers/"; then
  echo "🔌 API changes detected - validating contracts..."

  # CHECK 1: OpenAPI spec updated?
  if git diff --name-only HEAD | grep -qE "backend/routers/.*\.py"; then
    if ! git diff --name-only HEAD | grep -q "openapi"; then
      echo "⚠️ INFO: API changed but OpenAPI spec may be outdated"
      echo "Consider updating: http://localhost:8081/docs"
    fi
  fi

  # CHECK 2: snake_case vs camelCase alignment
  backend_changes=$(git diff HEAD -- backend/routers/ | grep -E "^\+.*class.*BaseModel" -A 20 || true)

  if echo "$backend_changes" | grep -q "_"; then
    echo "📋 Backend uses snake_case fields detected"
    echo "Verify frontend uses camelCase (automatic conversion should work)"

    # Look for common mismatches in changed files
    if git diff HEAD -- frontend/src/ | grep -qE "userId|userName|companyId"; then
      echo "✅ Frontend appears to use camelCase correctly"
    else
      echo "⚠️ Check frontend types match backend Pydantic models"
    fi
  fi

  # CHECK 3: Response type changes
  if git diff HEAD -- backend/routers/ | grep -qE "^\+.*return \{"; then
    echo "⚠️ API response structure changed"
    echo "Verify frontend TypeScript types updated:"
    echo "  1. Check types in frontend/src/types/"
    echo "  2. Run type-check: npm run type-check"
  fi

  echo "✅ API contract validation complete"
fi
```

**Checklist:**
- [ ] Backend Pydantic models match frontend TypeScript types
- [ ] snake_case (backend) → camelCase (frontend) conversion works
- [ ] Response format changes reflected in frontend types

**If mismatches found:** ⚠️ **HIGH RISK** - Fix before deploy (runtime errors likely)

**Common contract issues:**
- Backend: `{ user_id: "123" }` → Frontend expects: `{ userId: "123" }` ✅ (auto-converts)
- Backend: `{ data: [...] }` → Frontend expects: `[...]` ❌ (breaks!)

### 3.5 Observability Verification 🆕

**Why:** Can't debug production issues without logs. Can't measure feature success without metrics.

**Only if new API endpoint or feature:**
```bash
if git diff HEAD -- backend/routers/ | grep -qE "^\+.*@router\.(get|post|put|delete)"; then
  echo "📊 New API endpoint detected - checking observability..."

  # CHECK 1: Logging present?
  if git diff HEAD -- backend/routers/ | grep -A 30 "@router" | grep -q "logger\.\(info\|debug\|error\)"; then
    echo "✅ Logging found in new endpoint"
  else
    echo "⚠️ WARNING: New endpoint has no logging"
    echo "Add: logger.info(f'Endpoint {request.url} called by {user_id}')"
  fi

  # CHECK 2: Error handling with Sentry
  if git diff HEAD -- backend/routers/ | grep -q "try.*except"; then
    echo "✅ Error handling present (Sentry will catch exceptions)"
  else
    echo "⚠️ WARNING: No try/except block - errors may go untracked"
    echo "Add error handling around critical operations"
  fi

  # CHECK 3: Metrics for new features (optional)
  if git diff HEAD -- backend/routers/ | grep -qE "track_event|increment|gauge"; then
    echo "✅ Metrics instrumentation found"
  else
    echo "💡 INFO: Consider adding metrics for usage tracking"
  fi

  echo "✅ Observability check complete"
fi
```

**Checklist:**
- [ ] New endpoints have `logger.info()` calls
- [ ] Error handling present (try/except with Sentry)
- [ ] Critical operations have metrics (optional but recommended)

**If missing:** ⚠️ **MEDIUM RISK** - Add logging before deploy (can't debug without it)

### 3.6 Data Flow Verification (for new features)

**If you added a new feature, trace the data flow end-to-end:**

**Database → Backend → API → Frontend → UI**

**Quick checklist:**
- [ ] **Database**: Data exists (run query in Supabase dashboard)
  ```sql
  SELECT * FROM [table] WHERE [condition];
  ```
- [ ] **Backend**: API endpoint returns the data
  ```bash
  # Test locally
  curl http://localhost:8081/api/endpoint -H "Authorization: Bearer <token>"
  ```
- [ ] **Frontend**: Data appears in UI
  - Open http://localhost:5173
  - Navigate to the feature
  - Verify data displays correctly

**Example:**
```
New feature: "Persona Architect"
✅ Database: SELECT * FROM roles WHERE id = 'persona_architect'; → Returns row
✅ Backend: curl /api/personas → Includes "persona_architect"
❌ Frontend: Persona dropdown doesn't show it → CHECK GATEKEEPER (PERSONA_ICONS)!
```

### 3.7 Translation Keys (for UI changes)

**If you added new UI text:**

**Check translation completeness:**
```bash
cd frontend/src/locales

# Compare keys across language files
diff <(jq -r 'keys[]' en.json | sort) <(jq -r 'keys[]' es.json | sort)
```

**Checklist:**
- [ ] New keys exist in **ALL** language files (en.json, es.json)
- [ ] No hardcoded strings in UI (use `t('key')` instead)

**Example:**
```
Added new button: "Add Persona Architect"
✅ en.json: "personas.architect.add": "Add Persona Architect"
❌ es.json: Missing key!
→ FIX: Add "personas.architect.add": "Agregar Arquitecto de Persona"
```

---

## Phase 4: Quick Security Check (1 minute)

**CI runs Gitleaks/Bandit/CodeQL, but do a quick manual scan:**

**Search for obvious security issues:**
```bash
# Hardcoded secrets
git diff HEAD | grep -iE "(password|secret|api_key|token).*=.*['\"]" && echo "❌ Possible secret found!" || echo "✅ No obvious secrets"

# SQL injection risk
git diff HEAD | grep -E "execute\(.*\+.*\)" && echo "❌ SQL injection risk!" || echo "✅ No string concatenation in SQL"

# XSS risk
git diff HEAD | grep "dangerouslySetInnerHTML" && echo "⚠️ XSS risk - ensure sanitized" || echo "✅ No dangerouslySetInnerHTML"
```

**Checklist:**
- [ ] No hardcoded passwords, API keys, secrets
- [ ] No SQL string concatenation (use parameterized queries)
- [ ] No `dangerouslySetInnerHTML` without sanitization

**If found:** ❌ **CRITICAL** - Remove before committing

---

## Phase 5: Pre-Push Checklist (30 seconds)

**Final checks before pushing:**

### 5.1 Documentation
- [ ] `.env.example` updated if new env vars added?
- [ ] `CLAUDE.md` updated if new patterns/gotchas?
- [ ] Migration documented if database schema changed?

### 5.2 Commit Quality
- [ ] Commit message descriptive (not "fix" or "wip")?
- [ ] No commented-out code committed?
- [ ] No `console.log` or `print()` debug statements?

### 5.3 Git Sanity
- [ ] On correct branch (not committing to `main` directly)?
- [ ] Latest changes pulled from remote?
  ```bash
  git fetch origin
  git status
  ```

---

## QA Report Output

**After all phases, produce this summary:**

```markdown
## QA Report - Ready to Push?

**Date:** 2025-01-14
**Branch:** claude/enhance-qa-best-practices-1lTd9
**Changed Files:** 3 files
**Overall Risk:** 🟡 MEDIUM

---

### Static Analysis (CI Checks Run Locally)
- ESLint: ✅ PASS
- Stylelint (CSS): ✅ PASS
- TypeScript: ✅ PASS
- Prettier: ✅ PASS
- Frontend Tests: ✅ 12/145 affected passed (--changed flag)
- Backend Tests: ✅ 8/289 affected passed (--testmon)
- Coverage: ✅ 72% (target: 40%+)
- Build: ✅ SUCCESS
- CSS Budget: ✅ 1050KB / 1200KB (88% used)
- Accessibility: ✅ PASS (0 violations)
- Bundle Size: ✅ +2.3% (target: < 10%)

### Critical Manual Checks
- Gatekeepers: ✅ VERIFIED (2 found, both updated)
- Breaking Changes: ✅ NONE
- Migration Safety: ✅ VERIFIED (DOWN migration exists, no destructive ops)
- API Contracts: ✅ VALIDATED (types match)
- Observability: ✅ VERIFIED (logging + error handling present)
- Data Flow: ✅ VERIFIED (DB → Backend → UI)
- Translation Keys: ✅ COMPLETE (en.json, es.json)

### Security Quick Scan
- Hardcoded Secrets: ✅ NONE FOUND
- SQL Injection Risk: ✅ SAFE
- XSS Risk: ✅ SAFE

### Pre-Push Checklist
- Documentation: ✅ Updated
- Commit Quality: ✅ GOOD
- Git Sanity: ✅ ON BRANCH, UP TO DATE

---

## Recommendation

✅ **SAFE TO PUSH**

All checks pass. CI will run the same checks again remotely:
- ci.yml: ESLint, TypeScript, tests, build, E2E
- security.yml: CodeQL, Bandit, Gitleaks, npm/pip audit

Expected result: ✅ All CI checks will pass

---

## Push Commands

git push -u origin claude/enhance-qa-best-practices-1lTd9
```

---

## Fast-Fail Criteria

**BLOCK push if ANY of these:**

❌ **TypeScript errors** → CI will fail
❌ **ESLint errors** → CI will fail
❌ **Stylelint errors** → CI will fail
❌ **CSS budget exceeded (>1200KB)** → CI will fail
❌ **Tests fail** → CI will fail
❌ **Build fails** → CI will fail
❌ **Hardcoded secrets** → Security risk
❌ **Gatekeeper missing** → Feature won't work (learned from `EDITABLE_PERSONAS` bug)
❌ **Migration has no DOWN** → Can't rollback, data loss risk

**WARN but allow push if:**

⚠️ **Breaking change detected** → Verify frontend updated
⚠️ **Missing translations** → Will show English fallback
⚠️ **Bundle size > 10%** → Performance impact, review needed
⚠️ **No logging on new endpoint** → Can't debug in production
⚠️ **Accessibility violations** → Should fix, but won't block

---

## What CI Will Do After Push

**Your push triggers GitHub Actions:**

1. **ci.yml** (5-10 minutes):
   - Backend tests (you already ran affected tests ✅)
   - Frontend lint/type-check (you already ran ✅)
   - Frontend tests (you already ran affected tests ✅)
   - Build (you already ran ✅)
   - **E2E tests (Playwright)** ← CI-only, you didn't run locally

2. **security.yml** (10-15 minutes):
   - CodeQL (SAST) ← CI does this deeply, you did quick scan
   - Bandit (Python security) ← CI does this deeply
   - Gitleaks (secrets) ← CI does this deeply, you did quick scan
   - npm/pip audit ← CI does this deeply

**Expected result:** ✅ All should pass (you ran the same checks locally)

**If CI fails on E2E or security scans:** That's OKAY - those are slow checks you intentionally skipped locally.

---

## Commands Quick Reference

```bash
# ====================
# PHASE 1: INVENTORY
# ====================
git diff --name-only HEAD

# ====================
# PHASE 2: CI CHECKS
# ====================

# Frontend (optimized with --changed flag)
cd frontend
npm run lint
npm run lint:css          # Stylelint - catches CSS errors before CI
npm run type-check
npm run format:check
npm run test:run -- --changed --changedSince=origin/main --passWithNoTests
npm run build

# CSS Budget check (same as CI - 1300KB limit)
find src -name '*.css' -type f -exec cat {} + | wc -c | awk '{kb=int($1/1024); if(kb>1200) print "❌ FAIL: "kb"KB > 1200KB"; else print "✅ CSS: "kb"KB / 1200KB"}'

# Accessibility (if UI changed)
npx @axe-core/cli dist --exit

# Bundle size (if frontend changed)
du -sb dist/assets/*.js | awk '{sum+=$1} END {print sum}'

# Backend (optimized with --testmon)
pytest backend/tests/ --testmon -v --tb=short
pytest backend/tests/ --cov=backend --cov-fail-under=40

# ====================
# PHASE 3: MANUAL CHECKS
# ====================

# Gatekeeper search
grep -rn "EDITABLE\|ALLOWED\|_LIST" backend/routers/ frontend/src/

# Breaking changes
git diff origin/$(git symbolic-ref --short HEAD) | grep "^-export"

# Migration safety (if migration exists)
latest_migration=$(ls -t supabase/migrations/*.sql | head -1)
grep "-- DOWN" "$latest_migration"
grep -E "DROP|TRUNCATE" "$latest_migration"

# API contracts (if backend changed)
git diff HEAD -- backend/routers/ | grep -E "@router\."

# Observability (if new endpoint)
git diff HEAD -- backend/routers/ | grep -A 30 "@router" | grep "logger"

# Translation keys
cd frontend/src/locales
diff <(jq -r 'keys[]' en.json | sort) <(jq -r 'keys[]' es.json | sort)

# ====================
# PHASE 4: SECURITY
# ====================
git diff HEAD | grep -iE "(password|secret|api_key).*=.*['\"]"
git diff HEAD | grep "dangerouslySetInnerHTML"

# ====================
# PHASE 5: PUSH
# ====================
git status
git push -u origin <branch-name>
```

---

## Pro Tips

**Speed up QA (run checks in parallel):**
```bash
# Terminal 1: Frontend static checks (lint + CSS lint + type-check + format)
cd frontend && npm run lint && npm run lint:css && npm run type-check && npm run format:check

# Terminal 2: Frontend tests + build + CSS budget
cd frontend && npm run test:run -- --changed && npm run build && \
  find src -name '*.css' -type f -exec cat {} + | wc -c | awk '{kb=int($1/1024); print "CSS: "kb"KB / 1200KB"}'

# Terminal 3: Backend tests
pytest backend/tests/ --testmon -v

# All 3 run simultaneously = 3-4 min total vs 7-8 min sequential
```

**When to run full manual checks:**
- 🔴 HIGH RISK changes (database, auth, security)
- New features (data flow needs verification)
- API changes (contract validation, migration safety)
- UI changes (translation keys, accessibility)

**When to skip manual checks:**
- 🟢 LOW RISK changes (CSS tweaks, copy updates)
- Test-only changes
- Documentation updates

**First-time setup (optimization):**
```bash
# Install axe-core for accessibility
cd frontend && npm install -D @axe-core/cli

# Install pytest-testmon for affected tests
pip install pytest-testmon

# Run once to establish baseline
pytest backend/tests/ --testmon
```

**Emergency bypass:**
```bash
# If absolutely necessary (production hotfix)
git push --no-verify
# ⚠️ Only use for REAL emergencies!
```

---

## What's New in This Version? 🆕

**Optimizations (saves 4-5 minutes):**
- ✅ Affected tests only (`--changed`, `--testmon`) - 30s vs 5min

**New Critical Checks (adds 4-5 minutes):**
- ✅ Database migration safety - Prevents data loss
- ✅ API contract validation - Prevents runtime errors
- ✅ Observability verification - Ensures logging/metrics

**New Quality Checks (adds 2-3 minutes):**
- ✅ Accessibility (axe-core) - Legal compliance, 40% of a11y issues
- ✅ Bundle size regression - Performance monitoring

**Net time:** ~Same as before (7-12 min) due to test optimization, but catches 5x more critical bugs!

---

## Weekly: Complement with `/audit-code`

**This `/qa` focuses on functional correctness. For code quality, run `/audit-code` weekly:**

- `/qa` → Catches bugs, security issues, breaking changes, migrations, performance
- `/audit-code` → Catches code smells, architecture issues, tech debt

**Weekly workflow:**
```bash
# Monday morning
/audit-code

# Review findings
# Create issues for critical items
# Plan refactoring for next sprint
```

---

## Remember

**QA is about catching errors BEFORE GitHub CI does, and BEFORE users find them.**

✅ **Run the same checks as CI locally** → Catch issues in 7 min vs waiting 15 min for CI
✅ **Add checks CI can't do** → Gatekeepers, migrations, contracts, observability
✅ **Optimize for speed** → Affected tests only (10x faster)
✅ **Prevent critical bugs** → Migration safety, API contracts save hours of debugging

**Goal:** Green checkmarks on GitHub, zero production bugs. 🎯

If `/qa` passes, CI will pass (except for E2E or rare security findings).

**Push with confidence.** 🚀
