import { lazy, Suspense } from 'react';
import { Spinner } from '../ui/Spinner';
import { api } from '../../api';
import ProjectModal from '../ProjectModal';

// Eagerly load small/simple modals
import {
  AddDepartmentModal,
  AddRoleModal,
  AddPlaybookModal,
} from './modals';
import { ConfirmModal } from '../ui/ConfirmModal';

// Lazy load large/complex modals
const ViewProjectModal = lazy(() => import('./modals/ViewProjectModal').then(m => ({ default: m.ViewProjectModal })));
const ViewPlaybookModal = lazy(() => import('./modals/ViewPlaybookModal').then(m => ({ default: m.ViewPlaybookModal })));
const PromoteDecisionModal = lazy(() => import('./modals/PromoteDecisionModal').then(m => ({ default: m.PromoteDecisionModal })));
const ViewDepartmentModal = lazy(() => import('./modals/ViewDepartmentModal').then(m => ({ default: m.ViewDepartmentModal })));
const ViewRoleModal = lazy(() => import('./modals/ViewRoleModal').then(m => ({ default: m.ViewRoleModal })));
const ViewCompanyContextModal = lazy(() => import('./modals/ViewCompanyContextModal').then(m => ({ default: m.ViewCompanyContextModal })));
const ViewDecisionModal = lazy(() => import('./modals/ViewDecisionModal').then(m => ({ default: m.ViewDecisionModal })));

// Loading fallback for lazy-loaded modals
const ModalLoadingFallback = () => (
  <div className="modal-loading-fallback flex items-center justify-center p-8">
    <Spinner size="lg" />
  </div>
);

const LazyWrapper = ({ children }) => (
  <Suspense fallback={<ModalLoadingFallback />}>{children}</Suspense>
);

/**
 * AddFormModal - Renders the add department/role/playbook modals
 */
export function AddFormModal({
  showAddForm,
  saving,
  departments,
  onAddDepartment,
  onAddRole,
  onAddPlaybook,
  onClose,
}) {
  if (!showAddForm) return null;

  if (showAddForm === 'department') {
    return <AddDepartmentModal onSave={onAddDepartment} onClose={onClose} saving={saving} />;
  }
  if (showAddForm?.type === 'role') {
    return <AddRoleModal deptId={showAddForm.deptId} onSave={onAddRole} onClose={onClose} saving={saving} />;
  }
  if (showAddForm === 'playbook') {
    return <AddPlaybookModal onSave={onAddPlaybook} onClose={onClose} saving={saving} departments={departments} />;
  }
  return null;
}

/**
 * EditingModal - Renders the view/edit modals based on editingItem type
 */
export function EditingModal({
  editingItem,
  companyId,
  companyName,
  departments,
  playbooks,
  projects,
  initialProjectDecisionToExpand,
  projectActions,
  decisionActions,
  onClose,
  onConsumeInitialDecision,
  onUpdateCompanyContext,
  onUpdateDepartment,
  onUpdateRole,
  onUpdatePlaybook,
  onNavigateToConversation,
  onSetProjects,
}) {
  if (!editingItem) return null;

  switch (editingItem.type) {
    case 'company-context':
      return (
        <LazyWrapper>
          <ViewCompanyContextModal
            data={editingItem.data}
            companyName={companyName}
            onClose={onClose}
            onSave={onUpdateCompanyContext}
          />
        </LazyWrapper>
      );
    case 'company-context-view':
      return (
        <LazyWrapper>
          <ViewCompanyContextModal
            data={editingItem.data}
            companyName={companyName}
            onClose={onClose}
            onSave={onUpdateCompanyContext}
            initialEditing={false}
            fullscreen={true}
          />
        </LazyWrapper>
      );
    case 'department':
      return (
        <LazyWrapper>
          <ViewDepartmentModal
            department={editingItem.data}
            onClose={onClose}
            onSave={onUpdateDepartment}
          />
        </LazyWrapper>
      );
    case 'role':
      return (
        <LazyWrapper>
          <ViewRoleModal
            role={editingItem.data}
            onClose={onClose}
            onSave={onUpdateRole}
          />
        </LazyWrapper>
      );
    case 'playbook':
      return (
        <LazyWrapper>
          <ViewPlaybookModal
            playbook={editingItem.data}
            departments={departments}
            onClose={onClose}
            onSave={onUpdatePlaybook}
            startEditing={editingItem.startEditing || false}
          />
        </LazyWrapper>
      );
    case 'decision':
      return (
        <LazyWrapper>
          <ViewDecisionModal
            decision={editingItem.data}
            departments={departments}
            playbooks={playbooks}
            projects={projects}
            onClose={onClose}
            onPromote={(decision) => {
              onClose();
              decisionActions.setPromoteModal(decision);
            }}
            onViewProject={(_projectId) => {
              // This will be handled by parent - close and open project modal
            }}
            onNavigateToConversation={(conversationId, source, responseIndex) => {
              onClose();
              if (onNavigateToConversation) onNavigateToConversation(conversationId, source, responseIndex);
            }}
          />
        </LazyWrapper>
      );
    case 'project':
      return (
        <LazyWrapper>
          <ViewProjectModal
            project={editingItem.data}
            companyId={companyId}
            departments={departments}
            initialExpandedDecisionId={initialProjectDecisionToExpand}
            onConsumeInitialDecision={onConsumeInitialDecision}
            onClose={onClose}
            onSave={projectActions.handleUpdateProject}
            onNavigateToConversation={onNavigateToConversation}
            onProjectUpdate={(projectId, updates) => {
              onSetProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } : p));
            }}
            onStatusChange={async (projectId, newStatus) => {
              await api.updateProject(projectId, { status: newStatus });
              onSetProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
              onClose();
            }}
            onDelete={async (projectId) => {
              await api.deleteProject(projectId);
              onSetProjects(prev => prev.filter(p => p.id !== projectId));
              onClose();
            }}
          />
        </LazyWrapper>
      );
    case 'new_project':
      return (
        <ProjectModal
          companyId={companyId}
          departments={departments}
          onClose={onClose}
          onProjectCreated={(project) => {
            onSetProjects(prev => [project, ...prev]);
            onClose();
          }}
        />
      );
    default:
      return null;
  }
}

/**
 * PromoteModal - Renders the promote decision modal
 */
export function PromoteModal({
  promoteModal,
  departments,
  projects,
  companyId,
  saving,
  decisionActions,
  onNavigateToConversation,
}) {
  if (!promoteModal) return null;

  return (
    <Suspense fallback={<ModalLoadingFallback />}>
      <PromoteDecisionModal
        decision={promoteModal}
        departments={departments}
        projects={projects}
        companyId={companyId}
        onPromote={decisionActions.handleConfirmPromote}
        onClose={() => decisionActions.setPromoteModal(null)}
        saving={saving}
        onViewSource={(convId) => {
          const decisionToRestore = promoteModal;
          decisionActions.setPromoteModal(null);
          if (onNavigateToConversation) onNavigateToConversation(convId, 'decisions', decisionToRestore);
        }}
      />
    </Suspense>
  );
}

/**
 * ConfirmActionModal - Renders the confirm modal for archive/delete actions
 */
export function ConfirmActionModal({
  confirmModal,
  saving,
  onConfirm,
  onCancel,
}) {
  if (!confirmModal) return null;

  return (
    <ConfirmModal
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={confirmModal.confirmText}
      variant={confirmModal.variant}
      onConfirm={onConfirm}
      onCancel={onCancel}
      processing={saving}
    />
  );
}

export { ModalLoadingFallback };
