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
import { useQuery } from '@tanstack/react-query';
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
  CreateInvitationRequest,
} from '../../api';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ImpersonateUserModal } from './ImpersonateUserModal';
import { Tooltip } from '../ui/Tooltip';
import './AdminPortal.css';
import './AdminStats.css';
import './AdminTable.css';
import './AdminToolbar.css';
import './AdminButtons.css';
import './AdminModals.css';
import './AdminAuditLog.css';

type AdminTab = 'users' | 'companies' | 'invitations' | 'audit' | 'admins' | 'settings';

const ADMIN_TABS: { id: AdminTab; label: string; icon: typeof Users; path: string }[] = [
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies' },
  { id: 'invitations', label: 'Invitations', icon: UserPlus, path: '/admin/invitations' },
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

/** Invitations table skeleton rows */
const InvitationsTableSkeleton = () => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i}>
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonBadge />
        <SkeletonCell />
        <SkeletonCell short />
        <SkeletonCell short />
        <SkeletonActions count={3} />
      </tr>
    ))}
  </>
);

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
      navigate('/admin/users', { replace: true });
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

  // Loading state
  if (authLoading || adminLoading) {
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
          {error && (
            <p className="admin-error-detail">
              {t('admin.errorDetail', 'Error: {{message}}', { message: error.message })}
            </p>
          )}
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
      <main className="admin-main">
        <div className="admin-content">
          {/* Stats Overview - shown on all tabs */}
          <StatsOverview />

          {/* Tab content */}
          <div className="admin-tab-content">
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'companies' && <CompaniesTab />}
            {activeTab === 'invitations' && <InvitationsTab />}
            {activeTab === 'audit' && <AuditTab />}
            {activeTab === 'admins' && <AdminsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </main>
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
                  {stat.value.toLocaleString()}
                  {useDummyData && <span className="admin-demo-badge-inline">DEMO</span>}
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
// Users Tab
// =============================================================================

// =============================================================================
// DUMMY DATA - START (Users)
// =============================================================================
const DUMMY_USERS: AdminPlatformUser[] = [
  {
    id: 'demo-user-1',
    email: 'ozpaniard+alice@gmail.com',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_sign_in_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    email_confirmed_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    user_metadata: null,
  },
  {
    id: 'demo-user-2',
    email: 'ozpaniard+bob@gmail.com',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    last_sign_in_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    email_confirmed_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    user_metadata: null,
  },
  {
    id: 'demo-user-3',
    email: 'ozpaniard+carol@gmail.com',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    last_sign_in_at: null,
    email_confirmed_at: null,
    user_metadata: null,
  },
  {
    id: 'demo-user-4',
    email: 'ozpaniard+david@gmail.com',
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    last_sign_in_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    email_confirmed_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    user_metadata: null,
  },
  {
    id: 'demo-user-5',
    email: 'ozpaniard+emma@gmail.com',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_sign_in_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    email_confirmed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    user_metadata: null,
  },
];
// =============================================================================
// DUMMY DATA - END (Users)
// =============================================================================

function UsersTab() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { adminRole } = useAdminAccess();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userToDelete, setUserToDelete] = useState<AdminPlatformUser | null>(null);
  const [userToSuspend, setUserToSuspend] = useState<AdminPlatformUser | null>(null);
  const [userToImpersonate, setUserToImpersonate] = useState<AdminPlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 20;

  // Check if current admin can impersonate
  const canImpersonate = adminRole === 'super_admin' || adminRole === 'admin';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () =>
      api.listAdminUsers({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiUsers = data?.users ?? [];
  const useDummyData = error || (apiUsers.length === 0 && !isLoading);

  const filteredDummyData = useDummyData
    ? DUMMY_USERS.filter((user) => {
        const matchesSearch = !search || user.email.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
    : [];

  const users = useDummyData ? filteredDummyData : apiUsers;
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Check if user is suspended
  const isUserSuspended = (user: AdminPlatformUser): boolean => {
    return !!user.user_metadata?.is_suspended;
  };

  // Handle suspend/unsuspend
  const handleToggleSuspend = async (user: AdminPlatformUser) => {
    if (useDummyData) return; // Don't allow actions on dummy data
    if (user.id === currentUser?.id) return; // Can't suspend yourself

    setActionLoading(user.id);
    try {
      const newSuspendedState = !isUserSuspended(user);
      await api.updateAdminUser(user.id, { is_suspended: newSuspendedState });
      refetch();
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setActionLoading(null);
      setUserToSuspend(null);
    }
  };

  // Handle delete
  const handleDelete = async (user: AdminPlatformUser) => {
    if (useDummyData) return; // Don't allow actions on dummy data
    if (user.id === currentUser?.id) return; // Can't delete yourself

    setActionLoading(user.id);
    try {
      await api.deleteAdminUser(user.id);
      refetch();
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setActionLoading(null);
      setUserToDelete(null);
    }
  };

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.users.title', 'User Management')}</h2>
          <p className="admin-section-desc">
            {t('admin.users.description', 'View and manage all users across the platform.')}
          </p>
        </div>
        <div className="admin-toolbar-right">
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
      </div>

      {/* DUMMY DATA INDICATOR - Show demo banner when using sample data */}
      {useDummyData && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.users.demoMode', 'Showing sample data for preview.')}</span>
        </div>
      )}

      {!isLoading && users.length === 0 ? (
        <div className="admin-table-empty">
          <Users className="h-8 w-8" />
          <span>{t('admin.users.noUsers', 'No users found')}</span>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.users.email', 'Email')}</th>
                  <th>{t('admin.users.createdAt', 'Created')}</th>
                  <th>{t('admin.users.lastSignIn', 'Last Sign In')}</th>
                  <th>{t('admin.users.status', 'Status')}</th>
                  <th>{t('admin.users.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <UsersTableSkeleton />
                ) : (
                  users.map((user: AdminPlatformUser) => {
                    const isSuspended = isUserSuspended(user);
                    const isCurrentUser = user.id === currentUser?.id;
                    const isLoading = actionLoading === user.id;

                    return (
                      <tr key={user.id} className={useDummyData ? 'admin-demo-row' : ''}>
                        <td>
                          <div className="admin-user-cell">
                            <Mail className="h-4 w-4" />
                            <span>{user.email}</span>
                            {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                            {isCurrentUser && <span className="admin-you-badge">You</span>}
                          </div>
                        </td>
                        <td>
                          <div className="admin-date-cell">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(user.created_at)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-date-cell">
                            <Clock className="h-4 w-4" />
                            <span>
                              {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {isSuspended ? (
                            <span className="admin-status-badge admin-status-badge--suspended">
                              <Ban className="h-3 w-3" />
                              Suspended
                            </span>
                          ) : (
                            <span
                              className={`admin-status-badge ${user.email_confirmed_at ? 'admin-status-badge--active' : 'admin-status-badge--pending'}`}
                            >
                              {user.email_confirmed_at ? 'Verified' : 'Pending'}
                            </span>
                          )}
                        </td>
                        <td>
                          {useDummyData || isCurrentUser ? (
                            <span className="admin-muted">-</span>
                          ) : (
                            <div className="admin-actions-cell">
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {/* Impersonate button */}
                                  {canImpersonate && !isSuspended && (
                                    <button
                                      className="admin-icon-btn admin-icon-btn--impersonate"
                                      onClick={() => setUserToImpersonate(user)}
                                      title={t('admin.users.impersonate', 'View as user')}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    className={`admin-icon-btn ${isSuspended ? 'admin-icon-btn--success' : 'admin-icon-btn--warning'}`}
                                    onClick={() => setUserToSuspend(user)}
                                    title={
                                      isSuspended
                                        ? t('admin.users.unsuspend', 'Unsuspend user')
                                        : t('admin.users.suspend', 'Suspend user')
                                    }
                                  >
                                    {isSuspended ? (
                                      <UserCheck className="h-4 w-4" />
                                    ) : (
                                      <UserX className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    className="admin-icon-btn admin-icon-btn--danger"
                                    onClick={() => setUserToDelete(user)}
                                    title={t('admin.users.delete', 'Delete user')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
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
          onConfirm={() => handleDelete(userToDelete)}
          isLoading={actionLoading === userToDelete.id}
        />
      )}

      {/* Suspend User Confirmation Modal */}
      {userToSuspend && (
        <SuspendUserModal
          user={userToSuspend}
          isSuspended={isUserSuspended(userToSuspend)}
          onClose={() => setUserToSuspend(null)}
          onConfirm={() => handleToggleSuspend(userToSuspend)}
          isLoading={actionLoading === userToSuspend.id}
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
    </div>
  );
}

// =============================================================================
// Delete User Confirmation Modal
// =============================================================================

interface DeleteUserModalProps {
  user: AdminPlatformUser;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function DeleteUserModal({ user, onClose, onConfirm, isLoading }: DeleteUserModalProps) {
  const { t } = useTranslation();

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
        className="admin-modal admin-modal--danger"
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
          <div className="admin-modal-warning">
            <AlertCircle className="h-6 w-6" />
            <div>
              <p className="admin-modal-warning-title">
                {t('admin.users.deleteWarning', 'This action cannot be undone')}
              </p>
              <p className="admin-modal-warning-text">
                {t(
                  'admin.users.deleteWarningDesc',
                  'Deleting this user will permanently remove all their data including companies, conversations, and messages.'
                )}
              </p>
            </div>
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
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="admin-action-btn admin-action-btn--danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('admin.users.deleting', 'Deleting...')}
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {t('admin.users.confirmDelete', 'Delete User')}
              </>
            )}
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
  onConfirm: () => void;
  isLoading: boolean;
}

function SuspendUserModal({
  user,
  isSuspended,
  onClose,
  onConfirm,
  isLoading,
}: SuspendUserModalProps) {
  const { t } = useTranslation();

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
        </div>

        <div className="admin-modal-actions">
          <button
            type="button"
            className="admin-action-btn admin-action-btn--secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={`admin-action-btn ${isSuspended ? 'admin-action-btn--success' : 'admin-action-btn--warning'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSuspended
                  ? t('admin.users.unsuspending', 'Unsuspending...')
                  : t('admin.users.suspending', 'Suspending...')}
              </>
            ) : (
              <>
                {isSuspended ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                {isSuspended
                  ? t('admin.users.confirmUnsuspend', 'Unsuspend User')
                  : t('admin.users.confirmSuspend', 'Suspend User')}
              </>
            )}
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

  const companies = useDummyData ? filteredDummyData : apiCompanies;
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

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

      {/* DUMMY DATA INDICATOR - Show demo banner when using sample data */}
      {useDummyData && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.companies.demoMode', 'Showing sample data for preview.')}</span>
        </div>
      )}

      {!isLoading && companies.length === 0 ? (
        <div className="admin-table-empty">
          <Building2 className="h-8 w-8" />
          <span>{t('admin.companies.noCompanies', 'No companies found')}</span>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.companies.name', 'Company Name')}</th>
                  <th>{t('admin.companies.owner', 'Owner')}</th>
                  <th>{t('admin.companies.conversations', 'Conversations')}</th>
                  <th>{t('admin.companies.createdAt', 'Created')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <CompaniesTableSkeleton />
                ) : (
                  companies.map((company: AdminCompanyInfo) => (
                    <tr key={company.id} className={useDummyData ? 'admin-demo-row' : ''}>
                      <td>
                        <div className="admin-company-cell">
                          <Building2 className="h-4 w-4" />
                          <span>{company.name}</span>
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          <Mail className="h-4 w-4" />
                          <span>{company.owner_email || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-count-cell">
                          <MessageSquare className="h-4 w-4" />
                          <span>{company.conversation_count}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Calendar className="h-4 w-4" />
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.listAdminAdmins(),
    staleTime: 30 * 1000,
  });

  // DUMMY DATA LOGIC - Use dummy data if API fails or returns empty
  const apiAdmins = data?.admins ?? [];
  const useDummyData = error || (apiAdmins.length === 0 && !isLoading);
  const admins = useDummyData ? DUMMY_ADMINS : apiAdmins;

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

      {/* DUMMY DATA INDICATOR - Show demo banner when using sample data */}
      {useDummyData && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.admins.demoMode', 'Showing sample data for preview.')}</span>
        </div>
      )}

      {!isLoading && admins.length === 0 ? (
        <div className="admin-table-empty">
          <Shield className="h-8 w-8" />
          <span>{t('admin.admins.noAdmins', 'No admins found')}</span>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.admins.email', 'Email')}</th>
                <th>{t('admin.admins.role', 'Role')}</th>
                <th>{t('admin.admins.grantedAt', 'Granted')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <AdminsTableSkeleton />
              ) : (
                admins.map((admin: AdminUserInfo) => (
                  <tr key={admin.id} className={useDummyData ? 'admin-demo-row' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <Shield className="h-4 w-4" />
                        <span>{admin.email}</span>
                        {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-role-badge admin-role-badge--${admin.role}`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div className="admin-date-cell">
                        <Calendar className="h-4 w-4" />
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
    metadata: { reason: 'Investigating billing issue reported by customer in ticket #4521', ended_reason: 'manual' },
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

  const logs = useDummyData ? filteredDummyData : apiLogs;
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Format timestamp for display
  const formatTimestamp = (ts: string): string => {
    try {
      const date = new Date(ts);
      return date.toLocaleString(undefined, {
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
            <SelectItem value="all">{t('admin.audit.allCategories', 'All Categories')}</SelectItem>
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

      {/* DUMMY DATA INDICATOR - Show demo banner when using sample data */}
      {useDummyData && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>{t('admin.audit.demoMode', 'Showing sample data for preview.')}</span>
        </div>
      )}

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
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.audit.timestamp', 'Timestamp')}</th>
                  <th>{t('admin.audit.actor', 'Actor')}</th>
                  <th>{t('admin.audit.action', 'Action')}</th>
                  <th>{t('admin.audit.category', 'Category')}</th>
                  <th>{t('admin.audit.resource', 'Resource')}</th>
                  <th>{t('admin.audit.ip', 'IP')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <AuditTableSkeleton />
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className={useDummyData ? 'admin-demo-row' : ''}>
                      <td>
                        <div className="admin-date-cell">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimestamp(log.timestamp)}</span>
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-user-cell">
                          {log.actor_type === 'admin' ? (
                            <Shield className="h-4 w-4" />
                          ) : log.actor_type === 'system' ? (
                            <Activity className="h-4 w-4" />
                          ) : (
                            <Users className="h-4 w-4" />
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
                              {log.action}
                              <Eye className="h-3 w-3" />
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="admin-action-text">{log.action}</span>
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
                      <td>
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
// Invitations Tab
// =============================================================================

// =============================================================================
// DUMMY DATA - START
// =============================================================================
// PURPOSE: Sample invitations for UI development and testing when the
//          platform_invitations table doesn't exist yet in the database.
//
// HOW TO REMOVE:
// 1. Run the database migration: supabase/migrations/20260119100000_platform_invitations.sql
// 2. Delete this entire DUMMY_INVITATIONS array
// 3. Remove the useDummyData logic in InvitationsTab
// 4. Remove the admin-demo-banner rendering
// 5. Search for "DUMMY DATA" comments to find all related code
// =============================================================================
const DUMMY_INVITATIONS: AdminInvitation[] = [
  {
    id: 'demo-1', // Prefix with 'demo-' for easy identification
    email: 'ozpaniard+john@gmail.com',
    name: 'John Doe',
    status: 'pending',
    invited_by_email: 'ozpaniard+admin@gmail.com',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    target_company_name: null,
    resend_count: 0,
  },
  {
    id: 'demo-2',
    email: 'ozpaniard+jane@gmail.com',
    name: 'Jane Smith',
    status: 'accepted',
    invited_by_email: 'ozpaniard+admin@gmail.com',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    target_company_name: 'StartupHub Inc',
    resend_count: 1,
  },
  {
    id: 'demo-3',
    email: 'ozpaniard+bob2@gmail.com',
    name: null,
    status: 'expired',
    invited_by_email: 'ozpaniard+support@gmail.com',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    target_company_name: null,
    resend_count: 0,
  },
  {
    id: 'demo-4',
    email: 'ozpaniard+sarah@gmail.com',
    name: 'Sarah Jones',
    status: 'pending',
    invited_by_email: 'ozpaniard+admin@gmail.com',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    target_company_name: 'Enterprise Global',
    resend_count: 0,
  },
  {
    id: 'demo-5',
    email: 'ozpaniard+mike@gmail.com',
    name: 'Mike Brown',
    status: 'cancelled',
    invited_by_email: 'ozpaniard+admin@gmail.com',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    target_company_name: null,
    resend_count: 2,
  },
];
// =============================================================================
// DUMMY DATA - END
// =============================================================================

function InvitationsTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const pageSize = 20;

  // Fetch invitations
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'invitations', { page, search, status: statusFilter }],
    queryFn: () =>
      api.listAdminInvitations({
        page,
        page_size: pageSize,
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    staleTime: 30 * 1000,
  });

  // =============================================================================
  // DUMMY DATA LOGIC - Remove this section when real data is available
  // =============================================================================
  // Use dummy data if API fails or returns empty (for development)
  const apiInvitations = data?.invitations ?? [];
  const useDummyData = error || (apiInvitations.length === 0 && !isLoading);

  // Filter dummy data based on search and status (DUMMY DATA LOGIC)
  const filteredDummyData = useDummyData
    ? DUMMY_INVITATIONS.filter((inv) => {
        const matchesSearch = !search || inv.email.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !statusFilter || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
    : [];

  const invitations = useDummyData ? filteredDummyData : apiInvitations;
  const total = useDummyData ? filteredDummyData.length : (data?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Cancel invitation handler
  const handleCancel = async (invitationId: string) => {
    try {
      await api.cancelAdminInvitation(invitationId);
      refetch();
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  };

  // Resend invitation handler
  const handleResend = async (invitationId: string) => {
    try {
      await api.resendAdminInvitation(invitationId);
      refetch();
    } catch (err) {
      console.error('Failed to resend invitation:', err);
    }
  };

  // Get status badge style
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'admin-status-badge--pending',
      accepted: 'admin-status-badge--active',
      expired: 'admin-status-badge--expired',
      cancelled: 'admin-status-badge--cancelled',
      revoked: 'admin-status-badge--cancelled',
    };
    return styles[status] || 'admin-status-badge--pending';
  };

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">
            {t('admin.invitations.title', 'User Invitations')}
          </h2>
          <p className="admin-section-desc">
            {t(
              'admin.invitations.description',
              'Invite new users to the platform. They will receive an email with a signup link.'
            )}
          </p>
        </div>
        <button
          className="admin-action-btn admin-action-btn--primary"
          onClick={() => setShowInviteModal(true)}
        >
          <UserPlus className="h-4 w-4" />
          {t('admin.invitations.invite', 'Invite User')}
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          <div className="admin-search-box">
            <Search className="admin-search-icon h-4 w-4" />
            <input
              type="text"
              placeholder={t('admin.invitations.searchPlaceholder', 'Search by email...')}
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
            value={statusFilter || 'all'}
            onValueChange={(value) => {
              setStatusFilter(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger className="admin-select-trigger">
              <SelectValue placeholder={t('admin.invitations.allStatuses', 'All Statuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('admin.invitations.allStatuses', 'All Statuses')}
              </SelectItem>
              <SelectItem value="pending">
                {t('admin.invitations.statusPending', 'Pending')}
              </SelectItem>
              <SelectItem value="accepted">
                {t('admin.invitations.statusAccepted', 'Accepted')}
              </SelectItem>
              <SelectItem value="expired">
                {t('admin.invitations.statusExpired', 'Expired')}
              </SelectItem>
              <SelectItem value="cancelled">
                {t('admin.invitations.statusCancelled', 'Cancelled')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Show demo banner when using dummy data */}
      {useDummyData && !isLoading && (
        <div className="admin-demo-banner">
          <AlertCircle className="h-4 w-4" />
          <span>
            {t(
              'admin.invitations.demoMode',
              'Showing sample data. Run the database migration to see real invitations.'
            )}
          </span>
        </div>
      )}

      {!isLoading && invitations.length === 0 ? (
        <div className="admin-table-empty">
          <UserPlus className="h-8 w-8" />
          <span>{t('admin.invitations.noInvitations', 'No invitations found')}</span>
          <p className="admin-empty-hint">
            {t(
              'admin.invitations.noInvitationsHint',
              'Click "Invite User" to send platform invitations.'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin.invitations.email', 'Email')}</th>
                  <th>{t('admin.invitations.name', 'Name')}</th>
                  <th>{t('admin.invitations.status', 'Status')}</th>
                  <th>{t('admin.invitations.invitedBy', 'Invited By')}</th>
                  <th>{t('admin.invitations.sentAt', 'Sent')}</th>
                  <th>{t('admin.invitations.expiresAt', 'Expires')}</th>
                  <th>{t('admin.invitations.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <InvitationsTableSkeleton />
                ) : (
                  invitations.map((invitation: AdminInvitation) => (
                    <tr key={invitation.id} className={useDummyData ? 'admin-demo-row' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <Mail className="h-4 w-4" />
                          <span>{invitation.email}</span>
                          {/* DUMMY DATA INDICATOR - Shows subtle badge when using sample data */}
                          {useDummyData && <span className="admin-demo-badge">DEMO</span>}
                        </div>
                      </td>
                      <td>
                        <span>{invitation.name || '-'}</span>
                      </td>
                      <td>
                        <span className={`admin-status-badge ${getStatusBadge(invitation.status)}`}>
                          {invitation.status === 'pending' && <Clock className="h-3 w-3" />}
                          {invitation.status === 'accepted' && <CheckCircle className="h-3 w-3" />}
                          {invitation.status === 'expired' && <XCircle className="h-3 w-3" />}
                          {invitation.status === 'cancelled' && <X className="h-3 w-3" />}
                          {invitation.status}
                        </span>
                      </td>
                      <td>
                        <span>{invitation.invited_by_email || 'System'}</span>
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(invitation.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Clock className="h-4 w-4" />
                          <span>{formatDate(invitation.expires_at)}</span>
                        </div>
                      </td>
                      <td>
                        {invitation.status === 'pending' && (
                          <div className="admin-actions-cell">
                            <button
                              className="admin-icon-btn admin-icon-btn--secondary"
                              onClick={() => handleResend(invitation.id)}
                              title={t('admin.invitations.resend', 'Resend invitation')}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                            <button
                              className="admin-icon-btn admin-icon-btn--danger"
                              onClick={() => handleCancel(invitation.id)}
                              title={t('admin.invitations.cancel', 'Cancel invitation')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {invitation.status !== 'pending' && <span className="admin-muted">-</span>}
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

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            refetch();
          }}
        />
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
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
