/**
 * MyCompany Modal Components
 *
 * Extracted from MyCompany.jsx for better maintainability.
 * These modals handle CRUD operations for company entities.
 */

// Re-export View modals from their own files
export { ViewProjectModal } from './ViewProjectModal';
export { ViewPlaybookModal } from './ViewPlaybookModal';
export { PromoteDecisionModal } from './PromoteDecisionModal';
export { ViewDepartmentModal } from './ViewDepartmentModal';
export { ViewRoleModal } from './ViewRoleModal';
export { ViewCompanyContextModal } from './ViewCompanyContextModal';
export { ViewDecisionModal } from './ViewDecisionModal';

// NEW: Multi-step wizards for entity creation (matches ProjectModal pattern)
export { AddDepartmentModal } from './AddDepartmentModal';
export { AddRoleModal } from './AddRoleModal';
export { AddPlaybookModal } from './AddPlaybookModal';
export { AddCompanyContextModal } from './AddCompanyContextModal';

// Re-export shared UI modals for convenience
export { AlertModal } from '../../ui/AlertModal';
export { ConfirmModal } from '../../ui/ConfirmModal';
