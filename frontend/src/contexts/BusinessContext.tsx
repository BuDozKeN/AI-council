/* eslint-disable react-refresh/only-export-components -- Context pattern exports both Provider and hook */
/**
 * BusinessContext - Manages all business/company-related state
 *
 * Now powered by TanStack Query for:
 * - Automatic caching of businesses, projects, and playbooks
 * - Background refetching when data becomes stale
 * - DevTools inspection of all queries
 *
 * State managed:
 * - businesses list and selected business
 * - departments (single and multi-select)
 * - roles (single and multi-select)
 * - playbooks
 * - projects
 * - styles and channels
 * - context toggles (useCompanyContext, useDepartmentContext)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { userPreferencesApi } from '../supabase';
import { useAuth } from '../AuthContext';
import { logger } from '../utils/logger';
import type { Business, Department, Role, Channel, Style, Playbook, Project, UserPreferences } from '../types';

// Query key factory for consistent cache management
export const businessKeys = {
  all: ['businesses'] as const,
  list: () => [...businessKeys.all, 'list'] as const,
  detail: (id: string) => [...businessKeys.all, 'detail', id] as const,
  projects: (companyId: string) => [...businessKeys.all, companyId, 'projects'] as const,
  playbooks: (companyId: string) => [...businessKeys.all, companyId, 'playbooks'] as const,
};

const log = logger.scope('BusinessContext');

// Default departments when no company is selected or company has no departments
// Note: For default departments, id and slug are the same (slug-based identifiers)
const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'standard', slug: 'standard', name: 'Standard', description: 'General advisory council' },
];

// State values - these change and trigger re-renders
interface BusinessStateValue {
  businesses: Business[];
  selectedBusiness: string | null;
  currentBusiness: Business | null;
  selectedDepartment: string | null;
  selectedRole: string | null;
  selectedChannel: string | null;
  selectedStyle: string | null;
  selectedDepartments: string[];
  selectedRoles: string[];
  availablePlaybooks: Playbook[];
  selectedPlaybooks: string[];
  projects: Project[];
  selectedProject: string | null;
  useCompanyContext: boolean;
  useDepartmentContext: boolean;
  userPreferences: UserPreferences | null;
  isLoading: boolean;
  // Derived values
  availableDepartments: Department[];
  availableRoles: Role[];
  allRoles: Role[];
  availableChannels: Channel[];
  availableStyles: Style[];
}

// Actions - these are stable and never cause re-renders
interface BusinessActionsValue {
  setSelectedBusiness: (id: string | null) => void;
  setSelectedDepartment: (id: string | null) => void;
  setSelectedRole: (id: string | null) => void;
  setSelectedChannel: (id: string | null) => void;
  setSelectedStyle: (id: string | null) => void;
  setSelectedDepartments: (ids: string[]) => void;
  setSelectedRoles: (ids: string[]) => void;
  setSelectedPlaybooks: (ids: string[]) => void;
  setSelectedProject: (id: string | null) => void;
  setUseCompanyContext: (value: boolean) => void;
  setUseDepartmentContext: (value: boolean) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  loadBusinesses: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshPlaybooks: () => Promise<void>;
}

// Split contexts: Actions are stable (never cause re-renders), State changes trigger re-renders
// This pattern prevents re-renders in components that only need actions
const BusinessStateContext = createContext<BusinessStateValue>({} as BusinessStateValue);
const BusinessActionsContext = createContext<BusinessActionsValue>({} as BusinessActionsValue);

// Convenience hook for components that need everything (backwards compatible)
export const useBusiness = () => {
  const state = useContext(BusinessStateContext);
  const actions = useContext(BusinessActionsContext);
  return { ...state, ...actions };
};

// Granular hooks for optimized components
export const useBusinessState = () => useContext(BusinessStateContext);
export const useBusinessActions = () => useContext(BusinessActionsContext);

interface BusinessProviderProps {
  children: ReactNode;
}

export function BusinessProvider({ children }: BusinessProviderProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Core business state (selectedBusiness is local UI state)
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  // Legacy single-select (for backwards compatibility)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // Multi-select support
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Playbook selections (local state)
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<string[]>([]);

  // Project selections (local state)
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Context toggles
  const [useCompanyContext, setUseCompanyContext] = useState(true);
  const [useDepartmentContext, setUseDepartmentContext] = useState(true);

  // User preferences for Smart Auto
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Track initial data load
  const hasLoadedInitialData = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Query: Businesses List
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    data: businesses = [],
    isLoading: isLoadingBusinesses,
    error: businessesError,
  } = useQuery({
    queryKey: businessKeys.list(),
    queryFn: () => api.listBusinesses(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Log errors
  useEffect(() => {
    if (businessesError) {
      log.error('Failed to load businesses:', businessesError);
    }
  }, [businessesError]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Query: Projects for selected business
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    data: projectsData,
    error: projectsError,
  } = useQuery({
    queryKey: businessKeys.projects(selectedBusiness || ''),
    queryFn: () => api.listProjects(selectedBusiness!),
    enabled: !!selectedBusiness,
    staleTime: 1000 * 60 * 5,
  });

  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (projectsError) {
      log.error('Failed to load projects:', projectsError);
    }
  }, [projectsError]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TanStack Query: Playbooks for selected business
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    data: playbooksData,
    error: playbooksError,
  } = useQuery({
    queryKey: businessKeys.playbooks(selectedBusiness || ''),
    queryFn: () => api.getCompanyPlaybooks(selectedBusiness!),
    enabled: !!selectedBusiness,
    staleTime: 1000 * 60 * 5,
  });

  const availablePlaybooks = playbooksData?.playbooks || [];

  useEffect(() => {
    if (playbooksError) {
      log.error('Failed to load playbooks:', playbooksError);
    }
  }, [playbooksError]);

  // Combined loading state
  const isLoading = isLoadingBusinesses;

  // Setter for projects (needed by some components that modify projects locally before cache invalidates)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setProjects = useCallback((_updater: Project[] | ((prev: Project[]) => Project[])) => {
    // This is a no-op now since projects come from TanStack Query
    // Components should call refreshProjects() instead
    log.debug('setProjects called - use refreshProjects() instead for cache invalidation');
  }, []);

  // Get the currently selected business object
  const currentBusiness = useMemo(() => {
    return businesses.find((b: Business) => b.id === selectedBusiness) ?? null;
  }, [businesses, selectedBusiness]);

  // Get departments for the selected company
  const availableDepartments = useMemo(() => {
    if (!currentBusiness?.departments?.length) {
      return DEFAULT_DEPARTMENTS;
    }
    return currentBusiness.departments;
  }, [currentBusiness]);

  // Get roles for the selected department (legacy single-select)
  const availableRoles = useMemo(() => {
    if (!selectedDepartment || !availableDepartments) return [];
    const dept = availableDepartments.find((d: Department) => d.id === selectedDepartment);
    return dept?.roles ?? [];
  }, [availableDepartments, selectedDepartment]);

  // Get ALL roles from all departments (for multi-select)
  const allRoles = useMemo(() => {
    if (!availableDepartments) return [];
    const roles = [];
    for (const dept of availableDepartments) {
      if (dept.roles) {
        for (const role of dept.roles) {
          roles.push({
            ...role,
            departmentId: dept.id,
            departmentName: dept.name,
          });
        }
      }
    }
    return roles;
  }, [availableDepartments]);

  // Get channels for the selected department
  const availableChannels = useMemo(() => {
    if (!selectedDepartment || !availableDepartments) return [];
    const dept = availableDepartments.find((d: Department) => d.id === selectedDepartment);
    return dept?.channels ?? [];
  }, [availableDepartments, selectedDepartment]);

  // Get styles for the selected company
  const availableStyles = useMemo(() => {
    if (!currentBusiness?.styles) return [];
    return currentBusiness.styles;
  }, [currentBusiness]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Initial Load: Apply user preferences when businesses load
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (businesses.length > 0 && !hasLoadedInitialData.current) {
      // Load user preferences and apply them
      userPreferencesApi.get().then(prefs => {
        setUserPreferences(prefs);

        if (prefs?.last_company_id && businesses.some((b: Business) => b.id === prefs.last_company_id)) {
          setSelectedBusiness(prefs.last_company_id);
          if ((prefs.last_department_ids?.length ?? 0) > 0) {
            setSelectedDepartments(prefs.last_department_ids ?? []);
          }
          if ((prefs.last_role_ids?.length ?? 0) > 0) {
            setSelectedRoles(prefs.last_role_ids ?? []);
          }
          if (prefs.last_project_id) {
            setSelectedProject(prefs.last_project_id);
          }
          if ((prefs.last_playbook_ids?.length ?? 0) > 0) {
            setSelectedPlaybooks(prefs.last_playbook_ids ?? []);
          }
        } else {
          setSelectedBusiness(businesses[0].id);
        }

        hasLoadedInitialData.current = true;
      });
    }
  }, [businesses]);

  // Load businesses - now just invalidates cache (TanStack handles the rest)
  const loadBusinesses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: businessKeys.list() });
  }, [queryClient]);

  // Reset selections when business changes
  const prevBusinessRef = useRef<string | null>(selectedBusiness);
  useEffect(() => {
    const businessChanged = prevBusinessRef.current !== selectedBusiness;
    prevBusinessRef.current = selectedBusiness;

    if (businessChanged && selectedBusiness !== null) {
      // Reset selections when business changes
      setSelectedDepartment(null);
      setSelectedChannel(null);
      setSelectedStyle(null);
      setSelectedProject(null);
      setSelectedPlaybooks([]);
    }
  }, [selectedBusiness]);

  // Validate selectedProject when projects change
  useEffect(() => {
    if (projects.length > 0 && selectedProject) {
      const projectExists = projects.some((p: Project) => p.id === selectedProject);
      if (!projectExists) {
        log.debug('Clearing selectedProject - project no longer exists:', selectedProject);
        setSelectedProject(null);
      }
    }
  }, [projects, selectedProject]);

  // Reset role and channel when department changes
  const prevDepartmentRef = useRef<string | null>(selectedDepartment);
  useEffect(() => {
    const departmentChanged = prevDepartmentRef.current !== selectedDepartment;
    prevDepartmentRef.current = selectedDepartment;

    if (departmentChanged && selectedDepartment !== null) {
      setSelectedRole(null);
      setSelectedChannel(null);
    }
  }, [selectedDepartment]);

  // Save context preferences when they change (debounced)
  const savePrefsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !hasLoadedInitialData.current || !selectedBusiness) return;

    if (savePrefsTimeoutRef.current) {
      clearTimeout(savePrefsTimeoutRef.current);
    }

    savePrefsTimeoutRef.current = setTimeout(() => {
      userPreferencesApi.saveLastUsed({
        companyId: selectedBusiness,
        departmentIds: selectedDepartments,
        roleIds: selectedRoles,
        projectId: selectedProject,
        playbookIds: selectedPlaybooks,
      }).then((saved) => {
        if (saved) {
          setUserPreferences(saved);
        }
      });
    }, 1000);

    return () => {
      if (savePrefsTimeoutRef.current) {
        clearTimeout(savePrefsTimeoutRef.current);
      }
    };
  }, [isAuthenticated, selectedBusiness, selectedDepartments, selectedRoles, selectedProject, selectedPlaybooks]);

  // Refresh projects - invalidate TanStack cache
  const refreshProjects = useCallback(async () => {
    if (!selectedBusiness) return;
    await queryClient.invalidateQueries({ queryKey: businessKeys.projects(selectedBusiness) });
  }, [selectedBusiness, queryClient]);

  // Refresh playbooks - invalidate TanStack cache
  const refreshPlaybooks = useCallback(async () => {
    if (!selectedBusiness) return;
    await queryClient.invalidateQueries({ queryKey: businessKeys.playbooks(selectedBusiness) });
  }, [selectedBusiness, queryClient]);

  // Memoize state value - changes when data changes
  const stateValue = useMemo<BusinessStateValue>(() => ({
    businesses,
    selectedBusiness,
    currentBusiness,
    selectedDepartment,
    selectedRole,
    selectedChannel,
    selectedStyle,
    selectedDepartments,
    selectedRoles,
    availablePlaybooks,
    selectedPlaybooks,
    projects,
    selectedProject,
    useCompanyContext,
    useDepartmentContext,
    userPreferences,
    isLoading,
    availableDepartments,
    availableRoles,
    allRoles,
    availableChannels,
    availableStyles,
  }), [
    businesses,
    selectedBusiness,
    currentBusiness,
    selectedDepartment,
    selectedRole,
    selectedChannel,
    selectedStyle,
    selectedDepartments,
    selectedRoles,
    availablePlaybooks,
    selectedPlaybooks,
    projects,
    selectedProject,
    useCompanyContext,
    useDepartmentContext,
    userPreferences,
    isLoading,
    availableDepartments,
    availableRoles,
    allRoles,
    availableChannels,
    availableStyles,
  ]);

  // Memoize actions value - STABLE reference, never changes
  // React guarantees useState setters are stable, and our callbacks use useCallback
  const actionsValue = useMemo<BusinessActionsValue>(() => ({
    setSelectedBusiness,
    setSelectedDepartment,
    setSelectedRole,
    setSelectedChannel,
    setSelectedStyle,
    setSelectedDepartments,
    setSelectedRoles,
    setSelectedPlaybooks,
    setSelectedProject,
    setUseCompanyContext,
    setUseDepartmentContext,
    setProjects,
    loadBusinesses,
    refreshProjects,
    refreshPlaybooks,
  }), [
    // Note: useState setters are stable by React guarantee
    // Only include callbacks that might change
    setProjects,
    loadBusinesses,
    refreshProjects,
    refreshPlaybooks,
  ]);

  return (
    <BusinessActionsContext.Provider value={actionsValue}>
      <BusinessStateContext.Provider value={stateValue}>
        {children}
      </BusinessStateContext.Provider>
    </BusinessActionsContext.Provider>
  );
}
