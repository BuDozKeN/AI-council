/**
 * Tests for useConversations hook
 */

import React from 'react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversations, useConversation } from './useConversations';
import { server, mockConversations, mockConversationDetail } from '../../test/mocks';

// Setup MSW server for this test file
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('useConversations', () => {
  it('should fetch conversations list', async () => {
    const { result } = renderHook(() => useConversations(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have mock data
    expect(result.current.data?.conversations).toHaveLength(mockConversations.length);
    expect(result.current.data?.conversations[0].title).toBe('Test Conversation 1');
  });

  it('should filter conversations by search query', async () => {
    const { result } = renderHook(
      () => useConversations({ search: 'Another' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should only return matching conversations
    expect(result.current.data?.conversations).toHaveLength(1);
    expect(result.current.data?.conversations[0].title).toBe('Another Conversation');
  });
});

describe('useConversation', () => {
  it('should fetch single conversation with messages', async () => {
    const { result } = renderHook(() => useConversation('conv-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('conv-1');
    expect(result.current.data?.messages).toHaveLength(mockConversationDetail.messages.length);
  });

  it('should not fetch when conversationId is empty', async () => {
    const { result } = renderHook(() => useConversation(''), {
      wrapper: createWrapper(),
    });

    // Should not be loading because query is disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });
});
