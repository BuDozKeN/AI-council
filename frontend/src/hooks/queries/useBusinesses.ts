import { useQuery } from '@tanstack/react-query';
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

// Note: useBusiness, useCreateBusiness, and useUpdateBusiness hooks were removed
// because the corresponding API methods (getBusiness, createBusiness, updateBusiness) don't exist.
// Use the BusinessContext for business management instead.
