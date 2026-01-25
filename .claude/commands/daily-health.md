# Daily Health Check

Perform a comprehensive daily health check of the AxCouncil codebase. Run this at the start of each development session.

## Health Check Areas

### 1. Git Status
```bash
git status
git log --oneline -5
```

### 2. Dependency Status
```bash
# Check for outdated packages
cd frontend && npm outdated 2>/dev/null | head -20 || echo "npm check completed"
```

### 3. CSS Budget Status
```bash
# Check CSS file sizes
echo "=== CSS File Sizes ==="
find frontend/src -name "*.css" -exec wc -l {} + 2>/dev/null | sort -n | tail -10

# Check for files over 300 lines
echo -e "\n=== Files Over 300 Lines (Violations) ==="
find frontend/src -name "*.css" -exec sh -c 'lines=$(wc -l < "$1"); if [ "$lines" -gt 300 ]; then echo "$1: $lines lines"; fi' _ {} \;
```

### 4. TypeScript Health
```bash
cd frontend && npm run type-check 2>&1 | tail -20 || echo "Type check completed"
```

### 5. Test Status
```bash
cd frontend && npm run test:run 2>&1 | tail -30 || echo "Tests completed"
```

### 6. Exit Readiness Status
```bash
echo "=== Exit Readiness Doc ==="
if [ -f todo/EXIT-READINESS-25M.md ]; then
  head -50 todo/EXIT-READINESS-25M.md
else
  echo "EXIT-READINESS-25M.md not found"
fi
```

## Output Format

```
## Daily Health Report - [Date]

### Git Status
- Branch: [current branch]
- Clean: [yes/no]
- Recent commits: [count]

### Dependencies
- Outdated packages: [count]
- Security vulnerabilities: [count]

### CSS Budget
- Total CSS files: [count]
- Files over 300 lines: [count]
- Largest file: [name, lines]

### Code Quality
- TypeScript errors: [count]
- Test status: [passing/failing]
- Coverage: [X%]

### Exit Readiness
- Status: [on track / needs attention]
- Blocking issues: [count]

### Today's Priorities
1. [based on findings]
2. [based on findings]
```

## Automation

Consider running this:
- At the start of each coding session
- Before creating PRs
- After major merges
