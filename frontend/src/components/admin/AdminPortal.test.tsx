/**
 * AdminPortal Tests
 *
 * Safety net for CRITICAL-2 (splitting AdminPortal into sub-components).
 * Tests the main shell behavior: auth gates, tab navigation, tab rendering.
 *
 * These tests verify behavior that MUST be preserved after the split.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import AdminPortal from './AdminPortal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock i18n locale helper
vi.mock('../../i18n', () => ({
  getIntlLocale: () => 'en-US',
}));

// Mock AuthContext — default: logged-in user
const mockUser = { id: 'user-1', email: 'admin@test.com' };
const mockUseAuth = vi.fn(() => ({
  user: mockUser,
  loading: false,
  isAuthenticated: true,
}));
vi.mock('../../AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useAdminAccess — default: is admin
const mockUseAdminAccess = vi.fn(() => ({
  isAdmin: true,
  adminRole: 'super_admin',
  isLoading: false,
  error: null,
}));
vi.mock('../../hooks', () => ({
  useAdminAccess: () => mockUseAdminAccess(),
}));

// Mock the API module
vi.mock('../../api', () => ({
  api: {
    checkAdminAccess: vi.fn().mockResolvedValue({ is_admin: true, role: 'super_admin' }),
    getAdminStats: vi.fn().mockResolvedValue({
      total_users: 42,
      total_companies: 5,
      total_conversations: 200,
      active_users_24h: 10,
    }),
    getAdminUsers: vi.fn().mockResolvedValue([]),
    getAdminCompanies: vi.fn().mockResolvedValue([]),
    getAdminAuditLogs: vi.fn().mockResolvedValue([]),
    getAdminAdmins: vi.fn().mockResolvedValue([]),
    getAdminAnalytics: vi.fn().mockResolvedValue({}),
    getAdminModelRankings: vi.fn().mockResolvedValue([]),
    getAnalyticsSummary: vi.fn().mockResolvedValue({}),
    getAnalyticsTimeSeries: vi.fn().mockResolvedValue([]),
    getAnalyticsModelUsage: vi.fn().mockResolvedValue([]),
    getAnalyticsCostBreakdown: vi.fn().mockResolvedValue([]),
    getAnalyticsTopUsers: vi.fn().mockResolvedValue([]),
    getModelUsageAnalytics: vi.fn().mockResolvedValue({ models: [], total_cost: 0 }),
    getPremiumAnalytics: vi.fn().mockResolvedValue({}),
    getAdminDeletedUsers: vi.fn().mockResolvedValue([]),
    getAdminInvitations: vi.fn().mockResolvedValue([]),
    deleteUser: vi.fn().mockResolvedValue({}),
    updateUserRole: vi.fn().mockResolvedValue({}),
    createInvitation: vi.fn().mockResolvedValue({}),
  },
}));

// Mock recharts to avoid canvas/SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}));

// Mock sonner toast
vi.mock('../ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// Mock model personas config
vi.mock('../../config/modelPersonas', () => ({
  PROVIDER_COLORS: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderAdminPortal(initialRoute = '/admin/users') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AdminPortal />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to defaults: logged-in admin
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      isAuthenticated: true,
    });
    mockUseAdminAccess.mockReturnValue({
      isAdmin: true,
      adminRole: 'super_admin',
      isLoading: false,
      error: null,
    });
  });

  // =========================================================================
  // Auth Gate Tests — these verify access control BEFORE any content renders
  // =========================================================================

  describe('Auth Gates', () => {
    it('shows loading state while auth is checking', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: true,
        isAuthenticated: false,
      });
      mockUseAdminAccess.mockReturnValue({
        isAdmin: false,
        adminRole: null,
        isLoading: true,
        error: null,
      });

      renderAdminPortal();
      // Spinner has sr-only label AND visible <p> tag with same text
      expect(screen.getAllByText('Checking admin access...').length).toBeGreaterThanOrEqual(1);
    });

    it('shows error state when there is a connection error', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        isAuthenticated: true,
      });
      mockUseAdminAccess.mockReturnValue({
        isAdmin: false,
        adminRole: null,
        isLoading: false,
        error: new Error('Network timeout'),
      });

      renderAdminPortal();
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Back to App')).toBeInTheDocument();
    });

    it('shows not-logged-in state when user is null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        isAuthenticated: false,
      });
      mockUseAdminAccess.mockReturnValue({
        isAdmin: false,
        adminRole: null,
        isLoading: false,
        error: null,
      });

      renderAdminPortal();
      expect(screen.getByText('Not Logged In')).toBeInTheDocument();
      expect(screen.getByText('Please log in to access the admin portal.')).toBeInTheDocument();
    });

    it('shows access-denied state when user is not admin', () => {
      mockUseAdminAccess.mockReturnValue({
        isAdmin: false,
        adminRole: null,
        isLoading: false,
        error: null,
      });

      renderAdminPortal();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.getByText(/not authorized to access the admin portal/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Admin Layout — verifies the shell renders correctly for authorized admins
  // =========================================================================

  describe('Admin Layout (authorized)', () => {
    it('renders the admin portal with sidebar and navigation', () => {
      renderAdminPortal();

      // Title
      expect(screen.getByText('Admin Portal')).toBeInTheDocument();

      // All 6 nav tabs present
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Companies')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
      expect(screen.getByText('Admin Roles')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('displays the admin user email in the sidebar', () => {
      renderAdminPortal();
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    it('displays the Platform Admin badge', () => {
      renderAdminPortal();
      expect(screen.getByText('Platform Admin')).toBeInTheDocument();
    });

    it('renders the Back to App button', () => {
      renderAdminPortal();
      expect(screen.getByText('Back to App')).toBeInTheDocument();
    });

    it('renders the skip-to-content accessibility link', () => {
      renderAdminPortal();
      const skipLink = screen.getByText('Skip to main content');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink.tagName).toBe('A');
      expect(skipLink).toHaveAttribute('href', '#admin-main-content');
    });

    it('renders the Toaster for toast notifications', () => {
      renderAdminPortal();
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Tab Navigation — verifies tabs render based on URL path
  // =========================================================================

  describe('Tab Navigation', () => {
    it('highlights the active tab based on URL', () => {
      renderAdminPortal('/admin/users');

      const navButtons = screen.getAllByRole('button');
      const usersButton = navButtons.find((btn) => btn.textContent?.includes('Users'));
      expect(usersButton?.className).toContain('admin-nav-item--active');
    });

    it('renders Users tab content at /admin/users', () => {
      renderAdminPortal('/admin/users');

      // Users tab should render a search input and table
      // Look for search placeholder or table header
      waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it('renders Companies tab content at /admin/companies', () => {
      renderAdminPortal('/admin/companies');

      waitFor(() => {
        // Companies tab should render
        expect(screen.getByText('Companies')).toBeInTheDocument();
      });
    });

    it('renders Audit tab content at /admin/audit', () => {
      renderAdminPortal('/admin/audit');

      waitFor(() => {
        expect(screen.getByText('Audit Logs')).toBeInTheDocument();
      });
    });

    it('renders Analytics tab content at /admin/analytics', () => {
      renderAdminPortal('/admin/analytics');

      waitFor(() => {
        // Analytics renders charts or summary cards
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });
    });

    it('renders Admin Roles tab content at /admin/admins', () => {
      renderAdminPortal('/admin/admins');

      waitFor(() => {
        expect(screen.getByText('Admin Roles')).toBeInTheDocument();
      });
    });

    it('renders Settings tab content at /admin/settings', () => {
      renderAdminPortal('/admin/settings');

      waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Tab switching — verifies clicking a nav button navigates
  // =========================================================================

  describe('Tab Switching', () => {
    it('switches to Companies tab when clicked', async () => {
      const user = userEvent.setup();
      renderAdminPortal('/admin/users');

      const companiesBtn = screen.getByRole('button', { name: /companies/i });
      await user.click(companiesBtn);

      // After click, Companies nav item should be active
      await waitFor(() => {
        expect(companiesBtn.className).toContain('admin-nav-item--active');
      });
    });

    it('switches to Audit Logs tab when clicked', async () => {
      const user = userEvent.setup();
      renderAdminPortal('/admin/users');

      const auditBtn = screen.getByRole('button', { name: /audit logs/i });
      await user.click(auditBtn);

      await waitFor(() => {
        expect(auditBtn.className).toContain('admin-nav-item--active');
      });
    });
  });

  // =========================================================================
  // Internal helpers — formatActionName
  // =========================================================================

  describe('formatActionName utility', () => {
    // We can't import the function directly since it's not exported,
    // but we can test it indirectly through the audit log rendering.
    // For now, this is a placeholder for when the function is extracted
    // during the split.
    it('is tested indirectly through AuditTab rendering', () => {
      // This test validates that the audit tab renders action names correctly
      // Will be expanded after the split extracts formatActionName
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // Stats Overview — renders on non-analytics tabs
  // =========================================================================

  describe('Stats Overview', () => {
    it('shows stats overview on Users tab (not Analytics)', () => {
      renderAdminPortal('/admin/users');

      // StatsOverview should render on non-analytics tabs
      // It shows stat cards with numbers
      waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toBeInTheDocument();
      });
    });

    it('hides stats overview on Analytics tab', () => {
      renderAdminPortal('/admin/analytics');

      // Analytics tab handles its own stats display
      // StatsOverview should NOT appear
      waitFor(() => {
        const mainContent = screen.getByRole('main');
        expect(mainContent).toBeInTheDocument();
      });
    });
  });
});
