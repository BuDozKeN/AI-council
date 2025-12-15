import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import MarkdownViewer from './MarkdownViewer';
import { DepartmentSelect } from './ui/DepartmentSelect';
import { Building2, ScrollText, Layers, FileText, Bookmark } from 'lucide-react';
import { getDeptColor, getPlaybookTypeColor } from '../lib/colors';
import smartTextToMarkdown, { isAlreadyMarkdown } from '../lib/smartTextToMarkdown';
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
export default function MyCompany({ companyId, companyName, allCompanies = [], onSelectCompany, onClose, onNavigateToConversation, initialTab = 'overview', initialDecisionId = null, initialPlaybookId = null, initialPromoteDecision = null, onConsumePromoteDecision = null }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);


  // UI state
  const [expandedDept, setExpandedDept] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [promoteModal, setPromoteModal] = useState(null); // Decision being promoted
  const [highlightedDecisionId, setHighlightedDecisionId] = useState(initialDecisionId);
  const [highlightedPlaybookId, setHighlightedPlaybookId] = useState(initialPlaybookId);
  const [confirmModal, setConfirmModal] = useState(null); // { type, item, title, message, confirmText, variant }
  const [showCompanySwitcher, setShowCompanySwitcher] = useState(false); // Company dropdown visible
  const [deletingDecisionId, setDeletingDecisionId] = useState(null); // ID of decision being deleted (for animation)

  // Playbooks filter state
  const [playbookSearch, setPlaybookSearch] = useState('');
  const [playbookTypeFilter, setPlaybookTypeFilter] = useState('all');
  const [playbookDeptFilter, setPlaybookDeptFilter] = useState('all');
  const [playbookTagFilter, setPlaybookTagFilter] = useState('all');
  const [expandedTypes, setExpandedTypes] = useState({}); // Track which types are expanded beyond 5

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

    return (
      <div className="mc-overview">
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

        <div className="mc-context-section">
          <div className="mc-context-header">
            <h3>Company Context</h3>
            <button
              className="mc-btn small"
              onClick={() => setEditingItem({
                type: 'company-context',
                data: {
                  id: overview.company?.id,
                  context_md: overview.company?.context_md || ''
                }
              })}
            >
              Edit
            </button>
          </div>
          <div className="mc-context-content">
            {overview.company?.context_md ? (
              <MarkdownViewer content={overview.company.context_md} />
            ) : (
              <p className="mc-empty-hint">No company context defined yet. Click Edit to add your company's mission, goals, strategy, and other important information.</p>
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
    // Filter playbooks based on search and filters
    const filteredPlaybooks = playbooks
      .filter(pb => {
        const matchesSearch = !playbookSearch ||
          pb.title.toLowerCase().includes(playbookSearch.toLowerCase());
        const matchesType = playbookTypeFilter === 'all' || pb.doc_type === playbookTypeFilter;
        const matchesDept = playbookDeptFilter === 'all' ||
          (playbookDeptFilter === 'company-wide' ? !pb.department_id :
            pb.department_id === playbookDeptFilter ||
            (pb.additional_departments || []).includes(playbookDeptFilter));
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
        <div className="mc-playbooks-header">
          <span>{filteredPlaybooks.length} of {playbooks.length} playbooks</span>
          <button
            className="mc-btn primary small"
            onClick={() => setShowAddForm('playbook')}
          >
            + Create Playbook
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mc-playbooks-filters">
          <input
            type="text"
            placeholder="Search playbooks..."
            value={playbookSearch}
            onChange={(e) => setPlaybookSearch(e.target.value)}
            className="mc-search-input"
          />
          <select
            value={playbookTypeFilter}
            onChange={(e) => setPlaybookTypeFilter(e.target.value)}
            className="mc-filter-select"
          >
            <option value="all">All Types</option>
            <option value="sop">SOPs</option>
            <option value="framework">Frameworks</option>
            <option value="policy">Policies</option>
          </select>
          <select
            value={playbookDeptFilter}
            onChange={(e) => setPlaybookDeptFilter(e.target.value)}
            className="mc-filter-select"
          >
            <option value="all">All Departments</option>
            <option value="company-wide">Company-Wide</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {filteredPlaybooks.length === 0 ? (
          <div className="mc-empty-filter">
            <p>No playbooks match your filters</p>
            <button
              className="mc-text-btn"
              onClick={() => {
                setPlaybookSearch('');
                setPlaybookTypeFilter('all');
                setPlaybookDeptFilter('all');
                setPlaybookTagFilter('all');
              }}
            >
              Clear filters
            </button>
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

                {/* Main content */}
                <div className="mc-elegant-content">
                  <span className="mc-elegant-title">{decision.title}</span>

                  {/* Department badge */}
                  {deptName ? (
                    <span
                      className="mc-elegant-dept"
                      style={{
                        background: getDeptColor(deptId).bg,
                        color: getDeptColor(deptId).text
                      }}
                    >
                      {deptName}
                    </span>
                  ) : (
                    <span className="mc-elegant-dept mc-elegant-dept-none">
                      General
                    </span>
                  )}
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
          onClose={() => setEditingItem(null)}
          onPromote={(decision) => {
            setEditingItem(null); // Close view modal
            setPromoteModal(decision); // Open promote modal
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
                <button
                  className="mc-company-dropdown-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCompanySwitcher(!showCompanySwitcher);
                  }}
                >
                  <svg className="mc-switch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M3 12h18" />
                  </svg>
                  <span>Switch company</span>
                  <svg className={`mc-chevron ${showCompanySwitcher ? 'open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showCompanySwitcher && (
                  <div className="mc-company-dropdown">
                    {allCompanies.map(company => (
                      <button
                        key={company.id}
                        className={`mc-company-option ${company.id === companyId ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (company.id !== companyId) {
                            onSelectCompany?.(company.id);
                          }
                          setShowCompanySwitcher(false);
                        }}
                      >
                        <span className="mc-company-option-name">{company.name}</span>
                        {company.id === companyId && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
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
              <div className="mc-loading-spinner"></div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-modal-unified" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header-unified">
          <h2>Add Department</h2>
          <button className="mc-modal-close-unified" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body-unified">
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
              <textarea
                className="mc-input-unified mc-textarea-unified"
                placeholder="What does this department do?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="mc-modal-footer-unified">
            <button type="button" className="mc-btn-unified secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mc-btn-unified primary" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <span className="mc-btn-spinner" />
                  Creating...
                </>
              ) : (
                'Create Department'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-modal-unified" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header-unified">
          <h2>Add Role</h2>
          <button className="mc-modal-close-unified" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body-unified">
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
          </div>
          <div className="mc-modal-footer-unified">
            <button type="button" className="mc-btn-unified secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mc-btn-unified primary" disabled={saving || !name.trim()}>
              {saving ? (
                <>
                  <span className="mc-btn-spinner" />
                  Creating...
                </>
              ) : (
                'Create Role'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-modal-unified mc-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header-unified">
          <h2>Create Playbook</h2>
          <button className="mc-modal-close-unified" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body-unified">
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
              <textarea
                className="mc-input-unified mc-textarea-unified"
                placeholder="Write your playbook content..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
              />
            </div>
          </div>
          <div className="mc-modal-footer-unified">
            <button type="button" className="mc-btn-unified secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="mc-btn-unified primary"
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? (
                <>
                  <span className="mc-btn-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  Create Playbook
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
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

        <div className="mc-modal-footer-clean">
          {isEditing ? (
            <>
              <button className="mc-btn-clean secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn-clean primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button className="mc-btn-clean secondary" onClick={() => setIsEditing(true)}>
                  <svg className="mc-btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
              )}
              <button className="mc-btn-clean primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit Company Context Modal - Preview-first UX with clean design
function ViewCompanyContextModal({ data, companyName, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        {/* Clean header */}
        <div className="mc-modal-header-clean">
          <div className="mc-header-title-row">
            <span className="mc-type-badge-header" style={{ background: '#ecfdf5', color: '#047857' }}>
              COMPANY
            </span>
            <h2 className="mc-title-display">{companyName || 'Company'} Context</h2>
          </div>
          <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mc-modal-body">
          <p className="mc-context-hint">
            This context is injected into every AI Council conversation to help provide relevant advice.
          </p>

          {/* Content Section - Preview by default, markdown when editing */}
          <div className="mc-content-section">
            {isEditing ? (
              <div className="mc-edit-full">
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

        <div className="mc-modal-footer-clean">
          {isEditing ? (
            <>
              <button className="mc-btn-clean secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn-clean primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button className="mc-btn-clean secondary" onClick={() => setIsEditing(true)}>
                  <svg className="mc-btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
              )}
              <button className="mc-btn-clean primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// View Decision Modal
function ViewDecisionModal({ decision, departments = [], playbooks = [], onClose, onPromote }) {
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{decision.title}</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-decision-meta">
            {decision.is_promoted ? (
              <div className="mc-promoted-info-row">
                <span className="mc-promoted-label">
                  <span className="icon">✓</span>
                  Promoted
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
              <span className="mc-pending-label">Pending promotion</span>
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
            <MarkdownViewer content={decision.content || ''} />
          </div>
        </div>
        <div className="mc-modal-footer">
          {!decision.is_promoted && onPromote && (
            <button
              className="mc-btn primary"
              onClick={() => onPromote(decision)}
            >
              <span className="mc-btn-icon">📋</span>
              Promote to Playbook
            </button>
          )}
          <button className="mc-btn" onClick={onClose}>
            {decision.is_promoted ? 'Close' : 'Close'}
          </button>
        </div>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        {/* Clean header */}
        <div className="mc-modal-header-clean">
          <div className="mc-header-title-row">
            <span
              className="mc-type-badge-header"
              style={{ background: deptColor.bg, color: deptColor.text }}
            >
              DEPARTMENT
            </span>
            <h2 className="mc-title-display">{department.name}</h2>
            <span className="mc-meta-pill">{department.roles?.length || 0} roles</span>
          </div>
          <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mc-modal-body">
          {department.description && (
            <p className="mc-context-hint">{department.description}</p>
          )}

          {/* Content Section - Preview by default, markdown when editing */}
          <div className="mc-content-section">
            {isEditing ? (
              <div className="mc-edit-full">
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder="Enter the context documentation for this department..."
                />
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

        <div className="mc-modal-footer-clean">
          {isEditing ? (
            <>
              <button className="mc-btn-clean secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn-clean primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button className="mc-btn-clean secondary" onClick={() => setIsEditing(true)}>
                  <svg className="mc-btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
              )}
              <button className="mc-btn-clean primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal mc-promote-modal-full" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header-unified">
          <h2>Promote to Playbook</h2>
          <button className="mc-modal-close-unified" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
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

          <div className="mc-modal-footer-unified">
            <button type="button" className="mc-btn-unified secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mc-btn-unified primary" disabled={saving || !title.trim()}>
              {saving ? (
                <>
                  <span className="mc-btn-spinner" />
                  Creating...
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  Create {DOC_TYPES.find(t => t.value === docType)?.label}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Confirmation Modal - Unified style for archive/delete confirmations
function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning', // 'warning' (amber), 'danger' (red)
  onConfirm,
  onCancel,
  processing = false
}) {
  const isDanger = variant === 'danger';

  return (
    <div className="mc-modal-overlay" onClick={onCancel}>
      <div className="mc-modal mc-modal-unified mc-confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header-unified">
          <h2>{title}</h2>
          <button className="mc-modal-close-unified" onClick={onCancel} disabled={processing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mc-modal-body-unified">
          <div className={`mc-confirm-icon ${isDanger ? 'danger' : 'warning'}`}>
            {isDanger ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <p className="mc-confirm-message">{message}</p>
        </div>
        <div className="mc-modal-footer-unified">
          <button
            type="button"
            className="mc-btn-unified secondary"
            onClick={onCancel}
            disabled={processing}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`mc-btn-unified ${isDanger ? 'danger' : 'warning'}`}
            onClick={onConfirm}
            disabled={processing}
          >
            {processing ? (
              <>
                <span className="mc-btn-spinner" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
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
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        {/* Clean header */}
        <div className="mc-modal-header-clean">
          <div className="mc-header-title-row">
            <span className="mc-type-badge-header" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              ROLE
            </span>
            <h2 className="mc-title-display">{role.name}</h2>
            {role.departmentName && (
              <span
                className="mc-dept-badge"
                style={{ background: deptColor.bg, color: deptColor.text, borderColor: deptColor.border || deptColor.bg }}
              >
                {role.departmentName}
              </span>
            )}
          </div>
          <button className="mc-modal-close-clean" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mc-modal-body">
          {role.title && (
            <p className="mc-context-hint">{role.title}</p>
          )}

          {/* Content Section - Preview by default, markdown when editing */}
          <div className="mc-content-section">
            {isEditing ? (
              <div className="mc-edit-full">
                <textarea
                  className="mc-edit-textarea-full"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  rows={15}
                  autoFocus
                  placeholder="Enter the system prompt for this role..."
                />
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

        <div className="mc-modal-footer-clean">
          {isEditing ? (
            <>
              <button className="mc-btn-clean secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn-clean primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              {onSave && (
                <button className="mc-btn-clean secondary" onClick={() => setIsEditing(true)}>
                  <svg className="mc-btn-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
              )}
              <button className="mc-btn-clean primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
