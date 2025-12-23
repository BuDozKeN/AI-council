/**
 * FilterSortBar - Filter and sort dropdowns
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function FilterSortBar({
  filter,
  onFilterChange,
  sortBy,
  onSortByChange,
  departments = [],
  groupedConversations = {},
  activeCount = 0,
  archivedCount = 0
}) {
  return (
    <div className="sidebar-filter">
      <Select value={filter} onValueChange={onFilterChange}>
        <SelectTrigger className="filter-select-trigger">
          <SelectValue placeholder="All Conversations" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Conversations ({activeCount})</SelectItem>
          {departments.map(dept => {
            const deptCount = groupedConversations[dept.id]?.conversations.length || 0;
            return (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name} ({deptCount})
              </SelectItem>
            );
          })}
          {archivedCount > 0 && (
            <SelectItem value="archived">Archived ({archivedCount})</SelectItem>
          )}
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="sort-select-trigger" title="Sort conversations">
          <SelectValue placeholder="Latest" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">Latest</SelectItem>
          <SelectItem value="activity">Active</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
