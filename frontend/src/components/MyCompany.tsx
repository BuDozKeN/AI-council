import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { api } from '../api';
import { Skeleton } from './ui/Skeleton';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { usePullToRefresh, useSwipeGesture } from '../hooks';
import { hapticLight, hapticSuccess, hapticMedium } from '../lib/haptics';

// Extracted components
import { MyCompanyHeader } from './mycompany/MyCompanyHeader';
import { MyCompanyTabs } from './mycompany/MyCompanyTabs';
import { AddFormModal, EditingModal, PromoteModal } from './mycompany/MyCompanyModals';

import {
  ActivityTab,
  OverviewTab,
  TeamTab,
  PlaybooksTab,
  ProjectsTab,
  DecisionsTab,
} from './mycompany/tabs';

// Performance: Lazy-load UsageTab to split Recharts (~127KB gzip) into separate chunk
// Most users never view the Usage tab, so this reduces initial MyCompany load
const UsageTab = lazy(() => import('./mycompany/tabs/UsageTab'));
import './mycompany/styles/index.css';
import { logger } from '../utils/logger';

// Import hooks
import {
  useCompanyData,
  useProjectActions,
  useDecisionActions,
  useActivityData,
  usePlaybookFilter,
  useProjectFilter,
  useDecisionFilter,
  usePendingDecisions,
  useUsageData,
} from './mycompany/hooks';
import type { MyCompanyTab, ActivityLog } from './mycompany/hooks';
import type { Business, Department, Project, Playbook, Role } from '../types/business';
import type { Decision } from '../types/conversation';

const log = logger.scope('MyCompany');

interface PromoteDecision {
  decision: Decision;
  title: string;
  summary?: string;
}

type AddFormType = 'department' | 'playbook' | { type: 'role'; deptId: string } | null;

interface EditingItem {
  type:
    | 'department'
    | 'role'
    | 'project'
    | 'playbook'
    | 'decision'
    | 'company-context'
    | 'company-context-view'
    | 'new_project';
  data: Department | Role | Project | Playbook | Decision | Record<string, unknown>;
}

interface MyCompanyProps {
  companyId: string;
  companyName?: string;
  allCompanies?: Business[];
  onSelectCompany?: (id: string) => void;
  onClose?: () => void;
  onNavigateToConversation?: (conversationId: string, source: string) => void;
  initialTab?: MyCompanyTab;
  initialDecisionId?: string | null;
  initialPlaybookId?: string | null;
  initialProjectId?: string | null;
  initialProjectDecisionId?: string | null;
  initialPromoteDecision?: PromoteDecision | null;
  onConsumePromoteDecision?: (() => void) | null;
}

/**
 * My Company - Unified interface for company management
 */
export default function MyCompany({
  companyId,
  companyName,
  allCompanies = [],
  onSelectCompany,
  onClose,
  onNavigateToConversation,
  initialTab = 'overview',
  initialDecisionId = null,
  initialPlaybookId = null,
  initialProjectId = null,
  initialProjectDecisionId = null,
  initialPromoteDecision = null,
  onConsumePromoteDecision = null,
}: MyCompanyProps) {
  // Core UI state
  const [activeTab, setActiveTab] = useState<MyCompanyTab>(initialTab);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [showAddForm, setShowAddForm] = useState<AddFormType>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Highlight states for auto-opening items
  const [highlightedDecisionId, setHighlightedDecisionId] = useState<string | null>(
    initialDecisionId
  );
  const [highlightedPlaybookId, setHighlightedPlaybookId] = useState<string | null>(
    initialPlaybookId
  );
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(initialProjectId);
  const [initialProjectDecisionToExpand, setInitialProjectDecisionToExpand] = useState<
    string | null
  >(initialProjectDecisionId);

  // Filter hooks
  const playbookFilters = usePlaybookFilter();
  const projectFilters = useProjectFilter();
  const decisionFilters = useDecisionFilter();

  // Data hook
  const companyData = useCompanyData({
    companyId,
    activeTab,
    activityLimit: 20,
  });

  // Activity pagination hook
  const activityData = useActivityData({
    companyId,
    setActivityLogs: companyData.setActivityLogs,
    activityHasMore: companyData.activityHasMore,
    setActivityHasMore: companyData.setActivityHasMore,
  });

  // Usage data hook
  const usageData = useUsageData({
    companyId,
    initialPeriod: 30,
  });

  // Project actions hook
  const projectActions = useProjectActions({
    setProjects: companyData.setProjects,
    loadData: companyData.loadData,
  });

  // Decision actions hook
  const decisionActions = useDecisionActions({
    companyId,
    setDecisions: companyData.setDecisions,
    setProjects: companyData.setProjects,
    loadData: companyData.loadData,
    setActiveTab,
    setHighlightedProjectId,
  });

  // Pending decisions count for header indicator
  const pendingDecisionsCount = usePendingDecisions({
    companyId,
    decisions: companyData.decisions,
    activeTab,
  });

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    hapticLight();
    companyData.resetTabLoaded(activeTab);
    companyData.setLoading(true);
    await companyData.loadData();
    hapticSuccess();
  }, [activeTab, companyData]);

  // Pull-to-refresh hook
  const {
    ref: contentRef,
    pullDistance,
    isRefreshing,
    progress: pullProgress,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: true,
  });

  // Swipe gesture to close panel
  const handleSwipeClose = useCallback(() => {
    hapticMedium();
    onClose?.();
  }, [onClose]);

  const panelSwipeRef = useSwipeGesture({
    onSwipeDown: handleSwipeClose,
    onSwipeRight: handleSwipeClose,
    threshold: 80,
    edgeOnly: true,
    edgeWidth: 40,
    enabled: true,
  });

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hapticLight();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Header click to close
  // Note: Interactive elements (company switcher, buttons) use stopPropagation()
  // so this handler only fires for clicks on the header background itself
  const handleHeaderClick = useCallback(() => {
    hapticLight();
    onClose?.();
  }, [onClose]);

  // Auto-open modals for highlighted items (syncing external prop to internal state)
  useEffect(() => {
    if (highlightedDecisionId && companyData.decisions.length > 0 && activeTab === 'decisions') {
      const decision = companyData.decisions.find((d) => d.id === highlightedDecisionId);
      if (decision && !editingItem) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing external prop to internal state
        setEditingItem({ type: 'decision', data: decision });
        setHighlightedDecisionId(null);
      }
    }
  }, [highlightedDecisionId, companyData.decisions, activeTab, editingItem]);

  useEffect(() => {
    if (highlightedPlaybookId && companyData.playbooks.length > 0 && activeTab === 'playbooks') {
      const playbook = companyData.playbooks.find((p) => p.id === highlightedPlaybookId);
      if (playbook && !editingItem) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing external prop to internal state
        setEditingItem({ type: 'playbook', data: playbook });
        setHighlightedPlaybookId(null);
      }
    }
  }, [highlightedPlaybookId, companyData.playbooks, activeTab, editingItem]);

  useEffect(() => {
    if (
      highlightedProjectId &&
      companyData.projects.length > 0 &&
      activeTab === 'projects' &&
      companyData.departments.length > 0
    ) {
      const project = companyData.projects.find((p) => p.id === highlightedProjectId);
      if (project && !editingItem) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: syncing external prop to internal state
        setEditingItem({ type: 'project', data: project });
        setHighlightedProjectId(null);
      }
    }
  }, [
    highlightedProjectId,
    companyData.projects,
    activeTab,
    editingItem,
    companyData.departments.length,
  ]);

  // Auto-open Promote modal if returning from Source view
  useEffect(() => {
    if (initialPromoteDecision && !decisionActions.promoteModal) {
      // PromoteDecision has a decision property that matches the Decision type
      decisionActions.setPromoteModal(initialPromoteDecision.decision);
      if (onConsumePromoteDecision) {
        onConsumePromoteDecision();
      }
    }
  }, [initialPromoteDecision, onConsumePromoteDecision, decisionActions]);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Count stats
  const totalRoles = companyData.departments.reduce(
    (sum, dept) => sum + (dept.roles?.length || 0),
    0
  );

  // Handle opening project details/edit modal
  const handleProjectClick = (project: Project) => {
    setEditingItem({ type: 'project', data: project });
  };

  // Handle clicking on activity item
  const handleActivityClick = async (activityLog: ActivityLog) => {
    if (!activityLog.related_id || !activityLog.related_type) return;

    const showNotFound = (type: string) => {
      log.warn(`${type} not found`, { related_id: activityLog.related_id });
    };

    switch (activityLog.related_type) {
      case 'playbook': {
        const playbook = companyData.playbooks.find((p) => p.id === activityLog.related_id);
        if (playbook) {
          setEditingItem({ type: 'playbook', data: playbook });
        } else {
          try {
            const fetchedPlaybook = await api.getPlaybook(companyId, activityLog.related_id);
            if (fetchedPlaybook) {
              setEditingItem({ type: 'playbook', data: fetchedPlaybook });
            } else {
              showNotFound('playbook');
            }
          } catch {
            showNotFound('playbook');
          }
        }
        break;
      }
      case 'decision': {
        try {
          const fetchedDecision = await api.getDecision(companyId, activityLog.related_id);
          if (fetchedDecision) {
            if (fetchedDecision.project_id) {
              const linkedProject = companyData.projects.find(
                (p) => p.id === fetchedDecision.project_id
              );
              if (linkedProject) {
                setEditingItem({ type: 'project', data: linkedProject });
              } else {
                setEditingItem({ type: 'decision', data: fetchedDecision });
              }
            } else {
              setEditingItem({ type: 'decision', data: fetchedDecision });
            }
          } else {
            showNotFound('decision');
          }
        } catch {
          showNotFound('decision');
        }
        break;
      }
      case 'project': {
        const project = companyData.projects.find((p) => p.id === activityLog.related_id);
        if (project) {
          setEditingItem({ type: 'project', data: project });
        } else {
          showNotFound('project');
        }
        break;
      }
      case 'conversation':
        if (activityLog.conversation_id && onNavigateToConversation) {
          onNavigateToConversation(activityLog.conversation_id, 'activity');
        }
        break;
      case 'department':
        setActiveTab('team');
        setExpandedDept(activityLog.related_id);
        break;
      case 'role':
        setActiveTab('team');
        break;
    }
  };

  // Playbook actions - optimistic UI (inline confirmation handled in PlaybooksTab)
  const handleArchivePlaybook = async (playbook: Playbook) => {
    // Optimistic: remove from list immediately
    companyData.setPlaybooks((prev) => prev.filter((p) => p.id !== playbook.id));
    try {
      await api.updatePlaybook(companyId, playbook.id, { status: 'archived' });
    } catch (err) {
      log.error('Failed to archive playbook', { error: err });
      // Rollback on error
      companyData.setPlaybooks((prev) => [...prev, playbook]);
    }
  };

  const handleDeletePlaybook = async (playbook: Playbook) => {
    // Optimistic: remove from list immediately
    companyData.setPlaybooks((prev) => prev.filter((p) => p.id !== playbook.id));
    try {
      await api.deletePlaybook(companyId, playbook.id);
    } catch (err) {
      log.error('Failed to delete playbook', { error: err });
      // Rollback on error
      companyData.setPlaybooks((prev) => [...prev, playbook]);
    }
  };

  // CRUD handlers
  const handleAddDepartment = async (name: string, description?: string) => {
    setSaving(true);
    try {
      const deptData: { name: string; slug: string; description?: string } = {
        name,
        slug: generateSlug(name),
      };
      if (description) deptData.description = description;
      await api.createCompanyDepartment(companyId, deptData);
      await companyData.loadData();
      setShowAddForm(null);
    } catch (err) {
      log.error('Failed to create department', { error: err });
    }
    setSaving(false);
  };

  const handleAddRole = async (deptId: string, name: string, title: string) => {
    setSaving(true);
    try {
      await api.createCompanyRole(companyId, deptId, { name, slug: generateSlug(name), title });
      await companyData.loadData();
      setShowAddForm(null);
    } catch (err) {
      log.error('Failed to create role', { error: err });
    }
    setSaving(false);
  };

  const handleAddPlaybook = async (
    title: string,
    docType: string,
    content?: string,
    departmentId?: string | null,
    additionalDepartments: string[] = []
  ) => {
    setSaving(true);
    try {
      const allDeptIds = departmentId
        ? [departmentId, ...additionalDepartments]
        : additionalDepartments.length > 0
          ? additionalDepartments
          : null;
      await api.createCompanyPlaybook(companyId, {
        title,
        doc_type: docType,
        content,
        department_ids: allDeptIds,
      });
      await companyData.loadData();
      setShowAddForm(null);
    } catch (err) {
      log.error('Failed to create playbook', { error: err });
    }
    setSaving(false);
  };

  const handleUpdateRole = async (roleId: string, deptId: string, updates: Partial<Role>) => {
    try {
      await api.updateCompanyRole(companyId, deptId, roleId, updates);
      await companyData.loadData();
      setEditingItem(null);
    } catch (err) {
      log.error('Failed to update role', { error: err });
      throw err;
    }
  };

  const handleUpdateDepartment = async (deptId: string, updates: Partial<Department>) => {
    try {
      await api.updateCompanyDepartment(companyId, deptId, updates);
      await companyData.loadData();
      setEditingItem(null);
    } catch (err) {
      log.error('Failed to update department', { error: err });
      throw err;
    }
  };

  const handleUpdateCompanyContext = async (updates: Record<string, unknown>) => {
    try {
      // Ensure context_md is a string for the API call
      const contextData = {
        context_md: typeof updates.context_md === 'string' ? updates.context_md : '',
      };
      await api.updateCompanyContext(companyId, contextData);
      await companyData.loadData();
      setEditingItem(null);
    } catch (err) {
      log.error('Failed to update company context', { error: err });
      throw err;
    }
  };

  const handleUpdatePlaybook = async (playbookId: string, updates: Partial<Playbook>) => {
    try {
      await api.updateCompanyPlaybook(companyId, playbookId, updates);
      await companyData.loadData();
      setEditingItem(null);
    } catch (err) {
      log.error('Failed to update playbook', { error: err });
      throw err;
    }
  };

  // Check if showing skeleton
  const showSkeleton = companyData.loading || !companyData.isTabLoaded(activeTab);

  // Render skeleton based on tab
  const renderSkeleton = () => (
    <div className="mc-skeleton-container">
      {(activeTab === 'projects' || activeTab === 'playbooks') && (
        <>
          <div className="mc-skeleton-stats">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width={140} height={80} className="rounded-xl" />
            ))}
          </div>
          <div className="mc-skeleton-filters">
            <Skeleton width={120} height={36} />
            <Skeleton width={150} height={36} />
            <Skeleton width={100} height={36} className="ml-auto" />
          </div>
          <div className="mc-skeleton-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mc-skeleton-row">
                <Skeleton variant="circular" width={10} height={10} />
                <Skeleton width="40%" height={16} />
                <Skeleton width={70} height={24} className="rounded-xl" />
                <Skeleton width={60} height={14} className="ml-auto" />
              </div>
            ))}
          </div>
        </>
      )}
      {activeTab === 'decisions' && (
        <>
          <div className="mc-skeleton-filters">
            <Skeleton width={140} height={36} />
            <Skeleton width={200} height={36} />
          </div>
          <div className="mc-skeleton-list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mc-skeleton-row">
                <Skeleton variant="circular" width={8} height={8} />
                <Skeleton width="50%" height={16} />
                <Skeleton width={70} height={24} className="rounded-xl" />
              </div>
            ))}
          </div>
        </>
      )}
      {activeTab === 'activity' && (
        <>
          <div className="mc-skeleton-filters">
            <Skeleton width={80} height={14} />
            <div className="flex gap-2 ml-auto">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width={80} height={28} className="rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="mc-skeleton-list">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="mc-skeleton-row">
                <Skeleton variant="circular" width={8} height={8} />
                <Skeleton width="45%" height={16} />
                <Skeleton width={70} height={22} className="rounded-xl" />
              </div>
            ))}
          </div>
        </>
      )}
      {(activeTab === 'overview' || activeTab === 'team') && (
        <>
          <div className="mc-skeleton-stats">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={200} height={100} className="rounded-xl" />
            ))}
          </div>
          <div className="mc-skeleton-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="mc-skeleton-row">
                <Skeleton width="60%" height={18} />
                <Skeleton width={100} height={14} className="ml-auto" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mc-overlay" onClick={onClose}>
      <div
        className="mc-panel"
        ref={panelSwipeRef as React.RefObject<HTMLDivElement>}
        onClick={(e) => e.stopPropagation()}
      >
        <MyCompanyHeader
          companyName={companyName}
          companyId={companyId}
          allCompanies={allCompanies}
          pendingDecisionsCount={pendingDecisionsCount}
          onSelectCompany={onSelectCompany}
          onClose={onClose}
          onHeaderClick={() => handleHeaderClick()}
        />

        <MyCompanyTabs
          activeTab={activeTab}
          onTabChange={(tabId: string) => setActiveTab(tabId as MyCompanyTab)}
        />

        {/* Content */}
        <div className="mc-content" ref={contentRef as React.RefObject<HTMLDivElement>}>
          <PullToRefreshIndicator
            progress={pullProgress}
            isRefreshing={isRefreshing}
            pullDistance={pullDistance}
          />

          {showSkeleton ? (
            renderSkeleton()
          ) : companyData.error ? (
            <div className="mc-error">
              <p>{companyData.error}</p>
              <button onClick={companyData.loadData}>Retry</button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  overview={companyData.overview}
                  companyName={companyName}
                  onEditContext={(data) => setEditingItem({ type: 'company-context', data })}
                  onViewContext={(data) => setEditingItem({ type: 'company-context-view', data })}
                />
              )}
              {activeTab === 'team' && (
                <TeamTab
                  departments={companyData.departments}
                  totalRoles={totalRoles}
                  expandedDept={expandedDept}
                  onExpandDept={setExpandedDept}
                  onAddDepartment={() => setShowAddForm('department')}
                  onAddRole={(deptId) => setShowAddForm({ type: 'role', deptId })}
                  onViewDepartment={(dept) => setEditingItem({ type: 'department', data: dept })}
                  onViewRole={(role) => setEditingItem({ type: 'role', data: role })}
                />
              )}
              {activeTab === 'projects' && (
                <ProjectsTab
                  projects={companyData.projects}
                  departments={companyData.departments}
                  projectsLoaded={companyData.projectsLoaded}
                  loading={companyData.loading}
                  projectStatusFilter={projectFilters.projectStatusFilter}
                  projectDeptFilter={projectFilters.projectDeptFilter}
                  projectSortBy={projectFilters.projectSortBy}
                  fadingProjectId={projectActions.fadingProjectId}
                  confirmingDeleteProjectId={projectActions.confirmingDeleteProjectId}
                  onStatusFilterChange={projectFilters.setProjectStatusFilter}
                  onDeptFilterChange={projectFilters.setProjectDeptFilter}
                  onSortByChange={projectFilters.setProjectSortBy}
                  onConfirmingDeleteChange={projectActions.setConfirmingDeleteProjectId}
                  onAddProject={() => setEditingItem({ type: 'new_project', data: {} })}
                  onProjectClick={handleProjectClick}
                  onCompleteProject={projectActions.handleCompleteProject}
                  onArchiveProject={projectActions.handleArchiveProject}
                  onRestoreProject={projectActions.handleRestoreProject}
                  onDeleteProject={projectActions.handleDeleteProject}
                />
              )}
              {activeTab === 'playbooks' && (
                <PlaybooksTab
                  playbooksLoaded={companyData.playbooksLoaded}
                  loading={companyData.loading}
                  playbooks={companyData.playbooks
                    .filter(
                      (
                        p
                      ): p is Playbook & {
                        title: string;
                        doc_type: 'sop' | 'framework' | 'policy';
                      } =>
                        Boolean(p.title) &&
                        Boolean(p.doc_type) &&
                        ['sop', 'framework', 'policy'].includes(p.doc_type || '')
                    )
                    .map((p) => ({
                      id: p.id,
                      title: p.title,
                      doc_type: p.doc_type,
                      content: p.content,
                      department_id: p.department_id,
                      department_name: undefined,
                      department_slug: undefined,
                      additional_departments: p.additional_departments,
                    }))}
                  departments={companyData.departments}
                  playbookTypeFilter={playbookFilters.playbookTypeFilter}
                  playbookDeptFilter={playbookFilters.playbookDeptFilter}
                  expandedTypes={playbookFilters.expandedTypes}
                  onTypeFilterChange={playbookFilters.setPlaybookTypeFilter}
                  onDeptFilterChange={playbookFilters.setPlaybookDeptFilter}
                  onExpandedTypesChange={playbookFilters.setExpandedTypes}
                  onAddPlaybook={() => setShowAddForm('playbook')}
                  onViewPlaybook={(doc) =>
                    setEditingItem({ type: 'playbook', data: doc as unknown as Playbook })
                  }
                  onArchivePlaybook={(playbook) =>
                    handleArchivePlaybook(playbook as unknown as Playbook)
                  }
                  onDeletePlaybook={(playbook) =>
                    handleDeletePlaybook(playbook as unknown as Playbook)
                  }
                />
              )}
              {activeTab === 'decisions' && (
                <DecisionsTab
                  decisions={
                    companyData.decisions as unknown as Parameters<
                      typeof DecisionsTab
                    >[0]['decisions']
                  }
                  departments={companyData.departments}
                  decisionDeptFilter={decisionFilters.decisionDeptFilter}
                  decisionSearch={decisionFilters.decisionSearch}
                  deletingDecisionId={decisionActions.deletingDecisionId}
                  onDeptFilterChange={decisionFilters.setDecisionDeptFilter}
                  onSearchChange={decisionFilters.setDecisionSearch}
                  onPromoteDecision={(decision) =>
                    decisionActions.handlePromoteDecision(decision as unknown as Decision)
                  }
                  onDeleteDecision={(decision) =>
                    decisionActions.handleDeleteDecision(decision as unknown as Decision)
                  }
                  onNavigateToConversation={onNavigateToConversation}
                />
              )}
              {activeTab === 'activity' && (
                <ActivityTab
                  activityLogs={
                    companyData.activityLogs as unknown as Parameters<
                      typeof ActivityTab
                    >[0]['activityLogs']
                  }
                  activityLoaded={companyData.activityLoaded}
                  activityHasMore={companyData.activityHasMore}
                  activityLoadingMore={activityData.activityLoadingMore}
                  onActivityClick={(log) =>
                    handleActivityClick(log as unknown as Parameters<typeof handleActivityClick>[0])
                  }
                  onLoadMore={activityData.handleLoadMoreActivity}
                  onNavigateToConversation={onNavigateToConversation}
                />
              )}
              {activeTab === 'usage' && (
                <Suspense
                  fallback={
                    <div className="mc-skeleton-container">
                      <div className="mc-skeleton-stats">
                        {[1, 2, 3, 4].map((i) => (
                          <Skeleton key={i} width={140} height={80} className="rounded-xl" />
                        ))}
                      </div>
                      <Skeleton width="100%" height={240} className="rounded-xl mt-4" />
                    </div>
                  }
                >
                  <UsageTab
                    usage={usageData.usage}
                    rateLimits={usageData.rateLimits}
                    alerts={usageData.alerts}
                    loading={usageData.loading}
                    usageLoaded={usageData.usageLoaded}
                    isRefetching={usageData.isRefetching}
                    error={usageData.error}
                    period={usageData.period}
                    onPeriodChange={usageData.changePeriod}
                    onAlertAcknowledge={usageData.acknowledgeAlert}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        <AddFormModal
          showAddForm={showAddForm}
          saving={saving}
          departments={companyData.departments}
          onAddDepartment={handleAddDepartment}
          onAddRole={handleAddRole}
          onAddPlaybook={handleAddPlaybook}
          onClose={() => setShowAddForm(null)}
        />

        <EditingModal
          editingItem={editingItem}
          companyId={companyId}
          companyName={companyName}
          departments={companyData.departments}
          playbooks={companyData.playbooks}
          projects={companyData.projects}
          initialProjectDecisionToExpand={initialProjectDecisionToExpand}
          projectActions={projectActions}
          decisionActions={
            decisionActions as unknown as Parameters<typeof EditingModal>[0]['decisionActions']
          }
          onClose={() => setEditingItem(null)}
          onConsumeInitialDecision={() => setInitialProjectDecisionToExpand(null)}
          onUpdateCompanyContext={(data) =>
            handleUpdateCompanyContext(data as Record<string, unknown>)
          }
          onUpdateDepartment={handleUpdateDepartment}
          onUpdateRole={handleUpdateRole}
          onUpdatePlaybook={handleUpdatePlaybook}
          onNavigateToConversation={onNavigateToConversation}
          onSetProjects={
            companyData.setProjects as unknown as Parameters<
              typeof EditingModal
            >[0]['onSetProjects']
          }
        />

        <PromoteModal
          promoteModal={decisionActions.promoteModal}
          departments={companyData.departments}
          projects={companyData.projects}
          companyId={companyId}
          saving={decisionActions.saving}
          decisionActions={
            decisionActions as unknown as Parameters<typeof PromoteModal>[0]['decisionActions']
          }
          onNavigateToConversation={onNavigateToConversation}
        />
      </div>
    </div>
  );
}
