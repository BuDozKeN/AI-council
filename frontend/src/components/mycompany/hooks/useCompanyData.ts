import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Department, Playbook, Project, Decision } from '../../../types';

const log = logger.scope('useCompanyData');

export type MyCompanyTab = 'overview' | 'team' | 'playbooks' | 'decisions' | 'activity' | 'projects';

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
export function useCompanyData({ companyId, activeTab, activityLimit = 20 }: UseCompanyDataOptions) {
  // Data state
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Loading state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Activity pagination state
  const [activityHasMore, setActivityHasMore] = useState<boolean>(false);

  // Tab-specific loaded flags (to show skeleton until first fetch completes)
  const [overviewLoaded, setOverviewLoaded] = useState<boolean>(false);
  const [teamLoaded, setTeamLoaded] = useState<boolean>(false);
  const [playbooksLoaded, setPlaybooksLoaded] = useState<boolean>(false);
  const [decisionsLoaded, setDecisionsLoaded] = useState<boolean>(false);
  const [projectsLoaded, setProjectsLoaded] = useState<boolean>(false);
  const [activityLoaded, setActivityLoaded] = useState<boolean>(false);
  // Track if departments have been loaded (avoids re-setting on every tab load)
  const [departmentsLoaded, setDepartmentsLoaded] = useState<boolean>(false);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      switch (activeTab) {
        case 'overview': {
          const data = await api.getCompanyOverview(companyId);
          setOverview(data);
          setOverviewLoaded(true);
          break;
        }
        case 'team': {
          const data = await api.getCompanyTeam(companyId);
          setDepartments(data.departments || []);
          setTeamLoaded(true);
          break;
        }
        case 'playbooks': {
          // Single API call - departments now embedded in response
          const playbooksData = await api.getCompanyPlaybooks(companyId);
          setPlaybooks(playbooksData.playbooks || []);
          // Use departments from playbooks endpoint
          if (playbooksData.departments) {
            setDepartments(playbooksData.departments.map((d: Department) => ({ ...d, roles: [] })));
          }
          setPlaybooksLoaded(true);
          break;
        }
        case 'decisions': {
          // Load decisions and projects in parallel (need projects for Promote modal)
          const [decisionsData, projectsData] = await Promise.all([
            api.getCompanyDecisions(companyId),
            api.listProjectsWithStats(companyId, { includeArchived: true })
          ]);
          setDecisions(decisionsData.decisions || []);
          setProjects(projectsData.projects || []);
          setProjectsLoaded(true);
          // Use departments from decisions endpoint (only if not already loaded)
          if (decisionsData.departments && !departmentsLoaded) {
            setDepartments(decisionsData.departments.map((d: Department) => ({ ...d, roles: [] })));
            setDepartmentsLoaded(true);
          }
          setDecisionsLoaded(true);
          break;
        }
        case 'activity': {
          // Load activity and projects in parallel (need projects for click navigation)
          const [activityData, projectsData] = await Promise.all([
            api.getCompanyActivity(companyId, { limit: activityLimit + 1 }),
            api.listProjectsWithStats(companyId, { includeArchived: true })
          ]);
          const logs = activityData.logs || [];
          setActivityHasMore(logs.length > activityLimit);
          setActivityLogs(logs.slice(0, activityLimit));
          setProjects(projectsData.projects || []);
          setProjectsLoaded(true);
          setActivityLoaded(true);
          break;
        }
        case 'projects': {
          // Load projects and departments in parallel (needed for project edit modal)
          if (!departmentsLoaded) {
            const [projectsData, teamData] = await Promise.all([
              api.listProjectsWithStats(companyId, { includeArchived: true }),
              api.getCompanyTeam(companyId)
            ]);
            setProjects(projectsData.projects || []);
            setDepartments(teamData.departments || []);
            setDepartmentsLoaded(true);
          } else {
            const projectsData = await api.listProjectsWithStats(companyId, {
              includeArchived: true
            });
            setProjects(projectsData.projects || []);
          }
          setProjectsLoaded(true);
          break;
        }
      }
    } catch (err) {
      log.error(`Failed to load ${activeTab}`, { error: err });
      setError(`Failed to load ${activeTab}`);
    }
    setLoading(false);
    // Note: departmentsLoaded is intentionally not in deps to avoid re-triggering loadData
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, activeTab, activityLimit]);

  // Load data when tab changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: trigger data load on tab change
    loadData();
  }, [loadData]);

  // Reset data when company changes
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset state when company changes */
  useEffect(() => {
    setOverview(null);
    setDepartments([]);
    setPlaybooks([]);
    setDecisions([]);
    setActivityLogs([]);
    setProjects([]);
    // Reset all loaded flags so we show skeleton state for new company
    setOverviewLoaded(false);
    setTeamLoaded(false);
    setPlaybooksLoaded(false);
    setDecisionsLoaded(false);
    setProjectsLoaded(false);
    setActivityLoaded(false);
    // Reset activity pagination
    setActivityHasMore(false);
    // Reset departments loaded flag
    setDepartmentsLoaded(false);
  }, [companyId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset loaded flag for a specific tab (used by pull-to-refresh)
  const resetTabLoaded = useCallback((tab: MyCompanyTab): void => {
    switch (tab) {
      case 'overview': setOverviewLoaded(false); break;
      case 'team': setTeamLoaded(false); break;
      case 'playbooks': setPlaybooksLoaded(false); break;
      case 'decisions': setDecisionsLoaded(false); break;
      case 'projects': setProjectsLoaded(false); break;
      case 'activity': setActivityLoaded(false); break;
    }
  }, []);

  // Check if current tab data is loaded
  const isTabLoaded = useCallback((tab: MyCompanyTab): boolean => {
    switch (tab) {
      case 'overview': return overviewLoaded;
      case 'team': return teamLoaded;
      case 'playbooks': return playbooksLoaded;
      case 'decisions': return decisionsLoaded;
      case 'projects': return projectsLoaded;
      case 'activity': return activityLoaded;
      default: return false;
    }
  }, [overviewLoaded, teamLoaded, playbooksLoaded, decisionsLoaded, projectsLoaded, activityLoaded]);

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
