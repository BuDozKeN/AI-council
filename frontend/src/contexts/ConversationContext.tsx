/* eslint-disable react-refresh/only-export-components -- Context pattern exports both Provider and hook */
/**
 * ConversationContext - Manages conversation list and current conversation state
 *
 * Now powered by TanStack Query for:
 * - Automatic caching (5min stale, 30min cache)
 * - Background refetching
 * - Optimistic updates with rollback
 * - DevTools inspection of all queries/mutations
 *
 * Note: The streaming message handlers (handleSendMessage, handleSendToCouncil)
 * remain in App.jsx for now due to their complexity and tight integration with
 * business context.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { logger } from '../utils/logger';
import { toast } from '../components/ui/sonner';
import { PAGINATION } from '../constants';
import type { Conversation, ConversationSortBy } from '../types';

// Query key factory for consistent cache management
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
};

const log = logger.scope('ConversationContext');

interface LoadConversationsOptions {
  limit?: number;
  offset?: number;
  sortBy?: ConversationSortBy;
  company_id?: string;
  include_archived?: boolean;
  search?: string;
}

// State values - these change and trigger re-renders
interface ConversationStateValue {
  conversations: Conversation[];
  hasMoreConversations: boolean;
  conversationSortBy: ConversationSortBy;
  currentConversationId: string | null;
  currentConversation: Conversation | null;
  isLoadingConversation: boolean;
  isLoading: boolean;
}

// Actions and refs - these are stable and never cause re-renders
interface ConversationActionsValue {
  // Refs (for external access)
  skipNextLoadRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  // Setters (for streaming handlers in App.tsx)
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setCurrentConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  setCurrentConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  // Actions
  loadConversations: (options?: LoadConversationsOptions) => Promise<Conversation[]>;
  loadConversation: (id: string) => Promise<void>;
  handleNewConversation: () => void;
  handleSelectConversation: (id: string) => void;
  handleArchiveConversation: (id: string, archived: boolean) => Promise<void>;
  handleStarConversation: (id: string, starred: boolean) => Promise<void>;
  handleDeleteConversation: (id: string) => Promise<void>;
  handleRenameConversation: (id: string, title: string) => Promise<void>;
  handleStopGeneration: () => void;
  refreshConversations: () => Promise<void>;
  handleSortByChange: (newSort: ConversationSortBy) => void;
}

// Split contexts: Actions are stable (never cause re-renders), State changes trigger re-renders
const ConversationStateContext = createContext<ConversationStateValue>({} as ConversationStateValue);
const ConversationActionsContext = createContext<ConversationActionsValue>({} as ConversationActionsValue);

// Convenience hook for components that need everything (backwards compatible)
export const useConversation = () => {
  const state = useContext(ConversationStateContext);
  const actions = useContext(ConversationActionsContext);
  return { ...state, ...actions };
};

// Granular hooks for optimized components
export const useConversationState = () => useContext(ConversationStateContext);
export const useConversationActions = () => useContext(ConversationActionsContext);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Local UI state (not server state)
  const [conversationSortBy, setConversationSortBy] = useState<ConversationSortBy>('date');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [paginationOffset, setPaginationOffset] = useState<number>(0);

  // General loading state (for streaming - managed by App.tsx)
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Ref to skip loading when transitioning from temp to real
  const skipNextLoadRef = useRef<boolean>(false);

  // Abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Query: Conversation List
  // ═══════════════════════════════════════════════════════════════════════════
  const listQueryKey = conversationKeys.list({ sortBy: conversationSortBy, offset: paginationOffset });

  const {
    data: conversationsData,
    // isLoading: isLoadingList, // Not used currently - TanStack Query handles loading state
    error: listError,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const limit = PAGINATION.CONVERSATIONS_PAGE_SIZE;
      // Cast sortBy to the API's expected type (excludes 'title' which is only used locally)
      const apiSortBy = conversationSortBy === 'title' ? 'date' : conversationSortBy;
      const result = await api.listConversations({
        limit,
        sortBy: apiSortBy,
        offset: paginationOffset
      });
      return {
        conversations: result.conversations || result,
        hasMore: result.has_more !== undefined ? result.has_more : (result.conversations || result).length >= limit,
      };
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Merge paginated results into a single list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(true);

  useEffect(() => {
    if (conversationsData) {
      if (paginationOffset === 0) {
        setConversations(conversationsData.conversations);
      } else {
        // Append with deduplication
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newConvs = conversationsData.conversations.filter((c: Conversation) => !existingIds.has(c.id));
          return [...prev, ...newConvs];
        });
      }
      setHasMoreConversations(conversationsData.hasMore);
    }
  }, [conversationsData, paginationOffset]);

  // Log errors to Sentry/console
  useEffect(() => {
    if (listError) {
      log.error('Failed to load conversations:', listError);
    }
  }, [listError]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Query: Single Conversation
  // ═══════════════════════════════════════════════════════════════════════════
  const shouldFetchConversation = !!currentConversationId && !currentConversationId.startsWith('temp-');

  const {
    data: fetchedConversation,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useQuery({
    queryKey: conversationKeys.detail(currentConversationId || ''),
    queryFn: () => api.getConversation(currentConversationId!),
    enabled: shouldFetchConversation,
    staleTime: 1000 * 60 * 5,
  });

  // Sync fetched conversation to local state
  useEffect(() => {
    if (fetchedConversation && shouldFetchConversation) {
      setCurrentConversation(fetchedConversation);
    }
  }, [fetchedConversation, shouldFetchConversation]);

  useEffect(() => {
    if (conversationError) {
      log.error('Failed to load conversation:', conversationError);
      setCurrentConversationId(null);
      toast.error("We couldn't load that conversation. Please try again.");
    }
  }, [conversationError]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Wrapper functions (maintain existing API for components)
  // ═══════════════════════════════════════════════════════════════════════════

  // Load conversations - now just triggers refetch or pagination
  const loadConversations = useCallback(async (options: LoadConversationsOptions = {}): Promise<Conversation[]> => {
    if (options.offset && options.offset > 0) {
      setPaginationOffset(options.offset);
    } else {
      setPaginationOffset(0);
      // Invalidate to force refetch
      await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    }
    if (options.sortBy && options.sortBy !== conversationSortBy) {
      setConversationSortBy(options.sortBy);
    }
    return conversations;
  }, [queryClient, conversations, conversationSortBy]);

  // Load a single conversation - just set the ID, query handles the rest
  const loadConversation = useCallback(async (id: string): Promise<void> => {
    setCurrentConversationId(id);
  }, []);

  // Create a new temporary conversation
  const handleNewConversation = useCallback((): void => {
    const tempId = `temp-${Date.now()}`;
    const tempConv: Conversation = {
      id: tempId,
      created_at: new Date().toISOString(),
      title: 'New Conversation',
      messages: [],
      isTemp: true,
    };
    setCurrentConversationId(tempId);
    setCurrentConversation(tempConv);
  }, []);

  // Select an existing conversation
  // Note: isLoadingConversation is now managed by the TanStack Query above
  const handleSelectConversation = useCallback((id: string): void => {
    setCurrentConversation(null);
    setCurrentConversationId(id);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Mutations with Optimistic Updates
  // ═══════════════════════════════════════════════════════════════════════════

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.archiveConversation(id, archived),
    onMutate: async ({ id, archived }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() });
      // Snapshot
      const previousConversations = conversations;
      // Optimistic update
      setConversations(prev =>
        prev.map(conv => conv.id === id ? { ...conv, is_archived: archived } : conv)
      );
      return { previousConversations };
    },
    onError: (err, _, context) => {
      log.error('Failed to archive conversation:', err);
      if (context?.previousConversations) {
        setConversations(context.previousConversations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });

  // Star mutation
  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.starConversation(id, starred),
    onMutate: async ({ id, starred }) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() });
      const previousConversations = conversations;
      // Optimistic update with sort
      setConversations(prev => {
        const updated = prev.map(conv =>
          conv.id === id ? { ...conv, is_starred: starred } : conv
        );
        return updated.sort((a, b) => {
          if (a.is_starred && !b.is_starred) return -1;
          if (!a.is_starred && b.is_starred) return 1;
          return (b.message_count || 0) - (a.message_count || 0);
        });
      });
      return { previousConversations };
    },
    onError: (err, _, context) => {
      log.error('Failed to star conversation:', err);
      if (context?.previousConversations) {
        setConversations(context.previousConversations);
      }
      toast.error("Couldn't update that conversation. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.renameConversation(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() });
      const previousConversations = conversations;
      const previousCurrentConversation = currentConversation;
      // Optimistic update
      setConversations(prev =>
        prev.map(conv => conv.id === id ? { ...conv, title } : conv)
      );
      setCurrentConversation(prev =>
        prev && prev.id === id ? { ...prev, title } : prev
      );
      return { previousConversations, previousCurrentConversation };
    },
    onError: (err, _, context) => {
      log.error('Failed to rename conversation:', err);
      if (context?.previousConversations) {
        setConversations(context.previousConversations);
      }
      if (context?.previousCurrentConversation) {
        setCurrentConversation(context.previousCurrentConversation);
      }
      toast.error("Couldn't rename that conversation. Please try again.");
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id) });
    },
  });

  // Delete mutation (with undo support)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onError: (err) => {
      log.error('Failed to delete conversation:', err);
      toast.error("Couldn't delete that conversation. Please try again.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });

  // Archive/unarchive a conversation
  const handleArchiveConversation = useCallback(async (id: string, archived: boolean): Promise<void> => {
    archiveMutation.mutate({ id, archived });
  }, [archiveMutation]);

  // Star/unstar a conversation
  const handleStarConversation = useCallback(async (id: string, starred: boolean): Promise<void> => {
    starMutation.mutate({ id, starred });
  }, [starMutation]);

  // Delete a conversation with undo
  const handleDeleteConversation = useCallback(async (id: string): Promise<void> => {
    const conversationToDelete = conversations.find(c => c.id === id);
    if (!conversationToDelete) return;

    const originalIndex = conversations.findIndex(c => c.id === id);
    const wasCurrentConversation = currentConversationId === id;

    // Optimistic removal (local state)
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (wasCurrentConversation) {
      setCurrentConversation(null);
      setCurrentConversationId(null);
    }

    let undoClicked = false;

    const executeDelete = () => {
      if (!undoClicked) {
        deleteMutation.mutate(id);
      }
    };

    toast('Conversation deleted', {
      description: conversationToDelete.title || 'New Conversation',
      action: {
        label: 'Undo',
        onClick: () => {
          undoClicked = true;
          setConversations(prev => {
            const newList = [...prev];
            newList.splice(originalIndex, 0, conversationToDelete);
            return newList;
          });
          if (wasCurrentConversation) {
            setCurrentConversationId(id);
          }
          toast.success('Conversation restored');
        },
      },
      duration: 5000,
      onDismiss: executeDelete,
      onAutoClose: executeDelete,
    });
  }, [conversations, currentConversationId, deleteMutation]);

  // Rename a conversation
  const handleRenameConversation = useCallback(async (id: string, title: string): Promise<void> => {
    renameMutation.mutate({ id, title });
  }, [renameMutation]);

  // Stop generation
  const handleStopGeneration = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);

      setCurrentConversation(prev => {
        if (!prev?.messages?.length) return prev;
        const messages = [...prev.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.loading) {
          lastMsg.loading = { stage1: false, stage2: false, stage3: false };
          lastMsg.stopped = true;
        }
        return { ...prev, messages };
      });
    }
  }, []);

  // Refresh conversations - invalidate cache to force refetch
  const refreshConversations = useCallback(async (): Promise<void> => {
    setPaginationOffset(0);
    await queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
  }, [queryClient]);

  // Change sort order
  const handleSortByChange = useCallback((newSort: ConversationSortBy): void => {
    setPaginationOffset(0);
    setConversationSortBy(newSort);
    // Query will automatically refetch due to queryKey change
  }, []);

  // Memoize state value - changes when data changes
  const stateValue = useMemo<ConversationStateValue>(() => ({
    conversations,
    hasMoreConversations,
    conversationSortBy,
    currentConversationId,
    currentConversation,
    isLoadingConversation,
    isLoading,
  }), [
    conversations,
    hasMoreConversations,
    conversationSortBy,
    currentConversationId,
    currentConversation,
    isLoadingConversation,
    isLoading,
  ]);

  // Memoize actions value - STABLE reference, never changes
  // React guarantees useState setters are stable, refs are stable objects
  const actionsValue = useMemo<ConversationActionsValue>(() => ({
    skipNextLoadRef,
    abortControllerRef,
    setConversations,
    setCurrentConversation,
    setCurrentConversationId,
    setIsLoading,
    loadConversations,
    loadConversation,
    handleNewConversation,
    handleSelectConversation,
    handleArchiveConversation,
    handleStarConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleStopGeneration,
    refreshConversations,
    handleSortByChange,
  }), [
    // Note: useState setters and refs are stable by React guarantee
    // Only include callbacks that might change
    loadConversations,
    loadConversation,
    handleNewConversation,
    handleSelectConversation,
    handleArchiveConversation,
    handleStarConversation,
    handleDeleteConversation,
    handleRenameConversation,
    handleStopGeneration,
    refreshConversations,
    handleSortByChange,
  ]);

  return (
    <ConversationActionsContext.Provider value={actionsValue}>
      <ConversationStateContext.Provider value={stateValue}>
        {children}
      </ConversationStateContext.Provider>
    </ConversationActionsContext.Provider>
  );
}
