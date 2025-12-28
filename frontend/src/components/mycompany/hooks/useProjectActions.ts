import { useState, useCallback } from 'react';
import { api } from '../../../api';
import { logger } from '../../../utils/logger';
import { toast } from '../../ui/sonner';
import type { Project } from '../../../types';

const log = logger.scope('useProjectActions');

interface UseProjectActionsOptions {
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  loadData: () => Promise<void>;
}

/**
 * Hook for managing project actions (complete, archive, restore, delete)
 * Handles fade animations and optimistic updates
 */
export function useProjectActions({ setProjects, loadData }: UseProjectActionsOptions) {
  const [fadingProjectId, setFadingProjectId] = useState<string | null>(null);
  const [confirmingDeleteProjectId, setConfirmingDeleteProjectId] = useState<string | null>(null);

  // Handle complete project with fade animation
  const handleCompleteProject = useCallback(async (project: Project, e?: React.MouseEvent): Promise<void> => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'completed' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'completed' } : p
        ));
        toast.success(`"${project.name}" marked as complete`, { duration: 3000 });
      } catch (err) {
        log.error('Failed to complete project', { error: err });
        toast.error('Failed to complete project');
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  }, [setProjects]);

  // Handle archive project with fade animation
  const handleArchiveProject = useCallback(async (project: Project, e?: React.MouseEvent): Promise<void> => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'archived' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'archived' } : p
        ));
        toast.success(`"${project.name}" archived`, { duration: 3000 });
      } catch (err) {
        log.error('Failed to archive project', { error: err });
        toast.error('Failed to archive project');
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  }, [setProjects]);

  // Handle restore project with fade animation
  const handleRestoreProject = useCallback(async (project: Project, e?: React.MouseEvent): Promise<void> => {
    e?.stopPropagation();
    setFadingProjectId(project.id);
    setTimeout(async () => {
      try {
        await api.updateProject(project.id, { status: 'active' });
        // Update local state - no full reload, no spinner
        setProjects(prev => prev.map(p =>
          p.id === project.id ? { ...p, status: 'active' } : p
        ));
        toast.success(`"${project.name}" restored to active`, { duration: 3000 });
      } catch (err) {
        log.error('Failed to restore project', { error: err });
        toast.error('Failed to restore project');
      } finally {
        setFadingProjectId(null);
      }
    }, 300);
  }, [setProjects]);

  // Handle delete project - first click shows confirm, second click deletes
  const handleDeleteProject = useCallback((project: Project, e?: React.MouseEvent): void => {
    e?.stopPropagation();
    if (confirmingDeleteProjectId === project.id) {
      // Second click - actually delete with fade
      const projectName = project.name;
      setConfirmingDeleteProjectId(null);
      setFadingProjectId(project.id);
      setTimeout(async () => {
        try {
          await api.deleteProject(project.id);
          // Remove from local state - no full reload, no spinner
          setProjects(prev => prev.filter(p => p.id !== project.id));
          toast.success(`"${projectName}" deleted`, { duration: 3000 });
        } catch (err) {
          log.error('Failed to delete project', { error: err });
          toast.error('Failed to delete project');
        } finally {
          setFadingProjectId(null);
        }
      }, 300);
    } else {
      // First click - show "Are you sure?"
      setConfirmingDeleteProjectId(project.id);
    }
  }, [confirmingDeleteProjectId, setProjects]);

  // Handle update project (returns updated data so modal can refresh)
  const handleUpdateProject = useCallback(async (projectId: string, updates: Partial<Project>): Promise<Project> => {
    try {
      const result = await api.updateProject(projectId, updates);
      await loadData();
      // Return the updated project so modal can refresh state without closing
      return result.project || result;
    } catch (err) {
      log.error('Failed to update project', { error: err });
      throw err;
    }
  }, [loadData]);

  return {
    // State
    fadingProjectId,
    confirmingDeleteProjectId,
    setConfirmingDeleteProjectId,

    // Actions
    handleCompleteProject,
    handleArchiveProject,
    handleRestoreProject,
    handleDeleteProject,
    handleUpdateProject,
  };
}
