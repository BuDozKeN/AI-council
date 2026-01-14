# QA - Pre-Push Quality Check

You are a QA engineer running final checks before code is pushed to GitHub. Your job is to catch errors BEFORE CI fails.

**Goal:** Run the same checks as GitHub CI locally + critical manual checks CI can't do.

**Time:** 5-10 minutes (fast enough to run before every push)

**Philosophy:** Fail fast locally, so CI doesn't have to.

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

## Phase 2: Static Analysis - Same as CI (2-3 minutes)

These are the SAME checks GitHub CI runs. Run them locally to catch issues early.

### 2.1 Frontend Checks
```bash
cd frontend

# ESLint (same as CI)
npm run lint

# TypeScript (same as CI)
npm run type-check

# Prettier (same as CI)
npm run format:check

# Tests (same as CI)
npm run test:run
```

**Checklist:**
- [ ] ESLint passes (0 errors)
- [ ] TypeScript compiles (0 errors)
- [ ] Prettier formatted (0 files need formatting)
- [ ] All tests pass (X/X passed)

**If any fail:** ❌ **STOP** - Fix before continuing

### 2.2 Backend Checks
```bash
# Backend tests (same as CI)
pytest backend/tests/ -v --tb=short

# Coverage check (CI requires 40%+)
pytest backend/tests/ --cov=backend --cov-report=term-missing --cov-fail-under=40
```

**Checklist:**
- [ ] All backend tests pass (X/X passed)
- [ ] Coverage ≥ 40% (CI requirement)

**If any fail:** ❌ **STOP** - Fix before continuing

### 2.3 Build Check
```bash
# Ensure frontend builds successfully (same as CI)
cd frontend && npm run build
```

**Checklist:**
- [ ] Build completes without errors
- [ ] No build warnings about missing dependencies

**If fails:** ❌ **STOP** - Fix before continuing

---

## Phase 3: Critical Manual Checks (2-3 minutes)

These are checks CI **cannot do** - they require human judgment.

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

### 3.3 Data Flow Verification (for new features)

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

### 3.4 Translation Keys (for UI changes)

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
git diff HEAD | grep -iE "(password|secret|api_key|token).*=.*['\"]" || echo "✅ No obvious secrets"

# SQL injection risk
git diff HEAD | grep -E "execute\(.*\+.*\)" || echo "✅ No string concatenation in SQL"

# XSS risk
git diff HEAD | grep "dangerouslySetInnerHTML" || echo "✅ No dangerouslySetInnerHTML"
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
- TypeScript: ✅ PASS
- Prettier: ✅ PASS
- Frontend Tests: ✅ 145/145 passed
- Backend Tests: ✅ 289/289 passed
- Coverage: ✅ 72% (target: 40%+)
- Build: ✅ SUCCESS

### Critical Manual Checks
- Gatekeepers: ✅ VERIFIED (2 found, both updated)
- Breaking Changes: ✅ NONE
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
❌ **Tests fail** → CI will fail
❌ **Build fails** → CI will fail
❌ **Hardcoded secrets** → Security risk
❌ **Gatekeeper missing** → Feature won't work (learned from `EDITABLE_PERSONAS` bug)

**WARN but allow push if:**

⚠️ **Breaking change detected** → Verify frontend updated
⚠️ **Missing translations** → Will show English fallback
⚠️ **Low test coverage** → CI requires 40%+, you have it

---

## What CI Will Do After Push

**Your push triggers GitHub Actions:**

1. **ci.yml** (5-10 minutes):
   - Backend tests (you already ran locally ✅)
   - Frontend lint/type-check (you already ran locally ✅)
   - Frontend tests (you already ran locally ✅)
   - Build (you already ran locally ✅)
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

# Frontend
cd frontend
npm run lint
npm run type-check
npm run format:check
npm run test:run
npm run build

# Backend
pytest backend/tests/ -v --tb=short
pytest backend/tests/ --cov=backend --cov-fail-under=40

# ====================
# PHASE 3: MANUAL CHECKS
# ====================

# Gatekeeper search
grep -rn "EDITABLE\|ALLOWED\|_LIST" backend/routers/ frontend/src/

# Breaking changes
git diff origin/$(git symbolic-ref --short HEAD) | grep "^-export"

# Translation keys
cd frontend/src/locales
diff <(jq -r 'keys[]' en.json | sort) <(jq -r 'keys[]' es.json | sort)

# ====================
# PHASE 4: SECURITY
# ====================
git diff HEAD | grep -iE "(password|secret|api_key).*=.*['\"]"

# ====================
# PHASE 5: PUSH
# ====================
git status
git push -u origin <branch-name>
```

---

## Pro Tips

**Speed up QA:**
- Frontend checks run in parallel: Open 2 terminals
  - Terminal 1: `npm run lint && npm run type-check`
  - Terminal 2: `npm run test:run`
- Skip manual checks for trivial changes (typos, comments)
- Trust your CI: If you're unsure, push and let CI catch it

**When to run full manual checks:**
- 🔴 HIGH RISK changes (database, auth, security)
- New features (data flow needs verification)
- API changes (breaking change detection)
- UI changes (translation keys)

**When to skip manual checks:**
- 🟢 LOW RISK changes (CSS tweaks, copy updates)
- Test-only changes
- Documentation updates

**Emergency bypass:**
```bash
# If absolutely necessary (production hotfix)
git push --no-verify
# ⚠️ Only use for REAL emergencies!
```

---

## Weekly: Complement with `/audit-code`

**This `/qa` focuses on functional correctness. For code quality, run `/audit-code` weekly:**

- `/qa` → Catches bugs, security issues, breaking changes
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

**QA is about catching errors BEFORE GitHub CI does.**

✅ **Run the same checks as CI locally** → Catch issues in 5 min vs waiting 10 min for CI
✅ **Add manual checks CI can't do** → Gatekeepers, data flow, breaking changes
✅ **Trust CI for slow checks** → E2E, deep security scans (too slow locally)

**Goal:** Green checkmarks on GitHub, every time. 🎯

If `/qa` passes, CI will pass (except for E2E or rare security findings).

**Push with confidence.** 🚀
