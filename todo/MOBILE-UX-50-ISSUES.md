# Mobile UX/UI Audit: 50 Critical Issues
## $25M Due Diligence Grade - January 19, 2026

> **Verdict:** The app has pockets of excellence but fails the "would I pay $25M for this" test due to fundamental mobile UX inconsistencies.

---

## CRITICAL (P0) - Fix Within 24 Hours

### Issue #1: ⌘K Keyboard Shortcut Showing on Mobile
- **Location:** Sidebar → Search input placeholder
- **Current:** `"Search conversations... (⌘K)"`
- **Problem:** Desktop keyboard shortcut displayed on mobile where it's useless
- **Fix:** Hide `(⌘K)` when viewport ≤ 640px
- **File:** `frontend/src/components/sidebar/ConversationList.tsx`

### Issue #2: OmniBar SVG Icons Have 5 Different Sizes
- **Location:** OmniBar context icons
- **Current:** 14px, 14px, 14px, 14px, 14px, 12px(!), 14px, 18px, 24px
- **Problem:** Visual chaos - icons should be uniform
- **Fix:** Standardize all icons to 20px inside 44px touch targets
- **File:** `frontend/src/components/shared/omnibar/`

### Issue #3: Bottom Nav Buttons Have Inconsistent Widths
- **Location:** Bottom navigation bar
- **Current:** "New" 44px, "Chats" 47px, "Company" 69px, "Settings" 61px
- **Problem:** Uneven spacing creates visual imbalance
- **Fix:** Use `flex: 1` for equal distribution or fixed widths
- **File:** `frontend/src/components/shared/BottomNav.css`

### Issue #4: Settings Tabs Have NO Visible Labels on Mobile
- **Location:** Settings → Sidebar tabs
- **Current:** 6 icon-only buttons with no text, no aria-labels
- **Problem:** Users cannot identify tabs - accessibility failure
- **Fix:** Add tooltips or small labels below icons
- **File:** `frontend/src/components/settings/SettingsLayout.css`

### Issue #5: Settings Tabs Missing ARIA Labels
- **Location:** Settings → Sidebar tabs
- **Current:** `aria-label: null` for all 6 tabs
- **Problem:** Screen readers cannot identify tabs - WCAG failure
- **Fix:** Add `aria-label="Profile"`, `aria-label="Billing"`, etc.
- **File:** `frontend/src/components/settings/Settings.tsx`

### Issue #6: Tab Bar Has Hidden Tabs With No Scroll Indicator
- **Location:** My Company → Tab bar
- **Current:** scrollWidth 444px, clientWidth 388px, scrollLeft 0
- **Problem:** "Activity" and "Usage" tabs hidden, no visual hint to scroll
- **Fix:** Add fade/gradient on right edge or scroll dots
- **File:** `frontend/src/components/mycompany/styles/shell/mobile/navigation.css`

### Issue #7: 11 Different Font Sizes in Use
- **Location:** App-wide
- **Current:** 10px, 10.4px(!), 12px, 13px, 14px, 15px, 16px, 18px, 20px, 30px, 36px
- **Problem:** No consistent type scale - looks unprofessional
- **Fix:** Reduce to 5-6 sizes: 12, 14, 16, 20, 24, 32
- **File:** `frontend/src/styles/design-tokens.css`

### Issue #8: "1 AI" Orphan Label in OmniBar
- **Location:** OmniBar → Right side (position x:353, y:764)
- **Current:** Floating "1 AI" text with no context
- **Problem:** Users don't understand what this means
- **Fix:** Remove or integrate into mode toggle button
- **File:** `frontend/src/components/shared/omnibar/OmniBar.tsx`

---

## MAJOR (P1) - Fix This Sprint

### Issue #9: Border-Radius Uses 4+ Different Values
- **Location:** App-wide buttons
- **Current:** "8px", "0px 12px 12px 0px", "4px", "9999px"
- **Problem:** Inconsistent visual language
- **Fix:** Standardize: 8px buttons, 12px cards, 9999px pills
- **Files:** Multiple CSS files

### Issue #10: Theme Toggle Barely Visible
- **Location:** Top-right corner (all screens)
- **Current:** 44x44px but very subtle icon
- **Problem:** Users may not notice the toggle exists
- **Fix:** Add subtle border or background on hover
- **File:** `frontend/src/components/ThemeToggle.css`

### Issue #11: Mystery Palm Tree Emoji in Corner
- **Location:** Bottom-right corner (all screens)
- **Current:** 🏝️ emoji floating in corner
- **Problem:** What is this? Confuses users
- **Fix:** Remove or explain its purpose
- **File:** Unknown - search codebase for palm tree

### Issue #12: Sidebar Footer Buttons Inconsistent Widths
- **Location:** Sidebar → Footer
- **Current:** Shield 44px, "My Company" 106px, "Settings" 106px, "Sign Out" 106px
- **Problem:** Shield icon has no label, others do - inconsistent
- **Fix:** Either all icons or all icon+label
- **File:** `frontend/src/components/sidebar/Sidebar.css`

### Issue #13: Large Gap Between OmniBar and Bottom Nav
- **Location:** Landing page
- **Current:** 88px margin between OmniBar card and bottom nav
- **Problem:** Wasted vertical space on mobile
- **Fix:** Reduce to 16-24px
- **File:** `frontend/src/components/shared/omnibar/mobile.css`

### Issue #14: Sidebar Toggle Chevron Looks Out of Place
- **Location:** Left edge of screen (landing page)
- **Current:** Small ">" chevron half-hidden on left edge
- **Problem:** Doesn't look like a button, seems like a bug
- **Fix:** Use hamburger icon or hide when sidebar closed
- **File:** `frontend/src/components/sidebar/Sidebar.css`

### Issue #15: TOC Links Not Obviously Clickable
- **Location:** My Company → Overview → Table of Contents
- **Current:** Plain text with no underline, textDecoration: none
- **Problem:** Users don't know these are links
- **Fix:** Add underline on hover, or arrow indicators
- **File:** `frontend/src/components/ui/TableOfContents.css`

### Issue #16: Floating Copy Button Without Context
- **Location:** My Company → Overview (top: 287, right: 13)
- **Current:** Orphan copy icon with no label
- **Problem:** Users don't know what it copies
- **Fix:** Add tooltip "Copy business context"
- **File:** `frontend/src/components/mycompany/tabs/OverviewTab.tsx`

### Issue #17: Input Fields Have Inconsistent Borders
- **Location:** Settings → Form inputs
- **Current:** Some inputs 1px border, others 0px border
- **Problem:** Hard to identify empty form fields
- **Fix:** Standardize all inputs to 1px border
- **File:** `frontend/src/components/settings/SettingsLayout.css`

### Issue #18: Department Card Colors Not Explained
- **Location:** My Company → Team
- **Current:** 7 different left-border colors (red, purple, orange, etc.)
- **Problem:** No legend explaining color meaning
- **Fix:** Add color legend or remove decorative colors
- **File:** `frontend/src/components/mycompany/tabs/TeamTab.tsx`

### Issue #19: Conversation Group Count Badges Look Orphan
- **Location:** Sidebar → "TECHNOLOGY 2" and "STANDARD 8"
- **Current:** Count badges right-aligned, far from group name
- **Problem:** Disconnected visual relationship
- **Fix:** Place count immediately after group name
- **File:** `frontend/src/components/sidebar/ConversationList.css`

### Issue #20: "Scroll for more conversations" Text Unprofessional
- **Location:** Sidebar → Bottom of conversation list
- **Current:** Light gray italic text
- **Problem:** Looks like a TODO comment, not polished UI
- **Fix:** Remove text, use fade gradient instead
- **File:** `frontend/src/components/sidebar/ConversationList.tsx`

---

## MINOR (P2) - Fix Next Sprint

### Issue #21: Pills "5 AIs → 3 rounds → 1 answer" Arrow Spacing
- **Location:** Landing page hero
- **Current:** Arrows appear slightly different widths
- **Problem:** Subtle inconsistency
- **Fix:** Use consistent arrow width

### Issue #22: New Chat Button Icon/Text Proportion
- **Location:** Sidebar header
- **Current:** 24px icon with text
- **Problem:** Icon feels slightly small
- **Fix:** Increase to 20px icon size

### Issue #23: Company Dropdown Cramped Against Back Button
- **Location:** My Company → Header
- **Current:** 142px dropdown starting at left: 135px
- **Problem:** Feels cramped
- **Fix:** Add 8px more spacing

### Issue #24: Edit Button Style Inconsistent
- **Location:** My Company → Overview
- **Current:** 80x44px with 12px border-radius
- **Problem:** Different radius from other buttons
- **Fix:** Standardize border-radius

### Issue #25: Filter Dropdowns Visual Separation
- **Location:** Sidebar → "All Conversations (10)" and "Latest"
- **Current:** Two dropdowns side by side
- **Problem:** No clear visual separator
- **Fix:** Add divider or increase gap

### Issue #26: Settings Title Looks Like a Link
- **Location:** Settings → Header
- **Current:** Light blue/teal color
- **Problem:** Title color suggests it's clickable
- **Fix:** Use neutral text-primary color

### Issue #27: Form Labels in ALL CAPS
- **Location:** Settings → Profile form
- **Current:** "DISPLAY NAME", "COMPANY NAME", etc.
- **Problem:** Harder to read than sentence case
- **Fix:** Use "Display Name" format

### Issue #28: Empty Space Below LLM Hub Cards
- **Location:** Settings → LLM Hub tab
- **Current:** Large empty area below 3 cards
- **Problem:** Unbalanced layout
- **Fix:** Add helpful content or reduce panel height

### Issue #29: LLM Hub Card Sizes Slightly Different
- **Location:** Settings → LLM Hub
- **Current:** 283x85, 281x83, 187x59
- **Problem:** Cards not uniform size
- **Fix:** Standardize card heights

### Issue #30: Email Visible in Sidebar Footer
- **Location:** Sidebar → Footer
- **Current:** "ozpaniard@gmail.com" displayed
- **Problem:** Privacy concern - may not want visible
- **Fix:** Option to hide or truncate

### Issue #31: Mode Toggle "1 AI" vs "5 AIs" Visual Parity
- **Location:** OmniBar
- **Current:** Toggle shows current mode
- **Problem:** "1 AI" vs "5 AIs" have different text lengths
- **Fix:** Use icons instead or fixed-width text

### Issue #32: Response Style Dropdown No Visual State
- **Location:** OmniBar → "Response style" button
- **Current:** No indication of current selection
- **Problem:** Users don't know current style without clicking
- **Fix:** Show current style in button text

### Issue #33: Reset Button Different Border-Radius
- **Location:** OmniBar
- **Current:** 4px border-radius vs 8px for others
- **Problem:** Inconsistent with other buttons
- **Fix:** Use 8px

### Issue #34: No Active Tab Indicator on Bottom Nav
- **Location:** Bottom navigation
- **Current:** Active state unclear on "New Chat" vs others
- **Problem:** Users unsure which screen they're on
- **Fix:** Add highlight/indicator for active tab

### Issue #35: Search Input Placeholder Too Long
- **Location:** Sidebar search
- **Current:** "Search conversations... (⌘K)"
- **Problem:** Even without ⌘K, "Search conversations..." may truncate
- **Fix:** Use just "Search..."

---

## COSMETIC (P3) - Backlog

### Issue #36: Sidebar Header Drag Handle Visible
- **Location:** My Company/Settings panels
- **Current:** Small horizontal line at top
- **Problem:** Looks like a UI bug, not a feature
- **Fix:** Make more subtle or remove

### Issue #37: Conversation Star Icons Inconsistent Spacing
- **Location:** Sidebar → Conversation list
- **Current:** Stars appear at different positions
- **Problem:** Minor misalignment
- **Fix:** Use flex alignment

### Issue #38: Group Headers "TECHNOLOGY" Font Weight
- **Location:** Sidebar → Group labels
- **Current:** Uppercase bold text
- **Problem:** Too heavy for a section label
- **Fix:** Use medium weight

### Issue #39: Load More Indication Missing
- **Location:** Sidebar → Conversation list
- **Current:** "Scroll for more" text
- **Problem:** No loading spinner when fetching
- **Fix:** Add subtle loading indicator

### Issue #40: Platform Admin Portal Button Position
- **Location:** Sidebar → Footer area
- **Current:** Mixed with navigation buttons
- **Problem:** Admin feature among user features
- **Fix:** Move to separate admin area

### Issue #41: Bio Textarea Placeholder Wrapping
- **Location:** Settings → Profile → Bio field
- **Current:** "Tell us about yourself or your business..."
- **Problem:** Long placeholder may wrap awkwardly
- **Fix:** Shorter placeholder

### Issue #42: Language Flag Size
- **Location:** Settings → Language dropdown
- **Current:** Small flag icon next to "English"
- **Problem:** Flag hard to see
- **Fix:** Increase flag size

### Issue #43: Account Section No Separator
- **Location:** Settings → Between Profile and Account
- **Current:** No visual break
- **Problem:** Sections run together
- **Fix:** Add horizontal rule or spacing

### Issue #44: Close Sheet Button Too Small Visually
- **Location:** Settings/My Company → Top area
- **Current:** 44px button but visually subtle
- **Problem:** Users may not see close button
- **Fix:** Make more prominent

### Issue #45: Notification Region "alt+T" Label
- **Location:** Page → Notification area
- **Current:** Shows "Notifications alt+T"
- **Problem:** Keyboard shortcut visible on mobile
- **Fix:** Hide shortcut hint on mobile

### Issue #46: Tanstack Query Devtools Button Visible
- **Location:** Bottom corner of page
- **Current:** Debug button visible
- **Problem:** Development UI in production
- **Fix:** Hide in production build

### Issue #47: Skip to Main Content Link Visible
- **Location:** Top of page
- **Current:** Accessibility link visible when not focused
- **Problem:** Should only be visible on focus
- **Fix:** Add `sr-only` class unless focused

### Issue #48: Choose Files Button Hidden Input
- **Location:** OmniBar
- **Current:** Hidden file input with visible button
- **Problem:** "Choose files" "No file chosen" text may appear
- **Fix:** Fully hide native input text

### Issue #49: My Company Cards No Hover State on Mobile
- **Location:** My Company → Department cards
- **Current:** No tap feedback
- **Problem:** Users unsure if tap registered
- **Fix:** Add :active state styling

### Issue #50: Form Input Focus Ring Color
- **Location:** All form inputs
- **Current:** Default blue focus ring
- **Problem:** May not match brand color
- **Fix:** Use brand indigo for focus ring

---

## Summary Statistics

| Severity | Count | Effort Estimate |
|----------|-------|-----------------|
| **Critical (P0)** | 8 | 4-6 hours |
| **Major (P1)** | 12 | 8-12 hours |
| **Minor (P2)** | 15 | 6-8 hours |
| **Cosmetic (P3)** | 15 | 4-6 hours |
| **TOTAL** | **50** | **22-32 hours** |

---

## Top 10 Fixes for Maximum Impact

1. **Hide ⌘K on mobile** - Instant credibility boost
2. **Add Settings tab labels** - Fixes accessibility + UX
3. **Add tab scroll indicator** - Prevents hidden content confusion
4. **Standardize icon sizes** - Visual consistency
5. **Fix bottom nav widths** - Balanced navigation
6. **Remove palm tree emoji** - Removes confusion
7. **Reduce font size count** - Professional typography
8. **Add TOC link affordance** - Better navigation
9. **Fix border-radius values** - Consistent visual language
10. **Remove "1 AI" orphan label** - Cleaner OmniBar

---

## Audit Methodology

- Viewport: 375×812 (iPhone 12/13)
- Chrome DevTools MCP for measurements
- Pixel-level inspection of every interactive element
- Accessibility tree analysis
- CSS computed style verification

**Audited Screens:**
- Landing page
- Sidebar (expanded)
- My Company (all tabs)
- Settings (all tabs)
- Bottom navigation

**Not Yet Audited:**
- Chat conversation flow
- Admin portal
- Error states
- Empty states
- Dark mode
