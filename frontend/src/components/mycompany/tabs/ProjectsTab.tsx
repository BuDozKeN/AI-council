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
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { SortSelect } from '../../ui/SortSelect';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { Skeleton } from '../../ui/Skeleton';
import { formatRelativeDate } from '../../../lib/dateUtils';
import { getDeptColor } from '../../../lib/colors';
import type { Department, Project } from '../../../types/business';

type ProjectStatusFilter = 'all' | 'active' | 'completed' | 'archived';
type ProjectSortBy = 'updated' | 'name' | 'created' | 'decisions';

interface ExtendedProject extends Project {
  decision_count?: number;
  department_names?: string[];
  last_accessed_at?: string;
}

interface ProjectsTabProps {
  projects?: ExtendedProject[];
  departments?: Department[];
  projectsLoaded?: boolean;
  loading?: boolean;
  projectStatusFilter?: ProjectStatusFilter;
  projectDeptFilter?: string[];
  projectSortBy?: ProjectSortBy;
  fadingProjectId?: string | null;
  confirmingDeleteProjectId?: string | null;
  onStatusFilterChange?: (filter: ProjectStatusFilter) => void;
  onDeptFilterChange?: (ids: string[]) => void;
  onSortByChange?: (sortBy: ProjectSortBy) => void;
  onConfirmingDeleteChange?: (id: string | null) => void;
  onAddProject?: () => void;
  onProjectClick?: (project: ExtendedProject) => void;
  onCompleteProject?: (project: ExtendedProject, e: React.MouseEvent) => void;
  onArchiveProject?: (project: ExtendedProject, e: React.MouseEvent) => void;
  onRestoreProject?: (project: ExtendedProject, e: React.MouseEvent) => void;
  onDeleteProject?: (project: ExtendedProject, e: React.MouseEvent) => void;
}

// Format relative time for project timestamps
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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
}: ProjectsTabProps) {
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
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'decisions':
          return (b.decision_count || 0) - (a.decision_count || 0);
        case 'updated':
        default:
          return new Date(b.last_accessed_at || b.updated_at || b.created_at).getTime() -
                 new Date(a.last_accessed_at || a.updated_at || a.created_at).getTime();
      }
    });
  }, [projects, projectStatusFilter, projectDeptFilter, projectSortBy]);

  // Show skeleton during initial load
  if (!projectsLoaded || loading) {
    return (
      <div className="mc-projects">
        {/* Stats skeleton */}
        <div className="mc-stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="mc-stat-card">
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        {/* Filters skeleton */}
        <div className="mc-projects-filters">
          <div className="mc-filters-left">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        {/* Project rows skeleton */}
        <div className="mc-projects-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="mc-project-row-compact" style={{ pointerEvents: 'none' }}>
              <Skeleton variant="circular" className="h-2.5 w-2.5" />
              <div className="mc-project-title-group">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="mc-project-meta">
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mc-empty">
        <FolderKanban size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">Start your first project</p>
        <p className="mc-empty-hint">
          Projects help you organize related decisions and give your council persistent context across sessions.
        </p>
      </div>
    );
  }

  // Project row component
  const renderProjectRow = (project: ExtendedProject) => {
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
          {deptIds.map((deptId: string, idx: number) => {
            const deptName = deptNames[idx] || departments.find((d: Department) => d.id === deptId)?.name;
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
            onValueChange={onDeptFilterChange ?? (() => {})}
            departments={departments}
            placeholder="All Depts"
          />
          <SortSelect
            value={projectSortBy}
            onValueChange={(value: string) => onSortByChange?.(value as ProjectSortBy)}
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={onAddProject}
        >
          New Project
        </Button>
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
