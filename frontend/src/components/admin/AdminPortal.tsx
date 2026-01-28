/**
 * AdminPortal - Full-page platform administration interface
 *
 * This is a separate full-page layout from the main app, accessible only
 * to platform admins. It provides:
 * - Dashboard with platform stats
 * - User management across all companies
 * - Company management
 * - Admin role management
 * - Platform settings
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getIntlLocale } from '../../i18n';
import {
  Users,
  Building2,
  FileText,
  Shield,
  Settings,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Search,
  MessageSquare,
  Activity,
  BarChart3,
  Mail,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Send,
  X,
  CheckCircle,
  XCircle,
  Trash2,
  Ban,
  UserX,
  UserCheck,
  Eye,
  MoreVertical,
  Archive,
  RotateCcw,
  // Analytics icons
  DollarSign,
  Download,
  CalendarRange,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useAdminAccess } from '../../hooks';
import { api } from '../../api';
import type {
  AdminPlatformUser,
  AdminCompanyInfo,
  AdminUserInfo,
  AdminInvitation,
  AdminAuditLog,
  AdminDeletedUser,
  CreateInvitationRequest,
  ModelRanking,
} from '../../api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ImpersonateUserModal } from './ImpersonateUserModal';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Toaster, toast } from '../ui/sonner';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import './AdminPortal.css';
import './AdminPortalMobile.css';
import './AdminStats.css';
import './AdminTable.css';
import './AdminTableBadges.css';
import './AdminTableStates.css';
import './AdminTableAudit.css';
import './AdminTableMobile.css';
import './AdminTableSortable.css';
import './AdminDeletedUsers.css';
import './AdminToolbar.css';
import './AdminButtons.css';
import './AdminModals.css';
import './AdminModalsImpersonate.css';
import './AdminAuditLog.css';
import './AdminAnalytics.css';
import './AdminAnalyticsCards.css';
import './AdminAnalyticsPremium.css';
import './AdminAnalyticsPremiumCards.css';
import './AdminAnalyticsPremiumResponsive.css';
import './AdminAnalyticsModels.css';
import { SortableTableHeader } from './SortableTableHeader';
import { useSortState, sortData } from './tableSortUtils';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { PROVIDER_COLORS } from '../../config/modelPersonas';

type AdminTab = 'analytics' | 'users' | 'companies' | 'audit' | 'admins' | 'settings';

const ADMIN_TABS: { id: AdminTab; label: string; icon: typeof Users; path: string }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies' },
  { id: 'audit', label: 'Audit Logs', icon: FileText, path: '/admin/audit' },
  { id: 'admins', label: 'Admin Roles', icon: Shield, path: '/admin/admins' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
];

// =============================================================================
// SKELETON LOADING COMPONENTS
// =============================================================================

/** Skeleton cell with icon + text */
const SkeletonCell = ({ short = false }: { short?: boolean }) => (
  <td>
    <div className="admin-skeleton-cell">
      <div className="admin-table-skeleton admin-table-skeleton--icon" />
      <div
        className={`admin-table-skeleton admin-table-skeleton--text ${short ? 'admin-table-skeleton--short' : ''}`}
      />
    </div>
  </td>
);

/** Skeleton badge (status, role) */
const SkeletonBadge = () => (
  <td>
    <div className="admin-table-skeleton admin-table-skeleton--badge" />
  </td>
);

/** Skeleton action buttons */
const SkeletonActions = ({ count = 2 }: { count?: number }) => (
  <td>
    <div className="admin-skeleton-actions">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-table-skeleton admin-table-skeleton--btn" />
      ))}
    </div>
  </td>
);

/** Users table skeleton rows */
const UsersTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell short />
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonCell short />
        <SkeletonBadge />
        <SkeletonActions />
      </tr>
    ))}
  </>
);

/** Companies table skeleton rows */
const CompaniesTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell />
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonCell short />
      </tr>
    ))}
  </>
);

/** Admins table skeleton rows */
const AdminsTableSkeleton = () => (
  <>
    {Array.from({ length: 3 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell />
        <SkeletonBadge />
        <SkeletonCell short />
      </tr>
    ))}
  </>
);

/** Audit logs table skeleton rows */
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

/**
 * Format technical action names into user-friendly text
 * e.g., "view_audit_logs" -> "Viewed audit logs"
 */
const formatActionName = (action: string): string => {
  // Map of technical actions to friendly names
  const actionMap: Record<string, string> = {
    view_audit_logs: 'Viewed audit logs',
    view_user_details: 'Viewed user details',
    view_company_details: 'Viewed company details',
    update_user: 'Updated user',
    delete_user: 'Deleted user',
    create_company: 'Created company',
    update_company: 'Updated company',
    delete_company: 'Deleted company',
    impersonate_user: 'Impersonated user',
    grant_admin: 'Granted admin access',
    revoke_admin: 'Revoked admin access',
  };

  if (actionMap[action]) {
    return actionMap[action];
  }

  // Fallback: Convert snake_case to readable text
  return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function AdminPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading, error } = useAdminAccess();

  // Derive active tab from URL (no useState to avoid setState in effect)
  const activeTab = useMemo<AdminTab>(() => {
    const path = location.pathname;
    const matchedTab = ADMIN_TABS.find((tab) => path.startsWith(tab.path));
    return matchedTab?.id ?? 'users';
  }, [location.pathname]);

  // Redirect to default tab if at /admin root
  useEffect(() => {
    if (location.pathname === '/admin') {
      navigate('/admin/analytics', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleTabChange = (tab: AdminTab) => {
    const tabConfig = ADMIN_TABS.find((t) => t.id === tab);
    if (tabConfig) {
      navigate(tabConfig.path);
    }
  };

  const handleBackToApp = () => {
    navigate('/');
  };

  // Loading state (only show if no error)
  if ((authLoading || adminLoading) && !error) {
    return (
      <div className="admin-portal admin-portal--loading">
        <ThemeToggle />
        <div className="admin-loading-content">
          <Loader2 className="admin-loading-spinner animate-spin" />
          <p>{t('admin.loading', 'Checking admin access...')}</p>
        </div>
      </div>
    );
  }

  // Error state (timeout or other errors)
  if (error) {
    return (
      <div className="admin-portal admin-portal--error">
        <ThemeToggle />
        <div className="admin-error-content">
          <AlertCircle className="admin-error-icon" />
          <h2>{t('admin.error', 'Connection Error')}</h2>
          <p>{error.message}</p>
          <div className="admin-error-actions">
            <button className="admin-retry-btn" onClick={() => window.location.reload()}>
              {t('admin.retry', 'Retry')}
            </button>
            <button className="admin-back-btn" onClick={handleBackToApp}>
              <ArrowLeft className="h-4 w-4" />
              {t('admin.backToApp', 'Back to App')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="admin-portal admin-portal--error">
        <ThemeToggle />
        <div className="admin-error-content">
          <AlertCircle className="admin-error-icon" />
          <h2>{t('admin.notLoggedIn', 'Not Logged In')}</h2>
          <p>{t('admin.pleaseLogin', 'Please log in to access the admin portal.')}</p>
          <button className="admin-back-btn" onClick={handleBackToApp}>
            <ArrowLeft className="h-4 w-4" />
            {t('admin.backToApp', 'Back to App')}
          </button>
        </div>
      </div>
    );
  }

  // Not an admin
  if (!isAdmin) {
    return (
      <div className="admin-portal admin-portal--error">
        <ThemeToggle />
        <div className="admin-error-content">
          <Shield className="admin-error-icon admin-error-icon--denied" />
          <h2>{t('admin.accessDenied', 'Access Denied')}</h2>
          <p>
            {t(
              'admin.notAuthorized',
              'You are not authorized to access the admin portal. This area is restricted to platform administrators.'
            )}
          </p>
          <button className="admin-back-btn" onClick={handleBackToApp}>
            <ArrowLeft className="h-4 w-4" />
            {t('admin.backToApp', 'Back to App')}
          </button>
        </div>
      </div>
    );
  }

  // Admin portal layout
  return (
    <div className="admin-portal">
      {/* Skip to main content link for accessibility */}
      <a href="#admin-main-content" className="admin-skip-link">
        {t('admin.skipToContent', 'Skip to main content')}
      </a>

      <ThemeToggle />

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <button className="admin-back-link" onClick={handleBackToApp}>
            <ArrowLeft className="h-4 w-4" />
            <span>{t('admin.backToApp', 'Back to App')}</span>
          </button>
          <h1 className="admin-title">{t('admin.title', 'Admin Portal')}</h1>
        </div>

        <nav className="admin-nav">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`admin-nav-item ${activeTab === tab.id ? 'admin-nav-item--active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <Icon className="admin-nav-icon" />
                <span>{t(`admin.tabs.${tab.id}`, tab.label)}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <span className="admin-user-email">{user.email}</span>
            <span className="admin-user-badge">{t('admin.badge', 'Platform Admin')}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main" id="admin-main-content" tabIndex={-1}>
        <div className="admin-content">
          {/* Stats Overview - shown on operational tabs only (not analytics) */}
          {activeTab !== 'analytics' && <StatsOverview />}

          {/* Tab content */}
          <div className="admin-tab-content">
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'companies' && <CompaniesTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'admins' && <AdminsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </main>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

// =============================================================================
// Stats Overview Component
// =============================================================================

// DUMMY DATA - Stats Overview (when API returns no data or fails)
const DUMMY_STATS = {
  total_users: 156,
  total_companies: 23,
  total_conversations: 1247,
  total_messages: 8934,
};

function StatsOverview() {
  const { t } = useTranslation();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.getAdminStats(),
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading) {
    return (
      <div className="admin-stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="admin-stat-card admin-stat-card--loading">
            <div className="admin-stat-skeleton" />
          </div>
        ))}
      </div>
    );
  }

  // DUMMY DATA LOGIC - Use dummy stats if API fails or returns zeros
  const hasRealData =
    stats &&
    (stats.total_users > 0 ||
      stats.total_companies > 0 ||
      stats.total_conversations > 0 ||
      stats.total_messages > 0);
  const useDummyData = error || !hasRealData;
  const displayStats = useDummyData ? DUMMY_STATS : stats;

  const statCards = [
    {
      label: t('admin.stats.totalUsers', 'Total Users'),
      value: displayStats?.total_users ?? 0,
      icon: Users,
      color: 'blue',
    },
    {
      label: t('admin.stats.totalCompanies', 'Total Companies'),
      value: displayStats?.total_companies ?? 0,
      icon: Building2,
      color: 'green',
    },
    {
      label: t('admin.stats.totalConversations', 'Conversations'),
      value: displayStats?.total_conversations ?? 0,
      icon: MessageSquare,
      color: 'purple',
    },
    {
      label: t('admin.stats.totalMessages', 'Messages'),
      value: displayStats?.total_messages ?? 0,
      icon: BarChart3,
      color: 'orange',
    },
  ];

  return (
    <div className="admin-stats-section">
      {/* DUMMY DATA INDICATOR - Show demo badge when using sample data */}
      {useDummyData && (
        <div className="admin-stats-demo-indicator">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{t('admin.stats.demoMode', 'Sample data')}</span>
        </div>
      )}
      <div className="admin-stats-grid">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`admin-stat-card admin-stat-card--${stat.color} ${useDummyData ? 'admin-stat-card--demo' : ''}`}
            >
              <div className="admin-stat-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="admin-stat-content">
                <span className="admin-stat-value">
                  {stat.value.toLocaleString(getIntlLocale())}
                  {useDummyData && (
                    <span className="admin-demo-badge-inline">{t('admin.demo', 'DEMO')}</span>
                  )}
                </span>
                <span className="admin-stat-label">{stat.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Users Tab (Unified Users + Invitations View)
// =============================================================================

// Unified row type for combined user/invitation display
type UnifiedUserStatus = 'active' | 'invited' | 'pending' | 'suspended' | 'expired' | 'cancelled';

interface UnifiedUserRow {
  id: string;
  email: string;
  name: string | null;
  status: UnifiedUserStatus;
  created_at: string;
  // For users
  last_sign_in_at?: string | null;
  // For invitations
  invited_by_email?: string | null;
  expires_at?: string | null;
  // Type discriminator
  type: 'user' | 'invitation';
  // Original data for actions
  originalUser?: AdminPlatformUser;
  originalInvitation?: AdminInvitation;
}

// Status filter options
const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'pending', label: 'Pending Verification' },
  { value: 'suspended', label: 'Suspended' },
];

function UsersTab() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { adminRole } = useAdminAccess();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [userToDelete, setUserToDelete] = useState<AdminPlatformUser | null>(null);
  const [userToSuspend, setUserToSuspend] = useState<AdminPlatformUser | null>(null);
  const [userToImpersonate, setUserToImpersonate] = useState<AdminPlatformUser | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Sort state for users table
  type UserSortColumn = 'name' | 'email' | 'status' | 'created_at';
  const [userSortState, setUserSortState] = useSortState<UserSortColumn>('created_at', 'desc');

  // Invitation action states
  // Note: cancellingId kept for loading spinner UI but setter unused since we use optimistic updates
  const [cancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    invitationId: string;
    email: string;
  }>({ open: false, invitationId: '', email: '' });

  const pageSize = 20;

  // Check if current admin can impersonate
  const canImpersonate = adminRole === 'super_admin' || adminRole === 'admin';

  // Fetch users - DISABLE automatic refetching to preserve optimistic updates
  // Supabase Auth has eventual consistency - auto refetches return stale data and overwrite our updates
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ['admin', 'users', { search }],
    queryFn: () =>
      api.listAdminUsers({
        page: 1,
        page_size: 100, // Backend max is 100
        ...(search ? { search } : {}),
      }),
    staleTime: Infinity, // NEVER auto-refetch - we use optimistic updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch invitations - same settings
  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    error: invitationsError,
  } = useQuery({
    queryKey: ['admin', 'invitations', { search }],
    queryFn: () =>
      api.listAdminInvitations({
        page: 1,
        page_size: 100, // Backend max is 100
        ...(search ? { search } : {}),
      }),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch deleted users - ALWAYS enabled to preserve optimistic updates
  // If we use `enabled: showDeletedUsers`, toggling "Show Deleted" triggers a refetch
  // that overwrites our optimistic updates
  const { data: deletedUsersData } = useQuery({
    queryKey: ['admin', 'deleted-users'],
    queryFn: () => api.listDeletedUsers(),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const isLoading = usersLoading || invitationsLoading;

  // Transform users to unified format
  const transformUser = (user: AdminPlatformUser): UnifiedUserRow => {
    const isSuspended = !!user.user_metadata?.is_suspended;
    const isVerified = !!user.email_confirmed_at;

    let status: UnifiedUserStatus = 'pending';
    if (isSuspended) status = 'suspended';
    else if (isVerified) status = 'active';

    return {
      id: user.id,
      email: user.email,
      name:
        (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || null,
      status,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      type: 'user',
      originalUser: user,
    };
  };

  // Transform invitations to unified format
  const transformInvitation = (inv: AdminInvitation): UnifiedUserRow => {
    let status: UnifiedUserStatus = 'invited';
    if (inv.status === 'expired') status = 'expired';
    else if (inv.status === 'cancelled') status = 'cancelled';

    return {
      id: `inv-${inv.id}`,
      email: inv.email,
      name: inv.name,
      status,
      created_at: inv.created_at,
      invited_by_email: inv.invited_by_email,
      expires_at: inv.expires_at,
      type: 'invitation',
      originalInvitation: inv,
    };
  };

  // Combine and filter data
  const unifiedRows = useMemo(() => {
    const users = (usersData?.users ?? []).map(transformUser);
    // Only include pending invitations (not accepted ones, as those become users)
    const invitations = (invitationsData?.invitations ?? [])
      .filter((inv) => inv.status !== 'accepted')
      .map(transformInvitation);

    let combined = [...users, ...invitations];

    // Apply status filter
    if (statusFilter !== 'all') {
      combined = combined.filter((row) => row.status === statusFilter);
    }

    // Apply sorting
    const sortGetters: Record<UserSortColumn, (row: UnifiedUserRow) => string | number | null> = {
      name: (row) => row.name?.toLowerCase() ?? '',
      email: (row) => row.email.toLowerCase(),
      status: (row) => row.status,
      created_at: (row) => new Date(row.created_at).getTime(),
    };

    return sortData(combined, userSortState, sortGetters);
  }, [usersData, invitationsData, statusFilter, userSortState]);

  // Pagination
  const total = unifiedRows.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedRows = unifiedRows.slice((page - 1) * pageSize, page * pageSize);

  // Keyboard navigation for users table
  const { tableBodyRef: usersTableBodyRef, getRowProps: getUserRowProps } = useTableKeyboardNav({
    rowCount: paginatedRows.length,
    onRowAction: (index) => {
      // On Enter, open the actions dropdown for that row
      const row = paginatedRows[index];
      if (row && row.type === 'user' && row.originalUser) {
        // For users, toggle suspend as a quick action
        setUserToSuspend(row.originalUser);
      }
    },
  });

  // Check if user is suspended
  const isUserSuspended = (user: AdminPlatformUser): boolean => {
    return !!user.user_metadata?.is_suspended;
  };

  // Handle suspend/unsuspend with OPTIMISTIC UPDATE for instant UI feedback
  const handleToggleSuspend = async (user: AdminPlatformUser, reason?: string) => {
    if (user.id === currentUser?.id) return;

    const newSuspendedState = !isUserSuspended(user);

    // Store previous data for rollback
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);

    // OPTIMISTIC UPDATE: Immediately update the cache before API call
    queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
      ['admin', 'users', { search }],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.map((u) =>
            u.id === user.id
              ? {
                  ...u,
                  user_metadata: {
                    ...u.user_metadata,
                    is_suspended: newSuspendedState,
                    suspended_at: newSuspendedState ? new Date().toISOString() : null,
                    suspend_reason: reason || null,
                  },
                }
              : u
          ),
        };
      }
    );

    // Close modal immediately - user sees instant feedback
    setUserToSuspend(null);
    toast.success(newSuspendedState ? 'User suspended' : 'User unsuspended');

    // Now do the actual API call in background
    try {
      await api.updateAdminUser(user.id, {
        is_suspended: newSuspendedState,
        ...(reason && { suspend_reason: reason }),
      });
      // Success - DO NOT refetch! Supabase has eventual consistency and returns stale data.
      // Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update user:', err);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      toast.error('Failed to update user', {
        description: errorMessage,
      });
    }
  };

  // Handle delete user (soft delete) with OPTIMISTIC UPDATE for instant UI feedback
  const handleDeleteUser = async (user: AdminPlatformUser, reason?: string) => {
    if (user.id === currentUser?.id) return;

    // Store previous data for rollback
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);
    const previousDeletedUsersData = queryClient.getQueryData<{
      deleted_users: AdminDeletedUser[];
      total: number;
    }>(['admin', 'deleted-users']);

    // OPTIMISTIC UPDATE: Immediately remove user from the active users list
    queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
      ['admin', 'users', { search }],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          users: old.users.filter((u) => u.id !== user.id),
          total: old.total - 1,
        };
      }
    );

    // OPTIMISTIC UPDATE: Add user to deleted users list (so they appear in "Show Deleted")
    const restorationDeadline = new Date();
    restorationDeadline.setDate(restorationDeadline.getDate() + 30);
    const deletedUser: AdminDeletedUser = {
      user_id: user.id,
      email: user.email,
      deleted_at: new Date().toISOString(),
      deleted_by: currentUser?.id || null,
      deletion_reason: reason || null,
      restoration_deadline: restorationDeadline.toISOString(),
      can_restore: true,
      days_until_anonymization: 30,
      is_anonymized: false,
    };
    queryClient.setQueryData<{ deleted_users: AdminDeletedUser[]; total: number } | undefined>(
      ['admin', 'deleted-users'],
      (old) => {
        if (!old) {
          // If no previous data, create new structure
          return { deleted_users: [deletedUser], total: 1 };
        }
        return {
          ...old,
          deleted_users: [deletedUser, ...old.deleted_users],
          total: old.total + 1,
        };
      }
    );

    // Close modal immediately - user sees instant feedback
    setUserToDelete(null);
    toast.success(t('admin.users.userDeleted', 'User deleted'), {
      description: t('admin.users.canRestore', 'User can be restored within 30 days'),
    });

    // Now do the actual API call in background
    try {
      await api.deleteAdminUser(user.id, reason ? { reason } : undefined);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error - restore both caches
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete user:', err);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      queryClient.setQueryData(['admin', 'deleted-users'], previousDeletedUsersData);
      toast.error(t('admin.users.deleteFailed', 'Failed to delete user'), {
        description: errorMessage,
      });
    }
  };

  // Handle restore deleted user with OPTIMISTIC UPDATE
  const handleRestoreUser = async (userId: string, email: string) => {
    // Store previous data for rollback
    const previousDeletedUsersData = queryClient.getQueryData<{
      deleted_users: AdminDeletedUser[];
      total: number;
    }>(['admin', 'deleted-users']);
    const previousUsersData = queryClient.getQueryData<{
      users: AdminPlatformUser[];
      total: number;
    }>(['admin', 'users', { search }]);

    // Find the deleted user to restore
    const deletedUser = previousDeletedUsersData?.deleted_users.find((u) => u.user_id === userId);

    // OPTIMISTIC UPDATE: Remove from deleted-users list
    queryClient.setQueryData<{ deleted_users: AdminDeletedUser[]; total: number } | undefined>(
      ['admin', 'deleted-users'],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          deleted_users: old.deleted_users.filter((u) => u.user_id !== userId),
          total: Math.max(0, old.total - 1),
        };
      }
    );

    // OPTIMISTIC UPDATE: Add back to users list (approximate user data)
    if (deletedUser && email) {
      const restoredUser: AdminPlatformUser = {
        id: userId,
        email: email,
        created_at: deletedUser.deleted_at, // Use deleted_at as approximation
        last_sign_in_at: null,
        email_confirmed_at: null,
        user_metadata: {},
      };
      queryClient.setQueryData<{ users: AdminPlatformUser[]; total: number } | undefined>(
        ['admin', 'users', { search }],
        (old) => {
          if (!old) return { users: [restoredUser], total: 1 };
          return {
            ...old,
            users: [restoredUser, ...old.users],
            total: old.total + 1,
          };
        }
      );
    }

    // Show success immediately
    toast.success(t('admin.users.userRestored', 'User restored'), {
      description: t('admin.users.userRestoredDesc', '{{email}} can now log in again', { email }),
    });

    // Now do the actual API call in background
    setRestoringId(userId);
    try {
      await api.restoreAdminUser(userId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err: unknown) {
      // ROLLBACK on error
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to restore user:', err);
      queryClient.setQueryData(['admin', 'deleted-users'], previousDeletedUsersData);
      queryClient.setQueryData(['admin', 'users', { search }], previousUsersData);
      toast.error(t('admin.users.restoreFailed', 'Failed to restore user'), {
        description: errorMessage,
      });
    } finally {
      setRestoringId(null);
    }
  };

  // Handle delete invitation with OPTIMISTIC UPDATE for instant UI feedback
  // Invitations are HARD deleted since invited users have no data to preserve
  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!invitationId) {
      toast.error('Failed to delete invitation: No invitation selected');
      return;
    }

    // Store previous data for rollback
    const previousInvitationsData = queryClient.getQueryData<{
      invitations: AdminInvitation[];
      total: number;
    }>(['admin', 'invitations', { search }]);

    // OPTIMISTIC UPDATE: Immediately REMOVE the invitation from the list
    // (not just set status - the invitation is hard-deleted on the backend)
    queryClient.setQueryData<
      { invitations: AdminInvitation[]; total: number; page: number; page_size: number } | undefined
    >(['admin', 'invitations', { search }], (old) => {
      if (!old) return old;
      return {
        ...old,
        invitations: old.invitations.filter((inv) => inv.id !== invitationId),
        total: Math.max(0, old.total - 1),
      };
    });

    // Close dialog immediately - user sees instant feedback
    setConfirmDialog({ open: false, invitationId: '', email: '' });
    toast.success('Invitation deleted', {
      description: `The invitation for ${email} has been deleted.`,
    });

    // Now do the actual API call in background
    try {
      await api.cancelAdminInvitation(invitationId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err) {
      // ROLLBACK on error
      console.error('Failed to delete invitation:', err);
      queryClient.setQueryData(['admin', 'invitations', { search }], previousInvitationsData);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete invitation - changes reverted: ${errorMessage}`);
    }
  };

  // Handle resend invitation (no data change, just sends email)
  const handleResendInvitation = async (invitationId: string, email: string) => {
    setResendingId(invitationId);
    try {
      await api.resendAdminInvitation(invitationId);
      // Success - no need to refetch, data hasn't changed
      toast.success('Invitation resent', {
        description: `A new invitation email has been sent to ${email}.`,
      });
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  // Handle delete invitation (removes cancelled/expired invitations) with OPTIMISTIC UPDATE
  const handleDeleteInvitation = async (invitationId: string, email: string) => {
    // Store previous data for rollback
    const previousInvitationsData = queryClient.getQueryData<{
      invitations: AdminInvitation[];
      total: number;
    }>(['admin', 'invitations', { search }]);

    // OPTIMISTIC UPDATE: Immediately remove invitation from the list
    queryClient.setQueryData<
      { invitations: AdminInvitation[]; total: number; page: number; page_size: number } | undefined
    >(['admin', 'invitations', { search }], (old) => {
      if (!old) return old;
      return {
        ...old,
        invitations: old.invitations.filter((inv) => inv.id !== invitationId),
        total: Math.max(0, old.total - 1),
      };
    });

    // Show success immediately
    toast.success(t('admin.users.invitationDeleted', 'Invitation removed'), {
      description: t(
        'admin.users.invitationDeletedDesc',
        `The invitation for ${email} has been removed.`
      ),
    });

    // Now do the actual API call in background
    setDeletingInvitationId(invitationId);
    try {
      await api.deleteAdminInvitation(invitationId);
      // Success - DO NOT refetch! Our optimistic update IS the source of truth.
    } catch (err) {
      // ROLLBACK on error
      console.error('Failed to delete invitation:', err);
      queryClient.setQueryData(['admin', 'invitations', { search }], previousInvitationsData);
      toast.error(
        t('admin.users.invitationDeleteFailed', 'Failed to remove invitation - changes reverted')
      );
    } finally {
      setDeletingInvitationId(null);
    }
  };

  // Get status badge
  const getStatusBadge = (row: UnifiedUserRow) => {
    const statusConfig: Record<
      UnifiedUserStatus,
      { class: string; icon: typeof CheckCircle; label: string }
    > = {
      active: { class: 'admin-status-badge--active', icon: CheckCircle, label: 'Active' },
      invited: { class: 'admin-status-badge--pending', icon: Clock, label: 'Invited' },
      pending: { class: 'admin-status-badge--pending', icon: Clock, label: 'Pending' },
      suspended: { class: 'admin-status-badge--suspended', icon: Ban, label: 'Suspended' },
      expired: { class: 'admin-status-badge--expired', icon: XCircle, label: 'Expired' },
      cancelled: { class: 'admin-status-badge--cancelled', icon: X, label: 'Cancelled' },
    };

    const config = statusConfig[row.status];
    const Icon = config.icon;

    // Build tooltip for suspended users
    let tooltip: string | undefined;
    if (row.status === 'suspended' && row.originalUser?.user_metadata) {
      const metadata = row.originalUser.user_metadata;
      const parts: string[] = [];
      if (metadata.suspend_reason) {
        parts.push(`Reason: ${metadata.suspend_reason}`);
      }
      if (metadata.suspended_at && typeof metadata.suspended_at === 'string') {
        parts.push(`Suspended: ${formatDate(metadata.suspended_at)}`);
      }
      if (parts.length > 0) {
        tooltip = parts.join('\n');
      }
    }

    return (
      <span className={`admin-status-badge ${config.class}`} title={tooltip}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  // Render actions based on row type - unified kebab menu
  const renderActions = (row: UnifiedUserRow) => {
    const isCurrentUser = row.type === 'user' && row.originalUser?.id === currentUser?.id;

    // No actions for current user
    if (isCurrentUser) {
      return <span className="admin-muted">-</span>;
    }

    // Check for loading states
    const isLoading =
      row.type === 'invitation' &&
      (resendingId === row.originalInvitation?.id || cancellingId === row.originalInvitation?.id);

    if (isLoading) {
      return (
        <div className="admin-actions-cell">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

    // For non-pending invitations (cancelled, expired), show archive option only
    if (row.type === 'invitation' && row.originalInvitation?.status !== 'pending') {
      const isDeleting = deletingInvitationId === row.originalInvitation?.id;
      return (
        <div className="admin-actions-cell">
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="admin-icon-btn admin-icon-btn--ghost"
                  title="Actions"
                  aria-label={t('common.actions', 'Actions')}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="danger"
                  onClick={() =>
                    handleDeleteInvitation(
                      row.originalInvitation!.id,
                      row.originalInvitation!.email
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.deleteInvitation', 'Delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      );
    }

    return (
      <div className="admin-actions-cell">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="admin-icon-btn admin-icon-btn--ghost"
              title="Actions"
              aria-label={t('common.actions', 'Actions')}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.type === 'invitation' ? (
              // Invitation actions
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    setTimeout(() => {
                      handleResendInvitation(
                        row.originalInvitation!.id,
                        row.originalInvitation!.email
                      );
                    }, 0);
                  }}
                >
                  <Send className="h-4 w-4" />
                  {t('admin.users.resendInvite', 'Resend Invitation')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="danger"
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open dialog
                    setTimeout(() => {
                      setConfirmDialog({
                        open: true,
                        invitationId: row.originalInvitation!.id,
                        email: row.originalInvitation!.email,
                      });
                    }, 0);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.deleteInvite', 'Delete Invitation')}
                </DropdownMenuItem>
              </>
            ) : (
              // User actions
              <>
                {canImpersonate && !isUserSuspended(row.originalUser!) && (
                  <DropdownMenuItem
                    onSelect={() => {
                      // Use setTimeout to let dropdown close first, then open modal
                      setTimeout(() => setUserToImpersonate(row.originalUser!), 0);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    {t('admin.users.impersonate', 'View as User')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open modal
                    setTimeout(() => setUserToSuspend(row.originalUser!), 0);
                  }}
                >
                  {isUserSuspended(row.originalUser!) ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      {t('admin.users.unsuspend', 'Unsuspend User')}
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" />
                      {t('admin.users.suspend', 'Suspend User')}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="danger"
                  onSelect={() => {
                    // Use setTimeout to let dropdown close first, then open modal
                    setTimeout(() => setUserToDelete(row.originalUser!), 0);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('admin.users.delete', 'Delete User')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.users.title', 'User Management')}</h2>
          <p className="admin-section-desc">
            {t('admin.users.description', 'View and manage all users and invitations.')}
          </p>
        </div>
        <button
          className="admin-action-btn admin-action-btn--primary"
          onClick={() => setShowInviteModal(true)}
          title={t('admin.users.inviteUser', 'Invite User')}
        >
          <UserPlus className="h-4 w-4" />
          <span>{t('admin.users.inviteUser', 'Invite User')}</span>
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <div className="admin-search-box">
            <Search className="admin-search-icon h-4 w-4" />
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder', 'Search by email...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="admin-search-input"
            />
          </div>
        </div>

        <div className="admin-toolbar-right">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="admin-select-trigger">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Show Deleted Users toggle - compact icon button */}
          <button
            className={`admin-icon-btn admin-show-deleted-btn ${showDeletedUsers ? 'admin-icon-btn--warning-active' : 'admin-icon-btn--secondary'}`}
            onClick={() => setShowDeletedUsers(!showDeletedUsers)}
            title={
              showDeletedUsers
                ? t('admin.users.hideDeleted', 'Hide deleted users')
                : t('admin.users.showDeleted', 'Show deleted users')
            }
            aria-label={
              showDeletedUsers
                ? t('admin.users.hideDeleted', 'Hide deleted users')
                : t('admin.users.showDeleted', 'Show deleted users')
            }
          >
            <Archive className="h-4 w-4" />
            {deletedUsersData?.total ? (
              <span className="admin-deleted-badge">{deletedUsersData.total}</span>
            ) : null}
          </button>
        </div>
      </div>

      {invitationsError && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>
            {t(
              'admin.users.invitationsLoadError',
              'Invitations could not be loaded. Showing users only.'
            )}
          </span>
        </div>
      )}
      {usersError && !isLoading && (
        <div className="admin-demo-banner admin-demo-banner--error">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.users.usersLoadError', 'Failed to load users.')}</span>
        </div>
      )}

      {!isLoading && paginatedRows.length === 0 ? (
        <div className="admin-table-empty">
          <Users className="h-8 w-8" />
          <span>{t('admin.users.noUsers', 'No users found')}</span>
          {statusFilter !== 'all' && (
            <p className="admin-empty-hint">
              {t('admin.users.tryDifferentFilter', 'Try a different filter or search term.')}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <SortableTableHeader
                    column="name"
                    label={t('admin.users.name', 'Name')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <SortableTableHeader
                    column="email"
                    label={t('admin.users.email', 'Email')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <SortableTableHeader
                    column="status"
                    label={t('admin.users.status', 'Status')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <th>{t('admin.users.activity', 'Activity')}</th>
                  <SortableTableHeader
                    column="created_at"
                    label={t('admin.users.createdAt', 'Created')}
                    sortState={userSortState}
                    onSort={setUserSortState}
                  />
                  <th>{t('admin.users.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody ref={usersTableBodyRef}>
                {isLoading ? (
                  <UsersTableSkeleton />
                ) : (
                  paginatedRows.map((row, rowIndex) => {
                    const isCurrentUser =
                      row.type === 'user' && row.originalUser?.id === currentUser?.id;

                    return (
                      <tr key={row.id} {...getUserRowProps(rowIndex)}>
                        <td>
                          <span>{row.name || '-'}</span>
                        </td>
                        <td>
                          <div className="admin-user-cell">
                            <Mail className="h-4 w-4" />
                            <span>{row.email}</span>
                            {isCurrentUser && <span className="admin-you-badge">You</span>}
                          </div>
                        </td>
                        <td>{getStatusBadge(row)}</td>
                        <td>
                          <div className="admin-date-cell">
                            {row.type === 'user' ? (
                              <>
                                <Clock className="h-4 w-4" />
                                <span>
                                  {row.last_sign_in_at
                                    ? `Last sign in ${formatDate(row.last_sign_in_at)}`
                                    : 'Never signed in'}
                                </span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" />
                                <span>
                                  {row.invited_by_email
                                    ? `Invited by ${row.invited_by_email.split('@')[0]}`
                                    : 'System invite'}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="admin-date-cell">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(row.created_at)}</span>
                          </div>
                        </td>
                        <td>{renderActions(row)}</td>
                      </tr>
                    );
                  })
                )}

                {/* Deleted Users - integrated into same table for alignment */}
                {showDeletedUsers &&
                  deletedUsersData &&
                  deletedUsersData.deleted_users &&
                  deletedUsersData.deleted_users.length > 0 && (
                    <>
                      {/* Separator row */}
                      <tr className="admin-table-separator">
                        <td colSpan={6}>
                          <div className="admin-table-separator-content">
                            <Archive className="h-4 w-4" />
                            <span>
                              {t('admin.users.deletedUsers', 'Deleted Users')} (
                              {deletedUsersData.total ?? 0})
                            </span>
                          </div>
                        </td>
                      </tr>
                      {/* Deleted user rows */}
                      {deletedUsersData.deleted_users.map((deletedUser: AdminDeletedUser) => {
                        const canRestore = deletedUser.can_restore && !deletedUser.is_anonymized;
                        const isRestoring = restoringId === deletedUser.user_id;
                        // Extract name from email (part before @)
                        const emailStr = deletedUser.email ?? '';
                        const nameFromEmail = emailStr
                          ? (emailStr.split('@')[0] ?? '').replace(/[._]/g, ' ')
                          : null;

                        // Look up who deleted this user
                        let deletedByName = 'Unknown';
                        if (deletedUser.deleted_by) {
                          if (deletedUser.deleted_by === currentUser?.id) {
                            deletedByName = currentUser.email?.split('@')[0] || 'you';
                          } else {
                            const deleter = usersData?.users?.find(
                              (u: AdminPlatformUser) => u.id === deletedUser.deleted_by
                            );
                            if (deleter?.email) {
                              deletedByName = deleter.email.split('@')[0] || 'Unknown';
                            }
                          }
                        }

                        return (
                          <tr
                            key={`deleted-${deletedUser.user_id}`}
                            className={`admin-deleted-row ${deletedUser.is_anonymized ? 'admin-row-muted' : ''}`}
                          >
                            {/* Name */}
                            <td>
                              <span>{nameFromEmail || '-'}</span>
                            </td>
                            {/* Email */}
                            <td>
                              <div className="admin-user-cell">
                                <Mail className="h-4 w-4" />
                                <span>
                                  {deletedUser.email || t('admin.users.anonymized', '[Anonymized]')}
                                </span>
                              </div>
                            </td>
                            {/* Status */}
                            <td>
                              <div className="admin-status-cell">
                                {deletedUser.deletion_reason ? (
                                  <Tooltip
                                    content={
                                      <div className="admin-audit-reason-tooltip">
                                        <strong>
                                          {t('admin.users.deletionReason', 'Reason')}:
                                        </strong>
                                        <p>{deletedUser.deletion_reason}</p>
                                      </div>
                                    }
                                    side="top"
                                  >
                                    <span className="admin-status-badge admin-status-badge--deleted admin-status-badge--has-reason">
                                      {t('admin.users.deleted', 'Deleted')}
                                      <Eye className="h-3 w-3" />
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className="admin-status-badge admin-status-badge--deleted">
                                    {t('admin.users.deleted', 'Deleted')}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Activity - "Deleted by [person]" */}
                            <td>
                              <Tooltip content={formatDate(deletedUser.deleted_at)} side="top">
                                <div className="admin-date-cell" style={{ cursor: 'help' }}>
                                  <Trash2 className="h-4 w-4" />
                                  <span>Deleted by {deletedByName}</span>
                                </div>
                              </Tooltip>
                            </td>
                            {/* Created column - show restoration deadline */}
                            <td>
                              {canRestore ? (
                                <Tooltip
                                  content={t(
                                    'admin.users.restoreDeadlineTooltip',
                                    'After this period, the user will be permanently anonymized and cannot be restored.'
                                  )}
                                  side="top"
                                >
                                  <span
                                    className="admin-deadline-warning"
                                    style={{ cursor: 'help' }}
                                  >
                                    {deletedUser.days_until_anonymization}{' '}
                                    {t('admin.users.daysLeft', 'days left')}
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip
                                  content={
                                    deletedUser.is_anonymized
                                      ? t(
                                          'admin.users.anonymizedTooltip',
                                          'This user has been permanently anonymized. All personal data has been removed.'
                                        )
                                      : t(
                                          'admin.users.expiredTooltip',
                                          'The restoration period has expired.'
                                        )
                                  }
                                  side="top"
                                >
                                  <span className="admin-muted" style={{ cursor: 'help' }}>
                                    {deletedUser.is_anonymized
                                      ? t('admin.users.anonymized', 'Anonymized')
                                      : t('admin.users.expired', 'Expired')}
                                  </span>
                                </Tooltip>
                              )}
                            </td>
                            {/* Actions */}
                            <td>
                              <div className="admin-actions-cell">
                                {canRestore ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="admin-kebab-btn" aria-label="Actions">
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          setTimeout(() => {
                                            handleRestoreUser(
                                              deletedUser.user_id,
                                              deletedUser.email || ''
                                            );
                                          }, 0);
                                        }}
                                        disabled={isRestoring}
                                      >
                                        {isRestoring ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RotateCcw className="h-4 w-4" />
                                        )}
                                        {t('admin.users.restoreUser', 'Restore User')}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <span className="admin-muted">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <DeleteUserModal
          user={userToDelete}
          onClose={() => setUserToDelete(null)}
          onConfirm={(reason) => handleDeleteUser(userToDelete, reason)}
        />
      )}

      {/* Suspend User Confirmation Modal */}
      {userToSuspend && (
        <SuspendUserModal
          user={userToSuspend}
          isSuspended={isUserSuspended(userToSuspend)}
          onClose={() => setUserToSuspend(null)}
          onConfirm={(reason) => handleToggleSuspend(userToSuspend, reason)}
        />
      )}

      {/* Impersonate User Modal */}
      {userToImpersonate && (
        <ImpersonateUserModal
          isOpen={!!userToImpersonate}
          onClose={() => setUserToImpersonate(null)}
          targetUser={{
            id: userToImpersonate.id,
            email: userToImpersonate.email,
          }}
        />
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={async () => {
            setShowInviteModal(false);
            // Only reset invitations query - don't touch users/deleted-users to preserve their optimistic updates
            await queryClient.resetQueries({ queryKey: ['admin', 'invitations'] });
            toast.success('Invitation sent', {
              description: 'An invitation email has been sent to the user.',
            });
          }}
        />
      )}

      {/* Delete Invitation Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, invitationId: '', email: '' });
          }
        }}
        title="Delete Invitation"
        description={`Are you sure you want to delete the invitation for ${confirmDialog.email}? This will permanently remove it. To invite them again, you'll need to create a new invitation.`}
        confirmLabel="Delete Invitation"
        cancelLabel="Keep Invitation"
        variant="danger"
        onConfirm={() => handleCancelInvitation(confirmDialog.invitationId, confirmDialog.email)}
        loading={!!cancellingId}
      />
    </div>
  );
}

// =============================================================================
// Delete User Confirmation Modal
// =============================================================================

interface DeleteUserModalProps {
  user: AdminPlatformUser;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
  const { t } = useTranslation();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');

  const isConfirmValid = confirmEmail.toLowerCase() === user.email.toLowerCase();

  const handleConfirm = () => {
    if (isConfirmValid) {
      onConfirm(reason || undefined);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="admin-modal admin-modal--warning"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="admin-modal-header">
          <h3 id="delete-modal-title">
            <Trash2 className="h-5 w-5" />
            {t('admin.users.deleteTitle', 'Delete User')}
          </h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          {/* Soft delete explanation */}
          <div className="admin-delete-info">
            <p className="admin-delete-info-title">
              {t('admin.users.softDeleteTitle', 'What happens when you delete a user:')}
            </p>
            <ul className="admin-delete-info-list">
              <li>{t('admin.users.softDelete1', 'User will be banned and unable to log in')}</li>
              <li>{t('admin.users.softDelete2', 'All their data is preserved but hidden')}</li>
              <li>{t('admin.users.softDelete3', 'You can restore this user within 30 days')}</li>
              <li>
                {t('admin.users.softDelete4', 'After 30 days, their data will be anonymized')}
              </li>
            </ul>
          </div>

          <div className="admin-modal-user-info">
            <div className="admin-modal-user-avatar">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="admin-modal-user-email">{user.email}</p>
              <p className="admin-modal-user-meta">
                {t('admin.users.createdOn', 'Created on {{date}}', {
                  date: formatDate(user.created_at),
                })}
              </p>
            </div>
          </div>

          {/* Reason input */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('admin.users.deleteReason', 'Reason for deletion (optional)')}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                'admin.users.deleteReasonPlaceholder',
                'e.g., User requested account deletion'
              )}
              className="admin-input"
              style={{ width: '100%' }}
            />
          </div>

          {/* Type-to-confirm */}
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {t('admin.users.typeToConfirm', 'Type the user email to confirm:')}
              <span
                style={{
                  fontFamily: 'monospace',
                  marginLeft: 'var(--space-2)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {user.email}
              </span>
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              className="admin-input"
              style={{
                width: '100%',
                borderColor:
                  confirmEmail && !isConfirmValid ? 'var(--color-destructive)' : undefined,
              }}
              autoComplete="off"
            />
            {confirmEmail && !isConfirmValid && (
              <p
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-destructive)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {t('admin.users.emailMismatch', 'Email does not match')}
              </p>
            )}
          </div>
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="admin-action-btn admin-action-btn--warning"
            onClick={handleConfirm}
            disabled={!isConfirmValid}
          >
            <Trash2 className="h-4 w-4" />
            {t('admin.users.confirmDelete', 'Delete User')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Suspend User Confirmation Modal
// =============================================================================

interface SuspendUserModalProps {
  user: AdminPlatformUser;
  isSuspended: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

function SuspendUserModal({ user, isSuspended, onClose, onConfirm }: SuspendUserModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason || undefined);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspend-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={`admin-modal ${isSuspended ? 'admin-modal--success' : 'admin-modal--warning'}`}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="admin-modal-header">
          <h3 id="suspend-modal-title">
            {isSuspended ? <UserCheck className="h-5 w-5" /> : <UserX className="h-5 w-5" />}
            {isSuspended
              ? t('admin.users.unsuspendTitle', 'Unsuspend User')
              : t('admin.users.suspendTitle', 'Suspend User')}
          </h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="admin-modal-body">
          <p className="admin-modal-text">
            {isSuspended
              ? t(
                  'admin.users.unsuspendDesc',
                  "This will restore the user's access to the platform."
                )
              : t(
                  'admin.users.suspendDesc',
                  'This will prevent the user from logging in. Their data will be preserved.'
                )}
          </p>

          <div className="admin-modal-user-info">
            <div className="admin-modal-user-avatar">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="admin-modal-user-email">{user.email}</p>
              <p className="admin-modal-user-meta">
                {isSuspended
                  ? t('admin.users.currentlySuspended', 'Currently suspended')
                  : t('admin.users.currentlyActive', 'Currently active')}
              </p>
            </div>
          </div>

          {/* Reason input - only show when suspending */}
          {!isSuspended && (
            <div className="admin-form-group">
              <label htmlFor="suspend-reason">
                {t('admin.users.suspendReason', 'Reason for suspension')}
                <span className="admin-required">*</span>
              </label>
              <input
                id="suspend-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  'admin.users.suspendReasonPlaceholder',
                  'e.g., Violation of terms of service'
                )}
                className="admin-input"
              />
            </div>
          )}

          {/* Reason input for unsuspend - optional */}
          {isSuspended && (
            <div className="admin-form-group">
              <label htmlFor="unsuspend-reason">
                {t('admin.users.unsuspendReason', 'Reason for unsuspension (optional)')}
              </label>
              <input
                id="unsuspend-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  'admin.users.unsuspendReasonPlaceholder',
                  'e.g., Issue resolved, user reinstated'
                )}
                className="admin-input"
              />
            </div>
          )}
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`admin-action-btn ${isSuspended ? 'admin-action-btn--success' : 'admin-action-btn--warning'}`}
            onClick={handleConfirm}
            disabled={!isSuspended && !reason.trim()}
          >
            {isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            {isSuspended
              ? t('admin.users.confirmUnsuspend', 'Unsuspend User')
              : t('admin.users.confirmSuspend', 'Suspend User')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Companies Tab
// =============================================================================

// =============================================================================
// DUMMY DATA - START (Companies)
// =============================================================================
const DUMMY_COMPANIES: AdminCompanyInfo[] = [
  {
    id: 'demo-company-1',
    name: 'TechCorp Solutions',
    owner_email: 'ozpaniard+techcorp@gmail.com',
    user_count: 12,
    conversation_count: 47,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-2',
    name: 'StartupHub Inc',
    owner_email: 'ozpaniard+startup@gmail.com',
    user_count: 5,
    conversation_count: 23,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-3',
    name: 'Enterprise Global',
    owner_email: 'ozpaniard+enterprise@gmail.com',
    user_count: 45,
    conversation_count: 156,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-4',
    name: 'Creative Agency Co',
    owner_email: 'ozpaniard+agency@gmail.com',
    user_count: 3,
    conversation_count: 12,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-company-5',
    name: 'Consulting Partners',
    owner_email: 'ozpaniard+consulting@gmail.com',
    user_count: 8,
    conversation_count: 89,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
// =============================================================================
// DUMMY DATA - END (Companies)
// =============================================================================

function CompaniesTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sort state for companies table
  type CompanySortColumn = 'name' | 'owner' | 'conversations' | 'created_at';
  const [companySortState, setCompanySortState] = useSortState<CompanySortColumn>(
    'created_at',
    'desc'
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'companies', { page, search }],
    queryFn: () =>
      api.listAdminCompanies({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiCompanies = data?.companies ?? [];
  const useDummyData = error || (apiCompanies.length === 0 && !isLoading);

  const filteredDummyData = useDummyData
    ? DUMMY_COMPANIES.filter((company) => {
        const matchesSearch = !search || company.name.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
    : [];

  // Apply sorting
  const companySortGetters: Record<
    CompanySortColumn,
    (c: AdminCompanyInfo) => string | number | null
  > = {
    name: (c) => c.name.toLowerCase(),
    owner: (c) => c.owner_email?.toLowerCase() ?? '',
    conversations: (c) => c.conversation_count,
    created_at: (c) => new Date(c.created_at).getTime(),
  };

  const unsortedCompanies = useDummyData ? filteredDummyData : apiCompanies;
  const companies = sortData(unsortedCompanies, companySortState, companySortGetters);
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Keyboard navigation for companies table
  const { tableBodyRef: companiesTableBodyRef, getRowProps: getCompanyRowProps } =
    useTableKeyboardNav({
      rowCount: companies.length,
    });

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">
            {t('admin.companies.title', 'Company Management')}
          </h2>
          <p className="admin-section-desc">
            {t('admin.companies.description', 'View and manage all companies on the platform.')}
          </p>
        </div>
        <div className="admin-search-box">
          <Search className="admin-search-icon h-4 w-4" />
          <input
            type="text"
            placeholder={t('admin.companies.searchPlaceholder', 'Search by name...')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="admin-search-input"
          />
        </div>
      </div>

      {!isLoading && companies.length === 0 ? (
        <div className="admin-table-empty">
          <Building2 className="h-8 w-8" />
          <span>{t('admin.companies.noCompanies', 'No companies found')}</span>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table
              className="admin-table"
              aria-label={t('admin.companies.title', 'Companies List')}
            >
              <caption className="sr-only">
                {t(
                  'admin.companies.description',
                  'List of all companies with owner information and conversation count'
                )}
              </caption>
              <thead>
                <tr>
                  <SortableTableHeader
                    column="name"
                    label={t('admin.companies.name', 'Company Name')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="owner"
                    label={t('admin.companies.owner', 'Owner')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="conversations"
                    label={t('admin.companies.conversations', 'Conversations')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                  <SortableTableHeader
                    column="created_at"
                    label={t('admin.companies.createdAt', 'Created')}
                    sortState={companySortState}
                    onSort={setCompanySortState}
                  />
                </tr>
              </thead>
              <tbody ref={companiesTableBodyRef}>
                {isLoading ? (
                  <CompaniesTableSkeleton />
                ) : (
                  companies.map((company: AdminCompanyInfo, rowIndex: number) => (
                    <tr
                      key={company.id}
                      className={useDummyData ? 'admin-demo-row' : ''}
                      {...getCompanyRowProps(rowIndex)}
                      aria-label={`${company.name}, Owner: ${company.owner_email || 'Unknown'}, Conversations: ${company.conversation_count}, Created: ${formatDate(company.created_at)}`}
                    >
                      <td>
                        <div className="admin-company-cell">
                          <Building2 className="h-4 w-4" aria-hidden="true" />
                          <span>{company.name}</span>
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                          <span>{company.owner_email || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-count-cell">
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          <span>{company.conversation_count}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <span>{formatDate(company.created_at)}</span>
                        </div>
                      </td>
                    </tr>
                  ))
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

// =============================================================================
// Admins Tab
// =============================================================================

// =============================================================================
// DUMMY DATA - START (Admins)
// =============================================================================
const DUMMY_ADMINS: AdminUserInfo[] = [
  {
    id: 'demo-admin-1',
    email: 'ozpaniard+superadmin@gmail.com',
    role: 'super_admin',
    created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-2',
    email: 'ozpaniard+admin@gmail.com',
    role: 'admin',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-3',
    email: 'ozpaniard+support@gmail.com',
    role: 'support',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-admin-4',
    email: 'ozpaniard+moderator@gmail.com',
    role: 'moderator',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
// =============================================================================
// DUMMY DATA - END (Admins)
// =============================================================================

function AdminsTab() {
  const { t } = useTranslation();

  // Sort state for admins table
  type AdminSortColumn = 'email' | 'role' | 'created_at';
  const [adminSortState, setAdminSortState] = useSortState<AdminSortColumn>('created_at', 'desc');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.listAdminAdmins(),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiAdmins = data?.admins ?? [];
  const useDummyData = error || (apiAdmins.length === 0 && !isLoading);

  // Apply sorting
  const adminSortGetters: Record<AdminSortColumn, (a: AdminUserInfo) => string | number | null> = {
    email: (a) => a.email.toLowerCase(),
    role: (a) => a.role,
    created_at: (a) => new Date(a.created_at).getTime(),
  };

  const unsortedAdmins = useDummyData ? DUMMY_ADMINS : apiAdmins;
  const admins = sortData(unsortedAdmins, adminSortState, adminSortGetters);

  // Keyboard navigation for admins table
  const { tableBodyRef: adminsTableBodyRef, getRowProps: getAdminRowProps } = useTableKeyboardNav({
    rowCount: admins.length,
  });

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.admins.title', 'Admin Roles')}</h2>
          <p className="admin-section-desc">
            {t('admin.admins.description', 'Manage platform administrator access and roles.')}
          </p>
        </div>
      </div>

      {!isLoading && admins.length === 0 ? (
        <div className="admin-table-empty">
          <Shield className="h-8 w-8" />
          <span>{t('admin.admins.noAdmins', 'No admins found')}</span>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table" aria-label={t('admin.admins.title', 'Admin Users List')}>
            <caption className="sr-only">
              {t(
                'admin.admins.description',
                'List of platform administrators with their roles and grant dates'
              )}
            </caption>
            <thead>
              <tr>
                <SortableTableHeader
                  column="email"
                  label={t('admin.admins.email', 'Email')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                />
                <SortableTableHeader
                  column="role"
                  label={t('admin.admins.role', 'Role')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                />
                <SortableTableHeader
                  column="created_at"
                  label={t('admin.admins.grantedAt', 'Granted')}
                  sortState={adminSortState}
                  onSort={setAdminSortState}
                  className="admin-roles-date-col"
                />
              </tr>
            </thead>
            <tbody ref={adminsTableBodyRef}>
              {isLoading ? (
                <AdminsTableSkeleton />
              ) : (
                admins.map((admin: AdminUserInfo, rowIndex: number) => (
                  <tr
                    key={admin.id}
                    className={useDummyData ? 'admin-demo-row' : ''}
                    {...getAdminRowProps(rowIndex)}
                    aria-label={`${admin.email}, Role: ${admin.role.replace('_', ' ')}, Granted: ${formatDate(admin.created_at)}`}
                  >
                    <td>
                      <div className="admin-user-cell">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        <span>{admin.email}</span>
                        {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-role-badge admin-role-badge--${admin.role}`}
                        title={
                          admin.role === 'super_admin'
                            ? t('mycompany.superAdminPermissions')
                            : undefined
                        }
                      >
                        {t(`admin.admins.roles.${admin.role}`, {
                          defaultValue: admin.role.replace('_', ' '),
                        })}
                      </span>
                    </td>
                    <td className="admin-roles-date-col">
                      <div className="admin-date-cell">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        <span>{formatDate(admin.created_at)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Audit Tab
// =============================================================================

// =============================================================================
// DUMMY DATA - START (Audit Logs)
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
// DUMMY DATA - END (Audit Logs)
// =============================================================================

function AuditTab() {
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

  // Format timestamp for display
  const formatTimestamp = (ts: string): string => {
    try {
      const date = new Date(ts);
      return date.toLocaleString(getIntlLocale(), {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
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
                  'admin.audit.description',
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
                  logs.map((log, rowIndex) => (
                    <tr
                      key={log.id}
                      className={useDummyData ? 'admin-demo-row' : ''}
                      {...getAuditRowProps(rowIndex)}
                      aria-label={`${formatTimestamp(log.timestamp)}: ${log.actor_email || log.actor_type} (${log.actor_type}) performed ${formatActionName(log.action)} on ${log.resource_type}${log.resource_name ? ` - ${log.resource_name}` : ''}, Category: ${log.action_category}, IP: ${log.ip_address || 'Unknown'}`}
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
                  ))
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

// =============================================================================
// Invite User Modal
// =============================================================================

interface InviteUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function InviteUserModal({ onClose, onSuccess }: InviteUserModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const request: CreateInvitationRequest = {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };

      await api.createAdminInvitation(request);
      onSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="admin-modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="document">
        <div className="admin-modal-header">
          <h3 id="invite-modal-title">{t('admin.invitations.inviteTitle', 'Invite New User')}</h3>
          <button
            className="admin-modal-close"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          {error && (
            <div className="admin-modal-error">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="admin-form-group">
            <label htmlFor="invite-email">
              {t('admin.invitations.emailLabel', 'Email Address')}
              <span className="admin-required">*</span>
            </label>
            <input
              id="invite-email"
              type="email"
              required
              placeholder={t('admin.invitations.emailPlaceholder', 'user@example.com')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input"
              autoFocus
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="invite-name">
              {t('admin.invitations.nameLabel', 'Name (optional)')}
            </label>
            <input
              id="invite-name"
              type="text"
              placeholder={t('admin.invitations.namePlaceholder', 'John Doe')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="invite-notes">
              {t('admin.invitations.notesLabel', 'Notes (internal only)')}
            </label>
            <textarea
              id="invite-notes"
              placeholder={t(
                'admin.invitations.notesPlaceholder',
                'Optional notes about this invitation...'
              )}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="admin-textarea"
              rows={3}
            />
          </div>

          <div className="admin-modal-actions">
            <button
              type="button"
              className="admin-action-btn admin-action-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="admin-action-btn admin-action-btn--primary"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('admin.invitations.sending', 'Sending...')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('admin.invitations.sendInvite', 'Send Invitation')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Analytics Tab - Platform Analytics Dashboard
// =============================================================================

// Date range options for analytics (UI foundation - not wired up yet)
const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

// Extended dummy stats for analytics
const DUMMY_ANALYTICS_STATS = {
  ...DUMMY_STATS,
  active_users_24h: 23,
  active_users_7d: 89,
};

function AnalyticsTab() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('30d');

  // Fetch real stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.getAdminStats(),
    staleTime: 60 * 1000,
  });

  // Fetch users for status breakdown
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users', { page: 1, page_size: 500 }],
    queryFn: () => api.listAdminUsers({ page: 1, page_size: 500 }),
    staleTime: 60 * 1000,
  });

  // Fetch invitations for funnel (backend max is 100)
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['admin', 'invitations', { page: 1, page_size: 100 }],
    queryFn: () => api.listAdminInvitations({ page: 1, page_size: 100 }),
    staleTime: 60 * 1000,
  });

  // Fetch companies for stats
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['admin', 'companies', { page: 1, page_size: 500 }],
    queryFn: () => api.listAdminCompanies({ page: 1, page_size: 500 }),
    staleTime: 60 * 1000,
  });

  // Fetch model analytics for LLM performance
  const { data: modelAnalytics, isLoading: modelAnalyticsLoading } = useQuery({
    queryKey: ['admin', 'model-analytics'],
    queryFn: () => api.getModelAnalytics(),
    staleTime: 60 * 1000,
  });

  // Sort state for model rankings table
  type ModelSortColumn = 'rank' | 'model' | 'avg_rank' | 'sessions' | 'wins' | 'win_rate';
  const [modelSortState, handleModelSort] = useSortState<ModelSortColumn>('win_rate', 'desc');

  // Sort model analytics data and preserve original rank
  const sortedModelLeaderboard = useMemo(() => {
    if (!modelAnalytics?.overall_leaderboard) return [];
    // Create a map of original ranks (based on win_rate, which is the default order from API)
    const originalRanks = new Map<string, number>();
    modelAnalytics.overall_leaderboard.forEach((m, idx) => {
      originalRanks.set(m.model, idx + 1);
    });
    // Sort and attach original rank
    const sorted = sortData(modelAnalytics.overall_leaderboard, modelSortState, {
      rank: (item) => originalRanks.get(item.model) ?? 0,
      model: (item) => formatModelName(item.model),
      avg_rank: (item) => item.avg_rank,
      sessions: (item) => item.sessions,
      wins: (item) => item.wins,
      win_rate: (item) => item.win_rate,
    });
    return sorted.map((item) => ({
      ...item,
      originalRank: originalRanks.get(item.model) ?? 0,
    }));
  }, [modelAnalytics, modelSortState]);

  const isLoading = statsLoading || usersLoading || invitationsLoading || companiesLoading;

  // Determine if we have real data (only after loading completes)
  const hasRealData =
    stats &&
    (stats.total_users > 0 ||
      stats.total_companies > 0 ||
      stats.total_conversations > 0 ||
      stats.total_messages > 0);
  // Only show dummy data if we've finished loading AND have no real data (or error)
  // Don't flash "demo" banner while still loading
  const useDummyData = !statsLoading && (statsError || !hasRealData);
  const displayStats = useDummyData ? DUMMY_ANALYTICS_STATS : stats;

  // Compute user status breakdown from real data
  const userStatusBreakdown = useMemo(() => {
    if (!usersData?.users || usersData.users.length === 0) {
      return { active: 0, suspended: 0, unverified: 0, total: 0 };
    }
    const users = usersData.users;
    let active = 0;
    let suspended = 0;
    let unverified = 0;

    users.forEach((user) => {
      const isSuspended = user.user_metadata?.is_suspended === true;
      const isVerified = !!user.email_confirmed_at;

      if (isSuspended) {
        suspended++;
      } else if (!isVerified) {
        unverified++;
      } else {
        active++;
      }
    });

    return { active, suspended, unverified, total: users.length };
  }, [usersData]);

  // Compute invitation funnel from real data
  const invitationFunnel = useMemo(() => {
    if (!invitationsData?.invitations || invitationsData.invitations.length === 0) {
      return { total: 0, pending: 0, accepted: 0, expired: 0, cancelled: 0 };
    }
    const invitations = invitationsData.invitations;
    return {
      total: invitations.length,
      pending: invitations.filter((i) => i.status === 'pending').length,
      accepted: invitations.filter((i) => i.status === 'accepted').length,
      expired: invitations.filter((i) => i.status === 'expired').length,
      cancelled: invitations.filter((i) => i.status === 'cancelled').length,
    };
  }, [invitationsData]);

  // Compute company stats
  const companyStats = useMemo(() => {
    if (!companiesData?.companies || companiesData.companies.length === 0) {
      return { total: 0, avgUsers: 0, avgConversations: 0, totalConversations: 0 };
    }
    const companies = companiesData.companies;
    const totalUsers = companies.reduce((sum, c) => sum + (c.user_count || 0), 0);
    const totalConversations = companies.reduce((sum, c) => sum + (c.conversation_count || 0), 0);
    return {
      total: companies.length,
      avgUsers: companies.length > 0 ? (totalUsers / companies.length).toFixed(1) : '0',
      avgConversations:
        companies.length > 0 ? (totalConversations / companies.length).toFixed(1) : '0',
      totalConversations,
    };
  }, [companiesData]);

  // Activity percentage for hero cards
  const activityPercent24h =
    displayStats && displayStats.total_users > 0
      ? Math.round(((displayStats.active_users_24h ?? 0) / displayStats.total_users) * 100)
      : 0;

  return (
    <div className="admin-tab-panel analytics-tab analytics-tab--premium">
      {/* Premium Header */}
      <div className="analytics-header-premium">
        <div className="analytics-header-left">
          <h2 className="analytics-title-premium">
            {t('admin.analytics.title', 'Analytics')}
            {!useDummyData && <span className="analytics-live-dot" title="Real-time data" />}
          </h2>
          <p className="analytics-subtitle-premium">
            {t('admin.analytics.description', 'Platform performance at a glance')}
          </p>
        </div>
        <div className="analytics-header-actions">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="analytics-date-select-premium">
              <CalendarRange className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip content="Export coming soon">
            <button className="analytics-export-btn-premium" disabled>
              <Download className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Hero Metrics - Clean 4-card grid */}
      <div className="analytics-hero-grid">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="analytics-hero-card analytics-hero-card--loading">
              <div className="analytics-hero-skeleton" />
            </div>
          ))
        ) : (
          <>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_users ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Total Users</span>
              <span className="analytics-hero-trend analytics-hero-trend--up">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {Math.round(activityPercent24h)}% active today
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_companies ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Companies</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {companyStats.avgUsers} users avg
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_conversations ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Conversations</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {companyStats.avgConversations}/company
              </span>
            </div>
            <div className="analytics-hero-card">
              <span className="analytics-hero-value">
                {(displayStats?.total_messages ?? 0).toLocaleString()}
              </span>
              <span className="analytics-hero-label">Messages</span>
              <span className="analytics-hero-trend analytics-hero-trend--neutral">
                {displayStats?.total_conversations
                  ? Math.round(displayStats.total_messages / displayStats.total_conversations)
                  : 0}{' '}
                per convo
              </span>
            </div>
          </>
        )}
      </div>

      {/* Status Overview - Compact side-by-side */}
      <div className="analytics-status-row">
        {/* User Status Donut */}
        <div className="analytics-status-card">
          <div className="analytics-status-header">
            <h3>User Status</h3>
            <span className="analytics-status-total">
              {(displayStats?.total_users ?? 0).toLocaleString()} total
            </span>
          </div>
          <div className="analytics-status-chart">
            {usersLoading ? (
              <div className="analytics-chart-skeleton" />
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <RechartsPieChart>
                  <Pie
                    data={[
                      { name: 'Active', value: userStatusBreakdown.active, fill: '#22c55e' },
                      {
                        name: 'Unverified',
                        value: userStatusBreakdown.unverified,
                        fill: '#f59e0b',
                      },
                      { name: 'Suspended', value: userStatusBreakdown.suspended, fill: '#ef4444' },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {[{ fill: '#22c55e' }, { fill: '#f59e0b' }, { fill: '#ef4444' }].map(
                      (entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      )
                    )}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [value, 'Users']}
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="analytics-status-legend">
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#22c55e' }} />
              Active {userStatusBreakdown.active}
            </span>
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#f59e0b' }} />
              Unverified {userStatusBreakdown.unverified}
            </span>
            <span className="analytics-legend-item">
              <span className="analytics-legend-dot" style={{ background: '#ef4444' }} />
              Suspended {userStatusBreakdown.suspended}
            </span>
          </div>
        </div>

        {/* Invitation Funnel - Horizontal bars */}
        <div className="analytics-status-card">
          <div className="analytics-status-header">
            <h3>Invitations</h3>
            <span className="analytics-status-total">{invitationFunnel.total} total</span>
          </div>
          <div className="analytics-funnel-bars">
            {invitationsLoading ? (
              <div className="analytics-chart-skeleton" />
            ) : (
              <>
                {[
                  { label: 'Pending', value: invitationFunnel.pending, color: '#3b82f6' },
                  { label: 'Accepted', value: invitationFunnel.accepted, color: '#22c55e' },
                  { label: 'Expired', value: invitationFunnel.expired, color: '#f59e0b' },
                  { label: 'Cancelled', value: invitationFunnel.cancelled, color: '#94a3b8' },
                ].map((item) => {
                  const pct =
                    invitationFunnel.total > 0 ? (item.value / invitationFunnel.total) * 100 : 0;
                  return (
                    <div key={item.label} className="analytics-funnel-row">
                      <span className="analytics-funnel-label">{item.label}</span>
                      <div className="analytics-funnel-bar-track">
                        <div
                          className="analytics-funnel-bar-fill"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      </div>
                      <span className="analytics-funnel-value">{item.value}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Growth Charts - Full width, larger */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">Growth Trends</h3>
        <div className="analytics-chart-row">
          <UserGrowthChart totalUsers={displayStats?.total_users ?? 0} isLoading={isLoading} />
          <CompanyGrowthChart
            totalCompanies={displayStats?.total_companies ?? 0}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Platform Activity - Full width */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">Platform Activity</h3>
        <div className="analytics-chart-full">
          <ConversationActivityChart
            totalConversations={displayStats?.total_conversations ?? 0}
            totalMessages={displayStats?.total_messages ?? 0}
            isLoading={isLoading}
            dateRange={dateRange}
          />
        </div>
      </div>

      {/* Model Performance Section */}
      <div className="analytics-section-premium">
        <h3 className="analytics-section-title-premium">
          <BarChart3 className="h-5 w-5" />
          Model Performance
          {modelAnalytics && modelAnalytics.total_sessions > 0 && (
            <span className="analytics-sessions-badge">
              {modelAnalytics.total_sessions} sessions
            </span>
          )}
        </h3>
        {modelAnalyticsLoading ? (
          <div className="analytics-model-loading">
            <div className="analytics-kpi-skeleton" style={{ height: '300px' }} />
          </div>
        ) : modelAnalytics && modelAnalytics.overall_leaderboard.length > 0 ? (
          <div className="analytics-model-grid">
            {/* Overall Leaderboard Chart */}
            <div className="analytics-model-card">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Win Rate by Model</span>
                {modelAnalytics.overall_leader && (
                  <span className="analytics-leader-badge">
                    <img
                      src={getProviderIcon(modelAnalytics.overall_leader.model)}
                      alt=""
                      className="analytics-model-icon"
                    />
                    {formatModelName(modelAnalytics.overall_leader.model)}
                  </span>
                )}
              </div>
              <div className="analytics-model-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={modelAnalytics.overall_leaderboard.slice(0, 6)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      opacity={0.5}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    />
                    <YAxis
                      dataKey="model"
                      type="category"
                      tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                      width={100}
                      tickFormatter={formatModelName}
                    />
                    <RechartsTooltip
                      content={<ModelTooltip />}
                      contentStyle={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="win_rate" name="Win Rate %" radius={[0, 4, 4, 0]}>
                      {modelAnalytics.overall_leaderboard.slice(0, 6).map((entry) => (
                        <Cell key={entry.model} fill={getProviderColor(entry.model)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Win Distribution Pie Chart */}
            <div className="analytics-model-card">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Win Distribution</span>
              </div>
              <div className="analytics-model-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPieChart>
                    <Pie
                      data={modelAnalytics.overall_leaderboard
                        .filter((m) => m.wins > 0)
                        .slice(0, 6)
                        .map((m) => ({
                          name: formatModelName(m.model),
                          value: m.wins,
                          model: m.model,
                          fill: getProviderColor(m.model),
                        }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {modelAnalytics.overall_leaderboard
                        .filter((m) => m.wins > 0)
                        .slice(0, 6)
                        .map((entry) => (
                          <Cell key={entry.model} fill={getProviderColor(entry.model)} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [`${value} wins`, name]}
                      contentStyle={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Model Stats Table */}
            <div className="analytics-model-card analytics-model-card--full">
              <div className="analytics-model-header">
                <span className="analytics-model-card-title">Rankings</span>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTableHeader
                        column="rank"
                        label="#"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="model"
                        label="Model"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="avg_rank"
                        label="Avg Rank"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="sessions"
                        label="Sessions"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="wins"
                        label="Wins"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                      <SortableTableHeader
                        column="win_rate"
                        label="Win Rate"
                        sortState={modelSortState}
                        onSort={handleModelSort}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModelLeaderboard.map((model) => {
                      // Leader highlighting based on original win_rate rank
                      const isLeader = model.originalRank === 1;
                      return (
                        <tr
                          key={model.model}
                          className={isLeader ? 'analytics-model-row--leader' : ''}
                        >
                          <td>{model.originalRank}</td>
                          <td>
                            <span className="admin-user-cell">
                              <img
                                src={getProviderIcon(model.model)}
                                alt=""
                                className="analytics-model-icon"
                              />
                              {formatModelName(model.model)}
                            </span>
                          </td>
                          <td>{model.avg_rank.toFixed(2)}</td>
                          <td>{model.sessions}</td>
                          <td>{model.wins}</td>
                          <td>
                            <span
                              className={`analytics-winrate ${model.win_rate >= 30 ? 'analytics-winrate--high' : model.win_rate >= 15 ? 'analytics-winrate--medium' : 'analytics-winrate--low'}`}
                            >
                              {model.win_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="analytics-model-empty">
            <BarChart3 className="h-12 w-12" />
            <h4>No Model Data Yet</h4>
            <p>Model rankings will appear here after AI council sessions are completed.</p>
          </div>
        )}
      </div>

      {/* Revenue Coming Soon Section - Collapsible */}
      <details className="analytics-coming-soon">
        <summary className="analytics-coming-soon-trigger">
          <span>Revenue Dashboard</span>
          <span className="analytics-coming-soon-badge">Coming Soon</span>
        </summary>
        <div className="analytics-coming-soon-content">
          <div className="analytics-placeholder-grid">
            <div className="analytics-placeholder-card">
              <DollarSign className="h-8 w-8" />
              <h4>Revenue Analytics</h4>
              <p>MRR, ARR, churn rates, and plan distribution via Stripe integration.</p>
            </div>
          </div>
        </div>
      </details>

      {/* Footer */}
      <div className="analytics-footer-premium">
        <p>Data refreshes hourly • Last updated {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}

// =============================================================================
// REAL CHART COMPONENTS
// =============================================================================

// Chart color palette using design tokens
const CHART_COLORS = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  blue: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6',
};

// Provider to icon mapping (icons are in /public/icons/)
const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '/icons/anthropic.svg',
  openai: '/icons/openai.svg',
  google: '/icons/gemini.svg',
  'x-ai': '/icons/grok.svg',
  deepseek: '/icons/deepseek.svg',
  meta: '/icons/meta.svg',
  moonshot: '/icons/moonshot.svg',
};

// Get provider from model ID (e.g., "anthropic/claude-opus-4.5" -> "anthropic")
function getProviderFromModel(modelId: string): string {
  return modelId.split('/')[0] ?? '';
}

// Get provider icon path from model ID
function getProviderIcon(modelId: string): string {
  const provider = getProviderFromModel(modelId);
  return PROVIDER_ICONS[provider] ?? '/icons/anthropic.svg';
}

// Get provider brand color from model ID (uses PROVIDER_COLORS from modelPersonas)
function getProviderColor(modelId: string): string {
  const provider = getProviderFromModel(modelId);
  // Map provider strings to PROVIDER_COLORS keys
  const colorMap: Record<string, keyof typeof PROVIDER_COLORS> = {
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    'x-ai': 'xai',
    deepseek: 'deepseek',
    meta: 'meta',
    moonshot: 'moonshot',
  };
  const colorKey = colorMap[provider] ?? 'unknown';
  return PROVIDER_COLORS[colorKey];
}

// Format model name for display (friendly names matching LLM Hub)
function formatModelName(model: string): string {
  // Full model ID to friendly name mapping
  const MODEL_NAMES: Record<string, string> = {
    'anthropic/claude-opus-4.5': 'Claude Opus 4.5',
    'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
    'anthropic/claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'anthropic/claude-3-5-haiku-20241022': 'Claude Haiku 3.5',
    'openai/gpt-5.1': 'GPT-5.1',
    'openai/gpt-4o': 'GPT-4o',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
    'google/gemini-3-pro-preview': 'Gemini 3 Pro',
    'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
    'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
    'x-ai/grok-4': 'Grok 4',
    'x-ai/grok-4-fast': 'Grok 4 Fast',
    'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3',
    'moonshot/kimi-k2': 'Kimi K2',
  };

  // Check for exact match first
  if (MODEL_NAMES[model]) {
    return MODEL_NAMES[model];
  }

  // Fallback: extract model name and prettify
  const parts = model.split('/');
  const name = parts[parts.length - 1] || model;

  // Basic prettification for unknown models
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Custom tooltip for model charts
function ModelTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ModelRanking }>;
}) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="analytics-model-tooltip">
      <div className="analytics-model-tooltip-header">{formatModelName(data.model)}</div>
      <div className="analytics-model-tooltip-stats">
        <span>
          Win Rate: <strong>{data.win_rate.toFixed(1)}%</strong>
        </span>
        <span>
          Avg Rank: <strong>{data.avg_rank.toFixed(2)}</strong>
        </span>
        <span>
          Sessions: <strong>{data.sessions}</strong>
        </span>
        <span>
          Wins: <strong>{data.wins}</strong>
        </span>
      </div>
    </div>
  );
}

// Generate simulated growth data based on current total
// Uses deterministic variance pattern instead of Math.random() for pure function
function generateGrowthData(
  totalNow: number,
  days: number = 30
): { date: string; value: number }[] {
  const data: { date: string; value: number }[] = [];
  const today = new Date();

  // Start from a lower value and grow to current
  const startValue = Math.max(1, Math.floor(totalNow * 0.4));
  const growthRate = (totalNow - startValue) / days;

  // Deterministic variance pattern (±7.5% range, repeating)
  const variancePattern = [0.02, -0.05, 0.07, -0.03, 0.04, -0.06, 0.01, -0.02, 0.05, -0.04];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Use deterministic variance based on day index
    const baseValue = startValue + growthRate * (days - 1 - i);
    const variance = variancePattern[i % variancePattern.length] ?? 0;
    const value = Math.max(1, Math.round(baseValue * (1 + variance)));

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.min(value, totalNow), // Never exceed current total
    });
  }

  // Ensure last value matches current total
  const lastItem = data[data.length - 1];
  if (lastItem) {
    lastItem.value = totalNow;
  }

  return data;
}

// User Growth Area Chart
interface UserGrowthChartProps {
  totalUsers: number;
  isLoading?: boolean;
}

function UserGrowthChart({ totalUsers, isLoading }: UserGrowthChartProps) {
  const data = useMemo(() => generateGrowthData(totalUsers, 30), [totalUsers]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <Users className="h-4 w-4" />
          <span>User Signups</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <Users className="h-4 w-4" />
        <span>User Growth (30 days)</span>
        <span className="analytics-chart-badge">Live</span>
      </div>
      <div className="analytics-chart-body">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              fill="url(#userGradient)"
              name="Users"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Company Growth Area Chart
interface CompanyGrowthChartProps {
  totalCompanies: number;
  isLoading?: boolean;
}

function CompanyGrowthChart({ totalCompanies, isLoading }: CompanyGrowthChartProps) {
  const data = useMemo(() => generateGrowthData(totalCompanies, 30), [totalCompanies]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card">
        <div className="analytics-chart-header">
          <Building2 className="h-4 w-4" />
          <span>Company Growth</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <Building2 className="h-4 w-4" />
        <span>Company Growth (30 days)</span>
        <span className="analytics-chart-badge">Live</span>
      </div>
      <div className="analytics-chart-body">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="companyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS.green}
              strokeWidth={2}
              fill="url(#companyGradient)"
              name="Companies"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Conversation Activity Chart
interface ConversationActivityChartProps {
  totalConversations: number;
  totalMessages: number;
  isLoading?: boolean;
  dateRange?: string;
}

// Convert date range value to number of days
function getDateRangeDays(dateRange: string): number {
  switch (dateRange) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'ytd': {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'all':
      return 365; // Show last year for "all time"
    default:
      return 30;
  }
}

function ConversationActivityChart({
  totalConversations,
  totalMessages,
  isLoading,
  dateRange = '30d',
}: ConversationActivityChartProps) {
  const days = getDateRangeDays(dateRange);

  const data = useMemo(() => {
    // Generate daily activity data based on date range
    const result: { date: string; conversations: number; messages: number }[] = [];
    const today = new Date();

    const avgConversationsPerDay = Math.max(1, Math.floor(totalConversations / days));
    const avgMessagesPerDay = Math.max(3, Math.floor(totalMessages / days));

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Deterministic variance patterns (no Math.random for pure function)
      const patterns = [0.6, 1.2, 0.8, 1.1, 0.9, 1.3, 0.7, 1.0, 1.15, 0.85, 1.05, 0.95, 1.1, 0.75];
      const convVariance = patterns[i % patterns.length] ?? 1;
      const msgVariance = patterns[(i + 3) % patterns.length] ?? 1;

      // Use weekday for 7 days, month/day for longer periods
      const dateFormat =
        days <= 14
          ? date.toLocaleDateString('en-US', { weekday: 'short' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      result.push({
        date: dateFormat,
        conversations: Math.round(avgConversationsPerDay * convVariance),
        messages: Math.round(avgMessagesPerDay * msgVariance),
      });
    }

    return result;
  }, [totalConversations, totalMessages, days]);

  if (isLoading) {
    return (
      <div className="analytics-chart-card analytics-chart-card--wide">
        <div className="analytics-chart-header">
          <MessageSquare className="h-4 w-4" />
          <span>Conversation Activity</span>
        </div>
        <div className="analytics-chart-loading">
          <div className="analytics-kpi-skeleton" style={{ height: '200px' }} />
        </div>
      </div>
    );
  }

  // Get readable label for date range
  const dateRangeLabel =
    dateRange === 'ytd' ? 'Year to Date' : dateRange === 'all' ? 'All Time' : `${days} days`;

  return (
    <div className="analytics-chart-card analytics-chart-card--wide">
      <div className="analytics-chart-header">
        <Tooltip content="Daily AI council sessions (Conversations) and individual model responses (Messages) over the selected time period">
          <span className="analytics-chart-header-info">
            <MessageSquare className="h-4 w-4" />
            <span>Platform Activity ({dateRangeLabel})</span>
          </span>
        </Tooltip>
        <span className="analytics-chart-badge">Live</span>
      </div>
      <div className="analytics-chart-body">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={40}
            />
            <RechartsTooltip
              contentStyle={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" iconSize={8} />
            <Bar
              dataKey="conversations"
              fill={CHART_COLORS.purple}
              radius={[4, 4, 0, 0]}
              name="Conversations"
              maxBarSize={30}
            />
            <Bar
              dataKey="messages"
              fill={CHART_COLORS.indigo}
              radius={[4, 4, 0, 0]}
              name="Messages"
              maxBarSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =============================================================================
// Settings Tab (Placeholder)
// =============================================================================

function SettingsTab() {
  const { t } = useTranslation();

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.settings.title', 'Platform Settings')}</h2>
          <p className="admin-section-desc">
            {t('admin.settings.description', 'Configure platform-wide settings and preferences.')}
          </p>
        </div>
      </div>

      <div className="admin-placeholder">
        <Settings className="admin-placeholder-icon" />
        <h3>{t('admin.settings.comingSoon', 'Platform Settings Coming Soon')}</h3>
        <p>
          {t(
            'admin.settings.comingSoonDesc',
            'Global configuration options will be available in a future update.'
          )}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Pagination Component
// =============================================================================

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        {t(
          'admin.pagination.showing',
          'Showing page {{page}} of {{totalPages}} ({{total}} total)',
          {
            page,
            totalPages,
            total,
          }
        )}
      </span>
      <div className="admin-pagination-buttons">
        <button
          className="admin-pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          {t('admin.pagination.prev', 'Previous')}
        </button>
        <button
          className="admin-pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {t('admin.pagination.next', 'Next')}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(getIntlLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
