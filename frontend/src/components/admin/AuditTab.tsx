/**
 * AuditTab - Platform audit logs viewer
 *
 * Extracted from AdminPortal.tsx during CRITICAL-2 split.
 */

import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Activity, Clock, Shield, Users, Eye } from 'lucide-react';
import { getIntlLocale } from '../../i18n';
import { api } from '../../api';
import type { AdminAuditLog } from '../../api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip } from '../ui/Tooltip';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { SkeletonCell, SkeletonBadge, Pagination } from './adminUtils';
import { formatActionName } from './adminConstants';

// =============================================================================
// Skeleton
// =============================================================================

const AuditTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell short />
        <SkeletonCell />
        <SkeletonCell />
        <SkeletonBadge />
        <SkeletonCell short />
        <SkeletonCell short />
      </tr>
    ))}
  </>
);

// =============================================================================
// DUMMY DATA
// =============================================================================

const DUMMY_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'demo-audit-1',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-admin-1',
    actor_email: 'ozpaniard+admin@gmail.com',
    actor_type: 'admin',
    action: 'User invitation sent',
    action_category: 'user',
    resource_type: 'invitation',
    resource_id: 'demo-inv-1',
    resource_name: 'ozpaniard+newuser@gmail.com',
    company_id: null,
    ip_address: '192.168.1.100',
    metadata: null,
  },
  {
    id: 'demo-audit-2',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-1',
    actor_email: 'ozpaniard+alice@gmail.com',
    actor_type: 'user',
    action: 'Company settings updated',
    action_category: 'company',
    resource_type: 'company',
    resource_id: 'demo-company-1',
    resource_name: 'TechCorp Solutions',
    company_id: 'demo-company-1',
    ip_address: '10.0.0.42',
    metadata: null,
  },
  {
    id: 'demo-audit-3',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    actor_id: null,
    actor_email: null,
    actor_type: 'system',
    action: 'Daily backup completed',
    action_category: 'data',
    resource_type: 'backup',
    resource_id: null,
    resource_name: null,
    company_id: null,
    ip_address: null,
    metadata: null,
  },
  {
    id: 'demo-audit-4',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-user-2',
    actor_email: 'ozpaniard+bob@gmail.com',
    actor_type: 'user',
    action: 'User logged in',
    action_category: 'auth',
    resource_type: 'session',
    resource_id: 'demo-session-1',
    resource_name: null,
    company_id: 'demo-company-2',
    ip_address: '203.45.67.89',
    metadata: null,
  },
  {
    id: 'demo-audit-5',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-admin-2',
    actor_email: 'ozpaniard+superadmin@gmail.com',
    actor_type: 'admin',
    action: 'Admin role granted',
    action_category: 'admin',
    resource_type: 'admin_role',
    resource_id: 'demo-admin-3',
    resource_name: 'ozpaniard+support@gmail.com',
    company_id: null,
    ip_address: '172.16.0.1',
    metadata: null,
  },
  {
    id: 'demo-audit-6',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    actor_id: null,
    actor_email: 'ozpaniard+api@gmail.com',
    actor_type: 'api',
    action: 'API rate limit exceeded',
    action_category: 'security',
    resource_type: 'api_key',
    resource_id: 'demo-key-1',
    resource_name: 'Production API Key',
    company_id: 'demo-company-3',
    ip_address: '52.14.128.73',
    metadata: null,
  },
  {
    id: 'demo-audit-7',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-admin-1',
    actor_email: 'ozpaniard+admin@gmail.com',
    actor_type: 'admin',
    action: 'Started user impersonation',
    action_category: 'security',
    resource_type: 'user',
    resource_id: 'demo-user-1',
    resource_name: 'ozpaniard+alice@gmail.com',
    company_id: null,
    ip_address: '192.168.1.100',
    metadata: { reason: 'Investigating billing issue reported by customer in ticket #4521' },
  },
  {
    id: 'demo-audit-8',
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    actor_id: 'demo-admin-1',
    actor_email: 'ozpaniard+admin@gmail.com',
    actor_type: 'admin',
    action: 'Ended user impersonation',
    action_category: 'security',
    resource_type: 'user',
    resource_id: 'demo-user-1',
    resource_name: 'ozpaniard+alice@gmail.com',
    company_id: null,
    ip_address: '192.168.1.100',
    metadata: {
      reason: 'Investigating billing issue reported by customer in ticket #4521',
      ended_reason: 'manual',
    },
  },
];

// =============================================================================
// Component
// =============================================================================

export function AuditTab() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionCategory, setActionCategory] = useState<string>('');
  const [actorType, setActorType] = useState<string>('');
  const pageSize = 20;

  // Sort state for audit logs table
  type AuditSortColumn = 'timestamp' | 'actor' | 'category';
  const [auditSortState, setAuditSortState] = useSortState<AuditSortColumn>('timestamp', 'desc');

  // Fetch audit categories for filter dropdowns
  const { data: categories } = useQuery({
    queryKey: ['admin', 'audit', 'categories'],
    queryFn: () => api.getAdminAuditCategories(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch audit logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit', { page, search, actionCategory, actorType }],
    queryFn: () =>
      api.listAdminAuditLogs({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
        ...(actionCategory ? { action_category: actionCategory } : {}),
        ...(actorType ? { actor_type: actorType } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiLogs = data?.logs ?? [];
  const useDummyData = error || (apiLogs.length === 0 && !isLoading);

  // Filter dummy data based on search, category, and actor type
  const filteredDummyData = useDummyData
    ? DUMMY_AUDIT_LOGS.filter((log) => {
        const matchesSearch =
          !search ||
          log.action.toLowerCase().includes(search.toLowerCase()) ||
          (log.actor_email && log.actor_email.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = !actionCategory || log.action_category === actionCategory;
        const matchesActorType = !actorType || log.actor_type === actorType;
        return matchesSearch && matchesCategory && matchesActorType;
      })
    : [];

  // Apply sorting
  const auditSortGetters: Record<AuditSortColumn, (l: AdminAuditLog) => string | number | null> = {
    timestamp: (l) => new Date(l.timestamp).getTime(),
    actor: (l) => l.actor_email?.toLowerCase() ?? l.actor_type,
    category: (l) => l.action_category,
  };

  const unsortedLogs = useDummyData ? filteredDummyData : apiLogs;
  const logs = sortData(unsortedLogs, auditSortState, auditSortGetters);
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Keyboard navigation for audit logs table
  const { tableBodyRef: auditTableBodyRef, getRowProps: getAuditRowProps } = useTableKeyboardNav({
    rowCount: logs.length,
  });

  // UXH-220: Compact timestamp — time-only for today/yesterday (date headers provide context),
  // short date+time for older entries (drop year when current year)
  const formatTimestamp = (ts: string): string => {
    try {
      const date = new Date(ts);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      if (isToday || isYesterday) {
        return date.toLocaleTimeString(getIntlLocale(), {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const sameYear = date.getFullYear() === now.getFullYear();
      return date.toLocaleString(getIntlLocale(), {
        ...(sameYear ? {} : { year: 'numeric' }),
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  // UXH-183: Format date label for group headers (Today, Yesterday, or date)
  const formatDateLabel = (ts: string): string => {
    try {
      const date = new Date(ts);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateStr = date.toDateString();
      if (dateStr === today.toDateString()) return t('admin.audit.today', 'Today');
      if (dateStr === yesterday.toDateString()) return t('admin.audit.yesterday', 'Yesterday');
      return date.toLocaleDateString(getIntlLocale(), {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // UXH-183: Get date key for grouping (YYYY-MM-DD)
  const getDateKey = (ts: string): string => {
    try {
      return new Date(ts).toDateString();
    } catch {
      return '';
    }
  };

  // Get badge color based on action category
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      auth: 'blue',
      user: 'green',
      company: 'purple',
      admin: 'orange',
      data: 'cyan',
      api: 'yellow',
      billing: 'pink',
      security: 'red',
    };
    return colors[category] || 'gray';
  };

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.audit.title', 'Audit Logs')}</h2>
          <p className="admin-section-desc">
            {t('admin.audit.description', 'View platform-wide activity and security logs.')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <div className="admin-search-box">
          <Search className="admin-search-icon h-4 w-4" />
          <input
            type="text"
            placeholder={t('admin.audit.searchPlaceholder', 'Search actions...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-search-input"
          />
        </div>

        {/* Filter dropdowns - hidden on mobile */}
        <div className="admin-audit-filters">
          <Select
            value={actionCategory || 'all'}
            onValueChange={(value) => {
              setActionCategory(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="admin-select-trigger">
              <SelectValue placeholder={t('admin.audit.allCategories', 'All Categories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('admin.audit.allCategories', 'All Categories')}
              </SelectItem>
              {categories?.action_categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={actorType || 'all'}
            onValueChange={(value) => {
              setActorType(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="admin-select-trigger">
              <SelectValue placeholder={t('admin.audit.allActors', 'All Actor Types')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.audit.allActors', 'All Actor Types')}</SelectItem>
              {categories?.actor_types.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isLoading && logs.length === 0 ? (
        <div className="admin-table-empty">
          <Activity className="h-8 w-8" />
          <span>{t('admin.audit.noLogs', 'No audit logs found')}</span>
          <p className="admin-empty-hint">
            {t(
              'admin.audit.noLogsHint',
              'Audit logs will appear as platform actions are recorded.'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table
              className="admin-table admin-table--audit"
              aria-label={t('admin.audit.title', 'Audit Logs')}
            >
              <caption className="sr-only">
                {t(
                  'admin.audit.tableCaption',
                  'Platform audit logs showing all administrative actions, timestamps, actors, and affected resources'
                )}
              </caption>
              <thead>
                <tr>
                  <SortableTableHeader
                    column="timestamp"
                    label={t('admin.audit.timestamp', 'Timestamp')}
                    sortState={auditSortState}
                    onSort={setAuditSortState}
                  />
                  <SortableTableHeader
                    column="actor"
                    label={t('admin.audit.actor', 'Actor')}
                    sortState={auditSortState}
                    onSort={setAuditSortState}
                  />
                  <th>{t('admin.audit.action', 'Action')}</th>
                  <SortableTableHeader
                    column="category"
                    label={t('admin.audit.category', 'Category')}
                    sortState={auditSortState}
                    onSort={setAuditSortState}
                  />
                  <th>{t('admin.audit.resource', 'Resource')}</th>
                  <th className="admin-audit-ip-col">{t('admin.audit.ip', 'IP')}</th>
                </tr>
              </thead>
              <tbody ref={auditTableBodyRef}>
                {isLoading ? (
                  <AuditTableSkeleton />
                ) : (
                  logs.map((log, rowIndex) => {
                    // UXH-183: Insert date group header when date changes
                    const prevLog = rowIndex > 0 ? logs[rowIndex - 1] : null;
                    const showDateHeader =
                      !prevLog || getDateKey(log.timestamp) !== getDateKey(prevLog.timestamp);

                    return (
                      <Fragment key={log.id}>
                        {showDateHeader && (
                          <tr className="admin-date-group-header" aria-label={formatDateLabel(log.timestamp)}>
                            <td colSpan={6}>
                              <span className="admin-date-group-label">
                                {formatDateLabel(log.timestamp)}
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr
                          className={useDummyData ? 'admin-demo-row' : ''}
                          {...getAuditRowProps(rowIndex)}
                      aria-label={`${formatTimestamp(log.timestamp)}: ${log.actor_email || log.actor_type} (${log.actor_type}) performed ${formatActionName(log.action)}${log.resource_type ? ` on ${log.resource_type}${log.resource_name ? ` - ${log.resource_name}` : ''}` : ''}, Category: ${log.action_category}, IP: ${log.ip_address || 'Unknown'}`}
                    >
                      <td>
                        <div className="admin-date-cell">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          {log.actor_type === 'admin' ? (
                            <Shield className="h-4 w-4" aria-hidden="true" />
                          ) : log.actor_type === 'system' ? (
                            <Activity className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Users className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span title={log.actor_email || undefined}>
                            {log.actor_email || log.actor_type}
                          </span>
                        </div>
                      </td>
                      <td>
                        {/* Show tooltip with reason for impersonation actions */}
                        {log.metadata?.reason ? (
                          <Tooltip
                            content={
                              <div className="admin-audit-reason-tooltip">
                                <strong>{t('admin.audit.reason', 'Reason')}:</strong>
                                <p>{String(log.metadata.reason)}</p>
                              </div>
                            }
                            side="top"
                          >
                            <span className="admin-action-text admin-action-text--has-reason">
                              {formatActionName(log.action)}
                              <Eye className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="admin-action-text">{formatActionName(log.action)}</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-category-badge admin-category-badge--${getCategoryColor(log.action_category)}`}
                        >
                          {log.action_category}
                        </span>
                      </td>
                      <td>
                        {log.resource_type ? (
                          <div className="admin-resource-cell">
                            <span className="admin-resource-type">{log.resource_type}</span>
                            {log.resource_name && (
                              <span className="admin-resource-name">{log.resource_name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="admin-muted">-</span>
                        )}
                      </td>
                      <td className="admin-audit-ip-col">
                        <span className="admin-ip-text">{log.ip_address || '-'}</span>
                      </td>
                    </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
