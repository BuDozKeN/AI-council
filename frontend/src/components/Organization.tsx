import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Spinner } from './ui/Spinner';
import { AppModal } from './ui/AppModal';
import { Button } from './ui/button';
import { AlertModal } from './ui/AlertModal';
import { AIWriteAssist } from './ui/AIWriteAssist';
import { toast } from './ui/sonner';
import { logger } from '../utils/logger';
import { makeClickable } from '../utils/a11y';
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

interface DeleteConfirmState {
  type: 'department' | 'role';
  id: string;
  deptId?: string; // Required for role deletion
  name: string;
  roleCount?: number; // For department deletion warning
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
export default function Organization({
  companyId,
  companyName,
  onClose,
  onOpenKnowledgeBase,
}: OrganizationProps) {
  const { t } = useTranslation();
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
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

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
          setError(t('organization.errors.notFound'));
        }
      } catch (fetchErr) {
        if (cancelled) return;
        logger.error('Failed to fetch organization:', fetchErr);
        setError(t('organization.errors.loadFailed'));
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    loadOrganization();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setError(t('organization.errors.notFound'));
      }
    } catch (fetchErr) {
      logger.error('Failed to fetch organization:', fetchErr);
      setError(t('organization.errors.loadFailed'));
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
      const deptSlug = newDept.id || generateSlug(newDept.name);
      const deptName = newDept.name.trim();
      await api.createCompanyDepartment(companyId, {
        slug: deptSlug,
        name: deptName,
      });

      // Refresh data
      await fetchOrganization();
      setShowAddDept(false);
      setNewDept({ id: '', name: '', description: '' });
      toast.success(t('organization.toast.deptCreated', { name: deptName }), { duration: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.createDeptFailed', { message }),
        variant: 'error',
      });
    }
    setSaving(false);
  }

  // Handle adding a new role
  async function handleAddRole(deptId: string) {
    if (!newRole.name.trim()) return;

    setSaving(true);
    try {
      const roleSlug = newRole.id || generateSlug(newRole.name);
      const roleName = newRole.name.trim();
      await api.createCompanyRole(companyId, deptId, {
        slug: roleSlug,
        name: roleName,
        responsibilities: newRole.description.trim() || undefined,
      });

      // Refresh data
      await fetchOrganization();
      setShowAddRole(null);
      setNewRole({ id: '', name: '', description: '' });
      toast.success(t('organization.toast.roleAdded', { name: roleName }), { duration: 3000 });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.createRoleFailed', { message }),
        variant: 'error',
      });
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
      await api.updateCompanyDepartment(companyId, editingDept.id, updates);

      await fetchOrganization();
      toast.success(t('organization.toast.deptUpdated', { name: editingDept.name }), {
        duration: 3000,
      });
      setEditingDept(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.updateDeptFailed', { message }),
        variant: 'error',
      });
    }
    setSaving(false);
  }

  // Handle updating a role
  async function handleUpdateRole() {
    if (!editingRole) return;

    setSaving(true);
    try {
      const updates: { name?: string; responsibilities?: string } = { name: editingRole.role.name };
      if (editingRole.role.description !== undefined) {
        updates.responsibilities = editingRole.role.description;
      }
      await api.updateCompanyRole(companyId, editingRole.deptId, editingRole.role.id, updates);

      await fetchOrganization();
      toast.success(t('organization.toast.roleUpdated', { name: editingRole.role.name }), {
        duration: 3000,
      });
      setEditingRole(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.updateRoleFailed', { message }),
        variant: 'error',
      });
    }
    setSaving(false);
  }

  // Handle deleting a department
  async function handleDeleteDepartment() {
    if (!deleteConfirm || deleteConfirm.type !== 'department') return;

    setSaving(true);
    try {
      await api.deleteDepartment(companyId, deleteConfirm.id);
      await fetchOrganization();
      toast.success(t('organization.toast.deptDeleted', { name: deleteConfirm.name }), {
        duration: 3000,
      });
      setDeleteConfirm(null);
      // If the deleted dept was expanded, clear expansion
      if (expandedDept === deleteConfirm.id) {
        setExpandedDept(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.deleteDeptFailed', { message }),
        variant: 'error',
      });
    }
    setSaving(false);
  }

  // Handle deleting a role
  async function handleDeleteRole() {
    if (!deleteConfirm || deleteConfirm.type !== 'role' || !deleteConfirm.deptId) return;

    setSaving(true);
    try {
      await api.deleteRole(companyId, deleteConfirm.deptId, deleteConfirm.id);
      await fetchOrganization();
      toast.success(t('organization.toast.roleDeleted', { name: deleteConfirm.name }), {
        duration: 3000,
      });
      setDeleteConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.unknownError');
      setAlertModal({
        title: t('common.error'),
        message: t('organization.errors.deleteRoleFailed', { message }),
        variant: 'error',
      });
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
        prompt: result.context || t('organization.noPrompt'),
        exists: result.exists,
      });
    } catch {
      setViewingRolePrompt({
        deptId,
        roleId,
        prompt: t('organization.promptLoadFailed'),
        exists: false,
      });
    }
  }

  // Count total roles
  const totalRoles = departments.reduce((sum, dept) => sum + (dept.roles?.length || 0), 0);

  return (
    <AppModal
      isOpen={true}
      onClose={onClose}
      title={t('organization.title')}
      description={t('organization.description', {
        company: companyName || t('organization.yourCompany'),
        depts: departments.length,
        roles: totalRoles,
      })}
      size="lg"
      contentClassName="org-modal-body"
    >
      {/* Quick Actions */}
      <div className="org-actions">
        <Button variant="default" onClick={() => setShowAddDept(true)}>
          {t('organization.newDepartment')}
        </Button>
        <Button variant="outline" onClick={() => onOpenKnowledgeBase && onOpenKnowledgeBase()}>
          {t('organization.viewSops')}
        </Button>
      </div>

      {/* Content */}
      <div className="org-content">
        {loading ? (
          <div className="org-loading">
            <Spinner size="lg" variant="brand" />
            <p>{t('organization.loading')}</p>
          </div>
        ) : error ? (
          <div className="org-error">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchOrganization}>
              {t('common.retry')}
            </Button>
          </div>
        ) : departments.length === 0 ? (
          <div className="org-empty">
            <div className="org-empty-icon">🏢</div>
            <p className="org-empty-title">{t('organization.noDepartments')}</p>
            <p className="org-empty-hint">{t('organization.addFirstDept')}</p>
            <Button variant="default" onClick={() => setShowAddDept(true)}>
              {t('organization.newDepartment')}
            </Button>
          </div>
        ) : (
          <div className="org-departments">
            {departments.map((dept) => (
              <div key={dept.id} className="org-dept">
                {/* Department Header */}
                <div
                  className="org-dept-header"
                  {...makeClickable(() =>
                    setExpandedDept(expandedDept === dept.id ? null : dept.id)
                  )}
                >
                  <div className="org-dept-info">
                    <h3 className="org-dept-name">{dept.name}</h3>
                    <span className="org-dept-meta">
                      {t('organization.rolesCount', { count: dept.roles?.length || 0 })}
                    </span>
                  </div>
                  <div className="org-dept-actions">
                    <button
                      className="org-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingDept({ ...dept });
                      }}
                      title={t('organization.editDepartment')}
                    >
                      ✏️
                    </button>
                    <button
                      className="org-icon-btn org-icon-btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({
                          type: 'department',
                          id: dept.id,
                          name: dept.name,
                          roleCount: dept.roles?.length || 0,
                        });
                      }}
                      title={t('organization.deleteDepartment')}
                    >
                      🗑️
                    </button>
                    <span className="org-expand-icon">{expandedDept === dept.id ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Department description */}
                {dept.description && <p className="org-dept-desc">{dept.description}</p>}

                {/* Expanded: Show Roles */}
                {expandedDept === dept.id && (
                  <div className="org-roles">
                    {dept.roles && dept.roles.length > 0 ? (
                      dept.roles.map((role) => (
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
                              {t('organization.viewPrompt')}
                            </button>
                            <button
                              className="org-icon-btn small"
                              onClick={() => setEditingRole({ deptId: dept.id, role: { ...role } })}
                              title={t('organization.editRole')}
                            >
                              ✏️
                            </button>
                            <button
                              className="org-icon-btn small org-icon-btn-danger"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: 'role',
                                  id: role.id,
                                  deptId: dept.id,
                                  name: role.name,
                                })
                              }
                              title={t('organization.deleteRole')}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="org-no-roles">{t('organization.noRoles')}</p>
                    )}

                    {/* Add Role Button */}
                    {showAddRole === dept.id ? (
                      <div className="org-add-form">
                        <input
                          id={`new-role-name-${dept.id}`}
                          name="new-role-name"
                          type="text"
                          placeholder={t('organization.placeholders.roleName')}
                          value={newRole.name}
                          onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                        />
                        <AIWriteAssist
                          context="role-description"
                          value={newRole.description}
                          onSuggestion={(val) => setNewRole({ ...newRole, description: val })}
                          additionalContext={newRole.name ? `Role: ${newRole.name}` : ''}
                        >
                          <input
                            id={`new-role-desc-${dept.id}`}
                            name="new-role-description"
                            type="text"
                            placeholder={t('organization.placeholders.descriptionOptional')}
                            value={newRole.description}
                            onChange={(e) =>
                              setNewRole({ ...newRole, description: e.target.value })
                            }
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
                            {t('common.cancel')}
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAddRole(dept.id)}
                            disabled={saving || !newRole.name.trim()}
                          >
                            {saving ? t('organization.adding') : t('organization.addRole')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setShowAddRole(dept.id)}>
                        {t('organization.newRole')}
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
        title={t('organization.addDepartmentTitle')}
        size="sm"
      >
        <div className="org-form-group">
          <label htmlFor="new-dept-name">{t('organization.labels.deptName')}</label>
          <input
            id="new-dept-name"
            name="department-name"
            type="text"
            placeholder={t('organization.placeholders.deptName')}
            value={newDept.name}
            onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </div>
        <div className="org-form-group">
          <label htmlFor="new-dept-slug">{t('organization.labels.slug')}</label>
          <input
            id="new-dept-slug"
            name="department-slug"
            type="text"
            value={newDept.id || generateSlug(newDept.name)}
            onChange={(e) => setNewDept({ ...newDept, id: e.target.value })}
            placeholder={t('organization.placeholders.slugAuto')}
          />
          <span className="org-form-hint">{t('organization.hints.slug')}</span>
        </div>
        <AppModal.Footer>
          <Button variant="outline" onClick={() => setShowAddDept(false)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="default"
            onClick={handleAddDepartment}
            disabled={saving || !newDept.name.trim()}
          >
            {saving ? t('organization.creating') : t('organization.createDepartment')}
          </Button>
        </AppModal.Footer>
      </AppModal>

      {/* Edit Department Modal */}
      <AppModal
        isOpen={!!editingDept}
        onClose={() => setEditingDept(null)}
        title={t('organization.editDepartmentTitle')}
        size="sm"
      >
        {editingDept && (
          <>
            <div className="org-form-group">
              <label htmlFor="edit-dept-name">{t('organization.labels.deptName')}</label>
              <input
                id="edit-dept-name"
                name="department-name"
                type="text"
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
              />
            </div>
            <div className="org-form-group">
              <label htmlFor="edit-dept-description">{t('organization.labels.description')}</label>
              <AIWriteAssist
                context="department-description"
                value={editingDept.description || ''}
                onSuggestion={(val) => setEditingDept({ ...editingDept, description: val })}
                additionalContext={editingDept.name ? `Department: ${editingDept.name}` : ''}
              >
                <textarea
                  id="edit-dept-description"
                  name="department-description"
                  value={editingDept.description || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
                  rows={3}
                  placeholder={t('organization.placeholders.deptDescription')}
                />
              </AIWriteAssist>
            </div>
            <AppModal.Footer>
              <Button variant="outline" onClick={() => setEditingDept(null)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button variant="default" onClick={handleUpdateDepartment} disabled={saving}>
                {saving ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </AppModal.Footer>
          </>
        )}
      </AppModal>

      {/* Edit Role Modal */}
      <AppModal
        isOpen={!!editingRole}
        onClose={() => setEditingRole(null)}
        title={t('organization.editRoleTitle')}
        size="sm"
      >
        {editingRole && (
          <>
            <div className="org-form-group">
              <label htmlFor="edit-role-name">{t('organization.labels.roleName')}</label>
              <input
                id="edit-role-name"
                name="role-name"
                type="text"
                value={editingRole.role.name}
                onChange={(e) =>
                  setEditingRole({
                    ...editingRole,
                    role: { ...editingRole.role, name: e.target.value },
                  })
                }
              />
            </div>
            <div className="org-form-group">
              <label htmlFor="edit-role-description">{t('organization.labels.description')}</label>
              <AIWriteAssist
                context="role-description"
                value={editingRole.role.description || ''}
                onSuggestion={(val) =>
                  setEditingRole({
                    ...editingRole,
                    role: { ...editingRole.role, description: val },
                  })
                }
                additionalContext={editingRole.role.name ? `Role: ${editingRole.role.name}` : ''}
              >
                <textarea
                  id="edit-role-description"
                  name="role-description"
                  value={editingRole.role.description || ''}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      role: { ...editingRole.role, description: e.target.value },
                    })
                  }
                  rows={3}
                  placeholder={t('organization.placeholders.roleDescription')}
                />
              </AIWriteAssist>
            </div>
            <AppModal.Footer>
              <Button variant="outline" onClick={() => setEditingRole(null)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button variant="default" onClick={handleUpdateRole} disabled={saving}>
                {saving ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </AppModal.Footer>
          </>
        )}
      </AppModal>

      {/* View Role Prompt Modal */}
      <AppModal
        isOpen={!!viewingRolePrompt}
        onClose={() => setViewingRolePrompt(null)}
        title={t('organization.rolePromptTitle')}
        size="lg"
      >
        {viewingRolePrompt && (
          <>
            <div className="org-prompt-info">
              <span className="org-prompt-path">
                councils/organisations/{companyId}/departments/{viewingRolePrompt.deptId}/roles/
                {viewingRolePrompt.roleId}.md
              </span>
              {!viewingRolePrompt.exists && (
                <span className="org-prompt-missing">{t('organization.promptNotFound')}</span>
              )}
            </div>
            <pre className="org-prompt-content">{viewingRolePrompt.prompt}</pre>
            <AppModal.Footer>
              <Button variant="default" onClick={() => setViewingRolePrompt(null)}>
                {t('common.close')}
              </Button>
            </AppModal.Footer>
          </>
        )}
      </AppModal>

      {/* Delete Confirmation Modal */}
      <AppModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title={
          deleteConfirm?.type === 'department'
            ? t('organization.deleteDepartmentTitle')
            : t('organization.deleteRoleTitle')
        }
        size="sm"
      >
        {deleteConfirm && (
          <>
            <p className="org-delete-message">
              {deleteConfirm.type === 'department'
                ? t('organization.deleteDepartmentMessage', { name: deleteConfirm.name })
                : t('organization.deleteRoleMessage', { name: deleteConfirm.name })}
            </p>
            {deleteConfirm.type === 'department' && (deleteConfirm.roleCount ?? 0) > 0 && (
              <p className="org-delete-warning">
                {t('organization.deleteDepartmentWarning', { count: deleteConfirm.roleCount ?? 0 })}
              </p>
            )}
            <AppModal.Footer>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={
                  deleteConfirm.type === 'department' ? handleDeleteDepartment : handleDeleteRole
                }
                disabled={saving}
              >
                {saving ? t('common.deleting') : t('common.delete')}
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
