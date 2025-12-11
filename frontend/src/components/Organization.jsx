import { useState, useEffect } from 'react';
import { api } from '../api';
import './Organization.css';

/**
 * Organization Manager - View and edit company structure
 *
 * Displays departments, roles, and allows business owners to:
 * - View all departments and their descriptions
 * - View roles within each department
 * - Edit department/role descriptions
 * - Add new departments and roles
 * - View and edit role system prompts
 */
export default function Organization({ companyId, companyName, onClose, onOpenKnowledgeBase }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [expandedDept, setExpandedDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null); // {id, name, description}
  const [editingRole, setEditingRole] = useState(null); // {deptId, role: {id, name, description}}
  const [viewingRolePrompt, setViewingRolePrompt] = useState(null); // {deptId, roleId, prompt}
  const [saving, setSaving] = useState(false);

  // Add new department/role state
  const [showAddDept, setShowAddDept] = useState(false);
  const [newDept, setNewDept] = useState({ id: '', name: '', description: '' });
  const [showAddRole, setShowAddRole] = useState(null); // deptId or null
  const [newRole, setNewRole] = useState({ id: '', name: '', description: '' });

  // Fetch departments on mount
  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    const loadOrganization = async () => {
      setLoading(true);
      setError(null);
      try {
        const businesses = await api.listBusinesses();
        if (cancelled) return;
        const business = businesses.find(b => b.id === companyId);

        if (business) {
          setDepartments(business.departments || []);
        } else {
          setError('Company not found');
        }
      } catch (fetchErr) {
        if (cancelled) return;
        console.error('Failed to fetch organization:', fetchErr);
        setError('Failed to load organization structure');
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    loadOrganization();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Refetch function for after mutations
  const fetchOrganization = async () => {
    setLoading(true);
    setError(null);
    try {
      const businesses = await api.listBusinesses();
      const business = businesses.find(b => b.id === companyId);
      if (business) {
        setDepartments(business.departments || []);
      } else {
        setError('Company not found');
      }
    } catch (fetchErr) {
      console.error('Failed to fetch organization:', fetchErr);
      setError('Failed to load organization structure');
    }
    setLoading(false);
  };

  // Generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Handle adding a new department
  async function handleAddDepartment() {
    if (!newDept.name.trim()) return;

    setSaving(true);
    try {
      const deptId = newDept.id || generateSlug(newDept.name);
      await api.createDepartment(companyId, {
        id: deptId,
        name: newDept.name.trim(),
      });

      // Refresh data
      await fetchOrganization();
      setShowAddDept(false);
      setNewDept({ id: '', name: '', description: '' });
    } catch (err) {
      alert('Failed to create department: ' + err.message);
    }
    setSaving(false);
  }

  // Handle adding a new role
  async function handleAddRole(deptId) {
    if (!newRole.name.trim()) return;

    setSaving(true);
    try {
      const roleId = newRole.id || generateSlug(newRole.name);
      await api.addRole(companyId, deptId, {
        role_id: roleId,
        role_name: newRole.name.trim(),
        role_description: newRole.description.trim() || '',
      });

      // Refresh data
      await fetchOrganization();
      setShowAddRole(null);
      setNewRole({ id: '', name: '', description: '' });
    } catch (err) {
      alert('Failed to create role: ' + err.message);
    }
    setSaving(false);
  }

  // Handle updating a department
  async function handleUpdateDepartment() {
    if (!editingDept) return;

    setSaving(true);
    try {
      await api.updateDepartment(companyId, editingDept.id, {
        name: editingDept.name,
        description: editingDept.description,
      });

      await fetchOrganization();
      setEditingDept(null);
    } catch (err) {
      alert('Failed to update department: ' + err.message);
    }
    setSaving(false);
  }

  // Handle updating a role
  async function handleUpdateRole() {
    if (!editingRole) return;

    setSaving(true);
    try {
      await api.updateRole(companyId, editingRole.deptId, editingRole.role.id, {
        name: editingRole.role.name,
        description: editingRole.role.description,
      });

      await fetchOrganization();
      setEditingRole(null);
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
    setSaving(false);
  }

  // Handle viewing role system prompt
  async function handleViewRolePrompt(deptId, roleId) {
    try {
      const result = await api.getRoleContext(companyId, deptId, roleId);
      setViewingRolePrompt({
        deptId,
        roleId,
        prompt: result.context || '(No system prompt defined)',
        exists: result.exists
      });
    } catch {
      setViewingRolePrompt({
        deptId,
        roleId,
        prompt: '(Failed to load system prompt)',
        exists: false
      });
    }
  }

  // Count total roles
  const totalRoles = departments.reduce((sum, dept) => sum + (dept.roles?.length || 0), 0);

  return (
    <div className="org-overlay" onClick={onClose}>
      <div className="org-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="org-header">
          <div className="org-header-content">
            <h1>Organization</h1>
            <p className="org-subtitle">
              {companyName || 'Your Company'} • {departments.length} departments • {totalRoles} roles
            </p>
          </div>
          <button className="org-close-btn" onClick={onClose}>&times;</button>
        </header>

        {/* Quick Actions */}
        <div className="org-actions">
          <button
            className="org-action-btn primary"
            onClick={() => setShowAddDept(true)}
          >
            + Add Department
          </button>
          <button
            className="org-action-btn"
            onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase()}
          >
            View SOPs & Policies
          </button>
        </div>

        {/* Content */}
        <div className="org-content">
          {loading ? (
            <div className="org-loading">
              <div className="org-loading-spinner"></div>
              <p>Loading organization...</p>
            </div>
          ) : error ? (
            <div className="org-error">
              <p>{error}</p>
              <button onClick={fetchOrganization}>Retry</button>
            </div>
          ) : departments.length === 0 ? (
            <div className="org-empty">
              <div className="org-empty-icon">🏢</div>
              <p className="org-empty-title">No departments yet</p>
              <p className="org-empty-hint">
                Add your first department to start organizing your AI Council
              </p>
              <button
                className="org-action-btn primary"
                onClick={() => setShowAddDept(true)}
              >
                + Add Department
              </button>
            </div>
          ) : (
            <div className="org-departments">
              {departments.map(dept => (
                <div key={dept.id} className="org-dept">
                  {/* Department Header */}
                  <div
                    className="org-dept-header"
                    onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                  >
                    <div className="org-dept-info">
                      <h3 className="org-dept-name">{dept.name}</h3>
                      <span className="org-dept-meta">
                        {dept.roles?.length || 0} roles
                      </span>
                    </div>
                    <div className="org-dept-actions">
                      <button
                        className="org-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDept({ ...dept });
                        }}
                        title="Edit department"
                      >
                        ✏️
                      </button>
                      <span className="org-expand-icon">
                        {expandedDept === dept.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>

                  {/* Department description */}
                  {dept.description && (
                    <p className="org-dept-desc">{dept.description}</p>
                  )}

                  {/* Expanded: Show Roles */}
                  {expandedDept === dept.id && (
                    <div className="org-roles">
                      {dept.roles && dept.roles.length > 0 ? (
                        dept.roles.map(role => (
                          <div key={role.id} className="org-role">
                            <div className="org-role-info">
                              <span className="org-role-name">{role.name}</span>
                              {role.description && (
                                <span className="org-role-desc">{role.description}</span>
                              )}
                            </div>
                            <div className="org-role-actions">
                              <button
                                className="org-text-btn"
                                onClick={() => handleViewRolePrompt(dept.id, role.id)}
                              >
                                View Prompt
                              </button>
                              <button
                                className="org-icon-btn small"
                                onClick={() => setEditingRole({ deptId: dept.id, role: { ...role } })}
                                title="Edit role"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="org-no-roles">No roles defined yet</p>
                      )}

                      {/* Add Role Button */}
                      {showAddRole === dept.id ? (
                        <div className="org-add-form">
                          <input
                            type="text"
                            placeholder="Role name (e.g., CTO)"
                            value={newRole.name}
                            onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                            autoFocus
                          />
                          <input
                            type="text"
                            placeholder="Description (optional)"
                            value={newRole.description}
                            onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                          />
                          <div className="org-add-form-actions">
                            <button
                              className="org-btn secondary"
                              onClick={() => {
                                setShowAddRole(null);
                                setNewRole({ id: '', name: '', description: '' });
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="org-btn primary"
                              onClick={() => handleAddRole(dept.id)}
                              disabled={saving || !newRole.name.trim()}
                            >
                              {saving ? 'Adding...' : 'Add Role'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="org-add-role-btn"
                          onClick={() => setShowAddRole(dept.id)}
                        >
                          + Add Role
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Department Modal */}
        {showAddDept && (
          <div className="org-modal-overlay" onClick={() => setShowAddDept(false)}>
            <div className="org-modal" onClick={e => e.stopPropagation()}>
              <div className="org-modal-header">
                <h2>Add Department</h2>
                <button className="org-modal-close" onClick={() => setShowAddDept(false)}>&times;</button>
              </div>
              <div className="org-modal-body">
                <div className="org-form-group">
                  <label>Department Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Human Resources"
                    value={newDept.name}
                    onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="org-form-group">
                  <label>Slug (auto-generated)</label>
                  <input
                    type="text"
                    value={newDept.id || generateSlug(newDept.name)}
                    onChange={e => setNewDept({ ...newDept, id: e.target.value })}
                    placeholder="auto-generated from name"
                  />
                  <span className="org-form-hint">Used in URLs and file paths</span>
                </div>
              </div>
              <div className="org-modal-footer">
                <button className="org-btn" onClick={() => setShowAddDept(false)} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="org-btn primary"
                  onClick={handleAddDepartment}
                  disabled={saving || !newDept.name.trim()}
                >
                  {saving ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Department Modal */}
        {editingDept && (
          <div className="org-modal-overlay" onClick={() => setEditingDept(null)}>
            <div className="org-modal" onClick={e => e.stopPropagation()}>
              <div className="org-modal-header">
                <h2>Edit Department</h2>
                <button className="org-modal-close" onClick={() => setEditingDept(null)}>&times;</button>
              </div>
              <div className="org-modal-body">
                <div className="org-form-group">
                  <label>Department Name</label>
                  <input
                    type="text"
                    value={editingDept.name}
                    onChange={e => setEditingDept({ ...editingDept, name: e.target.value })}
                  />
                </div>
                <div className="org-form-group">
                  <label>Description</label>
                  <textarea
                    value={editingDept.description || ''}
                    onChange={e => setEditingDept({ ...editingDept, description: e.target.value })}
                    rows={3}
                    placeholder="What does this department do?"
                  />
                </div>
              </div>
              <div className="org-modal-footer">
                <button className="org-btn" onClick={() => setEditingDept(null)} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="org-btn primary"
                  onClick={handleUpdateDepartment}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {editingRole && (
          <div className="org-modal-overlay" onClick={() => setEditingRole(null)}>
            <div className="org-modal" onClick={e => e.stopPropagation()}>
              <div className="org-modal-header">
                <h2>Edit Role</h2>
                <button className="org-modal-close" onClick={() => setEditingRole(null)}>&times;</button>
              </div>
              <div className="org-modal-body">
                <div className="org-form-group">
                  <label>Role Name</label>
                  <input
                    type="text"
                    value={editingRole.role.name}
                    onChange={e => setEditingRole({
                      ...editingRole,
                      role: { ...editingRole.role, name: e.target.value }
                    })}
                  />
                </div>
                <div className="org-form-group">
                  <label>Description</label>
                  <textarea
                    value={editingRole.role.description || ''}
                    onChange={e => setEditingRole({
                      ...editingRole,
                      role: { ...editingRole.role, description: e.target.value }
                    })}
                    rows={3}
                    placeholder="What does this role do?"
                  />
                </div>
              </div>
              <div className="org-modal-footer">
                <button className="org-btn" onClick={() => setEditingRole(null)} disabled={saving}>
                  Cancel
                </button>
                <button
                  className="org-btn primary"
                  onClick={handleUpdateRole}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Role Prompt Modal */}
        {viewingRolePrompt && (
          <div className="org-modal-overlay" onClick={() => setViewingRolePrompt(null)}>
            <div className="org-modal wide" onClick={e => e.stopPropagation()}>
              <div className="org-modal-header">
                <h2>Role System Prompt</h2>
                <button className="org-modal-close" onClick={() => setViewingRolePrompt(null)}>&times;</button>
              </div>
              <div className="org-modal-body">
                <div className="org-prompt-info">
                  <span className="org-prompt-path">
                    councils/organisations/{companyId}/departments/{viewingRolePrompt.deptId}/roles/{viewingRolePrompt.roleId}.md
                  </span>
                  {!viewingRolePrompt.exists && (
                    <span className="org-prompt-missing">File not found - using default prompt</span>
                  )}
                </div>
                <pre className="org-prompt-content">{viewingRolePrompt.prompt}</pre>
              </div>
              <div className="org-modal-footer">
                <button className="org-btn" onClick={() => setViewingRolePrompt(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
