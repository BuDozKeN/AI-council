import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import MarkdownViewer from './MarkdownViewer';
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
export default function MyCompany({ companyId, companyName, onClose, onNavigateToConversation }) {
  const [activeTab, setActiveTab] = useState('overview');
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

  // Playbooks filter state
  const [playbookSearch, setPlaybookSearch] = useState('');
  const [playbookTypeFilter, setPlaybookTypeFilter] = useState('all');
  const [playbookDeptFilter, setPlaybookDeptFilter] = useState('all');
  const [playbookTagFilter, setPlaybookTagFilter] = useState('all');

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
          // Load both playbooks AND departments (needed for filter dropdown and badges)
          const [playbooksData, teamData] = await Promise.all([
            api.getCompanyPlaybooks(companyId),
            api.getCompanyTeam(companyId)
          ]);
          setPlaybooks(playbooksData.playbooks || []);
          setDepartments(teamData.departments || []);
          break;
        }
        case 'decisions': {
          const data = await api.getCompanyDecisions(companyId);
          setDecisions(data.decisions || []);
          break;
        }
        case 'activity': {
          const data = await api.getCompanyActivity(companyId);
          setActivityLogs(data.logs || []);
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to load ${activeTab}:`, err);
      setError(`Failed to load ${activeTab}`);
    }
    setLoading(false);
  }, [companyId, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

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
          <div className="mc-section-header">
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

        <div className="mc-departments">
          {departments.map(dept => (
            <div key={dept.id} className="mc-dept">
              <div
                className="mc-dept-header"
                onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
              >
                <div className="mc-dept-info">
                  <h4 className="mc-dept-name">{dept.name}</h4>
                  <span className="mc-dept-meta">{dept.roles?.length || 0} roles</span>
                </div>
                <span className="mc-expand-icon">
                  {expandedDept === dept.id ? '▼' : '▶'}
                </span>
              </div>

              {dept.description && (
                <p className="mc-dept-desc">{dept.description}</p>
              )}

              {expandedDept === dept.id && (
                <div className="mc-dept-expanded">
                  {/* Department Context - Always show button */}
                  <button
                    className={`mc-view-context-btn ${dept.context_md ? 'has-content' : 'no-content'}`}
                    onClick={() => setEditingItem({ type: 'department', data: dept })}
                  >
                    📄 View Department Context {dept.context_md ? `(${Math.round(dept.context_md.length / 1000)}k chars)` : '(empty)'}
                  </button>

                  {/* Roles List */}
                  <div className="mc-roles">
                    <h5 className="mc-roles-title">Roles</h5>
                    {dept.roles && dept.roles.length > 0 ? (
                      dept.roles.map(role => (
                        <div
                          key={role.id}
                          className="mc-role clickable"
                          onClick={() => setEditingItem({ type: 'role', data: { ...role, departmentName: dept.name, departmentId: dept.id } })}
                        >
                          <div className="mc-role-info">
                            <span className="mc-role-name">{role.name}</span>
                            {role.title && (
                              <span className="mc-role-title">{role.title}</span>
                            )}
                          </div>
                          <span className="mc-role-arrow">→</span>
                        </div>
                      ))
                    ) : (
                      <p className="mc-no-items">No roles defined yet</p>
                    )}
                    <button
                      className="mc-add-btn"
                      onClick={() => setShowAddForm({ type: 'role', deptId: dept.id })}
                    >
                      + Add Role
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
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
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

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

            return (
              <div key={type} className="mc-playbook-group">
                <h4 className="mc-group-title">{typeLabels[type]}</h4>
                <div className="mc-playbook-list">
                  {docs.map(doc => {
                    // Find department name if linked
                    const dept = departments.find(d => d.id === doc.department_id);
                    // Find additional department names
                    const additionalDepts = (doc.additional_departments || [])
                      .map(deptId => departments.find(d => d.id === deptId))
                      .filter(Boolean);

                    // All departments for this playbook
                    const allDepts = [dept, ...additionalDepts].filter(Boolean);

                    // Doc type labels
                    const typeLabel = { sop: 'SOP', framework: 'Framework', policy: 'Policy' }[doc.doc_type] || doc.doc_type;

                    // Get department color class based on slug/name
                    const getDeptColorClass = (deptObj) => {
                      const slug = (deptObj.slug || deptObj.name || '').toLowerCase();
                      if (slug.includes('tech')) return 'dept-technology';
                      if (slug.includes('sale')) return 'dept-sales';
                      if (slug.includes('financ')) return 'dept-finance';
                      if (slug.includes('oper')) return 'dept-operations';
                      if (slug.includes('market')) return 'dept-marketing';
                      if (slug.includes('hr') || slug.includes('human')) return 'dept-hr';
                      if (slug.includes('legal')) return 'dept-legal';
                      if (slug.includes('product')) return 'dept-product';
                      return 'dept-default';
                    };

                    return (
                      <div
                        key={doc.id}
                        className="mc-playbook-item clickable"
                        onClick={() => setEditingItem({ type: 'playbook', data: doc, startEditing: true })}
                      >
                        <div className="mc-playbook-info">
                          <div className="mc-playbook-title-row">
                            <span className="mc-playbook-title">{doc.title}</span>
                            <span className={`mc-type-badge ${doc.doc_type}`}>{typeLabel}</span>
                          </div>
                          <div className="mc-playbook-badges">
                            {allDepts.map(d => (
                              <span key={d.id} className={`mc-dept-badge ${getDeptColorClass(d)}`}>{d.name}</span>
                            ))}
                            {!dept && doc.department_id === null && (
                              <span className="mc-company-badge">Company-wide</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderDecisions = () => {
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
        <div className="mc-decisions-header">
          <span>{decisions.length} decisions</span>
        </div>

        <div className="mc-decision-list">
          {decisions.map(decision => (
            <div key={decision.id} className="mc-decision-item">
              <div className="mc-decision-info">
                <span className="mc-decision-title">{decision.title}</span>
                <span className="mc-decision-date">
                  {new Date(decision.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="mc-decision-badges">
                {decision.council_type && (
                  <span className="mc-council-badge">{decision.council_type}</span>
                )}
                {decision.tags && decision.tags.length > 0 && (
                  decision.tags.map(tag => (
                    <span key={tag} className="mc-tag">{tag}</span>
                  ))
                )}
              </div>
              <div className="mc-decision-actions">
                <button
                  className="mc-action-btn view"
                  onClick={() => setEditingItem({ type: 'decision', data: decision })}
                  title="View decision details"
                >
                  <span className="icon">👁</span>
                  View
                </button>
                {!decision.is_promoted && (
                  <button
                    className="mc-action-btn promote"
                    onClick={() => handlePromoteDecision(decision)}
                    title="Promote to playbook"
                  >
                    <span className="icon">📚</span>
                    Promote
                  </button>
                )}
                {decision.is_promoted && (
                  <span className="mc-promoted-badge">
                    <span className="icon">✓</span>
                    Promoted
                  </span>
                )}
                <button
                  className="mc-action-btn archive"
                  onClick={() => handleArchiveDecision(decision)}
                  title="Archive this decision"
                >
                  <span className="icon">📦</span>
                  Archive
                </button>
              </div>
            </div>
          ))}
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

    return (
      <div className="mc-activity">
        <div className="mc-activity-header">
          <span>{activityLogs.length} events</span>
        </div>

        {Object.entries(groupedLogs).map(([date, logs]) => (
          <div key={date} className="mc-activity-group">
            <h4 className="mc-activity-date">{date}</h4>
            <div className="mc-activity-list">
              {logs.map(log => {
                const isClickable = log.related_id && log.related_type;
                return (
                  <div
                    key={log.id}
                    className={`mc-activity-item ${isClickable ? 'clickable' : ''}`}
                    onClick={isClickable ? () => handleActivityClick(log) : undefined}
                  >
                    <span className="mc-activity-icon">
                      {EVENT_ICONS[log.event_type] || EVENT_ICONS.default}
                    </span>
                    <div className="mc-activity-content">
                      <span className="mc-activity-type">
                        {EVENT_LABELS[log.event_type] || log.event_type}
                      </span>
                      <span className="mc-activity-title">{log.title}</span>
                      {log.description && (
                        <p className="mc-activity-description">{log.description}</p>
                      )}
                      {log.conversation_id && onNavigateToConversation && (
                        <button
                          className="mc-activity-source-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToConversation(log.conversation_id);
                          }}
                        >
                          View council discussion →
                        </button>
                      )}
                    </div>
                    <div className="mc-activity-right">
                      <span className="mc-activity-time">{formatTime(log.created_at)}</span>
                      {isClickable && <span className="mc-activity-arrow">→</span>}
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

  // Handle promote decision to playbook
  const handlePromoteDecision = async (decision) => {
    const docType = window.prompt('What type of playbook? (sop, framework, policy)', 'sop');
    if (!docType || !['sop', 'framework', 'policy'].includes(docType)) {
      alert('Please enter a valid type: sop, framework, or policy');
      return;
    }

    setSaving(true);
    try {
      await api.promoteDecisionToPlaybook(companyId, decision.id, {
        doc_type: docType,
        title: decision.title
      });
      // Reload decisions to show promoted status
      await loadData();
    } catch (err) {
      alert('Failed to promote decision: ' + err.message);
    }
    setSaving(false);
  };

  // Handle archive decision
  const handleArchiveDecision = async (decision) => {
    if (!window.confirm(`Are you sure you want to archive "${decision.title}"? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      await api.archiveDecision(companyId, decision.id);
      // Reload decisions to remove archived item
      await loadData();
    } catch (err) {
      alert('Failed to archive decision: ' + err.message);
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
  const handleAddPlaybook = async (title, docType, content) => {
    setSaving(true);
    try {
      await api.createCompanyPlaybook(companyId, {
        title,
        doc_type: docType,
        content
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
          onClose={() => setEditingItem(null)}
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
            <h1>My Company</h1>
            <p className="mc-subtitle">{companyName || 'Your Company'}</p>
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
      <div className="mc-modal" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>Add Department</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body">
            <div className="mc-form-group">
              <label>Department Name *</label>
              <input
                type="text"
                placeholder="e.g., Human Resources"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mc-form-group">
              <label>Description</label>
              <textarea
                placeholder="What does this department do?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="mc-modal-footer">
            <button type="button" className="mc-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mc-btn primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Department'}
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
      <div className="mc-modal" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>Add Role</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body">
            <div className="mc-form-group">
              <label>Role Name *</label>
              <input
                type="text"
                placeholder="e.g., CTO"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mc-form-group">
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g., Chief Technology Officer"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div className="mc-modal-footer">
            <button type="button" className="mc-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="mc-btn primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Playbook Modal
function AddPlaybookModal({ onSave, onClose, saving }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('sop');
  const [content, setContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave(title.trim(), docType, content.trim());
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>Create Playbook</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mc-modal-body">
            <div className="mc-form-group">
              <label>Title *</label>
              <input
                type="text"
                placeholder="e.g., Customer Onboarding Process"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mc-form-group">
              <label>Type *</label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="sop">Standard Operating Procedure</option>
                <option value="framework">Framework</option>
                <option value="policy">Policy</option>
              </select>
            </div>
            <div className="mc-form-group">
              <label>Content *</label>
              <textarea
                placeholder="Write your playbook content..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
              />
            </div>
          </div>
          <div className="mc-modal-footer">
            <button type="button" className="mc-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="mc-btn primary"
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? 'Creating...' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View/Edit Playbook Modal
function ViewPlaybookModal({ playbook, departments = [], onClose, onSave, startEditing = false }) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const [editedContent, setEditedContent] = useState(playbook.content || playbook.current_version?.content || '');
  const [editedTitle, setEditedTitle] = useState(playbook.title || '');
  const [selectedDepts, setSelectedDepts] = useState(playbook.additional_departments || []);
  const [saving, setSaving] = useState(false);

  // API returns content directly, not nested in current_version
  const content = playbook.content || playbook.current_version?.content || '';

  // Find owner department name
  const ownerDept = departments.find(d => d.id === playbook.department_id);

  // Get names of linked departments
  const linkedDeptNames = selectedDepts
    .map(id => departments.find(d => d.id === id))
    .filter(Boolean);

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
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          {isEditing ? (
            <input
              type="text"
              className="mc-title-input"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
            />
          ) : (
            <h2>{playbook.title}</h2>
          )}
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-playbook-meta">
            <span className="mc-doc-type">{playbook.doc_type.toUpperCase()}</span>
            {!isEditing && onSave && (
              <button className="mc-btn small" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}
          </div>

          {/* Department Assignment Section */}
          <div className="mc-playbook-departments">
            <h4>Linked Departments</h4>
            {isEditing ? (
              <div className="mc-dept-checkboxes">
                {departments.map(dept => {
                  const isOwner = dept.id === playbook.department_id;
                  const isSelected = selectedDepts.includes(dept.id);
                  return (
                    <label key={dept.id} className={`mc-dept-checkbox ${isOwner ? 'owner' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isOwner || isSelected}
                        disabled={isOwner}
                        onChange={() => !isOwner && handleToggleDept(dept.id)}
                      />
                      <span>{dept.name}</span>
                      {isOwner && <span className="mc-owner-label">(owner)</span>}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="mc-dept-list">
                {ownerDept && (
                  <span className="mc-dept-badge owner">{ownerDept.name} (owner)</span>
                )}
                {linkedDeptNames.map(d => (
                  <span key={d.id} className="mc-dept-badge shared">{d.name}</span>
                ))}
                {!ownerDept && linkedDeptNames.length === 0 && (
                  <span className="mc-company-badge">Company-wide (all departments)</span>
                )}
              </div>
            )}
          </div>

          {/* Content Section */}
          {isEditing ? (
            <textarea
              className="mc-edit-textarea"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={15}
              placeholder="Enter the playbook content..."
            />
          ) : (
            <div className="mc-context-content">
              {content ? (
                <MarkdownViewer content={content} skipCleanup={true} />
              ) : (
                <p className="text-gray-500 italic">No content available</p>
              )}
            </div>
          )}
        </div>
        <div className="mc-modal-footer">
          {isEditing ? (
            <>
              <button className="mc-btn" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="mc-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit Company Context Modal - Opens directly in edit mode for frictionless UX
function ViewCompanyContextModal({ data, companyName, onClose, onSave }) {
  const [editedContext, setEditedContext] = useState(data.context_md || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave({ context_md: editedContext });
      } catch (err) {
        // Error handled by parent
      }
      setSaving(false);
    }
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{companyName || 'Company'} - Edit Context</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <p className="mc-modal-hint">
            Edit your company's master context document. This information helps the AI Council give you relevant advice.
          </p>
          <textarea
            className="mc-edit-textarea large"
            value={editedContext}
            onChange={(e) => setEditedContext(e.target.value)}
            rows={30}
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
        <div className="mc-modal-footer">
          <button className="mc-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="mc-btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// View Decision Modal
function ViewDecisionModal({ decision, onClose }) {
  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{decision.title}</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-decision-meta">
            <span className="mc-date">
              {new Date(decision.created_at).toLocaleDateString()}
            </span>
            {decision.council_type && (
              <span className="mc-council-badge">{decision.council_type}</span>
            )}
            {decision.is_promoted && (
              <span className="mc-promoted">Promoted to Playbook</span>
            )}
          </div>
          {decision.tags && decision.tags.length > 0 && (
            <div className="mc-tags">
              {decision.tags.map(tag => (
                <span key={tag} className="mc-tag">{tag}</span>
              ))}
            </div>
          )}
          <div className="mc-decision-content">
            {decision.content}
          </div>
        </div>
        <div className="mc-modal-footer">
          <button className="mc-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// View Department Modal - Shows full department context with edit capability
function ViewDepartmentModal({ department, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContext, setEditedContext] = useState(department.context_md || '');
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{department.name} Department</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-dept-meta">
            <span className="mc-dept-badge">{department.roles?.length || 0} roles</span>
          </div>
          {department.description && (
            <p className="mc-dept-description">{department.description}</p>
          )}
          <div className="mc-section">
            <div className="mc-section-header">
              <h4>Department Context</h4>
              {!isEditing && (
                <button className="mc-btn small" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                className="mc-edit-textarea"
                value={editedContext}
                onChange={(e) => setEditedContext(e.target.value)}
                rows={20}
                placeholder="Enter the context documentation for this department..."
              />
            ) : (
              <div className="mc-context-content">
                <MarkdownViewer content={department.context_md || 'No department context defined. Click Edit to add one.'} />
              </div>
            )}
          </div>
        </div>
        <div className="mc-modal-footer">
          {isEditing ? (
            <>
              <button className="mc-btn" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="mc-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// View Role Modal - Shows full role system prompt with edit capability
function ViewRoleModal({ role, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(role.system_prompt || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (onSave) {
      setSaving(true);
      await onSave(role.id, role.departmentId, { system_prompt: editedPrompt });
      setSaving(false);
      setIsEditing(false);
    }
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{role.name}</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-role-meta">
            {role.departmentName && (
              <span className="mc-role-dept-badge">{role.departmentName}</span>
            )}
            {role.title && (
              <span className="mc-role-title-badge">{role.title}</span>
            )}
          </div>
          <div className="mc-section">
            <div className="mc-section-header">
              <h4>System Prompt / Role Context</h4>
              {!isEditing && (
                <button className="mc-btn small" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                className="mc-edit-textarea"
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                rows={20}
                placeholder="Enter the system prompt for this role..."
              />
            ) : (
              <div className="mc-context-content">
                <MarkdownViewer content={role.system_prompt || 'No system prompt defined for this role yet. Click Edit to add one.'} />
              </div>
            )}
          </div>
        </div>
        <div className="mc-modal-footer">
          {isEditing ? (
            <>
              <button className="mc-btn" onClick={() => setIsEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button className="mc-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="mc-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
