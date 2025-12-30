import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

// Dropdown height estimate (header + items + create button)
const DROPDOWN_HEIGHT = 450;

type SaveState = 'idle' | 'saving' | 'promoting' | 'saved' | 'promoted' | 'error';

interface ProjectDropdownProps {
  currentProject: ProjectWithContext | null;
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  showProjectDropdown: boolean;
  setShowProjectDropdown: (show: boolean) => void;
  dropdownPosition: { top: number; left: number };
  setDropdownPosition: (position: { top: number; left: number }) => void;
  onSelectProject?: ((id: string | null) => void) | undefined;
  onCreateProject?: ((data: { userQuestion: string; councilResponse: string; departmentIds: string[] }) => void) | undefined;
  saveState: SaveState;
  userQuestion: string;
  displayText: string;
  selectedDeptIds: string[];
}

/**
 * ProjectDropdown - Project selection dropdown/bottom sheet
 * Uses unified toolbar dropdown system for consistency
 */
export function ProjectDropdown({
  currentProject,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  showProjectDropdown,
  setShowProjectDropdown,
  dropdownPosition,
  setDropdownPosition,
  onSelectProject,
  onCreateProject,
  saveState,
  userQuestion,
  displayText,
  selectedDeptIds
}: ProjectDropdownProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, setOpenDirection] = useState<'down' | 'up'>('down');

  const isDisabled = saveState === 'saving' || saveState === 'promoting';
  const activeProjects = projects.filter(p => p.status === 'active');

  // Reset scroll position when dropdown opens
  useEffect(() => {
    if (showProjectDropdown && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [showProjectDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showProjectDropdown) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const portalDropdown = document.querySelector('.toolbar-dropdown-portal.project');
        if (!portalDropdown || !portalDropdown.contains(e.target as Node)) {
          setShowProjectDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown, setShowProjectDropdown]);

  const openDropdown = () => {
    if (isDisabled) return;

    if (!showProjectDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow) {
        setOpenDirection('up');
        setDropdownPosition({
          top: rect.top - DROPDOWN_HEIGHT - 4,
          left: rect.left
        });
      } else {
        setOpenDirection('down');
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left
        });
      }
    }
    setShowProjectDropdown(!showProjectDropdown);
  };

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
          departmentIds: selectedDeptIds
        });
      }, 100);
    }
  };

  return (
    <div className="save-project-selector-inline">
      <button
        ref={buttonRef}
        className={`toolbar-pill save-project-pill ${currentProject ? 'has-project' : ''}`}
        onClick={openDropdown}
        disabled={isDisabled}
        title={currentProject ? `Linked to: ${currentProject.name}` : 'Link this answer to a project for easy access later'}
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span>{currentProject ? currentProject.name : 'Project'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {/* Mobile: BottomSheet */}
      {showProjectDropdown && isMobileDevice() ? (
        <BottomSheet
          isOpen={showProjectDropdown}
          onClose={() => setShowProjectDropdown(false)}
          title="Select Project"
        >
          <div className="toolbar-list-mobile">
            {/* No project option - uses neutral styling, not project-option violet */}
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
            {activeProjects.map(project => (
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
              <button
                type="button"
                className="toolbar-create-btn-mobile"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                <span>Create New Project</span>
              </button>
            )}
          </div>
        </BottomSheet>
      ) : showProjectDropdown && createPortal(
        <div
          className="toolbar-dropdown-portal project"
          style={{
            top: Math.max(8, dropdownPosition.top),
            left: dropdownPosition.left,
          }}
        >
          <div className="toolbar-dropdown-header">Select Project</div>
          <div ref={listRef} className="toolbar-dropdown-list">
            {/* No project option - uses neutral styling, not project-option violet */}
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
            {activeProjects.map(project => (
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
              <button
                className="toolbar-dropdown-create-btn"
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Project</span>
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
