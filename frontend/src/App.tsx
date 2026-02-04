import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  lazy,
  Suspense,
  ComponentType,
} from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { LandingHero } from './components/landing';
import { useAuth } from './AuthContext';
import { useBusiness } from './contexts/BusinessContext';
import { useConversation } from './contexts/ConversationContext';
import { api } from './api';
import {
  useGlobalSwipe,
  useModalState,
  useRouteSync,
  useCanonical,
  useFullSEO,
  useMessageStreaming,
  useAdminAccess,
  type ProjectModalContext,
} from './hooks';
import { useDynamicMeta } from './hooks/useDynamicMeta';
import { useBreadcrumbSchema } from './hooks/useBreadcrumbSchema';
import { useFAQSchema } from './hooks/useFAQSchema';
import type { Project } from './types/business';
import type { MyCompanyTab } from './components/mycompany/hooks';
import { Toaster, toast } from './components/ui/sonner';
import { MockModeBanner } from './components/ui/MockModeBanner';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { HelpButton } from './components/ui/HelpButton';
import { ImpersonationBanner } from './components/admin/ImpersonationBanner';
import MobileBottomNav from './components/ui/MobileBottomNav';
import { CommandPalette } from './components/ui/CommandPalette';
import { useTheme } from 'next-themes';
import { logger } from './utils/logger';
import { consumeReturnUrl } from './utils/authRedirect';
import type { Conversation } from './types/conversation';
import './App.css';

// Extend Window interface for pending question feature
declare global {
  interface Window {
    __pendingQuestion?: string;
  }
}

// =============================================================================
// Performance: Route-based code splitting
// These components are lazily loaded to reduce initial bundle size (~70% reduction)
// =============================================================================

const lazyWithType = <T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) =>
  lazy(factory);

// Login is lazy-loaded since it's only shown when NOT authenticated
// Most returning users skip this, reducing initial bundle
const Login = lazyWithType(() => import('./components/Login'));
// ChatInterface is lazy-loaded since LandingHero is shown first
// This moves ~200KB+ (Stage1/2/3, MessageList) out of initial bundle
const ChatInterface = lazyWithType(() => import('./components/ChatInterface'));
const Leaderboard = lazyWithType(() => import('./components/Leaderboard'));
const Settings = lazyWithType(() => import('./components/settings'));
const ProjectModal = lazyWithType(() => import('./components/ProjectModal'));
const MyCompany = lazyWithType(() => import('./components/MyCompany'));

// Performance: Preload ChatInterface after initial render
// This starts loading the chunk while user is on LandingHero
const preloadChatInterface = () => {
  import('./components/ChatInterface');
};

// Performance: Preload MyCompany on hover so click is instant
// This loads the JS chunk before the user clicks, eliminating the first loading spinner
const preloadMyCompany = () => {
  import('./components/MyCompany');
};

// Minimal loading fallback for lazy modal components
const LazyFallback = () => (
  <div className="lazy-loading-fallback" aria-label="Loading...">
    <div className="lazy-loading-spinner" />
  </div>
);

// Subtle fallback for ChatInterface - no spinner, just empty space
// The framer-motion animation handles the visual transition
const ChatFallback = () => <div className="chat-loading-fallback" aria-label="Loading chat..." />;

// Create scoped logger for App component
const log = logger.scope('App');

function App() {
  const { t, i18n: i18nInstance } = useTranslation();
  const {
    user,
    loading: authLoading,
    signOut,
    isAuthenticated,
    needsPasswordReset,
    getAccessToken,
  } = useAuth();

  // Business state from context
  const {
    businesses,
    selectedBusiness,
    setSelectedBusiness,
    currentBusiness,
    selectedDepartment,
    setSelectedDepartment,
    selectedRole,
    setSelectedRole,
    selectedDepartments,
    setSelectedDepartments,
    selectedRoles,
    setSelectedRoles,
    availablePlaybooks,
    selectedPlaybooks,
    setSelectedPlaybooks,
    selectedChannel,
    setSelectedChannel,
    selectedStyle,
    setSelectedStyle,
    projects,
    setProjects,
    selectedProject,
    setSelectedProject,
    useCompanyContext,
    setUseCompanyContext,
    useDepartmentContext,
    setUseDepartmentContext,
    userPreferences: _userPreferences,
    availableDepartments,
    availableRoles,
    allRoles,
    availableChannels,
    availableStyles,
    loadBusinesses,
    refreshProjects: _refreshProjects,
    isLoading: _isBusinessLoading,
  } = useBusiness();

  // Conversation state from context
  const {
    conversations,
    setConversations,
    hasMoreConversations,
    conversationSortBy,
    currentConversationId,
    setCurrentConversationId,
    currentConversation,
    setCurrentConversation,
    isLoadingConversation,
    isLoading,
    setIsLoading,
    skipNextLoadRef,
    loadConversations,
    loadConversation,
    handleNewConversation: contextNewConversation,
    handleSelectConversation: contextSelectConversation,
    handleArchiveConversation,
    handleStarConversation,
    handleDeleteConversation,
    handleRenameConversation,
    refreshConversations,
    handleSortByChange,
  } = useConversation();
  // Consolidated modal state (replaces 13 useState calls)
  const {
    isLeaderboardOpen,
    isSettingsOpen,
    isProjectModalOpen,
    projectModalContext,
    isMyCompanyOpen,
    myCompanyInitialTab,
    myCompanyInitialDecisionId,
    myCompanyInitialPlaybookId,
    myCompanyInitialProjectId,
    myCompanyInitialProjectDecisionId,
    myCompanyPromoteDecision,
    scrollToStage3,
    scrollToResponseIndex,
    returnToMyCompanyTab,
    returnToProjectId,
    returnToDecisionId,
    // Actions
    openLeaderboard,
    closeLeaderboard,
    openSettings,
    closeSettings,
    openProjectModal,
    closeProjectModal,
    openMyCompany,
    closeMyCompany,
    resetMyCompanyInitial,
    setMyCompanyPromoteDecision,
    navigateToConversation,
    clearScrollState,
    setScrollToStage3,
    clearReturnState,
  } = useModalState();

  // Route synchronization - syncs URL with modal state
  // This enables deep linking, F5 refresh, and browser back/forward
  const { navigateToSettings, navigateToCompany, navigateToLeaderboard, navigateToChat } =
    useRouteSync({
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
      handleNewConversation: contextNewConversation,
    });

  // SEO: Update canonical URL based on current route
  useCanonical();

  // SEO: Dynamic meta tags for each route (title, description, OG tags)
  useDynamicMeta();

  // SEO: Breadcrumb schema for rich snippets in search results
  useBreadcrumbSchema();

  // SEO: FAQ schema for AI search engines (landing page only)
  useFAQSchema();

  const [isUploading, setIsUploading] = useState(false); // Image upload in progress
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Image upload state for landing hero
  const [landingImages, setLandingImages] = useState<
    Array<{
      file: File;
      preview: string;
      name: string;
      size: number;
      type: string;
    }>
  >([]);
  const [landingChatMode, setLandingChatMode] = useState<'council' | 'chat'>('council'); // 'chat' or 'council' for landing hero
  const [mockModeEnabled, setMockModeEnabled] = useState(false); // Mock mode state for banner

  // Response style selector state (LLM preset override for current session)
  const [selectedPreset, setSelectedPreset] = useState<
    import('./types/business').LLMPresetId | null
  >(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'profile' | 'billing' | 'team' | 'api' | 'developer' | 'ai-config'
  >('profile');

  // Command palette state (Cmd+K)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Register Cmd+K keyboard shortcut at App level so it works even when
  // CommandPalette is conditionally unmounted for performance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme state from next-themes
  const { theme, setTheme } = useTheme();

  // Admin access check - determines if user can access admin portal
  const { isAdmin } = useAdminAccess();

  // Navigation hook for full-page route changes (e.g., /admin)
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Compute department preset from selected department (for ResponseStyleSelector default)
  const departmentPreset = useMemo<import('./types/business').LLMPresetId>(() => {
    if (selectedDepartments.length > 0 && availableDepartments.length > 0) {
      const dept = availableDepartments.find((d) => d.id === selectedDepartments[0]);
      if (dept?.llm_preset) return dept.llm_preset;
    }
    return 'balanced';
  }, [selectedDepartments, availableDepartments]);

  // Handler to open LLM Hub settings (from MyCompany modal)
  const handleOpenLLMHub = useCallback(() => {
    // Close MyCompany first to prevent URL flickering between /company and /settings
    closeMyCompany();
    setSettingsInitialTab('ai-config');
    openSettings();
  }, [closeMyCompany, openSettings]);

  // Mobile swipe gesture to open sidebar from left edge
  useGlobalSwipe({
    onSwipeRight: () => setIsMobileSidebarOpen(true),
    onSwipeLeft: () => setIsMobileSidebarOpen(false),
    edgeWidth: 30,
    threshold: 80,
    enabled: typeof window !== 'undefined' && window.innerWidth <= 768,
  });
  const hasLoadedInitialData = useRef(false); // Prevent repeated API calls on mount

  // Message streaming hook - handles all council and chat message sending
  const { sendToCouncil, sendChatMessage, handleStopGeneration } = useMessageStreaming({
    context: {
      selectedBusiness,
      selectedDepartment,
      selectedDepartments,
      selectedRole,
      selectedRoles,
      selectedPlaybooks,
      selectedProject,
      selectedPreset,
      departmentPreset,
      useCompanyContext,
      useDepartmentContext,
    },
    conversationState: {
      currentConversationId,
      currentConversation,
      setCurrentConversationId,
      setCurrentConversation,
      setConversations,
      skipNextLoadRef,
      loadConversations,
    },
    setIsLoading,
    setIsUploading,
  });

  // Determine if we should show the landing hero (Perplexity-style)
  // Show when: authenticated, has a temp conversation with no messages
  const showLandingHero = useMemo(() => {
    if (!isAuthenticated || needsPasswordReset) return false;
    if (!currentConversation) return false;
    return currentConversation.isTemp && currentConversation.messages?.length === 0;
  }, [isAuthenticated, needsPasswordReset, currentConversation]);

  // Performance: Preload ChatInterface while user is on LandingHero
  // This starts loading the chunk in the background for instant transition
  useEffect(() => {
    if (showLandingHero) {
      preloadChatInterface();
    }
  }, [showLandingHero]);

  // i18n: Update HTML lang attribute dynamically for SEO and accessibility
  // Note: Uses i18nInstance from useTranslation() hook (not the direct import)
  // because the hook provides reactive updates when language changes
  useEffect(() => {
    const currentLang = i18nInstance.language.split('-')[0] || 'en';
    document.documentElement.lang = currentLang;
    log.debug('[i18n] Updated HTML lang attribute', currentLang);
  }, [i18nInstance.language]);

  // SEO: Dynamic meta tags, hreflang links, and Open Graph tags
  useFullSEO({
    title: showLandingHero ? t('seo.homeTitle') : t('seo.conversationTitle'),
    description: t('seo.defaultDescription'),
  });

  // Handler for search
  const handleSearchConversations = useCallback(
    async (searchQuery: string) => {
      return loadConversations({
        offset: 0,
        ...(searchQuery ? { search: searchQuery } : {}),
      });
    },
    [loadConversations]
  );

  // Conversation action handlers - wrap context handlers with App-specific logic
  const handleNewConversation = useCallback(() => {
    log.debug('[handleNewConversation] Creating new temp conversation');
    contextNewConversation();
    setSelectedProject(null);
    clearReturnState();
  }, [contextNewConversation, setSelectedProject, clearReturnState]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      // Always clear conversation state first by using contextSelectConversation
      // This ensures clean state before loading new conversation
      contextSelectConversation(id);

      // Update URL to /chat/{id} for shareable links and F5 refresh
      // Skip URL update for temp conversations (they don't exist in DB yet)
      if (!id.startsWith('temp-')) {
        navigateToChat(id);
      }
      clearReturnState();
      setScrollToStage3();
    },
    [contextSelectConversation, navigateToChat, clearReturnState, setScrollToStage3]
  );

  const handleBulkDeleteConversations = useCallback(
    async (ids: string[]) => {
      // Store conversations for potential undo
      const conversationsToDelete = conversations.filter((c) => ids.includes(c.id));
      if (conversationsToDelete.length === 0) return { deleted: [] as string[] };

      // Store original positions for restore
      const originalPositions = ids
        .map((id) => ({
          id,
          index: conversations.findIndex((c) => c.id === id),
          conversation: conversations.find((c) => c.id === id),
        }))
        .filter(
          (item): item is { id: string; index: number; conversation: Conversation } =>
            !!item.conversation
        );

      const wasCurrentConversationDeleted = ids.includes(currentConversationId ?? '');

      // Optimistically remove from UI immediately
      setConversations((prev) => prev.filter((conv) => !ids.includes(conv.id)));
      if (wasCurrentConversationDeleted) {
        setCurrentConversation(null);
        setCurrentConversationId(null);
      }

      // Track whether undo was clicked
      let undoClicked = false;

      const executeDelete = async () => {
        if (!undoClicked) {
          try {
            await api.bulkDeleteConversations(ids);
          } catch (error) {
            log.error('Failed to bulk delete conversations:', error);
            // Restore on error
            setConversations((prev) => {
              const newList = [...prev];
              originalPositions
                .sort((a, b) => a.index - b.index)
                .forEach(({ index, conversation }) => {
                  newList.splice(index, 0, conversation);
                });
              return newList;
            });
            toast.error(t('toasts.deleteConversationsFailed'));
          }
        }
      };

      // Show toast with undo action
      toast(t('toasts.conversationsDeleted', { count: conversationsToDelete.length }), {
        action: {
          label: t('common.undo'),
          onClick: () => {
            undoClicked = true;
            // Restore conversations at original positions
            setConversations((prev) => {
              const newList = [...prev];
              // Sort by original index to insert in correct order
              originalPositions
                .sort((a, b) => a.index - b.index)
                .forEach(({ index, conversation }) => {
                  newList.splice(index, 0, conversation);
                });
              return newList;
            });
            // Restore selection if it was a deleted conversation
            if (wasCurrentConversationDeleted && currentConversationId) {
              setCurrentConversationId(currentConversationId);
            }
            toast.success(
              t('toasts.conversationsRestored', { count: conversationsToDelete.length })
            );
          },
        },
        duration: 5000,
        onDismiss: executeDelete,
        onAutoClose: executeDelete,
      });

      return { deleted: ids };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      conversations,
      currentConversationId,
      setConversations,
      setCurrentConversation,
      setCurrentConversationId,
    ]
  );

  // Handler for updating conversation department (drag and drop)
  const handleUpdateConversationDepartment = useCallback(
    (conversationId: string, newDepartment: string) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, department: newDepartment } : conv
        )
      );
      // Also update current conversation if it's the one being moved
      setCurrentConversation((prev) =>
        prev && prev.id === conversationId ? { ...prev, department: newDepartment } : prev
      );
    },
    [setConversations, setCurrentConversation]
  );

  // Memoized Sidebar handlers to prevent unnecessary re-renders
  const handleSidebarSelectConversation = useCallback(
    (id: string) => {
      handleSelectConversation(id);
      setIsMobileSidebarOpen(false);
    },
    [handleSelectConversation]
  );

  const handleSidebarNewConversation = useCallback(() => {
    handleNewConversation();
    setIsMobileSidebarOpen(false);
  }, [handleNewConversation]);

  const handleMobileClose = useCallback(() => setIsMobileSidebarOpen(false), []);

  // UI action handlers - use route navigation for URL sync
  const handleOpenLeaderboard = useCallback(() => {
    navigateToLeaderboard();
  }, [navigateToLeaderboard]);

  const handleOpenSettings = useCallback(() => {
    navigateToSettings();
  }, [navigateToSettings]);

  const handleOpenMyCompany = useCallback(() => {
    navigateToCompany('overview');
  }, [navigateToCompany]);

  // Handler for opening admin portal (full-page navigation)
  const handleOpenAdmin = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  // Memoized callback for MyCompany tab changes
  const handleMyCompanyTabChange = useCallback(
    (tab: MyCompanyTab) => {
      navigateToCompany(tab);
    },
    [navigateToCompany]
  );

  // Memoized callback for MyCompany editing item changes (URL sync)
  const handleMyCompanyEditingItemChange = useCallback(
    (tab: MyCompanyTab, itemId: string | null) => {
      navigateToCompany(tab, itemId ?? undefined);
    },
    [navigateToCompany]
  );

  // Reset loaded flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedInitialData.current = false;
    }
  }, [isAuthenticated]);

  // Fetch mock mode status on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    api
      .getMockMode()
      .then((result) => setMockModeEnabled(result.enabled))
      .catch((err) => {
        log.error('Failed to get mock mode:', err);
        setMockModeEnabled(false);
      });
  }, [isAuthenticated]);

  // Handler for mock mode changes from Settings
  const handleMockModeChange = useCallback((enabled: boolean) => {
    setMockModeEnabled(enabled);
  }, []);

  // Stabilized callbacks for Sidebar - prevent re-renders from new arrow refs
  const handleArchiveConversationStable = useCallback(
    (id: string, archived?: boolean) => handleArchiveConversation(id, archived ?? true),
    [handleArchiveConversation]
  );

  const handleStarConversationStable = useCallback(
    (id: string, starred?: boolean) => handleStarConversation(id, starred ?? true),
    [handleStarConversation]
  );

  // Stabilized callbacks for ChatInterface - prevent re-renders from new arrow refs
  const handleSelectProjectWithTouch = useCallback(
    (projectId: string | null) => {
      setSelectedProject(projectId);
      if (projectId) {
        api.touchProject(projectId).catch((err: unknown) => {
          log.error('Failed to touch project:', err);
        });
      }
    },
    [setSelectedProject]
  );

  const handleOpenProjectModalStable = useCallback(
    (context: ProjectModalContext) => {
      openProjectModal(context);
    },
    [openProjectModal]
  );

  const handleProjectCreated = useCallback(
    (newProject: Project) => {
      setProjects((prev) => [...prev, newProject]);
    },
    [setProjects]
  );

  const handleViewKnowledgeBase = useCallback(() => {
    openMyCompany({ clearPromoteDecision: true });
  }, [openMyCompany]);

  const handleScrollToStage3Complete = useCallback(() => {
    clearScrollState();
  }, [clearScrollState]);

  const handleViewDecision = useCallback(
    (decisionId: string, type = 'decision', targetId: string | null = null) => {
      if (type === 'playbook' && targetId) {
        openMyCompany({
          tab: 'playbooks',
          playbookId: targetId,
          clearPromoteDecision: true,
        });
      } else if (type === 'project' && targetId) {
        openMyCompany({
          tab: 'projects',
          projectId: targetId,
          clearPromoteDecision: true,
        });
        setSelectedProject(targetId);
      } else {
        openMyCompany({ tab: 'decisions', decisionId, clearPromoteDecision: true });
      }
    },
    [openMyCompany, setSelectedProject]
  );

  const handleReturnToMyCompany = useCallback(
    (tab: MyCompanyTab, projectId: string | null, decisionId: string | null) => {
      openMyCompany({ tab, projectId, projectDecisionId: decisionId });
    },
    [openMyCompany]
  );

  const handleOpenSidebar = useCallback(() => setIsMobileSidebarOpen(true), []);

  // ProjectModal: add to list AND select
  const handleProjectModalCreated = useCallback(
    (newProject: Project) => {
      setProjects((prev) => [...prev, newProject]);
      setSelectedProject(newProject.id);
    },
    [setProjects, setSelectedProject]
  );

  // Reset all context selections (company, project, departments, roles, playbooks)
  const handleResetAllSelections = useCallback(() => {
    setSelectedBusiness(null);
    setSelectedProject(null);
    setSelectedDepartments([]);
    setSelectedRoles([]);
    setSelectedPlaybooks([]);
  }, [
    setSelectedBusiness,
    setSelectedProject,
    setSelectedDepartments,
    setSelectedRoles,
    setSelectedPlaybooks,
  ]);

  // Load businesses on mount (with token ready check)
  // Conversations are now loaded by BusinessContext when business changes
  useEffect(() => {
    if (!isAuthenticated || needsPasswordReset || hasLoadedInitialData.current) {
      return;
    }
    hasLoadedInitialData.current = true;

    const loadData = async () => {
      const token = await getAccessToken();
      if (token) {
        await loadBusinesses();

        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const conversationId = urlParams.get('conversation');
        if (conversationId) {
          setCurrentConversationId(conversationId);
          window.history.replaceState({}, '', window.location.pathname);
        }

        const initialQuestion = urlParams.get('question');
        if (initialQuestion && !conversationId) {
          window.__pendingQuestion = decodeURIComponent(initialQuestion);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    loadData();
  }, [
    isAuthenticated,
    needsPasswordReset,
    getAccessToken,
    loadBusinesses,
    setCurrentConversationId,
  ]);

  // Auto-create a temp conversation when authenticated but no conversation selected
  useEffect(() => {
    if (isAuthenticated && !needsPasswordReset && !currentConversationId) {
      contextNewConversation();
    }
  }, [isAuthenticated, needsPasswordReset, currentConversationId, contextNewConversation]);

  // Process pending question from URL parameter
  // This auto-starts a council run when navigating with ?question=...
  useEffect(() => {
    if (window.__pendingQuestion && currentConversation?.isTemp && selectedBusiness) {
      const question = window.__pendingQuestion;
      delete window.__pendingQuestion; // Clear it so we don't process twice

      // Auto-submit the question to start the council run
      // Small delay to ensure UI is ready
      setTimeout(() => {
        handleSendMessage(question, null);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSendMessage has dependencies that would cause loops
  }, [currentConversation, selectedBusiness]);

  // Conversations are now auto-loaded by ConversationContext via TanStack Query
  // with company_id scoping. No manual loadConversations call needed here.

  // Load conversation details when selected (skip temp conversations)
  useEffect(() => {
    if (currentConversationId && !currentConversationId.startsWith('temp-')) {
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      loadConversation(currentConversationId);
    }
  }, [currentConversationId, loadConversation, skipNextLoadRef]);

  // Auto-clear "Back to" button after 30 seconds
  useEffect(() => {
    if (!returnToMyCompanyTab) return;

    const timeout = setTimeout(() => {
      clearReturnState();
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, [returnToMyCompanyTab, clearReturnState]);

  // Handle returnTo redirect after login
  // When user logs in and there's a returnTo param, redirect to that URL
  // Check both URL params (for email/password login) and sessionStorage (for OAuth)
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    // Check URL params first, then sessionStorage (OAuth saves it there before redirect)
    const returnTo = searchParams.get('returnTo') || consumeReturnUrl();
    if (returnTo) {
      // Clear the returnTo param from URL if present
      if (searchParams.has('returnTo')) {
        searchParams.delete('returnTo');
        setSearchParams(searchParams, { replace: true });
      }
      // Navigate to the returnTo URL
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, authLoading, searchParams, setSearchParams, navigate]);

  // Show blank screen while checking auth (auth is fast, avoids flicker)
  // Use bg-secondary to match landing page background
  if (authLoading) {
    return <div className="app app-loading" />;
  }

  // Show login if not authenticated OR if user needs to reset password
  if (!isAuthenticated || needsPasswordReset) {
    return (
      <>
        {/* Theme toggle and help button available on login page too */}
        <ThemeToggle />
        <HelpButton />
        <AnimatePresence mode="wait">
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Suspense fallback={<LazyFallback />}>
              <Login />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  // Message sending handlers - wrappers around useMessageStreaming hook
  // These maintain the existing API for components while delegating to the hook

  // Send message wrapper (TRIAGE DISABLED: Go directly to council)
  // Now accepts pre-uploaded attachment IDs instead of raw images
  const handleSendMessage = async (content: string, attachmentIds: string[] | null = null) => {
    await sendToCouncil(content, attachmentIds);
  };

  // Send chat message - delegates to hook
  // Now accepts pre-uploaded attachment IDs instead of raw images
  const handleSendChatMessage = async (content: string, attachmentIds?: string[] | null) => {
    await sendChatMessage(content, attachmentIds);
  };

  // Handle submit from Landing Hero
  // This routes to the appropriate handler based on mode selection
  const handleLandingSubmit = (content: string, mode = 'council') => {
    if (!content.trim()) return;

    // The landing uses the same handlers as the chat interface
    // Mode determines if we go to full council or quick chat
    if (mode === 'chat') {
      // For quick mode on first message, we still need to create conversation first
      // so we route through handleSendMessage which handles temp->real transition
      handleSendMessage(content, null);
    } else {
      // Full council mode
      handleSendMessage(content, null);
    }
  };

  return (
    <motion.div
      className="app-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Skip to main content link - FIRST focusable element for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>

      {/* Impersonation banner - shown when admin is impersonating a user */}
      <ImpersonationBanner />

      {/* Mock mode banner - shown when mock mode is enabled */}
      {mockModeEnabled && <MockModeBanner />}

      {/* Theme toggle - subtle top-right dropdown */}
      <ThemeToggle />

      {/* Help button - bottom-right floating button */}
      <HelpButton />

      {/* Mobile sidebar edge indicator - subtle arrow hint */}
      <button
        className={`sidebar-edge-indicator ${isMobileSidebarOpen || isMyCompanyOpen || isSettingsOpen || isLeaderboardOpen || isProjectModalOpen ? 'hidden' : ''}`}
        onClick={() => setIsMobileSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`}
        onClick={(e) => {
          // Don't close if a Radix portal (dropdown, dialog) is open
          const isRadixPortalActive = document.querySelector(
            '[data-radix-popper-content-wrapper], ' +
              '[data-radix-select-content], ' +
              '[data-state="open"][data-radix-select-trigger], ' +
              '[data-radix-menu-content]'
          );
          if (isRadixPortalActive) {
            e.stopPropagation();
            return;
          }

          // Don't close if a dropdown was just dismissed (within 100ms)
          // This prevents the same click that closes a dropdown from also closing the sidebar
          const dismissedAt = (window as Window & { __radixSelectJustDismissed?: number })
            .__radixSelectJustDismissed;
          if (dismissedAt && Date.now() - dismissedAt < 100) {
            e.stopPropagation();
            return;
          }

          setIsMobileSidebarOpen(false);
        }}
        aria-hidden="true"
      />

      <div className="app">
        {/* Sidebar navigation - semantic aside landmark for screen readers */}
        <aside aria-label="Conversation history and navigation">
          <Sidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={handleSidebarSelectConversation}
            onNewConversation={handleSidebarNewConversation}
            isMobileOpen={isMobileSidebarOpen}
            onMobileClose={handleMobileClose}
            onOpenLeaderboard={handleOpenLeaderboard}
            onOpenSettings={handleOpenSettings}
            onOpenMyCompany={handleOpenMyCompany}
            onPreloadMyCompany={preloadMyCompany}
            onArchiveConversation={handleArchiveConversationStable}
            onStarConversation={handleStarConversationStable}
            onDeleteConversation={handleDeleteConversation}
            onBulkDeleteConversations={handleBulkDeleteConversations}
            onRenameConversation={handleRenameConversation}
            onSearch={handleSearchConversations}
            hasMoreConversations={hasMoreConversations}
            departments={availableDepartments}
            user={user}
            onSignOut={signOut}
            sortBy={conversationSortBy}
            onSortByChange={handleSortByChange}
            onUpdateConversationDepartment={handleUpdateConversationDepartment}
            onRefresh={refreshConversations}
            companyId={selectedBusiness}
            isAdmin={isAdmin}
            onOpenAdmin={handleOpenAdmin}
          />
        </aside>

        {/* Main content area - Landing Hero or Chat Interface */}
        {/* Semantic main landmark with ID for skip-to-content link */}
        <main id="main-content" aria-label="Chat interface">
          {/* Transition: Landing slides up and fades out while chat slides up from below */}
          <AnimatePresence mode="wait">
            {showLandingHero ? (
              <motion.div
                key="landing"
                className="main-content-landing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -60,
                  scale: 0.96,
                }}
                transition={{
                  duration: 0.5,
                  ease: [0.32, 0.72, 0, 1], // Custom easing for smooth feel
                }}
              >
                <LandingHero
                  businesses={businesses}
                  selectedBusiness={selectedBusiness}
                  onSelectBusiness={setSelectedBusiness}
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={setSelectedProject}
                  departments={availableDepartments}
                  selectedDepartments={selectedDepartments}
                  onSelectDepartments={setSelectedDepartments}
                  allRoles={allRoles}
                  selectedRoles={selectedRoles}
                  onSelectRoles={setSelectedRoles}
                  playbooks={availablePlaybooks}
                  selectedPlaybooks={selectedPlaybooks}
                  onSelectPlaybooks={setSelectedPlaybooks}
                  chatMode={landingChatMode}
                  onChatModeChange={setLandingChatMode}
                  onSubmit={handleLandingSubmit}
                  onResetAll={handleResetAllSelections}
                  isLoading={isLoading}
                  // Response style selector
                  selectedPreset={selectedPreset}
                  departmentPreset={departmentPreset}
                  onSelectPreset={setSelectedPreset}
                  onOpenLLMHub={handleOpenLLMHub}
                  // Image upload
                  attachedImages={landingImages}
                  onImagesChange={setLandingImages}
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                className="main-content-chat"
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{
                  duration: 0.5,
                  ease: [0.32, 0.72, 0, 1],
                  delay: 0.1, // Slight delay so landing clears first
                }}
              >
                <Suspense fallback={<ChatFallback />}>
                  <ChatInterface
                    conversation={currentConversation}
                    onSendMessage={handleSendMessage}
                    onSendChatMessage={handleSendChatMessage}
                    onStopGeneration={handleStopGeneration}
                    isLoading={isLoading}
                    businesses={businesses}
                    selectedBusiness={selectedBusiness}
                    onSelectBusiness={setSelectedBusiness}
                    departments={availableDepartments}
                    selectedDepartment={selectedDepartment}
                    onSelectDepartment={setSelectedDepartment}
                    // Multi-select support
                    selectedDepartments={selectedDepartments}
                    onSelectDepartments={setSelectedDepartments}
                    allRoles={allRoles}
                    selectedRoles={selectedRoles}
                    onSelectRoles={setSelectedRoles}
                    // Playbooks
                    playbooks={availablePlaybooks}
                    selectedPlaybooks={selectedPlaybooks}
                    onSelectPlaybooks={setSelectedPlaybooks}
                    // Legacy single-select
                    roles={availableRoles}
                    selectedRole={selectedRole}
                    onSelectRole={setSelectedRole}
                    channels={availableChannels}
                    selectedChannel={selectedChannel}
                    onSelectChannel={setSelectedChannel}
                    styles={availableStyles}
                    selectedStyle={selectedStyle}
                    onSelectStyle={setSelectedStyle}
                    // Projects
                    projects={projects}
                    selectedProject={selectedProject}
                    onSelectProject={handleSelectProjectWithTouch}
                    onOpenProjectModal={handleOpenProjectModalStable}
                    onProjectCreated={handleProjectCreated}
                    // Independent context toggles
                    useCompanyContext={useCompanyContext}
                    onToggleCompanyContext={setUseCompanyContext}
                    useDepartmentContext={useDepartmentContext}
                    onToggleDepartmentContext={setUseDepartmentContext}
                    // Upload progress
                    isUploading={isUploading}
                    // Knowledge Base navigation (now part of My Company)
                    onViewKnowledgeBase={handleViewKnowledgeBase}
                    // Scroll target - for navigating from decision source
                    scrollToStage3={scrollToStage3}
                    scrollToResponseIndex={scrollToResponseIndex}
                    onScrollToStage3Complete={handleScrollToStage3Complete}
                    // Decision/Playbook/Project navigation - open My Company to appropriate tab
                    onViewDecision={handleViewDecision}
                    // Return to My Company button (after navigating from source)
                    returnToMyCompanyTab={returnToMyCompanyTab}
                    returnToProjectId={returnToProjectId}
                    returnToDecisionId={returnToDecisionId}
                    returnPromoteDecision={myCompanyPromoteDecision}
                    onReturnToMyCompany={handleReturnToMyCompany}
                    // Loading state for conversation fetch
                    isLoadingConversation={isLoadingConversation}
                    // Mobile sidebar toggle
                    onOpenSidebar={handleOpenSidebar}
                    // Response style selector
                    selectedPreset={selectedPreset}
                    onSelectPreset={setSelectedPreset}
                    onOpenLLMHub={handleOpenLLMHub}
                  />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Lazy-loaded modals wrapped in Suspense for code splitting */}
        {/* Only render when open to avoid loading spinner on initial page load */}
        {isLeaderboardOpen && (
          <Suspense fallback={<LazyFallback />}>
            <Leaderboard
              isOpen={isLeaderboardOpen}
              onClose={() => {
                // Check if fixed-position buttons were clicked recently (within 500ms)
                const themeToggleClickTime = (
                  window as Window & { __themeToggleClickTime?: number }
                ).__themeToggleClickTime;
                const helpButtonClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeToggleClickTime && Date.now() - themeToggleClickTime < 500) ||
                  (helpButtonClickTime && Date.now() - helpButtonClickTime < 500)
                ) {
                  log.debug('[Leaderboard.onClose] Ignoring close - fixed button clicked');
                  return; // Don't close
                }
                closeLeaderboard();
              }}
            />
          </Suspense>
        )}
        {isSettingsOpen && (
          <Suspense fallback={<LazyFallback />}>
            <Settings
              isOpen={isSettingsOpen}
              onClose={() => {
                // Check if fixed-position buttons were clicked recently (within 500ms)
                const themeToggleClickTime = (
                  window as Window & { __themeToggleClickTime?: number }
                ).__themeToggleClickTime;
                const helpButtonClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeToggleClickTime && Date.now() - themeToggleClickTime < 500) ||
                  (helpButtonClickTime && Date.now() - helpButtonClickTime < 500)
                ) {
                  log.debug('[Settings.onClose] Ignoring close - fixed button clicked');
                  return; // Don't close
                }
                log.debug('[Settings.onClose] Closing settings');
                closeSettings();
                // Reset to profile tab after closing
                setSettingsInitialTab('profile');
              }}
              companyId={selectedBusiness}
              onMockModeChange={handleMockModeChange}
              initialTab={settingsInitialTab}
            />
          </Suspense>
        )}
        {isProjectModalOpen && selectedBusiness && (
          <Suspense fallback={<LazyFallback />}>
            <ProjectModal
              companyId={selectedBusiness}
              departments={availableDepartments}
              {...(projectModalContext ? { initialContext: projectModalContext } : {})}
              onClose={() => {
                // Check if fixed-position buttons were clicked recently (within 500ms)
                const themeToggleClickTime = (
                  window as Window & { __themeToggleClickTime?: number }
                ).__themeToggleClickTime;
                const helpButtonClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeToggleClickTime && Date.now() - themeToggleClickTime < 500) ||
                  (helpButtonClickTime && Date.now() - helpButtonClickTime < 500)
                ) {
                  log.debug('[ProjectModal.onClose] Ignoring close - fixed button clicked');
                  return; // Don't close
                }
                closeProjectModal();
              }}
              onProjectCreated={handleProjectModalCreated}
            />
          </Suspense>
        )}
        {isMyCompanyOpen && selectedBusiness && (
          <Suspense fallback={<LazyFallback />}>
            <MyCompany
              companyId={selectedBusiness}
              companyName={currentBusiness?.name ?? ''}
              allCompanies={businesses}
              onSelectCompany={(newCompanyId: string) => {
                setSelectedBusiness(newCompanyId);
                resetMyCompanyInitial();
              }}
              onTabChange={handleMyCompanyTabChange}
              onEditingItemChange={handleMyCompanyEditingItemChange}
              onClose={() => {
                // Check if fixed-position buttons were clicked recently (within 500ms)
                const themeToggleClickTime = (
                  window as Window & { __themeToggleClickTime?: number }
                ).__themeToggleClickTime;
                const helpButtonClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeToggleClickTime && Date.now() - themeToggleClickTime < 500) ||
                  (helpButtonClickTime && Date.now() - helpButtonClickTime < 500)
                ) {
                  log.debug('[MyCompany.onClose] Ignoring close - fixed button clicked');
                  return; // Don't close
                }
                closeMyCompany();
              }}
              onNavigateToConversation={(conversationId: string, source: string) => {
                // Map source string to tab if possible
                const tabMap: Record<string, MyCompanyTab> = {
                  decisions: 'decisions',
                  playbooks: 'playbooks',
                  projects: 'projects',
                  activity: 'overview',
                };
                const fromTab = tabMap[source] ?? null;
                navigateToConversation(fromTab, null, null, null);
                setCurrentConversationId(conversationId);
              }}
              initialTab={myCompanyInitialTab}
              initialDecisionId={myCompanyInitialDecisionId}
              initialPlaybookId={myCompanyInitialPlaybookId}
              initialProjectId={myCompanyInitialProjectId}
              initialProjectDecisionId={myCompanyInitialProjectDecisionId}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type mismatch: useModalState vs MyCompany PromoteDecision shapes (TODO: unify)
              initialPromoteDecision={myCompanyPromoteDecision as any}
              onConsumePromoteDecision={() => setMyCompanyPromoteDecision(null)}
              onOpenLLMHub={handleOpenLLMHub}
            />
          </Suspense>
        )}
        {/* Command Palette - Cmd+K quick actions (only mount when open) */}
        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onOpenChange={setIsCommandPaletteOpen}
            onOpenSettings={handleOpenSettings}
            onOpenMyCompany={handleOpenMyCompany}
            onOpenLeaderboard={handleOpenLeaderboard}
            onOpenLLMHub={handleOpenLLMHub}
            onNewConversation={handleNewConversation}
            onSelectConversation={handleSelectConversation}
            conversations={conversations}
            currentConversationId={currentConversationId}
            projects={projects}
            onSelectProject={setSelectedProject}
            selectedProject={selectedProject}
            departments={availableDepartments}
            playbooks={availablePlaybooks}
            theme={(theme as 'light' | 'dark' | 'system') || 'system'}
            onThemeChange={setTheme}
          />
        )}

        {/* Toast notifications for undo actions */}
        <Toaster />

        {/* Mobile bottom navigation - thumb-friendly access to main sections */}
        {!isMyCompanyOpen && !isSettingsOpen && !isLeaderboardOpen && !isProjectModalOpen && (
          <MobileBottomNav
            onNewChat={handleNewConversation}
            onOpenHistory={handleOpenSidebar}
            onOpenMyCompany={handleOpenMyCompany}
            onOpenSettings={handleOpenSettings}
            activeTab={isMobileSidebarOpen ? 'history' : 'chat'}
          />
        )}
      </div>
    </motion.div>
  );
}

export default App;
