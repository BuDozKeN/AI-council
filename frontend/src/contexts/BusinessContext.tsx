/* eslint-disable react-refresh/only-export-components -- Context pattern exports both Provider and hook */
/**
 * BusinessContext - Manages all business/company-related state
 *
 * Extracted from App.jsx to reduce prop drilling and centralize business logic.
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
import { api } from '../api';
import { userPreferencesApi } from '../supabase';
import { useAuth } from '../AuthContext';
import { logger } from '../utils/logger';
import type { Business, Department, Role, Channel, Style, Playbook, Project, UserPreferences } from '../types';

const log = logger.scope('BusinessContext');

// Default departments when no company is selected or company has no departments
const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'standard', name: 'Standard', description: 'General advisory council' },
];

interface BusinessContextValue {
  // State
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

  // Setters
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

  // Actions
  loadBusinesses: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshPlaybooks: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue>({} as BusinessContextValue);

export const useBusiness = () => useContext(BusinessContext);

interface BusinessProviderProps {
  children: ReactNode;
}

export function BusinessProvider({ children }: BusinessProviderProps) {
  const { isAuthenticated } = useAuth();

  // Core business state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);

  // Legacy single-select (for backwards compatibility)
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  // Multi-select support
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Playbooks
  const [availablePlaybooks, setAvailablePlaybooks] = useState<Playbook[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<string[]>([]);

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Context toggles
  const [useCompanyContext, setUseCompanyContext] = useState(true);
  const [useDepartmentContext, setUseDepartmentContext] = useState(true);

  // User preferences for Smart Auto
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Track initial data load
  const hasLoadedInitialData = useRef(false);

  // Get the currently selected business object
  const currentBusiness = useMemo(() => {
    return businesses.find((b) => b.id === selectedBusiness) || null;
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
    const dept = availableDepartments.find((d) => d.id === selectedDepartment);
    return dept?.roles || [];
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
    const dept = availableDepartments.find((d) => d.id === selectedDepartment);
    return dept?.channels || [];
  }, [availableDepartments, selectedDepartment]);

  // Get styles for the selected company
  const availableStyles = useMemo(() => {
    if (!currentBusiness?.styles) return [];
    return currentBusiness.styles;
  }, [currentBusiness]);

  // Load businesses and user preferences
  const loadBusinesses = useCallback(async () => {
    try {
      setIsLoading(true);
      const bizList = await api.listBusinesses();
      setBusinesses(bizList);

      // Load user preferences for Smart Auto
      const prefs = await userPreferencesApi.get();
      setUserPreferences(prefs);

      // Apply saved preferences or default to first business
      if (prefs?.last_company_id && bizList.some(b => b.id === prefs.last_company_id)) {
        setSelectedBusiness(prefs.last_company_id);
        if (prefs.last_department_ids?.length > 0) {
          setSelectedDepartments(prefs.last_department_ids);
        }
        if (prefs.last_role_ids?.length > 0) {
          setSelectedRoles(prefs.last_role_ids);
        }
        if (prefs.last_project_id) {
          setSelectedProject(prefs.last_project_id);
        }
        if (prefs.last_playbook_ids?.length > 0) {
          setSelectedPlaybooks(prefs.last_playbook_ids);
        }
      } else if (bizList.length > 0) {
        setSelectedBusiness(bizList[0].id);
      }

      hasLoadedInitialData.current = true;
    } catch (error) {
      log.error('Failed to load businesses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load business data when business changes
  const prevBusinessRef = useRef<string | null>(selectedBusiness);
  useEffect(() => {
    const businessChanged = prevBusinessRef.current !== selectedBusiness;
    prevBusinessRef.current = selectedBusiness;

    if (businessChanged) {
      // Reset selections when business changes
      setSelectedDepartment(null);
      setSelectedChannel(null);
      setSelectedStyle(null);
      setSelectedProject(null);
      setProjects([]);
    }

    const loadBusinessData = async () => {
      if (!selectedBusiness) {
        setAvailablePlaybooks([]);
        setSelectedPlaybooks([]);
        return;
      }

      // Load projects and playbooks in parallel
      const [projectsResult, playbooksResult] = await Promise.allSettled([
        api.listProjects(selectedBusiness),
        api.getCompanyPlaybooks(selectedBusiness),
      ]);

      if (projectsResult.status === 'fulfilled') {
        const loadedProjects = projectsResult.value.projects || [];
        setProjects(loadedProjects);
        // Validate selectedProject
        setSelectedProject(prev => {
          if (prev && !loadedProjects.some(p => p.id === prev)) {
            log.debug('Clearing selectedProject - project no longer exists:', prev);
            return null;
          }
          return prev;
        });
      } else {
        log.error('Failed to load projects:', projectsResult.reason);
        setProjects([]);
      }

      if (playbooksResult.status === 'fulfilled') {
        setAvailablePlaybooks(playbooksResult.value.playbooks || []);
        setSelectedPlaybooks([]);
      } else {
        log.error('Failed to load playbooks:', playbooksResult.reason);
        setAvailablePlaybooks([]);
        setSelectedPlaybooks([]);
      }
    };

    loadBusinessData();
  }, [selectedBusiness]);

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

  // Refresh projects (called after project operations)
  const refreshProjects = useCallback(async () => {
    if (!selectedBusiness) return;
    try {
      const result = await api.listProjects(selectedBusiness);
      setProjects(result.projects || []);
    } catch (error) {
      log.error('Failed to refresh projects:', error);
    }
  }, [selectedBusiness]);

  // Refresh playbooks
  const refreshPlaybooks = useCallback(async () => {
    if (!selectedBusiness) return;
    try {
      const result = await api.getCompanyPlaybooks(selectedBusiness);
      setAvailablePlaybooks(result.playbooks || []);
    } catch (error) {
      log.error('Failed to refresh playbooks:', error);
    }
  }, [selectedBusiness]);

  // Memoize context value
  const value = useMemo(() => ({
    // State
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

    // Derived values
    availableDepartments,
    availableRoles,
    allRoles,
    availableChannels,
    availableStyles,

    // Setters
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

    // Actions
    loadBusinesses,
    refreshProjects,
    refreshPlaybooks,
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
    loadBusinesses,
    refreshProjects,
    refreshPlaybooks,
  ]);

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}
