import { useState } from 'react';
import { MultiDepartmentSelect } from '../ui/MultiDepartmentSelect';
import { Spinner } from '../ui/Spinner';
import { ProjectDropdown } from './ProjectDropdown';
import { PlaybookDropdown } from './PlaybookDropdown';
import { Bookmark } from 'lucide-react';
import type { Department, Project } from '../../types/business';

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

type SaveState = 'idle' | 'saving' | 'promoting' | 'saved' | 'promoted' | 'error';

interface Stage3ActionsProps {
  companyId?: string | undefined;
  departments: Department[];
  selectedDeptIds: string[];
  setSelectedDeptIds: (ids: string[]) => void;
  selectedDocType: string;
  setSelectedDocType: (type: string) => void;
  currentProject: ProjectWithContext | null;
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  onSelectProject?: ((id: string | null) => void) | undefined;
  onCreateProject?:
    | ((data: { userQuestion: string; councilResponse: string; departmentIds: string[] }) => void)
    | undefined;
  saveState: SaveState;
  savedDecisionId: string | null;
  promotedPlaybookId: string | null;
  handleSaveForLater: () => void;
  handleSaveAndPromote: () => void;
  handleViewDecision: (
    decisionId: string,
    targetType?: string | undefined,
    targetId?: string | undefined
  ) => void;
  checkDecisionStatus: (force?: boolean | undefined) => Promise<void>;
  userQuestion: string;
  displayText: string;
}

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
  displayText,
}: Stage3ActionsProps) {
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  return (
    <div className="stage3-actions">
      {/* Error state */}
      {saveState === 'error' && (
        <div className="save-error-bar">
          <span>⚠️</span>
          <span>Couldn't save that. Let's try again.</span>
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
            onSelectProject={onSelectProject}
            onCreateProject={onCreateProject}
            saveState={saveState}
            userQuestion={userQuestion}
            displayText={displayText}
            selectedDeptIds={selectedDeptIds}
          />

          <div className="save-divider" />

          {/* Playbook type dropdown */}
          <PlaybookDropdown
            selectedDocType={selectedDocType}
            setSelectedDocType={setSelectedDocType}
            saveState={saveState}
          />
        </div>

        {/* Save/Access button */}
        {saveState === 'saved' || saveState === 'promoted' ? (
          <div className="save-status-group">
            <span className="save-status-text">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
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
              {promotedPlaybookId
                ? 'View Playbook'
                : currentProject
                  ? 'View in Project'
                  : 'View Decision'}
            </button>
          </div>
        ) : (
          <button
            className={`save-action-btn ${saveState === 'saving' || saveState === 'promoting' ? 'loading' : ''}`}
            onClick={selectedDocType ? handleSaveAndPromote : handleSaveForLater}
            disabled={saveState === 'saving' || saveState === 'promoting'}
            title={
              currentProject
                ? 'Save this answer and add it to your project'
                : selectedDocType
                  ? `Save as ${selectedDocType.toUpperCase()} to your knowledge base`
                  : 'Save this answer to access it later from My Company'
            }
          >
            {saveState === 'saving' || saveState === 'promoting' ? (
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
