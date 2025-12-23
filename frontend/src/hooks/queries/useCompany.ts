import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

export const companyKeys = {
  all: ['company'] as const,
  departments: (companyId: string) => [...companyKeys.all, companyId, 'departments'] as const,
  roles: (companyId: string) => [...companyKeys.all, companyId, 'roles'] as const,
  playbooks: (companyId: string) => [...companyKeys.all, companyId, 'playbooks'] as const,
  projects: (companyId: string) => [...companyKeys.all, companyId, 'projects'] as const,
  decisions: (companyId: string) => [...companyKeys.all, companyId, 'decisions'] as const,
  members: (companyId: string) => [...companyKeys.all, companyId, 'members'] as const,
  context: (companyId: string) => [...companyKeys.all, companyId, 'context'] as const,
};

// Departments
export function useDepartments(companyId: string) {
  return useQuery({
    queryKey: companyKeys.departments(companyId),
    queryFn: () => api.getDepartments(companyId),
    enabled: !!companyId,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Record<string, unknown> }) =>
      api.createDepartment(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.departments(companyId) });
    },
  });
}

// Roles
export function useRoles(companyId: string) {
  return useQuery({
    queryKey: companyKeys.roles(companyId),
    queryFn: () => api.getRoles(companyId),
    enabled: !!companyId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Record<string, unknown> }) =>
      api.createRole(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.roles(companyId) });
    },
  });
}

// Playbooks
export function usePlaybooks(companyId: string) {
  return useQuery({
    queryKey: companyKeys.playbooks(companyId),
    queryFn: () => api.getPlaybooks(companyId),
    enabled: !!companyId,
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Record<string, unknown> }) =>
      api.createPlaybook(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.playbooks(companyId) });
    },
  });
}

// Projects
export function useProjects(companyId: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...companyKeys.projects(companyId), filters],
    queryFn: () => api.listProjects(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Record<string, unknown> }) =>
      api.createProject(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.projects(companyId) });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      companyId,
      projectId,
      data,
    }: {
      companyId: string;
      projectId: string;
      data: Record<string, unknown>;
    }) => api.updateProject(companyId, projectId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.projects(companyId) });
    },
  });
}

// Decisions
export function useDecisions(companyId: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...companyKeys.decisions(companyId), filters],
    queryFn: () => api.listDecisions(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCreateDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: Record<string, unknown> }) =>
      api.createDecision(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.decisions(companyId) });
    },
  });
}

// Members
export function useMembers(companyId: string) {
  return useQuery({
    queryKey: companyKeys.members(companyId),
    queryFn: () => api.getMembers(companyId),
    enabled: !!companyId,
  });
}

// Company Context
export function useCompanyContext(companyId: string) {
  return useQuery({
    queryKey: companyKeys.context(companyId),
    queryFn: () => api.getCompanyContext(companyId),
    enabled: !!companyId,
  });
}

export function useUpdateCompanyContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, context }: { companyId: string; context: string }) =>
      api.updateCompanyContext(companyId, context),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.context(companyId) });
    },
  });
}
