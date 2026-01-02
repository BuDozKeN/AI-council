# Current Session Changes (January 3, 2026)

This document summarizes uncommitted changes from the current development session.

## Summary

Major UI/UX improvements focused on the OmniBar component and mobile experience.

## Key Changes

### 1. OmniBar Context Icons Capsule Styling
**Files:** `ChatInterface.css`, `ChatInput.tsx`

- Added capsule background to context icons (Project, Departments, Roles, Playbooks)
- Made the icons capsule match the "1 AI / 5 AIs" toggle exactly (both 38px height)
- Used `!important` to override global 44px touch target enforcement for icons inside capsule
- All colors use design system CSS variables (no hardcoded colors)

### 2. Context Popover Improvements
**Files:** `ChatInterface.css`, `OmniBar.css`, `ChatInput.tsx`, `OmniBar.tsx`

- Added context popovers for departments, roles, and playbooks selection
- Playbooks are grouped by type (SOP, Framework, Policy) with accordion-style expand/collapse
- Mobile uses BottomSheet component instead of popovers
- DepartmentCheckboxItem component for consistent department selection UI

### 3. Stage1/Stage2 Styling Refinements
**Files:** `Stage1.css`, `Stage2.css`

- Simplified rank badge styling (just emoji, no backgrounds)
- Tabs and pills consistency between stages
- Mobile responsive adjustments

### 4. Mobile Bottom Navigation
**New Files:** `MobileBottomNav.tsx`, `MobileBottomNav.css`

- New mobile bottom navigation component
- PWA-ready icons added (`pwa-192x192.svg`, `pwa-512x512.svg`)

### 5. Brand Icons
**Files:** `BrandIcons.tsx`

- Added new model icons (Meta, Moonshot)
- Updated icon exports

### 6. Backend Improvements
**Files:** `backend/main.py`, `backend/council.py`, `backend/attachments.py`

- Attachment handling improvements
- Council orchestration refinements
- LLM ops router updates

### 7. Database Migrations
**New Files:**
- `20260102100000_fix_rls_initplan_performance.sql` - RLS performance fix
- `20260102200000_parse_failure_tracking.sql` - Parse failure tracking

## Files Changed (59 total)

### Frontend (Core)
- `App.tsx`, `App.css` - Main app updates
- `ChatInterface.tsx`, `ChatInterface.css` - Chat interface and context icons
- `OmniBar.tsx`, `OmniBar.css` - Landing page OmniBar
- `ChatInput.tsx` - Follow-up input with context icons
- `MessageList.tsx` - Message list updates

### Frontend (Stages)
- `Stage1.tsx`, `Stage1.css` - Expert responses stage
- `Stage2.tsx`, `Stage2.css` - Peer review stage
- `Stage3.css`, `Stage3Content.tsx`, `stage3/index.tsx` - Synthesis stage

### Frontend (UI Components)
- `BottomSheet.tsx`, `BottomSheet.css` - Mobile bottom sheet
- `EmptyState.tsx`, `EmptyState.css` - Empty state component
- `FormField.tsx`, `FormField.css` - Form field component
- `ThemeToggle.tsx`, `ThemeToggle.css` - Theme toggle button
- `AppModal.tsx` - Modal updates
- `DepartmentCheckboxItem.css` - Department checkbox styling

### Frontend (Other)
- `LandingHero.tsx`, `LandingHero.css` - Landing page hero
- `Sidebar.tsx`, `Sidebar.css` - Sidebar updates
- `SidebarIconButton.tsx` - Icon button component
- `modelPersonas.ts` - Model configuration
- `tailwind.css`, `index.css` - Global styles
- `vite.config.js` - Vite configuration

### Backend
- `main.py` - API entry point
- `council.py` - Council orchestration
- `attachments.py` - File attachments
- `billing.py` - Billing logic
- `config.py` - Configuration
- `model_registry.py` - Model registry
- `routers/company/llm_ops.py` - LLM ops endpoints
- `routers/company/utils.py` - Utility functions
- `routers/knowledge.py` - Knowledge endpoints

### Configuration
- `CLAUDE.md` - Updated development guide
- `.gitignore` - Git ignore rules
- `pyproject.toml` - Python dependencies

## Testing Notes

1. Check OmniBar on both desktop and mobile viewports
2. Verify context icons capsule matches toggle height (38px)
3. Test context popovers open/close on desktop
4. Test BottomSheet opens on mobile for context selection
5. Verify no hardcoded colors (all use CSS variables)

## Deploy Steps

After committing:
1. `git push origin master` - Triggers Vercel auto-deploy
2. `curl -s -X POST "https://api.render.com/deploy/srv-d4pfrai4i8rc73e6h28g?key=M17Ys96WsOs"` - Trigger Render deploy
