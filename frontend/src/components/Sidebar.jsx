import { useState, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { Spinner } from './ui/Spinner';
import { Plus } from 'lucide-react';
import {
  useMockMode,
  useCachingMode,
  SearchBar,
  FilterSortBar,
  ConversationGroup,
  SidebarFooter,
  BulkActionBar,
  DeleteModal
} from './sidebar/index.jsx';
import { usePullToRefresh } from '../hooks';
import { PullToRefreshIndicator } from './ui/PullToRefresh';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenMyCompany,
  onExportConversation,
  onArchiveConversation,
  onStarConversation,
  onDeleteConversation,
  onBulkDeleteConversations,
  onRenameConversation,
  onLoadMore,
  onSearch,
  hasMoreConversations = true,
  departments = [],
  user,
  onSignOut,
  sortBy = 'date',
  onSortByChange,
  isMobileOpen = false,
  onMobileClose,
  onRefresh,
}) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Mode toggles
  const { mockMode, isToggling: isTogglingMock, toggle: toggleMockMode } = useMockMode();
  const { cachingMode, isToggling: isTogglingCaching, toggle: toggleCachingMode } = useCachingMode();

  // Pull to refresh (mobile only)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const {
    ref: pullToRefreshRef,
    pullDistance,
    isRefreshing,
    progress,
  } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    maxPull: 120,
    enabled: isMobile && !!onRefresh,
  });

  // Edit handlers
  const handleStartEdit = (conv, e) => {
    if (e) e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || 'New Conversation');
  };

  const handleSaveEdit = async () => {
    if (editingId && editingTitle.trim()) {
      await onRenameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  // Search handlers
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (onSearch && value.trim()) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        await onSearch(value.trim());
        setIsSearching(false);
      }, 500);
    } else if (onSearch && !value.trim()) {
      onSearch('');
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    if (onSearch) onSearch('');
  };

  // Load more
  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore(conversations.length, searchQuery);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Multi-select handlers
  const toggleSelection = (convId, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        newSet.delete(convId);
      } else {
        newSet.add(convId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      await onBulkDeleteConversations(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Separate active and archived conversations
  const { activeConversations, archivedConversations } = useMemo(() => {
    const active = conversations.filter(conv => !conv.is_archived);
    const archived = conversations.filter(conv => conv.is_archived);
    return { activeConversations: active, archivedConversations: archived };
  }, [conversations]);

  // Filter conversations by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return { active: activeConversations, archived: archivedConversations };
    }
    const query = searchQuery.toLowerCase();
    const matchesSearch = (conv) =>
      conv.title?.toLowerCase().includes(query) ||
      conv.department?.toLowerCase().includes(query);
    return {
      active: activeConversations.filter(matchesSearch),
      archived: archivedConversations.filter(matchesSearch),
    };
  }, [activeConversations, archivedConversations, searchQuery]);

  // Group conversations by department
  const groupedConversations = useMemo(() => {
    const groups = {};
    const convsToGroup = filter === 'archived' ? filteredBySearch.archived : filteredBySearch.active;

    departments.forEach(dept => {
      groups[dept.id] = { name: dept.name, conversations: [] };
    });

    if (!groups['standard']) {
      groups['standard'] = { name: 'Standard', conversations: [] };
    }

    convsToGroup.forEach(conv => {
      const dept = conv.department || 'standard';
      if (!groups[dept]) {
        groups[dept] = { name: dept.charAt(0).toUpperCase() + dept.slice(1), conversations: [] };
      }
      groups[dept].conversations.push(conv);
    });

    return groups;
  }, [filteredBySearch, departments, filter]);

  // Filter groups based on selected filter
  const filteredGroups = useMemo(() => {
    if (filter === 'all' || filter === 'archived') {
      return groupedConversations;
    }
    return { [filter]: groupedConversations[filter] };
  }, [groupedConversations, filter]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isExpanded = (groupId) => {
    if (expandedGroups[groupId] !== undefined) {
      return expandedGroups[groupId];
    }
    return groupedConversations[groupId]?.conversations.length > 0;
  };

  const totalConversations = conversations.length;
  const searchResultCount = filteredBySearch.active.length + filteredBySearch.archived.length;

  return (
    <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Conversation history">
      {/* Mobile close button */}
      <div className="sidebar-mobile-close">
        <button onClick={onMobileClose} aria-label="Close menu">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="sidebar-header">
        <Button
          onClick={onNewConversation}
          className="w-full h-9 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Chat
        </Button>
      </div>

      {/* Search Input */}
      {(totalConversations > 0 || searchQuery) && (
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onClear={handleSearchClear}
          isSearching={isSearching}
          resultCount={searchResultCount}
        />
      )}

      {/* Filter and Sort Dropdowns */}
      {(totalConversations > 0 || searchQuery) && (
        <FilterSortBar
          filter={filter}
          onFilterChange={setFilter}
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          departments={departments}
          groupedConversations={groupedConversations}
          activeCount={filteredBySearch.active.length}
          archivedCount={filteredBySearch.archived.length}
        />
      )}

      <div className="conversation-list" ref={pullToRefreshRef} style={{ position: 'relative' }}>
        {/* Pull to refresh indicator (mobile) */}
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          threshold={80}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        {searchQuery && searchResultCount === 0 ? (
          <div className="no-conversations">
            <span className="no-conv-icon">🔍</span>
            No results for "{searchQuery}"
          </div>
        ) : totalConversations === 0 ? (
          <div className="no-conversations">
            <span className="no-conv-icon">💬</span>
            <span>No conversations yet</span>
            <span className="no-conv-hint">Click "New" to start</span>
          </div>
        ) : filter === 'archived' && filteredBySearch.archived.length === 0 ? (
          <div className="no-conversations">
            <span className="no-conv-icon">📦</span>
            No archived conversations
          </div>
        ) : filter !== 'archived' && filteredBySearch.active.length === 0 ? (
          <div className="no-conversations">No active conversations</div>
        ) : (
          Object.entries(filteredGroups).map(([groupId, group]) => (
            <ConversationGroup
              key={groupId}
              groupId={groupId}
              groupName={group?.name}
              conversations={group?.conversations || []}
              isExpanded={isExpanded(groupId)}
              onToggleExpand={toggleGroup}
              currentConversationId={currentConversationId}
              selectedIds={selectedIds}
              editingId={editingId}
              editingTitle={editingTitle}
              onSelectConversation={onSelectConversation}
              onStartEdit={handleStartEdit}
              onEditTitleChange={setEditingTitle}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onToggleSelection={toggleSelection}
              onStarConversation={onStarConversation}
              onArchiveConversation={onArchiveConversation}
              onDeleteConversation={setDeleteConfirm}
            />
          ))
        )}

        {/* Load More Button */}
        {onLoadMore && hasMoreConversations && totalConversations > 0 && !searchQuery && (
          <button
            className="load-more-btn"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Spinner size="sm" variant="muted" />
                Loading...
              </>
            ) : (
              'Load More Conversations'
            )}
          </button>
        )}
      </div>

      {/* Multi-select action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        isDeleting={isDeleting}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
      />

      {/* User Footer */}
      <SidebarFooter
        user={user}
        mockMode={mockMode}
        isTogglingMock={isTogglingMock}
        onToggleMockMode={toggleMockMode}
        cachingMode={cachingMode}
        isTogglingCaching={isTogglingCaching}
        onToggleCachingMode={toggleCachingMode}
        onOpenMyCompany={onOpenMyCompany}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          onDeleteConversation(deleteConfirm);
          setDeleteConfirm(null);
        }}
      />
    </aside>
  );
}
