import { useState, useCallback } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import { toast } from '../../ui/sonner';
import type { Decision, Project } from '../../../types';
import type { MyCompanyTab } from './useCompanyData';

const log = logger.scope('useDecisionActions');

export type DocType = 'project' | 'sop' | 'framework' | 'policy';

interface UseDecisionActionsOptions {
  companyId: string | null;
  setDecisions: React.Dispatch<React.SetStateAction<Decision[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  loadData: () => Promise<void>;
  setActiveTab: (tab: MyCompanyTab) => void;
  setHighlightedProjectId: (id: string | null) => void;
}

/**
 * Hook for managing decision actions (promote, delete)
 * Handles promotion to playbook/project and deletion with animation
 */
export function useDecisionActions({
  companyId,
  setDecisions,
  setProjects: _setProjects,
  loadData,
  setActiveTab,
  setHighlightedProjectId,
}: UseDecisionActionsOptions) {
  const [promoteModal, setPromoteModal] = useState<Decision | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Open promote modal
  const handlePromoteDecision = useCallback((decision: Decision): void => {
    setPromoteModal(decision);
  }, []);

  // Execute promotion after user selects type in modal
  const handleConfirmPromote = useCallback(async (docType: DocType, title: string | null, departmentIds: string[] | null, projectId: string | null): Promise<void> => {
    if (!promoteModal) return;

    setSaving(true);
    try {
      if (docType === 'project') {
        // Promote to project
        let targetProjectId = projectId;
        if (projectId) {
          // Add to existing project - link decision to project
          await api.linkDecisionToProject(companyId!, promoteModal.id, projectId);
        } else {
          // Create new project from decision
          const result = await api.createProjectFromDecision(companyId!, promoteModal.id, {
            name: title || promoteModal.title,
            department_ids: departmentIds && departmentIds.length > 0 ? departmentIds : []
          });
          // Get the new project ID from the response
          targetProjectId = result?.project?.id;
        }
        // Navigate to the project after promotion
        if (targetProjectId) {
          setPromoteModal(null);
          await loadData();
          setActiveTab('projects');
          setHighlightedProjectId(targetProjectId);
          toast.success(projectId
            ? `Decision added to project`
            : `"${title || promoteModal.title}" created as project`,
            { duration: 3000 }
          );
          setSaving(false);
          return; // Early return - we've handled everything
        }
      } else {
        // Promote to playbook (SOP, Framework, Policy)
        await api.promoteDecisionToPlaybook(companyId!, promoteModal.id, {
          doc_type: docType,
          title: title || promoteModal.title,
          department_ids: departmentIds || []
        });
        const docTypeLabel = docType === 'sop' ? 'SOP' : docType.charAt(0).toUpperCase() + docType.slice(1);
        toast.success(`"${title || promoteModal.title}" created as ${docTypeLabel}`, { duration: 3000 });
      }
      setPromoteModal(null);
      // Reload decisions to show promoted status
      await loadData();
    } catch (err) {
      log.error('Failed to promote decision', { error: err });
      toast.error('Failed to promote decision');
    }
    setSaving(false);
  }, [promoteModal, companyId, loadData, setActiveTab, setHighlightedProjectId]);

  // Delete decision with fade-out animation
  const handleDeleteDecision = useCallback(async (decision: Decision): Promise<void> => {
    // Start the fade-out animation
    setDeletingDecisionId(decision.id);

    // Wait for animation to complete (300ms), then remove from local state
    setTimeout(async () => {
      // Optimistically remove from local state
      setDecisions(prev => prev.filter(d => d.id !== decision.id));
      setDeletingDecisionId(null);

      // Then call API in background
      try {
        await api.deleteDecision(companyId!, decision.id);
        toast.success(`"${decision.title}" removed from decisions`, { duration: 3000 });
      } catch (err) {
        log.error('Failed to delete decision', { error: err });
        // On error, restore the decision to the list (don't reload to avoid skeleton flash)
        setDecisions(prev => [...prev, decision].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
        toast.error('Failed to delete decision');
      }
    }, 300);
  }, [companyId, setDecisions]);

  return {
    // State
    promoteModal,
    setPromoteModal,
    deletingDecisionId,
    saving,
    setSaving,

    // Actions
    handlePromoteDecision,
    handleConfirmPromote,
    handleDeleteDecision,
  };
}
