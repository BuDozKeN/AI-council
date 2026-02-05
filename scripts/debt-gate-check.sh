#!/bin/bash
# =============================================================================
# GUARD-5: No-New-Debt Gate Check
# =============================================================================
# Run this BEFORE merging any tech debt remediation PR.
# All counts must be <= baseline. If any gate fails, do NOT merge.
#
# Usage: bash scripts/debt-gate-check.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_gate() {
  local name="$1"
  local current="$2"
  local baseline="$3"

  if [ "$current" -gt "$baseline" ]; then
    echo -e "${RED}FAIL${NC}: $name — $current (baseline: $baseline, +$((current - baseline)))"
    FAIL=$((FAIL + 1))
  elif [ "$current" -lt "$baseline" ]; then
    echo -e "${GREEN}PASS${NC}: $name — $current (baseline: $baseline, improved by $((baseline - current)))"
    PASS=$((PASS + 1))
  else
    echo -e "${GREEN}PASS${NC}: $name — $current (baseline: $baseline, unchanged)"
    PASS=$((PASS + 1))
  fi
}

echo "============================================="
echo " GUARD-5: No-New-Debt Gate Check"
echo " Baseline: 2026-02-05"
echo "============================================="
echo ""

# --- Frontend Gates ---
echo "--- Frontend ---"

ESLINT_DISABLE=$(grep -rn "eslint-disable" frontend/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
check_gate "eslint-disable comments" "$ESLINT_DISABLE" 63

ANY_TYPES=$(grep -rn ": any" frontend/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
check_gate "': any' type annotations" "$ANY_TYPES" 2

AS_ANY=$(grep -rn "as any" frontend/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
check_gate "'as any' casts" "$AS_ANY" 1

CSS_OVER=$(find frontend/src -name "*.css" -exec wc -l {} \; 2>/dev/null | awk '$1 > 300' | wc -l | tr -d ' ')
check_gate "CSS files > 300 lines" "$CSS_OVER" 15

echo ""
echo "--- Backend ---"

EXCEPT_BROAD=$(grep -rn "except Exception" backend/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
check_gate "except Exception handlers" "$EXCEPT_BROAD" 298

RLS_BYPASS=$(grep -rn "get_supabase_service" backend/ --include="*.py" 2>/dev/null | wc -l | tr -d ' ')
check_gate "get_supabase_service() calls" "$RLS_BYPASS" 129

echo ""
echo "--- Build Checks ---"

echo -n "Frontend lint... "
cd frontend
if npm run lint 2>&1 | grep -q "0 errors"; then
  echo -e "${GREEN}PASS${NC} (0 errors)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC} (has errors)"
  FAIL=$((FAIL + 1))
fi

echo -n "Frontend type-check... "
if npm run type-check 2>&1 | grep -qv "error TS"; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
fi

echo -n "Frontend tests... "
TEST_OUTPUT=$(npm run test:run 2>&1)
TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | grep -oP '\d+')
if [ -n "$TEST_COUNT" ] && [ "$TEST_COUNT" -ge 295 ]; then
  echo -e "${GREEN}PASS${NC} ($TEST_COUNT tests, baseline: 295)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC} ($TEST_COUNT tests, baseline: 295)"
  FAIL=$((FAIL + 1))
fi

cd ..

echo -n "Backend tests... "
BACKEND_OUTPUT=$(python -m pytest backend/ --tb=short 2>&1)
BACKEND_COUNT=$(echo "$BACKEND_OUTPUT" | grep -oP '\d+ passed' | grep -oP '\d+')
if [ -n "$BACKEND_COUNT" ] && [ "$BACKEND_COUNT" -ge 409 ]; then
  echo -e "${GREEN}PASS${NC} ($BACKEND_COUNT tests, baseline: 409)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC} ($BACKEND_COUNT tests, baseline: 409)"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "============================================="
echo " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}BLOCKED: Do NOT merge this PR. Fix gate failures first.${NC}"
  exit 1
else
  echo -e "${GREEN}ALL GATES PASSED. Safe to merge.${NC}"
  exit 0
fi
