/**
 * FilterSortBar - Filter and sort dropdowns
 *
 * Extracted from Sidebar.jsx for better maintainability.
 * Uses the compact Select variant for dense sidebar UI.
 *
 * Note: Filter values use department slugs (e.g., "technology", "standard")
 * because conversations store department as a slug, not a UUID.
 */

import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { makeClickable } from '../../utils/a11y';
import type { Department } from '../../types/business';
import type { Conversation, ConversationSortBy } from '../../types/conversation';

interface ConversationGroup {
  conversations: Conversation[];
}

interface FilterSortBarProps {
  filter: string;
  onFilterChange: (value: string) => void;
  sortBy: ConversationSortBy;
  onSortByChange: (value: ConversationSortBy) => void;
  departments?: Department[];
  groupedConversations?: Record<string, ConversationGroup>;
  activeCount?: number;
  archivedCount?: number;
}

export function FilterSortBar({
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  departments = [],
  groupedConversations = {},
  activeCount = 0,
  archivedCount = 0,
}: FilterSortBarProps) {
  const { t } = useTranslation();
  return (
    <div className="sidebar-filter" {...makeClickable((e) => e.stopPropagation())}>
      {/* ISS-105: title attribute shows full text on hover when truncated */}
      <Select value={filter} onValueChange={onFilterChange}>
        <SelectTrigger
          variant="compact"
          className="filter-select-trigger"
          title={
            filter === 'all'
              ? t('sidebar.allConversationsCount', { count: activeCount })
              : undefined
          }
        >
          <SelectValue placeholder={t('sidebar.allConversations')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {t('sidebar.allConversationsCount', { count: activeCount })}
          </SelectItem>
          {departments.map((dept) => {
            // Use slug for grouping key (conversations store department as slug)
            const deptKey = dept.slug || dept.id;
            const deptCount = groupedConversations[deptKey]?.conversations.length || 0;
            return (
              <SelectItem key={dept.id} value={deptKey}>
                {t('sidebar.departmentCount', { name: dept.name, count: deptCount })}
              </SelectItem>
            );
          })}
          {archivedCount > 0 && (
            <SelectItem value="archived">
              {t('sidebar.archivedCount', { count: archivedCount })}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger
          variant="compact"
          className="sort-select-trigger"
          title={t('sidebar.sortConversations')}
        >
          <SelectValue placeholder={t('sidebar.sortLatest')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">{t('sidebar.sortLatest')}</SelectItem>
          <SelectItem value="activity">{t('sidebar.sortActive')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
