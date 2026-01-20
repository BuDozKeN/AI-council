import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import type { Department, Playbook, Project } from '../../types/business';

// =============================================================================
// Type Definitions for API Responses
// =============================================================================

interface TeamResponse {
  departments: Department[];
}

interface PlaybooksResponse {
  playbooks: Playbook[];
}

interface ProjectsResponse {
  projects: Project[];
}

interface DecisionsResponse {
  decisions: Array<{
    id: string;
    title: string;
    content: string;
    department_id?: string;
    project_id?: string;
    source_conversation_id?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
  }>;
}

interface MembersResponse {
  members: Array<{
    id: string;
    email: string;
    name?: string;
    role: string;
    joined_at: string;
  }>;
}

interface CompanyOverviewResponse {
  company: {
    id: string;
    name: string;
    description?: string;
    context_md?: string;
  };
  stats: {
    departments: number;
    roles: number;
    playbooks: number;
    decisions: number;
    projects: number;
  };
}

// Input types for mutations
interface CreateDepartmentInput {
  slug?: string;
  name: string;
  description?: string;
}

interface CreateRoleInput {
  departmentId: string;
  slug?: string;
  name: string;
  responsibilities?: string;
}

interface CreatePlaybookInput {
  title: string;
  doc_type: string;
  content?: string;
  department_id?: string;
  department_ids?: string[] | null;
}

interface CreateProjectInput {
  name: string;
  description?: string;
  context_md?: string;
}

interface UpdateProjectInput {
  name?: string;
  description?: string;
  context_md?: string;
  status?: 'active' | 'completed' | 'archived';
}

interface CreateDecisionInput {
  title: string;
  content: string;
  department_id?: string;
  project_id?: string;
  source_conversation_id?: string;
  tags?: string[];
}

// =============================================================================
// Query Keys
// =============================================================================

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

// =============================================================================
// Department Hooks
// =============================================================================

/**
 * Fetch team structure (departments with roles) for a company.
 * Uses getCompanyTeam which returns { departments: [...] }
 */
export function useDepartments(companyId: string) {
  return useQuery<TeamResponse>({
    queryKey: companyKeys.departments(companyId),
    queryFn: () => api.getCompanyTeam(companyId),
    enabled: !!companyId,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreateDepartmentInput }) =>
      api.createCompanyDepartment(companyId, {
        name: data.name,
        slug: data.slug,
        description: data.description,
      }),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.departments(companyId) });
    },
  });
}

// =============================================================================
// Role Hooks
// =============================================================================

/**
 * Roles are included in the team structure response.
 * This hook is an alias to useDepartments for semantic clarity.
 */
export function useRoles(companyId: string) {
  return useQuery<TeamResponse>({
    queryKey: companyKeys.roles(companyId),
    queryFn: () => api.getCompanyTeam(companyId),
    enabled: !!companyId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreateRoleInput }) =>
      api.createCompanyRole(companyId, data.departmentId, {
        name: data.name,
        slug: data.slug,
        responsibilities: data.responsibilities,
      }),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.roles(companyId) });
      queryClient.invalidateQueries({ queryKey: companyKeys.departments(companyId) });
    },
  });
}

// =============================================================================
// Playbook Hooks
// =============================================================================

export function usePlaybooks(companyId: string) {
  return useQuery<PlaybooksResponse>({
    queryKey: companyKeys.playbooks(companyId),
    queryFn: () => api.getCompanyPlaybooks(companyId),
    enabled: !!companyId,
  });
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreatePlaybookInput }) =>
      api.createCompanyPlaybook(companyId, {
        title: data.title,
        doc_type: data.doc_type,
        content: data.content,
        department_id: data.department_id,
        department_ids: data.department_ids,
      }),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.playbooks(companyId) });
    },
  });
}

// =============================================================================
// Project Hooks
// =============================================================================

export function useProjects(companyId: string) {
  return useQuery<ProjectsResponse>({
    queryKey: companyKeys.projects(companyId),
    queryFn: () => api.listProjects(companyId),
    enabled: !!companyId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreateProjectInput }) =>
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
      projectId,
      data,
    }: {
      companyId: string;
      projectId: string;
      data: UpdateProjectInput;
    }) => api.updateProject(projectId, data as Record<string, unknown>),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.projects(variables.companyId) });
    },
  });
}

// =============================================================================
// Decision Hooks
// =============================================================================

export function useDecisions(companyId: string) {
  return useQuery<DecisionsResponse>({
    queryKey: companyKeys.decisions(companyId),
    queryFn: () => api.getCompanyDecisions(companyId),
    enabled: !!companyId,
  });
}

export function useCreateDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, data }: { companyId: string; data: CreateDecisionInput }) =>
      api.createCompanyDecision(companyId, data),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.decisions(companyId) });
    },
  });
}

// =============================================================================
// Member Hooks
// =============================================================================

export function useMembers(companyId: string) {
  return useQuery<MembersResponse>({
    queryKey: companyKeys.members(companyId),
    queryFn: () => api.getCompanyMembers(companyId),
    enabled: !!companyId,
  });
}

// =============================================================================
// Company Context Hooks
// =============================================================================

/**
 * Fetch company overview which includes context_md.
 */
export function useCompanyContext(companyId: string) {
  return useQuery<CompanyOverviewResponse>({
    queryKey: companyKeys.context(companyId),
    queryFn: () => api.getCompanyOverview(companyId),
    enabled: !!companyId,
  });
}

export function useUpdateCompanyContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, context }: { companyId: string; context: string }) =>
      api.updateCompanyContext(companyId, { context_md: context }),
    onSuccess: (_, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.context(companyId) });
    },
  });
}
