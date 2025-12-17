import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { AIWriteAssist } from './ui/AIWriteAssist';
import { Building2, ScrollText, Layers, FileText, Bookmark, FolderKanban, CheckCircle, Archive, RotateCcw, ExternalLink, Trash2, Sparkles, PenLine, RefreshCw } from 'lucide-react';
import { getDeptColor, getPlaybookTypeColor } from '../lib/colors';
import smartTextToMarkdown, { isAlreadyMarkdown } from '../lib/smartTextToMarkdown';
import { truncateText } from '../lib/utils';
import './MyCompany.css';

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

  // Projects filter state
  const [projectStatusFilter, setProjectStatusFilter] = useState('active'); // 'active', 'completed', 'archived', 'all'
  const [projectDeptFilter, setProjectDeptFilter] = useState([]); // Array of department IDs for multi-select
  const [projectSortBy, setProjectSortBy] = useState('updated'); // 'updated', 'created', 'name', 'decisions'
  const [showArchived, setShowArchived] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false); // Track if projects have been fetched at least once

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
          break;
        }
        case 'team': {
          const data = await api.getCompanyTeam(companyId);
          setDepartments(data.departments || []);
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
          break;
        }
        case 'decisions': {
          // Single API call - departments embedded in response
          const decisionsData = await api.getCompanyDecisions(companyId);
          setDecisions(decisionsData.decisions || []);
          // Use departments from decisions endpoint
          if (decisionsData.departments) {
            setDepartments(decisionsData.departments.map(d => ({ ...d, roles: [] })));
          }
          break;
        }
        case 'activity': {
          // Single API call for activity logs
          const activityData = await api.getCompanyActivity(companyId);
          setActivityLogs(activityData.logs || []);
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
    setProjectsLoaded(false); // Reset loaded flag so we show loading state for new company
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
        const pending = allDecisions.filter(d => !d.is_promoted);
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
      const pending = decisions.filter(d => !d.is_promoted);
      setPendingDecisionsCount(pending.length);
    }
  }, [decisions, activeTab]);

  // Count stats
  const totalRoles = departments.reduce((sum, dept) => sum + (dept.roles?.length || 0), 0);

  // Parse metadata from context markdown (Last Updated, Version)
  const parseContextMetadata = (contextMd) => {
    if (!contextMd) return { lastUpdated: null, version: null };

    // Look for patterns like "> **Last Updated:** 2025-12-16" and "> **Version:** 1.2"
    const lastUpdatedMatch = contextMd.match(/\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    const versionMatch = contextMd.match(/\*\*Version:\*\*\s*([\d.]+)/);

    // Format date as "December 16, 2025" (works for US and EU readers)
    let formattedDate = null;
    if (lastUpdatedMatch) {
      const date = new Date(lastUpdatedMatch[1] + 'T00:00:00');
      formattedDate = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }

    return {
      lastUpdated: formattedDate,
      version: versionMatch ? versionMatch[1] : null
    };
  };

  // Tab content renderers
  const renderOverview = () => {
    if (!overview) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">🏢</div>
          <p className="mc-empty-title">No company data</p>
          <p className="mc-empty-hint">Company information will appear here</p>
        </div>
      );
    }

    const contextMd = overview.company?.context_md || '';
    const { lastUpdated, version } = parseContextMetadata(contextMd);

    return (
      <div className="mc-overview">
        {/* Hero section - immediately explains what this is */}
        <div className="mc-overview-hero">
          <div className="mc-overview-hero-content">
            <h2 className="mc-overview-title">{companyName} Business Context</h2>
            <p className="mc-overview-description">
              This document defines your company's mission, goals, constraints, and strategic decisions.
              When selected, it's injected into Council conversations to provide relevant, contextual advice.
            </p>
          </div>
          <div className="mc-overview-meta">
            {lastUpdated && (
              <div className="mc-meta-item">
                <span className="mc-meta-label">Last Updated</span>
                <span className="mc-meta-value">{lastUpdated}</span>
              </div>
            )}
            {version && (
              <div className="mc-meta-item">
                <span className="mc-meta-label">Version</span>
                <span className="mc-meta-value">{version}</span>
              </div>
            )}
            <button
              className="mc-btn primary small"
              onClick={() => setEditingItem({
                type: 'company-context',
                data: {
                  id: overview.company?.id,
                  context_md: contextMd
                }
              })}
            >
              Edit Context
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mc-stats-grid">
          <div className="mc-stat-card">
            <div className="mc-stat-value">{overview.stats?.departments || 0}</div>
            <div className="mc-stat-label">Departments</div>
          </div>
          <div className="mc-stat-card">
            <div className="mc-stat-value">{overview.stats?.roles || 0}</div>
            <div className="mc-stat-label">Roles</div>
          </div>
          <div className="mc-stat-card">
            <div className="mc-stat-value">{overview.stats?.playbooks || 0}</div>
            <div className="mc-stat-label">Playbooks</div>
          </div>
          <div className="mc-stat-card">
            <div className="mc-stat-value">{overview.stats?.decisions || 0}</div>
            <div className="mc-stat-label">Decisions</div>
          </div>
        </div>

        {/* Context content */}
        <div className="mc-context-section">
          <div className="mc-context-section-header">
            <h3>Document Preview</h3>
            {contextMd && (
              <button
                className="mc-expand-btn"
                onClick={() => setEditingItem({
                  type: 'company-context-view',
                  data: {
                    id: overview.company?.id,
                    context_md: contextMd
                  }
                })}
                title="Expand"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H5.414l4.293 4.293a1 1 0 01-1.414 1.414L4 6.414V9a1 1 0 01-2 0V4zm9 1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 11-2 0V6.414l-4.293 4.293a1 1 0 01-1.414-1.414L14.586 5H12a1 1 0 01-1-1zm-9 10a1 1 0 011-1h2.586l4.293-4.293a1 1 0 011.414 1.414L8.414 15H11a1 1 0 110 2H4a1 1 0 01-1-1v-5z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
          <div className="mc-context-content">
            {contextMd ? (
              <MarkdownViewer content={contextMd} />
            ) : (
              <div className="mc-empty-context">
                <p className="mc-empty-title">No business context defined yet</p>
                <p className="mc-empty-hint">Click "Edit Context" above to add your company's mission, goals, strategy, and other important information that the AI Council should know.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTeam = () => {
    if (departments.length === 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">👥</div>
          <p className="mc-empty-title">No departments yet</p>
          <p className="mc-empty-hint">Add your first department to organize your AI council</p>
          <button
            className="mc-btn primary"
            onClick={() => setShowAddForm('department')}
          >
            + Add Department
          </button>
        </div>
      );
    }

    return (
      <div className="mc-team">
        <div className="mc-team-header">
          <span>{departments.length} departments • {totalRoles} roles</span>
          <button
            className="mc-btn primary small"
            onClick={() => setShowAddForm('department')}
          >
            + Add Department
          </button>
        </div>

        <div className="mc-elegant-list">
          {departments.map(dept => {
            const deptColors = getDeptColor(dept.id);
            const isExpanded = expandedDept === dept.id;

            return (
              <div key={dept.id} className="mc-dept-container">
                <div
                  className={`mc-elegant-row mc-dept-row ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                >
                  {/* Department color indicator */}
                  <div
                    className="mc-dept-indicator"
                    style={{ background: deptColors.text }}
                  />

                  {/* Main content */}
                  <div className="mc-elegant-content">
                    <span className="mc-elegant-title">{dept.name}</span>
                    <span className="mc-elegant-meta">{dept.roles?.length || 0} roles</span>
                  </div>

                  {/* Expand icon */}
                  <div className="mc-elegant-actions">
                    <span className={`mc-expand-chevron ${isExpanded ? 'expanded' : ''}`}>
                      ›
                    </span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mc-dept-expanded-content">
                    {/* Department context button */}
                    <button
                      className="mc-context-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem({ type: 'department', data: dept });
                      }}
                    >
                      <span className="mc-context-icon">📄</span>
                      <span>View Context</span>
                      {dept.context_md && (
                        <span className="mc-context-size">{Math.round(dept.context_md.length / 1000)}k</span>
                      )}
                    </button>

                    {/* Roles list */}
                    <div className="mc-roles-section">
                      <div className="mc-roles-header">
                        <span className="mc-roles-label">Roles</span>
                        <button
                          className="mc-text-btn add"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAddForm({ type: 'role', deptId: dept.id });
                          }}
                        >
                          + Add
                        </button>
                      </div>

                      {dept.roles && dept.roles.length > 0 ? (
                        <div className="mc-roles-list">
                          {dept.roles.map(role => (
                            <div
                              key={role.id}
                              className="mc-role-row"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem({ type: 'role', data: { ...role, departmentName: dept.name, departmentId: dept.id } });
                              }}
                            >
                              <span className="mc-role-name">{role.name}</span>
                              {role.title && (
                                <span className="mc-role-title">{role.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mc-no-roles">No roles defined</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPlaybooks = () => {
    // Calculate stats from ALL playbooks (for stat cards)
    const allSops = playbooks.filter(p => p.doc_type === 'sop');
    const allFrameworks = playbooks.filter(p => p.doc_type === 'framework');
    const allPolicies = playbooks.filter(p => p.doc_type === 'policy');

    // Filter playbooks based on search and filters (client-side)
    const filteredPlaybooks = playbooks
      .filter(pb => {
        const matchesSearch = !playbookSearch ||
          pb.title.toLowerCase().includes(playbookSearch.toLowerCase());
        const matchesType = playbookTypeFilter === 'all' || pb.doc_type === playbookTypeFilter;
        // Multi-select department filter
        const matchesDept = playbookDeptFilter.length === 0 ||
          playbookDeptFilter.includes(pb.department_id) ||
          (pb.additional_departments || []).some(id => playbookDeptFilter.includes(id));
        const matchesTag = playbookTagFilter === 'all' ||
          (pb.tags && pb.tags.includes(playbookTagFilter));
        return matchesSearch && matchesType && matchesDept && matchesTag;
      })
      .sort((a, b) => a.title.localeCompare(b.title)); // Alphabetical order

    const docTypes = ['sop', 'framework', 'policy'];
    const typeLabels = {
      sop: 'Standard Operating Procedures',
      framework: 'Frameworks',
      policy: 'Policies'
    };

    // Group filtered playbooks by type
    const groupedPlaybooks = docTypes.reduce((acc, type) => {
      acc[type] = filteredPlaybooks.filter(p => p.doc_type === type);
      return acc;
    }, {});

    if (playbooks.length === 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">📚</div>
          <p className="mc-empty-title">No playbooks yet</p>
          <p className="mc-empty-hint">Create SOPs, frameworks, and policies for your AI council</p>
          <button
            className="mc-btn primary"
            onClick={() => setShowAddForm('playbook')}
          >
            + Create Playbook
          </button>
        </div>
      );
    }

    return (
      <div className="mc-playbooks">
        {/* Stats grid - clickable filters like Projects tab */}
        <div className="mc-stats-grid">
          <div
            className={`mc-stat-card ${playbookTypeFilter === 'all' ? 'selected' : ''}`}
            onClick={() => setPlaybookTypeFilter('all')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#059669' }}>{playbooks.length}</div>
            <div className="mc-stat-label">Total</div>
          </div>
          <div
            className={`mc-stat-card ${playbookTypeFilter === 'sop' ? 'selected' : ''}`}
            onClick={() => setPlaybookTypeFilter(playbookTypeFilter === 'sop' ? 'all' : 'sop')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#1d4ed8' }}>{allSops.length}</div>
            <div className="mc-stat-label">SOPs</div>
          </div>
          <div
            className={`mc-stat-card ${playbookTypeFilter === 'framework' ? 'selected' : ''}`}
            onClick={() => setPlaybookTypeFilter(playbookTypeFilter === 'framework' ? 'all' : 'framework')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#b45309' }}>{allFrameworks.length}</div>
            <div className="mc-stat-label">Frameworks</div>
          </div>
          <div
            className={`mc-stat-card ${playbookTypeFilter === 'policy' ? 'selected' : ''}`}
            onClick={() => setPlaybookTypeFilter(playbookTypeFilter === 'policy' ? 'all' : 'policy')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#6d28d9' }}>{allPolicies.length}</div>
            <div className="mc-stat-label">Policies</div>
          </div>
        </div>

        {/* Filters row - multi-department and search */}
        <div className="mc-projects-filters">
          <div className="mc-filters-left">
            <MultiDepartmentSelect
              value={playbookDeptFilter}
              onValueChange={setPlaybookDeptFilter}
              departments={departments}
              placeholder="All Depts"
            />
          </div>
          <button
            className="mc-btn-clean primary"
            onClick={() => setShowAddForm('playbook')}
          >
            <svg style={{ width: '14px', height: '14px', marginRight: '4px' }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Playbook
          </button>
        </div>

        {filteredPlaybooks.length === 0 ? (
          <div className="mc-empty-filtered">
            No playbooks match your filters
          </div>
        ) : (
          docTypes.map(type => {
            const docs = groupedPlaybooks[type];
            if (docs.length === 0) return null;

            const MAX_VISIBLE = 5;
            const isExpanded = expandedTypes[type];
            const visibleDocs = isExpanded ? docs : docs.slice(0, MAX_VISIBLE);
            const hasMore = docs.length > MAX_VISIBLE;

            return (
              <div key={type} className="mc-playbook-group">
                <h4 className="mc-group-title">
                  {typeLabels[type]}
                  <span className="mc-group-count">({docs.length})</span>
                </h4>
                <div className="mc-elegant-list">
                  {visibleDocs.map(doc => {
                    // Use embedded department name (or fallback to lookup for backwards compat)
                    const dept = doc.department_name
                      ? { id: doc.department_id, name: doc.department_name, slug: doc.department_slug }
                      : departments.find(d => d.id === doc.department_id);
                    // Find additional department names
                    const additionalDepts = (doc.additional_departments || [])
                      .map(deptId => departments.find(d => d.id === deptId))
                      .filter(Boolean);

                    // All departments for this playbook
                    const allDepts = [dept, ...additionalDepts].filter(Boolean);

                    // Doc type labels
                    const typeLabel = { sop: 'SOP', framework: 'Framework', policy: 'Policy' }[doc.doc_type] || doc.doc_type;

                    return (
                      <div
                        key={doc.id}
                        className="mc-elegant-row"
                        onClick={() => setEditingItem({ type: 'playbook', data: doc })}
                      >
                        {/* Type indicator dot */}
                        <div className={`mc-type-dot ${doc.doc_type}`} />

                        {/* Main content */}
                        <div className="mc-elegant-content">
                          <span className="mc-elegant-title">{doc.title}</span>

                          {/* Department badges */}
                          {allDepts.map(d => {
                            const color = getDeptColor(d.id);
                            return (
                              <span
                                key={d.id}
                                className="mc-elegant-dept"
                                style={{
                                  background: color.bg,
                                  color: color.text
                                }}
                              >
                                {d.name}
                              </span>
                            );
                          })}
                          {allDepts.length === 0 && (
                            <span className="mc-elegant-dept mc-elegant-dept-none">
                              Company-wide
                            </span>
                          )}

                          {/* Type badge */}
                          <span className={`mc-elegant-badge ${doc.doc_type}`}>{typeLabel}</span>
                        </div>

                        {/* Actions on hover - Archive and Delete */}
                        <div className="mc-elegant-actions">
                          <button
                            className="mc-text-btn archive"
                            onClick={(e) => { e.stopPropagation(); handleArchivePlaybook(doc); }}
                            title="Archive playbook"
                          >
                            Archive
                          </button>
                          <button
                            className="mc-text-btn delete"
                            onClick={(e) => { e.stopPropagation(); handleDeletePlaybook(doc); }}
                            title="Delete playbook"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Load more / Show less button */}
                {hasMore && (
                  <button
                    className="mc-load-more-btn"
                    onClick={() => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }))}
                  >
                    {isExpanded ? `Show less` : `Load more (${docs.length - MAX_VISIBLE} more)`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // Format relative time for last accessed
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Handle project status change
  const handleProjectStatusChange = async (project, newStatus) => {
    try {
      setSaving(true);
      await api.updateProject(project.id, { status: newStatus });
      // Refresh projects list
      loadData();
    } catch (err) {
      console.error('Failed to update project status:', err);
      alert('Failed to update project status');
    } finally {
      setSaving(false);
    }
  };

  // Handle opening project details/edit modal
  const handleProjectClick = (project) => {
    setEditingItem({ type: 'project', data: project });
  };

  const renderProjects = () => {
    // Show loading state until we've fetched at least once - prevents flash of "No projects"
    if (!projectsLoaded || (loading && projects.length === 0)) {
      return (
        <div className="mc-empty">
          <Spinner size="lg" variant="brand" />
          <p className="mc-empty-title">Loading projects...</p>
        </div>
      );
    }

    if (projects.length === 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">📁</div>
          <p className="mc-empty-title">No projects yet</p>
          <p className="mc-empty-hint">
            Create projects to organize council sessions and track decisions.
            Projects help you maintain context across related queries.
          </p>
        </div>
      );
    }

    // Calculate stats from ALL projects (for display in stat cards)
    const allActiveProjects = projects.filter(p => p.status === 'active');
    const allCompletedProjects = projects.filter(p => p.status === 'completed');
    const allArchivedProjects = projects.filter(p => p.status === 'archived');
    const totalDecisions = projects.reduce((sum, p) => sum + (p.decision_count || 0), 0);

    // Client-side filtering - no API reload needed
    let filteredProjects = projects;

    // Filter by status (client-side)
    if (projectStatusFilter !== 'all') {
      filteredProjects = filteredProjects.filter(p => p.status === projectStatusFilter);
    }

    // Filter by department (client-side, multi-select)
    if (projectDeptFilter.length > 0) {
      filteredProjects = filteredProjects.filter(p =>
        projectDeptFilter.includes(p.department_id) ||
        p.department_ids?.some(id => projectDeptFilter.includes(id))
      );
    }

    // Sort projects (client-side)
    const sortedProjects = [...filteredProjects].sort((a, b) => {
      switch (projectSortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'created':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'decisions':
          return (b.decision_count || 0) - (a.decision_count || 0);
        case 'updated':
        default:
          return new Date(b.last_accessed_at || b.updated_at || b.created_at) -
                 new Date(a.last_accessed_at || a.updated_at || a.created_at);
      }
    });

    // Compact project row - consistent with decisions/playbooks
    const renderProjectRow = (project) => {
      // Get all departments for this project - show ALL, no truncation
      const deptIds = project.department_ids?.length > 0
        ? project.department_ids
        : project.department_id ? [project.department_id] : [];
      const deptNames = project.department_names || [];
      const isFading = fadingProjectId === project.id;

      return (
        <div
          key={project.id}
          className={`mc-project-row-compact ${isFading ? 'fading' : ''}`}
          onClick={() => !isFading && handleProjectClick(project)}
        >
          {/* Status indicator dot */}
          <div className={`mc-status-dot ${project.status}`} />

          {/* Title group: name + ALL department badges */}
          <div className="mc-project-title-group">
            <span className="mc-project-name">{project.name}</span>
            {deptIds.map((deptId, idx) => {
              const deptName = deptNames[idx] || departments.find(d => d.id === deptId)?.name;
              if (!deptName) return null;
              return (
                <span
                  key={deptId}
                  className="mc-project-dept-badge"
                  style={{
                    background: getDeptColor(deptId).bg,
                    color: getDeptColor(deptId).text,
                  }}
                >
                  {deptName}
                </span>
              );
            })}
          </div>

          {/* Meta: decision count + time - hidden on hover when actions show */}
          <div className="mc-project-meta">
            <span className="mc-project-decision-count">
              {project.decision_count || 0}
            </span>
            <span className="mc-project-time">
              {formatRelativeTime(project.last_accessed_at || project.updated_at)}
            </span>
          </div>

          {/* Actions - visible on hover */}
          <div className="mc-project-actions">
            {project.status === 'active' && (
              <button
                className="mc-project-action complete"
                onClick={(e) => handleCompleteProject(project, e)}
                title="Mark as completed"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Complete</span>
              </button>
            )}
            {project.status === 'archived' ? (
              <button
                className="mc-project-action restore"
                onClick={(e) => handleRestoreProject(project, e)}
                title="Restore project"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            ) : (
              <button
                className="mc-project-action archive"
                onClick={(e) => handleArchiveProject(project, e)}
                title="Archive project"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}
            {confirmingDeleteProjectId === project.id ? (
              <>
                <button
                  className="mc-project-action confirm-yes"
                  onClick={(e) => handleDeleteProject(project, e)}
                  title="Confirm delete"
                >
                  <span>Yes</span>
                </button>
                <button
                  className="mc-project-action confirm-no"
                  onClick={(e) => { e.stopPropagation(); setConfirmingDeleteProjectId(null); }}
                  title="Cancel"
                >
                  <span>No</span>
                </button>
              </>
            ) : (
              <button
                className="mc-project-action delete"
                onClick={(e) => handleDeleteProject(project, e)}
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="mc-projects">
        {/* Stats grid - same style as Overview tab */}
        <div className="mc-stats-grid">
          <div
            className={`mc-stat-card ${projectStatusFilter === 'active' ? 'selected' : ''}`}
            onClick={() => setProjectStatusFilter(projectStatusFilter === 'active' ? 'all' : 'active')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#1d4ed8' }}>{allActiveProjects.length}</div>
            <div className="mc-stat-label">Active</div>
          </div>
          <div
            className={`mc-stat-card ${projectStatusFilter === 'completed' ? 'selected' : ''}`}
            onClick={() => setProjectStatusFilter(projectStatusFilter === 'completed' ? 'all' : 'completed')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#15803d' }}>{allCompletedProjects.length}</div>
            <div className="mc-stat-label">Completed</div>
          </div>
          <div
            className={`mc-stat-card ${projectStatusFilter === 'archived' ? 'selected' : ''}`}
            onClick={() => setProjectStatusFilter(projectStatusFilter === 'archived' ? 'all' : 'archived')}
            style={{ cursor: 'pointer' }}
          >
            <div className="mc-stat-value" style={{ color: '#6b7280' }}>{allArchivedProjects.length}</div>
            <div className="mc-stat-label">Archived</div>
          </div>
          <div className="mc-stat-card">
            <div className="mc-stat-value" style={{ color: '#b45309' }}>{totalDecisions}</div>
            <div className="mc-stat-label">Decisions</div>
          </div>
        </div>

        {/* Filters row - multi-department and sort */}
        <div className="mc-projects-filters">
          <div className="mc-filters-left">
            <MultiDepartmentSelect
              value={projectDeptFilter}
              onValueChange={setProjectDeptFilter}
              departments={departments}
              placeholder="All Depts"
            />
            <SortSelect
              value={projectSortBy}
              onValueChange={setProjectSortBy}
            />
          </div>
          <button
            className="mc-btn-clean primary"
            onClick={() => setEditingItem({ type: 'new_project', data: {} })}
          >
            <svg style={{ width: '14px', height: '14px', marginRight: '4px' }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Project
          </button>
        </div>

        {/* Projects list */}
        <div className="mc-projects-list">
          {sortedProjects.length === 0 ? (
            <div className="mc-empty-filtered">
              No projects match your filters
            </div>
          ) : (
            sortedProjects.map(renderProjectRow)
          )}
        </div>
      </div>
    );
  };

  const renderDecisions = () => {
    // Filter out promoted decisions - they're now playbooks
    const pendingDecisions = decisions.filter(d => !d.is_promoted);

    if (pendingDecisions.length === 0 && decisions.length > 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">✅</div>
          <p className="mc-empty-title">All decisions promoted!</p>
          <p className="mc-empty-hint">
            All your saved council decisions have been promoted to playbooks.
            Check the Playbooks tab to view them.
          </p>
        </div>
      );
    }

    if (decisions.length === 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">💡</div>
          <p className="mc-empty-title">No decisions saved</p>
          <p className="mc-empty-hint">
            Decisions from council sessions will appear here.
            You can promote important ones to playbooks.
          </p>
        </div>
      );
    }

    return (
      <div className="mc-decisions">
        <div className="mc-elegant-list">
          {pendingDecisions.map(decision => {
            // Use embedded department info (or fallback to lookup for backwards compat)
            const deptName = decision.department_name || departments.find(d => d.id === decision.department_id)?.name;
            const deptId = decision.department_id;

            const isDeleting = deletingDecisionId === decision.id;

            return (
              <div
                key={decision.id}
                className={`mc-elegant-row mc-decision-row ${isDeleting ? 'deleting' : ''}`}
                onClick={() => !isDeleting && handlePromoteDecision(decision)}
              >
                {/* Status indicator - yellow for pending */}
                <div className="mc-status-dot draft" />

                {/* Main content - title + department badges */}
                <div className="mc-elegant-content">
                  <span className="mc-elegant-title">{decision.title}</span>
                  {/* Department badges */}
                  {(decision.department_ids?.length > 0 ? decision.department_ids : (decision.department_id ? [decision.department_id] : [])).map(deptId => {
                    const dept = departments.find(d => d.id === deptId);
                    if (!dept) return null;
                    const color = getDeptColor(deptId);
                    return (
                      <span
                        key={deptId}
                        className="mc-elegant-dept"
                        style={{
                          background: color.bg,
                          color: color.text
                        }}
                      >
                        {dept.name}
                      </span>
                    );
                  })}
                </div>

                {/* Actions - only visible on hover */}
                <div className="mc-elegant-actions">
                  {/* Source link - if has original conversation */}
                  {decision.source_conversation_id && !decision.source_conversation_id.startsWith('temp-') && onNavigateToConversation && (
                    <button
                      className="mc-text-btn source"
                      onClick={(e) => { e.stopPropagation(); onNavigateToConversation(decision.source_conversation_id, 'decisions'); }}
                      title="View original conversation"
                    >
                      Source
                    </button>
                  )}
                  <button
                    className="mc-text-btn promote"
                    onClick={(e) => { e.stopPropagation(); handlePromoteDecision(decision); }}
                  >
                    Promote
                  </button>
                  <button
                    className="mc-text-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteDecision(decision); }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Handle clicking on activity item to view related content
  const handleActivityClick = (log) => {
    if (!log.related_id || !log.related_type) return;

    switch (log.related_type) {
      case 'playbook':
        // Find the playbook and open it
        const playbook = playbooks.find(p => p.id === log.related_id);
        if (playbook) {
          setEditingItem({ type: 'playbook', data: playbook });
        } else {
          // Load playbooks tab and try to find it
          setActiveTab('playbooks');
        }
        break;
      case 'decision':
        const decision = decisions.find(d => d.id === log.related_id);
        if (decision) {
          setEditingItem({ type: 'decision', data: decision });
        } else {
          setActiveTab('decisions');
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

  const renderActivity = () => {
    const EVENT_ICONS = {
      decision: '⭐',
      playbook: '📝',
      role: '👤',
      department: '🏢',
      council_session: '🟢',
      default: '📌'
    };

    const EVENT_LABELS = {
      decision: 'Decision',
      playbook: 'Playbook',
      role: 'Role Change',
      department: 'Department',
      council_session: 'Council Session'
    };

    // Group logs by date
    const groupedLogs = activityLogs.reduce((groups, log) => {
      const date = new Date(log.created_at);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Yesterday';
      } else {
        dateKey = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        });
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
      return groups;
    }, {});

    const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    if (activityLogs.length === 0) {
      return (
        <div className="mc-empty">
          <div className="mc-empty-icon">📋</div>
          <p className="mc-empty-title">No activity yet</p>
          <p className="mc-empty-hint">
            Activity will appear here as you use the council, save decisions, and update playbooks.
          </p>
        </div>
      );
    }

    // Event type colors for dots
    const EVENT_COLORS = {
      decision: '#22c55e',    // Green
      playbook: '#3b82f6',    // Blue
      role: '#8b5cf6',        // Purple
      department: '#f59e0b',  // Amber
      council_session: '#10b981', // Emerald
      default: '#64748b'      // Slate
    };

    // Action colors - consistent across the app
    const ACTION_COLORS = {
      deleted: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },  // Red
      promoted: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' }, // Green
      saved: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },    // Blue
      created: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },  // Green
      updated: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },  // Yellow
      archived: { bg: '#f5f5f4', text: '#78716c', border: '#d6d3d1' }  // Gray
    };

    // Parse action from title (e.g., "Deleted: Title" -> { action: "Deleted", cleanTitle: "Title" })
    const parseTitle = (title) => {
      const match = title?.match(/^(Deleted|Promoted|Saved|Created|Updated|Archived):\s*(.+)$/i);
      if (match) {
        return { action: match[1], cleanTitle: match[2] };
      }
      return { action: null, cleanTitle: title };
    };

    return (
      <div className="mc-activity">
        <div className="mc-activity-header">
          <span>{activityLogs.length} events</span>
        </div>

        {Object.entries(groupedLogs).map(([date, logs]) => (
          <div key={date} className="mc-activity-group">
            <h4 className="mc-group-title">{date}</h4>
            <div className="mc-elegant-list">
              {logs.map(log => {
                const isClickable = log.related_id && log.related_type;
                const dotColor = EVENT_COLORS[log.event_type] || EVENT_COLORS.default;
                const { action, cleanTitle } = parseTitle(log.title);
                const actionColors = action ? ACTION_COLORS[action.toLowerCase()] : null;

                return (
                  <div
                    key={log.id}
                    className={`mc-elegant-row ${isClickable ? '' : 'no-hover'}`}
                    onClick={isClickable ? () => handleActivityClick(log) : undefined}
                  >
                    {/* Event type indicator */}
                    <div
                      className="mc-event-dot"
                      style={{ background: dotColor }}
                    />

                    {/* Main content */}
                    <div className="mc-elegant-content mc-activity-content-wrap">
                      <span className="mc-elegant-title">{cleanTitle}</span>
                      {/* Badges row: Type badge + Action badge */}
                      <div className="mc-activity-badges">
                        <span className="mc-elegant-badge activity-type" style={{ background: `${dotColor}20`, color: dotColor }}>
                          {EVENT_LABELS[log.event_type] || log.event_type}
                        </span>
                        {action && actionColors && (
                          <span
                            className="mc-elegant-badge activity-action"
                            style={{ background: actionColors.bg, color: actionColors.text }}
                          >
                            {action}
                          </span>
                        )}
                      </div>
                      {log.description && (
                        <p className="mc-activity-desc">{log.description}</p>
                      )}
                    </div>

                    {/* Time + Actions */}
                    <div className="mc-elegant-actions">
                      {log.conversation_id && onNavigateToConversation && (
                        <button
                          className="mc-text-btn source"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToConversation(log.conversation_id, 'activity');
                          }}
                        >
                          Source
                        </button>
                      )}
                      <span className="mc-activity-time">{formatTime(log.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Handle promote decision to playbook - opens modal
  const handlePromoteDecision = (decision) => {
    setPromoteModal(decision);
  };

  // Actually promote after user selects type in modal
  const handleConfirmPromote = async (docType, title, departmentId) => {
    if (!promoteModal) return;

    setSaving(true);
    try {
      await api.promoteDecisionToPlaybook(companyId, promoteModal.id, {
        doc_type: docType,
        title: title || promoteModal.title,
        department_id: departmentId || promoteModal.department_id
      });
      setPromoteModal(null);
      // Reload decisions to show promoted status
      await loadData();
    } catch (err) {
      alert('Failed to promote decision: ' + err.message);
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
        alert('Failed to delete decision: ' + err.message);
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
      alert(`Failed to ${confirmModal.type.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${err.message}`);
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
      alert('Failed to create department: ' + err.message);
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
      alert('Failed to create role: ' + err.message);
    }
    setSaving(false);
  };

  // Handle add playbook
  const handleAddPlaybook = async (title, docType, content, departmentId) => {
    setSaving(true);
    try {
      // Generate slug from title
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await api.createCompanyPlaybook(companyId, {
        title,
        slug,
        doc_type: docType,
        content,
        department_id: departmentId || null
      });
      await loadData();
      setShowAddForm(null);
    } catch (err) {
      alert('Failed to create playbook: ' + err.message);
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
      alert('Failed to update role: ' + err.message);
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
      alert('Failed to update department: ' + err.message);
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
      alert('Failed to update company context: ' + err.message);
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
      alert('Failed to update playbook: ' + err.message);
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
      alert('Failed to update project: ' + err.message);
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
      alert('Failed to create project: ' + err.message);
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

  // Render view/edit modals
  const renderEditingModal = () => {
    if (!editingItem) return null;

    if (editingItem.type === 'company-context') {
      return (
        <ViewCompanyContextModal
          data={editingItem.data}
          companyName={companyName}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateCompanyContext}
        />
      );
    }

    if (editingItem.type === 'company-context-view') {
      return (
        <ViewCompanyContextModal
          data={editingItem.data}
          companyName={companyName}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateCompanyContext}
          initialEditing={false}
          fullscreen={true}
        />
      );
    }

    if (editingItem.type === 'department') {
      return (
        <ViewDepartmentModal
          department={editingItem.data}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateDepartment}
        />
      );
    }

    if (editingItem.type === 'role') {
      return (
        <ViewRoleModal
          role={editingItem.data}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdateRole}
        />
      );
    }

    if (editingItem.type === 'playbook') {
      return (
        <ViewPlaybookModal
          playbook={editingItem.data}
          departments={departments}
          onClose={() => setEditingItem(null)}
          onSave={handleUpdatePlaybook}
          startEditing={editingItem.startEditing || false}
        />
      );
    }

    if (editingItem.type === 'decision') {
      return (
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
        />
      );
    }

    if (editingItem.type === 'project') {
      return (
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
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'team', label: 'Team', icon: '👥' },
            { id: 'projects', label: 'Projects', icon: '📁' },
            { id: 'playbooks', label: 'Playbooks', icon: '📚' },
            { id: 'decisions', label: 'Decisions', icon: '💡' },
            { id: 'activity', label: 'Activity', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`mc-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="mc-tab-icon">{tab.icon}</span>
              <span className="mc-tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="mc-content">
          {loading ? (
            <div className="mc-loading">
              <Spinner size="xl" variant="brand" />
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className="mc-error">
              <p>{error}</p>
              <button onClick={loadData}>Retry</button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'team' && renderTeam()}
              {activeTab === 'projects' && renderProjects()}
              {activeTab === 'playbooks' && renderPlaybooks()}
              {activeTab === 'decisions' && renderDecisions()}
              {activeTab === 'activity' && renderActivity()}
            </>
          )}
        </div>

        {/* Modals */}
        {renderAddForm()}
        {renderEditingModal()}

        {/* Promote Decision Modal */}
        {promoteModal && (
          <PromoteDecisionModal
            decision={promoteModal}
            departments={departments}
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

// Add Department Modal
function AddDepartmentModal({ onSave, onClose, saving }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Add Department" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Department Name *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Human Resources"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Description</label>
          <AIWriteAssist
            context="department-description"
            value={description}
            onSuggestion={setDescription}
            additionalContext={name ? `Department: ${name}` : ''}
          >
            <textarea
              className="mc-input-unified mc-textarea-unified"
              placeholder="What does this department do?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              'Create Department'
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

// Add Role Modal
function AddRoleModal({ deptId, onSave, onClose, saving }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(deptId, name.trim(), title.trim());
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Add Role" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Role Name *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., CTO"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Title</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Chief Technology Officer"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              'Create Role'
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

// Add Playbook Modal
function AddPlaybookModal({ onSave, onClose, saving, departments = [] }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('sop');
  const [content, setContent] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const DOC_TYPES = [
    { value: 'sop', label: 'SOP', icon: ScrollText },
    { value: 'framework', label: 'Framework', icon: Layers },
    { value: 'policy', label: 'Policy', icon: FileText }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave(title.trim(), docType, content.trim(), departmentId || null);
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title="Create Playbook" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Title *</label>
          <input
            type="text"
            className="mc-input-unified"
            placeholder="e.g., Customer Onboarding Process"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Department</label>
          <DepartmentSelect
            value={departmentId || 'all'}
            onValueChange={(val) => setDepartmentId(val === 'all' ? '' : val)}
            departments={departments}
            includeAll={true}
            allLabel="Company-wide (All Departments)"
            className="mc-dept-select-modal"
          />
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Type *</label>
          <div className="mc-type-pills-unified">
            {DOC_TYPES.map(type => {
              const Icon = type.icon;
              const isSelected = docType === type.value;
              const colors = getPlaybookTypeColor(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  className={`mc-type-pill-unified ${type.value} ${isSelected ? 'selected' : ''}`}
                  style={isSelected ? {
                    background: colors.bg,
                    color: colors.text,
                    boxShadow: `0 1px 2px ${colors.shadowColor}`
                  } : {}}
                  onClick={() => setDocType(type.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mc-form-unified">
          <label className="mc-label-unified">Content *</label>
          <AIWriteAssist
            context="playbook-content"
            value={content}
            onSuggestion={setContent}
            additionalContext={title ? `Playbook: ${title}` : ''}
            playbookType={docType}
          >
            <textarea
              className="mc-input-unified mc-textarea-unified"
              placeholder="Write your playbook content..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
            />
          </AIWriteAssist>
        </div>
        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="app-modal-btn app-modal-btn-primary"
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Create Playbook
              </>
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

// View/Edit Playbook Modal - Preview-first UX with professional layout
function ViewPlaybookModal({ playbook, departments = [], onClose, onSave, startEditing = false }) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const [editedContent, setEditedContent] = useState(playbook.content || playbook.current_version?.content || '');
  const [editedTitle, setEditedTitle] = useState(playbook.title || '');
  const [selectedDepts, setSelectedDepts] = useState(playbook.additional_departments || []);
  const [saving, setSaving] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  // Format content using local smart converter (no AI needed)
  const handleFormatWithAI = () => {
    if (!editedContent.trim()) return;
    setFormatting(true);

    // Use the local smart text-to-markdown converter
    // Pass forceConvert=true to always process, even if content looks like markdown
    const formatted = smartTextToMarkdown(editedContent, true);
    setEditedContent(formatted);
    setFormatting(false);
  };

  // API returns content directly, not nested in current_version
  const content = playbook.content || playbook.current_version?.content || '';

  // Find owner department name
  const ownerDept = departments.find(d => d.id === playbook.department_id);

  // Get names of linked departments
  const linkedDeptNames = selectedDepts
    .map(id => departments.find(d => d.id === id))
    .filter(Boolean);

  // Filter departments by search
  const filteredDepts = departments.filter(dept =>
    dept.name.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const handleToggleDept = (deptId) => {
    setSelectedDepts(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(playbook.id, {
          title: editedTitle,
          content: editedContent,
          additional_departments: selectedDepts,
          change_summary: 'Updated via My Company interface'
        });
        setIsEditing(false);
        setIsEditingTitle(false);
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsEditingTitle(false);
    setEditedContent(content);
    setEditedTitle(playbook.title || '');
    setSelectedDepts(playbook.additional_departments || []);
    setDeptSearch('');
  };

  // Type badge styling
  const typeStyles = {
    sop: { bg: '#dbeafe', color: '#1d4ed8' },
    framework: { bg: '#fef3c7', color: '#b45309' },
    policy: { bg: '#ede9fe', color: '#6d28d9' }
  };
  const typeStyle = typeStyles[playbook.doc_type] || typeStyles.sop;

  return (
    <AppModal isOpen={true} onClose={onClose} size="lg" showCloseButton={false} contentClassName="mc-modal-no-padding">
      {/* Clean header with title and close */}
      <div className="mc-modal-header-clean">
        <div className="mc-header-title-row">
          {/* Title with pencil on hover - always editable */}
          {isEditingTitle ? (
            <input
              type="text"
              className="mc-title-inline-edit"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
              autoFocus
            />
          ) : (
            <h2
              className="mc-title-display editable"
              onClick={() => setIsEditingTitle(true)}
              title="Click to edit title"
            >
              {editedTitle || playbook.title}
              <svg className="mc-pencil-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </h2>
          )}
        </div>
        <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mc-modal-body">
        {/* Metadata row: Type badge + Department badges together */}
        <div className="mc-playbook-meta-row">
          {/* Type badge */}
          <span
            className="mc-type-badge"
            style={{ background: typeStyle.bg, color: typeStyle.color }}
          >
            {playbook.doc_type.toUpperCase()}
          </span>

          {/* Department badges - inline with type */}
          {isEditing ? (
            <div className="mc-dept-edit-inline">
              <span className="mc-dept-label">Departments:</span>
              {filteredDepts.slice(0, 5).map(dept => {
                const isOwner = dept.id === playbook.department_id;
                const isSelected = selectedDepts.includes(dept.id);
                const color = getDeptColor(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    className={`mc-dept-chip-mini ${isOwner || isSelected ? 'selected' : ''}`}
                    style={isOwner || isSelected ? {
                      background: color.bg,
                      color: color.text,
                      borderColor: color.border
                    } : {}}
                    onClick={() => !isOwner && handleToggleDept(dept.id)}
                    disabled={isOwner}
                  >
                    {dept.name.split(' ')[0]}
                    {isOwner && <span className="mc-owner-star">*</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {ownerDept && (() => {
                const color = getDeptColor(ownerDept.id);
                return (
                  <span
                    className="mc-dept-badge"
                    style={{ background: color.bg, color: color.text, borderColor: color.border }}
                  >
                    {ownerDept.name}
                  </span>
                );
              })()}
              {linkedDeptNames.map(d => {
                const color = getDeptColor(d.id);
                return (
                  <span
                    key={d.id}
                    className="mc-dept-badge"
                    style={{ background: color.bg, color: color.text, borderColor: color.border }}
                  >
                    {d.name}
                  </span>
                );
              })}
              {!ownerDept && linkedDeptNames.length === 0 && (
                <span className="mc-scope-badge company-wide">Company-wide</span>
              )}
            </>
          )}
        </div>

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <div className="mc-editor-toolbar">
                <button
                  className="mc-btn-format-ai"
                  onClick={handleFormatWithAI}
                  disabled={formatting || !editedContent.trim()}
                  title="Convert plain text to formatted Markdown"
                >
                  {formatting ? (
                    <>
                      <svg className="mc-btn-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4m-8-10h4m12 0h4m-5.66-5.66l-2.83 2.83m-5.02 5.02l-2.83 2.83m0-11.32l2.83 2.83m5.02 5.02l2.83 2.83"/>
                      </svg>
                      Formatting...
                    </>
                  ) : (
                    <>
                      <svg className="mc-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                      </svg>
                      Smart Format
                    </>
                  )}
                </button>
                <span className="mc-editor-hint">Converts tables, headers, and lists to Markdown</span>
              </div>
              <textarea
                className="mc-edit-textarea-full"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={18}
                placeholder="Paste any text here... then click Smart Format to convert to Markdown"
                autoFocus={!startEditing}
              />
            </div>
          ) : (
            <div className="mc-content-preview">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No content yet. Click Edit to add content.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button className="app-modal-btn app-modal-btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button className="app-modal-btn app-modal-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>Done</button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}

// ViewPlaybookModal - end of component

// Edit Company Context Modal - starts in edit mode when triggered from Edit button
function ViewCompanyContextModal({ data, companyName, onClose, onSave, initialEditing = true, fullscreen = false }) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [editedContext, setEditedContext] = useState(data.context_md || '');
  const [saving, setSaving] = useState(false);

  const content = data.context_md || '';

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave({ context_md: editedContext });
        setIsEditing(false);
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext(content);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size={fullscreen ? 'full' : 'lg'}
      title="Company Context"
      description="This context is injected into every AI Council conversation."
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="company-context"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={companyName ? `Company: ${companyName}` : ''}
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={20}
                  autoFocus
                  placeholder="Enter your company context here...

Include:
- Mission and vision
- Company stage and goals
- Budget and constraints
- Key decisions and policies
- Team structure
- Any other important context for the AI Council"
                />
              </AIWriteAssist>
            </div>
          ) : (
            <div className="mc-content-preview">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No company context yet. Click Edit to add context.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button className="app-modal-btn app-modal-btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button className="app-modal-btn app-modal-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>Done</button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}

// View Decision Modal
function ViewDecisionModal({ decision, departments = [], playbooks = [], projects = [], onClose, onPromote, onViewProject }) {
  const [copied, setCopied] = useState(false);

  // Copy decision content (not including user question)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(decision.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Format date as "December 12, 2025" - works for US and EU
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get linked playbook (source of truth for promoted decisions)
  const linkedPlaybook = decision.promoted_to_id && playbooks.length > 0
    ? playbooks.find(p => p.id === decision.promoted_to_id)
    : null;

  // Get linked project (if decision was saved as part of a project)
  const linkedProject = decision.project_id && projects.length > 0
    ? projects.find(p => p.id === decision.project_id)
    : null;

  // Decision is "promoted" if it's either a playbook OR a project
  const isAlreadyPromoted = decision.is_promoted || decision.project_id;

  // Get type from linked playbook (always use playbook as source of truth)
  const getTypeLabel = () => {
    const typeLabels = {
      sop: 'SOP',
      framework: 'Framework',
      policy: 'Policy'
    };
    if (linkedPlaybook) {
      return typeLabels[linkedPlaybook.doc_type] || null;
    }
    return null;
  };

  // Get the actual type value for CSS class
  const getTypeValue = () => {
    return linkedPlaybook ? linkedPlaybook.doc_type : null;
  };

  // Get departments from linked playbook (source of truth)
  const getPlaybookDepts = () => {
    if (!linkedPlaybook) return [];

    // Collect all departments the playbook belongs to
    const deptIds = new Set();
    if (linkedPlaybook.department_id) deptIds.add(linkedPlaybook.department_id);
    if (linkedPlaybook.linked_departments) {
      linkedPlaybook.linked_departments.forEach(ld => {
        if (ld.department_id) deptIds.add(ld.department_id);
      });
    }

    // Map to department objects
    return Array.from(deptIds)
      .map(id => departments.find(d => d.id === id))
      .filter(Boolean);
  };

  const typeLabel = getTypeLabel();
  const typeValue = getTypeValue();
  const playbookDepts = getPlaybookDepts();

  return (
    <AppModal isOpen={true} onClose={onClose} title={decision.title} size="lg">
      {/* User question - most important context for understanding what this is about */}
      {decision.user_question && (
        <div className="mc-decision-question">
          <span className="mc-decision-question-label">Question:</span>
          <p className="mc-decision-question-text">{decision.user_question}</p>
        </div>
      )}

      <div className="mc-decision-meta">
        {/* Show project link if decision is linked to a project */}
        {linkedProject ? (
          <div className="mc-promoted-info-row">
            <span className="mc-promoted-label project">
              <span className="icon">📁</span>
              Project
            </span>
            <button
              className="mc-project-link-btn"
              onClick={() => onViewProject && onViewProject(linkedProject.id)}
            >
              {linkedProject.name} →
            </button>
          </div>
        ) : decision.is_promoted ? (
          <div className="mc-promoted-info-row">
            <span className="mc-promoted-label">
              <span className="icon">✓</span>
              Playbook
            </span>
            {typeLabel && (
              <span className={`mc-type-badge ${typeValue}`}>
                {typeLabel}
              </span>
            )}
            {playbookDepts.length > 0 && playbookDepts.map(dept => {
              const color = getDeptColor(dept.id);
              return (
                <span
                  key={dept.id}
                  className="mc-dept-badge"
                  style={{ background: color.bg, color: color.text, borderColor: color.border }}
                >
                  {dept.name}
                </span>
              );
            })}
            {playbookDepts.length === 0 && (
              <span className="mc-scope-badge company-wide">Company-wide</span>
            )}
          </div>
        ) : (
          <span className="mc-pending-label">Saved decision</span>
        )}
        <span className="mc-date">
          {formatDate(decision.created_at)}
        </span>
      </div>
      {decision.tags && decision.tags.length > 0 && (
        <div className="mc-tags">
          {decision.tags.map(tag => (
            <span key={tag} className="mc-tag">{tag}</span>
          ))}
        </div>
      )}
      <div className="mc-decision-content">
        {/* Floating copy button - icon only, matches Stage3 */}
        <button
          className={`mc-content-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy council response"
        >
          {copied ? (
            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
        <MarkdownViewer content={decision.content || ''} />
      </div>
      <AppModal.Footer>
        {/* Only show Promote to Playbook if NOT already a playbook AND NOT linked to a project */}
        {!isAlreadyPromoted && onPromote && (
          <button
            className="mc-btn primary"
            onClick={() => onPromote(decision)}
          >
            <span className="mc-btn-icon">📋</span>
            Promote to Playbook
          </button>
        )}
        <button className="mc-btn" onClick={onClose}>
          Close
        </button>
      </AppModal.Footer>
    </AppModal>
  );
}

// View Department Modal - Preview-first UX with clean design
function ViewDepartmentModal({ department, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(department.context_md || '');
  const [saving, setSaving] = useState(false);

  const content = department.context_md || '';
  const deptColor = getDeptColor(department.id);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave(department.id, { context_md: editedContext });
        setIsEditing(false);
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContext(content);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      badge="DEPARTMENT"
      badgeStyle={{ background: deptColor.bg, color: deptColor.text }}
      title={department.name}
      titleExtra={`${department.roles?.length || 0} roles`}
      description={department.description}
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="department-description"
                value={editedContext}
                onSuggestion={setEditedContext}
                additionalContext={department.name ? `Department: ${department.name}` : ''}
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder="Enter the context documentation for this department..."
                />
              </AIWriteAssist>
            </div>
          ) : (
            <div className="mc-content-preview">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No department context yet. Click Edit to add context.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button className="app-modal-btn app-modal-btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button className="app-modal-btn app-modal-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>Done</button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}

// Promote Decision Modal - Options LEFT, Full Content RIGHT
function PromoteDecisionModal({ decision, departments, onPromote, onClose, saving, onViewSource }) {
  const [docType, setDocType] = useState('sop');
  const [title, setTitle] = useState(decision?.title || '');
  const [departmentId, setDepartmentId] = useState(decision?.department_id || '');

  const DOC_TYPES = [
    { value: 'sop', label: 'SOP', icon: ScrollText, desc: 'Step-by-step procedures' },
    { value: 'framework', label: 'Framework', icon: Layers, desc: 'Conceptual structure' },
    { value: 'policy', label: 'Policy', icon: FileText, desc: 'Rules & guidelines' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onPromote(docType, title.trim(), departmentId || null);
  };

  const hasSource = decision?.source_conversation_id && !decision.source_conversation_id.startsWith('temp-');

  return (
    <AppModal isOpen={true} onClose={onClose} title="Promote to Playbook" size="xl" contentClassName="mc-modal-no-padding">
      <form onSubmit={handleSubmit}>
        <div className="mc-promote-layout-v2">
          {/* LEFT side: Options */}
          <div className="mc-promote-sidebar">
            {/* Title Input */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Title</label>
              <input
                type="text"
                className="mc-input-unified"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Customer Onboarding Process"
                autoFocus
              />
            </div>

            {/* Department selector */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Department</label>
              <DepartmentSelect
                value={departmentId || 'all'}
                onValueChange={(val) => setDepartmentId(val === 'all' ? '' : val)}
                departments={departments || []}
                includeAll={true}
                allLabel="All Departments"
                className="mc-dept-select-modal"
              />
            </div>

            {/* Type selector - vertical cards */}
            <div className="mc-form-unified">
              <label className="mc-label-unified">Playbook Type</label>
              <div className="mc-type-cards">
                {DOC_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = docType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={`mc-type-card ${type.value} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setDocType(type.value)}
                    >
                      <Icon className="mc-type-card-icon" />
                      <div className="mc-type-card-text">
                        <span className="mc-type-card-label">{type.label}</span>
                        <span className="mc-type-card-desc">{type.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source link - compact inline text */}
            {hasSource && onViewSource && (
              <button
                type="button"
                className="mc-source-link-compact"
                onClick={() => onViewSource(decision.source_conversation_id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
                View source
              </button>
            )}
          </div>

          {/* RIGHT side: Full content rendered */}
          <div className="mc-promote-content-full">
            <label className="mc-label-unified">Content</label>
            <div className="mc-promote-content-rendered">
              {decision?.content ? (
                <MarkdownViewer content={decision.content} />
              ) : (
                <p className="mc-no-content">No content available</p>
              )}
            </div>
          </div>
        </div>

        <AppModal.Footer>
          <button type="button" className="app-modal-btn app-modal-btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="app-modal-btn app-modal-btn-primary" disabled={saving || !title.trim()}>
            {saving ? (
              <>
                <Spinner size="sm" variant="muted" />
                Creating...
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Create {DOC_TYPES.find(t => t.value === docType)?.label}
              </>
            )}
          </button>
        </AppModal.Footer>
      </form>
    </AppModal>
  );
}

// Confirmation Modal - Unified style for archive/delete confirmations
function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning', // 'warning' (amber), 'danger' (red), 'info' (purple/brand)
  onConfirm,
  onCancel,
  processing = false
}) {
  const isDanger = variant === 'danger';
  const isInfo = variant === 'info';

  // Icon based on variant
  const renderIcon = () => {
    if (isDanger) {
      // Trash icon for danger
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
        </svg>
      );
    } else if (isInfo) {
      // Sparkles icon for AI/info
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v1m0 16v1m-9-9h1m16 0h1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      );
    } else {
      // Warning triangle for warning
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
  };

  const iconClass = isDanger ? 'danger' : isInfo ? 'info' : 'warning';
  const buttonClass = isDanger ? 'danger' : isInfo ? 'primary' : 'warning';

  return (
    <AppModal isOpen={true} onClose={onCancel} title={title} size="sm">
      <div className={`mc-confirm-icon ${iconClass}`}>
        {renderIcon()}
      </div>
      <p className="mc-confirm-message">{message}</p>
      <AppModal.Footer>
        <button
          type="button"
          className="app-modal-btn app-modal-btn-secondary"
          onClick={onCancel}
          disabled={processing}
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={`app-modal-btn ${buttonClass === 'danger' ? 'app-modal-btn-danger-sm' : buttonClass === 'warning' ? 'app-modal-btn-primary' : 'app-modal-btn-primary'}`}
          onClick={onConfirm}
          disabled={processing}
        >
          {processing ? (
            <>
              <Spinner size="sm" variant="muted" />
              Processing...
            </>
          ) : (
            confirmText
          )}
        </button>
      </AppModal.Footer>
    </AppModal>
  );
}

// Alert Modal - For success/error messages (replaces browser alert())
function AlertModal({
  title,
  message,
  variant = 'success', // 'success', 'error', 'info'
  onClose
}) {
  const iconMap = {
    success: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    error: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    info: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  };

  return (
    <AppModal isOpen={true} onClose={onClose} title={title} size="sm">
      <div className={`mc-alert-icon ${variant}`}>
        {iconMap[variant]}
      </div>
      <p className="mc-alert-message">{message}</p>
      <AppModal.Footer>
        <button
          type="button"
          className={`app-modal-btn ${variant === 'error' ? 'app-modal-btn-danger-sm' : 'app-modal-btn-primary'}`}
          onClick={onClose}
        >
          OK
        </button>
      </AppModal.Footer>
    </AppModal>
  );
}

// View Role Modal - Preview-first UX with clean design
function ViewRoleModal({ role, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(role.system_prompt || '');
  const [saving, setSaving] = useState(false);

  const content = role.system_prompt || '';
  // Get department color if we have a department ID
  const deptColor = role.departmentId ? getDeptColor(role.departmentId) : { bg: '#f3f4f6', text: '#6b7280' };

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      await onSave(role.id, role.departmentId, { system_prompt: editedPrompt });
      setSaving(false);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedPrompt(content);
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      badge="ROLE"
      badgeVariant="purple"
      title={role.name}
      titleExtra={role.departmentName}
      description={role.title}
      contentClassName="mc-modal-no-padding"
    >
      <div className="mc-modal-body">

        {/* Content Section - Preview by default, markdown when editing */}
        <div className="mc-content-section">
          {isEditing ? (
            <div className="mc-edit-full">
              <AIWriteAssist
                context="role-prompt"
                value={editedPrompt}
                onSuggestion={setEditedPrompt}
                additionalContext={role.name ? `Role: ${role.name}${role.title ? ` (${role.title})` : ''}` : ''}
              >
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder="Enter the system prompt for this role..."
                />
              </AIWriteAssist>
            </div>
          ) : (
            <div className="mc-content-preview">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="mc-no-content">No system prompt yet. Click Edit to add one.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AppModal.Footer>
        {isEditing ? (
          <>
            <button className="app-modal-btn app-modal-btn-secondary" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button className="app-modal-btn app-modal-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <>
            {onSave && (
              <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
            <button className="app-modal-btn app-modal-btn-primary" onClick={onClose}>Done</button>
          </>
        )}
      </AppModal.Footer>
    </AppModal>
  );
}


/**
 * ViewProjectModal - View and edit project details including context and decisions timeline
 */
function ViewProjectModal({ project: initialProject, companyId, departments = [], onClose, onSave, isNew = false, onNavigateToConversation, onProjectUpdate, onStatusChange, onDelete }) {
  // Local project state that can be updated after save
  const [project, setProject] = useState(initialProject);

  // State for action confirmations
  const [confirmingAction, setConfirmingAction] = useState(null); // 'complete' | 'archive' | 'restore' | 'delete'
  const [actionLoading, setActionLoading] = useState(false);

  // Alert modal state (local to this component)
  const [alertModal, setAlertModal] = useState(null); // { title, message, variant }

  const [isEditing, setIsEditing] = useState(isNew);
  const [editedName, setEditedName] = useState(project.name || '');
  const [editedDescription, setEditedDescription] = useState(project.description || '');
  const [editedContext, setEditedContext] = useState(project.context_md || '');
  const [editedStatus, setEditedStatus] = useState(project.status || 'active');
  // Use department_ids array (with fallback to single department_id for backwards compatibility)
  const [editedDepartmentIds, setEditedDepartmentIds] = useState(
    project.department_ids?.length > 0 ? project.department_ids :
    project.department_id ? [project.department_id] : []
  );
  const [saving, setSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(isNew);

  // Tab state for Context vs Decisions
  const [activeTab, setActiveTab] = useState('context'); // 'context' | 'decisions'

  // Decisions timeline state
  const [projectDecisions, setProjectDecisions] = useState([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [expandedDecisionId, setExpandedDecisionId] = useState(null);
  const [generatingSummaryId, setGeneratingSummaryId] = useState(null);

  // Regenerate context state
  const [regenerating, setRegenerating] = useState(false);

  // Copy context state
  const [contextCopied, setContextCopied] = useState(false);

  // Check if a summary is garbage and needs regeneration
  // NOTE: New decisions get summaries at save time (in merge endpoint).
  // This check is only for LEGACY decisions saved before that feature was added.
  const isGarbageSummary = (summary) => {
    if (!summary) return true;
    const garbageTexts = [
      'added council decision to project',
      'decision merged into project',
      'added new council decision section'
    ];
    const lowerSummary = summary.toLowerCase().trim();
    return garbageTexts.includes(lowerSummary) || summary.length < 50;
  };

  // Handle expanding a decision - only regenerate summaries for legacy decisions without one
  // New decisions should already have summaries (generated at save time)
  const handleExpandDecision = async (decisionId) => {
    if (expandedDecisionId === decisionId) {
      // Collapsing
      setExpandedDecisionId(null);
      return;
    }

    // Expanding
    setExpandedDecisionId(decisionId);

    // LEGACY FALLBACK: Only regenerate for old decisions without proper summaries
    // New decisions get summaries at save time, so this should rarely trigger
    const decision = projectDecisions.find(d => d.id === decisionId);
    const needsRegeneration = decision && decision.user_question && isGarbageSummary(decision.decision_summary);

    if (needsRegeneration) {
      console.log('[MyCompany] Legacy decision needs summary:', decisionId, 'current:', decision.decision_summary);
      setGeneratingSummaryId(decisionId);
      try {
        const result = await api.generateDecisionSummary(companyId, decisionId);
        console.log('[MyCompany] Generated summary result:', result);
        if (result && !result.cached) {
          // Update the decision in state with both new summary and title
          setProjectDecisions(prev => prev.map(d =>
            d.id === decisionId ? {
              ...d,
              decision_summary: result.summary || d.decision_summary,
              title: result.title || d.title
            } : d
          ));
        }
      } catch (err) {
        console.error('Failed to generate summary:', err);
      } finally {
        setGeneratingSummaryId(null);
      }
    }
  };

  // Group decisions by conversation for visual linking
  const groupedDecisions = useMemo(() => {
    if (!projectDecisions.length) return [];

    // Create groups - decisions with same source_conversation_id are grouped together
    const groups = [];
    let currentGroup = null;

    // Sort by created_at to ensure chronological order
    const sorted = [...projectDecisions].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    sorted.forEach(decision => {
      const convId = decision.source_conversation_id;

      if (!convId) {
        // No conversation - standalone decision
        groups.push({ type: 'single', decisions: [decision] });
        currentGroup = null;
      } else if (currentGroup && currentGroup.conversationId === convId) {
        // Same conversation as current group
        currentGroup.decisions.push(decision);
      } else {
        // New conversation group
        currentGroup = {
          type: 'group',
          conversationId: convId,
          decisions: [decision]
        };
        groups.push(currentGroup);
      }
    });

    return groups;
  }, [projectDecisions]);

  const content = project.context_md || '';

  // Get department names for display
  const getDepartmentNames = () => {
    if (!editedDepartmentIds || editedDepartmentIds.length === 0) return null;
    return editedDepartmentIds
      .map(id => departments.find(d => d.id === id)?.name)
      .filter(Boolean);
  };

  // Handle regenerating project context from all decisions
  const [regenCountdown, setRegenCountdown] = useState(null); // null = not counting, 3/2/1 = counting down
  const countdownRef = useRef(null);

  const handleRegenerateContext = () => {
    if (!project.id || regenerating) return;
    // Start 3-second countdown
    setRegenCountdown(3);
  };

  const cancelCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRegenCountdown(null);
  };

  // Countdown effect
  useEffect(() => {
    if (regenCountdown === null) return;

    if (regenCountdown === 0) {
      // Time's up - execute
      countdownRef.current = null;
      setRegenCountdown(null);
      executeRegenerateContext();
      return;
    }

    // Tick down every second
    countdownRef.current = setTimeout(() => {
      setRegenCountdown(prev => prev - 1);
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [regenCountdown]);

  const executeRegenerateContext = async () => {
    setRegenerating(true);
    try {
      console.log('[AI Enhance] Calling regenerateProjectContext for project:', project.id);
      const result = await api.regenerateProjectContext(project.id);
      console.log('[AI Enhance] Result received:', result);
      if (result.success && result.context_md) {
        // Update local state - user sees context update immediately, no modal needed
        setProject(prev => ({ ...prev, context_md: result.context_md }));
        setEditedContext(result.context_md);
        // Silent success - the updated context appearing is feedback enough
      } else {
        setAlertModal({
          title: 'Regeneration Failed',
          message: result.message || 'Unknown error occurred.',
          variant: 'error'
        });
      }
    } catch (err) {
      console.error('Failed to regenerate context:', err);
      setAlertModal({
        title: 'Regeneration Failed',
        message: err.message || 'An unexpected error occurred.',
        variant: 'error'
      });
    } finally {
      setRegenerating(false);
    }
  };

  // Sync project departments from all decisions when modal opens
  // This ensures the department badges are up-to-date from all decisions
  useEffect(() => {
    if (companyId && project.id && !isEditing) {
      console.log('[MyCompany] Syncing departments on modal open for project:', project.id);
      api.syncProjectDepartments(companyId, project.id)
        .then(syncResult => {
          console.log('[MyCompany] Sync result:', syncResult);
          // Update local project state with synced department_ids
          if (syncResult?.department_ids) {
            console.log('[MyCompany] Updating editedDepartmentIds to:', syncResult.department_ids);
            setProject(prev => ({
              ...prev,
              department_ids: syncResult.department_ids
            }));
            setEditedDepartmentIds(syncResult.department_ids);
            // Also update parent projects list so dashboard shows correct departments
            if (onProjectUpdate) {
              onProjectUpdate(project.id, { department_ids: syncResult.department_ids });
            }
          }
        })
        .catch(err => {
          console.log('[MyCompany] Dept sync failed:', err.message);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, project.id]); // Only run once on modal open, not on tab change

  // Load decisions when switching to decisions tab (only if not already loaded)
  useEffect(() => {
    if (activeTab === 'decisions' && companyId && project.id && projectDecisions.length === 0) {
      setLoadingDecisions(true);
      api.getProjectDecisions(companyId, project.id)
        .then(data => {
          setProjectDecisions(data.decisions || []);
        })
        .catch(err => {
          console.error('Failed to load project decisions:', err);
        })
        .finally(() => {
          setLoadingDecisions(false);
        });
    }
  }, [activeTab, companyId, project.id, projectDecisions.length]);

  // Format date for timeline
  const formatTimelineDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: '#dbeafe', text: '#1d4ed8' };
      case 'completed': return { bg: '#dcfce7', text: '#15803d' };
      case 'archived': return { bg: '#f3f4f6', text: '#6b7280' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const handleSave = async () => {
    if (onSave) {
      if (!editedName.trim()) {
        alert('Project name is required');
        return;
      }
      setSaving(true);
      try {
        // onSave now returns the updated project data
        const updatedProject = await onSave(project.id, {
          name: editedName,
          description: editedDescription,
          context_md: editedContext,
          status: editedStatus,
          department_ids: editedDepartmentIds.length > 0 ? editedDepartmentIds : null
        });
        // Update local project state with returned data (stay on view, don't close)
        if (updatedProject) {
          setProject(updatedProject);
        }
        setIsEditing(false);
        setIsEditingName(false);
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (isNew) {
      onClose(); // Close modal for new project cancel
      return;
    }
    setIsEditing(false);
    setIsEditingName(false);
    setEditedName(project.name || '');
    setEditedDescription(project.description || '');
    setEditedContext(project.context_md || '');
    setEditedStatus(project.status || 'active');
    setEditedDepartmentIds(
      project.department_ids?.length > 0 ? project.department_ids :
      project.department_id ? [project.department_id] : []
    );
  };

  // Copy context to clipboard
  const handleCopyContext = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setContextCopied(true);
      setTimeout(() => setContextCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      contentClassName="mc-modal-no-padding"
    >
        {/* Header with title */}
        <div className="mc-modal-header-clean">
          <div className="mc-header-title-row">
            {isEditingName || isNew ? (
              <input
                type="text"
                className="mc-title-inline-edit"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={() => !isNew && setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && !isNew && setIsEditingName(false)}
                placeholder={isNew ? "Enter project name..." : ""}
                autoFocus
              />
            ) : (
              <h2
                className="mc-title-display editable"
                onClick={() => setIsEditingName(true)}
                title="Click to edit name"
              >
                {editedName || project.name}
                <svg className="mc-pencil-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </h2>
            )}
          </div>
          <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mc-modal-body">
          {/* Status, Department and info row */}
          <div className="mc-project-meta-row">
            {/* Status badge - shown in both view and edit modes (status changed via footer actions) */}
            {!isNew && (
              <span
                className="mc-status-badge"
                style={{
                  background: getStatusColor(editedStatus).bg,
                  color: getStatusColor(editedStatus).text
                }}
              >
                {editedStatus}
              </span>
            )}

            {/* Source indicator - how was this project created */}
            {!isNew && !isEditing && project.source && project.source !== 'manual' && (
              <span className={`mc-source-badge ${project.source}`}>
                {project.source === 'council' ? 'From Council' : project.source === 'import' ? 'Imported' : project.source}
              </span>
            )}

            {/* Departments - using multi-select when editing */}
            {isEditing ? (
              <MultiDepartmentSelect
                value={editedDepartmentIds}
                onValueChange={setEditedDepartmentIds}
                departments={departments}
                placeholder="Select departments..."
              />
            ) : (
              <>
                {/* Show multiple department badges */}
                {getDepartmentNames()?.map((name, idx) => {
                  const deptId = editedDepartmentIds[idx];
                  return (
                    <span
                      key={deptId || idx}
                      className="mc-dept-badge"
                      style={{
                        background: getDeptColor(deptId)?.bg || '#f3e8ff',
                        color: getDeptColor(deptId)?.text || '#7c3aed',
                        borderColor: getDeptColor(deptId)?.border || '#e9d5ff'
                      }}
                    >
                      {name}
                    </span>
                  );
                })}
              </>
            )}

            {/* Timestamps inline - small and subtle */}
            {!isNew && !isEditing && (project.created_at || project.updated_at) && (
              <div className="mc-project-timestamps">
                {project.created_at && (
                  <span className="mc-timestamp">
                    {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {project.updated_at && project.updated_at !== project.created_at && (
                  <span className="mc-timestamp">
                    Updated {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}

            {/* View original conversation link - subtle, on the right */}
            {!isNew && !isEditing && project.source_conversation_id && onNavigateToConversation && (
              <button
                className="mc-source-link"
                onClick={() => {
                  onClose();
                  onNavigateToConversation(project.source_conversation_id, 'projects');
                }}
                title="View the original conversation that created this project"
              >
                <ExternalLink size={12} />
                <span>View source</span>
              </button>
            )}
          </div>

          {/* Description - stripped of markdown for clean display */}
          {isEditing ? (
            <div className="mc-field-group">
              <label className="mc-field-label">Description</label>
              <AIWriteAssist
                context="project-description"
                value={editedDescription}
                onSuggestion={setEditedDescription}
                additionalContext={editedName ? `Project: ${editedName}` : ''}
                inline
              >
                <input
                  type="text"
                  className="mc-input-unified"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Brief description of the project..."
                />
              </AIWriteAssist>
            </div>
          ) : project.description && (
            <p className="mc-project-description">
              {truncateText(project.description, 200)}
            </p>
          )}

          {/* Tab navigation - only show when not editing and not new */}
          {!isEditing && !isNew && (
            <div className="mc-project-tabs">
              <button
                className={`mc-project-tab ${activeTab === 'context' ? 'active' : ''}`}
                onClick={() => setActiveTab('context')}
              >
                <svg style={{ width: '14px', height: '14px' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 010-2zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
                </svg>
                Context
              </button>
              <button
                className={`mc-project-tab ${activeTab === 'decisions' ? 'active' : ''}`}
                onClick={() => setActiveTab('decisions')}
              >
                <Bookmark size={14} />
                Decisions
                {project.decision_count > 0 && (
                  <span className="mc-tab-badge">{project.decision_count}</span>
                )}
              </button>
            </div>
          )}

          {/* Context Tab Content */}
          {(activeTab === 'context' || isEditing || isNew) && (
            <>
              {/* Context section header with Edit/Save actions */}
              <div className="mc-context-header-row">
                <div className="mc-context-header-left">
                  <label className="mc-section-label">Project Context</label>
                  <span className="mc-section-hint">
                    Injected into council sessions when this project is selected
                  </span>
                </div>
                {/* Right side: AI Enhance + Edit/Save buttons */}
                <div className="mc-context-header-actions">
                  {/* AI Enhance - always available (not for new projects) */}
                  {!isNew && (
                    regenCountdown !== null ? (
                      <button
                        className="mc-ai-synthesize-btn countdown"
                        onClick={cancelCountdown}
                        title="Cancel AI Enhance"
                      >
                        <span className="mc-countdown-num">{regenCountdown}</span>
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <button
                        className="mc-ai-synthesize-btn"
                        onClick={handleRegenerateContext}
                        disabled={regenerating}
                        title={isEditing
                          ? "AI will enhance your current content"
                          : (project.decision_count > 0 || projectDecisions.length > 0)
                            ? "AI will synthesize all decisions into organized project context"
                            : "AI will enhance and structure your project context"
                        }
                      >
                        {regenerating ? (
                          <>
                            <Spinner size="sm" variant="brand" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            <span>AI Enhance</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                  {isEditing ? (
                    /* When editing: Cancel and Save buttons */
                    <>
                      <button
                        className="mc-btn-clean secondary small"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="mc-btn-clean primary small"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    /* When viewing: Edit button (AI Enhance is always shown above) */
                    <>
                      {/* Edit button */}
                      {onSave && (
                        <button
                          className="mc-btn-clean secondary small"
                          onClick={() => setIsEditing(true)}
                          title="Edit project context"
                        >
                          <PenLine size={14} />
                          <span>Edit</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Context Section - Preview by default, textarea when editing */}
              <div className="mc-content-section">
                {isEditing ? (
                  <div className="mc-edit-full">
                    <AIWriteAssist
                      context="project-context"
                      value={editedContext}
                      onSuggestion={setEditedContext}
                      additionalContext={editedName ? `Project: ${editedName}` : ''}
                    >
                      <textarea
                        className="mc-edit-textarea-full"
                        value={editedContext}
                        onChange={(e) => setEditedContext(e.target.value)}
                        rows={15}
                        autoFocus
                        placeholder="Add project context here..."
                      />
                    </AIWriteAssist>
                  </div>
                ) : (
                  <div className="mc-content-preview">
                    {content ? (
                      <>
                        {/* Floating copy button - matches Stage3/timeline style */}
                        <button
                          className={`mc-timeline-copy-btn ${contextCopied ? 'copied' : ''}`}
                          onClick={handleCopyContext}
                          title="Copy project context"
                        >
                          {contextCopied ? (
                            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                        </button>
                        <MarkdownViewer content={content} skipCleanup={true} />
                      </>
                    ) : (
                      <p className="mc-no-content">No project context yet. Click Edit to add context that will be included in all council sessions for this project.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Decisions Tab Content - Timeline View */}
          {activeTab === 'decisions' && !isEditing && !isNew && (
            <div className="mc-project-decisions">
              {loadingDecisions ? (
                <div className="mc-decisions-loading">
                  <Spinner size="md" variant="brand" />
                  <span>Loading decisions...</span>
                </div>
              ) : projectDecisions.length === 0 ? (
                <div className="mc-empty-decisions">
                  <Bookmark size={32} className="mc-empty-icon" style={{ color: '#cbd5e1', marginBottom: '12px' }} />
                  <p className="mc-empty-title">No decisions yet</p>
                  <p className="mc-empty-hint">
                    Save council responses to this project to build a decision timeline.
                  </p>
                </div>
              ) : (
                <div className="mc-decisions-timeline">
                  {groupedDecisions.map((group, groupIndex) => (
                    <div
                      key={group.conversationId || `single-${groupIndex}`}
                      className={`mc-timeline-group ${group.type === 'group' && group.decisions.length > 1 ? 'linked' : ''}`}
                    >
                      {group.decisions.map((decision, decisionIndex) => (
                        <div
                          key={decision.id}
                          className={`mc-timeline-item ${expandedDecisionId === decision.id ? 'expanded' : ''}`}
                        >
                          {/* Decision card - clean, no dots/lines */}
                          <div className="mc-timeline-content">
                            <div
                              className="mc-timeline-header"
                              onClick={() => handleExpandDecision(decision.id)}
                            >
                              {/* Single row: Title | Dept Badge | #N | Date | Chevron */}
                              <div className="mc-timeline-title-row">
                                <h4 className="mc-timeline-title">{decision.title}</h4>
                                <div className="mc-timeline-title-badges">
                                  {/* Show multiple department badges if available */}
                                  {(decision.department_names?.length > 0 ? decision.department_names : (decision.department_name ? [decision.department_name] : [])).map((deptName, idx) => {
                                    const deptId = decision.department_ids?.[idx] || decision.department_id;
                                    return (
                                      <span
                                        key={deptId || idx}
                                        className="mc-timeline-dept-badge"
                                        style={{
                                          background: getDeptColor(deptId)?.bg || '#f3f4f6',
                                          color: getDeptColor(deptId)?.text || '#374151',
                                          borderColor: getDeptColor(deptId)?.border || '#e5e7eb'
                                        }}
                                      >
                                        {deptName}
                                      </span>
                                    );
                                  })}
                                  {/* Show iteration badge for multi-turn conversations */}
                                  {group.type === 'group' && group.decisions.length > 1 && (
                                    <span className="mc-timeline-iteration-badge">
                                      #{decisionIndex + 1}
                                    </span>
                                  )}
                                  <span className="mc-timeline-date">
                                    {new Date(decision.created_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                  <svg
                                    className={`mc-timeline-chevron ${expandedDecisionId === decision.id ? 'expanded' : ''}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Expanded content */}
                            {expandedDecisionId === decision.id && (
                              <div className="mc-timeline-body">
                                {/* Clean AI-generated summary */}
                                {generatingSummaryId === decision.id ? (
                                  <div className="mc-timeline-summary-loading">
                                    <Spinner size="sm" variant="brand" />
                                    <span>Generating summary...</span>
                                  </div>
                                ) : decision.decision_summary ? (
                                  <div className="mc-timeline-summary">
                                    {decision.decision_summary}
                                  </div>
                                ) : null}

                                {/* Council's response with copy button */}
                                <div className="mc-timeline-answer">
                                  <button
                                    className="mc-timeline-copy-btn"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const btn = e.target.closest('.mc-timeline-copy-btn');
                                      try {
                                        await navigator.clipboard.writeText(decision.content || '');
                                        // Brief visual feedback - swap icon
                                        btn.classList.add('copied');
                                        btn.querySelector('.copy-icon').style.display = 'none';
                                        btn.querySelector('.check-icon').style.display = 'block';
                                        setTimeout(() => {
                                          if (btn) {
                                            btn.classList.remove('copied');
                                            const copyIcon = btn.querySelector('.copy-icon');
                                            const checkIcon = btn.querySelector('.check-icon');
                                            if (copyIcon) copyIcon.style.display = 'block';
                                            if (checkIcon) checkIcon.style.display = 'none';
                                          }
                                        }, 2000);
                                      } catch (err) {
                                        console.error('Failed to copy:', err);
                                      }
                                    }}
                                    title="Copy council response"
                                  >
                                    <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </svg>
                                    <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display: 'none'}}>
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </button>
                                  <MarkdownViewer content={decision.content || ''} skipCleanup={true} />
                                </div>

                                {decision.source_conversation_id && onNavigateToConversation && (
                                  <button
                                    className="mc-timeline-source-link"
                                    onClick={() => {
                                      onClose();
                                      // Pass response_index to scroll to the correct response in multi-turn conversations
                                      // If response_index is null (legacy decision), infer from position in group
                                      // Council responses are at odd indices: 1, 3, 5, 7...
                                      // So decisionIndex 0 → response_index 1, decisionIndex 1 → response_index 3, etc.
                                      const inferredIndex = decision.response_index ?? (decisionIndex * 2 + 1);
                                      console.log('[MyCompany] Navigating to conversation:', decision.source_conversation_id, 'response_index:', inferredIndex, '(stored:', decision.response_index, ', inferred from decisionIndex:', decisionIndex, ')');
                                      onNavigateToConversation(decision.source_conversation_id, 'projects', inferredIndex);
                                    }}
                                  >
                                    View original conversation →
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="app-modal-footer-with-actions">
          {/* Left side: Status actions (always visible for existing projects) */}
          {!isNew && onStatusChange && (
            <div className="app-modal-footer-left">
              {confirmingAction === 'delete' ? (
                <div className="app-modal-confirm-inline">
                  <span>Delete this project?</span>
                  <button
                    className="app-modal-btn app-modal-btn-sm app-modal-btn-danger-sm"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await onDelete(project.id);
                      } catch (err) {
                        console.error('Failed to delete:', err);
                        setActionLoading(false);
                        setConfirmingAction(null);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    className="app-modal-btn app-modal-btn-sm app-modal-btn-secondary"
                    onClick={() => setConfirmingAction(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {/* Complete button - only for active projects */}
                  {editedStatus === 'active' && (
                    <button
                      className="app-modal-btn app-modal-btn-action app-modal-btn-success"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'completed');
                        } catch (err) {
                          console.error('Failed to complete:', err);
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Mark project as completed"
                    >
                      <CheckCircle size={14} />
                      <span>Complete</span>
                    </button>
                  )}
                  {/* Archive/Restore button */}
                  {editedStatus === 'archived' ? (
                    <button
                      className="app-modal-btn app-modal-btn-action app-modal-btn-secondary"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'active');
                        } catch (err) {
                          console.error('Failed to restore:', err);
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Restore project to active"
                    >
                      <RotateCcw size={14} />
                      <span>Restore</span>
                    </button>
                  ) : (
                    <button
                      className="app-modal-btn app-modal-btn-action app-modal-btn-secondary"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await onStatusChange(project.id, 'archived');
                        } catch (err) {
                          console.error('Failed to archive:', err);
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading || saving}
                      title="Archive this project"
                    >
                      <Archive size={14} />
                      <span>Archive</span>
                    </button>
                  )}
                  {/* Delete button */}
                  <button
                    className="app-modal-btn app-modal-btn-action app-modal-btn-danger"
                    onClick={() => setConfirmingAction('delete')}
                    disabled={actionLoading || saving}
                    title="Delete this project"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          )}

        </div>

      {/* Alert Modal for success/error messages */}
      {alertModal && (
        <AlertModal
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          onClose={() => setAlertModal(null)}
        />
      )}
    </AppModal>
  );
}


/* End of ViewProjectModal */
