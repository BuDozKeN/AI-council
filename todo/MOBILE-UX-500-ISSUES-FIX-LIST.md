# Mobile UX Audit: 500 Issues Fix List

> Generated: 2026-01-27 | Viewport: 375x812 (iPhone 14 Pro), 320x568 (iPhone SE)
> Priority: P0 (Critical) → P1 (High) → P2 (Medium) → P3 (Low)

---

## P0: CRITICAL - Fix Immediately (Security & Accessibility Blockers)

### Accessibility Tree Missing Content (WCAG 2.1 Failure)

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 277 | Playbooks tab content invisible to screen readers | MyCompany Playbooks | `frontend/src/components/mycompany/tabs/PlaybooksTab.tsx` | Ensure content renders in accessibility tree, remove any `aria-hidden` from visible content |
| 284 | Decisions tab content invisible to screen readers | MyCompany Decisions | `frontend/src/components/mycompany/tabs/DecisionsTab.tsx` | Same as above |
| 285 | All decision items missing from a11y tree | DecisionsTab | `frontend/src/components/mycompany/tabs/DecisionsTab.tsx` | Use semantic list elements `<ul><li>` |
| 292 | Activity tab 20 events invisible to screen readers | MyCompany Activity | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Use semantic list elements |
| 293 | Activity events not announced | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Add proper ARIA labels |
| 301 | Usage tab dashboard invisible to screen readers | MyCompany Usage | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Add text alternatives for charts |
| 302 | Usage stats/charts inaccessible | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Add `aria-label` with data values |
| 303 | Chart has no data table alternative | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Add hidden data table or `aria-describedby` |
| 311 | Entire Settings panel missing from a11y tree | Settings | `frontend/src/components/settings/index.tsx` | Check BottomSheet/Sheet component rendering |
| 312 | Settings tabs not accessible | Settings | `frontend/src/components/settings/index.tsx` | Use proper `role="tablist"` and `role="tab"` |
| 313 | Settings form fields not accessible | Settings Profile | `frontend/src/components/settings/ProfileSection.tsx` | Ensure inputs have associated labels |
| 323 | Billing tab content inaccessible | Settings Billing | `frontend/src/components/settings/BillingSection.tsx` | Render content in a11y tree |
| 324 | Billing plans/pricing inaccessible | Settings Billing | `frontend/src/components/settings/BillingSection.tsx` | Use semantic card/list elements |
| 332 | API Keys tab content inaccessible | Settings API Keys | `frontend/src/components/settings/ApiKeysSection.tsx` | Render content in a11y tree |
| 338 | Developer tab content inaccessible | Settings Developer | `frontend/src/components/settings/DeveloperSection.tsx` | Render toggles with labels |
| 346 | LLM Hub tab content inaccessible | Settings LLM Hub | `frontend/src/components/settings/LLMHubSection.tsx` | Render cards in a11y tree |
| 367 | Admin Companies list inaccessible | Admin Portal | `frontend/src/components/admin/AdminPortal.tsx` | Use semantic table/list |
| 368 | Company items missing from a11y tree | Admin Companies | `frontend/src/components/admin/AdminPortal.tsx` | Add proper ARIA roles |
| 372 | Audit log entries inaccessible | Admin Audit Logs | `frontend/src/components/admin/AdminPortal.tsx` | Use semantic list elements |
| 373 | Audit logs content missing | Admin Audit Logs | `frontend/src/components/admin/AdminPortal.tsx` | Render in a11y tree |
| 380 | Admin Roles content missing | Admin Roles | `frontend/src/components/admin/AdminPortal.tsx` | Add proper list structure |
| 381 | Admin role entry inaccessible | Admin Roles | `frontend/src/components/admin/AdminPortal.tsx` | Use semantic elements |

### Invalid HTML Structure (WCAG 4.1.1)

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 254 | Nested buttons (button > button) | MyCompany Panel | `frontend/src/components/MyCompany.tsx` | Replace outer `<button>` with `<div role="button" tabindex="0">` |
| 255 | Button contains entire page content as name | MyCompany Panel | `frontend/src/components/MyCompany.tsx` | Add proper `aria-label`, remove content from button |
| 257 | Triple nested buttons | MyCompany Panel | `frontend/src/components/MyCompany.tsx` | Restructure component hierarchy |
| 264 | Button has projects list as accessible name | MyCompany Projects | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Fix button structure |
| 265 | Nested interactive elements | MyCompany | `frontend/src/components/MyCompany.tsx` | Use div with role instead of nested buttons |
| 269 | Project item contains nested buttons | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Separate action buttons from container |
| 430 | Nested main elements (main > main) | ChatInterface | `frontend/src/components/ChatInterface.tsx` | Change inner `<main>` to `<section>` or `<article>` |

### Security Vulnerabilities

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 37 | Internal DB function name exposed | Auth/Signup | `backend/routers/auth.py` | Catch PostgreSQL errors, return generic "Sign up unavailable" message |

### Critical Bugs

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 429 | Delete button navigates instead of deleting | Sidebar Conversations | `frontend/src/components/Sidebar.tsx` | Verify `e.stopPropagation()` on all delete handlers, check event bubbling |
| 270 | Wrong project expands on click | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Fix click handler to target correct project ID |
| 271 | Stats change without user action | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Debug state management, check for race conditions |
| 353 | Data mismatch - "6 users" vs "2 users" | Admin Analytics | `frontend/src/components/admin/AdminPortal.tsx` | Sync visual and a11y tree data |

---

## P1: HIGH - Mobile UX Broken

### Touch Target Violations (WCAG 2.5.5 - 44x44px minimum)

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 1 | Login social buttons too small | Login | `frontend/src/components/Login.css` | Add `min-height: 44px; min-width: 44px` |
| 2 | Theme toggle button too small | ThemeToggle | `frontend/src/components/ui/ThemeToggle.css` | Increase to 44x44px |
| 3 | Sidebar action buttons too small | ConversationItem | `frontend/src/components/sidebar/ConversationItem.css` | Add `.touch-target { min-height: 44px; min-width: 44px; }` |
| 4 | Star/Archive/Delete buttons cramped | ConversationItem | `frontend/src/components/sidebar/ConversationItem.css` | Increase spacing and size |
| 5 | Radio buttons touch targets small | ChatInput | `frontend/src/components/chat/ChatInput.css` | Increase clickable area |
| 272 | Action buttons (Complete/Archive/Delete) cramped | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.css` | Increase button sizes |

### Navigation Truncation

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 258 | Bottom nav "Usage" shows "Us..." | BottomNav | `frontend/src/components/ui/BottomNav.css` | Use icons-only at small widths or reduce text size |
| 282 | Bottom nav continues to truncate | BottomNav | `frontend/src/components/ui/BottomNav.css` | Add `@media (max-width: 375px)` with icon-only mode |
| 289 | "Us..." still truncated | BottomNav | `frontend/src/components/ui/BottomNav.css` | Fix responsive breakpoints |
| 298 | Usage tab text cut off | BottomNav | `frontend/src/components/ui/BottomNav.css` | Same fix as above |
| 252 | "Marketing" shows "4 r..." | TeamTab | `frontend/src/components/mycompany/tabs/TeamTab.css` | Allow text wrap or use ellipsis with title attr |
| 253 | Bottom nav text truncated | BottomNav | `frontend/src/components/ui/BottomNav.css` | Add text-overflow handling |
| 382 | Email truncated "ozpaniard..." | Admin Roles | `frontend/src/components/admin/AdminPortal.css` | Show full email or add title attribute |

### FAB Overlap Issues

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 251 | FAB overlaps Usage tab | FloatingActionButton | `frontend/src/components/ui/FloatingActionButton.css` | Add `bottom: calc(var(--bottom-nav-height) + 16px)` |
| 261 | FAB overlaps Activity tab | FloatingActionButton | `frontend/src/components/ui/FloatingActionButton.css` | Same fix |
| 274 | FAB continues to overlap | FloatingActionButton | `frontend/src/components/ui/FloatingActionButton.css` | Same fix |
| 281 | FAB still overlapping | FloatingActionButton | `frontend/src/components/ui/FloatingActionButton.css` | Same fix |

### Form & Input Issues

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 425 | Submit button has no accessible name | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add `aria-label="Send message"` |
| 426 | Submit arrow icon lacks label | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add `aria-label` |
| 314 | Save Changes button not accessible | Settings | `frontend/src/components/settings/ProfileSection.tsx` | Ensure button is in a11y tree |
| 315 | Email field disabled no explanation | Settings Profile | `frontend/src/components/settings/ProfileSection.tsx` | Add `aria-describedby` explaining why disabled |
| 316 | Phone field no placeholder | Settings Profile | `frontend/src/components/settings/ProfileSection.tsx` | Add placeholder like "+1 (555) 000-0000" |
| 317 | Bio placeholder too vague | Settings Profile | `frontend/src/components/settings/ProfileSection.tsx` | Change to "Describe your role and expertise..." |
| 320 | Email field disabled without reason | Settings | `frontend/src/components/settings/ProfileSection.tsx` | Add helper text "Email cannot be changed" |
| 415 | Placeholder changes based on AI mode | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Keep consistent placeholder text |
| 416 | Stats show "5 AIs" in 1 AI mode | Hero/Landing | `frontend/src/components/landing/Hero.tsx` | Conditionally render based on selected mode |
| 417 | Radio buttons lack radiogroup | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Wrap in `<div role="radiogroup" aria-label="AI mode">` |
| 432 | Message input placeholder unhelpful | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Change from "Message input" to descriptive text |
| 433 | Send button "disableable disabled" | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Clean up button state handling |

### Missing Labels & ARIA

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 318 | Close button no accessible label | Settings/Modals | Multiple files | Add `aria-label="Close"` to all close buttons |
| 335 | Expand chevron lacks label | API Keys | `frontend/src/components/settings/ApiKeysSection.tsx` | Add `aria-label="Expand details"` |
| 341 | Toggle switches not labeled | Developer Settings | `frontend/src/components/settings/DeveloperSection.tsx` | Add `aria-label` to each toggle |
| 349 | Chevron expand icons lack labels | LLM Hub | `frontend/src/components/settings/LLMHubSection.tsx` | Add `aria-label="View details"` |
| 419 | Lightning bolt icon no label | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add `aria-label="Quick actions"` or similar |
| 420 | Image icon button lacks tooltip | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add `aria-label="Attach image"` |
| 421 | Send arrow button lacks label | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add `aria-label="Send message"` |

---

## P2: MEDIUM - UX Polish

### Visual Consistency Issues

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 6 | Theme toggle invisible in dark mode | ThemeToggle | `frontend/src/components/ui/ThemeToggle.css` | Ensure sufficient contrast in dark mode |
| 7 | "Continue with Google" invisible dark mode | Login | `frontend/src/components/Login.css` | Fix button colors for dark mode |
| 259 | "0" badge yellow on dark - contrast | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.css` | Check color contrast ratio |
| 262 | Status badges lack visual hierarchy | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.css` | Add distinct styling per status |
| 263 | Filter dropdowns cramped | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.css` | Add spacing between dropdowns |
| 283 | Department badges inconsistent colors | TeamTab | `frontend/src/components/mycompany/tabs/TeamTab.css` | Standardize color scheme |
| 309 | Purple/green chart colors fail for colorblind | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Use patterns in addition to colors |
| 394 | Multi-select unclear | Configure Context | `frontend/src/components/chat/ConfigureContext.tsx` | Add "Select multiple" hint |
| 395 | "1" badge meaning unclear | Configure Context | `frontend/src/components/chat/ConfigureContext.tsx` | Change to "1 selected" |
| 410 | Department Default + Balanced confusing | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Clarify hierarchy |
| 448 | Green checkmark meaning unclear | AI Responses | `frontend/src/components/Stage1.tsx` | Add tooltip "Best answer" |
| 450 | Response cards identical despite ranking | Stage1 | `frontend/src/components/Stage1.tsx` | Add visual differentiation for top 3 |
| 461 | "AI can make mistakes" text faded | ChatInterface | `frontend/src/components/ChatInterface.css` | Increase text contrast |
| 463 | Save Answer button overly prominent | Stage3 | `frontend/src/components/Stage3.css` | Reduce visual weight |
| 466 | Inconsistent button styling | Stage3 | `frontend/src/components/Stage3.css` | Standardize filled vs outlined |
| 472 | Focus outline too subtle | Global | `frontend/src/styles/design-tokens.css` | Increase `--focus-ring-width: 3px` |
| 473 | Green checkmark overlaps logo | Stage1 | `frontend/src/components/Stage1.css` | Reposition indicator |
| 474 | Chevron vs triangle inconsistent | Multiple | Multiple files | Standardize expand/collapse icons |

### Content & Copy Issues

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 8 | "block_new_signups" shown to users | Login Error | `frontend/src/components/Login.tsx` | Show "Sign up is currently unavailable" |
| 9 | Password validation too strict message | Login | `frontend/src/components/Login.tsx` | Show specific requirements |
| 266 | "0 decisions" meaning unclear | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Add context "No decisions yet" |
| 278 | "4 Total" unclear meaning | PlaybooksTab | `frontend/src/components/mycompany/tabs/PlaybooksTab.tsx` | Change to "4 Playbooks" |
| 280 | "SOP" abbreviation unexpanded | PlaybooksTab | `frontend/src/components/mycompany/tabs/PlaybooksTab.tsx` | Add tooltip "Standard Operating Procedure" |
| 288 | Yellow bullet meaning unclear | DecisionsTab | `frontend/src/components/mycompany/tabs/DecisionsTab.tsx` | Add legend or tooltip |
| 291 | Date format "20 Dec" missing year | DecisionsTab | `frontend/src/components/mycompany/tabs/DecisionsTab.tsx` | Show full date for older items |
| 294 | "MEMBER_UPDATED" technical jargon | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Change to "Role changed" |
| 295 | "CREATED" badge redundant | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Remove or vary by action type |
| 296 | Date headers missing year | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Add year for clarity |
| 297 | Colored bullets no legend | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Add legend explaining colors |
| 304 | "Cache Hit Rate 0.0%" no context | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Add explanation if good/bad |
| 305 | "510.5K" units unclear | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Add "tokens" label |
| 306 | "7d, 30d, 90d" abbreviations | UsageTab | `frontend/src/components/mycompany/tabs/UsageTab.tsx` | Change to "7 days" etc or add tooltip |
| 331 | "(Unlimited)" contradicts "136 queries" | Billing | `frontend/src/components/settings/BillingSection.tsx` | Clarify messaging |
| 334 | Gray dot meaning unclear | API Keys | `frontend/src/components/settings/ApiKeysSection.tsx` | Add tooltip "Connected/Disconnected" |
| 340 | Warning banner not accessible | Developer Settings | `frontend/src/components/settings/DeveloperSection.tsx` | Add `role="alert"` |
| 344 | "credits will be consumed" not accessible | Developer Settings | `frontend/src/components/settings/DeveloperSection.tsx` | Ensure in a11y tree |
| 351 | Green dot meaning unclear | Admin Analytics | `frontend/src/components/admin/AdminPortal.tsx` | Add tooltip "Online/Active" |
| 352 | Download button disabled no reason | Admin Analytics | `frontend/src/components/admin/AdminPortal.tsx` | Add `aria-describedby` with reason |
| 371 | "Simple Af" inappropriate company name | Admin Companies | Database/Seed data | Clean up test data |
| 375 | "view_audit_logs" technical jargon | Admin Audit | `frontend/src/components/admin/AdminPortal.tsx` | Change to "Viewed audit logs" |
| 378 | "21 Jan 2026" future date bug | Admin Audit | System date or data issue | Fix date handling |
| 383 | "Super Admin" badge no explanation | Admin Roles | `frontend/src/components/admin/AdminPortal.tsx` | Add tooltip with permissions |
| 384 | "20 Jan 2026" future date | Admin Roles | System date issue | Check system time/date handling |
| 391 | "Company 1" label vague | Configure Context | `frontend/src/components/chat/ConfigureContext.tsx` | Change to "Select Company" |
| 406 | "Department Default" meaning unclear | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Add explanation text |
| 411 | Icons unclear without tooltips | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Add title attributes |
| 443 | Emoji rankings not accessible | Stage1 | `frontend/src/components/Stage1.tsx` | Add `aria-label="Ranked #1"` etc |
| 444 | Response preview truncation | Stage1 | `frontend/src/components/Stage1.css` | Show "Read more" link |
| 445 | Responses cut mid-sentence | Stage1 | `frontend/src/components/Stage1.tsx` | Truncate at sentence boundaries |
| 447 | Table not semantic | Stage3 | `frontend/src/components/Stage3.tsx` | Convert to `<table>` with `<th>` headers |

### Navigation & State Issues

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 10 | Page title wrong on login | Login | `frontend/src/components/Login.tsx` | Set document.title = "Login - AxCouncil" |
| 256 | Projects tab no content initially | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Show loading state or empty state |
| 260 | Project list invisible to screen readers | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Use semantic list |
| 267 | Project items all buttons | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Use `<article>` or `<li>` elements |
| 273 | Delete lacks confirmation | ProjectsTab | `frontend/src/components/mycompany/tabs/ProjectsTab.tsx` | Add confirmation modal |
| 290 | No pagination for decisions | DecisionsTab | `frontend/src/components/mycompany/tabs/DecisionsTab.tsx` | Add "Load more" button |
| 299 | External link icon unexplained | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.tsx` | Add `aria-label="Opens in new tab"` |
| 300 | Bottom text cut off | ActivityTab | `frontend/src/components/mycompany/tabs/ActivityTab.css` | Fix overflow handling |
| 307 | "Usage" width inconsistent | BottomNav | `frontend/src/components/ui/BottomNav.css` | Fix flex basis |
| 385 | No way to add new admin | Admin Roles | `frontend/src/components/admin/AdminPortal.tsx` | Add "Invite Admin" button |
| 386 | No role management actions | Admin Roles | `frontend/src/components/admin/AdminPortal.tsx` | Add edit/delete options |
| 387 | Admin Settings "Coming Soon" | Admin Settings | `frontend/src/components/admin/AdminPortal.tsx` | Implement or hide tab |
| 400 | No indication of context effect | Configure Context | `frontend/src/components/chat/ConfigureContext.tsx` | Add help text |
| 401 | No scroll indicator | Configure Context | `frontend/src/components/chat/ConfigureContext.css` | Add scroll shadow or indicator |
| 402 | No search in project list | Configure Context | `frontend/src/components/chat/ConfigureContext.tsx` | Add search input |
| 404 | Gray circle checkboxes non-standard | Configure Context | `frontend/src/components/chat/ConfigureContext.css` | Use standard checkbox styling |
| 408 | "LLM Hub Settings" unclear navigation | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Clarify or change to button |
| 413 | No close button visible | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Add visible close button |
| 414 | No confirm button | Response Style | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Auto-save is fine but indicate it |
| 418 | "Context 1" badge unclear | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Change to "1 context" |
| 422 | Stats contradict mode selection | Landing/Hero | `frontend/src/components/landing/Hero.tsx` | Update stats based on mode |
| 423 | Sidebar arrow nearly invisible | Sidebar | `frontend/src/components/Sidebar.css` | Increase contrast/size |
| 424 | Toggle vs stats contradiction | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Sync display with selection |
| 428 | No character count | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Add character counter |
| 435 | Bottom nav changes per page | BottomNav | `frontend/src/components/ui/BottomNav.tsx` | Keep consistent navigation |
| 436 | "New" button too prominent | BottomNav | `frontend/src/components/ui/BottomNav.css` | Reduce visual weight |
| 437 | Medal emoji unclear | Stage1 | `frontend/src/components/Stage1.tsx` | Add text label "1st place" |
| 438 | AI chip click action unclear | Stage1 | `frontend/src/components/Stage1.tsx` | Add tooltip or remove click handler |
| 439 | Triangle text characters | Stage1/Collapsibles | Multiple files | Use proper icon components |
| 440 | Context pill unclear | ChatInput | `frontend/src/components/chat/ChatInput.tsx` | Show selected context name |
| 441 | Sidebar arrow invisible | Sidebar | `frontend/src/components/Sidebar.css` | Fix styling |
| 442 | CONTEXT badge click action | ChatInterface | `frontend/src/components/ChatInterface.tsx` | Add tooltip explaining purpose |

---

## P3: LOW - Keyboard & Focus Management

### Keyboard Navigation

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 467 | Tab focuses article not elements | Stage1 | `frontend/src/components/Stage1.tsx` | Make articles non-focusable, focus buttons instead |
| 468 | Enter on article doesn't expand | Stage1 | `frontend/src/components/Stage1.tsx` | Add `onKeyDown` handler for Enter/Space |
| 469 | No visible focus on articles | Stage1 | `frontend/src/components/Stage1.css` | Add `:focus-visible` styles |
| 470 | Tab order jumps unpredictably | Multiple | Multiple files | Set logical `tabindex` order |
| 471 | Many elements before main content | App layout | `frontend/src/App.tsx` | Ensure skip link works properly |
| 477 | Escape key no effect | Dialogs/Sheets | `frontend/src/components/ui/BottomSheet.tsx` | Add Escape key handler to close |
| 478 | No collapse all shortcut | Collapsibles | `frontend/src/components/Stage1.tsx` | Add keyboard shortcut |

### Focus Trapping

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 319 | "Settings dialog" text redundant | Settings | `frontend/src/components/settings/index.tsx` | Remove or hide from a11y tree |
| 321 | Empty generic elements | Multiple | Multiple files | Remove unnecessary wrapper divs |
| 322 | Tabs lack tablist role | Settings | `frontend/src/components/settings/index.tsx` | Add `role="tablist"` wrapper |
| 390 | "Configure Context dialog" redundant | ConfigureContext | `frontend/src/components/chat/ConfigureContext.tsx` | Remove redundant announcement |
| 392 | Context items are buttons | ConfigureContext | `frontend/src/components/chat/ConfigureContext.tsx` | Use checkboxes instead |
| 393 | Empty generic at dialog end | ConfigureContext | `frontend/src/components/chat/ConfigureContext.tsx` | Remove empty element |
| 405 | "Response Style dialog" redundant | ResponseStyle | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Remove |
| 407 | Style options are buttons | ResponseStyle | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Use radio buttons |
| 409 | Empty generic at end | ResponseStyle | `frontend/src/components/chat/ResponseStyleSheet.tsx` | Remove |

---

## P3: LOW - 320px Viewport Specific

| ID | Issue | Component | File Path | Fix |
|----|-------|-----------|-----------|-----|
| 454 | Content cramped at 320px | Global | Add new breakpoint | Add `@media (max-width: 360px)` rules |
| 455 | Yellow bar clipped | Stage indicators | `frontend/src/components/Stage1.css` | Fix overflow |
| 456 | Input area too large | ChatInput | `frontend/src/components/chat/ChatInput.css` | Reduce padding at small screens |
| 457 | Bottom nav truncates | BottomNav | `frontend/src/components/ui/BottomNav.css` | Icon-only mode |
| 458 | Limited visible content | Global | Multiple CSS files | Optimize vertical space |
| 459 | Sidebar arrow overlaps | Sidebar | `frontend/src/components/Sidebar.css` | Adjust positioning |
| 460 | No content indication below | Collapsibles | `frontend/src/components/Stage1.css` | Add "scroll for more" hint |
| 464 | Action buttons cramped | Stage3 | `frontend/src/components/Stage3.css` | Stack vertically at small widths |
| 465 | Sidebar still overlapping | Sidebar | `frontend/src/components/Sidebar.css` | Fix z-index |
| 475 | Card cut off awkwardly | Stage1 | `frontend/src/components/Stage1.css` | Prevent mid-card cuts |
| 476 | Scroll area breaks mid-card | Stage1 | `frontend/src/components/Stage1.css` | Snap to card boundaries |

---

## P3: LOW - Missing Features (Tech Debt)

| ID | Issue | Feature | Priority | Notes |
|----|-------|---------|----------|-------|
| 479 | No loading skeletons | UX | P3 | Add shimmer effects during load |
| 480 | No error boundaries visible | Error Handling | P2 | Add React error boundaries |
| 481 | No offline indicator | PWA | P3 | Show offline status banner |
| 482 | No session timeout warning | Security/UX | P2 | Warn before auto-logout |
| 483 | No unsaved changes warning | UX | P2 | Add beforeunload handler |
| 484 | No print stylesheet | UX | P3 | Add `@media print` styles |
| 485 | No share functionality | Feature | P3 | Add share button for conversations |
| 486 | No export to PDF | Feature | P3 | Add PDF export option |
| 487 | Dark mode toggle only in sidebar | UX | P3 | Add to main UI |
| 488 | No high contrast mode | Accessibility | P2 | Add high contrast theme option |
| 489 | No reduced motion support | Accessibility | P2 | Add `prefers-reduced-motion` media query |
| 490 | No voice input | Accessibility | P3 | Add speech-to-text option |
| 491 | No text-to-speech | Accessibility | P3 | Add TTS for AI responses |
| 492 | No font size controls | Accessibility | P2 | Add font size adjustment |
| 493 | No line spacing controls | Accessibility | P3 | Add line height adjustment |
| 494 | No dyslexia font option | Accessibility | P3 | Add OpenDyslexic font option |
| 495 | No color blindness settings | Accessibility | P2 | Add colorblind-friendly modes |
| 496 | No keyboard shortcut help | UX | P2 | Add `?` key to show shortcuts |
| 497 | No onboarding tutorial | UX | P2 | Add first-time user guide |
| 498 | No contextual help tooltips | UX | P3 | Add `?` icons with tooltips |
| 499 | No feedback mechanism | UX | P2 | Add feedback button |
| 500 | No version/changelog visible | UX | P3 | Add version info in footer |

---

## Quick Reference: Files Needing Most Changes

| File | Issue Count | Priority |
|------|-------------|----------|
| `frontend/src/components/MyCompany.tsx` | 15+ | P0 |
| `frontend/src/components/admin/AdminPortal.tsx` | 20+ | P1 |
| `frontend/src/components/settings/index.tsx` | 15+ | P0 |
| `frontend/src/components/chat/ChatInput.tsx` | 12+ | P1 |
| `frontend/src/components/Stage1.tsx` | 10+ | P2 |
| `frontend/src/components/ui/BottomNav.css` | 8+ | P1 |
| `frontend/src/components/ui/BottomSheet.tsx` | 5+ | P0 |
| `frontend/src/components/mycompany/tabs/*.tsx` | 25+ | P0 |
| `frontend/src/styles/design-tokens.css` | 3+ | P2 |

---

## Implementation Order

1. **Day 1**: P0 Accessibility tree issues (Items 277-381) - These block screen reader users entirely
2. **Day 2**: P0 Invalid HTML (Items 254-430) - These cause unpredictable behavior
3. **Day 3**: P1 Touch targets & truncation (Items 1-5, 258-298)
4. **Day 4**: P1 FAB overlap & form issues (Items 251-274, 314-433)
5. **Day 5**: P2 Visual polish & copy (Items 6-9, 259-450)
6. **Week 2**: P3 Keyboard, 320px, missing features

---

*Generated by Mobile UX Audit Agent | AxCouncil $25M Exit Readiness*
