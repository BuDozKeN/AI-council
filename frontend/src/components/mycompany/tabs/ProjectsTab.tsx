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
import { useTranslation } from 'react-i18next';
import { CheckCircle, Archive, RotateCcw, Trash2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
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

// Format relative time for project timestamps - uses i18n for static labels
// The i18next TFunction has a complex type that doesn't work with simple string params
function formatRelativeTime(
  dateStr: string | null | undefined,
  t: (key: string) => string
): string {
  if (!dateStr) return t('mycompany.never');
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('mycompany.justNow');
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
  onDeleteProject,
}: ProjectsTabProps) {
  const { t } = useTranslation();
  // Memoized stats - only recalculate when projects change
  // Must be before any early returns to satisfy React hooks rules
  const stats = useMemo(
    () => ({
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      archived: projects.filter((p) => p.status === 'archived').length,
      totalDecisions: projects.reduce((sum, p) => sum + (p.decision_count || 0), 0),
    }),
    [projects]
  );

  // Memoized filtering and sorting
  const sortedProjects = useMemo(() => {
    // Filter by status
    let filtered = projects;
    if (projectStatusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === projectStatusFilter);
    }

    // Filter by department (multi-select)
    if (projectDeptFilter.length > 0) {
      filtered = filtered.filter((p) =>
        (p.department_ids || []).some((id) => projectDeptFilter.includes(id))
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
          return (
            new Date(b.last_accessed_at || b.updated_at || b.created_at).getTime() -
            new Date(a.last_accessed_at || a.updated_at || a.created_at).getTime()
          );
      }
    });
  }, [projects, projectStatusFilter, projectDeptFilter, projectSortBy]);

  // Show skeleton during initial load
  if (!projectsLoaded || loading) {
    return (
      <div className="mc-projects">
        {/* Stats skeleton */}
        <div className="mc-stats-grid">
          {[1, 2, 3, 4].map((i) => (
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
          {[1, 2, 3, 4, 5].map((i) => (
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
        <motion.svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="mc-empty-icon-svg"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <defs>
            <linearGradient id="projectGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-indigo-500)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-purple-500)" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Kanban columns */}
          <rect
            x="15"
            y="25"
            width="28"
            height="70"
            rx="6"
            fill="url(#projectGradient)"
            opacity="0.2"
          />
          <rect
            x="48"
            y="25"
            width="28"
            height="70"
            rx="6"
            fill="url(#projectGradient)"
            opacity="0.3"
          />
          <rect
            x="81"
            y="25"
            width="28"
            height="70"
            rx="6"
            fill="url(#projectGradient)"
            opacity="0.4"
          />

          {/* Task cards in columns */}
          <rect
            x="18"
            y="30"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
          <rect
            x="18"
            y="48"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
          <rect
            x="18"
            y="66"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          <rect
            x="51"
            y="30"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
          <rect
            x="51"
            y="48"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          <rect
            x="84"
            y="30"
            width="22"
            height="14"
            rx="3"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
        </motion.svg>

        <p className="mc-empty-title">{t('mycompany.startFirstProject')}</p>
        <p className="mc-empty-hint">{t('mycompany.projectsHelp')}</p>

        <Button variant="default" onClick={onAddProject} style={{ marginTop: '8px' }}>
          <Plus size={16} />
          {t('mycompany.newProject')}
        </Button>
      </div>
    );
  }

  // Project row component
  const renderProjectRow = (project: ExtendedProject) => {
    const deptIds = project.department_ids || [];
    const deptNames = project.department_names || [];
    const isFading = fadingProjectId === project.id;

    return (
      <article
        key={project.id}
        className={`mc-project-row-compact ${isFading ? 'fading' : ''}`}
        onClick={!isFading && onProjectClick ? () => onProjectClick(project) : undefined}
        tabIndex={!isFading && onProjectClick ? 0 : undefined}
        onKeyDown={
          !isFading && onProjectClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onProjectClick(project);
                }
              }
            : undefined
        }
        aria-label={`Project: ${project.name}, Status: ${project.status}, ${project.decision_count || 0} decisions`}
      >
        {/* Status indicator dot */}
        <div
          className={`mc-status-dot ${project.status}`}
          title={t(`mycompany.${project.status}`)}
          aria-label={t(`mycompany.${project.status}`)}
        />

        {/* Title group: name + ALL department badges */}
        <div className="mc-project-title-group">
          <span className="mc-project-name">{project.name}</span>
          {deptIds.map((deptId: string, idx: number) => {
            const deptName =
              deptNames[idx] || departments.find((d: Department) => d.id === deptId)?.name;
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
          <span className="mc-project-decision-count">{project.decision_count || '–'}</span>
          <span className="mc-project-time">
            {formatRelativeTime(
              project.last_accessed_at || project.updated_at,
              t as (key: string) => string
            )}
          </span>
        </div>

        {/* Actions - visible on hover */}
        <div className="mc-project-actions">
          {project.status === 'active' && (
            <button
              className="mc-project-action complete"
              onClick={(e) => {
                e.stopPropagation();
                onCompleteProject && onCompleteProject(project, e);
              }}
              title={t('mycompany.markCompleted')}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{t('mycompany.complete')}</span>
            </button>
          )}
          {project.status === 'archived' ? (
            <button
              className="mc-project-action restore"
              onClick={(e) => {
                e.stopPropagation();
                onRestoreProject && onRestoreProject(project, e);
              }}
              title={t('mycompany.restoreProject')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('mycompany.restore')}</span>
            </button>
          ) : (
            <button
              className="mc-project-action archive"
              onClick={(e) => {
                e.stopPropagation();
                onArchiveProject && onArchiveProject(project, e);
              }}
              title={t('mycompany.archiveProject')}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{t('mycompany.archive')}</span>
            </button>
          )}
          {confirmingDeleteProjectId === project.id ? (
            <>
              <button
                className="mc-project-action confirm-yes"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject && onDeleteProject(project, e);
                }}
                title={t('common.confirm')}
              >
                <span>{t('mycompany.confirmDelete')}</span>
              </button>
              <button
                className="mc-project-action confirm-no"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmingDeleteChange && onConfirmingDeleteChange(null);
                }}
                title={t('common.cancel')}
              >
                <span>{t('mycompany.cancelDelete')}</span>
              </button>
            </>
          ) : (
            <button
              className="mc-project-action delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject && onDeleteProject(project, e);
              }}
              title={t('mycompany.deleteProject')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('mycompany.delete')}</span>
            </button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="mc-projects">
      {/* Stats grid - same style as Overview tab */}
      <div className="mc-stats-grid" role="group" aria-label="Project status filters">
        <button
          type="button"
          className={`mc-stat-card clickable ${projectStatusFilter === 'active' ? 'selected' : ''}`}
          onClick={
            onStatusFilterChange
              ? () => onStatusFilterChange(projectStatusFilter === 'active' ? 'all' : 'active')
              : undefined
          }
          aria-pressed={projectStatusFilter === 'active'}
          aria-label={`Filter by active projects: ${stats.active} active`}
        >
          <div className="mc-stat-value active">{stats.active}</div>
          <div className="mc-stat-label">{t('mycompany.active')}</div>
        </button>
        <button
          type="button"
          className={`mc-stat-card clickable ${projectStatusFilter === 'completed' ? 'selected' : ''}`}
          onClick={
            onStatusFilterChange
              ? () =>
                  onStatusFilterChange(projectStatusFilter === 'completed' ? 'all' : 'completed')
              : undefined
          }
          aria-pressed={projectStatusFilter === 'completed'}
          aria-label={`Filter by completed projects: ${stats.completed} completed`}
        >
          <div className="mc-stat-value completed">{stats.completed}</div>
          <div className="mc-stat-label">{t('mycompany.completed')}</div>
        </button>
        <button
          type="button"
          className={`mc-stat-card clickable ${projectStatusFilter === 'archived' ? 'selected' : ''}`}
          onClick={
            onStatusFilterChange
              ? () => onStatusFilterChange(projectStatusFilter === 'archived' ? 'all' : 'archived')
              : undefined
          }
          aria-pressed={projectStatusFilter === 'archived'}
          aria-label={`Filter by archived projects: ${stats.archived} archived`}
        >
          <div className="mc-stat-value archived">{stats.archived}</div>
          <div className="mc-stat-label">{t('mycompany.archived')}</div>
        </button>
        <div className="mc-stat-card" aria-label={`Total decisions: ${stats.totalDecisions}`}>
          <div className="mc-stat-value decisions">{stats.totalDecisions}</div>
          <div className="mc-stat-label">{t('mycompany.decisions')}</div>
        </div>
      </div>

      {/* Filters row - multi-department and sort */}
      <div className="mc-projects-filters">
        <div className="mc-filters-left">
          <MultiDepartmentSelect
            value={projectDeptFilter}
            onValueChange={onDeptFilterChange ?? (() => {})}
            departments={departments}
            placeholder={t('mycompany.allDepts')}
          />
          <SortSelect
            value={projectSortBy}
            onValueChange={(value: string) => onSortByChange?.(value as ProjectSortBy)}
          />
        </div>
        <Button variant="default" size="sm" onClick={onAddProject}>
          {t('mycompany.newProject')}
        </Button>
      </div>

      {/* Projects list with scroll-to-top */}
      <ScrollableContent className="mc-projects-list">
        {sortedProjects.length === 0 ? (
          <div className="mc-empty-filtered">{t('mycompany.noProjectsMatch')}</div>
        ) : (
          sortedProjects.map(renderProjectRow)
        )}
      </ScrollableContent>

      {/* FAB - Mobile only (visible via CSS) */}
      <button
        className="mc-fab"
        onClick={onAddProject}
        aria-label={t('mycompany.createNewProject')}
      >
        <Plus />
      </button>
    </div>
  );
}
