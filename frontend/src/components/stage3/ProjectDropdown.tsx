import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from '../ui/BottomSheet';
import { FolderKanban, ChevronDown, Plus } from 'lucide-react';

// Check if we're on mobile/tablet
const isMobileDevice = () => window.innerWidth <= 768;

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
}) {
  const projectButtonRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showProjectDropdown) return;

    const handleClickOutside = (e) => {
      if (projectButtonRef.current && !projectButtonRef.current.contains(e.target)) {
        const portalDropdown = document.querySelector('.save-project-dropdown-portal');
        if (!portalDropdown || !portalDropdown.contains(e.target)) {
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
            setDropdownPosition({
              top: rect.bottom + 4,
              left: rect.left
            });
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
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999,
            minWidth: '260px',
            maxWidth: '320px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
          }}
        >
          <div className="save-project-dropdown-header">Select Project</div>
          <div className="save-project-list">
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
              >
                <span className="save-project-option-name">{project.name}</span>
                {project.description && (
                  <span className="save-project-option-desc">{project.description}</span>
                )}
              </button>
            ))}
          </div>
          {/* Create new project */}
          {onCreateProject && (
            <div className="save-project-create">
              <button
                className="save-project-create-btn"
                onClick={() => {
                  setShowProjectDropdown(false);
                  onCreateProject({
                    userQuestion,
                    councilResponse: displayText,
                    departmentIds: selectedDeptIds
                  });
                }}
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
