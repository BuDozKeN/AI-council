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

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useAdminAccess } from '../../hooks';
import { api } from '../../api';
import type {
  AdminPlatformUser,
  AdminCompanyInfo,
  AdminUserInfo,
} from '../../api';
import { ThemeToggle } from '../ui/ThemeToggle';
import './AdminPortal.css';

type AdminTab = 'users' | 'companies' | 'audit' | 'admins' | 'settings';

const ADMIN_TABS: { id: AdminTab; label: string; icon: typeof Users; path: string }[] = [
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies' },
  { id: 'audit', label: 'Audit Logs', icon: FileText, path: '/admin/audit' },
  { id: 'admins', label: 'Admin Roles', icon: Shield, path: '/admin/admins' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
];

export default function AdminPortal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading, error } = useAdminAccess();

  // Determine active tab from URL
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  useEffect(() => {
    const path = location.pathname;
    const matchedTab = ADMIN_TABS.find((tab) => path.startsWith(tab.path));
    if (matchedTab) {
      setActiveTab(matchedTab.id);
    } else if (path === '/admin') {
      // Default to users tab
      navigate('/admin/users', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
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

function StatsOverview() {
  const { t } = useTranslation();

  const { data: stats, isLoading } = useQuery({
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

  const statCards = [
    {
      label: t('admin.stats.totalUsers', 'Total Users'),
      value: stats?.total_users ?? 0,
      icon: Users,
      color: 'blue',
    },
    {
      label: t('admin.stats.totalCompanies', 'Total Companies'),
      value: stats?.total_companies ?? 0,
      icon: Building2,
      color: 'green',
    },
    {
      label: t('admin.stats.totalConversations', 'Conversations'),
      value: stats?.total_conversations ?? 0,
      icon: MessageSquare,
      color: 'purple',
    },
    {
      label: t('admin.stats.totalMessages', 'Messages'),
      value: stats?.total_messages ?? 0,
      icon: BarChart3,
      color: 'orange',
    },
  ];

  return (
    <div className="admin-stats-grid">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className={`admin-stat-card admin-stat-card--${stat.color}`}>
            <div className="admin-stat-icon">
              <Icon className="h-5 w-5" />
            </div>
            <div className="admin-stat-content">
              <span className="admin-stat-value">{stat.value.toLocaleString()}</span>
              <span className="admin-stat-label">{stat.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Users Tab
// =============================================================================

function UsersTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', { page, search }],
    queryFn: () => api.listAdminUsers({
      page,
      page_size: pageSize,
      ...(search ? { search } : {})
    }),
    staleTime: 30 * 1000,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.users.title', 'User Management')}</h2>
          <p className="admin-section-desc">
            {t('admin.users.description', 'View and manage all users across the platform.')}
          </p>
        </div>
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

      {isLoading ? (
        <div className="admin-table-loading">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      ) : error ? (
        <div className="admin-table-error">
          <AlertCircle className="h-5 w-5" />
          <span>{t('admin.users.errorLoading', 'Failed to load users')}</span>
        </div>
      ) : users.length === 0 ? (
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
                </tr>
              </thead>
              <tbody>
                {users.map((user: AdminPlatformUser) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
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
                        <span>{user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-status-badge ${user.email_confirmed_at ? 'admin-status-badge--active' : 'admin-status-badge--pending'}`}
                      >
                        {user.email_confirmed_at ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

// =============================================================================
// Companies Tab
// =============================================================================

function CompaniesTab() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'companies', { page, search }],
    queryFn: () => api.listAdminCompanies({
      page,
      page_size: pageSize,
      ...(search ? { search } : {})
    }),
    staleTime: 30 * 1000,
  });

  const companies = data?.companies ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="admin-tab-panel">
      <div className="admin-tab-header">
        <div>
          <h2 className="admin-section-title">{t('admin.companies.title', 'Company Management')}</h2>
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

      {isLoading ? (
        <div className="admin-table-loading">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      ) : error ? (
        <div className="admin-table-error">
          <AlertCircle className="h-5 w-5" />
          <span>{t('admin.companies.errorLoading', 'Failed to load companies')}</span>
        </div>
      ) : companies.length === 0 ? (
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
                {companies.map((company: AdminCompanyInfo) => (
                  <tr key={company.id}>
                    <td>
                      <div className="admin-company-cell">
                        <Building2 className="h-4 w-4" />
                        <span>{company.name}</span>
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
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

// =============================================================================
// Admins Tab
// =============================================================================

function AdminsTab() {
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.listAdminAdmins(),
    staleTime: 30 * 1000,
  });

  const admins = data?.admins ?? [];

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

      {isLoading ? (
        <div className="admin-table-loading">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      ) : error ? (
        <div className="admin-table-error">
          <AlertCircle className="h-5 w-5" />
          <span>{t('admin.admins.errorLoading', 'Failed to load admins')}</span>
        </div>
      ) : admins.length === 0 ? (
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
              {admins.map((admin: AdminUserInfo) => (
                <tr key={admin.id}>
                  <td>
                    <div className="admin-user-cell">
                      <Shield className="h-4 w-4" />
                      <span>{admin.email}</span>
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
                      <span>{formatDate(admin.granted_at)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Audit Tab (Placeholder)
// =============================================================================

function AuditTab() {
  const { t } = useTranslation();

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

      <div className="admin-placeholder">
        <Activity className="admin-placeholder-icon" />
        <h3>{t('admin.audit.comingSoon', 'Audit Logs Coming Soon')}</h3>
        <p>{t('admin.audit.comingSoonDesc', 'Activity logging and audit trail will be available in a future update.')}</p>
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
        <p>{t('admin.settings.comingSoonDesc', 'Global configuration options will be available in a future update.')}</p>
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
        {t('admin.pagination.showing', 'Showing page {{page}} of {{totalPages}} ({{total}} total)', {
          page,
          totalPages,
          total,
        })}
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
