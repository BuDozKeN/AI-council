/* eslint-disable react-refresh/only-export-components */
/**
 * Router Configuration - SEO & URL Routing
 *
 * Router files legitimately export both the router and route constants.
 *
 * This router enables:
 * - Deep linking to specific views (settings, company, leaderboard)
 * - F5 refresh preserves navigation state
 * - Browser back/forward button support
 * - SEO-friendly URLs
 *
 * Route Structure:
 * - /                      → Landing Hero or Chat (default)
 * - /chat/:conversationId  → Specific conversation
 * - /settings/:tab?        → Settings modal (synced with URL)
 * - /company/:tab?/:itemId?→ MyCompany modal (synced with URL)
 * - /leaderboard           → Leaderboard modal
 * - /admin                 → Admin portal (full page, separate from main app)
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { ErrorPage } from './components/ErrorPage';

// Lazy load admin portal for code splitting (admin is rarely accessed)
const AdminPortal = lazy(() => import('./components/admin/AdminPortal'));
// Lazy load accept invite pages (public/authenticated, rarely accessed)
const AcceptInvite = lazy(() => import('./components/AcceptInvite'));
const AcceptCompanyInvite = lazy(() => import('./components/AcceptCompanyInvite'));

// The App component handles all rendering - routes just control what's visible
// This is a "modal overlay with URL sync" approach - keeps current UX but URLs change
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      // Default route - chat/landing
      { index: true, element: null },

      // Conversation routes
      { path: 'chat', element: null },
      { path: 'chat/:conversationId', element: null },

      // Settings routes - tab is optional (defaults to first tab)
      { path: 'settings', element: null },
      { path: 'settings/:tab', element: null },

      // Company routes - tab and itemId are optional
      { path: 'company', element: null },
      { path: 'company/:tab', element: null },
      { path: 'company/:tab/:itemId', element: null },

      // MyCompany aliases - same as /company, handled by useRouteSync
      { path: 'mycompany', element: null },
      { path: 'mycompany/:tab', element: null },
      { path: 'mycompany/:tab/:itemId', element: null },

      // Leaderboard
      { path: 'leaderboard', element: null },

      // Catch-all redirect to home
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // Admin portal - full page, separate layout from main app
  {
    path: '/admin',
    element: (
      <Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              background: 'var(--color-bg-primary, #fafafa)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--color-border, #e5e5e5)',
                borderTopColor: 'var(--color-primary, #6366f1)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        }
      >
        <AdminPortal />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: null },
      { path: 'analytics', element: null },
      { path: 'users', element: null },
      { path: 'companies', element: null },
      { path: 'audit', element: null },
      { path: 'admins', element: null },
      { path: 'invitations', element: null },
      { path: 'settings', element: null },
    ],
  },
  // Accept invitation page - public, for new user signups via invitation
  {
    path: '/accept-invite',
    element: (
      <Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              background: 'var(--color-bg-primary, #fafafa)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--color-border, #e5e5e5)',
                borderTopColor: 'var(--color-primary, #6366f1)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        }
      >
        <AcceptInvite />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
  },
  // Accept company invitation page - for existing users joining a company
  {
    path: '/accept-company-invite',
    element: (
      <Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              background: 'var(--color-bg-primary, #fafafa)',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--color-border, #e5e5e5)',
                borderTopColor: 'var(--color-primary, #6366f1)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        }
      >
        <AcceptCompanyInvite />
      </Suspense>
    ),
    errorElement: <ErrorPage />,
  },
]);

// Tab mappings for URL <-> state synchronization
export const SETTINGS_TAB_MAP: Record<string, number> = {
  profile: 0,
  'api-keys': 1,
  billing: 2,
  team: 3,
  developer: 4,
};

export const SETTINGS_TAB_REVERSE: Record<number, string> = {
  0: 'profile',
  1: 'api-keys',
  2: 'billing',
  3: 'team',
  4: 'developer',
};

export const COMPANY_TAB_MAP: Record<string, string> = {
  overview: 'overview',
  team: 'team',
  projects: 'projects',
  playbooks: 'playbooks',
  decisions: 'decisions',
  activity: 'activity',
  usage: 'usage',
  'llm-hub': 'llm-hub',
};

// Valid company tabs for URL validation
export const VALID_COMPANY_TABS = Object.keys(COMPANY_TAB_MAP);
