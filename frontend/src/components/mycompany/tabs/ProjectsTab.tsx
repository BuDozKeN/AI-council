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

import { useMemo } from 'react';
import { FolderKanban, CheckCircle, Archive, RotateCcw, Trash2, Plus } from 'lucide-react';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { SortSelect } from '../../ui/SortSelect';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { formatRelativeDate } from '../../../lib/dateUtils';
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
  return formatRelativeDate(date);
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
  // Memoized stats - only recalculate when projects change
  // Must be before any early returns to satisfy React hooks rules
  const stats = useMemo(() => ({
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    archived: projects.filter(p => p.status === 'archived').length,
    totalDecisions: projects.reduce((sum, p) => sum + (p.decision_count || 0), 0)
  }), [projects]);

  // Memoized filtering and sorting
  const sortedProjects = useMemo(() => {
    // Filter by status
    let filtered = projects;
    if (projectStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === projectStatusFilter);
    }

    // Filter by department (multi-select)
    if (projectDeptFilter.length > 0) {
      filtered = filtered.filter(p =>
        (p.department_ids || []).some(id => projectDeptFilter.includes(id))
      );
    }

    // Sort projects
    return [...filtered].sort((a, b) => {
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
  }, [projects, projectStatusFilter, projectDeptFilter, projectSortBy]);

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

  // Project row component
  const renderProjectRow = (project) => {
    const deptIds = project.department_ids || [];
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
          className={`mc-stat-card clickable ${projectStatusFilter === 'active' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'active' ? 'all' : 'active')}
        >
          <div className="mc-stat-value active">{stats.active}</div>
          <div className="mc-stat-label">Active</div>
        </div>
        <div
          className={`mc-stat-card clickable ${projectStatusFilter === 'completed' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'completed' ? 'all' : 'completed')}
        >
          <div className="mc-stat-value completed">{stats.completed}</div>
          <div className="mc-stat-label">Completed</div>
        </div>
        <div
          className={`mc-stat-card clickable ${projectStatusFilter === 'archived' ? 'selected' : ''}`}
          onClick={() => onStatusFilterChange && onStatusFilterChange(projectStatusFilter === 'archived' ? 'all' : 'archived')}
        >
          <div className="mc-stat-value archived">{stats.archived}</div>
          <div className="mc-stat-label">Archived</div>
        </div>
        <div className="mc-stat-card">
          <div className="mc-stat-value decisions">{stats.totalDecisions}</div>
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
          <Plus size={14} className="mc-btn-icon" />
          New Project
        </button>
      </div>

      {/* Projects list with scroll-to-top */}
      <ScrollableContent className="mc-projects-list">
        {sortedProjects.length === 0 ? (
          <div className="mc-empty-filtered">
            No projects match your filters
          </div>
        ) : (
          sortedProjects.map(renderProjectRow)
        )}
      </ScrollableContent>

      {/* FAB - Mobile only (visible via CSS) */}
      <button
        className="mc-fab"
        onClick={onAddProject}
        aria-label="Create new project"
      >
        <Plus />
      </button>
    </div>
  );
}
