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
import { CheckCircle } from 'lucide-react';
import { MultiDepartmentSelect } from '../../ui/MultiDepartmentSelect';
import { getDeptColor } from '../../../lib/colors';
import { formatDateCompact } from '../../../lib/dateUtils';

// Helper to get a clean, short title from decision
function getDecisionDisplayTitle(decision) {
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
  onNavigateToConversation
}) {
  // Memoized pending decisions (not promoted)
  const pendingDecisions = useMemo(() =>
    decisions.filter(d => !d.promoted_to_id && !d.project_id),
    [decisions]
  );

  // Memoized filtered decisions
  const filteredDecisions = useMemo(() => {
    let filtered = pendingDecisions;

    // Department filter
    if (decisionDeptFilter.length > 0) {
      filtered = filtered.filter(d => {
        const deptIds = d.department_ids || [];
        return deptIds.some(id => decisionDeptFilter.includes(id));
      });
    }

    // Keyword search (title + content + question)
    if (decisionSearch.trim()) {
      const searchLower = decisionSearch.toLowerCase().trim();
      filtered = filtered.filter(d => {
        const title = (d.title || '').toLowerCase();
        const content = (d.content || '').toLowerCase();
        const question = (d.question || '').toLowerCase();
        const contentSummary = (d.content_summary || '').toLowerCase();
        return title.includes(searchLower) ||
               content.includes(searchLower) ||
               question.includes(searchLower) ||
               contentSummary.includes(searchLower);
      });
    }

    return filtered;
  }, [pendingDecisions, decisionDeptFilter, decisionSearch]);

  // Empty state - no decisions at all
  if (pendingDecisions.length === 0) {
    return (
      <div className="mc-empty">
        <CheckCircle size={40} className="mc-empty-icon-svg" />
        <p className="mc-empty-title">All caught up!</p>
        <p className="mc-empty-hint">
          No pending decisions to review. Save council outputs to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="mc-decisions">
      {/* Filter controls */}
      <div className="mc-decisions-filters">
        {/* Search input */}
        <div className="mc-search-input-wrapper">
          <svg className="mc-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="mc-search-input"
            placeholder="Search decisions..."
            value={decisionSearch}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
          {decisionSearch && (
            <button
              className="mc-search-clear"
              onClick={() => onSearchChange && onSearchChange('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Department filter */}
        <MultiDepartmentSelect
          value={decisionDeptFilter}
          onValueChange={onDeptFilterChange}
          departments={departments}
          placeholder="All departments"
          className="mc-dept-filter"
        />
      </div>

      {/* Results count */}
      {(decisionSearch || decisionDeptFilter.length > 0) && (
        <div className="mc-filter-results">
          {filteredDecisions.length} of {pendingDecisions.length} decision{pendingDecisions.length !== 1 ? 's' : ''}
          {(decisionSearch || decisionDeptFilter.length > 0) && (
            <button
              className="mc-clear-filters"
              onClick={() => {
                onSearchChange && onSearchChange('');
                onDeptFilterChange && onDeptFilterChange([]);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Empty state for filtered results */}
      {filteredDecisions.length === 0 && (
        <div className="mc-empty">
          <div className="mc-empty-icon">🔍</div>
          <p className="mc-empty-title">No matching decisions</p>
          <p className="mc-empty-hint">
            Try adjusting your search or department filter.
          </p>
        </div>
      )}

      {/* Decision list */}
      {filteredDecisions.length > 0 && (
        <div className="mc-elegant-list">
          {filteredDecisions.map(decision => {
            const isDeleting = deletingDecisionId === decision.id;
            const displayTitle = getDecisionDisplayTitle(decision);

            return (
              <div
                key={decision.id}
                className={`mc-elegant-row mc-decision-row ${isDeleting ? 'deleting' : ''}`}
                onClick={() => !isDeleting && onPromoteDecision && onPromoteDecision(decision)}
              >
                {/* Status indicator - amber for pending */}
                <div className="mc-status-dot draft" />

                {/* Main content - title + badges */}
                <div className="mc-elegant-content">
                  <span className="mc-elegant-title">{displayTitle}</span>
                  <div className="mc-elegant-badges">
                    {/* Department badges */}
                    {(decision.department_ids || []).map(deptId => {
                      const dept = departments.find(d => d.id === deptId);
                      if (!dept) return null;
                      const color = getDeptColor(deptId);
                      return (
                        <span
                          key={deptId}
                          className="mc-elegant-dept"
                          style={{
                            background: color.bg,
                            color: color.text
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
                    {decision.source_conversation_id && !decision.source_conversation_id.startsWith('temp-') && onNavigateToConversation && (
                      <button
                        className="mc-text-btn source"
                        onClick={(e) => { e.stopPropagation(); onNavigateToConversation(decision.source_conversation_id, 'decisions'); }}
                        title="View original conversation"
                      >
                        Source
                      </button>
                    )}
                    <button
                      className="mc-text-btn promote"
                      onClick={(e) => { e.stopPropagation(); onPromoteDecision && onPromoteDecision(decision); }}
                    >
                      Promote
                    </button>
                    <button
                      className="mc-text-btn delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteDecision && onDeleteDecision(decision); }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
