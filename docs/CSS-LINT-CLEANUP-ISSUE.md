# CSS Lint Cleanup: 507 Warnings to Zero

## Overview

The codebase currently has **507 stylelint warnings** that should be cleaned up incrementally. While these are warnings (not errors) and CI passes, cleaning them up will:

- Ensure consistent design token usage across the codebase
- Make the CSS more maintainable and predictable
- Prevent drift from the established design system
- Remove technical debt before it accumulates further

## Warning Breakdown

| Category | Count | Risk Level | Effort |
|----------|-------|------------|--------|
| **Stage 1**: Deprecated breakpoints (640px) | 137 | Low | Low |
| **Stage 2**: Other deprecated breakpoints | 13 | Low | Low |
| **Stage 3**: Hardcoded z-index values | 4 | Low | Low |
| **Stage 4**: Deprecated `rgb()` functions | 154 | Medium | Medium |
| **Stage 5**: Hardcoded pixel values | 197 | Medium | High |
| **Total** | **507** | | |

---

## Stage 1: Fix 640px → 641px Breakpoints

**Count**: 137 warnings
**Risk**: Low
**Effort**: ~30 minutes
**Approach**: Find and replace

### What's Wrong
The project standard is to use `641px` for tablet breakpoint, but many files use `640px`.

### What to Fix
```css
/* Before */
@media (max-width: 640px) { ... }
@media (min-width: 640px) { ... }

/* After */
@media (max-width: 640px) { ... }  /* Keep max-width as 640px */
@media (min-width: 641px) { ... }  /* Change min-width to 641px */
```

**Note**: Only change `min-width: 640px` to `min-width: 641px`. The `max-width: 640px` queries are correct.

### Files Affected (60 files)
<details>
<summary>Click to expand file list</summary>

- src/App.css
- src/index.css
- src/styles/tailwind.css
- src/components/Billing.css
- src/components/CouncilProgressCapsule.css
- src/components/ImageUpload.css
- src/components/Login.css
- src/components/chat/ConversationModifierChips.css
- src/components/chat/FollowUpBar.css
- src/components/chat/ResponseStyleSelector.css
- src/components/chat/StickyHeader.css
- src/components/chat/UserMessage.css
- src/components/chat/input/mobile-input.css
- src/components/chat/input/omnibar-mobile.css
- src/components/landing/LandingHero.css
- src/components/landing/QuickActionChips.css
- src/components/mycompany/styles/shell/mobile/fab.css
- src/components/mycompany/styles/shell/mobile/layout.css
- src/components/mycompany/styles/shell/mobile/navigation.css
- src/components/mycompany/styles/shell/mobile/touch.css
- src/components/mycompany/styles/tabs/llm-hub/responsive.css
- src/components/mycompany/styles/tabs/overview/context-card.css
- src/components/mycompany/styles/tabs/overview/layout-stats.css
- src/components/mycompany/styles/tabs/overview/mobile.css
- src/components/mycompany/styles/tabs/projects/project-list.css
- src/components/mycompany/styles/tabs/usage/UsageMobile.css
- src/components/mycompany/styles/tabs/usage/UsageRoster.css
- src/components/mycompany/modals/promote-decision/PromoteResponsive.css
- src/components/onboarding/HardGateModal.css
- src/components/onboarding/OnboardingFlow.css
- src/components/onboarding/SoftGateModal.css
- src/components/project-modal/project-modal-mobile.css
- src/components/save-knowledge/SaveKnowledgeDarkMode.css
- src/components/save-knowledge/SaveKnowledgeResponsive.css
- src/components/settings/api-keys/mobile.css
- src/components/settings/ProfileSection.css
- src/components/settings/SettingsLayout.css
- src/components/settings/TeamSection.css
- src/components/shared/omnibar/layout.css
- src/components/sidebar/sidebar-mobile.css
- src/components/stage1/styles/Stage1Mobile.css
- src/components/stage2/styles/Stage2Mobile.css
- src/components/stage3/styles/Stage3Base.css
- src/components/stage3/styles/Stage3Loading.css
- src/components/stage3/styles/Stage3Mobile.css
- src/components/stage3/styles/Stage3Toolbar.css
- src/components/ui/app-modal/AppModalMobile.css
- src/components/ui/app-modal/AppModalUtility.css
- src/components/ui/CopyButton.css
- src/components/ui/CouncilLoader.css
- src/components/ui/HelpButton.css
- src/components/ui/LLMPresetSelect.css
- src/components/ui/MobileBottomNav.css
- src/components/ui/MockModeBanner.css
- src/components/ui/Modal.css
- src/components/ui/MultiDepartmentSelect.css
- src/components/ui/MultiPlaybookSelect.css
- src/components/ui/MultiRoleSelect.css
- src/components/ui/ScrollableContent.css
- src/components/ui/Skeleton.css
- src/components/ui/SortSelect.css
- src/components/ui/switch.css
- src/components/ui/table-of-contents/toc-variants.css
- src/components/ui/ThemeToggle.css

</details>

### Impact When Fixed
- No visual changes expected (1px difference is imperceptible)
- Ensures consistent breakpoint behavior across all components
- Mobile-first responsive design becomes predictable

---

## Stage 2: Fix Other Deprecated Breakpoints

**Count**: 13 warnings
**Risk**: Low
**Effort**: ~15 minutes
**Approach**: Manual review and replace

### What's Wrong
Some files use non-standard breakpoints like `1024px`, `400px`, or `360px`.

### What to Fix
| Current | Replace With | Reason |
|---------|--------------|--------|
| `min-width: 1024px` | `min-width: 1025px` | Standard desktop breakpoint |
| `max-width: 1024px` | `max-width: 1024px` | Keep as-is (correct) |
| `400px`, `360px` | Remove or consolidate | Fragmented breakpoints |

### Files Affected
- src/App.css (1024px)
- src/components/Billing.css (1024px)
- src/styles/tailwind.css (1024px, 400px)
- src/components/landing/LandingHero.css (400px, 360px)
- src/components/mycompany/styles/tabs/overview/layout-stats.css (1024px)
- src/components/mycompany/styles/tabs/overview/mobile.css (1024px)
- src/components/mycompany/styles/tabs/projects/project-list.css (1024px)
- src/components/stage3/styles/Stage3Base.css (1024px)

### Impact When Fixed
- No visual changes for 1024→1025 (1px)
- The 400px/360px breakpoints need review - they may be intentional for very small phones

---

## Stage 3: Fix Hardcoded z-index Values

**Count**: 4 warnings
**Risk**: Low
**Effort**: ~10 minutes
**Approach**: Replace with CSS variables

### What's Wrong
Raw z-index numbers like `1000` instead of semantic tokens.

### What to Fix
```css
/* Before */
z-index: 1000;

/* After */
z-index: var(--z-modal);  /* or --z-elevated, --z-overlay, etc. */
```

### Available z-index tokens (from design-tokens.css)
```css
--z-base: 0;
--z-elevated: 10;
--z-dropdown: 100;
--z-sticky: 200;
--z-modal: 1000;
--z-overlay: 1100;
--z-toast: 1200;
--z-tooltip: 1300;
--z-max: 9999;
```

### Files Affected
- src/components/admin/AdminModals.css
- (others TBD - run lint to find exact locations)

### Impact When Fixed
- No visual changes
- Easier to reason about stacking contexts
- Prevents z-index wars

---

## Stage 4: Replace rgb() with CSS Variables

**Count**: 154 warnings
**Risk**: Medium
**Effort**: ~2-3 hours
**Approach**: File-by-file replacement with semantic tokens

### What's Wrong
Direct `rgb()` or `rgba()` color values instead of design tokens.

### What to Fix
```css
/* Before */
background: rgb(255, 255, 255);
background: rgba(0, 0, 0, 0.5);
border-color: rgb(229, 231, 235);

/* After */
background: var(--color-bg-primary);
background: var(--overlay-black-50);
border-color: var(--color-border-primary);
```

### Strategy
1. **Identify the semantic meaning** of each rgb() value
2. **Find or create** an appropriate CSS variable
3. **Test dark mode** - rgb() values don't adapt to dark mode!

### Files Affected (sorted by warning count)
| File | Warnings |
|------|----------|
| src/components/Login.css | 12 |
| src/components/admin/AdminModals.css | 11 |
| src/components/admin/AdminAuditLog.css | 8 |
| src/components/project-modal/project-modal-layout.css | 8 |
| src/components/admin/AdminToolbar.css | 6 |
| src/components/admin/AdminButtons.css | 4 |
| src/components/admin/AdminTable.css | 4 |
| src/index.css | 3 |
| src/components/AcceptInvite.css | 3 |
| src/components/ErrorBoundary.css | 1 |
| src/components/ImageUpload.css | 1 |
| src/components/admin/AdminStats.css | 1 |
| src/components/landing/QuickActionChips.css | 1 |
| src/components/project-modal/project-modal-actions.css | 1 |
| src/components/project-modal/project-modal-ai.css | 2 |
| src/components/project-modal/project-modal-success.css | 3 |
| src/components/save-knowledge/SaveKnowledgeForm.css | 1 |
| + many more... | |

### Impact When Fixed
- **Dark mode support** - These rgb() values likely break in dark mode
- Consistent theming across the app
- Easier to update colors globally

### Risk Mitigation
- Test each file in both light and dark mode after changes
- Some rgb() values may be intentionally hardcoded (e.g., shadows) - review case by case

---

## Stage 5: Replace Hardcoded Pixel Values

**Count**: 197 warnings
**Risk**: Medium
**Effort**: ~4-6 hours
**Approach**: Careful file-by-file review

### What's Wrong
Hardcoded pixel values for spacing instead of `--space-*` tokens.

### What to Fix
```css
/* Before */
margin: 16px;
padding: 24px 32px;
gap: 8px;

/* After */
margin: var(--space-4);
padding: var(--space-6) var(--space-8);
gap: var(--space-2);
```

### Available spacing tokens
```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-9: 36px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Common Patterns to Replace
| Pixel Value | Token |
|-------------|-------|
| `4px` | `var(--space-1)` |
| `8px` | `var(--space-2)` |
| `12px` | `var(--space-3)` |
| `16px` | `var(--space-4)` |
| `24px` | `var(--space-6)` |
| `32px` | `var(--space-8)` |
| `48px` | `var(--space-12)` |

### Files Affected (sorted by warning count)
| File | Warnings |
|------|----------|
| src/components/mycompany/styles/tabs/overview/department-card.css | ~20 |
| src/components/ui/select.css | ~15 |
| src/components/settings/SettingsLayout.css | ~12 |
| src/components/chat/input/omnibar-base.css | ~10 |
| src/components/stage3/styles/Stage3Base.css | ~10 |
| + many more... | |

### Exceptions (Do NOT change)
- `1px` borders - Keep as `1px`, not a spacing token
- Border-radius values - Keep as-is or use `--radius-*` tokens
- Animation values - Keep as-is
- Very specific positioning values - Case by case

### Impact When Fixed
- Consistent spacing rhythm across the app
- Easier to adjust spacing globally
- Better design system compliance

### Risk Mitigation
- Test thoroughly after each file change
- Visual regression testing recommended
- Consider doing this alongside other work on each file

---

## Implementation Plan

### Phase 1: Low-Risk Mechanical Changes
- [ ] **PR #1**: Stage 1 - Fix 640px breakpoints (137 warnings)
- [ ] **PR #2**: Stage 2 - Fix other breakpoints (13 warnings)
- [ ] **PR #3**: Stage 3 - Fix z-index values (4 warnings)

### Phase 2: Color Token Migration
- [ ] **PR #4**: Stage 4a - Admin components rgb() (AdminModals, AdminTable, etc.)
- [ ] **PR #5**: Stage 4b - Login/Auth rgb() values
- [ ] **PR #6**: Stage 4c - Project modal rgb() values
- [ ] **PR #7**: Stage 4d - Remaining rgb() values

### Phase 3: Spacing Token Migration
- [ ] **PR #8**: Stage 5a - MyCompany tabs pixel values
- [ ] **PR #9**: Stage 5b - Chat components pixel values
- [ ] **PR #10**: Stage 5c - UI components pixel values
- [ ] **PR #11**: Stage 5d - Settings components pixel values
- [ ] **PR #12**: Stage 5e - Remaining pixel values

---

## Verification

After each PR, run:
```bash
cd frontend && npm run lint:css
```

Target: **0 warnings**

---

## Notes

- All changes should be tested in both light and dark mode
- Mobile viewport testing required for breakpoint changes
- Consider batching small files together in PRs
- Tag PRs with `chore(css)` prefix
