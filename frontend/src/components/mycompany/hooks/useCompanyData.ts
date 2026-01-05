import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Department, Playbook, Project, Decision } from '../../../types';

const log = logger.scope('useCompanyData');

export type MyCompanyTab =
  | 'overview'
  | 'team'
  | 'playbooks'
  | 'decisions'
  | 'activity'
  | 'projects'
  | 'usage';

export interface CompanyOverview {
  company_name: string;
  total_conversations: number;
  total_decisions: number;
  active_projects: number;
  team_members: number;
  [key: string]: unknown;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  user_id?: string;
  user_email?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  // Activity navigation properties
  related_id?: string;
  related_type?: string;
  conversation_id?: string;
  // Display properties
  title?: string;
  action?: string;
  promoted_to_type?: string;
}

interface UseCompanyDataOptions {
  companyId: string | null;
  activeTab: MyCompanyTab;
  activityLimit?: number;
}

/**
 * Hook for managing MyCompany data loading and state
 * Consolidates all data fetching, loading states, and data reset logic
 */
export function useCompanyData({
  companyId,
  activeTab,
  activityLimit = 20,
}: UseCompanyDataOptions) {
  // Data state
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Loading state - start false, only true during actual fetch
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Activity pagination state
  const [activityHasMore, setActivityHasMore] = useState<boolean>(false);

  // Tab-specific loaded flags (to show skeleton until first fetch completes)
  // Using refs to avoid stale closure issues in useCallback
  const loadedRef = useRef({
    overview: false,
    team: false,
    playbooks: false,
    decisions: false,
    projects: false,
    activity: false,
    departments: false,
  });

  // Guard against concurrent loads (prevents multiple skeleton flashes on initial mount)
  const loadingInProgressRef = useRef<string | null>(null);

  // State versions for UI reactivity (isTabLoaded callback depends on these)
  const [overviewLoaded, setOverviewLoaded] = useState<boolean>(false);
  const [teamLoaded, setTeamLoaded] = useState<boolean>(false);
  const [playbooksLoaded, setPlaybooksLoaded] = useState<boolean>(false);
  const [decisionsLoaded, setDecisionsLoaded] = useState<boolean>(false);
  const [projectsLoaded, setProjectsLoaded] = useState<boolean>(false);
  const [activityLoaded, setActivityLoaded] = useState<boolean>(false);

  // Helper to set loaded state (updates both ref and state)
  const setTabLoaded = (tab: MyCompanyTab, value: boolean) => {
    switch (tab) {
      case 'overview':
        loadedRef.current.overview = value;
        setOverviewLoaded(value);
        break;
      case 'team':
        loadedRef.current.team = value;
        setTeamLoaded(value);
        break;
      case 'playbooks':
        loadedRef.current.playbooks = value;
        setPlaybooksLoaded(value);
        break;
      case 'decisions':
        loadedRef.current.decisions = value;
        setDecisionsLoaded(value);
        break;
      case 'projects':
        loadedRef.current.projects = value;
        setProjectsLoaded(value);
        break;
      case 'activity':
        loadedRef.current.activity = value;
        setActivityLoaded(value);
        break;
    }
  };

  // Check if a specific tab is already loaded (uses ref for accurate value in callbacks)
  const isTabAlreadyLoaded = (tab: MyCompanyTab): boolean => {
    switch (tab) {
      case 'overview':
        return loadedRef.current.overview;
      case 'team':
        return loadedRef.current.team;
      case 'playbooks':
        return loadedRef.current.playbooks;
      case 'decisions':
        return loadedRef.current.decisions;
      case 'projects':
        return loadedRef.current.projects;
      case 'activity':
        return loadedRef.current.activity;
      case 'usage':
        return true;
      default:
        return false;
    }
  };

  // Load data based on active tab
  const loadData = useCallback(
    async (forceReload = false) => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      // Skip loading if tab is already loaded (unless force reload)
      // This prevents skeleton flash when switching to already-loaded tabs
      if (!forceReload && isTabAlreadyLoaded(activeTab)) {
        setLoading(false);
        return;
      }

      // Guard against concurrent loads for the same tab
      // This prevents multiple skeleton flashes when React Strict Mode or
      // multiple effects trigger loadData simultaneously
      const loadKey = `${companyId}-${activeTab}`;
      if (loadingInProgressRef.current === loadKey && !forceReload) {
        return; // Already loading this tab
      }
      loadingInProgressRef.current = loadKey;

      setLoading(true);
      setError(null);

      try {
        switch (activeTab) {
          case 'overview': {
            const data = await api.getCompanyOverview(companyId);
            setOverview(data);
            setTabLoaded('overview', true);
            break;
          }
          case 'team': {
            const data = await api.getCompanyTeam(companyId);
            setDepartments(data.departments || []);
            setTabLoaded('team', true);
            break;
          }
          case 'playbooks': {
            // Single API call - departments now embedded in response
            const playbooksData = await api.getCompanyPlaybooks(companyId);
            setPlaybooks(playbooksData.playbooks || []);
            // Use departments from playbooks endpoint
            if (playbooksData.departments) {
              const mappedDepts = playbooksData.departments.map((d: Department) => ({
                ...d,
                roles: [],
              }));
              setDepartments(mappedDepts);
            }
            setTabLoaded('playbooks', true);
            break;
          }
          case 'decisions': {
            // Load decisions and projects in parallel (need projects for Promote modal)
            const [decisionsData, projectsData] = await Promise.all([
              api.getCompanyDecisions(companyId),
              api.listProjectsWithStats(companyId, { includeArchived: true }),
            ]);
            setDecisions(decisionsData.decisions || []);
            setProjects(projectsData.projects || []);
            setTabLoaded('projects', true);
            // Use departments from decisions endpoint (only if not already loaded)
            if (decisionsData.departments && !loadedRef.current.departments) {
              setDepartments(
                decisionsData.departments.map((d: Department) => ({ ...d, roles: [] }))
              );
              loadedRef.current.departments = true;
            }
            setTabLoaded('decisions', true);
            break;
          }
          case 'activity': {
            // Load activity and projects in parallel (need projects for click navigation)
            const [activityData, projectsData] = await Promise.all([
              api.getCompanyActivity(companyId, { limit: activityLimit + 1 }),
              api.listProjectsWithStats(companyId, { includeArchived: true }),
            ]);
            const logs = activityData.logs || [];
            setActivityHasMore(logs.length > activityLimit);
            setActivityLogs(logs.slice(0, activityLimit));
            setProjects(projectsData.projects || []);
            setTabLoaded('projects', true);
            setTabLoaded('activity', true);
            break;
          }
          case 'projects': {
            // Load projects and departments in parallel (needed for project edit modal)
            if (!loadedRef.current.departments) {
              const [projectsData, teamData] = await Promise.all([
                api.listProjectsWithStats(companyId, { includeArchived: true }),
                api.getCompanyTeam(companyId),
              ]);
              setProjects(projectsData.projects || []);
              setDepartments(teamData.departments || []);
              loadedRef.current.departments = true;
            } else {
              const projectsData = await api.listProjectsWithStats(companyId, {
                includeArchived: true,
              });
              setProjects(projectsData.projects || []);
            }
            setTabLoaded('projects', true);
            break;
          }
        }
      } catch (err) {
        log.error(`Failed to load ${activeTab}`, { error: err });
        setError(`Failed to load ${activeTab}`);
      }
      setLoading(false);
      loadingInProgressRef.current = null; // Clear the guard
    },
    // Note: loaded state flags are checked via isTabAlreadyLoaded but not in deps
    // to avoid re-triggering. departmentsLoaded also intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, activeTab, activityLimit]
  );

  // Load data when tab changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset data when company changes
  useEffect(() => {
    setOverview(null);
    setDepartments([]);
    setPlaybooks([]);
    setDecisions([]);
    setActivityLogs([]);
    setProjects([]);
    // Reset all loaded flags (both ref and state) for new company
    loadedRef.current = {
      overview: false,
      team: false,
      playbooks: false,
      decisions: false,
      projects: false,
      activity: false,
      departments: false,
    };
    setOverviewLoaded(false);
    setTeamLoaded(false);
    setPlaybooksLoaded(false);
    setDecisionsLoaded(false);
    setProjectsLoaded(false);
    setActivityLoaded(false);
    // Reset activity pagination
    setActivityHasMore(false);
  }, [companyId]);

  // Reset loaded flag for a specific tab (used by pull-to-refresh)
  const resetTabLoaded = useCallback((tab: MyCompanyTab): void => {
    // Use setTabLoaded to update both ref and state
    setTabLoaded(tab, false);
  }, []);

  // Check if current tab data is loaded
  const isTabLoaded = useCallback(
    (tab: MyCompanyTab): boolean => {
      switch (tab) {
        case 'overview':
          return overviewLoaded;
        case 'team':
          return teamLoaded;
        case 'playbooks':
          return playbooksLoaded;
        case 'decisions':
          return decisionsLoaded;
        case 'projects':
          return projectsLoaded;
        case 'activity':
          return activityLoaded;
        case 'usage':
          return true; // Usage tab manages its own loading state via useUsageData
        default:
          return false;
      }
    },
    [overviewLoaded, teamLoaded, playbooksLoaded, decisionsLoaded, projectsLoaded, activityLoaded]
  );

  return {
    // Data
    overview,
    departments,
    playbooks,
    decisions,
    activityLogs,
    projects,

    // Setters (for local updates without full reload)
    setOverview,
    setDepartments,
    setPlaybooks,
    setDecisions,
    setActivityLogs,
    setProjects,

    // Loading state
    loading,
    setLoading,
    error,

    // Activity pagination
    activityHasMore,
    setActivityHasMore,

    // Tab loaded states
    overviewLoaded,
    teamLoaded,
    playbooksLoaded,
    decisionsLoaded,
    projectsLoaded,
    activityLoaded,

    // Actions
    loadData,
    resetTabLoaded,
    isTabLoaded,
  };
}
