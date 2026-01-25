# Run Agent Team

Run a team of agents in parallel for comprehensive checks.

## Available Teams

### Guardian Team
**Purpose:** Continuous security monitoring (run in background during development)
**Agents:** security-guardian [Opus], dependency-watcher [Haiku]

```
Ask Claude: "Run the guardian team in background"
```

### Quality Gate Team
**Purpose:** Pre-push quality checks (run before every git push)
**Agents:** test-runner, build-validator, type-checker, css-enforcer [all Haiku]

```
Ask Claude: "Run the quality gate team"
```

### Release Readiness Team
**Purpose:** Pre-deployment comprehensive audit
**Agents:** rls-auditor [Opus], performance-profiler [Opus], api-contract-checker [Opus], mobile-tester [Sonnet], enterprise-readiness [Opus]

```
Ask Claude: "Run the release readiness team"
```

### Continuous Improvement Team
**Purpose:** Weekly improvement analysis
**Agents:** council-ops [Opus], web-researcher [Sonnet], tech-debt-tracker [Opus], coverage-improver [Sonnet]

```
Ask Claude: "Run the continuous improvement team"
```

## Usage Examples

**Run a team:**
```
"Run the quality gate team"
"Run release readiness checks"
"Run the guardian team in background"
```

**Run a single agent:**
```
"Run the security-guardian agent"
"Run rls-auditor"
"Run test-runner in background"
```

**Run multiple teams:**
```
"Run the quality gate and release readiness teams in parallel"
```

## State Tracking

After running a team, update the state:

```bash
node -e "
const fs = require('fs');
const stateFile = '.claude/agent-state.json';
const teamName = process.argv[2] || 'unknown';
if (fs.existsSync(stateFile)) {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const now = new Date().toISOString();
  if (state.teams[teamName]) {
    state.teams[teamName].lastRun = now;
  }
  state.lastUpdated = now;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log('State updated: ' + teamName + ' team completed at ' + now);
}
" -- "TEAM_NAME"
```

Replace TEAM_NAME with: guardian, quality-gate, release-readiness, or continuous-improvement

## When to Run Each Team

| Team | When to Run | Frequency |
|------|-------------|-----------|
| Guardian | During development | Continuous/Background |
| Quality Gate | Before git push | Every push |
| Release Readiness | Before production deploy | Every release |
| Continuous Improvement | Monday morning | Weekly |

## Expected Output

Each team run produces a unified report:

```
## Team Report: [Team Name]
**Date:** [timestamp]
**Agents Run:** [list]

### Summary
- Critical Issues: [count]
- Warnings: [count]
- All Clear: [yes/no]

### Agent Reports
[Individual agent findings consolidated]

### Recommended Actions
1. [Priority action]
2. [Secondary action]
```
