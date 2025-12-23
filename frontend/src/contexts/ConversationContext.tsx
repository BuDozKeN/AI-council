/* eslint-disable react-refresh/only-export-components -- Context pattern exports both Provider and hook */
/**
 * ConversationContext - Manages conversation list and current conversation state
 *
 * Extracted from App.jsx to reduce prop drilling.
 *
 * Note: The streaming message handlers (handleSendMessage, handleSendToCouncil)
 * remain in App.jsx for now due to their complexity and tight integration with
 * business context. These can be migrated later.
 *
 * State managed:
 * - conversations list
 * - current conversation
 * - loading states
 * - sort/filter options
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';
import { toast } from '../components/ui/sonner';
import { PAGINATION } from '../constants';
import type { Conversation, ConversationSortBy, LoadingState } from '../types';

const log = logger.scope('ConversationContext');

interface LoadConversationsOptions {
  limit?: number;
  offset?: number;
  sortBy?: ConversationSortBy;
  company_id?: string;
  include_archived?: boolean;
}

interface ConversationContextValue {
  // State
  conversations: Conversation[];
  hasMoreConversations: boolean;
  conversationSortBy: ConversationSortBy;
  currentConversationId: string | null;
  currentConversation: Conversation | null;
  isLoadingConversation: boolean;
  isLoading: boolean;

  // Refs (for external access)
  skipNextLoadRef: MutableRefObject<boolean>;
  abortControllerRef: MutableRefObject<AbortController | null>;

  // Setters (for streaming handlers in App.jsx)
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setCurrentConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
  setCurrentConversationId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoadingConversation: React.Dispatch<React.SetStateAction<boolean>>;

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

const ConversationContext = createContext<ConversationContextValue>({} as ConversationContextValue);

export const useConversation = () => useContext(ConversationContext);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(true);
  const [conversationSortBy, setConversationSortBy] = useState<ConversationSortBy>('date');

  // Current conversation state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState<boolean>(false);

  // General loading state (for streaming)
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Ref to skip loading when transitioning from temp to real
  const skipNextLoadRef = useRef<boolean>(false);

  // Abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations with pagination and filtering
  const loadConversations = useCallback(async (options: LoadConversationsOptions = {}): Promise<Conversation[]> => {
    try {
      const limit = options.limit || PAGINATION.CONVERSATIONS_PAGE_SIZE;
      const sortBy = options.sortBy || conversationSortBy;
      const result = await api.listConversations({ ...options, limit, sortBy });

      const convs: Conversation[] = result.conversations || result;
      const hasMore = result.has_more !== undefined ? result.has_more : convs.length >= limit;

      if (options.offset && options.offset > 0) {
        // Append to existing (Load More) with deduplication
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newConvs = convs.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConvs];
        });
      } else {
        setConversations(convs);
      }

      setHasMoreConversations(hasMore);
      return convs;
    } catch (error) {
      log.error('Failed to load conversations:', error);
      return [];
    }
  }, [conversationSortBy]);

  // Load a single conversation
  const loadConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setIsLoadingConversation(true);
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      log.error('Failed to load conversation:', error);
      setCurrentConversationId(null);
      toast.error('Failed to load conversation');
    } finally {
      setIsLoadingConversation(false);
    }
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
  const handleSelectConversation = useCallback((id: string): void => {
    setIsLoadingConversation(true);
    setCurrentConversation(null);
    setCurrentConversationId(id);
  }, []);

  // Archive/unarchive a conversation
  const handleArchiveConversation = useCallback(async (id: string, archived: boolean): Promise<void> => {
    try {
      await api.archiveConversation(id, archived);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === id ? { ...conv, is_archived: archived } : conv
        )
      );
    } catch (error) {
      log.error('Failed to archive conversation:', error);
    }
  }, []);

  // Star/unstar a conversation
  const handleStarConversation = useCallback(async (id: string, starred: boolean): Promise<void> => {
    // Optimistic update
    setConversations(prev => {
      const updated = prev.map(conv =>
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
      log.error('Failed to star conversation:', error);
      // Revert on error
      setConversations(prev => {
        const reverted = prev.map(conv =>
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

  // Delete a conversation with undo
  const handleDeleteConversation = useCallback(async (id: string): Promise<void> => {
    const conversationToDelete = conversations.find(c => c.id === id);
    if (!conversationToDelete) return;

    const originalIndex = conversations.findIndex(c => c.id === id);
    const wasCurrentConversation = currentConversationId === id;

    // Optimistic removal
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (wasCurrentConversation) {
      setCurrentConversation(null);
      setCurrentConversationId(null);
    }

    let undoClicked = false;

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
      onDismiss: async () => {
        if (!undoClicked) {
          try {
            await api.deleteConversation(id);
          } catch (error) {
            log.error('Failed to delete conversation:', error);
            setConversations(prev => {
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

  // Rename a conversation
  const handleRenameConversation = useCallback(async (id: string, title: string): Promise<void> => {
    try {
      await api.renameConversation(id, title);
      setConversations(prev =>
        prev.map(conv => conv.id === id ? { ...conv, title } : conv)
      );
      setCurrentConversation(prev =>
        prev && prev.id === id ? { ...prev, title } : prev
      );
    } catch (error) {
      log.error('Failed to rename conversation:', error);
    }
  }, []);

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
        if (lastMsg.loading) {
          lastMsg.loading = { stage1: false, stage2: false, stage3: false };
          lastMsg.stopped = true;
        }
        return { ...prev, messages };
      });
    }
  }, []);

  // Refresh conversations
  const refreshConversations = useCallback(async (): Promise<void> => {
    await loadConversations({ offset: 0 });
  }, [loadConversations]);

  // Change sort order
  const handleSortByChange = useCallback((newSort: ConversationSortBy): void => {
    setConversationSortBy(newSort);
    loadConversations({ sortBy: newSort, offset: 0 });
  }, [loadConversations]);

  const value = useMemo((): ConversationContextValue => ({
    // State
    conversations,
    hasMoreConversations,
    conversationSortBy,
    currentConversationId,
    currentConversation,
    isLoadingConversation,
    isLoading,

    // Refs (for external access)
    skipNextLoadRef,
    abortControllerRef,

    // Setters (for streaming handlers in App.jsx)
    setConversations,
    setCurrentConversation,
    setCurrentConversationId,
    setIsLoading,
    setIsLoadingConversation,

    // Actions
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
    conversations,
    hasMoreConversations,
    conversationSortBy,
    currentConversationId,
    currentConversation,
    isLoadingConversation,
    isLoading,
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
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}
