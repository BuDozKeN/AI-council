/**
 * ActivityTab - Company activity log display
 *
 * Shows a timeline of company events grouped by date.
 * Extracted from MyCompany.jsx for better maintainability.
 */

import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDateGroup } from '../../../lib/dateUtils';
import { ScrollableContent } from '../../ui/ScrollableContent';

// Promoted types array for validation
const PROMOTED_TYPES = ['sop', 'framework', 'policy', 'project'] as const;
type PromotedType = (typeof PROMOTED_TYPES)[number];

// Type-safe translation key mapping for promoted types
const PROMOTED_TYPE_KEYS: Record<
  PromotedType,
  | 'mycompany.promotedType_sop'
  | 'mycompany.promotedType_framework'
  | 'mycompany.promotedType_policy'
  | 'mycompany.promotedType_project'
> = {
  sop: 'mycompany.promotedType_sop',
  framework: 'mycompany.promotedType_framework',
  policy: 'mycompany.promotedType_policy',
  project: 'mycompany.promotedType_project',
};

// Color mappings use CSS custom properties for dark mode support
const PROMOTED_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  sop: { bg: 'var(--color-indigo-50)', text: 'var(--color-indigo-700)' },
  framework: { bg: 'var(--color-blue-100)', text: 'var(--color-blue-600)' },
  policy: { bg: 'var(--color-violet-100)', text: 'var(--color-violet-600)' },
  project: { bg: 'var(--color-emerald-100)', text: 'var(--color-emerald-600)' },
};

const EVENT_COLORS: Record<string, string> = {
  decision: 'var(--color-green-500)',
  playbook: 'var(--color-blue-500)',
  project: 'var(--color-teal-500)',
  role: 'var(--color-violet-500)',
  department: 'var(--color-indigo-500)',
  council_session: 'var(--color-amber-500)',
  default: 'var(--color-slate-500)',
};

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  deleted: {
    bg: 'var(--color-red-50)',
    text: 'var(--color-red-600)',
    border: 'var(--color-red-200)',
  },
  promoted: {
    bg: 'var(--color-emerald-50)',
    text: 'var(--color-emerald-600)',
    border: 'var(--color-emerald-200)',
  },
  saved: {
    bg: 'var(--color-blue-50)',
    text: 'var(--color-blue-600)',
    border: 'var(--color-blue-200)',
  },
  created: {
    bg: 'var(--color-emerald-50)',
    text: 'var(--color-emerald-600)',
    border: 'var(--color-emerald-200)',
  },
  updated: {
    bg: 'var(--color-yellow-50)',
    text: 'var(--color-yellow-600)',
    border: 'var(--color-yellow-200)',
  },
  archived: {
    bg: 'var(--color-stone-100)',
    text: 'var(--color-stone-500)',
    border: 'var(--color-stone-300)',
  },
};

interface ActivityLog {
  id: string;
  event_type: string;
  created_at: string;
  title?: string;
  action?: string;
  promoted_to_type?: string;
  related_id?: string;
  related_type?: string;
  conversation_id?: string;
}

interface ActivityTabProps {
  activityLogs?: ActivityLog[] | undefined;
  activityLoaded?: boolean | undefined;
  activityHasMore?: boolean | undefined;
  activityLoadingMore?: boolean | undefined;
  onActivityClick?: ((log: ActivityLog) => void | Promise<void>) | undefined;
  onLoadMore?: (() => void) | undefined;
  onNavigateToConversation?: ((conversationId: string, source: string) => void) | undefined;
}

// Group logs by date (Today, Yesterday, or formatted date)
function groupLogsByDate(logs: ActivityLog[]): Record<string, ActivityLog[]> {
  return logs.reduce((groups: Record<string, ActivityLog[]>, log) => {
    const dateKey = formatDateGroup(log.created_at);
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
  onNavigateToConversation,
}: ActivityTabProps) {
  const { t } = useTranslation();

  // Only show empty state if data has been loaded (not during initial load)
  if (activityLogs.length === 0 && activityLoaded) {
    return (
      <div className="mc-empty">
        <motion.svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="mc-empty-icon-svg"
          style={{ marginBottom: '16px' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <defs>
            <linearGradient id="activityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-indigo-500)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--color-purple-500)" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Timeline vertical line */}
          <line
            x1="60"
            y1="25"
            x2="60"
            y2="95"
            stroke="var(--color-border)"
            strokeWidth="2"
            strokeDasharray="4,4"
            opacity="0.4"
          />

          {/* Activity nodes (empty/inactive) */}
          <circle cx="60" cy="35" r="8" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.5" opacity="0.5" />
          <circle cx="60" cy="35" r="3" fill="url(#activityGradient)" opacity="0.3" />

          <circle cx="60" cy="60" r="8" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.5" opacity="0.4" />
          <circle cx="60" cy="60" r="3" fill="url(#activityGradient)" opacity="0.2" />

          <circle cx="60" cy="85" r="8" fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth="1.5" opacity="0.3" />
          <circle cx="60" cy="85" r="3" fill="url(#activityGradient)" opacity="0.1" />

          {/* Peaceful moon/stars decoration */}
          <circle cx="85" cy="30" r="10" fill="url(#activityGradient)" opacity="0.2" />
          <path d="M 22 50 L 24 52 L 26 50 L 24 48 Z" fill="var(--color-indigo-400)" opacity="0.3" />
          <path d="M 95 70 L 97 72 L 99 70 L 97 68 Z" fill="var(--color-purple-400)" opacity="0.3" />
          <circle cx="30" cy="80" r="2" fill="var(--color-indigo-300)" opacity="0.4" />
        </motion.svg>

        <p className="mc-empty-title">{t('mycompany.allQuiet')}</p>
        <p className="mc-empty-hint">{t('mycompany.activityHelp')}</p>
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
        <span>{t('mycompany.eventsCount', { count: activityLogs.length })}</span>
      </div>

      <ScrollableContent className="mc-activity-list">
        {Object.entries(groupedLogs).map(([date, logs]) => (
          <div key={date} className="mc-activity-group">
            <h4 className="mc-group-title">{date}</h4>
            <div className="mc-elegant-list">
              {logs.map((log) => {
                const dotColor = EVENT_COLORS[log.event_type] || EVENT_COLORS.default;
                // Use explicit action column from database (no more title parsing)
                const action = log.promoted_to_type ? 'Promoted' : log.action;
                const actionColors = action ? ACTION_COLORS[action.toLowerCase()] : null;
                const isDeleted = log.action?.toLowerCase() === 'deleted';
                const cleanTitle = log.title;

                // Deleted items are never clickable (the item no longer exists)
                // For other items, check if we have related_id and related_type
                // Council sessions are clickable if they have a conversation_id
                const isClickable =
                  !isDeleted &&
                  ((log.related_id && log.related_type) ||
                    (log.related_type === 'conversation' && log.conversation_id) ||
                    (log.event_type === 'council_session' && log.conversation_id));

                return (
                  <div
                    key={log.id}
                    className={`mc-elegant-row ${isClickable ? '' : 'no-hover'} ${isDeleted ? 'deleted-item' : ''}`}
                    onClick={
                      isClickable && onActivityClick ? () => onActivityClick(log) : undefined
                    }
                    title={isDeleted ? 'This item has been deleted' : undefined}
                  >
                    {/* Event type indicator */}
                    <div className="mc-event-dot" style={{ background: dotColor }} />

                    {/* Main content */}
                    <div className="mc-elegant-content mc-activity-content-wrap">
                      <span className="mc-elegant-title">{cleanTitle}</span>
                      {/* Badges row: Type badge + Action badge */}
                      <div className="mc-activity-badges">
                        {/* Use promoted_to_type if available, else fall back to event_type */}
                        {log.promoted_to_type &&
                        PROMOTED_TYPES.includes(
                          log.promoted_to_type as (typeof PROMOTED_TYPES)[number]
                        ) ? (
                          <span
                            className="mc-elegant-badge activity-type"
                            style={{
                              background:
                                PROMOTED_TYPE_COLORS[log.promoted_to_type]?.bg ||
                                'var(--color-slate-100)',
                              color:
                                PROMOTED_TYPE_COLORS[log.promoted_to_type]?.text ||
                                'var(--color-slate-500)',
                            }}
                          >
                            {t(
                              PROMOTED_TYPE_KEYS[log.promoted_to_type as PromotedType] ??
                                'mycompany.promotedType_sop'
                            )}
                          </span>
                        ) : (
                          <span
                            className="mc-elegant-badge activity-type"
                            style={{ background: `${dotColor}20`, color: dotColor }}
                          >
                            {t(`mycompany.eventType_${log.event_type}`, {
                              defaultValue: log.event_type,
                            })}
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

                    {/* Source link - compact icon */}
                    {log.conversation_id && onNavigateToConversation && (
                      <button
                        className="mc-source-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToConversation(log.conversation_id!, 'activity');
                        }}
                        title={t('mycompany.viewSourceConversation')}
                        aria-label={t('mycompany.viewSourceConversation')}
                      >
                        <ExternalLink size={16} />
                      </button>
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
              {activityLoadingMore ? t('mycompany.loading') : t('mycompany.loadMoreActivity')}
            </button>
          </div>
        )}
      </ScrollableContent>
    </div>
  );
}
