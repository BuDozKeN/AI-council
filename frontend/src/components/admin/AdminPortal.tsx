/**
 * AdminPortal - Full-page platform administration interface
 *
 * This is the shell component that handles auth gates, sidebar navigation,
 * and tab routing. Individual tab content is extracted into separate files:
 * - StatsOverview.tsx
 * - UsersTab.tsx
 * - CompaniesTab.tsx
 * - AdminRolesTab.tsx
 * - AuditTab.tsx
 * - AnalyticsTab.tsx
 * - SettingsTab.tsx
 *
 * Split from 4,246 lines during CRITICAL-2 tech debt remediation.
 */

import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Building2,
  FileText,
  Shield,
  Settings,
  ArrowLeft,
  Loader2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useAdminAccess } from '../../hooks';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Toaster } from '../ui/sonner';
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

// Tab components (extracted during CRITICAL-2 split)
import { StatsOverview } from './StatsOverview';
import { UsersTab } from './UsersTab';
import { CompaniesTab } from './CompaniesTab';
import { AdminRolesTab } from './AdminRolesTab';
import { AuditTab } from './AuditTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SettingsTab } from './SettingsTab';

type AdminTab = 'analytics' | 'users' | 'companies' | 'audit' | 'admins' | 'settings';

const ADMIN_TABS: { id: AdminTab; label: string; icon: typeof Users; path: string }[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
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
            {activeTab === 'admins' && <AdminRolesTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </main>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
