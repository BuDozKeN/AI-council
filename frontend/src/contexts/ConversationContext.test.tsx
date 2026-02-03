/**
 * Tests for ConversationContext
 *
 * Tests the conversation context provider including:
 * - Hook exports and initialization
 * - Conversation creation and selection
 * - Archive, star, delete, rename operations
 * - Pagination and sorting
 * - Stop generation
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  ConversationProvider,
  useConversation,
  useConversationState,
  useConversationActions,
  conversationKeys,
} from './ConversationContext';
import type { Conversation } from '../types';

// Mock the api module
vi.mock('../api', () => ({
  api: {
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    archiveConversation: vi.fn(),
    starConversation: vi.fn(),
    deleteConversation: vi.fn(),
    renameConversation: vi.fn(),
  },
}));

// Mock AuthContext
vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}));

// Mock BusinessContext - provide a selectedBusiness so queries are enabled
vi.mock('./BusinessContext', () => ({
  useBusinessState: vi.fn(() => ({ selectedBusiness: 'company-1' })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    scope: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock toast
vi.mock('../components/ui/sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Create test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConversationProvider>{children}</ConversationProvider>
      </QueryClientProvider>
    );
  };
}

// Mock conversation data
const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'First Conversation',
    created_at: '2024-01-01T00:00:00Z',
    messages: [],
    is_starred: false,
    is_archived: false,
  },
  {
    id: 'conv-2',
    title: 'Second Conversation',
    created_at: '2024-01-02T00:00:00Z',
    messages: [],
    is_starred: true,
    is_archived: false,
  },
  {
    id: 'conv-3',
    title: 'Archived Conversation',
    created_at: '2024-01-03T00:00:00Z',
    messages: [],
    is_starred: false,
    is_archived: true,
  },
];

describe('ConversationContext', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Query key factory', () => {
    it('should generate correct query keys', () => {
      expect(conversationKeys.all).toEqual(['conversations']);
      expect(conversationKeys.lists()).toEqual(['conversations', 'list']);
      expect(conversationKeys.list({ sortBy: 'date' })).toEqual([
        'conversations',
        'list',
        { sortBy: 'date' },
      ]);
      expect(conversationKeys.details()).toEqual(['conversations', 'detail']);
      expect(conversationKeys.detail('123')).toEqual(['conversations', 'detail', '123']);
    });
  });

  describe('Hook exports', () => {
    it('should export useConversation with combined state and actions', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: mockConversations,
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      // Should have state properties
      expect(result.current).toHaveProperty('conversations');
      expect(result.current).toHaveProperty('currentConversationId');
      expect(result.current).toHaveProperty('isLoading');

      // Should have action methods
      expect(typeof result.current.handleNewConversation).toBe('function');
      expect(typeof result.current.handleSelectConversation).toBe('function');
      expect(typeof result.current.handleDeleteConversation).toBe('function');
    });

    it('should export useConversationState with only state', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversationState(), { wrapper: createWrapper() });

      // Should have state properties
      expect(result.current).toHaveProperty('conversations');
      expect(result.current).toHaveProperty('currentConversationId');

      // Should NOT have action methods
      expect(result.current).not.toHaveProperty('handleNewConversation');
    });

    it('should export useConversationActions with only actions', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversationActions(), { wrapper: createWrapper() });

      // Should have action methods
      expect(typeof result.current.handleNewConversation).toBe('function');
      expect(typeof result.current.handleSelectConversation).toBe('function');

      // Should NOT have state properties
      expect(result.current).not.toHaveProperty('conversations');
    });
  });

  describe('Initial state', () => {
    it('should start with no current conversation', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.currentConversationId).toBeNull();
      expect(result.current.currentConversation).toBeNull();
    });

    it('should start with date sort order', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.conversationSortBy).toBe('date');
    });

    it('should start with hasMoreConversations true', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.hasMoreConversations).toBe(true);
    });
  });

  describe('handleNewConversation', () => {
    it('should create a temporary conversation', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      act(() => {
        result.current.handleNewConversation();
      });

      expect(result.current.currentConversationId).toMatch(/^temp-/);
      expect(result.current.currentConversation?.isTemp).toBe(true);
      expect(result.current.currentConversation?.title).toBe('New Conversation');
      expect(result.current.currentConversation?.messages).toEqual([]);
    });
  });

  describe('handleSelectConversation', () => {
    it('should set the current conversation ID', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      act(() => {
        result.current.handleSelectConversation('conv-1');
      });

      expect(result.current.currentConversationId).toBe('conv-1');
    });

    it('should clear current conversation before loading new one', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      // First create a temp conversation
      act(() => {
        result.current.handleNewConversation();
      });

      expect(result.current.currentConversation).not.toBeNull();

      // Now select a different conversation
      act(() => {
        result.current.handleSelectConversation('conv-1');
      });

      // Current conversation should be cleared immediately
      expect(result.current.currentConversation).toBeNull();
    });
  });

  describe('handleStopGeneration', () => {
    it('should abort the current request and set loading to false', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      // Set up an abort controller (simulating active request)
      const mockAbort = vi.fn();
      result.current.abortControllerRef.current = {
        abort: mockAbort,
        signal: new AbortController().signal,
      } as unknown as AbortController;

      // Create a conversation with a loading message
      act(() => {
        result.current.handleNewConversation();
      });

      act(() => {
        result.current.setCurrentConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  {
                    id: 'msg-1',
                    role: 'assistant' as const,
                    loading: { stage1: true, stage2: false, stage3: false },
                  },
                ],
              }
            : prev
        );
        result.current.setIsLoading(true);
      });

      act(() => {
        result.current.handleStopGeneration();
      });

      expect(mockAbort).toHaveBeenCalled();
      expect(result.current.abortControllerRef.current).toBeNull();
    });

    it('should mark the message as stopped', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      // Set up abort controller
      result.current.abortControllerRef.current = new AbortController();

      // Create conversation with loading message
      act(() => {
        result.current.handleNewConversation();
      });

      act(() => {
        result.current.setCurrentConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  {
                    id: 'msg-1',
                    role: 'assistant' as const,
                    loading: { stage1: true, stage2: false, stage3: false },
                  },
                ],
              }
            : prev
        );
      });

      act(() => {
        result.current.handleStopGeneration();
      });

      // Message should be marked as stopped
      const lastMessage = result.current.currentConversation?.messages?.[0];
      expect(lastMessage?.stopped).toBe(true);
      expect(lastMessage?.loading?.stage1).toBe(false);
    });
  });

  describe('Sort order', () => {
    it('should change sort order', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.conversationSortBy).toBe('date');

      act(() => {
        result.current.handleSortByChange('starred');
      });

      expect(result.current.conversationSortBy).toBe('starred');
    });
  });

  describe('Refs', () => {
    it('should expose skipNextLoadRef', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.skipNextLoadRef).toBeDefined();
      expect(result.current.skipNextLoadRef.current).toBe(false);

      // Should be mutable
      act(() => {
        result.current.skipNextLoadRef.current = true;
      });

      expect(result.current.skipNextLoadRef.current).toBe(true);
    });

    it('should expose abortControllerRef', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(result.current.abortControllerRef).toBeDefined();
      expect(result.current.abortControllerRef.current).toBeNull();
    });
  });

  describe('Conversation list management', () => {
    it('should allow setting conversations directly', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      act(() => {
        result.current.setConversations(mockConversations);
      });

      expect(result.current.conversations).toEqual(mockConversations);
    });

    it('should provide loadConversations function', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(typeof result.current.loadConversations).toBe('function');
    });

    it('should provide refreshConversations function', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(typeof result.current.refreshConversations).toBe('function');
    });
  });

  describe('Setters', () => {
    it('should expose setConversations for external updates', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(typeof result.current.setConversations).toBe('function');

      act(() => {
        result.current.setConversations(mockConversations);
      });

      expect(result.current.conversations).toEqual(mockConversations);
    });

    it('should expose setCurrentConversation for streaming updates', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(typeof result.current.setCurrentConversation).toBe('function');

      act(() => {
        result.current.setCurrentConversation(mockConversations[0]);
      });

      expect(result.current.currentConversation).toEqual(mockConversations[0]);
    });

    it('should expose setIsLoading for streaming state', async () => {
      const { api } = await import('../api');
      (api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValue({
        conversations: [],
        has_more: false,
      });

      const { result } = renderHook(() => useConversation(), { wrapper: createWrapper() });

      expect(typeof result.current.setIsLoading).toBe('function');
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });
  });
});
