import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import { LandingHero } from './components/landing';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import ProjectModal from './components/ProjectModal';
import Triage from './components/Triage';
import Login from './components/Login';
import MyCompany from './components/MyCompany';
import { DeliberationDemo } from './components/deliberation';
import { useAuth } from './AuthContext';
import { api, setTokenGetter } from './api';
import { userPreferencesApi } from './supabase';
import { useGlobalSwipe, useModalState } from './hooks';
import { Toaster, toast } from './components/ui/sonner';
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

// Check for demo mode via URL parameter
const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get('demo');

// Default departments when no company is selected or company has no departments
const DEFAULT_DEPARTMENTS = [
  { id: 'standard', name: 'Standard', description: 'General advisory council' },
];

function App() {
  const { user, loading: authLoading, signOut, isAuthenticated, needsPasswordReset, getAccessToken } = useAuth();

  // Set up API token getter synchronously when auth is available
  // This must happen before any API calls, so we do it outside useEffect
  if (getAccessToken) {
    setTokenGetter(getAccessToken);
  }

  const [conversations, setConversations] = useState([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [conversationSortBy, setConversationSortBy] = useState('date'); // 'date' or 'activity'
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null); // null = no department selected (legacy)
  const [selectedRole, setSelectedRole] = useState(null); // null = general council, or specific role (legacy)
  // Multi-select support
  const [selectedDepartments, setSelectedDepartments] = useState([]); // Array of department UUIDs
  const [selectedRoles, setSelectedRoles] = useState([]); // Array of role UUIDs
  const [availablePlaybooks, setAvailablePlaybooks] = useState([]); // All playbooks for company
  const [selectedPlaybooks, setSelectedPlaybooks] = useState([]); // Array of playbook UUIDs
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [projects, setProjects] = useState([]); // Projects for selected company
  const [selectedProject, setSelectedProject] = useState(null); // Selected project ID
  const [useCompanyContext, setUseCompanyContext] = useState(true); // Whether to use company context
  const [useDepartmentContext, setUseDepartmentContext] = useState(true); // Whether to use department context
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
  const [userPreferences, setUserPreferences] = useState(null); // Smart Auto context persistence
  const abortControllerRef = useRef(null);

  // Cleanup streaming connections on unmount to prevent resource leaks
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Mobile swipe gesture to open sidebar from left edge
  useGlobalSwipe({
    onSwipeRight: () => setIsMobileSidebarOpen(true),
    onSwipeLeft: () => setIsMobileSidebarOpen(false),
    edgeWidth: 30,
    threshold: 80,
    enabled: typeof window !== 'undefined' && window.innerWidth <= 768,
  });
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

  // Get roles for the selected department (if any) - legacy single-select
  const availableRoles = useMemo(() => {
    if (!selectedDepartment || !availableDepartments) return [];
    const dept = availableDepartments.find((d) => d.id === selectedDepartment);
    return dept?.roles || [];
  }, [availableDepartments, selectedDepartment]);

  // Get ALL roles from all departments (for multi-select)
  const allRoles = useMemo(() => {
    if (!availableDepartments) return [];
    const roles = [];
    for (const dept of availableDepartments) {
      if (dept.roles) {
        for (const role of dept.roles) {
          roles.push({
            ...role,
            departmentId: dept.id,
            departmentName: dept.name,
          });
        }
      }
    }
    return roles;
  }, [availableDepartments]);

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

  // Determine if we should show the landing hero (Perplexity-style)
  // Show when: authenticated, has a temp conversation with no messages
  const showLandingHero = useMemo(() => {
    if (!isAuthenticated || needsPasswordReset) return false;
    if (!currentConversation) return false;
    // Show landing when it's a temp conversation with no messages
    return currentConversation.isTemp && currentConversation.messages?.length === 0;
  }, [isAuthenticated, needsPasswordReset, currentConversation]);

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
      // Clear conversations - will reload below
      setConversations([]);
    }

    // Load all business data in parallel for faster initial load
    // Previously these were sequential, adding 300-600ms of unnecessary wait time
    const loadBusinessData = async () => {
      if (!selectedBusiness) {
        setAvailablePlaybooks([]);
        setSelectedPlaybooks([]);
        return;
      }

      // Run all three API calls in parallel
      const [conversationsResult, projectsResult, playbooksResult] = await Promise.allSettled([
        api.listConversations({
          limit: 10,
          offset: 0,
          companyId: selectedBusiness
        }),
        api.listProjects(selectedBusiness),
        api.getCompanyPlaybooks(selectedBusiness)
      ]);

      // Handle conversations result
      if (conversationsResult.status === 'fulfilled') {
        const result = conversationsResult.value;
        const convs = result.conversations || result;
        setConversations(convs);
        setHasMoreConversations(result.has_more !== undefined ? result.has_more : convs.length >= 10);
      } else {
        console.error('Failed to load conversations:', conversationsResult.reason);
        setConversations([]);
      }

      // Handle projects result
      if (projectsResult.status === 'fulfilled') {
        const loadedProjects = projectsResult.value.projects || [];
        setProjects(loadedProjects);
        // Validate selectedProject - clear if it no longer exists (was deleted)
        setSelectedProject(prev => {
          if (prev && !loadedProjects.some(p => p.id === prev)) {
            console.log('[App] Clearing selectedProject - project no longer exists:', prev);
            return null;
          }
          return prev;
        });
      } else {
        console.error('Failed to load projects:', projectsResult.reason);
        setProjects([]);
      }

      // Handle playbooks result
      if (playbooksResult.status === 'fulfilled') {
        const loadedPlaybooks = playbooksResult.value.playbooks || [];
        setAvailablePlaybooks(loadedPlaybooks);
        setSelectedPlaybooks([]);
      } else {
        console.error('Failed to load playbooks:', playbooksResult.reason);
        setAvailablePlaybooks([]);
        setSelectedPlaybooks([]);
      }
    };
    loadBusinessData();
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

  // Save context preferences when they change (debounced)
  const savePrefsTimeoutRef = useRef(null);
  useEffect(() => {
    // Don't save if not authenticated or still loading initial data
    if (!isAuthenticated || !hasLoadedInitialData.current) return;
    // Don't save if no business selected (nothing to save)
    if (!selectedBusiness) return;

    // Debounce saves to avoid too many writes
    if (savePrefsTimeoutRef.current) {
      clearTimeout(savePrefsTimeoutRef.current);
    }

    savePrefsTimeoutRef.current = setTimeout(() => {
      userPreferencesApi.saveLastUsed({
        companyId: selectedBusiness,
        departmentIds: selectedDepartments,
        roleIds: selectedRoles,
        projectId: selectedProject,
        playbookIds: selectedPlaybooks,
      }).then((saved) => {
        if (saved) {
          setUserPreferences(saved);
        }
      });
    }, 1000); // 1 second debounce

    return () => {
      if (savePrefsTimeoutRef.current) {
        clearTimeout(savePrefsTimeoutRef.current);
      }
    };
  }, [isAuthenticated, selectedBusiness, selectedDepartments, selectedRoles, selectedProject, selectedPlaybooks]);

  // Define functions BEFORE useEffect hooks that reference them
  const loadBusinesses = async () => {
    try {
      const bizList = await api.listBusinesses();
      setBusinesses(bizList);

      // Load user preferences for Smart Auto
      const prefs = await userPreferencesApi.get();
      setUserPreferences(prefs);

      // Apply saved preferences or default to first business
      if (prefs?.last_company_id && bizList.some(b => b.id === prefs.last_company_id)) {
        // Use saved company from preferences
        setSelectedBusiness(prefs.last_company_id);
        // Apply saved department/role selections
        if (prefs.last_department_ids?.length > 0) {
          setSelectedDepartments(prefs.last_department_ids);
        }
        if (prefs.last_role_ids?.length > 0) {
          setSelectedRoles(prefs.last_role_ids);
        }
        if (prefs.last_project_id) {
          setSelectedProject(prefs.last_project_id);
        }
        if (prefs.last_playbook_ids?.length > 0) {
          setSelectedPlaybooks(prefs.last_playbook_ids);
        }
      } else if (bizList.length > 0 && !selectedBusiness) {
        // No saved preferences, default to first business
        setSelectedBusiness(bizList[0].id);
      }
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  const CONVERSATIONS_PAGE_SIZE = 10; // Reduced for faster initial load

  const loadConversations = useCallback(async (options = {}) => {
    try {
      const limit = options.limit || CONVERSATIONS_PAGE_SIZE;
      const sortBy = options.sortBy || conversationSortBy;
      // Pass the currently selected company to filter conversations
      const companyId = options.companyId !== undefined ? options.companyId : selectedBusiness;
      const result = await api.listConversations({ ...options, limit, sortBy, companyId });

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
  }, [conversationSortBy, selectedBusiness]);

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

  const loadConversation = async (id) => {
    try {
      setIsLoadingConversation(true);
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setIsLoadingConversation(false);
    }
  };

  // Conversation action handlers - must be defined before early returns
  const handleNewConversation = useCallback(() => {
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
    setSelectedProject(null);
    clearReturnState();
  }, [clearReturnState]);

  const handleSelectConversation = useCallback((id) => {
    // Set loading state BEFORE clearing conversation to prevent welcome screen flash
    setIsLoadingConversation(true);
    // Clear current conversation to show loading state
    setCurrentConversation(null);
    setCurrentConversationId(id);
    // DON'T clear selectedProject - let user's project selection persist across conversations
    // The project context is still relevant when switching between conversations
    clearReturnState();
    // Scroll to Stage 3 (final response) when selecting a conversation
    setScrollToStage3();
  }, [clearReturnState, setScrollToStage3]);

  const handleArchiveConversation = useCallback(async (id, archived) => {
    try {
      await api.archiveConversation(id, archived);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, is_archived: archived } : conv
        )
      );
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  }, []);

  const handleStarConversation = useCallback(async (id, starred) => {
    setConversations((prev) => {
      const updated = prev.map((conv) =>
        conv.id === id ? { ...conv, is_starred: starred } : conv
      );
      return updated.sort((a, b) => {
        if (a.is_starred && !b.is_starred) return -1;
        if (!a.is_starred && b.is_starred) return 1;
        return b.message_count - a.message_count;
      });
    });
    try {
      await api.starConversation(id, starred);
    } catch (error) {
      console.error('Failed to star conversation:', error);
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
  }, []);

  const handleDeleteConversation = useCallback(async (id) => {
    // Store the conversation for potential undo
    const conversationToDelete = conversations.find(c => c.id === id);
    if (!conversationToDelete) return;

    // Store index for restoring at same position
    const originalIndex = conversations.findIndex(c => c.id === id);
    const wasCurrentConversation = currentConversationId === id;

    // Optimistically remove from UI immediately
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (wasCurrentConversation) {
      setCurrentConversation(null);
      setCurrentConversationId(null);
    }

    // Track whether undo was clicked
    let undoClicked = false;

    // Show toast with undo action
    toast('Conversation deleted', {
      description: conversationToDelete.title || 'New Conversation',
      action: {
        label: 'Undo',
        onClick: () => {
          undoClicked = true;
          // Restore conversation at original position
          setConversations((prev) => {
            const newList = [...prev];
            newList.splice(originalIndex, 0, conversationToDelete);
            return newList;
          });
          // Restore selection if it was the current conversation
          if (wasCurrentConversation) {
            setCurrentConversationId(id);
            // Note: currentConversation will be re-fetched on selection
          }
          toast.success('Conversation restored');
        },
      },
      duration: 5000, // 5 seconds to undo
      onDismiss: async () => {
        // Only delete from server if undo wasn't clicked
        if (!undoClicked) {
          try {
            await api.deleteConversation(id);
          } catch (error) {
            console.error('Failed to delete conversation:', error);
            // Restore on error
            setConversations((prev) => {
              const newList = [...prev];
              newList.splice(originalIndex, 0, conversationToDelete);
              return newList;
            });
            toast.error('Failed to delete conversation');
          }
        }
      },
    });
  }, [conversations, currentConversationId]);

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
      onDismiss: async () => {
        if (!undoClicked) {
          try {
            await api.bulkDeleteConversations(ids);
          } catch (error) {
            console.error('Failed to bulk delete conversations:', error);
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
      },
    });

    return { deleted: ids };
  }, [conversations, currentConversationId]);

  const handleRenameConversation = useCallback(async (id, title) => {
    try {
      await api.renameConversation(id, title);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === id ? { ...conv, title } : conv
        )
      );
      setCurrentConversation((prev) =>
        prev && prev.id === id ? { ...prev, title } : prev
      );
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }, []);

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

  // Pull-to-refresh handler for sidebar
  const handleRefreshConversations = useCallback(async () => {
    await loadConversations({ offset: 0 });
  }, [loadConversations]);

  const handleOpenLeaderboard = useCallback(() => {
    openLeaderboard();
  }, [openLeaderboard]);

  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const handleOpenMyCompany = useCallback(() => {
    openMyCompany({ clearPromoteDecision: true });
  }, [openMyCompany]);

  const handleSortByChange = useCallback((newSort) => {
    setConversationSortBy(newSort);
    loadConversations({ sortBy: newSort, offset: 0 });
  }, [loadConversations]);

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
        // Load businesses first - conversations will be loaded after business is selected
        // via the useEffect that watches selectedBusiness
        await loadBusinesses();

        // Check for URL parameters
        const urlParams = new URLSearchParams(window.location.search);

        // Support for conversation ID in URL
        const conversationId = urlParams.get('conversation');
        if (conversationId) {
          // Load the specific conversation from URL
          setCurrentConversationId(conversationId);
          // Clean up URL without reload
          window.history.replaceState({}, '', window.location.pathname);
        }

        // Support for question parameter - auto-starts a council run
        // This enables the hero → app flow: /app?question=How%20should%20I...
        const initialQuestion = urlParams.get('question');
        if (initialQuestion && !conversationId) {
          // Store the question to be processed after businesses are loaded
          // We need to wait for the temp conversation to be created
          window.__pendingQuestion = decodeURIComponent(initialQuestion);
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
  }, [currentConversation, selectedBusiness]);

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

  // Demo mode - show deliberation demo without auth
  if (DEMO_MODE === 'deliberation') {
    return <DeliberationDemo />;
  }

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
        console.error('Failed to create conversation:', error);
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
          console.error('[SSE Event]', eventType, event);
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
            console.error(`[Stage1 Error] Model ${event.model}:`, event.error);
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
            if (event.title) {
              // Update sidebar list
              setConversations((prev) =>
                prev.map((conv) =>
                  conv.id === conversationId ? { ...conv, title: event.title } : conv
                )
              );
              // Update current conversation so header shows AI-generated title
              setCurrentConversation((prev) => {
                if (!prev || prev.id !== conversationId) return prev;
                return { ...prev, title: event.title };
              });
            }
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
            console.log('Unknown event type:', eventType);
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
        console.log('Request was cancelled');
        setIsLoading(false);
        return;
      }
      console.error('Failed to send message:', error);
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
            console.error('Chat error:', event.error);
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
            console.error('Chat stream error:', event.message);
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
            console.log('Chat request cancelled');
            setIsLoading(false);
            break;

          default:
            console.log('Unknown chat event type:', eventType);
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
        console.log('Chat request was cancelled');
        setIsLoading(false);
        return;
      }
      console.error('Failed to send chat message:', error);
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
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to main content
      </a>

      {/* Mobile sidebar edge indicator - subtle arrow hint */}
      <button
        className={`sidebar-edge-indicator ${isMobileSidebarOpen ? 'hidden' : ''}`}
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
          onRefresh={handleRefreshConversations}
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
                    console.error('Failed to touch project:', err);
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
            // Return to landing page (not a specific conversation)
            setCurrentConversation(null);
            setCurrentConversationId(null);
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
