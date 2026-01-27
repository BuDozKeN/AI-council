/**
 * DecisionsTab - Pending decisions management
 *
 * Shows:
 * - Search and department filters
 * - Pending decisions (not promoted, no project)
 * - Promote and delete actions
 *
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { ScrollableContent } from '../../ui/ScrollableContent';
import { getDeptColor } from '../../../lib/colors';
import { formatDateCompact } from '../../../lib/dateUtils';
import type { Department } from '../../../types/business';

// Note: ScrollableContent provides sticky copy button + scroll-to-top for lists

interface Decision {
  id: string;
  conversation_id?: string;
  company_id?: string;
  title?: string;
  content?: string;
  content_summary?: string;
  summary?: string;
  question?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'archived';
  council_type?: string;
  department_ids?: string[];
  promoted_to_id?: string;
  project_id?: string;
  playbook_type?: 'sop' | 'framework' | 'policy';
  source_conversation_id?: string;
  created_at: string;
  updated_at?: string;
}

interface DecisionsTabProps {
  decisions?: Decision[] | undefined;
  departments?: Department[] | undefined;
  decisionDeptFilter?: string[] | undefined;
  decisionSearch?: string | undefined;
  deletingDecisionId?: string | null | undefined;
  onDeptFilterChange?: ((ids: string[]) => void) | undefined;
  onSearchChange?: ((search: string) => void) | undefined;
  onPromoteDecision?: ((decision: Decision) => void) | undefined;
  onDeleteDecision?: ((decision: Decision) => void | Promise<void>) | undefined;
  onNavigateToConversation?: ((conversationId: string, source: string) => void) | undefined;
}

// Helper to get a clean, short title from decision
function getDecisionDisplayTitle(decision: Decision): string {
  // If we have an AI-generated content_summary, extract first sentence as title
  if (decision.content_summary) {
    const firstSentence = decision.content_summary.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
      return firstSentence.trim();
    }
  }
  // Fall back to title, but clean it up
  const title = decision.title || 'Council Decision';
  // Remove markdown headers
  const cleaned = title.replace(/^#+\s*/, '').trim();
  // Truncate if too long
  return cleaned.length > 80 ? cleaned.slice(0, 77) + '...' : cleaned;
}

export function DecisionsTab({
  decisions = [],
  departments = [],
  // Filter state
  decisionDeptFilter = [],
  decisionSearch = '',
  // Animation state
  deletingDecisionId = null,
  // Filter setters
  onDeptFilterChange,
  onSearchChange,
  // Actions
  onPromoteDecision,
  onDeleteDecision,
  onNavigateToConversation,
}: DecisionsTabProps) {
  const { t } = useTranslation();

  // Memoized pending decisions (not promoted)
  const pendingDecisions = useMemo(
    () => decisions.filter((d) => !d.promoted_to_id && !d.project_id),
    [decisions]
  );

  // Memoized filtered decisions
  const filteredDecisions = useMemo(() => {
    let filtered = pendingDecisions;

    // Department filter
    if (decisionDeptFilter.length > 0) {
      filtered = filtered.filter((d) => {
        const deptIds = d.department_ids || [];
        return deptIds.some((id) => decisionDeptFilter.includes(id));
      });
    }

    // Keyword search (title + content + question)
    if (decisionSearch.trim()) {
      const searchLower = decisionSearch.toLowerCase().trim();
      filtered = filtered.filter((d) => {
        const title = (d.title || '').toLowerCase();
        const content = (d.content || '').toLowerCase();
        const question = (d.question || '').toLowerCase();
        const contentSummary = (d.content_summary || '').toLowerCase();
        return (
          title.includes(searchLower) ||
          content.includes(searchLower) ||
          question.includes(searchLower) ||
          contentSummary.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [pendingDecisions, decisionDeptFilter, decisionSearch]);

  // Empty state - no decisions at all
  if (pendingDecisions.length === 0) {
    return (
      <div className="mc-empty">
        <motion.svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="mc-empty-icon-svg"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <defs>
            <linearGradient id="decisionsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-indigo-500)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-purple-500)" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Trophy base */}
          <rect
            x="45"
            y="80"
            width="30"
            height="8"
            rx="2"
            fill="url(#decisionsGradient)"
            opacity="0.4"
          />
          <rect
            x="50"
            y="72"
            width="20"
            height="8"
            rx="1"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          {/* Trophy cup */}
          <path
            d="M 35 35 L 35 50 Q 35 65 50 68 L 70 68 Q 85 65 85 50 L 85 35 Z"
            fill="url(#decisionsGradient)"
            opacity="0.5"
          />
          <path
            d="M 35 35 L 35 50 Q 35 65 50 68 L 70 68 Q 85 65 85 50 L 85 35 Z"
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          {/* Trophy handles */}
          <path
            d="M 30 40 Q 25 40 25 45 Q 25 50 30 50"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />
          <path
            d="M 90 40 Q 95 40 95 45 Q 95 50 90 50"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          {/* Checkmark in trophy */}
          <path
            d="M 52 48 L 58 54 L 68 42"
            fill="none"
            stroke="var(--color-indigo-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Confetti particles */}
          <circle cx="20" cy="25" r="2" fill="var(--color-indigo-500)" opacity="0.6" />
          <circle cx="100" cy="30" r="2" fill="var(--color-purple-500)" opacity="0.6" />
          <rect x="15" y="45" width="3" height="3" fill="var(--color-indigo-400)" opacity="0.5" />
          <rect x="102" y="50" width="3" height="3" fill="var(--color-purple-400)" opacity="0.5" />
          <path
            d="M 25 60 L 27 62 L 25 64 L 23 62 Z"
            fill="var(--color-indigo-300)"
            opacity="0.4"
          />
          <path
            d="M 95 65 L 97 67 L 95 69 L 93 67 Z"
            fill="var(--color-purple-300)"
            opacity="0.4"
          />
        </motion.svg>

        <p className="mc-empty-title">{t('mycompany.allCaughtUp')}</p>
        <p className="mc-empty-hint">{t('mycompany.noPendingDecisions')}</p>
      </div>
    );
  }

  return (
    <div className="mc-decisions">
      {/* Filter controls */}
      <div className="mc-decisions-filters">
        {/* Department filter - first on mobile for thumb reach */}
        <MultiDepartmentSelect
          value={decisionDeptFilter}
          onValueChange={onDeptFilterChange ?? (() => {})}
          departments={departments}
          placeholder={t('mycompany.allDepartments')}
          className="mc-dept-filter"
        />

        {/* Search input */}
        <div className="mc-search-input-wrapper">
          <svg
            className="mc-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="decisions-search"
            name="decisions-search"
            type="search"
            inputMode="search"
            className="mc-search-input"
            placeholder={t('mycompany.searchDecisions')}
            value={decisionSearch}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
          {decisionSearch && (
            <button
              className="mc-search-clear"
              onClick={() => onSearchChange && onSearchChange('')}
              title={t('mycompany.clearSearch')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {(decisionSearch || decisionDeptFilter.length > 0) && (
        <div className="mc-filter-results">
          {t('mycompany.filterResults', {
            filtered: filteredDecisions.length,
            total: pendingDecisions.length,
          })}
          {(decisionSearch || decisionDeptFilter.length > 0) && (
            <button
              className="mc-clear-filters"
              onClick={() => {
                onSearchChange && onSearchChange('');
                onDeptFilterChange && onDeptFilterChange([]);
              }}
            >
              {t('mycompany.clearFilters')}
            </button>
          )}
        </div>
      )}

      {/* Empty state for filtered results */}
      {filteredDecisions.length === 0 && (
        <div className="mc-empty">
          <p className="mc-empty-title">{t('mycompany.noMatchingDecisions')}</p>
          <p className="mc-empty-hint">{t('mycompany.tryAdjustingFilters')}</p>
        </div>
      )}

      {/* Decision list with scroll-to-top */}
      {filteredDecisions.length > 0 && (
        <ScrollableContent className="mc-decisions-list">
          <ul className="mc-elegant-list" aria-label="Pending decisions">
            {filteredDecisions.map((decision: Decision) => {
              const isDeleting = deletingDecisionId === decision.id;
              const displayTitle = getDecisionDisplayTitle(decision);

              return (
                <li
                  key={decision.id}
                  className={`mc-elegant-row mc-decision-row ${isDeleting ? 'deleting' : ''}`}
                  onClick={!isDeleting && onPromoteDecision ? () => onPromoteDecision(decision) : undefined}
                  onKeyDown={!isDeleting && onPromoteDecision ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPromoteDecision(decision);
                    }
                  } : undefined}
                  tabIndex={isDeleting ? -1 : 0}
                  role={!isDeleting ? 'button' : undefined}
                  aria-label={`${displayTitle}, ${formatDateCompact(decision.created_at)}`}
                >
                  {/* Status indicator - amber for pending */}
                  <div className="mc-status-dot draft" />

                  {/* Main content - title + badges */}
                  <div className="mc-elegant-content">
                    <span className="mc-elegant-title">{displayTitle}</span>
                    <div className="mc-elegant-badges">
                      {/* Department badges */}
                      {(decision.department_ids || []).map((deptId: string) => {
                        const dept = departments.find((d: Department) => d.id === deptId);
                        if (!dept) return null;
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
                            {dept.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right side: Date (fades on hover) + Actions (appear on hover) */}
                  <div className="mc-elegant-right">
                    <span className="mc-elegant-date">
                      {formatDateCompact(decision.created_at)}
                    </span>
                    <div className="mc-elegant-actions">
                      {decision.source_conversation_id &&
                        !decision.source_conversation_id.startsWith('temp-') &&
                        onNavigateToConversation && (
                          <button
                            className="mc-text-btn source"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToConversation(
                                decision.source_conversation_id!,
                                'decisions'
                              );
                            }}
                            title={t('mycompany.viewOriginalConversation')}
                          >
                            {t('mycompany.source')}
                          </button>
                        )}
                      <button
                        className="mc-text-btn promote"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPromoteDecision && onPromoteDecision(decision);
                        }}
                      >
                        {t('mycompany.promote')}
                      </button>
                      <button
                        className="mc-text-btn delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDecision && onDeleteDecision(decision);
                        }}
                      >
                        {t('mycompany.delete')}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollableContent>
      )}
    </div>
  );
}
