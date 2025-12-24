import { useState } from 'react';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { Spinner } from '../ui/Spinner';
import { ProjectDropdown } from './ProjectDropdown';
import { Bookmark, FileText, Layers, ScrollText } from 'lucide-react';

// Playbook type definitions with icons
const DOC_TYPES = [
  { value: 'sop', label: 'SOP', icon: ScrollText, description: 'Standard Operating Procedure - step-by-step instructions' },
  { value: 'framework', label: 'Framework', icon: Layers, description: 'Framework - guidelines and best practices' },
  { value: 'policy', label: 'Policy', icon: FileText, description: 'Policy - rules and requirements' }
];

/**
 * Stage3Actions - Save toolbar with departments, projects, doc types, and save button
 */
export function Stage3Actions({
  companyId: _companyId,
  departments,
  selectedDeptIds,
  setSelectedDeptIds,
  selectedDocType,
  setSelectedDocType,
  currentProject,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  onSelectProject,
  onCreateProject,
  saveState,
  savedDecisionId,
  promotedPlaybookId,
  handleSaveForLater,
  handleSaveAndPromote,
  handleViewDecision,
  checkDecisionStatus,
  userQuestion,
  displayText
}) {
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  return (
    <div className="stage3-actions">
      {/* Error state */}
      {saveState === 'error' && (
        <div className="save-error-bar">
          <span>⚠️</span>
          <span>Failed to save. Please try again.</span>
        </div>
      )}

      {/* Save toolbar */}
      <div className="save-toolbar-unified">
        {/* Left group: Department + Project + Type */}
        <div className="save-options-group">
          {/* Multi-department selector */}
          <MultiDepartmentSelect
            value={selectedDeptIds}
            onValueChange={setSelectedDeptIds}
            departments={departments}
            disabled={saveState !== 'idle'}
            placeholder="Departments"
            className="save-dept-trigger"
            title="Tag this answer with relevant departments"
          />

          <div className="save-divider" />

          {/* Project selector */}
          <ProjectDropdown
            currentProject={currentProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            showProjectDropdown={showProjectDropdown}
            setShowProjectDropdown={setShowProjectDropdown}
            dropdownPosition={dropdownPosition}
            setDropdownPosition={setDropdownPosition}
            onSelectProject={onSelectProject}
            onCreateProject={onCreateProject}
            saveState={saveState}
            userQuestion={userQuestion}
            displayText={displayText}
            selectedDeptIds={selectedDeptIds}
          />

          <div className="save-divider" />

          {/* Type selector pills */}
          <div className="save-type-pills" title="Optionally classify as a document type">
            {DOC_TYPES.map(type => {
              const Icon = type.icon;
              const isSaved = saveState === 'saved' || saveState === 'promoted';
              const isSelected = selectedDocType === type.value;
              return (
                <button
                  key={type.value}
                  className={`save-type-pill ${type.value} ${isSelected ? 'selected' : ''} ${isSaved && isSelected ? 'saved' : ''}`}
                  onClick={() => !isSaved && setSelectedDocType(isSelected ? '' : type.value)}
                  disabled={saveState === 'saving' || saveState === 'promoting'}
                  title={isSaved && isSelected ? `Saved as ${type.label}` : type.description}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save/Access button */}
        {(saveState === 'saved' || saveState === 'promoted') ? (
          <div className="save-status-group">
            <span className="save-status-text">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Decision saved
            </span>
            <button
              className="save-view-link"
              onClick={async () => {
                await checkDecisionStatus(true);
                if (!savedDecisionId) return;

                if (promotedPlaybookId) {
                  handleViewDecision(savedDecisionId, 'playbook', promotedPlaybookId);
                } else if (currentProject) {
                  handleViewDecision(savedDecisionId, 'project', currentProject.id);
                } else {
                  handleViewDecision(savedDecisionId);
                }
              }}
            >
              {promotedPlaybookId ? 'View Playbook' : currentProject ? 'View in Project' : 'View Decision'}
            </button>
          </div>
        ) : (
          <button
            className={`save-action-btn ${saveState === 'saving' || saveState === 'promoting' ? 'loading' : ''}`}
            onClick={selectedDocType ? handleSaveAndPromote : handleSaveForLater}
            disabled={saveState === 'saving' || saveState === 'promoting'}
            title={currentProject
              ? 'Save this answer and add it to your project'
              : selectedDocType
                ? `Save as ${DOC_TYPES.find(t => t.value === selectedDocType)?.label} to your knowledge base`
                : 'Save this answer to access it later from My Company'}
          >
            {(saveState === 'saving' || saveState === 'promoting') ? (
              <>
                <Spinner size="sm" variant="muted" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>{currentProject ? `Save to ${currentProject.name}` : 'Save Answer'}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
