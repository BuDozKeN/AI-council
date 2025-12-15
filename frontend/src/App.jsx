import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import ProjectModal from './components/ProjectModal';
import Triage from './components/Triage';
import Login from './components/Login';
import MyCompany from './components/MyCompany';
import { useAuth } from './AuthContext';
import { api, setTokenGetter } from './api';
import './App.css';

// Default departments when no company is selected or company has no departments
const DEFAULT_DEPARTMENTS = [
  { id: 'standard', name: 'Standard', description: 'General advisory council' },
];

function App() {
  const { user, loading: authLoading, signOut, isAuthenticated, needsPasswordReset, getAccessToken } = useAuth();

  // Set up API token getter when auth is available
  useEffect(() => {
    if (getAccessToken) {
      setTokenGetter(getAccessToken);
    }
  }, [getAccessToken]);

  const [conversations, setConversations] = useState([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [conversationSortBy, setConversationSortBy] = useState('date'); // 'date' or 'activity'
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null); // null = no department selected
  const [selectedRole, setSelectedRole] = useState(null); // null = general council, or specific role
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [projects, setProjects] = useState([]); // Projects for selected company
  const [selectedProject, setSelectedProject] = useState(null); // Selected project ID
  const [useCompanyContext, setUseCompanyContext] = useState(true); // Whether to use company context
  const [useDepartmentContext, setUseDepartmentContext] = useState(true); // Whether to use department context
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isMyCompanyOpen, setIsMyCompanyOpen] = useState(false);
  const [myCompanyInitialTab, setMyCompanyInitialTab] = useState('overview');
  const [myCompanyInitialDecisionId, setMyCompanyInitialDecisionId] = useState(null);
  const [myCompanyInitialPlaybookId, setMyCompanyInitialPlaybookId] = useState(null);
  const [myCompanyPromoteDecision, setMyCompanyPromoteDecision] = useState(null); // Decision object to open in Promote modal on return
  const [scrollToStage3, setScrollToStage3] = useState(false); // When navigating from decision source, scroll to Stage 3
  const [returnToMyCompanyTab, setReturnToMyCompanyTab] = useState(null); // Tab to return to after viewing source (e.g., 'decisions', 'activity')
  // Triage state
  const [triageState, setTriageState] = useState(null); // null, 'analyzing', or triage result object
  const [originalQuery, setOriginalQuery] = useState('');
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Image upload in progress
  const abortControllerRef = useRef(null);
  const skipNextLoadRef = useRef(false); // Skip loadConversation when transitioning from temp to real
  const hasLoadedInitialData = useRef(false); // Prevent repeated API calls on mount

  // Get the currently selected business object
  // IMPORTANT: All hooks must be called before any early returns
  const currentBusiness = useMemo(() => {
    return businesses.find((b) => b.id === selectedBusiness) || null;
  }, [businesses, selectedBusiness]);

  // Get departments for the selected company
  const availableDepartments = useMemo(() => {
    if (!currentBusiness || !currentBusiness.departments || currentBusiness.departments.length === 0) {
      return DEFAULT_DEPARTMENTS;
    }
    return currentBusiness.departments;
  }, [currentBusiness]);

  // Get roles for the selected department (if any)
  const availableRoles = useMemo(() => {
    if (!selectedDepartment || !availableDepartments) return [];
    const dept = availableDepartments.find((d) => d.id === selectedDepartment);
    return dept?.roles || [];
  }, [availableDepartments, selectedDepartment]);

  // Get channels for the selected department (if any)
  const availableChannels = useMemo(() => {
    if (!selectedDepartment || !availableDepartments) return [];
    const dept = availableDepartments.find((d) => d.id === selectedDepartment);
    return dept?.channels || [];
  }, [availableDepartments, selectedDepartment]);

  // Get styles for the selected company
  const availableStyles = useMemo(() => {
    if (!currentBusiness || !currentBusiness.styles) return [];
    return currentBusiness.styles;
  }, [currentBusiness]);

  // When business changes, reset department/channel/style/project to defaults and load projects
  // Track the previous business to avoid resetting on initial load
  const prevBusinessRef = useRef(selectedBusiness);
  useEffect(() => {
    // Only reset selections when business actually CHANGES (not on mount or businesses list refresh)
    const businessChanged = prevBusinessRef.current !== selectedBusiness;
    prevBusinessRef.current = selectedBusiness;

    if (businessChanged) {
      // Default to null (General/company-wide) - user can select specific department
      setSelectedDepartment(null);
      setSelectedChannel(null);
      setSelectedStyle(null);
      setSelectedProject(null);
      setProjects([]);
    }

    // Load projects for the selected business
    const loadProjects = async () => {
      if (selectedBusiness) {
        try {
          const result = await api.listProjects(selectedBusiness);
          const loadedProjects = result.projects || [];
          setProjects(loadedProjects);
          // Auto-select the first project if available (only on business change or initial load)
          if (loadedProjects.length > 0 && !selectedProject) {
            setSelectedProject(loadedProjects[0].id);
          }
        } catch (error) {
          console.error('Failed to load projects:', error);
          setProjects([]);
        }
      }
    };
    loadProjects();
    // Note: Only depend on selectedBusiness, NOT businesses array
    // The businesses array changing should not trigger selection resets
  }, [selectedBusiness]);

  // When department changes, reset role and channel
  // Track the previous department to avoid resetting on initial mount
  const prevDepartmentRef = useRef(selectedDepartment);
  useEffect(() => {
    // Only reset when department actually CHANGES (not on mount)
    const departmentChanged = prevDepartmentRef.current !== selectedDepartment;
    prevDepartmentRef.current = selectedDepartment;

    if (departmentChanged && selectedDepartment !== null) {
      // Only reset if we're switching to a different department (not clearing)
      setSelectedRole(null);
      setSelectedChannel(null);
    }
  }, [selectedDepartment]);

  // Define functions BEFORE useEffect hooks that reference them
  const loadBusinesses = async () => {
    try {
      const bizList = await api.listBusinesses();
      setBusinesses(bizList);
      // Auto-select first business if available
      if (bizList.length > 0 && !selectedBusiness) {
        setSelectedBusiness(bizList[0].id);
      }
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  const CONVERSATIONS_PAGE_SIZE = 10; // Reduced for faster initial load

  const loadConversations = async (options = {}) => {
    try {
      const limit = options.limit || CONVERSATIONS_PAGE_SIZE;
      const sortBy = options.sortBy || conversationSortBy;
      const result = await api.listConversations({ ...options, limit, sortBy });

      // API now returns { conversations: [...], has_more: bool }
      const convs = result.conversations || result; // Backwards compatible
      const hasMore = result.has_more !== undefined ? result.has_more : convs.length >= limit;

      if (options.offset && options.offset > 0) {
        // Append to existing conversations (Load More) with deduplication
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newConvs = convs.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConvs];
        });
      } else {
        // Replace conversations (initial load or search)
        setConversations(convs);
      }

      // Use has_more from API response
      setHasMoreConversations(hasMore);

      return convs;
    } catch (error) {
      console.error('Failed to load conversations:', error);
      return [];
    }
  };

  // Handler for Load More button
  const handleLoadMoreConversations = async (currentOffset, searchQuery = '') => {
    return loadConversations({
      offset: currentOffset,
      search: searchQuery || undefined
    });
  };

  // Handler for search
  const handleSearchConversations = async (searchQuery) => {
    return loadConversations({
      offset: 0,
      search: searchQuery || undefined
    });
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Reset loaded flag when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedInitialData.current = false;
    }
  }, [isAuthenticated]);

  // Load conversations and businesses on mount (with token ready check)
  // Only load once when authenticated, not on every re-render
  useEffect(() => {
    // Check sync BEFORE any async work to prevent race conditions
    if (!isAuthenticated || needsPasswordReset || hasLoadedInitialData.current) {
      return;
    }
    // Mark as loaded immediately to prevent duplicate calls
    hasLoadedInitialData.current = true;

    const loadData = async () => {
      const token = await getAccessToken();
      if (token) {
        loadConversations();
        loadBusinesses();

        // Check for conversation ID in URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const conversationId = urlParams.get('conversation');
        if (conversationId) {
          // Load the specific conversation from URL
          setCurrentConversationId(conversationId);
          // Clean up URL without reload
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    };
    loadData();
  }, [isAuthenticated, needsPasswordReset]); // Remove getAccessToken from deps to prevent re-runs

  // Auto-create a temp conversation when authenticated but no conversation selected
  // This ensures users always have an input form available
  useEffect(() => {
    if (isAuthenticated && !needsPasswordReset && !currentConversationId) {
      // Create a temporary conversation in memory only
      const tempId = `temp-${Date.now()}`;
      const tempConv = {
        id: tempId,
        created_at: new Date().toISOString(),
        title: 'New Conversation',
        messages: [],
        isTemp: true,
      };
      setCurrentConversationId(tempId);
      setCurrentConversation(tempConv);
    }
  }, [isAuthenticated, needsPasswordReset, currentConversationId]);

  // Load conversation details when selected (skip temp conversations)
  useEffect(() => {
    if (currentConversationId && !currentConversationId.startsWith('temp-')) {
      // Skip loading if we just transitioned from temp to real (streaming in progress)
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading...</p>
      </div>
    );
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

  const handleNewConversation = () => {
    // Create a temporary conversation in memory only - don't persist until first message
    const tempId = `temp-${Date.now()}`;
    const tempConv = {
      id: tempId,
      created_at: new Date().toISOString(),
      title: 'New Conversation',
      messages: [],
      isTemp: true, // Mark as temporary/unsaved
    };

    // Don't add to conversations list (it would show 0 messages)
    // Just set it as the current conversation
    setCurrentConversationId(tempId);
    setCurrentConversation(tempConv);

    // Clear return-to-company state - user has started a new action
    setReturnToMyCompanyTab(null);
    setMyCompanyPromoteDecision(null);
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);

    // Clear return-to-company state - user has started a new action
    setReturnToMyCompanyTab(null);
    setMyCompanyPromoteDecision(null);
  };

  const handleArchiveConversation = async (id, archived) => {
    try {
      await api.archiveConversation(id, archived);
      // Update the conversations list
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, is_archived: archived } : conv
        )
      );
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleStarConversation = async (id, starred) => {
    // Optimistic update - update UI immediately for responsiveness
    setConversations((prev) => {
      const updated = prev.map((conv) =>
        conv.id === id ? { ...conv, is_starred: starred } : conv
      );
      // Re-sort: starred first, then by message count
      return updated.sort((a, b) => {
        if (a.is_starred && !b.is_starred) return -1;
        if (!a.is_starred && b.is_starred) return 1;
        return b.message_count - a.message_count;
      });
    });

    // Sync with backend (revert on error)
    try {
      await api.starConversation(id, starred);
    } catch (error) {
      console.error('Failed to star conversation:', error);
      // Revert the optimistic update on error
      setConversations((prev) => {
        const reverted = prev.map((conv) =>
          conv.id === id ? { ...conv, is_starred: !starred } : conv
        );
        return reverted.sort((a, b) => {
          if (a.is_starred && !b.is_starred) return -1;
          if (!a.is_starred && b.is_starred) return 1;
          return b.message_count - a.message_count;
        });
      });
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      // Remove from conversations list
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      // If we deleted the current conversation, clear the selection
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleBulkDeleteConversations = async (ids) => {
    try {
      const result = await api.bulkDeleteConversations(ids);
      // Remove deleted conversations from the list
      setConversations((prev) => prev.filter((conv) => !result.deleted.includes(conv.id)));
      // If current conversation was deleted, clear selection
      if (result.deleted.includes(currentConversationId)) {
        setCurrentConversationId(null);
        setCurrentConversation(null);
      }
      return result;
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
      throw error;
    }
  };

  const handleRenameConversation = async (id, title) => {
    try {
      await api.renameConversation(id, title);
      // Update the conversations list
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, title } : conv
        )
      );
      // Also update current conversation if it's the one being renamed
      if (currentConversationId === id) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, title } : prev
        );
      }
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  // Triage handlers
  const handleStartTriage = async (content) => {
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
      console.error('Triage analysis failed:', error);
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
      console.error('Triage continue failed:', error);
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);

      // Mark the message as stopped (not just loading=false)
      // This tells the UI to show "Stopped" instead of "thinking..."
      setCurrentConversation((prev) => {
        if (!prev || !prev.messages || prev.messages.length === 0) return prev;
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.loading) {
          lastMsg.loading = {
            stage1: false,
            stage2: false,
            stage3: false,
          };
          // Mark as stopped so UI can show appropriate feedback
          lastMsg.stopped = true;
        }
        return { ...prev, messages };
      });
    }
  };

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
        console.log(`[APP] Uploading ${images.length} images...`);
        const uploadPromises = images.map(img => api.uploadAttachment(img.file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        attachmentIds = uploadedAttachments.map(a => a.id);
        console.log(`[APP] Uploaded attachments:`, attachmentIds);
      } catch (error) {
        console.error('Failed to upload images:', error);
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
        const newConv = await api.createConversation();
        conversationId = newConv.id;

        // Skip the loadConversation call that would be triggered by setCurrentConversationId
        // We're already managing the conversation state via streaming
        skipNextLoadRef.current = true;

        // Update our state with the real conversation ID
        setCurrentConversationId(conversationId);
        setCurrentConversation((prev) => ({
          ...prev,
          id: conversationId,
          isTemp: false,
        }));

        // Add to conversations list now that it will have a message
        setConversations((prev) => [
          { id: conversationId, created_at: newConv.created_at, message_count: 0, title: 'New Conversation' },
          ...prev,
        ]);
      } catch (error) {
        console.error('Failed to create conversation:', error);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      // Start with stage1 loading = true immediately so user sees "Waiting for models..." right away
      const assistantMessage = {
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
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming (with business/department context if enabled)
      // If useCompanyContext is false, pass null for businessId
      // If useDepartmentContext is false, pass null for department
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
      const effectiveDepartment = useDepartmentContext ? selectedDepartment : null;
      await api.sendMessageStream(conversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
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
            setCurrentConversation((prev) => {
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
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
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
            console.log('Request cancelled');
            setIsLoading(false);
            break;

          case 'image_analysis_start':
            console.log('[IMAGE] Starting analysis of', event.count, 'images');
            break;

          case 'image_analysis_complete':
            console.log('[IMAGE] Analysis complete:', event.analyzed, 'images analyzed');
            if (event.analysis) {
              // Store the image analysis in the message so it can be displayed
              setCurrentConversation((prev) => {
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
            console.log('Unknown event type:', eventType);
        }
      }, {
        businessId: effectiveBusinessId,
        department: effectiveDepartment,
        role: selectedRole,
        projectId: selectedProject,
        attachmentIds: attachmentIds,  // Pass uploaded image attachment IDs
        signal: abortControllerRef.current?.signal,
      });
    } catch (error) {
      // Don't treat cancellation as an error
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        setIsLoading(false);
        return;
      }
      console.error('Failed to send message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
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
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message for chat response
      const assistantMessage = {
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
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Build context based on toggles
      const effectiveBusinessId = useCompanyContext ? selectedBusiness : null;
      const effectiveDepartmentId = useDepartmentContext ? selectedDepartment : null;

      await api.sendChatStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'chat_start':
            // Chat stream started
            break;

          case 'chat_token':
            // Append token to streaming text
            setCurrentConversation((prev) => {
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
            console.error('Chat error:', event.error);
            break;

          case 'chat_complete':
            setCurrentConversation((prev) => {
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
            console.error('Chat stream error:', event.message);
            setCurrentConversation((prev) => {
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
            console.log('Chat request cancelled');
            setIsLoading(false);
            break;

          default:
            console.log('Unknown chat event type:', eventType);
        }
      }, {
        businessId: effectiveBusinessId,
        departmentId: effectiveDepartmentId,
        projectId: selectedProject,
        signal: abortControllerRef.current?.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Chat request was cancelled');
        setIsLoading(false);
        return;
      }
      console.error('Failed to send chat message:', error);
      // Remove optimistic messages on error
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <motion.div
      className="app-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="beta-banner">
        BETA - You're testing an early version. Feedback welcome!
      </div>
      <div className="app">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenMyCompany={() => {
            // Clear return-to-company state - user is opening it fresh
            setReturnToMyCompanyTab(null);
            setMyCompanyPromoteDecision(null);
            setIsMyCompanyOpen(true);
          }}
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
          onSortByChange={(newSort) => {
            setConversationSortBy(newSort);
            loadConversations({ sortBy: newSort, offset: 0 });
          }}
        />
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
        onSelectProject={setSelectedProject}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
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
          // Clear return-to-company state - user is opening it fresh
          setReturnToMyCompanyTab(null);
          setMyCompanyPromoteDecision(null);
          setIsMyCompanyOpen(true);
        }}
        // Scroll target - for navigating from decision source
        scrollToStage3={scrollToStage3}
        onScrollToStage3Complete={() => setScrollToStage3(false)}
        // Decision/Playbook navigation - open My Company to appropriate tab
        onViewDecision={(decisionId, type = 'decision', playbookId = null) => {
          // Clear return-to-company state - user is taking a new action
          setReturnToMyCompanyTab(null);
          setMyCompanyPromoteDecision(null);

          if (type === 'playbook' && playbookId) {
            setMyCompanyInitialTab('playbooks');
            setMyCompanyInitialPlaybookId(playbookId);
            setMyCompanyInitialDecisionId(null);
          } else {
            setMyCompanyInitialTab('decisions');
            setMyCompanyInitialDecisionId(decisionId);
            setMyCompanyInitialPlaybookId(null);
          }
          setIsMyCompanyOpen(true);
        }}
        // Return to My Company button (after navigating from source)
        returnToMyCompanyTab={returnToMyCompanyTab}
        returnPromoteDecision={myCompanyPromoteDecision}
        onReturnToMyCompany={(tab) => {
          setReturnToMyCompanyTab(null); // Clear the return state
          setMyCompanyInitialTab(tab);
          setMyCompanyInitialDecisionId(null);
          setMyCompanyInitialPlaybookId(null);
          // Don't clear myCompanyPromoteDecision here - let MyCompany use it to re-open modal
          setIsMyCompanyOpen(true);
        }}
      />
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      {isProjectModalOpen && selectedBusiness && (
        <ProjectModal
          companyId={selectedBusiness}
          onClose={() => setIsProjectModalOpen(false)}
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
            // Reset to Overview tab when switching companies
            setMyCompanyInitialTab('overview');
            setMyCompanyInitialDecisionId(null);
            setMyCompanyInitialPlaybookId(null);
          }}
          onClose={() => {
            setIsMyCompanyOpen(false);
            // Reset to defaults for next open
            setMyCompanyInitialTab('overview');
            setMyCompanyInitialDecisionId(null);
            setMyCompanyInitialPlaybookId(null);
            setMyCompanyPromoteDecision(null);
          }}
          onNavigateToConversation={(conversationId, fromTab, promoteDecision = null) => {
            setIsMyCompanyOpen(false);
            setScrollToStage3(true); // Scroll to Stage 3 when coming from decision source
            setReturnToMyCompanyTab(fromTab || null); // Remember which tab to return to
            setMyCompanyPromoteDecision(promoteDecision); // Remember decision to re-open Promote modal
            setCurrentConversationId(conversationId);
          }}
          initialTab={myCompanyInitialTab}
          initialDecisionId={myCompanyInitialDecisionId}
          initialPlaybookId={myCompanyInitialPlaybookId}
          initialPromoteDecision={myCompanyPromoteDecision}
          onConsumePromoteDecision={() => setMyCompanyPromoteDecision(null)}
        />
      )}
      </div>
    </motion.div>
  );
}

export default App;
