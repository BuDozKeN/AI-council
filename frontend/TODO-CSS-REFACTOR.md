# CSS Refactor Plan (Post-Launch)

## Status: Documented 2026-01-15

This document outlines the plan to split mega CSS files into component-scoped files per the CSS Architecture Audit recommendations.

---

## Priority 1: ChatInterface.css (3,230 lines → 8-10 files)

**Current Status**: Single 3,230-line file at `src/components/ChatInterface.css`

**Target Structure**:
```
src/components/chat/
├── ChatInterface.tsx
├── ChatInterface.css (200 lines - layout only)
├── BackToCompanyButton.tsx
├── BackToCompanyButton.css (50 lines)
├── ScrollToTopButton.tsx
├── ScrollToTopButton.css (80 lines)
├── ContextPills/
│   ├── ContextPills.tsx
│   ├── ContextPills.css (150 lines)
│   ├── DepartmentPill.tsx
│   ├── DepartmentPill.css (100 lines)
│   ├── PlaybookPill.tsx
│   └── PlaybookPill.css (100 lines)
├── UserMessage/
│   ├── UserMessage.tsx
│   ├── UserMessage.css (200 lines)
│   └── UserMessageCopyButton.css (80 lines)
├── InputForm/
│   ├── InputForm.tsx
│   ├── InputForm.css (250 lines)
│   ├── GradientFade.css (50 lines)
└── ContextBar/
    ├── ContextBar.tsx
    ├── ContextBar.css (200 lines)
    ├── CompanySelect.css (100 lines)
    ├── DepartmentSelect.css (100 lines)
    ├── RoleSelect.css (120 lines)
    └── ChannelStyleSelects.css (80 lines)
```

**Migration Steps**:
1. Identify all distinct components currently styled in ChatInterface.css
2. Create new component files + CSS files for each
3. Extract relevant CSS sections (use line numbers from comments)
4. Update imports in ChatInterface.tsx
5. Test each component in isolation
6. Delete old ChatInterface.css
7. Run `npm run lint:css` and fix any issues

**Estimated Effort**: 1-2 days
**Impact**: HIGH - chat interface is used constantly

---

## Priority 2: mycompany/styles/modals.css (2,286 lines → 11 files)

**Current Status**: Single 2,286-line file at `src/components/mycompany/styles/modals.css`

**Target Structure**:
```
src/components/mycompany/modals/
├── AddCompanyContextModal.tsx
├── AddCompanyContextModal.css (150 lines)
├── AddDepartmentModal.tsx
├── AddDepartmentModal.css (200 lines)
├── AddPlaybookModal.tsx
├── AddPlaybookModal.css (250 lines)
├── AddRoleModal.tsx
├── AddRoleModal.css (180 lines)
├── PromoteDecisionModal.tsx
├── PromoteDecisionModal.css (300 lines)
├── ViewCompanyContextModal.tsx
├── ViewCompanyContextModal.css (150 lines)
├── ViewDecisionModal.tsx
├── ViewDecisionModal.css (200 lines)
├── ViewDepartmentModal.tsx
├── ViewDepartmentModal.css (180 lines)
├── ViewPlaybookModal.tsx
├── ViewPlaybookModal.css (250 lines)
├── ViewProjectModal.tsx
├── ViewProjectModal.css (200 lines)
├── ViewRoleModal.tsx
└── ViewRoleModal.css (180 lines)
```

**Shared Modal Styles**:
Create `src/components/ui/Modal.css` (~150 lines) for:
- `.mc-modal-body`
- `.mc-modal-header-left`
- `.mc-modal-scroll-top`
- `.mc-modal-hint`
- `.mc-modal-close-clean`

**Migration Steps**:
1. Extract shared modal styles to `ui/Modal.css`
2. For each modal component:
   - Grep for class patterns (e.g., `.mc-dept-` for department modal)
   - Extract relevant CSS into ComponentModal.css
   - Import Modal.css and ComponentModal.css in component
   - Test modal open/close/functionality
3. Delete old modals.css
4. Run `npm run lint:css`

**Estimated Effort**: 1 day
**Impact**: MEDIUM - modals used occasionally

---

## Priority 3: Settings.css (2,393 lines → 8 files)

**Current Status**: Single 2,393-line file at `src/components/Settings.css`

**Target Structure**:
```
src/components/settings/
├── Settings.tsx
├── SettingsLayout.css (200 lines - sidebar, panel structure)
├── ProfileSettings.tsx
├── ProfileSettings.css (300 lines)
├── BillingSettings.tsx
├── BillingSettings.css (400 lines)
├── TeamSettings.tsx
├── TeamSettings.css (350 lines)
├── APISettings.tsx
├── APISettings.css (250 lines)
├── DeveloperSettings.tsx
├── DeveloperSettings.css (200 lines)
├── NotificationSettings.tsx
├── NotificationSettings.css (200 lines)
├── SecuritySettings.tsx
└── SecuritySettings.css (250 lines)
```

**Migration Steps**:
1. Split Settings.tsx into tab components (if not already)
2. Extract CSS for each tab into tab-specific CSS file
3. Extract layout/sidebar CSS to SettingsLayout.css
4. Update imports
5. Delete old Settings.css

**Estimated Effort**: 1 day
**Impact**: MEDIUM - settings accessed occasionally

---

## Priority 4: Other Large Files (>500 lines)

| File | Lines | Target | Priority |
|------|-------|--------|----------|
| Stage3.css | 2,585 | Split by section | P4 |
| mycompany/styles/mobile.css | 1,453 | Move to component files | P5 (delete entirely) |
| Sidebar.css | 1,619 | Split by component | P6 |
| ProjectModal.css | 1,217 | Split by section | P7 |
| Stage1.css | 1,236 | Split by component | P8 |
| Stage2.css | 1,064 | Split by section | P9 |

**General Approach**:
- Files >1000 lines = split into 3-5 component files
- Files 500-1000 lines = split into 2-3 component files
- Target: All files <300 lines

---

## Success Metrics

Track monthly progress:

| Metric | Current (2026-01-15) | 1 Month | 3 Months | 6 Months |
|--------|---------------------|---------|----------|----------|
| Files >1000 lines | 13 | 8 | 3 | 0 |
| Files >500 lines | 20+ | 15 | 8 | 3 |
| Total CSS lines | 48,225 | 40,000 | 30,000 | 20,000 |
| Avg file size | 535 lines | 400 lines | 300 lines | 200 lines |
| ChatInterface.css | 3,230 lines | Split ✓ | N/A | N/A |
| modals.css | 2,286 lines | Split ✓ | N/A | N/A |

---

## Continuous Prevention

**New Component Checklist** (add to PR template):
- [ ] Component.tsx + Component.css paired in same directory
- [ ] CSS file <300 lines (if larger, split component)
- [ ] No styles in parent/sibling CSS files
- [ ] No hardcoded colors (use CSS variables)
- [ ] Mobile @media queries in same file (not separate mobile.css)
- [ ] Standard breakpoints only (640px, 1024px)

**Monthly Review**:
- Identify new large CSS files (>500 lines)
- Schedule refactor sprint if needed
- Update metrics dashboard

---

## Notes

- **Do NOT split files without thorough testing** - CSS changes can break layouts
- **Test on real devices** - mobile breakpoints especially
- **Use git branches** - one branch per mega-file split
- **Get visual regression testing** - screenshot before/after
- **Prioritize by usage frequency** - ChatInterface used hourly, modals used weekly

---

*Plan created as part of CSS Architecture Audit 2026-01-15*
*See: `/home/user/AI-council/audits/css-architecture-audit-2026-01-15.md`*
