# Mobile UX Issues Report

**Date:** 2026-02-10
**Viewport Tested:** iPhone 14 (390x844) as primary
**Total Issues Found:** 68

## Executive Summary

Testing conducted across all major screens at mobile viewports identified 68 mobile-specific UX issues.

## Issues by Category

### CLUTTER - Information Density Issues (15 issues)

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| UXH-101 | P2 | Settings Modal | Vertical tab bar takes 176px of horizontal space |
| UXH-102 | P2 | Company Modal | 7 navigation tabs overflow in bottom bar |
| UXH-103 | P3 | Leaderboard | Table shows 5 columns - too dense for mobile |
| UXH-104 | P2 | Projects Tab | Filter buttons + stats take 40% of viewport |
| UXH-105 | P3 | Playbooks Tab | 4 category stat cards take significant space |
| UXH-106 | P2 | Chat Input | Contexto button + badge + radio group crowd input |
| UXH-107 | P3 | Billing Tab | Subscription plan cards show full feature lists |
| UXH-108 | P2 | Team Tab | Department cards show all info inline |
| UXH-109 | P3 | Decisions Tab | Department tags + status + date on each card |
| UXH-110 | P2 | Usage Tab | 4 stat cards + time filter + chart + breakdown |
| UXH-111 | P3 | Chat Sidebar | Each conversation shows 4 action buttons |
| UXH-112 | P2 | Business Context | Table of Contents shows 15 items inline |
| UXH-113 | P3 | Landing Page | 6 IAs -> 3 rondas -> 1 respuesta pills |
| UXH-114 | P2 | API Keys Tab | OpenRouter accordion + connection status |
| UXH-115 | P3 | Developer Tab | 3 toggle sections with verbose descriptions |

### TOUCH TARGETS - Interactive Element Issues (12 issues)

| ID | Severity | Screen | Element |
|----|----------|--------|---------|
| UXH-116 | P2 | All Screens | Theme toggle button at screen edge |
| UXH-117 | P3 | Chat Sidebar | Conversation action buttons stacked with 0 gap |
| UXH-118 | P2 | Company Modal | Back arrow button hard to reach in thumb zone |
| UXH-119 | P3 | Settings Tabs | Tab icons are 52x52px but labels cut off |
| UXH-120 | P2 | Leaderboard | Table row height only ~56px |
| UXH-121 | P3 | Projects List | Department tags (pills) small touch targets |
| UXH-122 | P2 | Decisions List | Status indicator dots 8px diameter |
| UXH-123 | P3 | Usage Chart | Individual bars hard to tap |
| UXH-124 | P2 | Chat Input | 1 IA / 6 IAs radio buttons adjacent |
| UXH-125 | P3 | Company Dropdown | Company switcher close to back button |
| UXH-126 | P2 | TOC Links | Table of Contents links spacing tight |
| UXH-127 | P3 | Leaderboard | Category filter buttons spacing tight |

### TEXT SIZE - Readability Issues (10 issues)

| ID | Severity | Screen | Element | Font Size |
|----|----------|--------|---------|-----------|
| UXH-128 | P2 | Chat Input | Contexto button text | 12px |
| UXH-129 | P2 | Chat Input | Badge showing context count | 10px |
| UXH-130 | P2 | Company Nav | Bottom tab labels | 12px |
| UXH-131 | P3 | Settings Sidebar | Portal de Admin text truncates | 12px |
| UXH-132 | P3 | Leaderboard | POSICION PROMEDIO all-caps | 12px |
| UXH-133 | P2 | Usage Stats | Secondary metrics gray text | 12px |
| UXH-134 | P3 | Projects Cards | Date stamps | 12px |
| UXH-135 | P3 | Decisions Cards | Date stamps | 12px |
| UXH-136 | P2 | Chat Messages | Timestamp hidden | N/A |
| UXH-137 | P3 | Company Modal | ULTIMA ACTUALIZACION | 10px |

### HIERARCHY - Important Actions Buried (8 issues)

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| UXH-138 | P1 | Chat Interface | Submit button rightmost - far from thumb |
| UXH-139 | P2 | Settings Modal | Guardar cambios below fold |
| UXH-140 | P2 | Team Tab | Add department FAB overlaps content |
| UXH-141 | P2 | Projects Tab | Crear nuevo proyecto at bottom |
| UXH-142 | P3 | Playbooks Tab | + button at bottom |
| UXH-143 | P2 | Decisions Tab | No clear promote CTA |
| UXH-144 | P3 | Activity Tab | Scroll needed |
| UXH-145 | P2 | Landing Page | Chat input requires scroll |

### SCROLL ISSUES (8 issues)

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| UXH-146 | P2 | Settings Modal | Nested scroll confusion |
| UXH-147 | P3 | Chat Interface | Scroll momentum different |
| UXH-148 | P2 | Business Context | Long document scroll |
| UXH-149 | P3 | Company Modal | Scroll resets on tab change |
| UXH-150 | P2 | Leaderboard | Scroll position not preserved |
| UXH-151 | P3 | Projects List | No pull-to-refresh |
| UXH-152 | P2 | Chat Sidebar | No scroll indicator |
| UXH-153 | P3 | Usage Tab | Chart scroll independent |

### MODAL AND OVERLAY ISSUES (7 issues)

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| UXH-154 | P2 | Settings Modal | Full screen with visible background |
| UXH-155 | P2 | Company Modal | Drag indicator unclear |
| UXH-156 | P3 | Context Menu | Pushes keyboard down |
| UXH-157 | P2 | Dropdowns | Native picker on iOS |
| UXH-158 | P3 | Response Style | Floating menu may cut off |
| UXH-159 | P2 | Leaderboard | Back does not close |
| UXH-160 | P3 | API Keys | Animation laggy |

### THUMB ZONE ISSUES (8 issues)

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| UXH-161 | P1 | All Screens | Theme toggle top-right hard to reach |
| UXH-162 | P2 | Landing Page | Branding wastes thumb space |
| UXH-163 | P2 | Settings Modal | Tab nav on left hard to reach |
| UXH-164 | P2 | Company Modal | Switcher in header hard to reach |
| UXH-165 | P2 | Chat Interface | Sidebar button on left edge |
| UXH-166 | P3 | Leaderboard | Filters at top |
| UXH-167 | P2 | Business Context | Edit button in header |
| UXH-168 | P3 | Chat Messages | Copy button in header |

## Viewport-Specific Issues

### iPhone SE (320x568)

| ID | Severity | Issue |
|----|----------|-------|
| UXH-169 | P2 | Company Modal tabs overflow |
| UXH-170 | P2 | Leaderboard columns compressed |
| UXH-171 | P3 | Hero wraps to 3 lines |
| UXH-172 | P2 | Chat input controls overflow |
| UXH-173 | P3 | Settings tabs compress |

### iPhone 14 Pro Max (430x932)

| ID | Severity | Issue |
|----|----------|-------|
| UXH-174 | P3 | Too much empty space |
| UXH-175 | P3 | Modals fixed width |

## Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| P1 | 2 | Blocks core workflows |
| P2 | 35 | Significant friction |
| P3 | 31 | Polish needed |

## Priority Recommendations

### P1 - Fix First
1. UXH-138: Move Send button to thumb zone
2. UXH-161: Relocate theme toggle

### P2 - Fix Soon
1. UXH-101/163: Redesign Settings tabs
2. UXH-102: Fix Company tab overflow
3. UXH-145: Reduce hero height
4. UXH-146: Fix nested scroll

---

Generated by: mobile-ux-tester agent
