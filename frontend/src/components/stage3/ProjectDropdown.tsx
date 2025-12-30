import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from '../ui/BottomSheet';
import { FolderKanban, ChevronDown, Plus } from 'lucide-react';
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

interface DropdownPosition {
  top: number;
  left: number;
}

interface ProjectDropdownProps {
  currentProject: ProjectWithContext | null;
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  showProjectDropdown: boolean;
  setShowProjectDropdown: (show: boolean) => void;
  dropdownPosition: DropdownPosition;
  setDropdownPosition: (position: DropdownPosition) => void;
  onSelectProject?: ((id: string | null) => void) | undefined;
  onCreateProject?: ((data: { userQuestion: string; councilResponse: string; departmentIds: string[] }) => void) | undefined;
  saveState: SaveState;
  userQuestion: string;
  displayText: string;
  selectedDeptIds: string[];
}

/**
 * ProjectDropdown - Project selection dropdown/bottom sheet
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
  const projectButtonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [, setOpenDirection] = useState<'down' | 'up'>('down');

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
      if (projectButtonRef.current && !projectButtonRef.current.contains(e.target as Node)) {
        const portalDropdown = document.querySelector('.save-project-dropdown-portal');
        if (!portalDropdown || !portalDropdown.contains(e.target as Node)) {
          setShowProjectDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProjectDropdown, setShowProjectDropdown]);

  return (
    <div className="save-project-selector-inline">
      <button
        ref={projectButtonRef}
        className={`save-project-pill ${currentProject ? 'has-project' : ''}`}
        onClick={() => {
          if (!showProjectDropdown && projectButtonRef.current) {
            const rect = projectButtonRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;

            // If not enough space below, open upward
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
        }}
        disabled={saveState === 'saving' || saveState === 'promoting'}
        title={currentProject ? `Linked to: ${currentProject.name}` : 'Link this answer to a project for easy access later'}
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span>{currentProject ? currentProject.name : 'Project'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {/* Mobile: BottomSheet, Desktop: Portal dropdown */}
      {showProjectDropdown && isMobileDevice() ? (
        <BottomSheet
          isOpen={showProjectDropdown}
          onClose={() => setShowProjectDropdown(false)}
          title="Select Project"
        >
          <div className="save-project-list-mobile">
            {/* No project option */}
            <button
              type="button"
              className={`save-project-option-mobile ${!selectedProjectId ? 'selected' : ''}`}
              onClick={() => {
                setSelectedProjectId(null);
                onSelectProject && onSelectProject(null);
                setShowProjectDropdown(false);
              }}
            >
              <span className="save-project-option-name">No Project</span>
              <span className="save-project-option-desc">Save without linking to a project</span>
            </button>
            {/* Active projects */}
            {projects.filter(p => p.status === 'active').map(project => (
              <button
                type="button"
                key={project.id}
                className={`save-project-option-mobile ${selectedProjectId === project.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  onSelectProject && onSelectProject(project.id);
                  setShowProjectDropdown(false);
                }}
              >
                <span className="save-project-option-name">{project.name}</span>
                {project.description && (
                  <span className="save-project-option-desc">{project.description}</span>
                )}
              </button>
            ))}
            {/* Create new project */}
            {onCreateProject && (
              <button
                type="button"
                className="save-project-create-btn-mobile"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowProjectDropdown(false);
                  setTimeout(() => {
                    onCreateProject({
                      userQuestion,
                      councilResponse: displayText,
                      departmentIds: selectedDeptIds
                    });
                  }, 250);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
              >
                <Plus className="h-4 w-4" />
                <span>Create New Project</span>
              </button>
            )}
          </div>
        </BottomSheet>
      ) : showProjectDropdown && createPortal(
        <div
          className="save-project-dropdown-portal"
          style={{
            top: Math.max(8, dropdownPosition.top),
            left: dropdownPosition.left,
          }}
        >
          <div className="save-project-dropdown-header">Select Project</div>
          <div
            ref={listRef}
            className="save-project-list"
          >
            {/* No project option */}
            <button
              className={`save-project-option ${!selectedProjectId ? 'selected' : ''}`}
              onClick={() => {
                setSelectedProjectId(null);
                onSelectProject && onSelectProject(null);
                setShowProjectDropdown(false);
              }}
            >
              <span className="save-project-option-name">No Project</span>
              <span className="save-project-option-desc">Save without linking to a project</span>
            </button>
            {/* Active projects */}
            {projects.filter(p => p.status === 'active').map(project => (
              <button
                key={project.id}
                className={`save-project-option ${selectedProjectId === project.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  onSelectProject && onSelectProject(project.id);
                  setShowProjectDropdown(false);
                }}
                title={project.description ? `${project.name}\n${project.description}` : project.name}
              >
                <span className="save-project-option-name">{project.name}</span>
                {project.description && (
                  <span className="save-project-option-desc">{project.description}</span>
                )}
              </button>
            ))}
          </div>
          {/* Create new project - ALWAYS visible at bottom */}
          <div className="save-project-create">
            <button
              className="save-project-create-btn"
              onClick={() => {
                setShowProjectDropdown(false);
                if (onCreateProject) {
                  onCreateProject({
                    userQuestion,
                    councilResponse: displayText,
                    departmentIds: selectedDeptIds
                  });
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Project</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
