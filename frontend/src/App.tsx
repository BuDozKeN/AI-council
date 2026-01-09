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
import { motion, AnimatePresence } from 'framer-motion';
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
  type ProjectModalContext,
} from './hooks';
import type { Project } from './types/business';
import type { MyCompanyTab } from './components/mycompany/hooks';
import { Toaster, toast } from './components/ui/sonner';
import { MockModeBanner } from './components/ui/MockModeBanner';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { HelpButton } from './components/ui/HelpButton';
import MobileBottomNav from './components/ui/MobileBottomNav';
import { logger } from './utils/logger';
import type { Conversation, Message } from './types/conversation';
import type { UsageData } from './components/ui/TokenUsageDisplay';
import './App.css';

// Extend Window interface for pending question feature
declare global {
  interface Window {
    __pendingQuestion?: string;
  }
}

// Triage state type
interface TriageResult {
  constraints?: Record<string, unknown>;
  enhanced_query?: string;
  follow_up_question?: string;
  ready?: boolean;
}

type TriageState = null | 'analyzing' | TriageResult;

// Image upload type
interface UploadedImage {
  file: File;
  preview: string;
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
// This moves ~200KB+ (Stage1/2/3, Triage, MessageList) out of initial bundle
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

// Helper to update the last message in a conversation with proper typing
const updateLastMessage = (
  prev: Conversation | null,
  updater: (msg: Message) => Partial<Message>
): Conversation | null => {
  if (!prev?.messages) return prev;
  const messages = prev.messages.map((msg, idx) => {
    if (idx !== prev.messages.length - 1) return msg;
    return { ...msg, ...updater(msg) } as Message;
  });
  return { ...prev, messages };
};

// Simple unique ID generator for message keys
let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}`;

// Generate an initial title from user's message (before AI generates one)
const generateInitialTitle = (content: string, maxLength = 60): string => {
  if (!content) return 'New Conversation';
  const cleaned = content.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...';
};

// Create scoped logger for App component
const log = logger.scope('App');

function App() {
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
    abortControllerRef,
    loadConversations,
    loadConversation,
    handleNewConversation: contextNewConversation,
    handleSelectConversation: contextSelectConversation,
    handleArchiveConversation,
    handleStarConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleStopGeneration: contextStopGeneration,
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
      handleNewConversation: contextNewConversation,
    });

  // SEO: Update canonical URL based on current route
  useCanonical();

  // Triage state
  const [triageState, setTriageState] = useState<TriageState>(null);
  const [originalQuery, setOriginalQuery] = useState('');
  const [isTriageLoading, setIsTriageLoading] = useState(false);
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

  // Determine if we should show the landing hero (Perplexity-style)
  // Show when: authenticated, has a temp conversation with no messages
  const showLandingHero = useMemo(() => {
    if (!isAuthenticated || needsPasswordReset) {
      log.debug('[showLandingHero] false: not authenticated or needs password reset');
      return false;
    }
    if (!currentConversation) {
      log.debug('[showLandingHero] false: no current conversation');
      return false;
    }
    const result = currentConversation.isTemp && currentConversation.messages?.length === 0;
    log.debug('[showLandingHero]', result, {
      isTemp: currentConversation.isTemp,
      messagesLength: currentConversation.messages?.length,
      id: currentConversation.id,
    });
    return result;
  }, [isAuthenticated, needsPasswordReset, currentConversation]);

  // Performance: Preload ChatInterface while user is on LandingHero
  // This starts loading the chunk in the background for instant transition
  useEffect(() => {
    if (showLandingHero) {
      preloadChatInterface();
    }
  }, [showLandingHero]);

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
      // Update URL to /chat/{id} for shareable links and F5 refresh
      // Skip URL update for temp conversations (they don't exist in DB yet)
      if (id.startsWith('temp-')) {
        contextSelectConversation(id);
      } else {
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
            toast.error('Failed to delete conversations');
          }
        }
      };

      // Show toast with undo action
      toast(`${conversationsToDelete.length} conversations deleted`, {
        action: {
          label: 'Undo',
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
            toast.success(`${conversationsToDelete.length} conversations restored`);
          },
        },
        duration: 5000,
        onDismiss: executeDelete,
        onAutoClose: executeDelete,
      });

      return { deleted: ids };
    },
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

  // Load conversations when authenticated and business is selected
  useEffect(() => {
    if (isAuthenticated && selectedBusiness) {
      loadConversations({ company_id: selectedBusiness });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reload when business changes
  }, [isAuthenticated, selectedBusiness]);

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

  // Triage handlers (currently disabled but kept for future use)
  // @ts-expect-error - Kept for future use when triage is re-enabled

  const _handleStartTriage = async (content: string) => {
    if (!currentConversationId) return;

    setOriginalQuery(content);
    setIsTriageLoading(true);
    setTriageState('analyzing');

    // Only pass businessId if useCompanyContext is enabled
    const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

    try {
      const result = await api.analyzeTriage(content, effectiveBusinessId);
      setTriageState(result as TriageResult);
    } catch (error) {
      log.error('Triage analysis failed:', error);
      // On error, skip triage and go directly to council
      handleSendToCouncil(content);
    } finally {
      setIsTriageLoading(false);
    }
  };

  const handleTriageRespond = async (response: string) => {
    if (!triageState || triageState === 'analyzing') return;
    const triageResult = triageState as TriageResult;

    setIsTriageLoading(true);

    // Only pass businessId if useCompanyContext is enabled
    const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

    try {
      const result = await api.continueTriage(
        originalQuery,
        triageResult.constraints || {},
        response,
        effectiveBusinessId
      );
      setTriageState(result as TriageResult);
    } catch (error) {
      log.error('Triage continue failed:', error);
      // On error, proceed with what we have
      handleSendToCouncil(triageResult.enhanced_query || originalQuery);
    } finally {
      setIsTriageLoading(false);
    }
  };

  const handleTriageSkip = () => {
    // Skip triage and send original query to council
    handleSendToCouncil(originalQuery);
  };

  const handleTriageProceed = (enhancedQuery: string) => {
    // Proceed with the enhanced query
    handleSendToCouncil(enhancedQuery);
  };

  // Use stop generation from context
  const handleStopGeneration = contextStopGeneration;

  // This is called when user submits a message - goes directly to council (triage disabled)
  const handleSendMessage = async (content: string, images: UploadedImage[] | null = null) => {
    if (!currentConversationId) return;
    // TRIAGE DISABLED: Go directly to council
    // To re-enable triage, change this back to: await handleStartTriage(content);
    await handleSendToCouncil(content, images);
  };

  // This is called after triage is complete (or skipped) to send to council
  const handleSendToCouncil = async (content: string, images: UploadedImage[] | null = null) => {
    if (!currentConversationId) return;

    // Clear triage state
    setTriageState(null);
    setOriginalQuery('');

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);

    // Upload images if provided and get attachment IDs
    let attachmentIds = null;
    if (images && images.length > 0) {
      try {
        setIsUploading(true);
        log.debug(`Uploading ${images.length} images...`);
        const uploadPromises = images.map((img) => api.uploadAttachment(img.file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        attachmentIds = uploadedAttachments.map((a) => a.id);
        log.debug(`Uploaded attachments:`, attachmentIds);
      } catch (error) {
        log.error('Failed to upload images:', error);
        // Continue without images if upload fails
      } finally {
        setIsUploading(false);
      }
    }

    // If this is a temporary conversation, create it on the backend first
    let conversationId = currentConversationId;
    const isTemp = currentConversation?.isTemp || currentConversationId.startsWith('temp-');

    if (isTemp) {
      try {
        // Pass the selected business ID so the conversation is associated with the correct company
        const newConv = await api.createConversation(selectedBusiness);
        conversationId = newConv.id;

        // Skip the loadConversation call that would be triggered by setCurrentConversationId
        // We're already managing the conversation state via streaming
        skipNextLoadRef.current = true;

        // Generate initial title from user's message immediately
        const initialTitle = generateInitialTitle(content);

        // Update our state with the real conversation ID and initial title
        setCurrentConversationId(conversationId);
        setCurrentConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            id: conversationId,
            isTemp: false,
            title: initialTitle, // Set title immediately so header shows user's question
          };
        });

        // Add to conversations list with user's question as initial title
        const newConversationEntry: Conversation = {
          id: conversationId,
          created_at: newConv.created_at,
          message_count: 0,
          title: initialTitle,
          messages: [],
        };
        setConversations((prev) => [newConversationEntry, ...prev]);
      } catch (error) {
        log.error('Failed to create conversation:', error);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Optimistically add user message to UI
      const userMessage: Message = { id: generateMessageId(), role: 'user' as const, content };
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
        };
      });

      // Create a partial assistant message that will be updated progressively
      // Start with stage1 loading = true immediately so user sees "Waiting for models..." right away
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant' as const,
        stage1Streaming: {}, // Track streaming text per model: { 'model-id': { text: '', complete: false } }
        loading: {
          stage1: true, // Start as true so Stage1 shows immediately
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
        };
      });

      // Send message with streaming (with business/department context if enabled)
      // If useCompanyContext is false, pass null for businessId
      // If useDepartmentContext is false, pass null for department
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
      const effectiveDepartment = useDepartmentContext ? selectedDepartment : null;
      // Multi-select: pass arrays if they have values
      const effectiveDepartments =
        useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
      const effectiveRoles = selectedRoles.length > 0 ? selectedRoles : null;
      const effectivePlaybooks = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;
      await api.sendMessageStream(
        conversationId,
        content,
        (eventType, event) => {
          // Debug: Log all SSE events
          if (eventType.includes('error') || eventType.includes('Error')) {
            log.error('[SSE Event]', eventType, event);
          }
          switch (eventType) {
            case 'stage1_start':
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  loading: {
                    stage1: true,
                    stage2: msg.loading?.stage2 ?? false,
                    stage3: msg.loading?.stage3 ?? false,
                  },
                  stage1Streaming: {},
                }))
              );
              break;

            case 'stage1_token': {
              // Append token to the specific model's streaming text (IMMUTABLE)
              // Force new array reference to ensure React detects the change
              const model = event.model as string;
              const tokenContent = event.content as string;
              setCurrentConversation((prev) => {
                if (!prev?.messages) return prev;
                const messages: Message[] = [...prev.messages];
                const lastIdx = messages.length - 1;
                const lastMsg = messages[lastIdx];
                if (lastIdx >= 0 && lastMsg) {
                  const currentStreaming = lastMsg.stage1Streaming?.[model] || {
                    text: '',
                    complete: false,
                  };
                  messages[lastIdx] = {
                    ...lastMsg,
                    stage1Streaming: {
                      ...lastMsg.stage1Streaming,
                      [model]: {
                        text: currentStreaming.text + tokenContent,
                        complete: false,
                      },
                    },
                  };
                }
                return { ...prev, messages, _streamTick: Date.now() };
              });
              break;
            }

            case 'stage1_model_complete': {
              // Mark a single model as complete (IMMUTABLE)
              const model = event.model as string;
              const response = event.response as string | undefined;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => {
                  const currentStreaming = msg.stage1Streaming?.[model];
                  return {
                    stage1Streaming: {
                      ...msg.stage1Streaming,
                      [model]: currentStreaming
                        ? { ...currentStreaming, complete: true }
                        : { text: response ?? '', complete: true },
                    },
                  };
                })
              );
              break;
            }

            case 'stage1_model_error': {
              // Handle model error (IMMUTABLE)
              const model = event.model as string;
              const errorMsg = event.error as string;
              log.error(`[Stage1 Error] Model ${model}:`, errorMsg);
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage1Streaming: {
                    ...msg.stage1Streaming,
                    [model]: { text: `Error: ${errorMsg}`, complete: true, error: true },
                  },
                }))
              );
              break;
            }

            case 'stage1_complete': {
              const stage1Data = event.data as import('./types/conversation').Stage1Response[];
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage1: stage1Data,
                  loading: {
                    stage1: false,
                    stage2: msg.loading?.stage2 ?? false,
                    stage3: msg.loading?.stage3 ?? false,
                  },
                }))
              );
              break;
            }

            case 'stage2_start':
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  loading: {
                    stage1: msg.loading?.stage1 ?? false,
                    stage2: true,
                    stage3: msg.loading?.stage3 ?? false,
                  },
                  stage2Streaming: {},
                }))
              );
              break;

            case 'stage2_token': {
              // Append token to the specific model's stage2 streaming text (IMMUTABLE)
              const model = event.model as string;
              const tokenContent = event.content as string;
              setCurrentConversation((prev) => {
                if (!prev?.messages) return prev;
                const messages: Message[] = [...prev.messages];
                const lastIdx = messages.length - 1;
                const lastMsg = messages[lastIdx];
                if (lastIdx >= 0 && lastMsg) {
                  const currentStreaming = lastMsg.stage2Streaming?.[model] || {
                    text: '',
                    complete: false,
                  };
                  messages[lastIdx] = {
                    ...lastMsg,
                    stage2Streaming: {
                      ...lastMsg.stage2Streaming,
                      [model]: {
                        text: currentStreaming.text + tokenContent,
                        complete: false,
                      },
                    },
                  };
                }
                return { ...prev, messages, _streamTick: Date.now() };
              });
              break;
            }

            case 'stage2_model_complete': {
              // Mark a single model's stage2 evaluation as complete (IMMUTABLE)
              const model = event.model as string;
              const ranking = event.ranking as string | undefined;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => {
                  const currentStreaming = msg.stage2Streaming?.[model];
                  return {
                    stage2Streaming: {
                      ...msg.stage2Streaming,
                      [model]: currentStreaming
                        ? { ...currentStreaming, complete: true }
                        : { text: ranking ?? '', complete: true },
                    },
                  };
                })
              );
              break;
            }

            case 'stage2_model_error': {
              // Handle stage2 model error (IMMUTABLE)
              const model = event.model as string;
              const errorMsg = event.error as string;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage2Streaming: {
                    ...msg.stage2Streaming,
                    [model]: { text: `Error: ${errorMsg}`, complete: true, error: true },
                  },
                }))
              );
              break;
            }

            case 'stage2_complete': {
              const stage2Data = event.data as import('./types/conversation').Stage2Evaluation[];
              const metadata = event.metadata as
                | import('./types/conversation').MessageMetadata
                | undefined;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage2: stage2Data,
                  ...(metadata ? { metadata } : {}),
                  loading: {
                    stage1: msg.loading?.stage1 ?? false,
                    stage2: false,
                    stage3: msg.loading?.stage3 ?? false,
                  },
                }))
              );
              break;
            }

            case 'stage3_start':
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  loading: {
                    stage1: msg.loading?.stage1 ?? false,
                    stage2: msg.loading?.stage2 ?? false,
                    stage3: true,
                  },
                  stage3Streaming: { text: '', complete: false },
                }))
              );
              break;

            case 'stage3_token': {
              // Append token to stage3 streaming text (IMMUTABLE)
              const tokenContent = event.content as string;
              setCurrentConversation((prev) => {
                if (!prev?.messages) return prev;
                const messages: Message[] = [...prev.messages];
                const lastIdx = messages.length - 1;
                const lastMsg = messages[lastIdx];
                if (lastIdx >= 0 && lastMsg) {
                  const currentStreaming = lastMsg.stage3Streaming || { text: '', complete: false };
                  messages[lastIdx] = {
                    ...lastMsg,
                    stage3Streaming: {
                      text: currentStreaming.text + tokenContent,
                      complete: false,
                    },
                  };
                }
                return { ...prev, messages, _streamTick: Date.now() };
              });
              break;
            }

            case 'stage3_error': {
              // Handle stage3 error (IMMUTABLE)
              const errorMsg = event.error as string;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, () => ({
                  stage3Streaming: { text: `Error: ${errorMsg}`, complete: true, error: true },
                }))
              );
              break;
            }

            case 'stage3_complete': {
              const stage3Data = event.data as import('./types/conversation').Stage3Synthesis;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage3: stage3Data,
                  stage3Streaming: msg.stage3Streaming
                    ? { ...msg.stage3Streaming, complete: true }
                    : { text: stage3Data.content ?? '', complete: true },
                  loading: {
                    stage1: msg.loading?.stage1 ?? false,
                    stage2: msg.loading?.stage2 ?? false,
                    stage3: false,
                  },
                }))
              );
              break;
            }

            case 'title_complete': {
              // Title updated - update both sidebar and current conversation
              // Backend sends: { type: 'title_complete', data: { title: '...' } }
              const titleData = event.data as { title?: string } | undefined;
              const newTitle = titleData?.title;
              if (newTitle) {
                // Update sidebar list
                setConversations((prev) =>
                  prev.map((conv) =>
                    conv.id === conversationId ? { ...conv, title: newTitle } : conv
                  )
                );
                // Update current conversation so header shows AI-generated title
                setCurrentConversation((prev) => {
                  if (!prev || prev.id !== conversationId) return prev;
                  return { ...prev, title: newTitle };
                });
              }
              break;
            }

            case 'complete':
              // Stream complete, reload conversations list
              loadConversations();
              setIsLoading(false);
              break;

            case 'usage':
              // Usage data event - store on the last message for display
              setCurrentConversation((prev) =>
                updateLastMessage(prev, () => ({
                  usage: (event.data ?? event) as UsageData,
                }))
              );
              break;

            case 'error': {
              const errorMessage = event.message as string | undefined;
              log.error('Stream error:', errorMessage);
              // Reset all loading states in the message
              setCurrentConversation((prev) =>
                updateLastMessage(prev, () => ({
                  loading: { stage1: false, stage2: false, stage3: false },
                }))
              );
              setIsLoading(false);
              break;
            }

            case 'cancelled':
              log.debug('Request cancelled');
              setIsLoading(false);
              break;

            case 'image_analysis_start':
              log.debug('[IMAGE] Starting analysis of', event.count, 'images');
              break;

            case 'image_analysis_complete':
              log.debug('[IMAGE] Analysis complete:', event.analyzed, 'images analyzed');
              if (event.analysis) {
                // Store the image analysis in the message so it can be displayed
                setCurrentConversation((prev) => {
                  if (!prev?.messages) return prev;
                  const lastIdx = prev.messages.length - 1;
                  const messages = prev.messages.map((msg, idx) =>
                    idx === lastIdx ? { ...msg, imageAnalysis: event.analysis } : msg
                  );
                  return { ...prev, messages };
                });
              }
              break;

            default:
              log.warn('Unknown event type:', eventType);
          }
        },
        {
          businessId: effectiveBusinessId,
          department: effectiveDepartment,
          role: selectedRole,
          departments: effectiveDepartments, // Multi-select support
          roles: effectiveRoles, // Multi-select support
          playbooks: effectivePlaybooks, // Playbook IDs to inject
          projectId: selectedProject,
          attachmentIds: attachmentIds, // Pass uploaded image attachment IDs
          signal: abortControllerRef.current?.signal,
          preset: selectedPreset, // LLM preset override (null = use department default)
        }
      );
    } catch (error: unknown) {
      // Don't treat cancellation as an error
      if (error instanceof Error && error.name === 'AbortError') {
        log.debug('Request was cancelled');
        setIsLoading(false);
        return;
      }
      log.error('Failed to send message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => {
        if (!prev?.messages) return prev;
        return {
          ...prev,
          messages: prev.messages.slice(0, -2),
        };
      });
      setIsLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Handle chat mode - send to chairman only (no full council)
  const handleSendChatMessage = async (content: string) => {
    if (!currentConversationId || currentConversation?.isTemp) return;

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      // Optimistically add user message to UI
      const userMessage: Message = { id: generateMessageId(), role: 'user' as const, content };
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
        };
      });

      // Create a partial assistant message for chat response
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant' as const,
        stage3Streaming: { text: '', complete: false },
        loading: {
          stage1: false,
          stage2: false,
          stage3: true,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
        };
      });

      // Build context based on toggles
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
      const effectiveDepartmentId = useDepartmentContext ? selectedDepartment : null;
      // Multi-select: pass arrays if they have values
      const effectiveDepartmentIds =
        useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
      const effectiveRoleIds = selectedRoles.length > 0 ? selectedRoles : null;
      const effectivePlaybookIds = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;

      await api.sendChatStream(
        currentConversationId,
        content,
        (eventType, event) => {
          switch (eventType) {
            case 'chat_start':
              // Chat stream started
              break;

            case 'chat_token': {
              // Append token to streaming text
              const tokenContent = event.content as string;
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => {
                  const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
                  return {
                    stage3Streaming: {
                      ...currentStreaming,
                      text: currentStreaming.text + tokenContent,
                    },
                  };
                })
              );
              break;
            }

            case 'chat_error':
              log.error('Chat error:', event.error);
              break;

            case 'chat_complete': {
              const chatData = event.data as { model?: string; content?: string } | undefined;
              const model = chatData?.model ?? '';
              const responseContent = chatData?.content ?? '';
              setCurrentConversation((prev) =>
                updateLastMessage(prev, (msg) => ({
                  stage3: { content: responseContent, model },
                  stage3Streaming: { text: responseContent, complete: true },
                  loading: {
                    stage1: msg.loading?.stage1 ?? false,
                    stage2: msg.loading?.stage2 ?? false,
                    stage3: false,
                  },
                }))
              );
              break;
            }

            case 'complete':
              setIsLoading(false);
              break;

            case 'error':
              log.error('Chat stream error:', event.message);
              setCurrentConversation((prev) =>
                updateLastMessage(prev, () => ({
                  loading: { stage1: false, stage2: false, stage3: false },
                }))
              );
              setIsLoading(false);
              break;

            case 'cancelled':
              log.debug('Chat request cancelled');
              setIsLoading(false);
              break;

            default:
              log.warn('Unknown chat event type:', eventType);
          }
        },
        {
          businessId: effectiveBusinessId,
          departmentId: effectiveDepartmentId,
          departmentIds: effectiveDepartmentIds, // Multi-select support
          roleIds: effectiveRoleIds, // Multi-select support
          playbookIds: effectivePlaybookIds, // Playbook IDs to inject
          projectId: selectedProject,
          signal: abortControllerRef.current?.signal,
        }
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        log.debug('Chat request was cancelled');
        setIsLoading(false);
        return;
      }
      log.error('Failed to send chat message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => {
        if (!prev?.messages) return prev;
        return {
          ...prev,
          messages: prev.messages.slice(0, -2),
        };
      });
      setIsLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
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
      {/* Mock mode banner - shown when mock mode is enabled */}
      {mockModeEnabled && <MockModeBanner />}

      {/* Theme toggle - subtle top-right dropdown */}
      <ThemeToggle />

      {/* Help button - bottom-right floating button */}
      <HelpButton />

      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>

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
          onArchiveConversation={(id: string, archived?: boolean) =>
            handleArchiveConversation(id, archived ?? true)
          }
          onStarConversation={(id: string, starred?: boolean) =>
            handleStarConversation(id, starred ?? true)
          }
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
        />

        {/* Main content area - Landing Hero or Chat Interface */}
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
                  onSelectProject={(projectId: string | null) => {
                    setSelectedProject(projectId);
                    // Touch project to update last_accessed_at for sorting
                    if (projectId) {
                      api.touchProject(projectId).catch((err: unknown) => {
                        log.error('Failed to touch project:', err);
                      });
                    }
                  }}
                  onOpenProjectModal={(context: ProjectModalContext) => {
                    openProjectModal(context);
                  }}
                  onProjectCreated={(newProject: Project) => {
                    // Add to projects list so it appears in dropdown immediately
                    setProjects((prev) => [...prev, newProject]);
                  }}
                  // Independent context toggles
                  useCompanyContext={useCompanyContext}
                  onToggleCompanyContext={setUseCompanyContext}
                  useDepartmentContext={useDepartmentContext}
                  onToggleDepartmentContext={setUseDepartmentContext}
                  // Triage props
                  triageState={triageState}
                  originalQuestion={originalQuery}
                  isTriageLoading={isTriageLoading}
                  onTriageRespond={handleTriageRespond}
                  onTriageSkip={handleTriageSkip}
                  onTriageProceed={handleTriageProceed}
                  // Upload progress
                  isUploading={isUploading}
                  // Knowledge Base navigation (now part of My Company)
                  onViewKnowledgeBase={() => {
                    openMyCompany({ clearPromoteDecision: true });
                  }}
                  // Scroll target - for navigating from decision source
                  scrollToStage3={scrollToStage3}
                  scrollToResponseIndex={scrollToResponseIndex}
                  onScrollToStage3Complete={() => {
                    clearScrollState();
                  }}
                  // Decision/Playbook/Project navigation - open My Company to appropriate tab
                  onViewDecision={(
                    decisionId: string,
                    type = 'decision',
                    targetId: string | null = null
                  ) => {
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
                      // Also select the project in the main app for context
                      setSelectedProject(targetId);
                    } else {
                      openMyCompany({ tab: 'decisions', decisionId, clearPromoteDecision: true });
                    }
                  }}
                  // Return to My Company button (after navigating from source)
                  returnToMyCompanyTab={returnToMyCompanyTab}
                  returnToProjectId={returnToProjectId}
                  returnToDecisionId={returnToDecisionId}
                  returnPromoteDecision={myCompanyPromoteDecision}
                  onReturnToMyCompany={(
                    tab: MyCompanyTab,
                    projectId: string | null,
                    decisionId: string | null
                  ) => {
                    // Don't clear myCompanyPromoteDecision here - let MyCompany use it to re-open modal
                    // If returning to a specific project/decision, pass those IDs
                    openMyCompany({ tab, projectId, projectDecisionId: decisionId });
                  }}
                  // Loading state for conversation fetch
                  isLoadingConversation={isLoadingConversation}
                  // Mobile sidebar toggle
                  onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                  // Response style selector
                  selectedPreset={selectedPreset}
                  onSelectPreset={setSelectedPreset}
                  onOpenLLMHub={handleOpenLLMHub}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

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
              initialContext={projectModalContext as any}
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
              onProjectCreated={(newProject: Project) => {
                // Add to projects list and select it
                setProjects((prev) => [...prev, newProject]);
                setSelectedProject(newProject.id);
              }}
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
              initialPromoteDecision={myCompanyPromoteDecision as any}
              onConsumePromoteDecision={() => setMyCompanyPromoteDecision(null)}
              onOpenLLMHub={handleOpenLLMHub}
            />
          </Suspense>
        )}
        {/* Toast notifications for undo actions */}
        <Toaster />

        {/* Mobile bottom navigation - thumb-friendly access to main sections */}
        {!isMyCompanyOpen && !isSettingsOpen && !isLeaderboardOpen && !isProjectModalOpen && (
          <MobileBottomNav
            onNewChat={handleNewConversation}
            onOpenHistory={() => setIsMobileSidebarOpen(true)}
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
