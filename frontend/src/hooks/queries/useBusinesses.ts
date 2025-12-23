import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

export const businessKeys = {
  all: ['businesses'] as const,
  lists: () => [...businessKeys.all, 'list'] as const,
  list: () => [...businessKeys.lists()] as const,
  details: () => [...businessKeys.all, 'detail'] as const,
  detail: (id: string) => [...businessKeys.details(), id] as const,
};

export function useBusinesses() {
  return useQuery({
    queryKey: businessKeys.list(),
    queryFn: () => api.listBusinesses(),
  });
}

export function useBusiness(businessId: string) {
  return useQuery({
    queryKey: businessKeys.detail(businessId),
    queryFn: () => api.getBusiness(businessId),
    enabled: !!businessId,
  });
}

export function useCreateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) => api.createBusiness(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: businessKeys.lists() });
    },
  });
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, data }: { businessId: string; data: Record<string, unknown> }) =>
      api.updateBusiness(businessId, data),
    onSuccess: (_, { businessId }) => {
      queryClient.invalidateQueries({ queryKey: businessKeys.detail(businessId) });
      queryClient.invalidateQueries({ queryKey: businessKeys.lists() });
    },
  });
}
