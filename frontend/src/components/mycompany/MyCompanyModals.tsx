import { lazy, Suspense, ReactNode } from 'react';
import { Spinner } from '../ui/Spinner';
import { api } from '../../api';
import ProjectModal from '../ProjectModal';
import type { Department, Role, Playbook, Project } from '../../types/business';

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

// Type definitions
type AddFormType = 'department' | 'playbook' | { type: 'role'; deptId: string } | null;

interface Decision {
  id: string;
  conversation_id: string;
  company_id: string;
  title: string;
  content: string;
  content_summary?: string;
  question?: string;
  summary?: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  council_type?: string;
  project_id?: string;
  department_ids?: string[];
  playbook_type?: 'sop' | 'framework' | 'policy';
  source_conversation_id?: string;
  response_index?: number;
  created_at: string;
  updated_at: string;
}

interface CompanyContextData {
  context_md?: string;
  industry?: string;
  size?: string;
}

interface EditingItem {
  type: 'company-context' | 'company-context-view' | 'department' | 'role' | 'playbook' | 'decision' | 'project' | 'new_project';
  data: Department | Role | Playbook | ExtendedProject | Decision | CompanyContextData | unknown;
  startEditing?: boolean;
}

interface ConfirmModalData {
  title: string;
  message: string;
  confirmText: string;
  variant: 'warning' | 'danger';
}

interface ProjectActions {
  handleUpdateProject: (id: string, updates: Partial<Project>) => Promise<Project | undefined>;
}

interface DecisionActions {
  setPromoteModal: (decision: Decision | null) => void;
  handleConfirmPromote: (docType: string, title: string, departmentIds: string[], projectId: string | null) => void;
}

// Loading fallback for lazy-loaded modals
const ModalLoadingFallback = () => (
  <div className="modal-loading-fallback flex items-center justify-center p-8">
    <Spinner size="lg" />
  </div>
);

const LazyWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<ModalLoadingFallback />}>{children}</Suspense>
);

interface AddFormModalProps {
  showAddForm: AddFormType;
  saving: boolean;
  departments: Department[];
  onAddDepartment: (name: string, description?: string) => Promise<void>;
  onAddRole: (deptId: string, name: string, title: string) => Promise<void>;
  onAddPlaybook: (title: string, docType: string, content?: string, departmentId?: string | null, additionalDepartments?: string[]) => Promise<void>;
  onClose: () => void;
}

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
}: AddFormModalProps) {
  if (!showAddForm) return null;

  if (showAddForm === 'department') {
    return <AddDepartmentModal onSave={onAddDepartment} onClose={onClose} saving={saving} />;
  }
  if (typeof showAddForm === 'object' && showAddForm.type === 'role') {
    return <AddRoleModal deptId={showAddForm.deptId} onSave={onAddRole} onClose={onClose} saving={saving} />;
  }
  if (showAddForm === 'playbook') {
    return <AddPlaybookModal onSave={onAddPlaybook} onClose={onClose} saving={saving} departments={departments} />;
  }
  return null;
}

interface ExtendedProject extends Project {
  context_md?: string;
  source?: string;
  source_conversation_id?: string;
  decision_count?: number;
  department_names?: string[];
  last_accessed_at?: string;
}

interface EditingModalProps {
  editingItem: EditingItem | null;
  companyId: string;
  companyName?: string | undefined;
  departments: Department[];
  playbooks: Playbook[];
  projects: ExtendedProject[] | Project[];
  initialProjectDecisionToExpand: string | null;
  projectActions: ProjectActions;
  decisionActions: DecisionActions | { setPromoteModal: (decision: Decision | null) => void; handleConfirmPromote: (docType: string, title: string, departmentIds: string[], projectId: string | null) => Promise<void>; deletingDecisionId: string | null; saving: boolean; promoteModal: Decision | null; handlePromoteDecision: (decision: unknown) => void; handleDeleteDecision: (decision: Decision) => Promise<void>; };
  onClose: () => void;
  onConsumeInitialDecision?: (() => void) | undefined;
  onUpdateCompanyContext: (data: { context_md: string }) => Promise<void>;
  onUpdateDepartment: (id: string, data: Partial<Department>) => Promise<void>;
  onUpdateRole: (roleId: string, deptId: string, data: Partial<Role>) => Promise<void>;
  onUpdatePlaybook: (id: string, data: Partial<Playbook>) => Promise<void>;
  onNavigateToConversation?: ((conversationId: string, source: string, responseIndex?: number | undefined, projectId?: string | undefined, decisionId?: string | undefined) => void) | undefined;
  onSetProjects: React.Dispatch<React.SetStateAction<ExtendedProject[]>> | React.Dispatch<React.SetStateAction<Project[]>>;
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
}: EditingModalProps) {
  if (!editingItem) return null;

  switch (editingItem.type) {
    case 'company-context':
      return (
        <LazyWrapper>
          <ViewCompanyContextModal
            data={editingItem.data as CompanyContextData}
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
            data={editingItem.data as CompanyContextData}
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
            department={editingItem.data as Department}
            onClose={onClose}
            onSave={(id: string, data: { context_md: string }) => onUpdateDepartment(id, data)}
          />
        </LazyWrapper>
      );
    case 'role':
      return (
        <LazyWrapper>
          <ViewRoleModal
            role={editingItem.data as Role}
            onClose={onClose}
            onSave={onUpdateRole}
          />
        </LazyWrapper>
      );
    case 'playbook':
      return (
        <LazyWrapper>
          <ViewPlaybookModal
            playbook={editingItem.data as Playbook}
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
            decision={editingItem.data as Decision}
            departments={departments}
            playbooks={playbooks}
            projects={projects}
            onClose={onClose}
            onPromote={(decision) => {
              onClose();
              decisionActions.setPromoteModal(decision as Decision);
            }}
            onViewProject={(_projectId: string) => {
              // This will be handled by parent - close and open project modal
            }}
            onNavigateToConversation={(conversationId: string, source: string, responseIndex?: number) => {
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
            project={editingItem.data as ExtendedProject}
            companyId={companyId}
            departments={departments}
            initialExpandedDecisionId={initialProjectDecisionToExpand}
            {...(onConsumeInitialDecision ? { onConsumeInitialDecision } : {})}
            onClose={onClose}
            onSave={projectActions.handleUpdateProject}
            {...(onNavigateToConversation ? { onNavigateToConversation } : {})}
            onProjectUpdate={(projectId: string, updates: Partial<ExtendedProject>) => {
              (onSetProjects as React.Dispatch<React.SetStateAction<ExtendedProject[]>>)((prev: ExtendedProject[]) => prev.map((p: ExtendedProject) => p.id === projectId ? { ...p, ...updates } : p));
            }}
            onStatusChange={async (projectId: string, newStatus: 'active' | 'completed' | 'archived') => {
              await api.updateProject(projectId, { status: newStatus });
              (onSetProjects as React.Dispatch<React.SetStateAction<ExtendedProject[]>>)((prev: ExtendedProject[]) => prev.map((p: ExtendedProject) => p.id === projectId ? { ...p, status: newStatus } : p));
              onClose();
            }}
            onDelete={async (projectId: string) => {
              await api.deleteProject(projectId);
              (onSetProjects as React.Dispatch<React.SetStateAction<ExtendedProject[]>>)((prev: ExtendedProject[]) => prev.filter((p: ExtendedProject) => p.id !== projectId));
              onClose();
            }}
          />
        </LazyWrapper>
      );
    case 'new_project':
      return (
        <ProjectModal
          companyId={companyId}
          departments={departments as Department[]}
          onClose={onClose}
          onProjectCreated={(project: ExtendedProject) => {
            (onSetProjects as React.Dispatch<React.SetStateAction<ExtendedProject[]>>)((prev: ExtendedProject[]) => [project, ...prev]);
            onClose();
          }}
        />
      );
    default:
      return null;
  }
}

interface PromoteModalProps {
  promoteModal: Decision | null;
  departments: Department[];
  projects: ExtendedProject[] | Project[];
  companyId: string;
  saving: boolean;
  decisionActions: DecisionActions | { setPromoteModal: (decision: Decision | null) => void; handleConfirmPromote: (docType: string, title: string, departmentIds: string[], projectId: string | null) => Promise<void>; deletingDecisionId: string | null; saving: boolean; promoteModal: Decision | null; handlePromoteDecision: (decision: unknown) => void; handleDeleteDecision: (decision: Decision) => Promise<void>; };
  onNavigateToConversation?: ((conversationId: string, source: string, decisionToRestore?: Decision | undefined) => void) | undefined;
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
}: PromoteModalProps) {
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
        onViewSource={(convId: string) => {
          const decisionToRestore = promoteModal;
          decisionActions.setPromoteModal(null);
          if (onNavigateToConversation) onNavigateToConversation(convId, 'decisions', decisionToRestore);
        }}
      />
    </Suspense>
  );
}

interface ConfirmActionModalProps {
  confirmModal: ConfirmModalData | { title: string; message: string; confirmText: string; variant?: 'warning' | 'danger'; onConfirm: () => void } | null;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmActionModal - Renders the confirm modal for archive/delete actions
 */
export function ConfirmActionModal({
  confirmModal,
  saving,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!confirmModal) return null;

  return (
    <ConfirmModal
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={confirmModal.confirmText}
      variant={confirmModal.variant || 'warning'}
      onConfirm={onConfirm}
      onCancel={onCancel}
      processing={saving}
    />
  );
}

export { ModalLoadingFallback };
