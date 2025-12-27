import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api';

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (id: string) => [...conversationKeys.detail(id), 'messages'] as const,
};

interface ListConversationsParams {
  limit?: number;
  search?: string;
  includeArchived?: boolean;
  sortBy?: 'date' | 'activity';
  companyId?: string | null;
}

export function useConversations(params: ListConversationsParams = {}) {
  return useQuery({
    queryKey: conversationKeys.list(params as Record<string, unknown>),
    queryFn: () => api.listConversations(params),
  });
}

export function useInfiniteConversations(params: Omit<ListConversationsParams, 'offset'> = {}) {
  return useInfiniteQuery({
    queryKey: conversationKeys.list({ ...params, infinite: true }),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      api.listConversations({ ...params, offset: pageParam, limit: params.limit ?? 20 }),
    getNextPageParam: (lastPage: { has_more: boolean }, allPages: unknown[]) => {
      if (!lastPage.has_more) return undefined;
      return allPages.length * (params.limit ?? 20);
    },
    initialPageParam: 0,
  });
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: () => api.getConversation(conversationId),
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string | null = null) => api.createConversation(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

interface RenameConversationVariables {
  conversationId: string;
  title: string;
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, title }: RenameConversationVariables) =>
      api.renameConversation(conversationId, title),
    onSuccess: (_: unknown, { conversationId }: RenameConversationVariables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => api.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useStarConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, starred }: { conversationId: string; starred: boolean }) =>
      api.starConversation(conversationId, starred),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, archived }: { conversationId: string; archived: boolean }) =>
      api.archiveConversation(conversationId, archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}
