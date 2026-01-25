# CLAUDE.md Health Audit

Analyze the CLAUDE.md file for bloat, redundancy, and optimization opportunities.

## Audit Steps

1. **Check file size and line count**
   ```bash
   wc -l CLAUDE.md
   wc -c CLAUDE.md | awk '{print $1/1024 " KB"}'
   ```

2. **Target metrics:**
   - Lines: Should be under 500 (currently may be over)
   - Size: Should be under 25KB

3. **Identify sections that should be skills:**
   - Detailed bug patterns (should be in `.claude/skills/`)
   - Code examples longer than 20 lines
   - Debugging checklists
   - Repetitive patterns

4. **Check for:**
   - Duplicate information
   - Outdated references
   - Information better suited for `docs/` folder
   - Sections rarely needed (load on-demand via skills)

5. **Verify skills exist for extracted content:**
   ```bash
   ls -la .claude/skills/
   ```

## Output Format

```
## CLAUDE.md Health Report

**Current Size:** [X lines, Y KB]
**Target Size:** 500 lines, 25KB
**Status:** [Healthy/Needs Pruning/Critical]

### Sections to Extract
| Section | Lines | Recommended Skill |
|---------|-------|-------------------|
| [name] | [count] | [skill-name.md] |

### Duplicate Information Found
- [description]

### Recommendations
1. [action item]
2. [action item]
```

## Maintenance Schedule

Run this audit:
- After major documentation changes
- Monthly maintenance
- Before PRs that modify CLAUDE.md
