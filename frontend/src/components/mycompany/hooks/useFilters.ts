import { useState, useCallback } from 'react';

export type PlaybookTypeFilter = 'all' | 'sop' | 'framework' | 'policy';
export type ProjectStatusFilter = 'active' | 'completed' | 'archived' | 'all';
export type ProjectSortBy = 'updated' | 'created' | 'name' | 'decisions';

/**
 * Hook for managing playbook filter state
 */
export function usePlaybookFilter() {
  const [playbookTypeFilter, setPlaybookTypeFilter] = useState<PlaybookTypeFilter>('all');
  const [playbookDeptFilter, setPlaybookDeptFilter] = useState<string[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const resetPlaybookFilters = useCallback(() => {
    setPlaybookTypeFilter('all');
    setPlaybookDeptFilter([]);
    setExpandedTypes({});
  }, []);

  return {
    playbookTypeFilter,
    setPlaybookTypeFilter,
    playbookDeptFilter,
    setPlaybookDeptFilter,
    expandedTypes,
    setExpandedTypes,
    resetPlaybookFilters,
  };
}

/**
 * Hook for managing project filter state
 */
export function useProjectFilter() {
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatusFilter>('active');
  const [projectDeptFilter, setProjectDeptFilter] = useState<string[]>([]);
  const [projectSortBy, setProjectSortBy] = useState<ProjectSortBy>('updated');

  const resetProjectFilters = useCallback(() => {
    setProjectStatusFilter('active');
    setProjectDeptFilter([]);
    setProjectSortBy('updated');
  }, []);

  return {
    projectStatusFilter,
    setProjectStatusFilter,
    projectDeptFilter,
    setProjectDeptFilter,
    projectSortBy,
    setProjectSortBy,
    resetProjectFilters,
  };
}

/**
 * Hook for managing decision filter state
 */
export function useDecisionFilter() {
  const [decisionDeptFilter, setDecisionDeptFilter] = useState<string[]>([]);
  const [decisionSearch, setDecisionSearch] = useState<string>('');

  const resetDecisionFilters = useCallback(() => {
    setDecisionDeptFilter([]);
    setDecisionSearch('');
  }, []);

  return {
    decisionDeptFilter,
    setDecisionDeptFilter,
    decisionSearch,
    setDecisionSearch,
    resetDecisionFilters,
  };
}
