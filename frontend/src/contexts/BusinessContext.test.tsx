/**
 * Tests for BusinessContext
 *
 * Tests the business context provider including:
 * - Hook exports and initialization
 * - Business selection and switching
 * - Department/role management
 * - Playbook and project selection
 * - Context toggles (useCompanyContext, useDepartmentContext)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  BusinessProvider,
  useBusiness,
  useBusinessState,
  useBusinessActions,
  businessKeys,
} from './BusinessContext';
import type { Business, Department } from '../types';

// Mock the api module
vi.mock('../api', () => ({
  api: {
    listBusinesses: vi.fn(),
    listProjects: vi.fn(),
    getCompanyPlaybooks: vi.fn(),
  },
}));

// Mock userPreferencesApi
vi.mock('../supabase', () => ({
  userPreferencesApi: {
    get: vi.fn().mockResolvedValue(null),
    saveLastUsed: vi.fn().mockResolvedValue(null),
  },
}));

// Mock AuthContext
vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
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
        <BusinessProvider>{children}</BusinessProvider>
      </QueryClientProvider>
    );
  };
}

// Mock business data
const mockDepartments: Department[] = [
  {
    id: 'dept-1',
    slug: 'engineering',
    name: 'Engineering',
    description: 'Engineering department',
    roles: [
      { id: 'role-1', name: 'Developer', system_prompt: 'You are a developer' },
      { id: 'role-2', name: 'Architect', system_prompt: 'You are an architect' },
    ],
    channels: [{ id: 'channel-1', name: 'Slack' }],
  },
  {
    id: 'dept-2',
    slug: 'sales',
    name: 'Sales',
    description: 'Sales department',
    roles: [{ id: 'role-3', name: 'Account Executive', system_prompt: 'You are an AE' }],
  },
];

const mockBusinesses: Business[] = [
  {
    id: 'business-1',
    name: 'Test Company 1',
    slug: 'test-company-1',
    departments: mockDepartments,
    styles: [{ id: 'style-1', name: 'Formal' }],
  },
  {
    id: 'business-2',
    name: 'Test Company 2',
    slug: 'test-company-2',
    departments: [],
  },
];

describe('BusinessContext', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Query key factory', () => {
    it('should generate correct query keys', () => {
      expect(businessKeys.all).toEqual(['businesses']);
      expect(businessKeys.list()).toEqual(['businesses', 'list']);
      expect(businessKeys.detail('123')).toEqual(['businesses', 'detail', '123']);
      expect(businessKeys.projects('company-1')).toEqual(['businesses', 'company-1', 'projects']);
      expect(businessKeys.playbooks('company-1')).toEqual(['businesses', 'company-1', 'playbooks']);
    });
  });

  describe('Hook exports', () => {
    it('should export useBusiness with combined state and actions', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusinesses);
      (api.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue({ projects: [] });
      (api.getCompanyPlaybooks as ReturnType<typeof vi.fn>).mockResolvedValue({ playbooks: [] });

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      // Should have state properties
      expect(result.current).toHaveProperty('businesses');
      expect(result.current).toHaveProperty('selectedBusiness');
      expect(result.current).toHaveProperty('currentBusiness');
      expect(result.current).toHaveProperty('isLoading');

      // Should have action methods
      expect(typeof result.current.setSelectedBusiness).toBe('function');
      expect(typeof result.current.setSelectedDepartment).toBe('function');
      expect(typeof result.current.loadBusinesses).toBe('function');
    });

    it('should export useBusinessState with only state', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusinesses);

      const { result } = renderHook(() => useBusinessState(), { wrapper: createWrapper() });

      // Should have state properties
      expect(result.current).toHaveProperty('businesses');
      expect(result.current).toHaveProperty('selectedBusiness');

      // Should NOT have action methods (they're in the actions context)
      expect(result.current).not.toHaveProperty('setSelectedBusiness');
    });

    it('should export useBusinessActions with only actions', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusinesses);

      const { result } = renderHook(() => useBusinessActions(), { wrapper: createWrapper() });

      // Should have action methods
      expect(typeof result.current.setSelectedBusiness).toBe('function');
      expect(typeof result.current.setSelectedDepartment).toBe('function');

      // Should NOT have state properties
      expect(result.current).not.toHaveProperty('businesses');
    });
  });

  describe('Initial state', () => {
    it('should start with null selected business', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.selectedBusiness).toBeNull();
      expect(result.current.currentBusiness).toBeNull();
    });

    it('should start with default context toggles enabled', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.useCompanyContext).toBe(true);
      expect(result.current.useDepartmentContext).toBe(true);
    });

    it('should provide default departments when no business selected', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.availableDepartments).toHaveLength(1);
      expect(result.current.availableDepartments[0].slug).toBe('standard');
    });
  });

  describe('Business selection', () => {
    it('should update selectedBusiness when setSelectedBusiness is called', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.selectedBusiness).toBeNull();

      // Select a business
      act(() => {
        result.current.setSelectedBusiness('business-1');
      });

      expect(result.current.selectedBusiness).toBe('business-1');
    });

    it('should clear selectedBusiness when set to null', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedBusiness('business-1');
      });

      expect(result.current.selectedBusiness).toBe('business-1');

      act(() => {
        result.current.setSelectedBusiness(null);
      });

      expect(result.current.selectedBusiness).toBeNull();
    });
  });

  describe('Department and role management', () => {
    it('should set selected department', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedDepartment('dept-1');
      });

      expect(result.current.selectedDepartment).toBe('dept-1');
    });

    it('should set selected role', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedRole('role-1');
      });

      expect(result.current.selectedRole).toBe('role-1');
    });

    it('should support multi-select for departments', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedDepartments(['dept-1', 'dept-2']);
      });

      expect(result.current.selectedDepartments).toEqual(['dept-1', 'dept-2']);
    });

    it('should support multi-select for roles', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedRoles(['role-1', 'role-2', 'role-3']);
      });

      expect(result.current.selectedRoles).toEqual(['role-1', 'role-2', 'role-3']);
    });
  });

  describe('Context toggles', () => {
    it('should toggle useCompanyContext', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.useCompanyContext).toBe(true);

      act(() => {
        result.current.setUseCompanyContext(false);
      });

      expect(result.current.useCompanyContext).toBe(false);
    });

    it('should toggle useDepartmentContext', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      expect(result.current.useDepartmentContext).toBe(true);

      act(() => {
        result.current.setUseDepartmentContext(false);
      });

      expect(result.current.useDepartmentContext).toBe(false);
    });
  });

  describe('Playbook selection', () => {
    it('should manage playbook selections', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusinesses);
      (api.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue({ projects: [] });
      (api.getCompanyPlaybooks as ReturnType<typeof vi.fn>).mockResolvedValue({
        playbooks: [
          { id: 'playbook-1', title: 'Sales Playbook' },
          { id: 'playbook-2', title: 'Engineering Playbook' },
        ],
      });

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      // Set selected playbooks
      act(() => {
        result.current.setSelectedPlaybooks(['playbook-1', 'playbook-2']);
      });

      expect(result.current.selectedPlaybooks).toEqual(['playbook-1', 'playbook-2']);
    });
  });

  describe('Project selection', () => {
    it('should manage project selection', async () => {
      const { api } = await import('../api');
      (api.listBusinesses as ReturnType<typeof vi.fn>).mockResolvedValue(mockBusinesses);
      (api.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue({
        projects: [
          { id: 'project-1', name: 'Project Alpha' },
          { id: 'project-2', name: 'Project Beta' },
        ],
      });
      (api.getCompanyPlaybooks as ReturnType<typeof vi.fn>).mockResolvedValue({ playbooks: [] });

      const { result } = renderHook(() => useBusiness(), { wrapper: createWrapper() });

      act(() => {
        result.current.setSelectedProject('project-1');
      });

      expect(result.current.selectedProject).toBe('project-1');
    });
  });
});
