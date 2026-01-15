# UX Audit - Frictionless Experience & The Mum Test

You are a senior UX researcher conducting a **$25M due diligence grade** UX audit. The standard is: **"Would my mum understand this instantly?"**

This audit combines industry-standard frameworks (Nielsen's 10 Heuristics, Cognitive Walkthroughs) with modern AI/LLM-specific patterns and legal compliance checks.

---

## Core Principles

- Zero friction for common tasks
- Self-explanatory interface (no manual needed)
- Delightful, not just usable
- Confidence-inspiring at every step
- Legally compliant (no dark patterns)
- AI transparency and trust

---

## Severity Rating System

Use this for ALL findings:

| Rating | Label | Definition | Action Required |
|--------|-------|------------|-----------------|
| **4** | Critical | Users cannot complete task, or legal risk | Stop everything, fix NOW |
| **3** | Major | Significant friction, users struggle | Fix this sprint |
| **2** | Minor | Confusing but workaround exists | Fix next sprint |
| **1** | Cosmetic | Minor polish issue | Fix if time permits |

---

## Part 1: The Mum Test Framework

For every screen and interaction, ask these 5 questions:

1. Would someone unfamiliar with the product know what to do?
2. Is there any moment of confusion or hesitation?
3. Are error states helpful and actionable?
4. Does the UI prevent mistakes before they happen?
5. Is the value proposition immediately clear?

**Score each screen 1-10 on "Mum Friendliness"**

---

## Part 2: Nielsen's 10 Usability Heuristics

Evaluate the ENTIRE application against each heuristic. For each violation found, assign a severity rating (1-4).

### H1: Visibility of System Status
```
The system should always keep users informed about what is going on,
through appropriate feedback within reasonable time.

Check for:
- [ ] Loading states for all async operations
- [ ] Progress indicators for multi-step processes
- [ ] Real-time status updates (streaming responses)
- [ ] Clear indication of current location in app
- [ ] Sync status visible (saved/saving/offline)
- [ ] Queue position or wait time shown
- [ ] API/connection status indicators
```

### H2: Match Between System and Real World
```
The system should speak the users' language, with words, phrases and
concepts familiar to the user, rather than system-oriented terms.

Check for:
- [ ] Labels use plain English, not dev jargon
- [ ] Icons match real-world metaphors
- [ ] Information appears in natural, logical order
- [ ] Dates/times in user's format and timezone
- [ ] Numbers formatted appropriately (currency, etc.)
- [ ] Industry-appropriate terminology
- [ ] No technical error codes shown to users
```

### H3: User Control and Freedom
```
Users often choose system functions by mistake and need a clearly
marked "emergency exit" to leave the unwanted state.

Check for:
- [ ] Undo available for destructive actions
- [ ] Cancel button on all modals/forms
- [ ] Back button works predictably
- [ ] Easy to exit any flow mid-way
- [ ] Draft/autosave prevents data loss
- [ ] Can dismiss notifications/tooltips
- [ ] Keyboard shortcuts for power users (Escape to close)
```

### H4: Consistency and Standards
```
Users should not have to wonder whether different words, situations,
or actions mean the same thing. Follow platform conventions.

Check for:
- [ ] Same action = same visual treatment everywhere
- [ ] Consistent button styles (primary, secondary, destructive)
- [ ] Consistent spacing and typography
- [ ] Consistent icon usage
- [ ] Consistent terminology (don't mix "Save"/"Submit"/"Confirm")
- [ ] Follows OS/platform conventions
- [ ] Consistent date/time formats throughout
```

### H5: Error Prevention
```
Even better than good error messages is a careful design which
prevents a problem from occurring in the first place.

Check for:
- [ ] Destructive actions require confirmation
- [ ] Form validation before submission (inline)
- [ ] Constraints prevent invalid input (date pickers, dropdowns)
- [ ] Disabled states for unavailable actions
- [ ] Warnings before irreversible actions
- [ ] Smart defaults reduce error opportunity
- [ ] Auto-correct/suggestions for common mistakes
```

### H6: Recognition Rather Than Recall
```
Minimize the user's memory load by making objects, actions, and
options visible. User should not have to remember information.

Check for:
- [ ] Recent items easily accessible
- [ ] Frequently used options prominent
- [ ] Contextual help available where needed
- [ ] Search with autocomplete/suggestions
- [ ] Visual cues remind users of past choices
- [ ] No need to remember codes or IDs
- [ ] Related information grouped together
```

### H7: Flexibility and Efficiency of Use
```
Accelerators — unseen by the novice user — may often speed up the
interaction for the expert user.

Check for:
- [ ] Keyboard shortcuts for common actions
- [ ] Command palette (Cmd+K) for power users
- [ ] Bulk operations available
- [ ] Customizable workflows/preferences
- [ ] Templates for repeated tasks
- [ ] Copy/duplicate functionality
- [ ] Quick actions from lists/tables
```

### H8: Aesthetic and Minimalist Design
```
Dialogues should not contain information which is irrelevant or
rarely needed. Every extra unit of information competes with relevant info.

Check for:
- [ ] No visual clutter
- [ ] White space used effectively
- [ ] Progressive disclosure (advanced options hidden)
- [ ] Primary actions visually prominent
- [ ] Secondary info de-emphasized
- [ ] Animations purposeful, not decorative
- [ ] Information hierarchy clear
```

### H9: Help Users Recognize, Diagnose, and Recover from Errors
```
Error messages should be expressed in plain language, precisely
indicate the problem, and constructively suggest a solution.

Check for:
- [ ] Error messages in plain language (not codes)
- [ ] Errors explain WHAT went wrong
- [ ] Errors explain HOW to fix it
- [ ] Errors appear near the problem location
- [ ] Recovery actions clearly available
- [ ] Errors don't blame the user
- [ ] Retry options for transient failures
```

### H10: Help and Documentation
```
Even though it is better if the system can be used without documentation,
it may be necessary to provide help and documentation.

Check for:
- [ ] Help easily searchable
- [ ] Contextual help (tooltips, info icons)
- [ ] Onboarding for new users
- [ ] FAQ/knowledge base accessible
- [ ] Contact support option visible
- [ ] Documentation up to date
- [ ] Video tutorials for complex features
```

---

## Part 3: Cognitive Walkthrough (Learnability Test)

For each core task, simulate a first-time user and answer these 4 questions at EVERY step:

### Core Tasks to Walk Through:
1. Sign up and create account
2. Create/select a company
3. Configure departments and roles
4. Submit first AI council query
5. Review stage 1/2/3 responses
6. Save a decision to knowledge base
7. Find a saved decision later
8. Change settings/preferences
9. Switch between companies (if applicable)
10. Export or share results

### For Each Step, Ask:

| Question | What to Look For |
|----------|------------------|
| **Q1: Will user TRY to achieve this?** | Is the goal obvious? Is the benefit clear? |
| **Q2: Will user NOTICE the correct action?** | Is the button/link visible? Properly labeled? |
| **Q3: Will user UNDERSTAND this leads to goal?** | Is the connection between action and outcome clear? |
| **Q4: Will user get appropriate FEEDBACK?** | Does the system confirm progress? Show success? |

**If ANY question is "No" = Usability problem. Rate severity 1-4.**

---

## Part 4: Microcopy & Tooltip Audit

This is CRITICAL for the "Mum Test" - words are half the UX.

### Tooltip Checklist
```
For EVERY tooltip in the application:
- [ ] Concise: Under 15 words (ideal), max 30 words
- [ ] Contextual: Appears at the right moment
- [ ] Positioned: Doesn't obstruct UI elements
- [ ] Valuable: Adds info (not repeating the label)
- [ ] Accessible: Keyboard dismissible, screen reader friendly
- [ ] Consistent: Same style/timing across app
- [ ] Necessary: Only used when label alone is insufficient

Red Flags:
- Tooltips that repeat the button text
- Tooltips with technical jargon
- Tooltips that appear too slowly (>200ms) or too fast
- Tooltips that cover important UI elements
- Missing tooltips on icon-only buttons
```

### Button & Label Microcopy
```
Check for:
- [ ] Action-oriented verbs ("Save Decision" not "Submit")
- [ ] Specific over generic ("Create Company" not "Create")
- [ ] Consistent terminology (don't mix Save/Submit/Confirm)
- [ ] No ambiguous labels ("Click here", "Learn more")
- [ ] Benefits over features where appropriate
- [ ] Appropriate urgency (no fake scarcity)
```

### Error Message Microcopy
```
Check for:
- [ ] Plain language (no error codes)
- [ ] Explains what happened ("Your session expired")
- [ ] Explains why ("for security reasons")
- [ ] Tells how to fix ("Please sign in again")
- [ ] Friendly tone (doesn't blame user)
- [ ] Actionable (button to resolve)
```

### Empty State Microcopy
```
Check for:
- [ ] Explains what will appear here
- [ ] Guides user on how to populate
- [ ] Has clear call-to-action
- [ ] Feels welcoming, not empty
- [ ] Appropriate illustration/icon
```

### Form Labels & Placeholders
```
Check for:
- [ ] Labels above fields (not inside as placeholder)
- [ ] Placeholders show format example, not label
- [ ] Required vs optional clearly marked
- [ ] Help text for complex fields
- [ ] Character counts where relevant
- [ ] Units shown (e.g., "minutes", "$")
```

---

## Part 5: Dark Patterns Audit (Legal Compliance)

**WARNING: Dark patterns can result in legal action. The FTC has fined companies $100M+ for violations.**

### Mandatory Checks
```
CRITICAL - Score each as Pass/Fail:

Consent & Privacy:
- [ ] PASS/FAIL: Accept and Reject buttons have EQUAL prominence
- [ ] PASS/FAIL: No pre-checked consent boxes
- [ ] PASS/FAIL: Privacy settings easily accessible
- [ ] PASS/FAIL: Data collection clearly disclosed

Subscription & Billing:
- [ ] PASS/FAIL: Cancellation as easy as signup
- [ ] PASS/FAIL: No hidden fees or surprise charges
- [ ] PASS/FAIL: Price clearly shown before commitment
- [ ] PASS/FAIL: Free trial end date clearly communicated

Manipulative Design:
- [ ] PASS/FAIL: No fake urgency (countdown timers)
- [ ] PASS/FAIL: No fake scarcity ("Only 2 left!")
- [ ] PASS/FAIL: No confirmshaming ("No thanks, I don't want to improve")
- [ ] PASS/FAIL: No trick questions (double negatives)
- [ ] PASS/FAIL: No hidden costs revealed at checkout
- [ ] PASS/FAIL: No forced continuity without warning

Navigation:
- [ ] PASS/FAIL: No "roach motel" (easy to get in, hard to get out)
- [ ] PASS/FAIL: Unsubscribe works with single click
- [ ] PASS/FAIL: Account deletion available and functional
- [ ] PASS/FAIL: No misdirection (visual tricks to wrong button)
```

**ANY "FAIL" = Severity 4 (Critical). Must fix before launch.**

---

## Part 6: AI/LLM-Specific UX Patterns

As an AI product, we have special UX requirements:

### AI Transparency
```
Check for:
- [ ] AI clearly identifies as AI (never pretends to be human)
- [ ] AI capabilities and limitations communicated
- [ ] Confidence levels shown where appropriate
- [ ] Source attribution for AI-generated content
- [ ] User can verify/challenge AI outputs
- [ ] Model being used is visible (if relevant)
```

### AI Interaction Patterns
```
Check for:
- [ ] Streaming responses feel responsive
- [ ] Typing indicators during AI "thinking"
- [ ] Long responses are scannable (formatting, headers)
- [ ] User can stop/cancel AI generation
- [ ] Regenerate option available
- [ ] Edit prompt and retry easy
```

### AI Error Handling
```
Check for:
- [ ] Token/context limit errors explained gracefully
- [ ] Rate limiting communicated (not just "error")
- [ ] Model failures have fallback messaging
- [ ] Network issues don't lose user's prompt
- [ ] Hallucination risks communicated appropriately
```

### Multi-Model UX (Council-Specific)
```
Check for:
- [ ] Clear which AI model is responding
- [ ] Easy to understand multi-stage process
- [ ] Stage transitions are clear
- [ ] Can view individual model responses
- [ ] Synthesis process is transparent
- [ ] Can compare model opinions
```

---

## Part 7: First-Time User Experience (FTUE)

### Landing & Value Proposition
```
Check for:
- [ ] Value proposition clear in 5 seconds
- [ ] Target user immediately understands "this is for me"
- [ ] Single clear call-to-action
- [ ] Social proof visible (testimonials, logos)
- [ ] No jargon in hero section
```

### Sign-Up Flow
```
Check for:
- [ ] Minimal fields (3 max ideal)
- [ ] Social login options
- [ ] Password requirements shown upfront
- [ ] Email verification is frictionless
- [ ] Can start using product before email verified
- [ ] No credit card required for trial
```

### Onboarding
```
Check for:
- [ ] Guides without overwhelming
- [ ] Can skip onboarding
- [ ] Progress indicator visible
- [ ] First "aha moment" within 60 seconds
- [ ] No dead ends
- [ ] Can return to onboarding later
```

### Time-to-Value Metrics
```
Target benchmarks:
- Time to first meaningful action: < 2 minutes
- Time to first "aha moment": < 5 minutes
- Completion rate of onboarding: > 80%
- Return rate (day 1): > 40%
```

---

## Part 8: Navigation & Information Architecture

```
Check for:
- [ ] User always knows where they are
- [ ] Navigation predictable and consistent
- [ ] Maximum 3 clicks to any feature
- [ ] Breadcrumbs where appropriate
- [ ] Back button behavior intuitive
- [ ] Related features grouped logically
- [ ] Search available for large datasets
- [ ] Mobile navigation is thumb-friendly
```

---

## Part 9: Core Workflow Mapping

Map the primary user journey and identify friction at each step:

### AI Council Query Flow
```
Step 1: User arrives
- [ ] Purpose immediately clear
- [ ] Know what to do first

Step 2: Select/create company
- [ ] Easy to find or create
- [ ] Company context is clear

Step 3: Select department/role
- [ ] Options understandable
- [ ] Good defaults available

Step 4: Type question
- [ ] No friction in input
- [ ] Suggestions/examples available
- [ ] Character limits clear

Step 5: Submit
- [ ] Clear feedback on submission
- [ ] Can cancel if needed

Step 6: Wait for response
- [ ] Engaging loading state
- [ ] Progress visible
- [ ] Estimated time shown

Step 7: Receive response
- [ ] Easy to parse/scan
- [ ] Formatting aids readability
- [ ] Key insights highlighted

Step 8: Review stages
- [ ] Navigation intuitive
- [ ] Stage purpose clear
- [ ] Can compare stages

Step 9: Save decision
- [ ] Clear call-to-action
- [ ] Confirmation shown

Step 10: Find saved decision
- [ ] Easy to retrieve
- [ ] Search/filter available
```

---

## Part 10: Feedback & Communication

```
Check for:
- [ ] Every action has visible feedback
- [ ] Loading states informative (not just spinner)
- [ ] Success confirmations clear but not intrusive
- [ ] Errors explain what went wrong AND how to fix
- [ ] Progress indicators for multi-step processes
- [ ] Real-time updates feel responsive
- [ ] Toast notifications don't obstruct UI
- [ ] Notifications dismissible
```

---

## Part 11: Performance as UX

```
Check for:
- [ ] Page loads feel instant (<1s perceived)
- [ ] Interactions respond immediately (<100ms)
- [ ] No layout shift (CLS < 0.1)
- [ ] Skeleton loaders for async content
- [ ] Optimistic updates where appropriate
- [ ] Offline capability or graceful degradation
- [ ] Large lists virtualized (no scroll jank)
```

---

## Part 12: Trust & Confidence

```
Check for:
- [ ] Professional appearance inspires confidence
- [ ] Data handling feels secure
- [ ] Pricing/billing transparent
- [ ] AI outputs feel reliable
- [ ] Company context clearly applied
- [ ] User has control over their data
- [ ] Security indicators visible (HTTPS, etc.)
- [ ] Privacy policy accessible
```

---

## Part 13: Accessibility as UX

```
Check for:
- [ ] Tab order logical
- [ ] Keyboard shortcuts for power users
- [ ] Touch targets generous (44px+)
- [ ] Text readable without zooming (16px+ body)
- [ ] Contrast sufficient (4.5:1 minimum)
- [ ] Focus states visible
- [ ] Screen reader experience coherent
- [ ] Reduced motion option respected
```

---

## Part 14: Mobile-Specific Audit

```
Check for:
- [ ] Thumb zone optimization (key actions in easy reach)
- [ ] No hover-dependent functionality
- [ ] Gestures discoverable (swipe, pull-to-refresh)
- [ ] Input fields don't get hidden by keyboard
- [ ] Tap targets have adequate spacing
- [ ] Forms use appropriate keyboard types
- [ ] Landscape orientation supported (or graceful message)
- [ ] Loading states don't block interaction
```

---

## Part 15: Delight Factors

```
Check for:
- [ ] Micro-interactions feel polished
- [ ] Helpful empty states with personality
- [ ] Thoughtful copy that guides
- [ ] Occasional delightful surprises
- [ ] Feeling of "someone cared about this"
- [ ] Smooth animations (not jarring)
- [ ] Attention to detail in edge cases
- [ ] Easter eggs for power users (optional)
```

---

## Files to Review

**User Flows:**
- `frontend/src/App.tsx` - Main routing
- `frontend/src/components/chat/` - Chat interface
- `frontend/src/components/mycompany/` - Company management
- `frontend/src/components/stage1/`, `stage2/`, `stage3/` - Deliberation stages
- All modal and dialog components

**Feedback Systems:**
- Toast/notification components
- Loading states and skeletons
- Error boundaries
- Empty states

**Forms:**
- All input components
- Validation patterns
- Submit/cancel flows

**Microcopy:**
- `frontend/src/i18n/locales/` - All text content
- Button labels throughout
- Error messages
- Tooltips

---

## Output Format

### Executive Summary
```
Overall UX Score: [1-10]
Mum Test Score: [1-10]
Legal Compliance: [PASS/FAIL]
Enterprise Ready: [YES/NO]
```

### Heuristic Scores
| Heuristic | Score (1-10) | Critical Issues |
|-----------|--------------|-----------------|
| H1: Visibility of Status | | |
| H2: Real World Match | | |
| H3: User Control | | |
| H4: Consistency | | |
| H5: Error Prevention | | |
| H6: Recognition > Recall | | |
| H7: Flexibility | | |
| H8: Minimalist Design | | |
| H9: Error Recovery | | |
| H10: Help & Documentation | | |

### Critical Issues (Severity 4)
| Location | Issue | Heuristic | Impact | Fix |
|----------|-------|-----------|--------|-----|

### Major Issues (Severity 3)
| Location | Issue | Heuristic | Impact | Fix |
|----------|-------|-----------|--------|-----|

### Minor Issues (Severity 2)
| Location | Issue | Heuristic | Impact | Fix |
|----------|-------|-----------|--------|-----|

### Cosmetic Issues (Severity 1)
| Location | Issue | Heuristic | Impact | Fix |
|----------|-------|-----------|--------|-----|

### Dark Patterns Audit Results
| Check | Status | Notes |
|-------|--------|-------|

### Microcopy Audit Results
| Category | Issues Found | Recommendations |
|----------|--------------|-----------------|

### AI UX Audit Results
| Category | Score | Issues |
|----------|-------|--------|

### Cognitive Walkthrough Results
| Task | Success Rate | Failure Points |
|------|--------------|----------------|

### Quantitative Metrics (if measurable)
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Time to first action | | < 2 min | |
| Task success rate | | > 95% | |
| Error rate | | < 5% | |

### Delight Opportunities
Quick wins to make users smile.

### Recommendations Priority
1. **CRITICAL** - Fix before any release (Severity 4)
2. **HIGH** - Fix this sprint (Severity 3)
3. **MEDIUM** - Fix next sprint (Severity 2)
4. **LOW** - Polish when time permits (Severity 1)

---

## Benchmarks for $25M Due Diligence

To pass due diligence, the product should achieve:

| Metric | Minimum | Target | Exceptional |
|--------|---------|--------|-------------|
| Overall UX Score | 7/10 | 8/10 | 9/10 |
| Mum Test Score | 7/10 | 8/10 | 9/10 |
| Dark Patterns | 100% Pass | 100% Pass | 100% Pass |
| Critical Issues | 0 | 0 | 0 |
| Major Issues | < 5 | < 3 | 0 |
| Nielsen Heuristics Avg | 7/10 | 8/10 | 9/10 |
| FTUE Completion | > 70% | > 80% | > 90% |

---

Remember: **The best UX is invisible.** Users should never think about the interface - only their goals. If mum can use it without calling for help, you've succeeded.
