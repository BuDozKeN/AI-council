#!/usr/bin/env bash
# AxCouncil Session Banner — dynamically detects all capabilities
# Called by SessionStart hook in .claude/settings.json

set -euo pipefail

CLAUDE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$(cd "$CLAUDE_DIR/.." && pwd)"

# Colors (ANSI — works in VS Code terminal)
BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
MAGENTA="\033[35m"
BLUE="\033[34m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}=== AxCouncil Session Started ===${RESET}"
echo -e "${DIM}CSS Budget: 1300KB source | 700KB built${RESET}"
echo ""

# --- Installed Plugins ---
echo -e "${BOLD}${MAGENTA}Plugins:${RESET}"
PLUGIN_FOUND=false

# Check project-level plugins
if [ -d "$CLAUDE_DIR/plugins" ]; then
  for dir in "$CLAUDE_DIR/plugins"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    PLUGIN_FOUND=true
    echo -e "  ${GREEN}*${RESET} $name ${DIM}(project)${RESET}"
  done
fi

# Check global plugins
GLOBAL_PLUGIN_DIR="${HOME}/.claude/plugins"
if [ -d "$GLOBAL_PLUGIN_DIR" ]; then
  for dir in "$GLOBAL_PLUGIN_DIR"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    PLUGIN_FOUND=true
    echo -e "  ${GREEN}*${RESET} $name ${DIM}(global)${RESET}"
  done
fi

if [ "$PLUGIN_FOUND" = false ]; then
  echo -e "  ${DIM}(none installed yet)${RESET}"
  echo -e "  ${DIM}Recommended: /plugin install superpowers${RESET}"
  echo -e "  ${DIM}             /plugin install ralph-wiggum@claude-plugin-directory${RESET}"
  echo -e "  ${DIM}             /plugin install pr-review-toolkit@claude-plugin-directory${RESET}"
fi
echo ""

# --- Quick Commands (non-audit) ---
echo -e "${BOLD}${GREEN}Quick Commands:${RESET}"
echo -e "  /daily-health     Morning health check"
echo -e "  /qa               Pre-push quality check"
echo -e "  /security-watch   Security monitoring"
echo -e "  /setup            First-time setup"
echo -e "  /restart          Restart dev servers"
echo -e "  /run-team         Run agent team"
echo -e "  /web-research     Tech & security updates"
echo -e "  /hunt-ux-issues   Full UX issue hunt"
echo ""

# --- Audit Commands ---
AUDIT_COUNT=0
if [ -d "$CLAUDE_DIR/commands" ]; then
  AUDIT_COUNT=$(ls "$CLAUDE_DIR/commands"/audit-*.md 2>/dev/null | wc -l)
fi
echo -e "${BOLD}${YELLOW}Audits:${RESET} ${AUDIT_COUNT} available ${DIM}(type /audit-<tab> to browse)${RESET}"
echo -e "  /audit-full       Complete due diligence review"
echo -e "  /audit-security   Banking-grade security review"
echo -e "  /audit-mobile     Mobile experience review"
echo -e "  /audit-performance Performance bottlenecks"
echo -e "  /audit-dashboard  Executive command center"
echo ""

# --- Agents ---
echo -e "${BOLD}${BLUE}Agents:${RESET} ${DIM}(ask Claude to run these)${RESET}"
AGENT_COUNT=0
if [ -d "$CLAUDE_DIR/agents" ]; then
  AGENT_COUNT=$(ls "$CLAUDE_DIR/agents"/*.md 2>/dev/null | wc -l)
  # Group agents by function
  echo -e "  ${DIM}Security:${RESET}  security-guardian, rls-auditor, dependency-watcher"
  echo -e "  ${DIM}Quality:${RESET}   test-runner, type-checker, build-validator, coverage-improver"
  echo -e "  ${DIM}Frontend:${RESET}  css-enforcer, mobile-tester, mobile-ux-tester, app-explorer"
  echo -e "  ${DIM}Ops:${RESET}       council-ops, performance-profiler, api-contract-checker"
  echo -e "  ${DIM}Strategy:${RESET}  enterprise-readiness, tech-debt-tracker, web-researcher"
fi
echo ""

# --- Skills ---
echo -e "${BOLD}${CYAN}Skills:${RESET} ${DIM}(auto-load when relevant)${RESET}"
if [ -d "$CLAUDE_DIR/skills" ]; then
  for skill in "$CLAUDE_DIR/skills"/*.md; do
    [ -f "$skill" ] || continue
    name=$(basename "$skill" .md)
    # Convert kebab-case to readable
    readable=$(echo "$name" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
    echo -e "  ${DIM}-${RESET} $readable"
  done
fi
echo ""

# --- Plugin Reminder ---
if [ "$PLUGIN_FOUND" = true ]; then
  echo -e "${DIM}Tip: Use /plugin list to see full plugin details${RESET}"
else
  echo -e "${YELLOW}Tip: Install recommended plugins to unlock more capabilities:${RESET}"
  echo -e "  ${DIM}superpowers        — TDD, planning, subagent execution${RESET}"
  echo -e "  ${DIM}ralph-wiggum       — Autonomous overnight loops${RESET}"
  echo -e "  ${DIM}pr-review-toolkit  — 6-agent PR review${RESET}"
fi
echo ""
