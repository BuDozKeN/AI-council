import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { api } from '../api';
import MarkdownViewer from './MarkdownViewer';
import ProjectModal from './ProjectModal';
import { AppModal } from './ui/AppModal';
import { DepartmentSelect } from './ui/DepartmentSelect';
import { MultiDepartmentSelect } from './ui/MultiDepartmentSelect';
import { StatusSelect } from './ui/StatusSelect';
import { SortSelect } from './ui/SortSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Spinner } from './ui/Spinner';
import { Skeleton } from './ui/Skeleton';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { Building2, Bookmark, FolderKanban, CheckCircle, Archive, RotateCcw, ExternalLink, Trash2, Sparkles, PenLine, RefreshCw, Users, BookOpen, BarChart3, Lightbulb, ClipboardList } from 'lucide-react';
import { getDeptColor } from '../lib/colors';
// Eagerly load small/simple modals
import {
  AddDepartmentModal,
  AddRoleModal,
  AddPlaybookModal,
  ConfirmModal,
  AlertModal,
} from './mycompany/modals';
// Lazy load large/complex modals to reduce initial bundle size
const ViewProjectModal = lazy(() => import('./mycompany/modals/ViewProjectModal').then(m => ({ default: m.ViewProjectModal })));
const ViewPlaybookModal = lazy(() => import('./mycompany/modals/ViewPlaybookModal').then(m => ({ default: m.ViewPlaybookModal })));
const PromoteDecisionModal = lazy(() => import('./mycompany/modals/PromoteDecisionModal').then(m => ({ default: m.PromoteDecisionModal })));
const ViewDepartmentModal = lazy(() => import('./mycompany/modals/ViewDepartmentModal').then(m => ({ default: m.ViewDepartmentModal })));
const ViewRoleModal = lazy(() => import('./mycompany/modals/ViewRoleModal').then(m => ({ default: m.ViewRoleModal })));
const ViewCompanyContextModal = lazy(() => import('./mycompany/modals/ViewCompanyContextModal').then(m => ({ default: m.ViewCompanyContextModal })));
const ViewDecisionModal = lazy(() => import('./mycompany/modals/ViewDecisionModal').then(m => ({ default: m.ViewDecisionModal })));

import { ActivityTab, OverviewTab, TeamTab, PlaybooksTab, ProjectsTab, DecisionsTab } from './mycompany/tabs';
import './MyCompany.css';

// Loading fallback for lazy-loaded modals
const ModalLoadingFallback = () => (
  <div className="modal-loading-fallback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
    <Spinner size="lg" />
  </div>
);

/**
 * My Company - Unified interface for company management
 *
 * 4 Tabs:
 * - Overview: Company info and stats
 * - Team: Departments and roles
 * - Playbooks: SOPs, frameworks, policies
 * - Decisions: Saved council outputs with "promote to playbook" feature
 */
export default function MyCompany({ companyId, companyName, allCompanies = [], onSelectCompany, onClose, onNavigateToConversation, initialTab = 'overview', initialDecisionId = null, initialPlaybookId = null, initialProjectId = null, initialPromoteDecision = null, onConsumePromoteDecision = null }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [projects, setProjects] = useState([]);


  // UI state
  const [expandedDept, setExpandedDept] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [promoteModal, setPromoteModal] = useState(null); // Decision being promoted
  const [highlightedDecisionId, setHighlightedDecisionId] = useState(initialDecisionId);
  const [highlightedPlaybookId, setHighlightedPlaybookId] = useState(initialPlaybookId);
  const [highlightedProjectId, setHighlightedProjectId] = useState(initialProjectId);
  const [confirmModal, setConfirmModal] = useState(null); // { type, item, title, message, confirmText, variant }
  const [alertModal, setAlertModal] = useState(null); // { title, message, variant } - replaces browser alert()
  const [deletingDecisionId, setDeletingDecisionId] = useState(null); // ID of decision being deleted (for animation)
  const [fadingProjectId, setFadingProjectId] = useState(null); // ID of project being archived/deleted (for animation)
  const [confirmingDeleteProjectId, setConfirmingDeleteProjectId] = useState(null); // ID of project showing "Are you sure?"

  // Playbooks filter state
  const [playbookSearch, setPlaybookSearch] = useState('');
  const [playbookTypeFilter, setPlaybookTypeFilter] = useState('all'); // 'all', 'sop', 'framework', 'policy'
  const [playbookDeptFilter, setPlaybookDeptFilter] = useState([]); // Array of department IDs for multi-select
  const [playbookTagFilter, setPlaybookTagFilter] = useState('all');
  const [expandedTypes, setExpandedTypes] = useState({}); // Track which types are expanded beyond 5

  // Activity pagination state
  const [activityLimit, setActivityLimit] = useState(20);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false); // Track if activity has been fetched at least once

  // Tab-specific loaded flags (to show skeleton until first fetch completes)
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [playbooksLoaded, setPlaybooksLoaded] = useState(false);
  const [decisionsLoaded, setDecisionsLoaded] = useState(false);

  // Projects filter state
  const [projectStatusFilter, setProjectStatusFilter] = useState('active'); // 'active', 'completed', 'archived', 'all'
  const [projectDeptFilter, setProjectDeptFilter] = useState([]); // Array of department IDs for multi-select
  const [projectSortBy, setProjectSortBy] = useState('updated'); // 'updated', 'created', 'name', 'decisions'
  const [showArchived, setShowArchived] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false); // Track if projects have been fetched at least once

  // Decisions filter state
  const [decisionDeptFilter, setDecisionDeptFilter] = useState([]); // Array of department IDs
  const [decisionSearch, setDecisionSearch] = useState(''); // Keyword search

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
            setDepartments(playbooksData.departments.map(d => ({ ...d, roles: [] })));
          }
          setPlaybooksLoaded(true);
          break;
        }
        case 'decisions': {
          // Load decisions and projects in parallel (need projects for Promote modal)
          const [decisionsData, projectsData] = await Promise.all([
            api.getCompanyDecisions(companyId),
            api.listProjectsWithStats(companyId, { status: null, includeArchived: true })
          ]);
          setDecisions(decisionsData.decisions || []);
          setProjects(projectsData.projects || []);
          setProjectsLoaded(true);
          // Use departments from decisions endpoint
          if (decisionsData.departments) {
            setDepartments(decisionsData.departments.map(d => ({ ...d, roles: [] })));
          }
          setDecisionsLoaded(true);
          break;
        }
        case 'activity': {
          // Load activity and projects in parallel (need projects for click navigation)
          const [activityData, projectsData] = await Promise.all([
            api.getCompanyActivity(companyId, { limit: activityLimit + 1 }),
            api.listProjectsWithStats(companyId, { status: null, includeArchived: true })
          ]);
          const logs = activityData.logs || [];
          setActivityHasMore(logs.length > activityLimit);
          setActivityLogs(logs.slice(0, activityLimit));
          setProjects(projectsData.projects || []);
          setProjectsLoaded(true);
          setActivityLoaded(true); // Mark activity as loaded
          break;
        }
        case 'projects': {
          // Load ALL projects (client-side filtering)
          const projectsData = await api.listProjectsWithStats(companyId, {
            status: null,  // Load all statuses for client-side filtering
            includeArchived: true  // Include all for filtering
          });
          setProjects(projectsData.projects || []);
          setProjectsLoaded(true); // Mark that we've fetched projects at least once
          // Also load departments if not already loaded (needed for project edit modal)
          if (departments.length === 0) {
            const teamData = await api.getCompanyTeam(companyId);
            setDepartments(teamData.departments || []);
          }
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(`Failed to load ${activeTab}`);
    }
    setLoading(false);
  }, [companyId, activeTab]);

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
    // Reset all loaded flags so we show skeleton state for new company
    setOverviewLoaded(false);
    setTeamLoaded(false);
    setPlaybooksLoaded(false);
    setDecisionsLoaded(false);
    setProjectsLoaded(false);
    setActivityLoaded(false);
    // Reset activity pagination
    setActivityLimit(20);
    setActivityHasMore(false);
  }, [companyId]);

  // Auto-open decision modal if initialDecisionId is provided and decisions are loaded
  useEffect(() => {
    if (highlightedDecisionId && decisions.length > 0 && activeTab === 'decisions') {
      const decision = decisions.find(d => d.id === highlightedDecisionId);
      if (decision && !editingItem) {
        setEditingItem({ type: 'decision', data: decision });
        // Clear highlight after opening (don't re-open on subsequent loads)
        setHighlightedDecisionId(null);
      }
    }
  }, [highlightedDecisionId, decisions, activeTab, editingItem]);

  // Auto-open playbook modal if initialPlaybookId is provided and playbooks are loaded
  useEffect(() => {
    if (highlightedPlaybookId && playbooks.length > 0 && activeTab === 'playbooks') {
      const playbook = playbooks.find(p => p.id === highlightedPlaybookId);
      if (playbook && !editingItem) {
        setEditingItem({ type: 'playbook', data: playbook });
        // Clear highlight after opening (don't re-open on subsequent loads)
        setHighlightedPlaybookId(null);
      }
    }
  }, [highlightedPlaybookId, playbooks, activeTab, editingItem]);

  // Auto-open project modal if initialProjectId is provided and projects are loaded
  useEffect(() => {
    if (highlightedProjectId && projects.length > 0 && activeTab === 'projects' && departments.length > 0) {
      const project = projects.find(p => p.id === highlightedProjectId);
      if (project && !editingItem) {
        setEditingItem({ type: 'project', data: project });
        // Clear highlight after opening (don't re-open on subsequent loads)
        setHighlightedProjectId(null);
      }
    }
  }, [highlightedProjectId, projects, activeTab, editingItem, departments.length]);

  // Auto-open Promote modal if initialPromoteDecision is provided (returning from Source view)
  useEffect(() => {
    if (initialPromoteDecision && !promoteModal) {
      setPromoteModal(initialPromoteDecision);
      // Clear the initial prop so it doesn't re-open on subsequent renders
      if (onConsumePromoteDecision) {
        onConsumePromoteDecision();
      }
    }
  }, [initialPromoteDecision, onConsumePromoteDecision]);

  // Generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Load decisions count on mount (for status indicator in header)
  const [pendingDecisionsCount, setPendingDecisionsCount] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    // Fetch decisions to count pending ones
    api.getCompanyDecisions(companyId)
      .then(data => {
        const allDecisions = data.decisions || [];
        // Pending = not promoted (has promoted_to_id) AND not linked to a project
        const pending = allDecisions.filter(d => !d.promoted_to_id && !d.project_id);
        setPendingDecisionsCount(pending.length);
      })
      .catch(err => {
        console.error('Failed to load decisions count:', err);
        setPendingDecisionsCount(0);
      });
  }, [companyId]);

  // Update count when decisions change (e.g., after promoting)
  useEffect(() => {
    if (decisions.length > 0 || activeTab === 'decisions') {
      // Pending = not promoted (has promoted_to_id) AND not linked to a project
      const pending = decisions.filter(d => !d.promoted_to_id && !d.project_id);
      setPendingDecisionsCount(pending.length);
    }
  }, [decisions, activeTab]);

  // Count stats
  const totalRoles = departments.reduce((sum, dept) => sum + (dept.roles?.length || 0), 0);

  // Handle project status change
  const handleProjectStatusChange = async (project, newStatus) => {
    try {
      setSaving(true);
      await api.updateProject(project.id, { status: newStatus });
      // Refresh projects list
      loadData();
    } catch (err) {
      console.error('Failed to update project status:', err);
      setAlertModal({ title: 'Error', message: 'Failed to update project status', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Handle opening project details/edit modal
  const handleProjectClick = (project) => {
    setEditingItem({ type: 'project', data: project });
  };

  // Handle clicking on activity item to view related content
  const handleActivityClick = async (log) => {
    if (!log.related_id || !log.related_type) return;

    // Helper to show "not found" message
    const showNotFound = (type) => {
      setAlertModal({
        title: 'Item Not Found',
        message: `This ${type} may have been deleted or is no longer available.`,
        variant: 'info'
      });
    };

    switch (log.related_type) {
      case 'playbook':
        // Find the playbook and open it
        let playbook = playbooks.find(p => p.id === log.related_id);
        if (playbook) {
          setEditingItem({ type: 'playbook', data: playbook });
        } else {
          // Playbook not in current list - try to fetch it directly (could be archived)
          try {
            const fetchedPlaybook = await api.getPlaybook(companyId, log.related_id);
            if (fetchedPlaybook) {
              setEditingItem({ type: 'playbook', data: fetchedPlaybook });
            } else {
              // 404 - playbook was deleted
              showNotFound('playbook');
            }
          } catch (err) {
            console.error('Failed to fetch playbook:', err);
            showNotFound('playbook');
          }
        }
        break;
      case 'decision':
        // Always fetch from API to ensure complete data (local list may have stale/incomplete records)
        try {
          const fetchedDecision = await api.getDecision(companyId, log.related_id);
          if (fetchedDecision) {
            // If decision is linked to a project, go directly to the project
            if (fetchedDecision.project_id) {
              const linkedProject = projects.find(p => p.id === fetchedDecision.project_id);
              if (linkedProject) {
                setEditingItem({ type: 'project', data: linkedProject });
              } else {
                // Project not in list - open decision modal as fallback
                setEditingItem({ type: 'decision', data: fetchedDecision });
              }
            } else {
              setEditingItem({ type: 'decision', data: fetchedDecision });
            }
          } else {
            // 404 - decision was deleted or doesn't exist
            showNotFound('decision');
          }
        } catch (err) {
          console.error('Failed to fetch decision:', err);
          showNotFound('decision');
        }
        break;
      case 'project':
        // Find the project and open it
        let project = projects.find(p => p.id === log.related_id);
        if (project) {
          setEditingItem({ type: 'project', data: project });
        } else {
          // Project not in list - could be archived or deleted
          // TODO: Add api.getProject() for archived projects
          showNotFound('project');
        }
        break;
      case 'conversation':
        // Consultation - navigate to the conversation
        if (log.conversation_id && onNavigateToConversation) {
          onNavigateToConversation(log.conversation_id, 'activity');
        }
        break;
      case 'department':
        setActiveTab('team');
        // Expand the department if possible
        setExpandedDept(log.related_id);
        break;
      case 'role':
        setActiveTab('team');
        break;
      default:
        break;
    }
  };

  // Handle loading more activity events
  const handleLoadMoreActivity = async () => {
    setActivityLoadingMore(true);
    try {
      const newLimit = activityLimit + 20;
      const activityData = await api.getCompanyActivity(companyId, { limit: newLimit + 1 });
      const logs = activityData.logs || [];
      setActivityHasMore(logs.length > newLimit);
      setActivityLogs(logs.slice(0, newLimit));
      setActivityLimit(newLimit);
    } catch (err) {
      console.error('Failed to load more activity:', err);
    } finally {
      setActivityLoadingMore(false);
    }
  };

  // Handle promote decision to playbook - opens modal
  const handlePromoteDecision = (decision) => {
    setPromoteModal(decision);
  };

  // Actually promote after user selects type in modal
  // Now accepts departmentIds (array) and optional projectId
  const handleConfirmPromote = async (docType, title, departmentIds, projectId) => {
    if (!promoteModal) return;

    setSaving(true);
    try {
      if (docType === 'project') {
        // Promote to project
        let targetProjectId = projectId;
        if (projectId) {
          // Add to existing project - link decision to project
          await api.linkDecisionToProject(companyId, promoteModal.id, projectId);
        } else {
          // Create new project from decision
          const result = await api.createProjectFromDecision(companyId, promoteModal.id, {
            name: title || promoteModal.title,
            department_ids: departmentIds?.length > 0 ? departmentIds : null
          });
          // Get the new project ID from the response
          targetProjectId = result?.project?.id;
        }
        // Navigate to the project after promotion
        if (targetProjectId) {
          setPromoteModal(null);
          await loadData();
          setActiveTab('projects');
          setHighlightedProjectId(targetProjectId);
          setSaving(false);
          return; // Early return - we've handled everything
        }
      } else {
        // Promote to playbook (SOP, Framework, Policy)
        await api.promoteDecisionToPlaybook(companyId, promoteModal.id, {
          doc_type: docType,
          title: title || promoteModal.title,
          department_ids: departmentIds || []  // Use canonical array field
        });
      }
      setPromoteModal(null);
      // Reload decisions to show promoted status
      await loadData();
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to promote decision: ' + err.message, variant: 'error' });
    }
    setSaving(false);
  };

  // Delete decision with fade-out animation
  const handleDeleteDecision = async (decision) => {
    // Start the fade-out animation
    setDeletingDecisionId(decision.id);

    // Wait for animation to complete (300ms), then remove from local state
    setTimeout(async () => {
      // Optimistically remove from local state
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      setDeletingDecisionId(null);

      // Then call API in background
      try {
        await api.deleteDecision(companyId, decision.id);
      } catch (err) {
        console.error('Failed to delete decision:', err);
        // On error, reload to restore the item
        await loadData();
        setAlertModal({ title: 'Error', message: 'Failed to delete decision: ' + err.message, variant: 'error' });
      }
    }, 300);
  };

  // Show confirmation modal for archive playbook
  const handleArchivePlaybook = (playbook) => {
    setConfirmModal({
      type: 'archivePlaybook',
      item: playbook,
      title: 'Archive Playbook',
      message: `Are you sure you want to archive "${playbook.title}"? It will be hidden from the list but can be restored later.`,
      confirmText: 'Archive',
      variant: 'warning'
    });
  };

  // Show confirmation modal for delete playbook
  const handleDeletePlaybook = (playbook) => {
    setConfirmModal({
      type: 'deletePlaybook',
      item: playbook,
      title: 'Delete Playbook',
      message: `Are you sure you want to permanently delete "${playbook.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger'
    });
  };

  // Execute the confirmed action (for playbooks only - decisions delete directly)
  const handleConfirmAction = async () => {
    if (!confirmModal) return;

    setSaving(true);
    try {
      switch (confirmModal.type) {
        case 'archivePlaybook':
          await api.updatePlaybook(companyId, confirmModal.item.id, { status: 'archived' });
          break;
        case 'deletePlaybook':
          await api.deletePlaybook(companyId, confirmModal.item.id);
          break;
        default:
          break;
      }
      await loadData();
      setConfirmModal(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: `Failed to ${confirmModal.type.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${err.message}`, variant: 'error' });
    }
    setSaving(false);
  };

  // Handle project status changes with fade animation - update local state, no spinner
  const handleCompleteProject = async (project, e) => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'completed' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'completed' } : p
        ));
      } catch (err) {
        console.error('Failed to complete project:', err);
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  };

  const handleArchiveProject = async (project, e) => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'archived' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'archived' } : p
        ));
      } catch (err) {
        console.error('Failed to archive project:', err);
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  };

  const handleRestoreProject = async (project, e) => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'active' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'active' } : p
        ));
      } catch (err) {
        console.error('Failed to restore project:', err);
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  };

  // First click: show inline "Are you sure?" / Second click: actually delete
  const handleDeleteProject = (project, e) => {
    e?.stopPropagation();
    if (confirmingDeleteProjectId === project.id) {
      // Second click - actually delete with fade
      setConfirmingDeleteProjectId(null);
      setFadingProjectId(project.id);
      setTimeout(async () => {
        try {
          await api.deleteProject(project.id);
          // Remove from local state - no full reload, no spinner
          setProjects(prev => prev.filter(p => p.id !== project.id));
        } catch (err) {
          console.error('Failed to delete project:', err);
        } finally {
          setFadingProjectId(null);
        }
      }, 300);
    } else {
      // First click - show "Are you sure?"
      setConfirmingDeleteProjectId(project.id);
    }
  };

  // Handle add department
  const handleAddDepartment = async (name, description) => {
    setSaving(true);
    try {
      await api.createCompanyDepartment(companyId, {
        name,
        slug: generateSlug(name),
        description
      });
      await loadData();
      setShowAddForm(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to create department: ' + err.message, variant: 'error' });
    }
    setSaving(false);
  };

  // Handle add role
  const handleAddRole = async (deptId, name, title) => {
    setSaving(true);
    try {
      await api.createCompanyRole(companyId, deptId, {
        name,
        slug: generateSlug(name),
        title
      });
      await loadData();
      setShowAddForm(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to create role: ' + err.message, variant: 'error' });
    }
    setSaving(false);
  };

  // Handle add playbook
  const handleAddPlaybook = async (title, docType, content, departmentId, additionalDepartments = []) => {
    setSaving(true);
    try {
      // Generate slug from title
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      // Combine primary and additional departments into single array
      const allDeptIds = departmentId
        ? [departmentId, ...(additionalDepartments || [])]
        : (additionalDepartments || []);
      await api.createCompanyPlaybook(companyId, {
        title,
        slug,
        doc_type: docType,
        content,
        department_ids: allDeptIds  // Use canonical array field
      });
      await loadData();
      setShowAddForm(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to create playbook: ' + err.message, variant: 'error' });
    }
    setSaving(false);
  };

  // Handle update role
  const handleUpdateRole = async (roleId, deptId, updates) => {
    try {
      await api.updateCompanyRole(companyId, deptId, roleId, updates);
      await loadData();
      setEditingItem(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to update role: ' + err.message, variant: 'error' });
      throw err;
    }
  };

  // Handle update department
  const handleUpdateDepartment = async (deptId, updates) => {
    try {
      await api.updateCompanyDepartment(companyId, deptId, updates);
      await loadData();
      setEditingItem(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to update department: ' + err.message, variant: 'error' });
      throw err;
    }
  };

  // Handle update company context
  const handleUpdateCompanyContext = async (updates) => {
    try {
      await api.updateCompanyContext(companyId, updates);
      await loadData();
      setEditingItem(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to update company context: ' + err.message, variant: 'error' });
      throw err;
    }
  };

  // Handle update playbook
  const handleUpdatePlaybook = async (playbookId, updates) => {
    try {
      await api.updateCompanyPlaybook(companyId, playbookId, updates);
      await loadData();
      setEditingItem(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to update playbook: ' + err.message, variant: 'error' });
      throw err;
    }
  };

    // Handle update project
  // Returns updated project data so modal can update state without closing
  const handleUpdateProject = async (projectId, updates) => {
    try {
      const result = await api.updateProject(projectId, updates);
      await loadData();
      // Return the updated project so modal can refresh state without closing
      return result.project || result;
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to update project: ' + err.message, variant: 'error' });
      throw err;
    }
  };

  // Handle create project
  const handleCreateProject = async (_, projectData) => {
    try {
      await api.createProject(companyId, projectData);
      await loadData();
      setEditingItem(null);
    } catch (err) {
      setAlertModal({ title: 'Error', message: 'Failed to create project: ' + err.message, variant: 'error' });
      throw err;
    }
  };
  // Render add forms
  const renderAddForm = () => {
    if (!showAddForm) return null;

    if (showAddForm === 'department') {
      return (
        <AddDepartmentModal
          onSave={handleAddDepartment}
          onClose={() => setShowAddForm(null)}
          saving={saving}
        />
      );
    }

    if (showAddForm?.type === 'role') {
      return (
        <AddRoleModal
          deptId={showAddForm.deptId}
          onSave={handleAddRole}
          onClose={() => setShowAddForm(null)}
          saving={saving}
        />
      );
    }

    if (showAddForm === 'playbook') {
      return (
        <AddPlaybookModal
          onSave={handleAddPlaybook}
          onClose={() => setShowAddForm(null)}
          saving={saving}
          departments={departments}
        />
      );
    }

    return null;
  };

  // Render view/edit modals (lazy-loaded modals are wrapped in Suspense)
  const renderEditingModal = () => {
    if (!editingItem) return null;

    // Wrap lazy-loaded modals in Suspense
    const LazyWrapper = ({ children }) => (
      <Suspense fallback={<ModalLoadingFallback />}>
        {children}
      </Suspense>
    );

    if (editingItem.type === 'company-context') {
      return (
        <LazyWrapper>
          <ViewCompanyContextModal
            data={editingItem.data}
            companyName={companyName}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateCompanyContext}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'company-context-view') {
      return (
        <LazyWrapper>
          <ViewCompanyContextModal
            data={editingItem.data}
            companyName={companyName}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateCompanyContext}
            initialEditing={false}
            fullscreen={true}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'department') {
      return (
        <LazyWrapper>
          <ViewDepartmentModal
            department={editingItem.data}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateDepartment}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'role') {
      return (
        <LazyWrapper>
          <ViewRoleModal
            role={editingItem.data}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateRole}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'playbook') {
      return (
        <LazyWrapper>
          <ViewPlaybookModal
            playbook={editingItem.data}
            departments={departments}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdatePlaybook}
            startEditing={editingItem.startEditing || false}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'decision') {
      return (
        <LazyWrapper>
          <ViewDecisionModal
            decision={editingItem.data}
            departments={departments}
            playbooks={playbooks}
            projects={projects}
            onClose={() => setEditingItem(null)}
            onPromote={(decision) => {
              setEditingItem(null); // Close view modal
              setPromoteModal(decision); // Open promote modal
            }}
            onViewProject={(projectId) => {
              setEditingItem(null); // Close decision modal
              const project = projects.find(p => p.id === projectId);
              if (project) {
                setEditingItem({ type: 'project', data: project });
              }
            }}
            onNavigateToConversation={(conversationId, source, responseIndex) => {
              setEditingItem(null); // Close modal
              if (onNavigateToConversation) {
                onNavigateToConversation(conversationId, source, responseIndex);
              }
            }}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'project') {
      return (
        <LazyWrapper>
          <ViewProjectModal
            project={editingItem.data}
            companyId={companyId}
            departments={departments}
            onClose={() => setEditingItem(null)}
            onSave={handleUpdateProject}
            onNavigateToConversation={onNavigateToConversation}
            onProjectUpdate={(projectId, updates) => {
              // Update project in the list with new department_ids from sync
              setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, ...updates } : p
              ));
            }}
            onStatusChange={async (projectId, newStatus) => {
              // Handle status changes from modal (complete, archive, restore)
              await api.updateProject(projectId, { status: newStatus });
              setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, status: newStatus } : p
              ));
              // Close modal after status change
              setEditingItem(null);
            }}
            onDelete={async (projectId) => {
              // Handle delete from modal
              await api.deleteProject(projectId);
              setProjects(prev => prev.filter(p => p.id !== projectId));
              setEditingItem(null);
            }}
          />
        </LazyWrapper>
      );
    }

    if (editingItem.type === 'new_project') {
      return (
        <ProjectModal
          companyId={companyId}
          departments={departments}
          onClose={() => setEditingItem(null)}
          onProjectCreated={(project) => {
            // Add the new project to the list
            setProjects(prev => [project, ...prev]);
            setEditingItem(null);
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="mc-overlay" onClick={onClose}>
      <div className="mc-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="mc-header">
          <div className="mc-header-content">
            {/* Title with company name inline */}
            <div className="mc-title-row">
              <h1>
                <span
                  className={`mc-status-indicator ${pendingDecisionsCount === 0 ? 'all-good' : pendingDecisionsCount > 0 ? 'pending' : ''}`}
                  title={pendingDecisionsCount === 0 ? 'All decisions promoted' : pendingDecisionsCount > 0 ? `${pendingDecisionsCount} pending decision${pendingDecisionsCount !== 1 ? 's' : ''}` : 'Loading...'}
                />
                {companyName || 'Your Company'}
              </h1>
              <span className="mc-title-suffix">Command Center</span>
            </div>
            {/* Company Switcher - separate row if multiple companies */}
            {allCompanies.length > 1 && (
              <div className="mc-company-switcher">
                <Select value={companyId} onValueChange={(val) => {
                    if (val !== companyId) {
                      onSelectCompany?.(val);
                    }
                  }}>
                  <SelectTrigger 
                    className="h-auto w-auto gap-2 border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 shadow-none hover:bg-white/15 hover:text-white focus:ring-white/20 data-[state=open]:bg-white/15 data-[state=open]:text-white"
                    style={{ borderRadius: '6px' }}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="mc-switch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M3 12h18" />
                      </svg>
                      <SelectValue placeholder="Switch company" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {allCompanies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <button className="mc-close-btn" onClick={onClose}>&times;</button>
        </header>

        {/* Tabs */}
        <nav className="mc-tabs">
          {[
            { id: 'overview', label: 'Overview', Icon: BarChart3, tooltip: 'Company summary: see your stats, description, and company context at a glance' },
            { id: 'team', label: 'Team', Icon: Users, tooltip: 'Your departments and roles: manage the structure of your organization' },
            { id: 'projects', label: 'Projects', Icon: FolderKanban, tooltip: 'Organize your work: group related council sessions and track progress' },
            { id: 'playbooks', label: 'Playbooks', Icon: BookOpen, tooltip: 'Your knowledge library: SOPs, frameworks, and policies the AI council uses' },
            { id: 'decisions', label: 'Decisions', Icon: Lightbulb, tooltip: 'Saved council outputs: review, archive, or promote decisions to playbooks' },
            { id: 'activity', label: 'Activity', Icon: ClipboardList, tooltip: 'Recent changes: see what happened across your company' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`mc-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.tooltip}
            >
              <tab.Icon size={16} className="mc-tab-icon" />
              <span className="mc-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="mc-content">
          {/* Show skeleton when loading OR when tab-specific data hasn't been fetched yet */}
          {loading ||
           (activeTab === 'overview' && !overviewLoaded) ||
           (activeTab === 'team' && !teamLoaded) ||
           (activeTab === 'playbooks' && !playbooksLoaded) ||
           (activeTab === 'decisions' && !decisionsLoaded) ||
           (activeTab === 'projects' && !projectsLoaded) ||
           (activeTab === 'activity' && !activityLoaded) ? (
            <div className="mc-skeleton-container">
              {/* Skeleton loader based on active tab */}
              {activeTab === 'projects' && (
                <>
                  {/* Stats row skeleton */}
                  <div className="mc-skeleton-stats">
                    {[1,2,3,4].map(i => (
                      <Skeleton key={i} width={140} height={80} style={{ borderRadius: 12 }} />
                    ))}
                  </div>
                  {/* Filter bar skeleton */}
                  <div className="mc-skeleton-filters">
                    <Skeleton width={120} height={36} />
                    <Skeleton width={150} height={36} />
                    <Skeleton width={100} height={36} style={{ marginLeft: 'auto' }} />
                  </div>
                  {/* Project rows skeleton */}
                  <div className="mc-skeleton-list">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="mc-skeleton-row">
                        <Skeleton variant="circular" width={10} height={10} />
                        <Skeleton width="40%" height={16} />
                        <Skeleton width={70} height={24} style={{ borderRadius: 12 }} />
                        <Skeleton width={60} height={14} style={{ marginLeft: 'auto' }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'playbooks' && (
                <>
                  <div className="mc-skeleton-stats">
                    {[1,2,3,4].map(i => (
                      <Skeleton key={i} width={140} height={80} style={{ borderRadius: 12 }} />
                    ))}
                  </div>
                  <div className="mc-skeleton-list">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="mc-skeleton-row">
                        <Skeleton variant="circular" width={8} height={8} />
                        <Skeleton width="35%" height={16} />
                        <Skeleton width={80} height={24} style={{ borderRadius: 12 }} />
                        <Skeleton width={60} height={24} style={{ borderRadius: 12 }} />
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
                    {[1,2,3,4].map(i => (
                      <div key={i} className="mc-skeleton-row">
                        <Skeleton variant="circular" width={8} height={8} />
                        <Skeleton width="50%" height={16} />
                        <Skeleton width={70} height={24} style={{ borderRadius: 12 }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {activeTab === 'activity' && (
                <>
                  <div className="mc-skeleton-filters">
                    <Skeleton width={80} height={14} />
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      {[1,2,3,4].map(i => (
                        <Skeleton key={i} width={80} height={28} style={{ borderRadius: 16 }} />
                      ))}
                    </div>
                  </div>
                  <div className="mc-skeleton-list">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="mc-skeleton-row">
                        <Skeleton variant="circular" width={8} height={8} />
                        <Skeleton width="45%" height={16} />
                        <Skeleton width={70} height={22} style={{ borderRadius: 12 }} />
                        <Skeleton width={50} height={22} style={{ borderRadius: 12 }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {(activeTab === 'overview' || activeTab === 'team') && (
                <>
                  <div className="mc-skeleton-stats">
                    {[1,2,3].map(i => (
                      <Skeleton key={i} width={200} height={100} style={{ borderRadius: 12 }} />
                    ))}
                  </div>
                  <div className="mc-skeleton-list">
                    {[1,2,3].map(i => (
                      <div key={i} className="mc-skeleton-row">
                        <Skeleton width="60%" height={18} />
                        <Skeleton width={100} height={14} style={{ marginLeft: 'auto' }} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : error ? (
            <div className="mc-error">
              <p>{error}</p>
              <button onClick={loadData}>Retry</button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  overview={overview}
                  companyName={companyName}
                  onEditContext={(data) => setEditingItem({ type: 'company-context', data })}
                  onViewContext={(data) => setEditingItem({ type: 'company-context-view', data })}
                />
              )}
              {activeTab === 'team' && (
                <TeamTab
                  departments={departments}
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
                  projects={projects}
                  departments={departments}
                  projectsLoaded={projectsLoaded}
                  loading={loading}
                  projectStatusFilter={projectStatusFilter}
                  projectDeptFilter={projectDeptFilter}
                  projectSortBy={projectSortBy}
                  fadingProjectId={fadingProjectId}
                  confirmingDeleteProjectId={confirmingDeleteProjectId}
                  onStatusFilterChange={setProjectStatusFilter}
                  onDeptFilterChange={setProjectDeptFilter}
                  onSortByChange={setProjectSortBy}
                  onConfirmingDeleteChange={setConfirmingDeleteProjectId}
                  onAddProject={() => setEditingItem({ type: 'new_project', data: {} })}
                  onProjectClick={handleProjectClick}
                  onCompleteProject={handleCompleteProject}
                  onArchiveProject={handleArchiveProject}
                  onRestoreProject={handleRestoreProject}
                  onDeleteProject={handleDeleteProject}
                />
              )}
              {activeTab === 'playbooks' && (
                <PlaybooksTab
                  playbooks={playbooks}
                  departments={departments}
                  playbookTypeFilter={playbookTypeFilter}
                  playbookDeptFilter={playbookDeptFilter}
                  expandedTypes={expandedTypes}
                  onTypeFilterChange={setPlaybookTypeFilter}
                  onDeptFilterChange={setPlaybookDeptFilter}
                  onExpandedTypesChange={setExpandedTypes}
                  onAddPlaybook={() => setShowAddForm('playbook')}
                  onViewPlaybook={(doc) => setEditingItem({ type: 'playbook', data: doc })}
                  onArchivePlaybook={handleArchivePlaybook}
                  onDeletePlaybook={handleDeletePlaybook}
                />
              )}
              {activeTab === 'decisions' && (
                <DecisionsTab
                  decisions={decisions}
                  departments={departments}
                  decisionDeptFilter={decisionDeptFilter}
                  decisionSearch={decisionSearch}
                  deletingDecisionId={deletingDecisionId}
                  onDeptFilterChange={setDecisionDeptFilter}
                  onSearchChange={setDecisionSearch}
                  onPromoteDecision={handlePromoteDecision}
                  onDeleteDecision={handleDeleteDecision}
                  onNavigateToConversation={onNavigateToConversation}
                />
              )}
              {activeTab === 'activity' && (
                <ActivityTab
                  activityLogs={activityLogs}
                  activityLoaded={activityLoaded}
                  activityHasMore={activityHasMore}
                  activityLoadingMore={activityLoadingMore}
                  onActivityClick={handleActivityClick}
                  onLoadMore={handleLoadMoreActivity}
                  onNavigateToConversation={onNavigateToConversation}
                />
              )}
            </>
          )}
        </div>

        {/* Modals */}
        {renderAddForm()}
        {renderEditingModal()}

        {/* Promote Decision Modal */}
        {promoteModal && (
          <Suspense fallback={<ModalLoadingFallback />}>
            <PromoteDecisionModal
              decision={promoteModal}
              departments={departments}
              projects={projects}
              companyId={companyId}
              onPromote={handleConfirmPromote}
              onClose={() => setPromoteModal(null)}
              saving={saving}
              onViewSource={(convId) => {
                // Store the decision so we can re-open the modal when returning
                const decisionToRestore = promoteModal;
                setPromoteModal(null);
                if (onNavigateToConversation) {
                  // Pass the decision object as 3rd argument to restore modal on return
                  onNavigateToConversation(convId, 'decisions', decisionToRestore);
                }
              }}
            />
          </Suspense>
        )}

        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            variant={confirmModal.variant}
            onConfirm={handleConfirmAction}
            onCancel={() => setConfirmModal(null)}
            processing={saving}
          />
        )}
      </div>
    </div>
  );
}
