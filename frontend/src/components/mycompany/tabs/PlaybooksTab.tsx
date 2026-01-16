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

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus } from 'lucide-react';
import { Button } from '../../ui/button';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { Skeleton } from '../../ui/Skeleton';
import { getDeptColor } from '../../../lib/colors';
import { makeClickable } from '../../../utils/a11y';
import type { Department } from '../../../types/business';

type DocType = 'sop' | 'framework' | 'policy';
type PlaybookTypeFilter = 'all' | DocType;

interface ExtendedPlaybook {
  id: string;
  title: string;
  doc_type: DocType;
  content?: string | undefined;
  department_id?: string | undefined;
  department_name?: string | undefined;
  department_slug?: string | undefined;
  additional_departments?: string[] | undefined;
}

interface ExpandedTypesState {
  sop?: boolean;
  framework?: boolean;
  policy?: boolean;
}

interface PlaybooksTabProps {
  playbooks?: ExtendedPlaybook[] | undefined;
  departments?: Department[] | undefined;
  playbooksLoaded?: boolean | undefined;
  loading?: boolean | undefined;
  playbookTypeFilter?: PlaybookTypeFilter | undefined;
  playbookDeptFilter?: string[] | undefined;
  expandedTypes?: ExpandedTypesState | Record<string, boolean> | undefined;
  onTypeFilterChange?: ((filter: PlaybookTypeFilter) => void) | undefined;
  onDeptFilterChange?: ((ids: string[]) => void) | undefined;
  onExpandedTypesChange?:
    | ((updater: (prev: ExpandedTypesState) => ExpandedTypesState) => void)
    | React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    | undefined;
  onAddPlaybook?: (() => void) | undefined;
  onViewPlaybook?: ((playbook: ExtendedPlaybook) => void) | undefined;
  onArchivePlaybook?: ((playbook: ExtendedPlaybook) => void) | undefined;
  onDeletePlaybook?: ((playbook: ExtendedPlaybook) => void) | undefined;
}

const DOC_TYPES: DocType[] = ['sop', 'framework', 'policy'];

export function PlaybooksTab({
  playbooks = [],
  departments = [],
  playbooksLoaded = true,
  loading = false,
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
  onDeletePlaybook,
}: PlaybooksTabProps) {
  const { t } = useTranslation();

  // Track which playbook row is "active" for mobile long-press actions
  const [mobileActiveId, setMobileActiveId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // Inline confirmation state: { id: string, action: 'archive' | 'delete' } | null
  const [confirmingAction, setConfirmingAction] = useState<{
    id: string;
    action: 'archive' | 'delete';
  } | null>(null);

  // Track which items are being removed (for fade-out animation)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const LONG_PRESS_DURATION = 500; // ms - standard mobile long-press duration
  const FADE_OUT_DURATION = 200; // ms - animation duration

  // Start long-press timer on touch/mouse down
  const handlePressStart = useCallback((doc: ExtendedPlaybook) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMobileActiveId(doc.id);
    }, LONG_PRESS_DURATION);
  }, []);

  // Cancel long-press on touch/mouse up or move
  const handlePressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle click - only open detail if long-press wasn't triggered
  const handleRowClick = useCallback(
    (doc: ExtendedPlaybook, e: React.MouseEvent) => {
      // If long-press was triggered, don't open detail
      if (longPressTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggeredRef.current = false;
        return;
      }

      // If actions are visible (from long-press), clicking row closes them
      if (mobileActiveId === doc.id) {
        setMobileActiveId(null);
        return;
      }

      // Normal click: open detail view
      onViewPlaybook && onViewPlaybook(doc);
    },
    [mobileActiveId, onViewPlaybook]
  );

  // Clear mobile active state when clicking outside
  useEffect(() => {
    if (!mobileActiveId) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // If click is outside any playbook row, clear active state
      if (!target.closest('.mc-elegant-row')) {
        setMobileActiveId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [mobileActiveId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Memoize stats to prevent recalculation on every render
  const stats = useMemo(
    () => ({
      sops: playbooks.filter((p) => p.doc_type === 'sop').length,
      frameworks: playbooks.filter((p) => p.doc_type === 'framework').length,
      policies: playbooks.filter((p) => p.doc_type === 'policy').length,
    }),
    [playbooks]
  );

  // Memoize filtered and grouped playbooks
  const { filteredPlaybooks, groupedPlaybooks } = useMemo(() => {
    const filtered = playbooks
      .filter((pb) => {
        const matchesType = playbookTypeFilter === 'all' || pb.doc_type === playbookTypeFilter;
        const matchesDept =
          playbookDeptFilter.length === 0 ||
          (pb.department_id && playbookDeptFilter.includes(pb.department_id)) ||
          (pb.additional_departments || []).some((id) => playbookDeptFilter.includes(id));
        return matchesType && matchesDept;
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    const grouped = DOC_TYPES.reduce(
      (acc, type) => {
        acc[type] = filtered.filter((p) => p.doc_type === type);
        return acc;
      },
      {} as Record<DocType, ExtendedPlaybook[]>
    );

    return { filteredPlaybooks: filtered, groupedPlaybooks: grouped };
  }, [playbooks, playbookTypeFilter, playbookDeptFilter]);

  // For backward compatibility with stat card rendering
  const allSops = { length: stats.sops };
  const allFrameworks = { length: stats.frameworks };
  const allPolicies = { length: stats.policies };

  // Show skeleton during initial load
  if (!playbooksLoaded || loading) {
    return (
      <div className="mc-playbooks">
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
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        {/* Playbook groups skeleton */}
        <div className="mc-playbooks-list">
          {[1, 2].map((groupIdx) => (
            <div key={groupIdx} className="mc-playbook-group">
              <Skeleton className="h-4 w-48 mb-3" />
              <div className="mc-elegant-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="mc-elegant-row" style={{ pointerEvents: 'none' }}>
                    <Skeleton variant="circular" className="h-2.5 w-2.5" />
                    <div className="mc-elegant-content">
                      <Skeleton className="h-4 w-52 mb-2" />
                      <div className="mc-elegant-badges">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-14" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (playbooks.length === 0) {
    return (
      <div className="mc-empty">
        <BookOpen size={32} className="mc-empty-icon" />
        <p className="mc-empty-title">{t('mycompany.buildKnowledgeBase')}</p>
        <p className="mc-empty-hint">{t('mycompany.playbooksHelp')}</p>
        <Button variant="default" onClick={onAddPlaybook}>
          {t('mycompany.newPlaybook')}
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
          {...(onTypeFilterChange ? makeClickable(() => onTypeFilterChange('all')) : {})}
        >
          <div className="mc-stat-value total">{playbooks.length}</div>
          <div className="mc-stat-label">{t('mycompany.total')}</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'sop' ? 'selected' : ''}`}
          {...(onTypeFilterChange ? makeClickable(() => onTypeFilterChange(playbookTypeFilter === 'sop' ? 'all' : 'sop')) : {})}
        >
          <div className="mc-stat-value sops">{allSops.length}</div>
          <div className="mc-stat-label">{t('mycompany.sops')}</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'framework' ? 'selected' : ''}`}
          {...(onTypeFilterChange ? makeClickable(() => onTypeFilterChange(playbookTypeFilter === 'framework' ? 'all' : 'framework')) : {})}
        >
          <div className="mc-stat-value frameworks">{allFrameworks.length}</div>
          <div className="mc-stat-label">{t('mycompany.frameworks')}</div>
        </div>
        <div
          className={`mc-stat-card clickable ${playbookTypeFilter === 'policy' ? 'selected' : ''}`}
          {...(onTypeFilterChange ? makeClickable(() => onTypeFilterChange(playbookTypeFilter === 'policy' ? 'all' : 'policy')) : {})}
        >
          <div className="mc-stat-value policies">{allPolicies.length}</div>
          <div className="mc-stat-label">{t('mycompany.policies')}</div>
        </div>
      </div>

      {/* Filters row - multi-department and search */}
      <div className="mc-projects-filters">
        <div className="mc-filters-left">
          <MultiDepartmentSelect
            value={playbookDeptFilter}
            onValueChange={onDeptFilterChange ?? (() => {})}
            departments={departments}
            placeholder={t('mycompany.allDepts')}
          />
        </div>
        <Button variant="default" size="sm" onClick={onAddPlaybook}>
          {t('mycompany.newPlaybook')}
        </Button>
      </div>

      {/* Playbooks list with scroll-to-top */}
      <ScrollableContent className="mc-playbooks-list">
        {filteredPlaybooks.length === 0 ? (
          <div className="mc-empty-filtered">{t('mycompany.noPlaybooksMatch')}</div>
        ) : (
          // eslint-disable-next-line
          DOC_TYPES.map((type: DocType) => {
            const docs = groupedPlaybooks[type];
            if (docs.length === 0) return null;

            const MAX_VISIBLE = 5;
            const isExpanded = expandedTypes[type];
            const visibleDocs = isExpanded ? docs : docs.slice(0, MAX_VISIBLE);
            const hasMore = docs.length > MAX_VISIBLE;

            return (
              <div key={type} className="mc-playbook-group">
                <h4 className="mc-group-title">
                  {t(`mycompany.typeLabel_${type}`)}
                  <span className="mc-group-count">({docs.length})</span>
                </h4>
                <div className="mc-elegant-list">
                  {visibleDocs.map((doc: ExtendedPlaybook) => {
                    // Use embedded department name (or fallback to lookup for backwards compat)
                    const dept:
                      | { id: string | undefined; name: string; slug: string | undefined }
                      | Department
                      | undefined = doc.department_name
                      ? {
                          id: doc.department_id,
                          name: doc.department_name,
                          slug: doc.department_slug,
                        }
                      : departments.find((d: Department) => d.id === doc.department_id);
                    // Find additional department names
                    const additionalDepts = (doc.additional_departments || [])
                      .map((deptId: string) => departments.find((d: Department) => d.id === deptId))
                      .filter((d): d is Department => Boolean(d));

                    // All departments for this playbook
                    const allDepts = [dept, ...additionalDepts].filter(
                      (d): d is NonNullable<typeof dept> => Boolean(d)
                    );

                    const typeLabel = t(`mycompany.typeShort_${doc.doc_type}`);

                    const isRemoving = removingIds.has(doc.id);

                    return (
                      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                      <div
                        key={doc.id}
                        className={`mc-elegant-row ${mobileActiveId === doc.id ? 'mobile-active' : ''} ${isRemoving ? 'removing' : ''}`}
                        {...makeClickable((e) => handleRowClick(doc, e))}
                        onTouchStart={() => handlePressStart(doc)}
                        onTouchEnd={handlePressEnd}
                        onTouchMove={handlePressEnd}
                        onMouseDown={() => handlePressStart(doc)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                      >
                        {/* Type indicator dot */}
                        <div className={`mc-type-dot ${doc.doc_type}`} />

                        {/* Main content */}
                        <div className="mc-elegant-content">
                          <span className="mc-elegant-title">{doc.title}</span>

                          {/* Badges row - departments + type */}
                          <div className="mc-elegant-badges">
                            {/* Department badges */}
                            {allDepts.map((d, idx) => {
                              const deptId = d.id ?? `dept-${idx}`;
                              const color = getDeptColor(deptId);
                              return (
                                <span
                                  key={deptId}
                                  className="mc-elegant-dept"
                                  style={{
                                    background: color.bg,
                                    color: color.text,
                                  }}
                                >
                                  {d.name}
                                </span>
                              );
                            })}
                            {allDepts.length === 0 && (
                              <span className="mc-elegant-dept mc-elegant-dept-none">
                                {t('mycompany.companyWide')}
                              </span>
                            )}

                            {/* Type badge */}
                            <span className={`mc-elegant-badge ${doc.doc_type}`}>{typeLabel}</span>
                          </div>
                        </div>

                        {/* Right side: Actions (appear on hover on desktop, tap-to-reveal on mobile) */}
                        <div className="mc-elegant-right">
                          <div className="mc-elegant-actions">
                            {confirmingAction?.id === doc.id ? (
                              // Inline confirmation: "Sure? No / Yes"
                              <>
                                <span className="mc-confirm-label">{t('mycompany.sure')}</span>
                                <button
                                  className="mc-text-btn no"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingAction(null);
                                  }}
                                >
                                  {t('mycompany.no')}
                                </button>
                                <button
                                  className="mc-text-btn yes"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileActiveId(null);
                                    setConfirmingAction(null);
                                    // Start fade-out animation
                                    setRemovingIds((prev) => new Set(prev).add(doc.id));
                                    // After animation completes, call the handler
                                    setTimeout(() => {
                                      if (confirmingAction.action === 'archive') {
                                        onArchivePlaybook && onArchivePlaybook(doc);
                                      } else {
                                        onDeletePlaybook && onDeletePlaybook(doc);
                                      }
                                    }, FADE_OUT_DURATION);
                                  }}
                                >
                                  {t('mycompany.yes')}
                                </button>
                              </>
                            ) : (
                              // Normal actions
                              <>
                                <button
                                  className="mc-text-btn archive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingAction({ id: doc.id, action: 'archive' });
                                  }}
                                  title={t('mycompany.archivePlaybook')}
                                >
                                  {t('mycompany.archive')}
                                </button>
                                <button
                                  className="mc-text-btn delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingAction({ id: doc.id, action: 'delete' });
                                  }}
                                  title={t('mycompany.deletePlaybook')}
                                >
                                  {t('mycompany.delete')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Load more / Show less button */}
                {hasMore && (
                  <button
                    className="mc-load-more-btn"
                    onClick={() =>
                      onExpandedTypesChange &&
                      onExpandedTypesChange((prev: ExpandedTypesState) => ({
                        ...prev,
                        [type]: !prev[type],
                      }))
                    }
                  >
                    {isExpanded
                      ? t('mycompany.showLess')
                      : t('mycompany.loadMore', { count: docs.length - MAX_VISIBLE })}
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
        aria-label={t('mycompany.createNewPlaybook')}
      >
        <Plus />
      </button>
    </div>
  );
}
