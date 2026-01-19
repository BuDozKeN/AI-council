/**
 * useRouteSync - Synchronizes URL with modal state
 *
 * This hook enables:
 * - Opening modals via URL (deep linking)
 * - Updating URL when modals open/close
 * - F5 refresh preserving modal state
 * - Browser back button closing modals
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { VALID_COMPANY_TABS } from '../router';
import type { MyCompanyTab } from '../components/mycompany/hooks';
import type { Conversation } from '../types/conversation';

interface UseRouteSyncOptions {
  // Modal states
  isSettingsOpen: boolean;
  isMyCompanyOpen: boolean;
  isLeaderboardOpen: boolean;

  // Modal openers
  openSettings: () => void;
  openMyCompany: (options?: {
    tab?: MyCompanyTab;
    decisionId?: string | null;
    playbookId?: string | null;
    projectId?: string | null;
    clearPromoteDecision?: boolean;
  }) => void;
  openLeaderboard: () => void;

  // Modal closers
  closeSettings: () => void;
  closeMyCompany: () => void;
  closeLeaderboard: () => void;

  // Conversation
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  handleNewConversation: () => void;
}

export function useRouteSync(options: UseRouteSyncOptions) {
  const {
    isSettingsOpen,
    isMyCompanyOpen,
    isLeaderboardOpen,
    openSettings,
    openMyCompany,
    openLeaderboard,
    closeSettings,
    closeMyCompany,
    closeLeaderboard,
    currentConversationId,
    setCurrentConversationId,
    setCurrentConversation,
    handleNewConversation,
  } = options;

  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // Track whether we're syncing from URL to state (to avoid loops)
  const isSyncingFromUrl = useRef(false);
  // Track whether we're syncing from state to URL
  const isSyncingToUrl = useRef(false);
  // Track initial load
  const hasInitialSynced = useRef(false);

  // Handle initial URL → state sync on mount
  useEffect(() => {
    if (hasInitialSynced.current) return;
    hasInitialSynced.current = true;

    const pathname = location.pathname;
    isSyncingFromUrl.current = true;

    try {
      if (pathname.startsWith('/settings')) {
        openSettings();
      } else if (pathname.startsWith('/company')) {
        const pathParts = pathname.split('/').filter(Boolean);
        const tab = (pathParts[1] as MyCompanyTab) || 'overview';
        const itemId = pathParts[2] || null;

        // Determine which type of item ID based on tab
        const options: Parameters<typeof openMyCompany>[0] = {
          tab: VALID_COMPANY_TABS.includes(tab) ? tab : 'overview',
          clearPromoteDecision: true,
        };

        if (itemId) {
          if (tab === 'decisions') {
            options.decisionId = itemId;
          } else if (tab === 'playbooks') {
            options.playbookId = itemId;
          } else if (tab === 'projects') {
            options.projectId = itemId;
          }
        }

        openMyCompany(options);
      } else if (pathname === '/leaderboard') {
        openLeaderboard();
      } else if (pathname.startsWith('/chat/')) {
        const conversationId = pathname.split('/chat/')[1];
        if (conversationId && conversationId !== currentConversationId) {
          setCurrentConversationId(conversationId);
        }
      }
    } finally {
      // Reset after a tick to allow state to settle
      setTimeout(() => {
        isSyncingFromUrl.current = false;
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs only on mount - deps accessed via refs to avoid re-runs

  // Sync state → URL when modals open/close or conversation changes
  // IMPORTANT: Use push (not replace) to enable browser back button navigation
  useEffect(() => {
    if (isSyncingFromUrl.current) return;
    isSyncingToUrl.current = true;

    const pathname = location.pathname;

    try {
      // Modal navigation - use push to enable back button
      // Only use replace when we're already on the same route (preventing duplicate entries)
      if (isSettingsOpen && !pathname.startsWith('/settings')) {
        navigate('/settings'); // Push for back button support
      } else if (isMyCompanyOpen && !pathname.startsWith('/company')) {
        navigate('/company'); // Push for back button support
      } else if (isLeaderboardOpen && pathname !== '/leaderboard') {
        navigate('/leaderboard'); // Push for back button support
      } else if (!isSettingsOpen && !isMyCompanyOpen && !isLeaderboardOpen) {
        // No modals open - sync conversation URL
        const isOnChatRoute = pathname.startsWith('/chat/');
        const currentUrlConversationId = isOnChatRoute ? pathname.split('/chat/')[1] : null;

        if (currentConversationId && !currentConversationId.startsWith('temp-')) {
          // Real conversation - ensure URL matches
          // Use replace here since navigateToChat already pushed
          if (currentUrlConversationId !== currentConversationId) {
            navigate(`/chat/${currentConversationId}`, { replace: true });
          }
        } else if (pathname !== '/') {
          // Temp or no conversation - go to home
          // Use push when coming from a conversation (so back returns to it)
          // Use replace when coming from a modal (prevents stacking home entries)
          const wasOnConversation = isOnChatRoute;
          navigate('/', { replace: !wasOnConversation });
        }
      }
    } finally {
      setTimeout(() => {
        isSyncingToUrl.current = false;
      }, 100);
    }
  }, [
    isSettingsOpen,
    isMyCompanyOpen,
    isLeaderboardOpen,
    currentConversationId,
    location.pathname,
    navigate,
  ]);

  // Handle browser back/forward buttons - sync modal state with URL
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;

      // Sync modal state with URL - open if URL matches, close if it doesn't
      // This handles both back (closing) and forward (reopening) navigation

      // Settings modal
      if (pathname.startsWith('/settings')) {
        if (!isSettingsOpen) {
          // Close other modals first to prevent conflicts
          if (isMyCompanyOpen) closeMyCompany();
          if (isLeaderboardOpen) closeLeaderboard();
          openSettings();
        }
      } else if (isSettingsOpen) {
        closeSettings();
      }

      // My Company modal
      if (pathname.startsWith('/company')) {
        if (!isMyCompanyOpen) {
          // Close other modals first
          if (isSettingsOpen) closeSettings();
          if (isLeaderboardOpen) closeLeaderboard();
          // Parse tab from URL
          const pathParts = pathname.split('/').filter(Boolean);
          const tab = (pathParts[1] as MyCompanyTab) || 'overview';
          openMyCompany({ tab: VALID_COMPANY_TABS.includes(tab) ? tab : 'overview' });
        }
      } else if (isMyCompanyOpen) {
        closeMyCompany();
      }

      // Leaderboard modal
      if (pathname === '/leaderboard') {
        if (!isLeaderboardOpen) {
          // Close other modals first
          if (isSettingsOpen) closeSettings();
          if (isMyCompanyOpen) closeMyCompany();
          openLeaderboard();
        }
      } else if (isLeaderboardOpen) {
        closeLeaderboard();
      }

      // Handle conversation navigation (only when no modals should be open)
      if (
        !pathname.startsWith('/settings') &&
        !pathname.startsWith('/company') &&
        pathname !== '/leaderboard'
      ) {
        if (pathname.startsWith('/chat/')) {
          const conversationId = pathname.split('/chat/')[1];
          if (conversationId && conversationId !== currentConversationId) {
            // Clear conversation state before setting new ID to prevent stale content
            setCurrentConversation(null);
            setCurrentConversationId(conversationId);
          }
        } else if (pathname === '/chat' || pathname === '/') {
          // New conversation or home
          if (currentConversationId && !currentConversationId.startsWith('temp-')) {
            handleNewConversation();
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isSettingsOpen,
    isMyCompanyOpen,
    isLeaderboardOpen,
    currentConversationId,
    openSettings,
    openMyCompany,
    openLeaderboard,
    closeSettings,
    closeMyCompany,
    closeLeaderboard,
    setCurrentConversationId,
    setCurrentConversation,
    handleNewConversation,
  ]);

  // Navigation helpers (use these instead of direct modal openers)
  const navigateToSettings = useCallback(
    (tab?: string) => {
      const path = tab ? `/settings/${tab}` : '/settings';
      // Prevent state→URL sync from overriding our navigation
      isSyncingToUrl.current = true;
      navigate(path);
      openSettings();
      setTimeout(() => {
        isSyncingToUrl.current = false;
      }, 100);
    },
    [navigate, openSettings]
  );

  const navigateToCompany = useCallback(
    (tab?: MyCompanyTab, itemId?: string) => {
      let path = '/company';
      if (tab) {
        path += `/${tab}`;
        if (itemId) {
          path += `/${itemId}`;
        }
      }

      // Prevent state→URL sync from overriding our navigation
      isSyncingToUrl.current = true;
      navigate(path);

      const options: Parameters<typeof openMyCompany>[0] = {
        tab: tab || 'overview',
        clearPromoteDecision: true,
      };

      if (itemId) {
        if (tab === 'decisions') {
          options.decisionId = itemId;
        } else if (tab === 'playbooks') {
          options.playbookId = itemId;
        } else if (tab === 'projects') {
          options.projectId = itemId;
        }
      }

      openMyCompany(options);

      // Reset after React Router updates
      setTimeout(() => {
        isSyncingToUrl.current = false;
      }, 100);
    },
    [navigate, openMyCompany]
  );

  const navigateToLeaderboard = useCallback(() => {
    // Prevent state→URL sync from overriding our navigation
    isSyncingToUrl.current = true;
    navigate('/leaderboard');
    openLeaderboard();
    setTimeout(() => {
      isSyncingToUrl.current = false;
    }, 100);
  }, [navigate, openLeaderboard]);

  const navigateToChat = useCallback(
    (conversationId?: string) => {
      if (conversationId) {
        navigate(`/chat/${conversationId}`);
        setCurrentConversationId(conversationId);
      } else {
        navigate('/');
        handleNewConversation();
      }
    },
    [navigate, setCurrentConversationId, handleNewConversation]
  );

  const navigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return {
    // Navigation helpers
    navigateToSettings,
    navigateToCompany,
    navigateToLeaderboard,
    navigateToChat,
    navigateHome,

    // Current route info
    currentPath: location.pathname,
    params,
  };
}
