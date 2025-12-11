import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
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
export default function MyCompany({ companyId, companyName, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [decisions, setDecisions] = useState([]);

  // UI state
  const [expandedDept, setExpandedDept] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddForm, setShowAddForm] = useState(null);
  const [saving, setSaving] = useState(false);

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
          const data = await api.getCompanyPlaybooks(companyId);
          setPlaybooks(data.playbooks || []);
          break;
        }
        case 'decisions': {
          const data = await api.getCompanyDecisions(companyId);
          setDecisions(data.decisions || []);
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

        {overview.company?.context_md && (
          <div className="mc-context-section">
            <h3>Company Context</h3>
            <div className="mc-context-content">
              {overview.company.context_md}
            </div>
          </div>
        )}
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
                  {/* Department Context - View Button */}
                  {dept.context_md && (
                    <button
                      className="mc-view-context-btn"
                      onClick={() => setEditingItem({ type: 'department', data: dept })}
                    >
                      📄 View Department Context
                    </button>
                  )}

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
    const docTypes = ['sop', 'framework', 'policy'];
    const groupedPlaybooks = docTypes.reduce((acc, type) => {
      acc[type] = playbooks.filter(p => p.doc_type === type);
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
          <span>{playbooks.length} playbooks</span>
          <button
            className="mc-btn primary small"
            onClick={() => setShowAddForm('playbook')}
          >
            + Create Playbook
          </button>
        </div>

        {docTypes.map(type => {
          const docs = groupedPlaybooks[type];
          if (docs.length === 0) return null;

          const typeLabels = {
            sop: 'Standard Operating Procedures',
            framework: 'Frameworks',
            policy: 'Policies'
          };

          return (
            <div key={type} className="mc-playbook-group">
              <h4 className="mc-group-title">{typeLabels[type]}</h4>
              <div className="mc-playbook-list">
                {docs.map(doc => (
                  <div key={doc.id} className="mc-playbook-item">
                    <div className="mc-playbook-info">
                      <span className="mc-playbook-title">{doc.title}</span>
                      {doc.current_version && (
                        <span className="mc-playbook-version">v{doc.current_version.version}</span>
                      )}
                    </div>
                    <button
                      className="mc-text-btn"
                      onClick={() => setEditingItem({ type: 'playbook', data: doc })}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
              {decision.tags && decision.tags.length > 0 && (
                <div className="mc-decision-tags">
                  {decision.tags.map(tag => (
                    <span key={tag} className="mc-tag">{tag}</span>
                  ))}
                </div>
              )}
              <div className="mc-decision-actions">
                <button
                  className="mc-text-btn"
                  onClick={() => setEditingItem({ type: 'decision', data: decision })}
                >
                  View
                </button>
                {!decision.is_promoted && (
                  <button
                    className="mc-text-btn promote"
                    onClick={() => handlePromoteDecision(decision)}
                  >
                    Promote to Playbook
                  </button>
                )}
                {decision.is_promoted && (
                  <span className="mc-promoted-badge">Promoted</span>
                )}
              </div>
            </div>
          ))}
        </div>
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

    if (editingItem.type === 'department') {
      return (
        <ViewDepartmentModal
          department={editingItem.data}
          onClose={() => setEditingItem(null)}
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
          onClose={() => setEditingItem(null)}
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
            { id: 'decisions', label: 'Decisions', icon: '💡' }
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

// View Playbook Modal
function ViewPlaybookModal({ playbook, onClose }) {
  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal wide" onClick={e => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2>{playbook.title}</h2>
          <button className="mc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="mc-modal-body">
          <div className="mc-playbook-meta">
            <span className="mc-doc-type">{playbook.doc_type.toUpperCase()}</span>
            {playbook.current_version && (
              <span className="mc-version">Version {playbook.current_version.version}</span>
            )}
          </div>
          <div className="mc-playbook-content">
            {playbook.current_version?.content || 'No content available'}
          </div>
        </div>
        <div className="mc-modal-footer">
          <button className="mc-btn" onClick={onClose}>Close</button>
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

// View Department Modal - Shows full department context
function ViewDepartmentModal({ department, onClose }) {
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
          <div className="mc-context-content markdown-preview">
            <pre className="mc-markdown-raw">{department.context_md || 'No department context defined.'}</pre>
          </div>
        </div>
        <div className="mc-modal-footer">
          <button className="mc-btn" onClick={onClose}>Close</button>
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
              <div className="mc-context-content markdown-preview">
                <pre className="mc-markdown-raw">{role.system_prompt || 'No system prompt defined for this role yet. Click Edit to add one.'}</pre>
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
