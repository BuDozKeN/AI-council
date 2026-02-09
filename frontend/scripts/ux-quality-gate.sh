#!/bin/bash
#
# UX Quality Gate - Comprehensive UX/UI checks before push
#
# Orchestrates all UX testing tools into a single pass/fail gate.
# Run manually: ./scripts/ux-quality-gate.sh
# Or via npm:   npm run ux:gate
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more checks failed
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$FRONTEND_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo -e "  ${GREEN}PASS${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "  ${RED}FAIL${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "  ${YELLOW}WARN${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

section() {
  echo ""
  echo -e "${BLUE}${BOLD}=== $1 ===${NC}"
}

echo ""
echo -e "${BOLD}UX QUALITY GATE${NC}"
echo -e "${BOLD}Checking UX/UI quality across all dimensions...${NC}"

# ============================================================
section "1. TypeScript Type Safety"
# ============================================================
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compilation - no type errors"
else
  fail "TypeScript compilation has errors (run: npm run type-check)"
fi

# ============================================================
section "2. ESLint (jsx-a11y accessibility rules)"
# ============================================================
if npx eslint src/ --quiet 2>/dev/null; then
  pass "ESLint - no errors (including jsx-a11y accessibility rules)"
else
  warn "ESLint has warnings or errors (run: npm run lint)"
fi

# ============================================================
section "3. CSS Budget Check"
# ============================================================
CSS_SIZE=$(find src/ -name "*.css" -exec cat {} + 2>/dev/null | wc -c)
CSS_SIZE_KB=$((CSS_SIZE / 1024))
if [ "$CSS_SIZE_KB" -lt 1350 ]; then
  pass "CSS source budget: ${CSS_SIZE_KB}KB / 1350KB"
else
  fail "CSS source budget exceeded: ${CSS_SIZE_KB}KB / 1350KB"
fi

# Check for files over 300 lines
LARGE_CSS_COUNT=0
while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt 300 ]; then
    LARGE_CSS_COUNT=$((LARGE_CSS_COUNT + 1))
  fi
done < <(find src/ -name "*.css" -print0 2>/dev/null)

if [ "$LARGE_CSS_COUNT" -eq 0 ]; then
  pass "No CSS files exceed 300-line limit"
else
  warn "$LARGE_CSS_COUNT CSS file(s) over 300 lines -- split into smaller components"
fi

# ============================================================
section "4. Production Build"
# ============================================================
if npm run build 2>/dev/null; then
  pass "Production build succeeds"

  if [ -d "dist" ]; then
    BUNDLE_SIZE=$(du -sb dist/ | cut -f1)
    BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))
    if [ "$BUNDLE_SIZE_KB" -lt 5000 ]; then
      pass "Bundle size: ${BUNDLE_SIZE_KB}KB (under 5MB)"
    else
      warn "Bundle size is large: ${BUNDLE_SIZE_KB}KB -- consider code splitting"
    fi
  fi
else
  fail "Production build failed"
fi

# ============================================================
section "5. Accessibility Tests (axe-core + Playwright)"
# ============================================================
if npx playwright test e2e/accessibility.spec.ts --reporter=list 2>/dev/null; then
  pass "WCAG 2.1 AA accessibility -- all checks passing"
else
  fail "Accessibility violations found (run: npx playwright test e2e/accessibility.spec.ts)"
fi

# ============================================================
section "6. Visual Regression Baseline"
# ============================================================
if npx playwright test e2e/visual-regression.spec.ts --reporter=list 2>/dev/null; then
  pass "Visual regression baselines match"
else
  warn "Visual changes detected -- update baselines if intentional (--update-snapshots)"
fi

# ============================================================
section "7. Core E2E Tests"
# ============================================================
if npx playwright test e2e/app-loads.spec.ts e2e/login.spec.ts --reporter=list 2>/dev/null; then
  pass "Core E2E tests (app load, login flow) passing"
else
  fail "Core E2E tests failed (run: npx playwright test e2e/app-loads.spec.ts)"
fi

# ============================================================
section "8. UX Quality Metrics (touch targets, contrast, CLS)"
# ============================================================
if npx playwright test e2e/visual-regression-full.spec.ts --reporter=list 2>/dev/null; then
  pass "UX quality metrics -- touch targets, contrast, layout stability all good"
else
  warn "UX quality tests found issues (run: npx playwright test e2e/visual-regression-full.spec.ts)"
fi

# ============================================================
section "9. Lighthouse Performance"
# ============================================================
if npx lhci --version &>/dev/null; then
  if npx lhci autorun 2>/dev/null; then
    pass "Lighthouse CI -- performance, a11y, best-practices all above threshold"
  else
    warn "Lighthouse CI found performance concerns (run: npx lhci autorun)"
  fi
else
  warn "Lighthouse CI not available -- install with: npm i -D @lhci/cli"
fi

# ============================================================
section "10. Percy Visual Snapshots (cloud)"
# ============================================================
if [ -n "$PERCY_TOKEN" ]; then
  if npx percy exec -- npx playwright test e2e/percy-visual.spec.ts 2>/dev/null; then
    pass "Percy visual snapshots captured and uploaded"
  else
    warn "Percy snapshot capture had issues"
  fi
else
  warn "Percy skipped -- set PERCY_TOKEN env var to enable cloud visual testing"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}        UX QUALITY GATE RESULTS${NC}"
echo -e "${BOLD}============================================${NC}"
echo -e "  ${GREEN}Passed:${NC}   $PASS_COUNT"
echo -e "  ${RED}Failed:${NC}   $FAIL_COUNT"
echo -e "  ${YELLOW}Warnings:${NC} $WARN_COUNT"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}GATE: FAILED${NC}"
  echo -e "  Fix $FAIL_COUNT failure(s) before pushing."
  echo ""
  exit 1
else
  if [ "$WARN_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}${BOLD}GATE: PASSED (with warnings)${NC}"
    echo -e "  Review $WARN_COUNT warning(s) above."
  else
    echo -e "  ${GREEN}${BOLD}GATE: PASSED${NC}"
  fi
  echo ""
  exit 0
fi
