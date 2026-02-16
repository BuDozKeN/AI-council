/**
 * Sidebar Tests
 *
 * Safety net for the Sidebar component.
 * Tests: sidebar states, new chat button, empty/loading states,
 * conversation rendering, pin toggle, footer, admin visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/test-utils';
import Sidebar from './Sidebar';
import type { Conversation } from '../types/conversation';

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, string>) => {
      if (typeof fallback === 'string') return fallback;
      if (typeof fallback === 'object' && 'query' in fallback)
        return `No results for "${fallback.query}"`;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../api', () => ({
  api: {
    updateConversationDepartment: vi.fn().mockResolvedValue({}),
    getCouncilStats: vi.fn().mockResolvedValue({}),
    getMockMode: vi.fn().mockResolvedValue(false),
    setMockMode: vi.fn().mockResolvedValue(true),
    getCachingMode: vi.fn().mockResolvedValue(false),
    setCachingMode: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('./ui/sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock sidebar sub-components
vi.mock('./sidebar/index.jsx', () => ({
  useMockMode: () => ({ mockMode: false, isToggling: false, toggle: vi.fn() }),
  useCachingMode: () => ({ cachingMode: false, isToggling: false, toggle: vi.fn() }),
  useHoverExpansion: () => ({
    hoveredIcon: null,
    handleIconHover: vi.fn(),
    handleIconLeave: vi.fn(),
    handleExpandedAreaEnter: vi.fn(),
    handleExpandedAreaLeave: vi.fn(),
    collapseNow: vi.fn(),
  }),
  SearchBar: vi.fn(
    ({
      searchQuery,
      onSearchChange,
      onClear,
    }: {
      searchQuery: string;
      onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
      onClear: () => void;
      [key: string]: unknown;
    }) => (
      <div data-testid="search-bar">
        <input
          data-testid="search-input"
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search conversations"
        />
        {searchQuery && (
          <button data-testid="search-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    )
  ),
  FilterSortBar: () => <div data-testid="filter-sort-bar" />,
  ConversationGroup: ({
    groupName,
    conversations,
    onSelectConversation,
  }: {
    groupName: string;
    conversations: Conversation[];
    onSelectConversation: (id: string) => void;
    [key: string]: unknown;
  }) => (
    <div data-testid={`conv-group-${groupName}`}>
      <span>
        {groupName} ({conversations.length})
      </span>
      {conversations.map((c) => (
        <button
          key={c.id}
          data-testid={`conv-item-${c.id}`}
          onClick={() => onSelectConversation(c.id)}
        >
          {c.title}
        </button>
      ))}
    </div>
  ),
  VirtualizedConversationList: () => <div data-testid="virtualized-list" />,
  SidebarFooter: ({
    user,
    isAdmin,
    onOpenAdmin,
    onOpenMyCompany,
    onOpenSettings,
    onSignOut,
  }: {
    user: { email: string } | null;
    isAdmin: boolean;
    onOpenAdmin?: () => void;
    onOpenMyCompany: () => void;
    onOpenSettings: () => void;
    onSignOut: () => void;
    [key: string]: unknown;
  }) => (
    <div data-testid="sidebar-footer">
      {user && <span data-testid="user-email">{user.email}</span>}
      {isAdmin && onOpenAdmin && (
        <button data-testid="admin-btn" onClick={onOpenAdmin}>
          Admin
        </button>
      )}
      <button data-testid="company-btn" onClick={onOpenMyCompany}>
        Company
      </button>
      <button data-testid="settings-btn" onClick={onOpenSettings}>
        Settings
      </button>
      <button data-testid="signout-btn" onClick={onSignOut}>
        Sign Out
      </button>
    </div>
  ),
  BulkActionBar: ({
    selectedCount,
    onClearSelection,
    onBulkDelete,
  }: {
    selectedCount: number;
    onClearSelection: () => void;
    onBulkDelete: () => void;
    [key: string]: unknown;
  }) =>
    selectedCount > 0 ? (
      <div data-testid="bulk-action-bar">
        <span>{selectedCount} selected</span>
        <button data-testid="bulk-cancel" onClick={onClearSelection}>
          Cancel
        </button>
        <button data-testid="bulk-delete" onClick={onBulkDelete}>
          Delete
        </button>
      </div>
    ) : null,
  SidebarIconButton: ({
    title,
    onClick,
    disabled,
    isPrimary,
  }: {
    icon: React.ReactNode;
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    isPrimary?: boolean;
    [key: string]: unknown;
  }) => (
    <button
      data-testid={`icon-btn-${title}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
      data-primary={isPrimary}
    >
      {title}
    </button>
  ),
  ConversationContextMenu: () => <div data-testid="context-menu" />,
  useContextMenu: () => ({
    isOpen: false,
    position: { x: 0, y: 0 },
    contextData: null,
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('../hooks', () => ({
  usePullToRefresh: () => ({
    ref: { current: null },
    pullDistance: 0,
    isRefreshing: false,
    progress: 0,
  }),
  useKeyboardShortcuts: vi.fn(),
  useListNavigation: () => ({
    getFocusedId: () => null,
    navigateUp: vi.fn(),
    navigateDown: vi.fn(),
    selectCurrent: vi.fn(),
  }),
  useDragAndDrop: () => ({
    draggedItem: null,
    dragOverTarget: null,
    isDragging: false,
    getDragHandlers: () => ({}),
    getDropHandlers: () => ({}),
  }),
  usePrefetchCompany: () => ({
    allHoverHandlers: { onMouseEnter: vi.fn(), onMouseLeave: vi.fn() },
  }),
}));

vi.mock('./ui/Skeleton', () => ({
  ConversationSkeletonGroup: ({ count }: { count: number }) => (
    <div data-testid="skeleton-group">{count} skeletons</div>
  ),
}));

vi.mock('./ui/PullToRefresh', () => ({
  PullToRefreshIndicator: () => null,
}));

// Mock ResizeObserver for jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleConversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Marketing Strategy',
    messages: [{ role: 'user', content: 'Hello', timestamp: new Date().toISOString() }],
    created_at: new Date().toISOString(),
    department: 'standard',
  },
  {
    id: 'conv-2',
    title: 'Product Roadmap',
    messages: [{ role: 'user', content: 'Plan', timestamp: new Date().toISOString() }],
    created_at: new Date().toISOString(),
    department: 'standard',
  },
];

function createDefaultProps(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return {
    conversations: sampleConversations,
    currentConversationId: null,
    onSelectConversation: vi.fn(),
    onNewConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onBulkDeleteConversations: vi.fn().mockResolvedValue({ deleted: [] }),
    onRenameConversation: vi.fn().mockResolvedValue(undefined),
    onOpenSidebar: vi.fn(),
    ...overrides,
  };
}

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = createDefaultProps(overrides);
  return { ...render(<Sidebar {...props} />), props };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // =========================================================================
  // Sidebar Structure
  // =========================================================================

  describe('Structure', () => {
    it('renders as an aside with correct aria-label', () => {
      renderSidebar();
      expect(
        screen.getByRole('complementary', { name: /conversation history/i })
      ).toBeInTheDocument();
    });

    it('starts in collapsed state by default', () => {
      renderSidebar();
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toContain('sidebar--collapsed');
    });

    it('starts in pinned state when localStorage has sidebar-pinned=true', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toContain('sidebar--pinned');
    });
  });

  // =========================================================================
  // Collapsed State (Icon Rail)
  // =========================================================================

  describe('Collapsed State', () => {
    it('renders New Chat icon button when collapsed', () => {
      renderSidebar();
      expect(screen.getByTestId('icon-btn-chat.newChat')).toBeInTheDocument();
    });

    it('renders History icon button', () => {
      renderSidebar();
      expect(screen.getByTestId('icon-btn-sidebar.history')).toBeInTheDocument();
    });

    it('renders Leaderboard icon button for admins when onOpenLeaderboard provided', () => {
      renderSidebar({ isAdmin: true, onOpenLeaderboard: vi.fn() });
      expect(screen.getByTitle(/Leaderboard/i)).toBeInTheDocument();
    });

    it('does not render Leaderboard icon when onOpenLeaderboard is not provided', () => {
      renderSidebar({ isAdmin: true });
      expect(screen.queryByTitle(/Leaderboard/i)).not.toBeInTheDocument();
    });

    it('does not render Leaderboard icon for non-admins', () => {
      renderSidebar({ isAdmin: false, onOpenLeaderboard: vi.fn() });
      expect(screen.queryByTitle(/Leaderboard/i)).not.toBeInTheDocument();
    });

    it('renders collapsed footer with company, settings, signout icons', () => {
      renderSidebar({ onOpenMyCompany: vi.fn(), onOpenSettings: vi.fn(), onSignOut: vi.fn() });
      // In collapsed state, SidebarIconButton is rendered for footer items
      // Check the specific titles
      const companyBtn = screen.getByTitle(/sidebar.myCompany/);
      const settingsBtn = screen.getByTitle(/sidebar.settings/);
      const signoutBtn = screen.getByTitle(/sidebar.tooltips.signOut/);
      expect(companyBtn).toBeInTheDocument();
      expect(settingsBtn).toBeInTheDocument();
      expect(signoutBtn).toBeInTheDocument();
    });

    it('renders admin icon button for admins in collapsed state', () => {
      renderSidebar({ isAdmin: true, onOpenAdmin: vi.fn() });
      expect(screen.getByTitle(/Platform Admin Portal/i)).toBeInTheDocument();
    });

    it('does not render admin icon when not admin', () => {
      renderSidebar({ isAdmin: false });
      expect(screen.queryByTitle(/Platform Admin Portal/i)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Pinned State (Expanded)
  // =========================================================================

  describe('Pinned State', () => {
    it('shows New Chat text button when pinned', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByText('chat.newChat')).toBeInTheDocument();
    });

    it('shows pin toggle button when pinned', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByLabelText(/collapse/i)).toBeInTheDocument();
    });

    it('does not show icon rail when pinned', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      // Icon rail only renders when !isPinned, so History icon button should not be present
      expect(screen.queryByTestId('icon-btn-sidebar.history')).not.toBeInTheDocument();
    });

    it('renders search bar when pinned with conversations', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    });

    it('renders filter/sort bar when pinned with conversations', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByTestId('filter-sort-bar')).toBeInTheDocument();
    });

    it('renders conversation list with listbox role', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByRole('listbox', { name: /allConversations/i })).toBeInTheDocument();
    });

    it('renders conversation groups', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar();
      expect(screen.getByTestId('conv-group-General')).toBeInTheDocument();
    });

    it('renders SidebarFooter with user info when pinned', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar({
        user: { id: 'u1', email: 'admin@test.com' } as Parameters<typeof Sidebar>[0]['user'],
      });
      expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
      expect(screen.getByTestId('user-email')).toHaveTextContent('admin@test.com');
    });
  });

  // =========================================================================
  // Pin Toggle
  // =========================================================================

  describe('Pin Toggle', () => {
    it('saves pinned state to localStorage when pinning', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      renderSidebar();

      // Click the collapse button (which unpins)
      const pinBtn = screen.getByLabelText(/collapse/i);
      await user.click(pinBtn);

      expect(localStorage.getItem('sidebar-pinned')).toBe('false');
    });
  });

  // =========================================================================
  // New Chat Button
  // =========================================================================

  describe('New Chat Button', () => {
    it('calls onNewConversation when New Chat icon button clicked (collapsed)', async () => {
      const user = userEvent.setup();
      const { props } = renderSidebar();
      const newChatBtn = screen.getByTestId('icon-btn-chat.newChat');
      await user.click(newChatBtn);
      expect(props.onNewConversation).toHaveBeenCalledTimes(1);
    });

    it('calls onNewConversation when New Chat text button clicked (pinned)', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      const { props } = renderSidebar();
      const newChatBtn = screen.getByText('chat.newChat');
      await user.click(newChatBtn);
      expect(props.onNewConversation).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Empty / Loading States
  // =========================================================================

  describe('Empty and Loading States', () => {
    it('shows skeleton loading when isLoading with no conversations', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar({ conversations: [], isLoading: true });
      expect(screen.getByTestId('skeleton-group')).toBeInTheDocument();
    });

    it('shows "ready when you are" empty state with zero conversations', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar({ conversations: [], isLoading: false });
      expect(screen.getByText('sidebar.readyWhenYouAre')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Conversation Selection
  // =========================================================================

  describe('Conversation Selection', () => {
    it('calls onSelectConversation when a conversation is clicked', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      const { props } = renderSidebar();

      const convItem = screen.getByTestId('conv-item-conv-1');
      await user.click(convItem);

      expect(props.onSelectConversation).toHaveBeenCalledWith('conv-1');
    });
  });

  // =========================================================================
  // Footer Actions
  // =========================================================================

  describe('Footer Actions (Pinned)', () => {
    it('calls onOpenMyCompany when company button clicked', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      const onOpenMyCompany = vi.fn();
      renderSidebar({ onOpenMyCompany });

      await user.click(screen.getByTestId('company-btn'));
      expect(onOpenMyCompany).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenSettings when settings button clicked', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      const onOpenSettings = vi.fn();
      renderSidebar({ onOpenSettings });

      await user.click(screen.getByTestId('settings-btn'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('calls onSignOut when sign out button clicked', async () => {
      localStorage.setItem('sidebar-pinned', 'true');
      const user = userEvent.setup();
      const onSignOut = vi.fn();
      renderSidebar({ onSignOut });

      await user.click(screen.getByTestId('signout-btn'));
      expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    // Note: Admin & Leaderboard buttons were moved from expanded footer to collapsed sidebar
    // See commit 8aef12e: "fix(sidebar): hide admin buttons in expanded view, show only in collapsed"
  });

  // =========================================================================
  // Mobile State
  // =========================================================================

  describe('Mobile State', () => {
    it('adds mobile-open class when isMobileOpen is true', () => {
      renderSidebar({ isMobileOpen: true });
      const sidebar = screen.getByRole('complementary');
      expect(sidebar.className).toContain('mobile-open');
    });

    it('expands sidebar when isMobileOpen is true', () => {
      renderSidebar({ isMobileOpen: true });
      // When mobile open, isExpanded = true, so SidebarFooter should render
      expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Context Menu
  // =========================================================================

  describe('Context Menu', () => {
    it('renders ConversationContextMenu component', () => {
      renderSidebar();
      expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Load More Indicator
  // =========================================================================

  describe('Load More Indicator', () => {
    it('shows scroll for more hint when hasMoreConversations', () => {
      localStorage.setItem('sidebar-pinned', 'true');
      renderSidebar({ hasMoreConversations: true });
      expect(screen.getByText('sidebar.scrollForMore')).toBeInTheDocument();
    });
  });
});
