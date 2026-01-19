# UX/UI Visual Audit - Screen-by-Screen Chrome DevTools Review

You are a senior UX designer from a top Silicon Valley design agency (IDEO, Pentagram, ustwo) conducting a **$25M due diligence grade** visual audit using Chrome DevTools MCP.

**Your Mission:** Navigate through EVERY screen, click EVERY button, open EVERY dropdown, test EVERY state. Leave no stone unturned. A lazy audit is a useless audit.

---

## Prerequisites

Before starting, verify Chrome DevTools MCP is connected:
```
1. Run: mcp__chrome-devtools__list_pages
2. If error: Close Chrome, run dev.bat, try again
3. Navigate to: http://localhost:5173
```

---

## Audit Standards

**Benchmark Against:**
- Stripe Dashboard
- Linear
- Notion
- Figma
- Revolut

**Key Questions for EVERY Screen:**
1. Is this $25M software quality?
2. Would a Fortune 500 company trust this?
3. Is anything misaligned, inconsistent, or confusing?
4. Are there any visual bugs or broken states?
5. Does this pass the "mum test" - would my mum understand it?

---

## Severity Rating System

| Rating | Label | Definition | Action |
|--------|-------|------------|--------|
| **4** | Critical | Broken functionality, looks like bug, destroys trust | Fix within 24-48 hours |
| **3** | Major | Significant UX friction, unprofessional appearance | Fix this sprint |
| **2** | Minor | Confusing but workaround exists, polish issue | Fix next sprint |
| **1** | Cosmetic | Minor inconsistency, nice-to-have fix | Backlog |

---

## PHASE 1: Desktop Audit (1440×900)

### Step 1.0: Setup
```
1. mcp__chrome-devtools__resize_page width=1440 height=900
2. mcp__chrome-devtools__navigate_page url="http://localhost:5173" type="url"
3. mcp__chrome-devtools__take_screenshot
4. mcp__chrome-devtools__take_snapshot
```

### Step 1.1: Authentication States (If Logged Out)

**Login Page:**
- [ ] Take screenshot of login page
- [ ] Check email input field styling, placeholder
- [ ] Check password input field styling, placeholder
- [ ] Check "Sign In" button styling, hover state
- [ ] Check "Forgot Password" link
- [ ] Check "Sign Up" link
- [ ] Check error states (wrong password, invalid email)
- [ ] Check loading state during login
- [ ] Check success transition to main app

**Sign Up Page:**
- [ ] Take screenshot
- [ ] Check all form fields
- [ ] Check password requirements display
- [ ] Check terms/privacy links
- [ ] Check error states
- [ ] Check success flow

**Password Reset:**
- [ ] Take screenshot
- [ ] Check email input
- [ ] Check success message
- [ ] Check error states

### Step 1.2: Landing Page (Logged In)

**Main Area:**
- [ ] Screenshot the full landing page
- [ ] Check "AxCouncil" branding - font, color, alignment
- [ ] Check tagline "The only AI worth trusting" - typography, color
- [ ] Check "5 AIs → 3 rounds → 1 answer" pills - spacing, colors, alignment
- [ ] Check main input field - size, placeholder text, border
- [ ] Check input field focus state
- [ ] Check all icons in input toolbar
- [ ] CLICK: Each toolbar button and verify dropdown/action

**Input Toolbar - Click Each:**
- [ ] Company selector dropdown - take screenshot, check all options
- [ ] Project selector dropdown - take screenshot, check all options
- [ ] Departments dropdown - take screenshot, check all options
- [ ] Roles dropdown - take screenshot, check all options
- [ ] Playbooks dropdown - take screenshot, check all options
- [ ] Reset button - verify it works
- [ ] "1 AI / 5 AIs" toggle - click both, verify visual change
- [ ] Response style dropdown - take screenshot, check all options
- [ ] Attach image button - verify file picker opens
- [ ] Send button - check disabled state, hover state

**Sidebar (Collapsed):**
- [ ] Check all sidebar icons visible
- [ ] Hover each icon - check tooltip appears
- [ ] Check active state indicator

**Fixed Elements:**
- [ ] Theme toggle (top right) - click, verify theme changes
- [ ] Language selector - click, check dropdown
- [ ] Any floating buttons - identify and document

### Step 1.3: Sidebar Expanded

```
Click sidebar toggle or "History" button to expand
```

- [ ] Screenshot expanded sidebar
- [ ] Check "New Chat" button styling
- [ ] Check search input field
- [ ] Check filter dropdowns (All Conversations, Latest)
- [ ] Click each filter option
- [ ] Check conversation list styling
- [ ] Check starred conversations indicator
- [ ] Check conversation categories (if any)
- [ ] Check scroll behavior if many conversations
- [ ] Check "Load more" or pagination
- [ ] Check user email display at bottom
- [ ] Check My Company, Settings, Sign Out buttons

### Step 1.4: My Company - ALL Tabs

```
mcp__chrome-devtools__click on "My Company" button
```

**Header Area:**
- [ ] Screenshot My Company modal/panel
- [ ] Check title styling
- [ ] Check company dropdown selector
- [ ] Check close button (X)
- [ ] Check any icons/badges in header

**Overview Tab:**
- [ ] Click Overview tab
- [ ] Screenshot the full tab
- [ ] Check "Business Context" card styling
- [ ] Check "Last Updated" and "Version" labels
- [ ] Check "Edit" button
- [ ] Click "Edit" - screenshot edit mode
- [ ] Check Table of Contents styling
- [ ] Click each TOC link - verify scroll/navigation
- [ ] Check content typography and formatting
- [ ] Scroll to bottom - check any footer elements

**Team Tab:**
- [ ] Click Team tab
- [ ] Screenshot
- [ ] Check summary stats ("X departments • Y roles")
- [ ] Check "New Department" button
- [ ] Check each department card:
  - [ ] Name styling
  - [ ] Role count (check pluralization!)
  - [ ] Color indicator meaning
  - [ ] Click to expand
- [ ] With department expanded:
  - [ ] Screenshot
  - [ ] Check "About [Department]" button
  - [ ] Click "About" - screenshot
  - [ ] Check "New Role" button
  - [ ] Check each role card styling
  - [ ] Click a role - screenshot role detail
- [ ] Click "New Department" - screenshot the form
- [ ] Click "New Role" - screenshot the form

**Projects Tab:**
- [ ] Click Projects tab
- [ ] Screenshot
- [ ] Check summary stat cards (Active, Completed, Archived, Decisions)
- [ ] Click each stat card - verify it filters
- [ ] Check filter dropdowns (All Depts, Latest)
- [ ] Click each dropdown option
- [ ] Check project list styling
- [ ] Check department tags on projects
- [ ] Check decision count display
- [ ] Check relative timestamps
- [ ] Click "New Project" - screenshot form
- [ ] Click a project - screenshot project detail

**Playbooks Tab:**
- [ ] Click Playbooks tab
- [ ] Screenshot
- [ ] Check summary stat cards
- [ ] Check category groupings (SOPs, Frameworks, Policies)
- [ ] Check playbook cards styling
- [ ] Check department tags
- [ ] Click "New Playbook" - screenshot form
- [ ] Click a playbook - screenshot detail view

**Decisions Tab:**
- [ ] Click Decisions tab
- [ ] Screenshot
- [ ] Check search input
- [ ] Check department filter dropdown
- [ ] Check decision list styling
- [ ] Check status indicators (dots, badges)
- [ ] Check department tags
- [ ] Check timestamps
- [ ] Click a decision - screenshot detail view
- [ ] Check "View source conversation" link if present

**Activity Tab:**
- [ ] Click Activity tab
- [ ] Screenshot
- [ ] Check event count display
- [ ] Check date groupings (TODAY, YESTERDAY, specific dates)
- [ ] Check event cards:
  - [ ] Title
  - [ ] Event type label (check for jargon!)
  - [ ] Badge (CREATED, UPDATED, etc.)
  - [ ] Any action links
- [ ] Check "Load more" if present
- [ ] Scroll to load more events

**Usage Tab:**
- [ ] Click Usage tab
- [ ] Screenshot
- [ ] Check summary stat cards:
  - [ ] Total Cost
  - [ ] Sessions
  - [ ] Tokens
  - [ ] Cache Hit Rate (check color logic!)
- [ ] Check time period toggles (7d, 30d, 90d)
- [ ] Click each toggle
- [ ] Check chart:
  - [ ] Axis labels
  - [ ] Bar styling
  - [ ] Hover tooltips
  - [ ] Legend if present
- [ ] Scroll for additional charts/data

### Step 1.5: Settings - ALL Tabs

```
Click Settings button
```

**Profile Tab:**
- [ ] Screenshot
- [ ] Check all form fields:
  - [ ] Display Name
  - [ ] Company Name
  - [ ] Phone (check placeholder!)
  - [ ] Bio
- [ ] Check field focus states
- [ ] Check "Save Changes" button visibility
- [ ] Check Account section:
  - [ ] Email (disabled field)
  - [ ] Language dropdown - click, screenshot options
- [ ] Scroll to see all content

**Billing Tab:**
- [ ] Click Billing tab
- [ ] Screenshot
- [ ] Check usage display:
  - [ ] Query count
  - [ ] Progress bar (if applicable)
  - [ ] "Unlimited" handling
- [ ] Check plan cards:
  - [ ] Free plan
  - [ ] Pro plan
  - [ ] Enterprise plan
  - [ ] Current plan indicator (!)
  - [ ] Pricing display
  - [ ] Feature lists
- [ ] Check upgrade/downgrade buttons

**Team Tab:**
- [ ] Click Team tab
- [ ] Screenshot
- [ ] Check team member list
- [ ] Check invite functionality
- [ ] Check role assignments
- [ ] Check remove member flow

**API Keys Tab:**
- [ ] Click API Keys tab
- [ ] Screenshot
- [ ] Check key list styling
- [ ] Check "Create Key" button
- [ ] Check key visibility toggle
- [ ] Check copy button
- [ ] Check delete confirmation

**Developer Tab:**
- [ ] Click Developer tab
- [ ] Screenshot
- [ ] Check warning banner styling
- [ ] Check each toggle:
  - [ ] Mock Mode - toggle, verify state change
  - [ ] Prompt Caching - toggle, verify state change
  - [ ] Token Usage Display - toggle, verify state change
- [ ] Check toggle labels and descriptions

**LLM Hub Tab:**
- [ ] Click LLM Hub tab
- [ ] Screenshot
- [ ] Document any errors (!)
- [ ] If working:
  - [ ] Check model list
  - [ ] Check enable/disable toggles
  - [ ] Check model details
  - [ ] Check pricing display

### Step 1.6: Chat Interface - Full Flow

**Submit a Query:**
```
1. Type: "What are the top 3 priorities for our product?"
2. Click Send button
3. Take screenshots at each stage
```

**Loading States:**
- [ ] Screenshot initial loading ("Waking up the council...")
- [ ] Screenshot Stage 1 progress (individual models responding)
- [ ] Check model indicator pills
- [ ] Check "X is thinking..." status
- [ ] Screenshot Stage 2 ("Experts Review Each Other")
- [ ] Screenshot Stage 3 ("Chairman is writing...")
- [ ] Check confetti animation (note frequency)

**Complete Response:**
- [ ] Screenshot full response
- [ ] Check response card styling
- [ ] Check markdown rendering (headers, lists, bold)
- [ ] Check "Copy" button
- [ ] Check cost display
- [ ] Expand Stage 1 - screenshot all 5 AI responses
- [ ] Expand Stage 2 - screenshot peer reviews
- [ ] Check "Save Answer" section:
  - [ ] Departments dropdown
  - [ ] Project dropdown
  - [ ] Playbooks dropdown
  - [ ] Save button

**Session Info:**
- [ ] Check session cost bar
- [ ] Click to expand token details
- [ ] Check formatting consistency

**Follow-up Input:**
- [ ] Check input field returns
- [ ] Check context retention

### Step 1.7: Leaderboard

```
Click Leaderboard button in sidebar
```

- [ ] Screenshot
- [ ] Check leaderboard styling
- [ ] Check model rankings
- [ ] Check score display
- [ ] Check any filters or time periods

### Step 1.8: Command Palette

```
Press Ctrl+K (or Cmd+K on Mac)
```

- [ ] Screenshot command palette
- [ ] Check search input
- [ ] Check available commands
- [ ] Check keyboard navigation
- [ ] Check result selection
- [ ] Press Escape - verify closes

### Step 1.9: Theme Toggle

- [ ] Switch to Light mode
- [ ] Screenshot landing page in light mode
- [ ] Screenshot My Company in light mode
- [ ] Screenshot Settings in light mode
- [ ] Screenshot Chat response in light mode
- [ ] Verify all colors are appropriate for light mode
- [ ] Switch back to Dark mode

### Step 1.10: Error States

**Network Error:**
- [ ] Disconnect network (if possible) or throttle
- [ ] Try to submit query
- [ ] Screenshot error handling
- [ ] Check error message clarity

**Empty States:**
- [ ] New user with no conversations - screenshot History
- [ ] Company with no projects - screenshot Projects tab
- [ ] Company with no playbooks - screenshot Playbooks tab
- [ ] Company with no decisions - screenshot Decisions tab
- [ ] Search with no results - screenshot

---

## PHASE 2: Mobile Audit (375×812)

```
mcp__chrome-devtools__resize_page width=375 height=812
mcp__chrome-devtools__navigate_page url="http://localhost:5173" type="url"
```

### Step 2.1: Mobile Landing

- [ ] Screenshot full landing page
- [ ] Check title/tagline sizing and alignment
- [ ] Check input field sizing
- [ ] Check toolbar icons - spacing, touch targets
- [ ] Check sidebar toggle visibility
- [ ] Check any fixed elements positioning

### Step 2.2: Mobile Sidebar

- [ ] Click sidebar toggle
- [ ] Screenshot expanded sidebar
- [ ] Check it fills screen appropriately
- [ ] Check search input
- [ ] Check conversation list scrolling
- [ ] Check bottom navigation (My Company, Settings, Sign Out)
- [ ] Check close behavior (tap outside, swipe)

### Step 2.3: Mobile My Company

- [ ] Open My Company
- [ ] Screenshot - check if modal or full-screen
- [ ] Check each tab renders correctly on mobile
- [ ] Check forms are usable on mobile
- [ ] Check dropdowns work with touch
- [ ] Check scroll behavior
- [ ] Check close/back navigation

### Step 2.4: Mobile Settings

- [ ] Open Settings
- [ ] Screenshot - check bottom sheet styling
- [ ] Check tab icons/labels
- [ ] Check forms fit screen width
- [ ] Check keyboard behavior with inputs
- [ ] Check scroll within settings
- [ ] Verify sidebar closes behind it

### Step 2.5: Mobile Chat

- [ ] Submit a query on mobile
- [ ] Screenshot loading states
- [ ] Screenshot complete response
- [ ] Check response readability
- [ ] Check stage expansion
- [ ] Check input bar positioning (above keyboard)

### Step 2.6: Mobile Touch Targets

For EVERY button/link on mobile, verify:
- [ ] Touch target is at least 44×44px
- [ ] Adequate spacing between targets
- [ ] No accidental tap issues

---

## PHASE 3: Cross-Cutting Concerns

### Typography Consistency

For each text element, check:
- [ ] Font family is Geist (or specified fallback)
- [ ] Font weights create proper hierarchy
- [ ] Line heights are comfortable for reading
- [ ] No orphaned words in headings
- [ ] Text truncation works correctly with ellipsis

### Color Consistency

- [ ] Primary accent color (indigo) used consistently
- [ ] Status colors intuitive (green=success, red=error, yellow=warning)
- [ ] Department colors distinguishable
- [ ] Text colors meet contrast requirements (4.5:1 minimum)
- [ ] Dark mode colors are refined, not just inverted

### Spacing & Alignment

- [ ] Consistent padding within cards (use design tokens)
- [ ] Proper visual grouping (related items closer)
- [ ] Grid alignment across the interface
- [ ] Balanced negative space
- [ ] No cramped or cluttered areas

### Animations & Transitions

- [ ] Transitions are smooth (150-300ms)
- [ ] No jarring animations
- [ ] Loading states are informative
- [ ] Hover states provide feedback
- [ ] Reduced motion preference respected

### Accessibility Quick Check

- [ ] Tab through entire page - logical order
- [ ] Focus states visible on all interactive elements
- [ ] Screen reader landmarks present
- [ ] Alt text on images
- [ ] ARIA labels where needed

---

## Output Format

After completing ALL steps above, create a comprehensive report:

### File: `todo/UX-UI-AUDIT-[DATE].md`

```markdown
# UX/UI Visual Audit - [DATE]

## Executive Summary
| Metric | Score | Target |
|--------|-------|--------|
| Overall UX Score | X/10 | 8/10 |
| Visual Polish | X/10 | 9/10 |
| Mobile Experience | X/10 | 8/10 |
| Enterprise Ready | X/10 | 8/10 |

## Critical Issues (Severity 4)
### UXUI-XXX: [Title]
- **Location:** [Screen → Element]
- **Screenshot:** [Describe what you saw]
- **Impact:** [User/business impact]
- **Fix Required:** [Specific fix]
- **Files:** [Likely files to check]

## Major Issues (Severity 3)
[Same format]

## Minor Issues (Severity 2)
[Same format]

## Cosmetic Issues (Severity 1)
[Same format]

## Screens Audited Checklist
[Mark all screens checked]

## Screens NOT Audited
[List any skipped and why]

## Priority Action Items
1. [ ] Critical fix 1
2. [ ] Critical fix 2
...
```

---

## Rules for This Audit

1. **NO LAZY SHORTCUTS** - Click EVERY button, open EVERY dropdown
2. **SCREENSHOT EVERYTHING** - Visual evidence for every finding
3. **TEST ALL STATES** - Empty, loading, error, success, hover, focus
4. **BOTH VIEWPORTS** - Desktop AND mobile for every feature
5. **BE BRUTAL** - If it's not $25M quality, call it out
6. **FILE LOCATIONS** - Every issue needs likely file paths
7. **ACTIONABLE FIXES** - Don't just identify, propose solutions
8. **NO ASSUMPTIONS** - Verify, don't assume something works

---

## Time Estimate

A thorough audit following this checklist takes approximately 2-3 hours. Do not rush. Quality over speed.

---

## After the Audit

1. **Create issue document** in `todo/UX-UI-AUDIT-[DATE].md`
2. **Update audit dashboard** - Run `/audit-dashboard ui ux mobile`
3. **Create GitHub issues** for Critical and Major items (optional)
4. **Schedule fixes** - Critical within 48 hours, Major this sprint

---

Remember: This is a $25M software audit. Every pixel matters. Every interaction counts. Be thorough, be honest, be constructive.
