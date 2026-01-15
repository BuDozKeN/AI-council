import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '@supabase/supabase-js';
import { Button } from './ui/button';
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  History,
  Settings,
  Building2,
  LogOut,
  Trophy,
} from 'lucide-react';
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
import type { SearchBarRef } from './sidebar/SearchBar';
import { ConversationSkeletonGroup } from './ui/Skeleton';
import {
  usePullToRefresh,
  useKeyboardShortcuts,
  useListNavigation,
  useDragAndDrop,
  usePrefetchCompany,
} from '../hooks';
import type { DraggableConversation } from '../hooks/useDragAndDrop';
import { PullToRefreshIndicator } from './ui/PullToRefresh';
import { toast } from './ui/sonner';
import { api } from '../api';
import { logger } from '../utils/logger';
import type { Conversation, ConversationSortBy } from '../types/conversation';
import type { Department } from '../types/business';
import './sidebar/index.css';

interface DepartmentConversationGroup {
  name: string;
  conversations: Conversation[];
  deptId: string;
}

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onOpenLeaderboard?: () => void;
  onOpenSettings?: () => void;
  onOpenMyCompany?: () => void;
  onPreloadMyCompany?: () => void;
  onExportConversation?: (id: string) => void;
  onArchiveConversation?: (id: string, archived?: boolean) => void | Promise<void>;
  onStarConversation?: (id: string, starred?: boolean) => void | Promise<void>;
  onDeleteConversation: (id: string) => void;
  onBulkDeleteConversations: (ids: string[]) => Promise<{ deleted: string[] }>;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onSearch?: (query: string) => Promise<Conversation[] | void> | void;
  hasMoreConversations?: boolean;
  departments?: Department[];
  user?: User | null;
  onSignOut?: () => void;
  sortBy?: ConversationSortBy;
  onSortByChange?: (sortBy: ConversationSortBy) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  onUpdateConversationDepartment?: (id: string, department: string) => void;
  companyId?: string | null;
}

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
  onPreloadMyCompany,
  onExportConversation,
  onArchiveConversation,
  onStarConversation,
  onDeleteConversation,
  onBulkDeleteConversations,
  onRenameConversation,
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
  isLoading = false,
  onUpdateConversationDepartment,
  companyId = null,
}: SidebarProps) {
  const { t } = useTranslation();
  // Prefetch company data on hover for instant navigation
  const { allHoverHandlers: prefetchMyCompanyHandlers } = usePrefetchCompany(companyId);

  // Combined hover handlers: preload JS chunk + prefetch API data
  const myCompanyHoverHandlers = useMemo(
    () => ({
      onMouseEnter: () => {
        onPreloadMyCompany?.(); // Load JS chunk
        prefetchMyCompanyHandlers.onMouseEnter(); // Prefetch API data
      },
      onMouseLeave: prefetchMyCompanyHandlers.onMouseLeave,
    }),
    [onPreloadMyCompany, prefetchMyCompanyHandlers]
  );

  // Sidebar state: 'collapsed' | 'hovered' | 'pinned'
  const [sidebarState, setSidebarState] = useState(() => {
    // Load saved preference from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-pinned');
      return saved === 'true' ? 'pinned' : 'collapsed';
    }
    return 'collapsed';
  });

  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Note: deleteConfirm modal removed - optimistic delete with undo toast is used instead
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [focusedConversationId, setFocusedConversationId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<SearchBarRef | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Context menu for right-click actions
  const contextMenu = useContextMenu();

  // Drag and drop for moving conversations between departments
  const handleDragDrop = useCallback(
    async (conversationId: string, targetDepartment: string, item: DraggableConversation) => {
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
        toast.error("Couldn't move that conversation. Please try again.");
        // Revert optimistic update
        if (onUpdateConversationDepartment && item.department) {
          onUpdateConversationDepartment(conversationId, item.department);
        }
      }
    },
    [onUpdateConversationDepartment]
  );

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
  const {
    cachingMode,
    isToggling: isTogglingCaching,
    toggle: toggleCachingMode,
  } = useCachingMode();

  // Derived state
  const isPinned = sidebarState === 'pinned';

  // Hover expansion behavior (uses CSS tokens for timing)
  const {
    hoveredIcon,
    handleIconHover,
    handleIconLeave,
    handleExpandedAreaEnter,
    handleExpandedAreaLeave,
    collapseNow,
  } = useHoverExpansion({ isPinned });

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDEBAR STATE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  // The sidebar has THREE related pieces that must stay in sync:
  //
  // 1. visualState (line ~526) - CSS class determining width/layout:
  //    - 'collapsed': narrow, icon rail only
  //    - 'hovered': icon rail + expanded panel side by side
  //    - 'pinned': full width, no icon rail
  //
  // 2. isExpanded (below) - whether to RENDER expanded content
  //
  // 3. Icon rail render condition (line ~582) - `!isPinned`
  //
  // IMPORTANT: When adding new conditions that keep sidebar open (like hasSelection),
  // you must update ALL THREE pieces consistently:
  // - Add to isExpanded (to render content)
  // - Add to visualState with correct mode ('hovered' keeps icon rail, 'pinned' hides it)
  // - Consider if icon rail condition needs updating
  // ═══════════════════════════════════════════════════════════════════════════

  const hasSelection = selectedIds.size > 0;
  const isExpanded = isPinned || hoveredIcon !== null || isMobileOpen || hasSelection;

  // Close sidebar when clicking outside (desktop only - expanded states)
  // NOTE: This effect depends on hasSelection, so it must be defined after
  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth > 768;
    const isExpandedOnDesktop =
      isDesktop && !isMobileOpen && (hoveredIcon || isPinned || hasSelection);

    if (!isExpandedOnDesktop) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;

      // Don't collapse if clicking inside the sidebar
      if (sidebarRef.current && sidebarRef.current.contains(target)) {
        return;
      }

      // Don't collapse if items are selected - user needs to complete the bulk action
      if (hasSelection) {
        return;
      }

      // Don't collapse if clicking on a Radix portal or select trigger
      // These are rendered outside the sidebar but are logically part of it
      // Also check for select triggers which are inside the sidebar
      const isRadixElement = target.closest?.(
        '[data-radix-popper-content-wrapper], ' +
          '[data-radix-select-content], ' +
          '[data-radix-select-trigger], ' +
          '[data-radix-menu-content], ' +
          '[data-radix-dialog-content], ' +
          '.select-content, ' +
          '.select-item, ' +
          '.select-trigger, ' +
          '[role="listbox"], ' +
          '[role="option"], ' +
          '[role="combobox"]'
      );
      if (isRadixElement) {
        return;
      }

      if (isPinned) {
        // Unpin and collapse
        setSidebarState('collapsed');
        localStorage.setItem('sidebar-pinned', 'false');
      } else {
        collapseNow();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hoveredIcon, isPinned, isMobileOpen, hasSelection, collapseNow]);

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
  const handleStartEdit = (conv: Conversation, e?: React.MouseEvent) => {
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
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Multi-select handlers
  const toggleSelection = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
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
    const active = conversations.filter((conv) => !conv.is_archived);
    const archived = conversations.filter((conv) => conv.is_archived);
    return { activeConversations: active, archivedConversations: archived };
  }, [conversations]);

  // Filter conversations by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return { active: activeConversations, archived: archivedConversations };
    }
    const query = searchQuery.toLowerCase();
    const matchesSearch = (conv: Conversation) =>
      conv.title?.toLowerCase().includes(query) || conv.department?.toLowerCase().includes(query);
    return {
      active: activeConversations.filter(matchesSearch),
      archived: archivedConversations.filter(matchesSearch),
    };
  }, [activeConversations, archivedConversations, searchQuery]);

  // Flat list of all visible conversations for keyboard navigation
  const flatConversationList = useMemo(() => {
    const list: Conversation[] = [];
    const convsToShow = filter === 'archived' ? filteredBySearch.archived : filteredBySearch.active;
    convsToShow.forEach((conv) => list.push(conv));
    return list;
  }, [filter, filteredBySearch]);

  // List navigation for keyboard support
  const { getFocusedId, navigateUp, navigateDown, selectCurrent } = useListNavigation({
    items: flatConversationList as unknown as { id: string; [key: string]: unknown }[],
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
  // Note: conversations store department as a slug (e.g., "technology", "standard")
  // while departments from the API have both id (UUID) and slug fields
  const groupedConversations = useMemo(() => {
    const groups: Record<string, DepartmentConversationGroup> = {};
    const convsToGroup =
      filter === 'archived' ? filteredBySearch.archived : filteredBySearch.active;

    // Create groups keyed by slug (or id for legacy/default departments)
    departments.forEach((dept) => {
      const key = dept.slug || dept.id;
      groups[key] = { name: dept.name, conversations: [], deptId: dept.id };
    });

    if (!groups['standard']) {
      groups['standard'] = { name: 'Standard', conversations: [], deptId: 'standard' };
    }

    convsToGroup.forEach((conv) => {
      const deptSlug = conv.department || 'standard';
      if (!groups[deptSlug]) {
        groups[deptSlug] = {
          name: deptSlug.charAt(0).toUpperCase() + deptSlug.slice(1),
          conversations: [],
          deptId: deptSlug,
        };
      }
      groups[deptSlug].conversations.push(conv);
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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isGroupExpanded = (groupId: string): boolean => {
    if (expandedGroups[groupId] !== undefined) {
      return expandedGroups[groupId];
    }
    return (groupedConversations[groupId]?.conversations.length ?? 0) > 0;
  };

  const totalConversations = conversations.length;
  const searchResultCount = filteredBySearch.active.length + filteredBySearch.archived.length;

  // Use virtualization for large lists (> 20 conversations for consistency)
  const useVirtualization = totalConversations > 20;
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState<number>(400);

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
  // DISABLED: Removed auto-load behavior. Users must manually scroll to bottom
  // or use "Load More" functionality. This prevents the list from auto-expanding
  // beyond the initial 10 items without user intent.
  // Note: The load more trigger element is still rendered for potential future use.

  // Determine visual state for CSS
  // When items are selected, treat as 'hovered' to keep expanded panel visible but preserve icon rail
  const visualState = isPinned ? 'pinned' : hoveredIcon || hasSelection ? 'hovered' : 'collapsed';

  // Build sidebar CSS classes
  const sidebarClasses = ['sidebar', `sidebar--${visualState}`, isMobileOpen ? 'mobile-open' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside ref={sidebarRef} className={sidebarClasses} aria-label="Conversation history">
      {/* Header with New Chat and Pin toggle */}
      <div
        className="sidebar-header"
        onMouseEnter={handleExpandedAreaEnter}
        onMouseLeave={handleExpandedAreaLeave}
      >
        {isExpanded ? (
          <>
            <Button onClick={onNewConversation} className="sidebar-new-btn">
              <Plus className="h-4 w-4" />
              <span className="sidebar-btn-text">{t('chat.newChat')}</span>
            </Button>
            <button
              onClick={togglePin}
              className="sidebar-pin-btn"
              title={isPinned ? t('sidebar.collapseSidebar') : t('sidebar.pinSidebar')}
              aria-label={isPinned ? t('sidebar.collapseSidebar') : t('sidebar.pinSidebar')}
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
            title={t('chat.newChat')}
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
              title={t('sidebar.history')}
              onClick={togglePin}
              onMouseEnter={() => {
                if (totalConversations > 0) handleIconHover('history');
              }}
              onMouseLeave={handleIconLeave}
              isActive={hoveredIcon === 'history'}
              disabled={totalConversations === 0}
            />

            {/* Leaderboard - if available */}
            {onOpenLeaderboard && (
              <SidebarIconButton
                icon={<Trophy className="h-5 w-5" />}
                title={t('sidebar.leaderboard')}
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
                  onSortByChange={onSortByChange ?? (() => {})}
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
            <div
              className="conversation-list"
              ref={(el: HTMLDivElement | null) => {
                pullToRefreshRef.current = el;
                listContainerRef.current = el;
              }}
            >
              {/* Skeleton loading state */}
              {isLoading && totalConversations === 0 ? (
                <ConversationSkeletonGroup count={5} />
              ) : searchQuery && searchResultCount === 0 ? (
                <div className="no-conversations">
                  <span className="no-conv-icon">🔍</span>
                  {t('sidebar.noResultsFor', { query: searchQuery })}
                </div>
              ) : totalConversations === 0 ? (
                <div className="no-conversations">
                  <span className="no-conv-icon">💬</span>
                  <span>{t('sidebar.readyWhenYouAre')}</span>
                  <span className="no-conv-hint">{t('sidebar.startNewConversation')}</span>
                </div>
              ) : filter === 'archived' && filteredBySearch.archived.length === 0 ? (
                <div className="no-conversations">
                  <span className="no-conv-icon">📦</span>
                  {t('sidebar.nothingArchived')}
                </div>
              ) : filter !== 'archived' && filteredBySearch.active.length === 0 ? (
                <div className="no-conversations">{t('sidebar.noActiveConversations')}</div>
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
                  onStarConversation={
                    onStarConversation ? (id: string) => onStarConversation(id) : undefined
                  }
                  onArchiveConversation={
                    onArchiveConversation ? (id: string) => onArchiveConversation(id) : undefined
                  }
                  onDeleteConversation={onDeleteConversation}
                  onToggleGroup={toggleGroup}
                  onContextMenu={contextMenu.open}
                  height={listHeight}
                />
              ) : (
                Object.entries(filteredGroups).map(
                  ([groupId, group]) =>
                    group && (
                      <ConversationGroup
                        key={groupId}
                        groupId={groupId}
                        groupName={group.name}
                        conversations={group.conversations}
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
                        onStarConversation={
                          onStarConversation ? (id: string) => onStarConversation(id) : undefined
                        }
                        onArchiveConversation={
                          onArchiveConversation
                            ? (id: string) => onArchiveConversation(id)
                            : undefined
                        }
                        onDeleteConversation={onDeleteConversation}
                        onContextMenu={contextMenu.open}
                        // Drag and drop props
                        dropHandlers={getDropHandlers(groupId)}
                        isDropTarget={dragOverTarget === groupId}
                        getDragHandlers={(conv: Conversation) =>
                          getDragHandlers(conv as unknown as DraggableConversation)
                        }
                        draggedItemId={draggedItem?.id ?? null}
                      />
                    )
                )
              )}

              {/* Load more indicator - shown when more conversations exist */}
              {hasMoreConversations && totalConversations > 0 && !searchQuery && (
                <div className="load-more-hint">
                  <span className="load-more-hint-text">{t('sidebar.scrollForMore')}</span>
                </div>
              )}
            </div>

            {/* Multi-select action bar - inside expanded panel to avoid overlapping icon rail */}
            <BulkActionBar
              selectedCount={selectedIds.size}
              isDeleting={isDeleting}
              onClearSelection={clearSelection}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        )}
      </div>

      {/* Footer with user info and actions */}
      {isExpanded ? (
        <SidebarFooter
          user={user ? { email: user.email ?? '' } : null}
          mockMode={mockMode}
          isTogglingMock={isTogglingMock}
          onToggleMockMode={toggleMockMode}
          cachingMode={cachingMode}
          isTogglingCaching={isTogglingCaching}
          onToggleCachingMode={toggleCachingMode}
          onOpenMyCompany={onOpenMyCompany ?? (() => {})}
          onOpenSettings={onOpenSettings ?? (() => {})}
          onSignOut={onSignOut ?? (() => {})}
          onMouseEnter={handleExpandedAreaEnter}
          onMouseLeave={handleExpandedAreaLeave}
          onCompanyMouseEnter={myCompanyHoverHandlers.onMouseEnter}
          onCompanyMouseLeave={myCompanyHoverHandlers.onMouseLeave}
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
            title={t('sidebar.myCompany')}
            onClick={onOpenMyCompany ?? (() => {})}
            onMouseEnter={myCompanyHoverHandlers.onMouseEnter}
            onMouseLeave={myCompanyHoverHandlers.onMouseLeave}
          />
          <SidebarIconButton
            icon={<Settings className="h-4 w-4" />}
            title={t('sidebar.settings')}
            onClick={onOpenSettings ?? (() => {})}
          />
          <SidebarIconButton
            icon={<LogOut className="h-4 w-4" />}
            title={t('auth.signOut')}
            onClick={onSignOut ?? (() => {})}
          />
        </div>
      )}

      {/* Right-click context menu */}
      <ConversationContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        conversation={contextMenu.contextData as Conversation | null}
        onClose={contextMenu.close}
        onRename={handleStartEdit}
        onStar={(id: string, starred: boolean) => onStarConversation?.(id, starred)}
        onArchive={(id: string, archived: boolean) => onArchiveConversation?.(id, archived)}
        onDelete={onDeleteConversation}
        onExport={onExportConversation}
      />
    </aside>
  );
}
