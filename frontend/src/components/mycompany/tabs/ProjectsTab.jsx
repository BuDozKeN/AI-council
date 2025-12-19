/**
 * ProjectsTab - Projects management with status tracking
 *
 * Shows:
 * - Stats grid with clickable status filters
 * - Department and sort filters
 * - Project list with status actions (complete, archive, restore, delete)
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { FolderKanban, CheckCircle, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { SortSelect } from '../../ui/SortSelect';
import { getDeptColor } from '../../../lib/colors';

// Format relative time for project timestamps
function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ProjectsTab({
  projects = [],
  departments = [],
  projectsLoaded = false,
  loading = false,
  // Filter state
  projectStatusFilter = 'active',
  projectDeptFilter = [],
  projectSortBy = 'updated',
  // Inline confirmation state
  fadingProjectId = null,
  confirmingDeleteProjectId = null,
  // Filter setters
  onStatusFilterChange,
  onDeptFilterChange,
  onSortByChange,
  onConfirmingDeleteChange,
  // Actions
  onAddProject,
  onProjectClick,
  onCompleteProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject
}) {
  // Show nothing during initial load (skeleton handled by parent)
  if (!projectsLoaded && !loading) {
    return null;
  }

  if (projects.length === 0) {
    return (
      <div className="mc-empty">
        <FolderKanban size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">No projects yet</p>
        <p className="mc-empty-hint">
          Create projects to organize council sessions and track decisions.
          Projects help you maintain context across related queries.
        </p>
      </div>
    );
  }

  // Calculate stats from ALL projects (for display in stat cards)
  const allActiveProjects = projects.filter(p => p.status === 'active');
  const allCompletedProjects = projects.filter(p => p.status === 'completed');
  const allArchivedProjects = projects.filter(p => p.status === 'archived');
  const totalDecisions = projects.reduce((sum, p) => sum + (p.decision_count || 0), 0);

  // Client-side filtering
  let filteredProjects = projects;

  // Filter by status
  if (projectStatusFilter !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.status === projectStatusFilter);
  }

  // Filter by department (multi-select)
  if (projectDeptFilter.length > 0) {
    filteredProjects = filteredProjects.filter(p =>
      projectDeptFilter.includes(p.department_id) ||
      p.department_ids?.some(id => projectDeptFilter.includes(id))
    );
  }

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (projectSortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'created':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'decisions':
        return (b.decision_count || 0) - (a.decision_count || 0);
      case 'updated':
      default:
        return new Date(b.last_accessed_at || b.updated_at || b.created_at) -
               new Date(a.last_accessed_at || a.updated_at || a.created_at);
    }
  });

  // Project row component
  const renderProjectRow = (project) => {
    const deptIds = project.department_ids?.length > 0
      ? project.department_ids
      : project.department_id ? [project.department_id] : [];
    const deptNames = project.department_names || [];
    const isFading = fadingProjectId === project.id;

    return (
      <div
        key={project.id}
        className={`mc-project-row-compact ${isFading ? 'fading' : ''}`}
        onClick={() => !isFading && onProjectClick && onProjectClick(project)}
      >
        {/* Status indicator dot */}
        <div className={`mc-status-dot ${project.status}`} />

        {/* Title group: name + ALL department badges */}
        <div className="mc-project-title-group">
          <span className="mc-project-name">{project.name}</span>
          {deptIds.map((deptId, idx) => {
            const deptName = deptNames[idx] || departments.find(d => d.id === deptId)?.name;
            if (!deptName) return null;
            return (
              <span
                key={deptId}
                className="mc-project-dept-badge"
                style={{
                  background: getDeptColor(deptId).bg,
                  color: getDeptColor(deptId).text,
                }}
              >
                {deptName}
              </span>
            );
          })}
        </div>

        {/* Meta: decision count + time - hidden on hover when actions show */}
        <div className="mc-project-meta">
          <span className="mc-project-decision-count">
            {project.decision_count || 0}
          </span>
          <span className="mc-project-time">
            {formatRelativeTime(project.last_accessed_at || project.updated_at)}
          </span>
        </div>

        {/* Actions - visible on hover */}
        <div className="mc-project-actions">
          {project.status === 'active' && (
            <button
              className="mc-project-action complete"
              onClick={(e) => onCompleteProject && onCompleteProject(project, e)}
              title="Mark as completed"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Complete</span>
            </button>
          )}
          {project.status === 'archived' ? (
            <button
              className="mc-project-action restore"
              onClick={(e) => onRestoreProject && onRestoreProject(project, e)}
              title="Restore project"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore</span>
            </button>
          ) : (
            <button
              className="mc-project-action archive"
              onClick={(e) => onArchiveProject && onArchiveProject(project, e)}
              title="Archive project"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive</span>
            </button>
          )}
          {confirmingDeleteProjectId === project.id ? (
            <>
              <button
                className="mc-project-action confirm-yes"
                onClick={(e) => onDeleteProject && onDeleteProject(project, e)}
                title="Confirm delete"
              >
                <span>Yes</span>
              </button>
              <button
                className="mc-project-action confirm-no"
                onClick={(e) => { e.stopPropagation(); onConfirmingDeleteChange && onConfirmingDeleteChange(null); }}
                title="Cancel"
              >
                <span>No</span>
              </button>
            </>
          ) : (
            <button
              className="mc-project-action delete"
              onClick={(e) => onDeleteProject && onDeleteProject(project, e)}
              title="Delete project"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mc-projects">
      {/* Stats grid - same style as Overview tab */}
      <div className="mc-stats-grid">
        <div
          className={`mc-stat-card ${projectStatusFilter === 'active' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'active' ? 'all' : 'active')}
          style={{ cursor: 'pointer' }}
        >
          <div className="mc-stat-value" style={{ color: '#1d4ed8' }}>{allActiveProjects.length}</div>
          <div className="mc-stat-label">Active</div>
        </div>
        <div
          className={`mc-stat-card ${projectStatusFilter === 'completed' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'completed' ? 'all' : 'completed')}
          style={{ cursor: 'pointer' }}
        >
          <div className="mc-stat-value" style={{ color: '#15803d' }}>{allCompletedProjects.length}</div>
          <div className="mc-stat-label">Completed</div>
        </div>
        <div
          className={`mc-stat-card ${projectStatusFilter === 'archived' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'archived' ? 'all' : 'archived')}
          style={{ cursor: 'pointer' }}
        >
          <div className="mc-stat-value" style={{ color: '#6b7280' }}>{allArchivedProjects.length}</div>
          <div className="mc-stat-label">Archived</div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value" style={{ color: '#b45309' }}>{totalDecisions}</div>
          <div className="mc-stat-label">Decisions</div>
        </div>
      </div>

      {/* Filters row - multi-department and sort */}
      <div className="mc-projects-filters">
        <div className="mc-filters-left">
          <MultiDepartmentSelect
            value={projectDeptFilter}
            onValueChange={onDeptFilterChange}
            departments={departments}
            placeholder="All Depts"
          />
          <SortSelect
            value={projectSortBy}
            onValueChange={onSortByChange}
          />
        </div>
        <button
          className="mc-btn-clean primary"
          onClick={onAddProject}
        >
          <svg style={{ width: '14px', height: '14px', marginRight: '4px' }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Project
        </button>
      </div>

      {/* Projects list */}
      <div className="mc-projects-list">
        {sortedProjects.length === 0 ? (
          <div className="mc-empty-filtered">
            No projects match your filters
          </div>
        ) : (
          sortedProjects.map(renderProjectRow)
        )}
      </div>
    </div>
  );
}
