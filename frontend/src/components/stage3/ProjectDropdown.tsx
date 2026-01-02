import { useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { BottomSheet } from '../ui/BottomSheet';
import { FolderKanban, ChevronDown, Plus, FolderX } from 'lucide-react';
import type { Project } from '../../types/business';
import '../Stage3.css';

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

// Check if we're on mobile/tablet
const isMobileDevice = () => window.innerWidth <= 768;

type SaveState = 'idle' | 'saving' | 'promoting' | 'saved' | 'promoted' | 'error';

interface ProjectDropdownProps {
  currentProject: ProjectWithContext | null;
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  showProjectDropdown: boolean;
  setShowProjectDropdown: (show: boolean) => void;
  onSelectProject?: ((id: string | null) => void) | undefined;
  onCreateProject?:
    | ((data: { userQuestion: string; councilResponse: string; departmentIds: string[] }) => void)
    | undefined;
  saveState: SaveState;
  userQuestion: string;
  displayText: string;
  selectedDeptIds: string[];
}

/**
 * ProjectDropdown - Project selection dropdown/bottom sheet
 * Uses Radix UI Popover for consistent positioning with other toolbar dropdowns
 */
export function ProjectDropdown({
  currentProject,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  showProjectDropdown,
  setShowProjectDropdown,
  onSelectProject,
  onCreateProject,
  saveState,
  userQuestion,
  displayText,
  selectedDeptIds,
}: ProjectDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const isDisabled = saveState === 'saving' || saveState === 'promoting';
  const activeProjects = projects.filter((p) => p.status === 'active');

  const handleSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    onSelectProject?.(projectId);
    setShowProjectDropdown(false);
  };

  const handleCreate = () => {
    setShowProjectDropdown(false);
    if (onCreateProject) {
      // Small delay to let dropdown close animation finish
      setTimeout(() => {
        onCreateProject({
          userQuestion,
          councilResponse: displayText,
          departmentIds: selectedDeptIds,
        });
      }, 100);
    }
  };

  const triggerContent = (
    <>
      <FolderKanban className="h-3.5 w-3.5" />
      <span>{currentProject ? currentProject.name : 'Project'}</span>
      <ChevronDown className="h-3 w-3" />
    </>
  );

  const dropdownContent = (
    <>
      <div className="toolbar-dropdown-header">Select Project</div>
      <div ref={listRef} className="toolbar-dropdown-list">
        {/* No project option */}
        <button
          className={`toolbar-dropdown-option ${!selectedProjectId ? 'selected' : ''}`}
          onClick={() => handleSelect(null)}
        >
          <FolderX className="h-4 w-4" />
          <div className="toolbar-dropdown-option-text">
            <span className="toolbar-dropdown-option-name">No Project</span>
            <span className="toolbar-dropdown-option-desc">Save without linking to a project</span>
          </div>
        </button>

        {/* Active projects */}
        {activeProjects.map((project) => (
          <button
            key={project.id}
            className={`toolbar-dropdown-option project-option ${selectedProjectId === project.id ? 'selected' : ''}`}
            onClick={() => handleSelect(project.id)}
            title={project.description ? `${project.name}\n${project.description}` : project.name}
          >
            <FolderKanban className="h-4 w-4" />
            <div className="toolbar-dropdown-option-text">
              <span className="toolbar-dropdown-option-name">{project.name}</span>
              {project.description && (
                <span className="toolbar-dropdown-option-desc">{project.description}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Create new project - always visible at bottom */}
      {onCreateProject && (
        <div className="toolbar-dropdown-footer">
          <button className="toolbar-dropdown-create-btn" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Project</span>
          </button>
        </div>
      )}
    </>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <div className="save-project-selector-inline">
        <button
          className={`toolbar-pill save-project-pill ${currentProject ? 'has-project' : ''}`}
          onClick={() => !isDisabled && setShowProjectDropdown(true)}
          disabled={isDisabled}
          title={
            currentProject
              ? `Linked to: ${currentProject.name}`
              : 'Link this answer to a project for easy access later'
          }
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={showProjectDropdown}
          onClose={() => setShowProjectDropdown(false)}
          title="Select Project"
        >
          <div className="toolbar-list-mobile">
            {/* No project option */}
            <button
              type="button"
              className={`toolbar-option-mobile ${!selectedProjectId ? 'selected' : ''}`}
              onClick={() => handleSelect(null)}
            >
              <div className="toolbar-option-icon">
                <FolderX className="h-5 w-5" />
              </div>
              <div className="toolbar-option-content">
                <span className="toolbar-option-name">No Project</span>
                <span className="toolbar-option-desc">Save without linking to a project</span>
              </div>
            </button>

            {/* Active projects */}
            {activeProjects.map((project) => (
              <button
                type="button"
                key={project.id}
                className={`toolbar-option-mobile project-option ${selectedProjectId === project.id ? 'selected' : ''}`}
                onClick={() => handleSelect(project.id)}
              >
                <div className="toolbar-option-icon">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div className="toolbar-option-content">
                  <span className="toolbar-option-name">{project.name}</span>
                  {project.description && (
                    <span className="toolbar-option-desc">{project.description}</span>
                  )}
                </div>
              </button>
            ))}

            {/* Create new project */}
            {onCreateProject && (
              <button type="button" className="toolbar-create-btn-mobile" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                <span>Create New Project</span>
              </button>
            )}
          </div>
        </BottomSheet>
      </div>
    );
  }

  // Desktop: use Radix Popover for consistent positioning
  return (
    <div className="save-project-selector-inline">
      <Popover.Root open={showProjectDropdown} onOpenChange={setShowProjectDropdown}>
        <Popover.Trigger
          className={`toolbar-pill save-project-pill ${currentProject ? 'has-project' : ''}`}
          disabled={isDisabled}
          title={
            currentProject
              ? `Linked to: ${currentProject.name}`
              : 'Link this answer to a project for easy access later'
          }
        >
          {triggerContent}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="toolbar-dropdown-portal project"
            align="start"
            sideOffset={4}
            collisionPadding={8}
          >
            {dropdownContent}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
