import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { LandingHero } from './components/landing';
import Leaderboard from './components/Leaderboard';
import Settings from './components/settings';
import ProjectModal from './components/ProjectModal';
import Triage from './components/Triage';
import Login from './components/Login';
import MyCompany from './components/MyCompany';
import { useAuth } from './AuthContext';
import { useBusiness } from './contexts/BusinessContext';
import { useConversation } from './contexts/ConversationContext';
import { api } from './api';
import { useGlobalSwipe, useModalState } from './hooks';
import { Toaster, toast } from './components/ui/sonner';
import { MockModeBanner } from './components/ui/MockModeBanner';
import { logger } from './utils/logger';
import './App.css';


// Simple unique ID generator for message keys
let messageIdCounter = 0;
const generateMessageId = () => `msg-${Date.now()}-${++messageIdCounter}`;

// Generate an initial title from user's message (before AI generates one)
const generateInitialTitle = (content, maxLength = 60) => {
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
  const { user, loading: authLoading, signOut, isAuthenticated, needsPasswordReset, getAccessToken } = useAuth();

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
    userPreferences,
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
  // Triage state
  const [triageState, setTriageState] = useState(null); // null, 'analyzing', or triage result object
  const [originalQuery, setOriginalQuery] = useState('');
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Image upload in progress
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [landingChatMode, setLandingChatMode] = useState('council'); // 'chat' or 'council' for landing hero
  const [mockModeEnabled, setMockModeEnabled] = useState(false); // Mock mode state for banner

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
    if (!isAuthenticated || needsPasswordReset) return false;
    if (!currentConversation) return false;
    // Show landing when it's a temp conversation with no messages
    return currentConversation.isTemp && currentConversation.messages?.length === 0;
  }, [isAuthenticated, needsPasswordReset, currentConversation]);

  // Handler for Load More button
  const handleLoadMoreConversations = useCallback(async (currentOffset, searchQuery = '') => {
    return loadConversations({
      offset: currentOffset,
      search: searchQuery || undefined
    });
  }, [loadConversations]);

  // Handler for search
  const handleSearchConversations = useCallback(async (searchQuery) => {
    return loadConversations({
      offset: 0,
      search: searchQuery || undefined
    });
  }, [loadConversations]);

  // Conversation action handlers - wrap context handlers with App-specific logic
  const handleNewConversation = useCallback(() => {
    contextNewConversation();
    setSelectedProject(null);
    clearReturnState();
  }, [contextNewConversation, setSelectedProject, clearReturnState]);

  const handleSelectConversation = useCallback((id) => {
    contextSelectConversation(id);
    clearReturnState();
    setScrollToStage3();
  }, [contextSelectConversation, clearReturnState, setScrollToStage3]);

  const handleBulkDeleteConversations = useCallback(async (ids) => {
    // Store conversations for potential undo
    const conversationsToDelete = conversations.filter(c => ids.includes(c.id));
    if (conversationsToDelete.length === 0) return { deleted: [] };

    // Store original positions for restore
    const originalPositions = ids.map(id => ({
      id,
      index: conversations.findIndex(c => c.id === id),
      conversation: conversations.find(c => c.id === id),
    })).filter(item => item.conversation);

    const wasCurrentConversationDeleted = ids.includes(currentConversationId);

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
          if (wasCurrentConversationDeleted) {
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
  }, [conversations, currentConversationId, setConversations, setCurrentConversation, setCurrentConversationId]);

  // Handler for updating conversation department (drag and drop)
  const handleUpdateConversationDepartment = useCallback((conversationId, newDepartment) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, department: newDepartment } : conv
      )
    );
    // Also update current conversation if it's the one being moved
    setCurrentConversation((prev) =>
      prev && prev.id === conversationId ? { ...prev, department: newDepartment } : prev
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Context setters are stable
  }, []);

  // Memoized Sidebar handlers to prevent unnecessary re-renders
  const handleSidebarSelectConversation = useCallback((id) => {
    handleSelectConversation(id);
    setIsMobileSidebarOpen(false);
  }, [handleSelectConversation]);

  const handleSidebarNewConversation = useCallback(() => {
    handleNewConversation();
    setIsMobileSidebarOpen(false);
  }, [handleNewConversation]);

  const handleMobileClose = useCallback(() => setIsMobileSidebarOpen(false), []);

  // UI action handlers
  const handleOpenLeaderboard = useCallback(() => {
    openLeaderboard();
  }, [openLeaderboard]);

  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const handleOpenMyCompany = useCallback(() => {
    openMyCompany({ clearPromoteDecision: true });
  }, [openMyCompany]);

  // Reset loaded flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedInitialData.current = false;
    }
  }, [isAuthenticated]);

  // Fetch mock mode status on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    api.getMockMode()
      .then(result => setMockModeEnabled(result.enabled))
      .catch(err => {
        log.error('Failed to get mock mode:', err);
        setMockModeEnabled(false);
      });
  }, [isAuthenticated]);

  // Handler for mock mode changes from Settings
  const handleMockModeChange = useCallback((enabled: boolean) => {
    setMockModeEnabled(enabled);
  }, []);

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
  }, [isAuthenticated, needsPasswordReset, getAccessToken, loadBusinesses, setCurrentConversationId]);

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
      <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Login />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Triage handlers
  const _handleStartTriage = async (content) => {
    if (!currentConversationId) return;

    setOriginalQuery(content);
    setIsTriageLoading(true);
    setTriageState('analyzing');

    // Only pass businessId if useCompanyContext is enabled
    const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

    try {
      const result = await api.analyzeTriage(content, effectiveBusinessId);
      setTriageState(result);
    } catch (error) {
      log.error('Triage analysis failed:', error);
      // On error, skip triage and go directly to council
      handleSendToCouncil(content);
    } finally {
      setIsTriageLoading(false);
    }
  };

  const handleTriageRespond = async (response) => {
    if (!triageState || triageState === 'analyzing') return;

    setIsTriageLoading(true);

    // Only pass businessId if useCompanyContext is enabled
    const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;

    try {
      const result = await api.continueTriage(
        originalQuery,
        triageState.constraints || {},
        response,
        effectiveBusinessId
      );
      setTriageState(result);
    } catch (error) {
      log.error('Triage continue failed:', error);
      // On error, proceed with what we have
      handleSendToCouncil(triageState.enhanced_query || originalQuery);
    } finally {
      setIsTriageLoading(false);
    }
  };

  const handleTriageSkip = () => {
    // Skip triage and send original query to council
    handleSendToCouncil(originalQuery);
  };

  const handleTriageProceed = (enhancedQuery) => {
    // Proceed with the enhanced query
    handleSendToCouncil(enhancedQuery);
  };

  // Use stop generation from context
  const handleStopGeneration = contextStopGeneration;

  // This is called when user submits a message - goes directly to council (triage disabled)
  const handleSendMessage = async (content, images = null) => {
    if (!currentConversationId) return;
    // TRIAGE DISABLED: Go directly to council
    // To re-enable triage, change this back to: await handleStartTriage(content);
    await handleSendToCouncil(content, images);
  };

  // This is called after triage is complete (or skipped) to send to council
  const handleSendToCouncil = async (content, images = null) => {
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
        const uploadPromises = images.map(img => api.uploadAttachment(img.file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        attachmentIds = uploadedAttachments.map(a => a.id);
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
        setConversations((prev) => [
          { id: conversationId, created_at: newConv.created_at, message_count: 0, title: initialTitle },
          ...prev,
        ]);
      } catch (error) {
        log.error('Failed to create conversation:', error);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Optimistically add user message to UI
      const userMessage = { id: generateMessageId(), role: 'user', content };
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
        };
      });

      // Create a partial assistant message that will be updated progressively
      // Start with stage1 loading = true immediately so user sees "Waiting for models..." right away
      const assistantMessage = {
        id: generateMessageId(),
        role: 'assistant',
        stage1: null,
        stage1Streaming: {}, // Track streaming text per model: { 'model-id': { text: '', complete: false } }
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: true,  // Start as true so Stage1 shows immediately
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
      const effectiveDepartments = useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
      const effectiveRoles = selectedRoles.length > 0 ? selectedRoles : null;
      const effectivePlaybooks = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;
      await api.sendMessageStream(conversationId, content, (eventType, event) => {
        // Debug: Log all SSE events
        if (eventType.includes('error') || eventType.includes('Error')) {
          log.error('[SSE Event]', eventType, event);
        }
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? { ...msg, loading: { ...msg.loading, stage1: true }, stage1Streaming: {} }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage1_token':
            // Append token to the specific model's streaming text (IMMUTABLE)
            // Force new array reference to ensure React detects the change
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = [...prev.messages];
              const lastIdx = messages.length - 1;
              if (lastIdx >= 0) {
                const msg = messages[lastIdx];
                const currentStreaming = msg.stage1Streaming?.[model] || { text: '', complete: false };
                messages[lastIdx] = {
                  ...msg,
                  stage1Streaming: {
                    ...msg.stage1Streaming,
                    [model]: {
                      text: currentStreaming.text + event.content,
                      complete: false,
                    },
                  },
                };
              }
              return { ...prev, messages, _streamTick: Date.now() };
            });
            break;

          case 'stage1_model_complete':
            // Mark a single model as complete (IMMUTABLE)
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = prev.messages.map((msg, idx) => {
                if (idx !== prev.messages.length - 1) return msg;
                const currentStreaming = msg.stage1Streaming?.[model];
                return {
                  ...msg,
                  stage1Streaming: {
                    ...msg.stage1Streaming,
                    [model]: currentStreaming
                      ? { ...currentStreaming, complete: true }
                      : { text: event.response, complete: true },
                  },
                };
              });
              return { ...prev, messages };
            });
            break;

          case 'stage1_model_error':
            // Handle model error (IMMUTABLE)
            log.error(`[Stage1 Error] Model ${event.model}:`, event.error);
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage1Streaming: {
                        ...msg.stage1Streaming,
                        [model]: { text: `Error: ${event.error}`, complete: true, error: true },
                      },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? { ...msg, stage1: event.data, loading: { ...msg.loading, stage1: false } }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? { ...msg, loading: { ...msg.loading, stage2: true }, stage2Streaming: {} }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage2_token':
            // Append token to the specific model's stage2 streaming text (IMMUTABLE)
            // Force new array reference to ensure React detects the change
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = [...prev.messages];
              const lastIdx = messages.length - 1;
              if (lastIdx >= 0) {
                const msg = messages[lastIdx];
                const currentStreaming = msg.stage2Streaming?.[model] || { text: '', complete: false };
                messages[lastIdx] = {
                  ...msg,
                  stage2Streaming: {
                    ...msg.stage2Streaming,
                    [model]: {
                      text: currentStreaming.text + event.content,
                      complete: false,
                    },
                  },
                };
              }
              return { ...prev, messages, _streamTick: Date.now() };
            });
            break;

          case 'stage2_model_complete':
            // Mark a single model's stage2 evaluation as complete (IMMUTABLE)
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = prev.messages.map((msg, idx) => {
                if (idx !== prev.messages.length - 1) return msg;
                const currentStreaming = msg.stage2Streaming?.[model];
                return {
                  ...msg,
                  stage2Streaming: {
                    ...msg.stage2Streaming,
                    [model]: currentStreaming
                      ? { ...currentStreaming, complete: true }
                      : { text: event.ranking, complete: true },
                  },
                };
              });
              return { ...prev, messages };
            });
            break;

          case 'stage2_model_error':
            // Handle stage2 model error (IMMUTABLE)
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const model = event.model;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage2Streaming: {
                        ...msg.stage2Streaming,
                        [model]: { text: `Error: ${event.error}`, complete: true, error: true },
                      },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage2: event.data,
                      metadata: event.metadata,
                      loading: { ...msg.loading, stage2: false },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? { ...msg, loading: { ...msg.loading, stage3: true }, stage3Streaming: { text: '', complete: false } }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage3_token':
            // Append token to stage3 streaming text (IMMUTABLE)
            // Force new array reference to ensure React detects the change
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = [...prev.messages];
              const lastIdx = messages.length - 1;
              if (lastIdx >= 0) {
                const msg = messages[lastIdx];
                const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
                messages[lastIdx] = {
                  ...msg,
                  stage3Streaming: {
                    text: currentStreaming.text + event.content,
                    complete: false,
                  },
                };
              }
              return { ...prev, messages, _streamTick: Date.now() };
            });
            break;

          case 'stage3_error':
            // Handle stage3 error (IMMUTABLE)
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage3Streaming: { text: `Error: ${event.error}`, complete: true, error: true },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage3: event.data,
                      stage3Streaming: msg.stage3Streaming
                        ? { ...msg.stage3Streaming, complete: true }
                        : { text: event.data.response, complete: true },
                      loading: { ...msg.loading, stage3: false },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            // Title updated - update both sidebar and current conversation
            // Backend sends: { type: 'title_complete', data: { title: '...' } }
            const newTitle = event.data?.title;
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

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            log.error('Stream error:', event.message);
            // Reset all loading states in the message
            setCurrentConversation((prev) => {
              if (!prev || !prev.messages || prev.messages.length === 0) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      loading: { stage1: false, stage2: false, stage3: false },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            setIsLoading(false);
            break;

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
                  idx === lastIdx
                    ? { ...msg, imageAnalysis: event.analysis }
                    : msg
                );
                return { ...prev, messages };
              });
            }
            break;

          default:
            log.warn('Unknown event type:', eventType);
        }
      }, {
        businessId: effectiveBusinessId,
        department: effectiveDepartment,
        role: selectedRole,
        departments: effectiveDepartments,  // Multi-select support
        roles: effectiveRoles,              // Multi-select support
        playbooks: effectivePlaybooks,      // Playbook IDs to inject
        projectId: selectedProject,
        attachmentIds: attachmentIds,  // Pass uploaded image attachment IDs
        signal: abortControllerRef.current?.signal,
      });
    } catch (error) {
      // Don't treat cancellation as an error
      if (error.name === 'AbortError') {
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
  const handleSendChatMessage = async (content) => {
    if (!currentConversationId || currentConversation?.isTemp) return;

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      // Optimistically add user message to UI
      const userMessage = { id: generateMessageId(), role: 'user', content };
      setCurrentConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
        };
      });

      // Create a partial assistant message for chat response
      const assistantMessage = {
        id: generateMessageId(),
        role: 'assistant',
        stage1: [],
        stage2: [],
        stage3: null,
        stage3Streaming: { text: '', complete: false },
        isChat: true, // Mark as chat-only message
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
      const effectiveDepartmentIds = useDepartmentContext && selectedDepartments.length > 0 ? selectedDepartments : null;
      const effectiveRoleIds = selectedRoles.length > 0 ? selectedRoles : null;
      const effectivePlaybookIds = selectedPlaybooks.length > 0 ? selectedPlaybooks : null;

      await api.sendChatStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'chat_start':
            // Chat stream started
            break;

          case 'chat_token':
            // Append token to streaming text
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) => {
                if (idx !== prev.messages.length - 1) return msg;
                const currentStreaming = msg.stage3Streaming || { text: '', complete: false };
                return {
                  ...msg,
                  stage3Streaming: {
                    ...currentStreaming,
                    text: currentStreaming.text + event.content,
                  },
                };
              });
              return { ...prev, messages };
            });
            break;

          case 'chat_error':
            log.error('Chat error:', event.error);
            break;

          case 'chat_complete':
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      stage3: { model: event.data.model, response: event.data.content },
                      stage3Streaming: { text: event.data.content, complete: true },
                      loading: { ...msg.loading, stage3: false },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            break;

          case 'complete':
            setIsLoading(false);
            break;

          case 'error':
            log.error('Chat stream error:', event.message);
            setCurrentConversation((prev) => {
              if (!prev?.messages) return prev;
              const messages = prev.messages.map((msg, idx) =>
                idx === prev.messages.length - 1
                  ? {
                      ...msg,
                      loading: { stage1: false, stage2: false, stage3: false },
                    }
                  : msg
              );
              return { ...prev, messages };
            });
            setIsLoading(false);
            break;

          case 'cancelled':
            log.debug('Chat request cancelled');
            setIsLoading(false);
            break;

          default:
            log.warn('Unknown chat event type:', eventType);
        }
      }, {
        businessId: effectiveBusinessId,
        departmentId: effectiveDepartmentId,
        departmentIds: effectiveDepartmentIds,  // Multi-select support
        roleIds: effectiveRoleIds,              // Multi-select support
        playbookIds: effectivePlaybookIds,      // Playbook IDs to inject
        projectId: selectedProject,
        signal: abortControllerRef.current?.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
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
  const handleLandingSubmit = (content, mode = 'council') => {
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
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Mock mode banner - shown when mock mode is enabled */}
      {mockModeEnabled && <MockModeBanner />}

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
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
          onArchiveConversation={handleArchiveConversation}
          onStarConversation={handleStarConversation}
          onDeleteConversation={handleDeleteConversation}
          onBulkDeleteConversations={handleBulkDeleteConversations}
          onRenameConversation={handleRenameConversation}
          onLoadMore={handleLoadMoreConversations}
          onSearch={handleSearchConversations}
          hasMoreConversations={hasMoreConversations}
          departments={availableDepartments}
          user={user}
          onSignOut={signOut}
          sortBy={conversationSortBy}
          onSortByChange={handleSortByChange}
          onUpdateConversationDepartment={handleUpdateConversationDepartment}
          onRefresh={refreshConversations}
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
              departments={availableDepartments}
              selectedDepartments={selectedDepartments}
              onSelectDepartments={setSelectedDepartments}
              allRoles={allRoles}
              selectedRoles={selectedRoles}
              onSelectRoles={setSelectedRoles}
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              playbooks={availablePlaybooks}
              selectedPlaybooks={selectedPlaybooks}
              onSelectPlaybooks={setSelectedPlaybooks}
              chatMode={landingChatMode}
              onChatModeChange={setLandingChatMode}
              onSubmit={handleLandingSubmit}
              isLoading={isLoading}
              userPreferences={userPreferences}
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
              onSelectProject={(projectId) => {
                setSelectedProject(projectId);
                // Touch project to update last_accessed_at for sorting
                if (projectId) {
                  api.touchProject(projectId).catch(err => {
                    log.error('Failed to touch project:', err);
                  });
                }
              }}
              onOpenProjectModal={(context) => {
                openProjectModal(context);
              }}
              onProjectCreated={(newProject) => {
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
              onViewDecision={(decisionId, type = 'decision', targetId = null) => {
                if (type === 'playbook' && targetId) {
                  openMyCompany({ tab: 'playbooks', playbookId: targetId, clearPromoteDecision: true });
                } else if (type === 'project' && targetId) {
                  openMyCompany({ tab: 'projects', projectId: targetId, clearPromoteDecision: true });
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
              onReturnToMyCompany={(tab, projectId, decisionId) => {
                // Don't clear myCompanyPromoteDecision here - let MyCompany use it to re-open modal
                // If returning to a specific project/decision, pass those IDs
                openMyCompany({ tab, projectId, projectDecisionId: decisionId });
              }}
              // Loading state for conversation fetch
              isLoadingConversation={isLoadingConversation}
              // Mobile sidebar toggle
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={closeLeaderboard}
      />
      <Settings
        isOpen={isSettingsOpen}
        onClose={closeSettings}
        companyId={selectedBusiness}
        onMockModeChange={handleMockModeChange}
      />
      {isProjectModalOpen && selectedBusiness && (
        <ProjectModal
          companyId={selectedBusiness}
          departments={availableDepartments}
          initialContext={projectModalContext}
          onClose={closeProjectModal}
          onProjectCreated={(newProject) => {
            // Add to projects list and select it
            setProjects((prev) => [...prev, newProject]);
            setSelectedProject(newProject.id);
          }}
        />
      )}
      {isMyCompanyOpen && selectedBusiness && (
        <MyCompany
          companyId={selectedBusiness}
          companyName={currentBusiness?.name}
          allCompanies={businesses}
          onSelectCompany={(newCompanyId) => {
            setSelectedBusiness(newCompanyId);
            resetMyCompanyInitial();
          }}
          onClose={() => {
            closeMyCompany();
            // Return to landing page by creating a new temp conversation
            handleNewConversation();
          }}
          onNavigateToConversation={(conversationId, fromTab, responseIndex = null, projectId = null, decisionId = null) => {
            navigateToConversation(fromTab, responseIndex, projectId, decisionId);
            setCurrentConversationId(conversationId);
          }}
          initialTab={myCompanyInitialTab}
          initialDecisionId={myCompanyInitialDecisionId}
          initialPlaybookId={myCompanyInitialPlaybookId}
          initialProjectId={myCompanyInitialProjectId}
          initialProjectDecisionId={myCompanyInitialProjectDecisionId}
          initialPromoteDecision={myCompanyPromoteDecision}
          onConsumePromoteDecision={() => setMyCompanyPromoteDecision(null)}
        />
      )}
      {/* Toast notifications for undo actions */}
      <Toaster />
      </div>
    </motion.div>
  );
}

export default App;
