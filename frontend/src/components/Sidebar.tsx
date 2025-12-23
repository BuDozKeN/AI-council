import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Spinner } from './ui/Spinner';
import { Plus, PanelLeftClose, PanelLeft, History, Search, Settings, Building2, LogOut, Trophy } from 'lucide-react';
import {
  useMockMode,
  useCachingMode,
  useHoverExpansion,
  SearchBar,
  FilterSortBar,
  ConversationGroup,
  VirtualizedConversationList,
  SidebarFooter,
  BulkActionBar,
  SidebarIconButton,
  ConversationContextMenu,
  useContextMenu,
} from './sidebar/index.jsx';
import { ConversationSkeletonGroup } from './ui/Skeleton';
import { usePullToRefresh, useKeyboardShortcuts, useListNavigation, useDragAndDrop } from '../hooks';
import { PullToRefreshIndicator } from './ui/PullToRefresh';
import { toast } from './ui/sonner';
import { api } from '../api';
import { logger } from '../utils/logger';
import './Sidebar.css';

/**
 * Perplexity-style collapsible sidebar with three states:
 * - collapsed: 64px icon rail
 * - hovered: temporarily expanded on hover
 * - pinned: permanently expanded
 */
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
  isLoading = false, // New prop for initial loading state
  onUpdateConversationDepartment, // Optional callback for department changes
}) {
  // Sidebar state: 'collapsed' | 'hovered' | 'pinned'
  const [sidebarState, setSidebarState] = useState(() => {
    // Load saved preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-pinned');
      return saved === 'true' ? 'pinned' : 'collapsed';
    }
    return 'collapsed';
  });

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  // Note: deleteConfirm modal removed - optimistic delete with undo toast is used instead
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [focusedConversationId, setFocusedConversationId] = useState(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const sidebarRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Context menu for right-click actions
  const contextMenu = useContextMenu();

  // Drag and drop for moving conversations between departments
  const handleDragDrop = useCallback(async (conversationId, targetDepartment, conversation) => {
    // Optimistically update UI (parent will handle via callback)
    if (onUpdateConversationDepartment) {
      onUpdateConversationDepartment(conversationId, targetDepartment);
    }

    // Persist to backend
    try {
      await api.updateConversationDepartment(conversationId, targetDepartment);
      toast.success(`Moved to ${targetDepartment}`);
    } catch (error) {
      logger.error('Failed to update department:', error);
      toast.error('Failed to move conversation');
      // Revert optimistic update
      if (onUpdateConversationDepartment && conversation.department) {
        onUpdateConversationDepartment(conversationId, conversation.department);
      }
    }
  }, [onUpdateConversationDepartment]);

  const {
    draggedItem,
    dragOverTarget,
    isDragging: _isDragging, // Reserved for future drag state indication
    getDragHandlers,
    getDropHandlers,
  } = useDragAndDrop({ onDrop: handleDragDrop });

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Mode toggles
  const { mockMode, isToggling: isTogglingMock, toggle: toggleMockMode } = useMockMode();
  const { cachingMode, isToggling: isTogglingCaching, toggle: toggleCachingMode } = useCachingMode();

  // Derived state
  const isPinned = sidebarState === 'pinned';

  // Hover expansion behavior (uses CSS tokens for timing)
  const {
    hoveredIcon,
    handleIconHover,
    handleIconLeave,
    handleExpandedAreaEnter,
    handleExpandedAreaLeave,
  } = useHoverExpansion({ isPinned });

  // Derived state - mobile open always shows expanded content
  const isExpanded = isPinned || hoveredIcon !== null || isMobileOpen;

  // Toggle pin state
  const togglePin = useCallback(() => {
    const newState = isPinned ? 'collapsed' : 'pinned';
    setSidebarState(newState);

    // Save preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-pinned', newState === 'pinned' ? 'true' : 'false');
    }
  }, [isPinned]);


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
      }, 300); // Reduced from 500ms for snappier feel
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
      logger.error('Bulk delete failed:', error);
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

  // Flat list of all visible conversations for keyboard navigation
  const flatConversationList = useMemo(() => {
    const list = [];
    const convsToShow = filter === 'archived' ? filteredBySearch.archived : filteredBySearch.active;
    convsToShow.forEach(conv => list.push(conv));
    return list;
  }, [filter, filteredBySearch]);

  // List navigation for keyboard support
  const {
    getFocusedId,
    navigateUp,
    navigateDown,
    selectCurrent,
  } = useListNavigation({
    items: flatConversationList,
    currentId: currentConversationId,
    onSelect: onSelectConversation,
    enabled: isExpanded && !editingId,
  });

  // Update focused ID when navigating
  useEffect(() => {
    const focusedId = getFocusedId();
    setFocusedConversationId(focusedId);
  }, [getFocusedId]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onFocusSearch: useCallback(() => {
      searchInputRef.current?.focus();
    }, []),
    onNewConversation,
    onNavigateUp: navigateUp,
    onNavigateDown: navigateDown,
    onSelectCurrent: selectCurrent,
    onDeleteCurrent: useCallback(() => {
      const focusedId = getFocusedId();
      if (focusedId) {
        onDeleteConversation(focusedId);
      }
    }, [getFocusedId, onDeleteConversation]),
    onEscape: useCallback(() => {
      if (searchQuery) {
        setSearchQuery('');
        if (onSearch) onSearch('');
      } else if (isMobileOpen && onMobileClose) {
        onMobileClose();
      }
    }, [searchQuery, onSearch, isMobileOpen, onMobileClose]),
    enabled: isExpanded,
  });

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

  const isGroupExpanded = (groupId) => {
    if (expandedGroups[groupId] !== undefined) {
      return expandedGroups[groupId];
    }
    return groupedConversations[groupId]?.conversations.length > 0;
  };

  const totalConversations = conversations.length;
  const searchResultCount = filteredBySearch.active.length + filteredBySearch.archived.length;

  // Use virtualization for large lists (> 20 conversations for consistency)
  const useVirtualization = totalConversations > 20;
  const listContainerRef = useRef(null);
  const [listHeight, setListHeight] = useState(400);

  // Update list height when container resizes
  useEffect(() => {
    if (!useVirtualization || !listContainerRef.current) return;

    const updateHeight = () => {
      if (listContainerRef.current) {
        setListHeight(listContainerRef.current.clientHeight);
      }
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(listContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [useVirtualization]);

  // Infinite scroll - auto-load more when reaching bottom
  useEffect(() => {
    if (!loadMoreRef.current || !onLoadMore || !hasMoreConversations || isLoadingMore || searchQuery) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleLoadMore is stable within observer
  }, [onLoadMore, hasMoreConversations, isLoadingMore, searchQuery]);

  // Determine visual state for CSS
  const visualState = isPinned ? 'pinned' : (hoveredIcon ? 'hovered' : 'collapsed');

  // Build sidebar CSS classes
  const sidebarClasses = [
    'sidebar',
    `sidebar--${visualState}`,
    isMobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside
      ref={sidebarRef}
      className={sidebarClasses}
      aria-label="Conversation history"
    >
      {/* Header with New Chat and Pin toggle */}
      <div className="sidebar-header">
        {isExpanded ? (
          <>
            <Button
              onClick={onNewConversation}
              className="sidebar-new-btn"
            >
              <Plus className="h-4 w-4" />
              <span className="sidebar-btn-text">New Chat</span>
            </Button>
            <button
              onClick={togglePin}
              className="sidebar-pin-btn"
              title={isPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
              aria-label={isPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
            >
              {isPinned ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>
          </>
        ) : (
          <SidebarIconButton
            icon={<Plus className="h-5 w-5" />}
            title="New Chat"
            onClick={onNewConversation}
            isPrimary
          />
        )}
      </div>

      {/* Main content area - uses flex layout */}
      <div className="sidebar-main">
        {/* Icon rail - always visible when not pinned */}
        {!isPinned && (
          <div
            className="sidebar-icon-rail"
            onMouseEnter={handleExpandedAreaEnter}
            onMouseLeave={handleExpandedAreaLeave}
          >
            {/* History - hover to see conversations */}
            <SidebarIconButton
              icon={<History className="h-5 w-5" />}
              title={`History (${totalConversations})`}
              onClick={togglePin}
              onMouseEnter={() => totalConversations > 0 && handleIconHover('history')}
              onMouseLeave={handleIconLeave}
              isActive={hoveredIcon === 'history'}
              disabled={totalConversations === 0}
              badge={totalConversations > 0 ? totalConversations : undefined}
            />

            {/* Leaderboard - if available */}
            {onOpenLeaderboard && (
              <SidebarIconButton
                icon={<Trophy className="h-5 w-5" />}
                title="Leaderboard"
                onClick={onOpenLeaderboard}
              />
            )}
          </div>
        )}

        {/* Expanded panel - slides out on hover or when pinned */}
        {isExpanded && (
          <div
            className="sidebar-expanded-panel"
            onMouseEnter={handleExpandedAreaEnter}
            onMouseLeave={handleExpandedAreaLeave}
          >
            {/* Search and Filter controls */}
            {(totalConversations > 0 || searchQuery) && (
              <div className="sidebar-panel-controls">
                <SearchBar
                  ref={searchInputRef}
                  searchQuery={searchQuery}
                  onSearchChange={handleSearchChange}
                  onClear={handleSearchClear}
                  isSearching={isSearching}
                  resultCount={searchResultCount}
                />
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
              </div>
            )}

            {/* Pull to refresh indicator (mobile) */}
            <PullToRefreshIndicator
              pullDistance={pullDistance}
              threshold={80}
              isRefreshing={isRefreshing}
              progress={progress}
            />

            {/* Conversation List */}
            <div className="conversation-list" ref={(el) => { pullToRefreshRef.current = el; listContainerRef.current = el; }}>
              {/* Skeleton loading state */}
              {isLoading && totalConversations === 0 ? (
                <ConversationSkeletonGroup count={5} />
              ) : searchQuery && searchResultCount === 0 ? (
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
              ) : useVirtualization ? (
                <VirtualizedConversationList
                  filteredGroups={filteredGroups}
                  expandedGroups={expandedGroups}
                  groupedConversations={groupedConversations}
                  currentConversationId={currentConversationId}
                  focusedConversationId={focusedConversationId}
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
                  onDeleteConversation={onDeleteConversation}
                  onToggleGroup={toggleGroup}
                  onContextMenu={contextMenu.open}
                  height={listHeight}
                />
              ) : (
                Object.entries(filteredGroups).map(([groupId, group]) => (
                  <ConversationGroup
                    key={groupId}
                    groupId={groupId}
                    groupName={group?.name}
                    conversations={group?.conversations || []}
                    isExpanded={isGroupExpanded(groupId)}
                    onToggleExpand={toggleGroup}
                    currentConversationId={currentConversationId}
                    focusedConversationId={focusedConversationId}
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
                    onDeleteConversation={onDeleteConversation}
                    onContextMenu={contextMenu.open}
                    // Drag and drop props
                    dropHandlers={getDropHandlers(groupId)}
                    isDropTarget={dragOverTarget === groupId}
                    getDragHandlers={getDragHandlers}
                    draggedItemId={draggedItem?.id}
                  />
                ))
              )}

              {/* Infinite scroll trigger - replaces Load More button */}
              {onLoadMore && hasMoreConversations && totalConversations > 0 && !searchQuery && (
                <div ref={loadMoreRef} className="load-more-trigger">
                  {isLoadingMore && (
                    <div className="load-more-spinner">
                      <Spinner size="sm" variant="muted" />
                      <span>Loading more...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multi-select action bar */}
      {isExpanded && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          isDeleting={isDeleting}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
        />
      )}

      {/* Footer with user info and actions */}
      {isExpanded ? (
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
          onMouseEnter={handleExpandedAreaEnter}
          onMouseLeave={handleExpandedAreaLeave}
        />
      ) : (
        // Collapsed footer - icon buttons only
        // Keep expanded when hovering over footer icons
        <div
          className="sidebar-footer sidebar-footer--collapsed"
          onMouseEnter={handleExpandedAreaEnter}
          onMouseLeave={handleExpandedAreaLeave}
        >
          <SidebarIconButton
            icon={<Building2 className="h-4 w-4" />}
            title="My Company"
            onClick={onOpenMyCompany}
          />
          <SidebarIconButton
            icon={<Settings className="h-4 w-4" />}
            title="Settings"
            onClick={onOpenSettings}
          />
          <SidebarIconButton
            icon={<LogOut className="h-4 w-4" />}
            title="Sign Out"
            onClick={onSignOut}
          />
        </div>
      )}

      {/* Right-click context menu */}
      <ConversationContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        conversation={contextMenu.contextData}
        onClose={contextMenu.close}
        onRename={handleStartEdit}
        onStar={onStarConversation}
        onArchive={onArchiveConversation}
        onDelete={onDeleteConversation}
        onExport={onExportConversation}
      />
    </aside>
  );
}
