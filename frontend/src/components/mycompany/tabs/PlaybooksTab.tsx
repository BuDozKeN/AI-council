/**
 * PlaybooksTab - SOPs, Frameworks, and Policies management
 *
 * Shows:
 * - Stats cards with clickable type filters
 * - Department multi-select filter
 * - Playbooks grouped by type (SOP, Framework, Policy)
 * - Archive and delete actions
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useMemo } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { getDeptColor } from '../../../lib/colors';

const DOC_TYPES = ['sop', 'framework', 'policy'];
const TYPE_LABELS = {
  sop: 'Standard Operating Procedures',
  framework: 'Frameworks',
  policy: 'Policies'
};
const TYPE_SHORT_LABELS = {
  sop: 'SOP',
  framework: 'Framework',
  policy: 'Policy'
};

export function PlaybooksTab({
  playbooks = [],
  departments = [],
  // Filter state
  playbookTypeFilter = 'all',
  playbookDeptFilter = [],
  expandedTypes = {},
  // Filter setters
  onTypeFilterChange,
  onDeptFilterChange,
  onExpandedTypesChange,
  // Actions
  onAddPlaybook,
  onViewPlaybook,
  onArchivePlaybook,
  onDeletePlaybook
}) {
  // Memoize stats to prevent recalculation on every render
  const stats = useMemo(() => ({
    sops: playbooks.filter(p => p.doc_type === 'sop').length,
    frameworks: playbooks.filter(p => p.doc_type === 'framework').length,
    policies: playbooks.filter(p => p.doc_type === 'policy').length,
  }), [playbooks]);

  // Memoize filtered and grouped playbooks
  const { filteredPlaybooks, groupedPlaybooks } = useMemo(() => {
    const filtered = playbooks
      .filter(pb => {
        const matchesType = playbookTypeFilter === 'all' || pb.doc_type === playbookTypeFilter;
        const matchesDept = playbookDeptFilter.length === 0 ||
          playbookDeptFilter.includes(pb.department_id) ||
          (pb.additional_departments || []).some(id => playbookDeptFilter.includes(id));
        return matchesType && matchesDept;
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    const grouped = DOC_TYPES.reduce((acc, type) => {
      acc[type] = filtered.filter(p => p.doc_type === type);
      return acc;
    }, {});

    return { filteredPlaybooks: filtered, groupedPlaybooks: grouped };
  }, [playbooks, playbookTypeFilter, playbookDeptFilter]);

  // For backward compatibility with stat card rendering
  const allSops = { length: stats.sops };
  const allFrameworks = { length: stats.frameworks };
  const allPolicies = { length: stats.policies };

  if (playbooks.length === 0) {
    return (
      <div className="mc-empty">
        <BookOpen size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">No playbooks yet</p>
        <p className="mc-empty-hint">Create SOPs, frameworks, and policies for your AI council</p>
        <Button
          variant="default"
          onClick={onAddPlaybook}
        >
          + Create Playbook
        </Button>
      </div>
    );
  }

  return (
    <div className="mc-playbooks">
      {/* Stats grid - clickable filters like Projects tab */}
      <div className="mc-stats-grid">
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'all' ? 'selected' : ''}`}
          onClick={() => onTypeFilterChange && onTypeFilterChange('all')}
        >
          <div className="mc-stat-value total">{playbooks.length}</div>
          <div className="mc-stat-label">Total</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'sop' ? 'selected' : ''}`}
          onClick={() => onTypeFilterChange && onTypeFilterChange(playbookTypeFilter === 'sop' ? 'all' : 'sop')}
        >
          <div className="mc-stat-value sops">{allSops.length}</div>
          <div className="mc-stat-label">SOPs</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'framework' ? 'selected' : ''}`}
          onClick={() => onTypeFilterChange && onTypeFilterChange(playbookTypeFilter === 'framework' ? 'all' : 'framework')}
        >
          <div className="mc-stat-value frameworks">{allFrameworks.length}</div>
          <div className="mc-stat-label">Frameworks</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'policy' ? 'selected' : ''}`}
          onClick={() => onTypeFilterChange && onTypeFilterChange(playbookTypeFilter === 'policy' ? 'all' : 'policy')}
        >
          <div className="mc-stat-value policies">{allPolicies.length}</div>
          <div className="mc-stat-label">Policies</div>
        </div>
      </div>

      {/* Filters row - multi-department and search */}
      <div className="mc-projects-filters">
        <div className="mc-filters-left">
          <MultiDepartmentSelect
            value={playbookDeptFilter}
            onValueChange={onDeptFilterChange}
            departments={departments}
            placeholder="All Depts"
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={onAddPlaybook}
        >
          <Plus size={14} />
          New Playbook
        </Button>
      </div>

      {/* Playbooks list with scroll-to-top */}
      <ScrollableContent className="mc-playbooks-list">
        {filteredPlaybooks.length === 0 ? (
          <div className="mc-empty-filtered">
            No playbooks match your filters
          </div>
        ) : (
          DOC_TYPES.map(type => {
            const docs = groupedPlaybooks[type];
            if (docs.length === 0) return null;

            const MAX_VISIBLE = 5;
            const isExpanded = expandedTypes[type];
            const visibleDocs = isExpanded ? docs : docs.slice(0, MAX_VISIBLE);
            const hasMore = docs.length > MAX_VISIBLE;

            return (
              <div key={type} className="mc-playbook-group">
                <h4 className="mc-group-title">
                  {TYPE_LABELS[type]}
                  <span className="mc-group-count">({docs.length})</span>
                </h4>
                <div className="mc-elegant-list">
                  {visibleDocs.map(doc => {
                    // Use embedded department name (or fallback to lookup for backwards compat)
                    const dept = doc.department_name
                      ? { id: doc.department_id, name: doc.department_name, slug: doc.department_slug }
                      : departments.find(d => d.id === doc.department_id);
                    // Find additional department names
                    const additionalDepts = (doc.additional_departments || [])
                      .map(deptId => departments.find(d => d.id === deptId))
                      .filter(Boolean);

                    // All departments for this playbook
                    const allDepts = [dept, ...additionalDepts].filter(Boolean);

                    const typeLabel = TYPE_SHORT_LABELS[doc.doc_type] || doc.doc_type;

                    return (
                      <div
                        key={doc.id}
                        className="mc-elegant-row"
                        onClick={() => onViewPlaybook && onViewPlaybook(doc)}
                      >
                        {/* Type indicator dot */}
                        <div className={`mc-type-dot ${doc.doc_type}`} />

                        {/* Main content */}
                        <div className="mc-elegant-content">
                          <span className="mc-elegant-title">{doc.title}</span>

                          {/* Badges row - departments + type */}
                          <div className="mc-elegant-badges">
                            {/* Department badges */}
                            {allDepts.map(d => {
                              const color = getDeptColor(d.id);
                              return (
                                <span
                                  key={d.id}
                                  className="mc-elegant-dept"
                                  style={{
                                    background: color.bg,
                                    color: color.text
                                  }}
                                >
                                  {d.name}
                                </span>
                              );
                            })}
                            {allDepts.length === 0 && (
                              <span className="mc-elegant-dept mc-elegant-dept-none">
                                Company-wide
                              </span>
                            )}

                            {/* Type badge */}
                            <span className={`mc-elegant-badge ${doc.doc_type}`}>{typeLabel}</span>
                          </div>
                        </div>

                        {/* Actions on hover - Archive and Delete */}
                        <div className="mc-elegant-actions">
                          <button
                            className="mc-text-btn archive"
                            onClick={(e) => { e.stopPropagation(); onArchivePlaybook && onArchivePlaybook(doc); }}
                            title="Archive playbook"
                          >
                            Archive
                          </button>
                          <button
                            className="mc-text-btn delete"
                            onClick={(e) => { e.stopPropagation(); onDeletePlaybook && onDeletePlaybook(doc); }}
                            title="Delete playbook"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Load more / Show less button */}
                {hasMore && (
                  <button
                    className="mc-load-more-btn"
                    onClick={() => onExpandedTypesChange && onExpandedTypesChange(prev => ({ ...prev, [type]: !prev[type] }))}
                  >
                    {isExpanded ? `Show less` : `Load more (${docs.length - MAX_VISIBLE} more)`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </ScrollableContent>

      {/* FAB - Mobile only (visible via CSS) */}
      <button
        className="mc-fab"
        onClick={onAddPlaybook}
        aria-label="Create new playbook"
      >
        <Plus />
      </button>
    </div>
  );
}
