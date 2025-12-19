/**
 * ActivityTab - Company activity log display
 *
 * Shows a timeline of company events grouped by date.
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { ClipboardList } from 'lucide-react';

// Constants for activity display
const EVENT_LABELS = {
  consultation: 'Consultation',
  decision: 'Decision',
  playbook: 'Playbook',
  project: 'Project',
  role: 'Role Change',
  department: 'Department',
  council_session: 'Council Session'
};

const PROMOTED_TYPE_LABELS = {
  sop: 'SOP',
  framework: 'FRAMEWORK',
  policy: 'POLICY',
  project: 'PROJECT'
};

const PROMOTED_TYPE_COLORS = {
  sop: { bg: '#fef3c7', text: '#d97706' },
  framework: { bg: '#dbeafe', text: '#2563eb' },
  policy: { bg: '#ede9fe', text: '#7c3aed' },
  project: { bg: '#d1fae5', text: '#059669' }
};

const EVENT_COLORS = {
  consultation: '#6366f1',
  decision: '#22c55e',
  playbook: '#3b82f6',
  project: '#14b8a6',
  role: '#8b5cf6',
  department: '#f59e0b',
  council_session: '#10b981',
  default: '#64748b'
};

const ACTION_COLORS = {
  deleted: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
  promoted: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  saved: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  created: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
  updated: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
  archived: { bg: '#f5f5f4', text: '#78716c', border: '#d6d3d1' },
  consulted: { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' }
};

// Parse action from title (e.g., "Deleted: Title" -> { action: "Deleted", cleanTitle: "Title" })
function parseTitle(title) {
  const match = title?.match(/^(Deleted|Promoted|Saved|Created|Updated|Archived|Consulted):\s*(.+)$/i);
  if (match) {
    return { action: match[1], cleanTitle: match[2] };
  }
  return { action: null, cleanTitle: title };
}

// Group logs by date (Today, Yesterday, or formatted date)
function groupLogsByDate(logs) {
  return logs.reduce((groups, log) => {
    const date = new Date(log.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateKey;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }

    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(log);
    return groups;
  }, {});
}

export function ActivityTab({
  activityLogs = [],
  activityLoaded = false,
  activityHasMore = false,
  activityLoadingMore = false,
  onActivityClick,
  onLoadMore,
  onNavigateToConversation
}) {
  // Only show empty state if data has been loaded (not during initial load)
  if (activityLogs.length === 0 && activityLoaded) {
    return (
      <div className="mc-empty">
        <ClipboardList className="mc-empty-icon" size={48} />
        <p className="mc-empty-title">No activity yet</p>
        <p className="mc-empty-hint">
          Activity will appear here as you use the council, save decisions, and update playbooks.
        </p>
      </div>
    );
  }

  // If not loaded yet and no logs, return null (skeleton will be shown by parent)
  if (activityLogs.length === 0 && !activityLoaded) {
    return null;
  }

  const groupedLogs = groupLogsByDate(activityLogs);

  return (
    <div className="mc-activity">
      <div className="mc-activity-header">
        <span>{activityLogs.length} events</span>
      </div>

      {Object.entries(groupedLogs).map(([date, logs]) => (
        <div key={date} className="mc-activity-group">
          <h4 className="mc-group-title">{date}</h4>
          <div className="mc-elegant-list">
            {logs.map(log => {
              const dotColor = EVENT_COLORS[log.event_type] || EVENT_COLORS.default;
              const { action: parsedAction, cleanTitle } = parseTitle(log.title);
              // If promoted_to_type is set, show "Promoted" instead of the parsed action
              const action = log.promoted_to_type ? 'Promoted' : parsedAction;
              const actionColors = action ? ACTION_COLORS[action.toLowerCase()] : null;
              const isDeleted = parsedAction?.toLowerCase() === 'deleted';

              // Deleted items are never clickable (the item no longer exists)
              // For other items, check if we have related_id and related_type
              // Consultations are clickable if they have a conversation_id
              const isClickable = !isDeleted && (
                (log.related_id && log.related_type) ||
                (log.related_type === 'conversation' && log.conversation_id)
              );

              return (
                <div
                  key={log.id}
                  className={`mc-elegant-row ${isClickable ? '' : 'no-hover'} ${isDeleted ? 'deleted-item' : ''}`}
                  onClick={isClickable && onActivityClick ? () => onActivityClick(log) : undefined}
                  title={isDeleted ? 'This item has been deleted' : undefined}
                >
                  {/* Event type indicator */}
                  <div
                    className="mc-event-dot"
                    style={{ background: dotColor }}
                  />

                  {/* Main content */}
                  <div className="mc-elegant-content mc-activity-content-wrap">
                    <span className="mc-elegant-title">{cleanTitle}</span>
                    {/* Badges row: Type badge + Action badge */}
                    <div className="mc-activity-badges">
                      {/* Use promoted_to_type if available, else fall back to event_type */}
                      {log.promoted_to_type && PROMOTED_TYPE_LABELS[log.promoted_to_type] ? (
                        <span
                          className="mc-elegant-badge activity-type"
                          style={{
                            background: PROMOTED_TYPE_COLORS[log.promoted_to_type]?.bg || '#f1f5f9',
                            color: PROMOTED_TYPE_COLORS[log.promoted_to_type]?.text || '#64748b'
                          }}
                        >
                          {PROMOTED_TYPE_LABELS[log.promoted_to_type]}
                        </span>
                      ) : (
                        <span className="mc-elegant-badge activity-type" style={{ background: `${dotColor}20`, color: dotColor }}>
                          {EVENT_LABELS[log.event_type] || log.event_type}
                        </span>
                      )}
                      {action && actionColors && (
                        <span
                          className="mc-elegant-badge activity-action"
                          style={{ background: actionColors.bg, color: actionColors.text }}
                        >
                          {action}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Source link on hover */}
                  {log.conversation_id && onNavigateToConversation && (
                    <div className="mc-elegant-actions">
                      <button
                        className="mc-text-btn source"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToConversation(log.conversation_id, 'activity');
                        }}
                      >
                        View source
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Load more button */}
      {activityHasMore && (
        <div className="mc-load-more-container">
          <button
            className="mc-load-more-btn"
            onClick={onLoadMore}
            disabled={activityLoadingMore}
          >
            {activityLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
