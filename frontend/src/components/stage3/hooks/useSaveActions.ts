import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import type { Project } from '../../../types';
import type { SaveState } from './useDecisionState';

const log = logger.scope('useSaveActions');

interface ProjectWithContext {
  id: string;
  name: string;
  context_md?: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived';
  company_id?: string;
  department_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

interface UseSaveActionsOptions {
  companyId: string | null;
  conversationId: string | null;
  responseIndex: number;
  displayText: string;
  userQuestion: string | null;
  conversationTitle: string | null;
  selectedProjectId: string | null;
  selectedDeptIds: string[];
  selectedDocType: string;
  currentProject: ProjectWithContext | null;
  fullProjectData: ProjectWithContext | null;
  projects: Project[];
  saveState: SaveState;
  savedDecisionId: string | null;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  setSavedDecisionId: React.Dispatch<React.SetStateAction<string | null>>;
  setPromotedPlaybookId: React.Dispatch<React.SetStateAction<string | null>>;
  setFullProjectData: React.Dispatch<React.SetStateAction<ProjectWithContext | null>>;
  getTitle: () => string;
}

export interface UseSaveActionsReturn {
  handleSaveForLater: () => Promise<void>;
  handleSaveAndPromote: () => Promise<void>;
}

/**
 * Hook to manage save actions - saving decisions and promoting to playbooks.
 * Returns handlers for save operations.
 */
export function useSaveActions({
  companyId,
  conversationId,
  responseIndex,
  displayText,
  userQuestion,
  conversationTitle,
  selectedProjectId,
  selectedDeptIds,
  selectedDocType,
  currentProject,
  fullProjectData,
  projects,
  saveState,
  savedDecisionId,
  setSaveState,
  setSavedDecisionId,
  setPromotedPlaybookId,
  setFullProjectData,
  getTitle,
}: UseSaveActionsOptions): UseSaveActionsReturn {
  // Save as Decision (for later promotion)
  // If a project is selected, also merge into project context
  const handleSaveForLater = async () => {
    log.debug('handleSaveForLater CALLED:', {
      companyId,
      saveState,
      savedDecisionId,
      selectedProjectId,
      responseIndex,
      conversationId,
    });

    if (!companyId || saveState === 'saving') {
      log.debug('Early return - no companyId or already saving');
      return;
    }
    if (savedDecisionId && !selectedProjectId) {
      log.debug('Early return - already saved without project');
      return;
    }

    setSaveState('saving');
    try {
      let projectToUse = currentProject;

      // IMPORTANT: Always fetch full project data if context_md is missing
      // The projects list doesn't include context_md, so we need to fetch it
      if (selectedProjectId && (!projectToUse || projectToUse.context_md === undefined)) {
        log.debug('Project selected but no context_md, fetching full project:', selectedProjectId);
        try {
          const data = await api.getProject(selectedProjectId);
          projectToUse = data.project || data;
          setFullProjectData(projectToUse);
        } catch (err) {
          log.error('Failed to fetch project:', err);
          // Fall back to existing data if fetch fails
          if (!projectToUse && selectedProjectId) {
            const projectFromList = projects.find((p) => p.id === selectedProjectId);
            projectToUse = {
              id: selectedProjectId,
              name: projectFromList?.name || 'Project',
              context_md: '',
            };
          }
        }
      }

      if (selectedProjectId && projectToUse) {
        log.debug('Merging decision into project:', selectedProjectId);
        log.info('Calling mergeDecisionIntoProject API...');

        const mergeResult = await api.mergeDecisionIntoProject(
          selectedProjectId,
          projectToUse.context_md || '',
          displayText,
          userQuestion || conversationTitle || '',
          {
            saveDecision: true,
            companyId: companyId ?? undefined,
            conversationId: conversationId?.startsWith('temp-')
              ? undefined
              : (conversationId ?? undefined),
            responseIndex,
            decisionTitle: getTitle(),
            departmentId: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null,
            departmentIds: selectedDeptIds,
          }
        );

        log.debug('Merge result received:', mergeResult);

        if (mergeResult?.merged?.context_md) {
          await api.updateProject(selectedProjectId, {
            context_md: mergeResult.merged.context_md,
          });
        }

        const decisionId = mergeResult?.saved_decision_id;
        const saveError = mergeResult?.decision_save_error;

        if (saveError) {
          log.error('Backend reported save error:', saveError);
        }
        if (decisionId) {
          setSavedDecisionId(decisionId);
          setSaveState('saved');
          // Haptic feedback for save success
          if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
          if (projectToUse && (!fullProjectData || fullProjectData.id !== selectedProjectId)) {
            setFullProjectData(projectToUse);
          }
        } else {
          log.error('Merge succeeded but decision was NOT saved');
          const errorMsg = saveError || 'Decision was not saved. Please try again.';
          throw new Error(errorMsg);
        }
      } else {
        log.debug('No project selected, saving as standalone decision');
        const result = await api.createCompanyDecision(companyId!, {
          title: getTitle(),
          content: displayText,
          user_question: userQuestion ?? undefined,
          department_ids: selectedDeptIds,
          source_conversation_id: conversationId?.startsWith('temp-')
            ? undefined
            : (conversationId ?? undefined),
          response_index: responseIndex,
          project_id: selectedProjectId ?? undefined,
          tags: [],
        });

        log.debug('Save result:', result);
        const decisionId = result?.decision?.id || result?.id;
        if (!decisionId) {
          log.error('No decision ID in response:', result);
          throw new Error('No decision ID returned');
        }
        setSavedDecisionId(decisionId);
        setSaveState('saved');
        // Haptic feedback for save success
        if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
      }
    } catch (err) {
      log.error('Failed to save decision:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 5000);
    }
  };

  // Save AND promote to playbook in one step
  const handleSaveAndPromote = async () => {
    log.debug('handleSaveAndPromote CALLED:', {
      companyId,
      selectedDocType,
      saveState,
      selectedProjectId,
    });

    if (!companyId || !selectedDocType || saveState === 'saving' || saveState === 'promoting') {
      log.debug('handleSaveAndPromote - early return due to guard condition');
      return;
    }

    setSaveState('promoting');
    try {
      let decisionId = null;

      // Step 1: Save as decision
      if (selectedProjectId) {
        log.debug('handleSaveAndPromote - saving with project merge');

        let projectToUse = currentProject;
        // IMPORTANT: Always fetch full project data if context_md is missing
        if (!projectToUse || projectToUse.context_md === undefined) {
          try {
            const data = await api.getProject(selectedProjectId);
            projectToUse = data.project || data;
          } catch (err) {
            log.error('Failed to fetch project:', err);
            // Fall back to existing data if fetch fails
            if (!projectToUse) {
              const projectFromList = projects.find((p) => p.id === selectedProjectId);
              projectToUse = {
                id: selectedProjectId,
                name: projectFromList?.name || 'Project',
                context_md: '',
              };
            }
          }
        }

        // Ensure projectToUse is defined (TypeScript guard)
        if (!projectToUse) {
          throw new Error('Project data unavailable');
        }

        const mergeResult = await api.mergeDecisionIntoProject(
          selectedProjectId,
          projectToUse.context_md || '',
          displayText,
          userQuestion || conversationTitle || '',
          {
            saveDecision: true,
            companyId: companyId ?? undefined,
            conversationId: conversationId?.startsWith('temp-')
              ? undefined
              : (conversationId ?? undefined),
            responseIndex,
            decisionTitle: getTitle(),
            departmentId: selectedDeptIds.length > 0 ? selectedDeptIds[0] : null,
            departmentIds: selectedDeptIds,
          }
        );

        if (mergeResult?.merged?.context_md) {
          await api.updateProject(selectedProjectId, {
            context_md: mergeResult.merged.context_md,
          });
        }

        decisionId = mergeResult?.saved_decision_id;
        if (!decisionId) {
          throw new Error(mergeResult?.decision_save_error || 'Decision was not saved');
        }

        if (projectToUse && (!fullProjectData || fullProjectData.id !== selectedProjectId)) {
          setFullProjectData(projectToUse);
        }
      } else {
        log.debug('handleSaveAndPromote - saving without project');
        const saveResult = await api.createCompanyDecision(companyId!, {
          title: getTitle(),
          content: displayText,
          department_ids: selectedDeptIds,
          source_conversation_id: conversationId?.startsWith('temp-')
            ? undefined
            : (conversationId ?? undefined),
          project_id: undefined,
          tags: [],
        });

        decisionId = saveResult?.decision?.id || saveResult?.id;
        if (!decisionId) {
          log.error('No decision ID in response:', saveResult);
          throw new Error('No decision ID returned');
        }
      }

      log.debug('Decision saved with ID:', decisionId);
      setSavedDecisionId(decisionId);

      // Step 2: Promote to playbook
      log.info('Promoting to playbook...', decisionId);
      const promoteResult = await api.promoteDecisionToPlaybook(companyId!, decisionId, {
        doc_type: selectedDocType,
        title: getTitle(),
        department_ids: selectedDeptIds,
      });

      log.debug('Promote result:', promoteResult);
      const playbookId = promoteResult?.playbook?.id || promoteResult?.id;
      setPromotedPlaybookId(playbookId);
      setSaveState('promoted');
    } catch (err) {
      log.error('Failed to save and promote:', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return {
    handleSaveForLater,
    handleSaveAndPromote,
  };
}
