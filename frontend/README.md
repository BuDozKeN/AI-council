# AxCouncil Frontend

React + Vite frontend for the AxCouncil AI council application.

## Mobile Navigation

Mobile navigation uses a combination of visible back buttons and swipe gestures.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `MobileHeader` | `src/components/ui/MobileHeader.jsx` | Reusable header with back button, hidden on desktop (>768px) |
| `useSwipeBack` | `src/hooks/useSwipeBack.js` | iOS-style swipe-from-left-edge gesture hook |

### How It Works

- **ChatInterface**: Shows `MobileHeader` on mobile when viewing a conversation. Back button opens sidebar.
- **MyCompany**: Has a dedicated back button (`.mc-mobile-back-btn`) visible only on mobile. Hides "tap to close" hint when button is present.
- **Settings**: Uses `AdaptiveModal` with `showCloseButton={true}` for visible close on mobile.
- **Leaderboard**: Uses `AdaptiveModal` (becomes BottomSheet on mobile) with close button.

### Swipe Gestures

- **Global**: Swipe right from left edge opens sidebar, swipe left closes it (`App.jsx` via `useGlobalSwipe`)
- **MyCompany**: Swipe down or swipe right from edge closes modal
- **BottomSheet**: Swipe down >100px dismisses

### Touch Targets

All mobile buttons use 44x44px minimum touch targets per Apple HIG / WCAG 2.5.5.

---

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tech Stack

- React + Vite
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) for Fast Refresh
- Radix UI for accessible components
- Framer Motion for animations
- lucide-react for icons
