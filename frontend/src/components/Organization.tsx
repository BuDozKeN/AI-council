import { useState, useEffect } from 'react';
import { api } from '../api';
import { Spinner } from './ui/Spinner';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/button';
import { AlertModal } from './ui/AlertModal';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { toast } from './ui/sonner';
import { logger } from '../utils/logger';
import type { Department, Business } from '../types/business';
import './Organization.css';

interface OrganizationProps {
  companyId: string;
  companyName?: string;
  onClose: () => void;
  onOpenKnowledgeBase?: () => void;
}

interface EditingDept {
  id: string;
  name: string;
  description?: string;
}

interface EditingRole {
  deptId: string;
  role: {
    id: string;
    name: string;
    description?: string;
  };
}

interface ViewingRolePrompt {
  deptId: string;
  roleId: string;
  prompt: string;
  exists: boolean;
}

interface NewItem {
  id: string;
  name: string;
  description: string;
}

interface AlertModalState {
  title: string;
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

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
export default function Organization({ companyId, companyName, onClose, onOpenKnowledgeBase }: OrganizationProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<EditingDept | null>(null);
  const [editingRole, setEditingRole] = useState<EditingRole | null>(null);
  const [viewingRolePrompt, setViewingRolePrompt] = useState<ViewingRolePrompt | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Add new department/role state
  const [showAddDept, setShowAddDept] = useState<boolean>(false);
  const [newDept, setNewDept] = useState<NewItem>({ id: '', name: '', description: '' });
  const [showAddRole, setShowAddRole] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<NewItem>({ id: '', name: '', description: '' });
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);

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
        const business = businesses.find((b: Business) => b.id === companyId);

        if (business) {
          setDepartments(business.departments || []);
        } else {
          setError("We couldn't find that company. It may have been removed.");
        }
      } catch (fetchErr) {
        if (cancelled) return;
        logger.error('Failed to fetch organization:', fetchErr);
        setError("Couldn't load your team structure. Please try again.");
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
      const business = businesses.find((b: Business) => b.id === companyId);
      if (business) {
        setDepartments(business.departments || []);
      } else {
        setError("We couldn't find that company. It may have been removed.");
      }
    } catch (fetchErr) {
      logger.error('Failed to fetch organization:', fetchErr);
      setError("Couldn't load your team structure. Please try again.");
    }
    setLoading(false);
  };

  // Generate slug from name
  const generateSlug = (name: string): string => {
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
      const deptName = newDept.name.trim();
      await api.createDepartment(companyId, {
        id: deptId,
        name: deptName,
      });

      // Refresh data
      await fetchOrganization();
      setShowAddDept(false);
      setNewDept({ id: '', name: '', description: '' });
      toast.success(`"${deptName}" department created`, { duration: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAlertModal({ title: 'Error', message: 'Failed to create department: ' + message, variant: 'error' });
    }
    setSaving(false);
  }

  // Handle adding a new role
  async function handleAddRole(deptId: string) {
    if (!newRole.name.trim()) return;

    setSaving(true);
    try {
      const roleId = newRole.id || generateSlug(newRole.name);
      const roleName = newRole.name.trim();
      await api.addRole(companyId, deptId, {
        role_id: roleId,
        role_name: roleName,
        role_description: newRole.description.trim() || '',
      });

      // Refresh data
      await fetchOrganization();
      setShowAddRole(null);
      setNewRole({ id: '', name: '', description: '' });
      toast.success(`"${roleName}" role added`, { duration: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAlertModal({ title: 'Error', message: 'Failed to create role: ' + message, variant: 'error' });
    }
    setSaving(false);
  }

  // Handle updating a department
  async function handleUpdateDepartment() {
    if (!editingDept) return;

    setSaving(true);
    try {
      const updates: { name?: string; description?: string } = { name: editingDept.name };
      if (editingDept.description !== undefined) {
        updates.description = editingDept.description;
      }
      await api.updateDepartment(companyId, editingDept.id, updates);

      await fetchOrganization();
      toast.success(`"${editingDept.name}" updated`, { duration: 3000 });
      setEditingDept(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAlertModal({ title: 'Error', message: 'Failed to update department: ' + message, variant: 'error' });
    }
    setSaving(false);
  }

  // Handle updating a role
  async function handleUpdateRole() {
    if (!editingRole) return;

    setSaving(true);
    try {
      const updates: { name?: string; description?: string } = { name: editingRole.role.name };
      if (editingRole.role.description !== undefined) {
        updates.description = editingRole.role.description;
      }
      await api.updateRole(companyId, editingRole.deptId, editingRole.role.id, updates);

      await fetchOrganization();
      toast.success(`"${editingRole.role.name}" updated`, { duration: 3000 });
      setEditingRole(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAlertModal({ title: 'Error', message: 'Failed to update role: ' + message, variant: 'error' });
    }
    setSaving(false);
  }

  // Handle viewing role system prompt
  async function handleViewRolePrompt(deptId: string, roleId: string) {
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
    <AppModal
      isOpen={true}
      onClose={onClose}
      title="Organization"
      description={`${companyName || 'Your Company'} • ${departments.length} departments • ${totalRoles} roles`}
      size="lg"
      contentClassName="org-modal-body"
    >
      {/* Quick Actions */}
      <div className="org-actions">
        <Button
          variant="default"
          onClick={() => setShowAddDept(true)}
        >
          New Department
        </Button>
        <Button
          variant="outline"
          onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase()}
        >
          View SOPs & Policies
        </Button>
      </div>

      {/* Content */}
      <div className="org-content">
          {loading ? (
            <div className="org-loading">
              <Spinner size="lg" variant="brand" />
              <p>Loading organization...</p>
            </div>
          ) : error ? (
            <div className="org-error">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchOrganization}>Retry</Button>
            </div>
          ) : departments.length === 0 ? (
            <div className="org-empty">
              <div className="org-empty-icon">🏢</div>
              <p className="org-empty-title">No departments yet</p>
              <p className="org-empty-hint">
                Add your first department to start organizing your AI Council
              </p>
              <Button
                variant="default"
                onClick={() => setShowAddDept(true)}
              >
                New Department
              </Button>
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
                          <AIWriteAssist
                            context="role-description"
                            value={newRole.description}
                            onSuggestion={(val) => setNewRole({ ...newRole, description: val })}
                            additionalContext={newRole.name ? `Role: ${newRole.name}` : ''}
                          >
                            <input
                              type="text"
                              placeholder="Description (optional)"
                              value={newRole.description}
                              onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                            />
                          </AIWriteAssist>
                          <div className="org-add-form-actions">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowAddRole(null);
                                setNewRole({ id: '', name: '', description: '' });
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAddRole(dept.id)}
                              disabled={saving || !newRole.name.trim()}
                            >
                              {saving ? 'Adding...' : 'Add Role'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAddRole(dept.id)}
                        >
                          New Role
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Department Modal */}
        <AppModal
          isOpen={showAddDept}
          onClose={() => setShowAddDept(false)}
          title="Add Department"
          size="sm"
        >
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
          <AppModal.Footer>
            <Button variant="outline" onClick={() => setShowAddDept(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAddDepartment}
              disabled={saving || !newDept.name.trim()}
            >
              {saving ? 'Creating...' : 'Create Department'}
            </Button>
          </AppModal.Footer>
        </AppModal>

        {/* Edit Department Modal */}
        <AppModal
          isOpen={!!editingDept}
          onClose={() => setEditingDept(null)}
          title="Edit Department"
          size="sm"
        >
          {editingDept && (
            <>
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
                <AIWriteAssist
                  context="department-description"
                  value={editingDept.description || ''}
                  onSuggestion={(val) => setEditingDept({ ...editingDept, description: val })}
                  additionalContext={editingDept.name ? `Department: ${editingDept.name}` : ''}
                >
                  <textarea
                    value={editingDept.description || ''}
                    onChange={e => setEditingDept({ ...editingDept, description: e.target.value })}
                    rows={3}
                    placeholder="What does this department do?"
                  />
                </AIWriteAssist>
              </div>
              <AppModal.Footer>
                <Button variant="outline" onClick={() => setEditingDept(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleUpdateDepartment}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </AppModal.Footer>
            </>
          )}
        </AppModal>

        {/* Edit Role Modal */}
        <AppModal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          title="Edit Role"
          size="sm"
        >
          {editingRole && (
            <>
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
                <AIWriteAssist
                  context="role-description"
                  value={editingRole.role.description || ''}
                  onSuggestion={(val) => setEditingRole({
                    ...editingRole,
                    role: { ...editingRole.role, description: val }
                  })}
                  additionalContext={editingRole.role.name ? `Role: ${editingRole.role.name}` : ''}
                >
                  <textarea
                    value={editingRole.role.description || ''}
                    onChange={e => setEditingRole({
                      ...editingRole,
                      role: { ...editingRole.role, description: e.target.value }
                    })}
                    rows={3}
                    placeholder="What does this role do?"
                  />
                </AIWriteAssist>
              </div>
              <AppModal.Footer>
                <Button variant="outline" onClick={() => setEditingRole(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={handleUpdateRole}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </AppModal.Footer>
            </>
          )}
        </AppModal>

        {/* View Role Prompt Modal */}
        <AppModal
          isOpen={!!viewingRolePrompt}
          onClose={() => setViewingRolePrompt(null)}
          title="Role System Prompt"
          size="lg"
        >
          {viewingRolePrompt && (
            <>
              <div className="org-prompt-info">
                <span className="org-prompt-path">
                  councils/organisations/{companyId}/departments/{viewingRolePrompt.deptId}/roles/{viewingRolePrompt.roleId}.md
                </span>
                {!viewingRolePrompt.exists && (
                  <span className="org-prompt-missing">File not found - using default prompt</span>
                )}
              </div>
              <pre className="org-prompt-content">{viewingRolePrompt.prompt}</pre>
              <AppModal.Footer>
                <Button variant="default" onClick={() => setViewingRolePrompt(null)}>
                  Close
                </Button>
              </AppModal.Footer>
            </>
          )}
        </AppModal>

        {/* Alert Modal */}
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
