/**
 * SidebarFooter - User info, dev toggles, and action buttons
 *
 * Extracted from Sidebar.jsx for better maintainability.
 */

import { useTranslation } from 'react-i18next';
import { Briefcase } from 'lucide-react';
import { DEV_MODE } from './hooks';

interface User {
  email: string;
}

interface SidebarFooterProps {
  user: User | null;
  mockMode: boolean | null;
  isTogglingMock: boolean;
  onToggleMockMode: () => void;
  cachingMode: boolean | null;
  isTogglingCaching: boolean;
  onToggleCachingMode: () => void;
  onOpenMyCompany: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onCompanyMouseEnter?: () => void;
  onCompanyMouseLeave?: () => void;
}

export function SidebarFooter({
  user,
  mockMode,
  isTogglingMock,
  onToggleMockMode,
  cachingMode,
  isTogglingCaching,
  onToggleCachingMode,
  onOpenMyCompany,
  onOpenSettings,
  onSignOut,
  // Hover handlers to keep panel open when hovering footer
  onMouseEnter,
  onMouseLeave,
  // Prefetch handlers for instant navigation
  onCompanyMouseEnter,
  onCompanyMouseLeave,
}: SidebarFooterProps) {
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <div className="sidebar-footer" role="presentation" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {/* Mode Toggles - Dev only */}
      {DEV_MODE && (
        <div className="mode-toggle-section">
          <button
            className={`mode-toggle-btn ${mockMode ? 'mock' : 'production'} ${isTogglingMock ? 'toggling' : ''}`}
            onClick={onToggleMockMode}
            disabled={isTogglingMock || mockMode === null}
            title={mockMode ? t('settings.mockModeOn') : t('settings.mockModeOff')}
          >
            <span className="mode-indicator"></span>
            <span className="mode-label">
              {mockMode === null ? '...' : mockMode ? t('settings.mock') : t('settings.production')}
            </span>
          </button>
          <button
            className={`mode-toggle-btn caching ${cachingMode ? 'enabled' : 'disabled'} ${isTogglingCaching ? 'toggling' : ''}`}
            onClick={onToggleCachingMode}
            disabled={isTogglingCaching || cachingMode === null}
            title={cachingMode ? t('settings.cachingOn') : t('settings.cachingOff')}
          >
            <span className="mode-indicator"></span>
            <span className="mode-label">
              {cachingMode === null
                ? '...'
                : cachingMode
                  ? t('settings.cache')
                  : t('settings.noCache')}
            </span>
          </button>
        </div>
      )}

      <div className="user-info">
        <span className="user-email" title={user.email}>
          {user.email}
        </span>
      </div>
      <div className="sidebar-footer-buttons">
        <button
          className="company-btn"
          onClick={onOpenMyCompany}
          onMouseEnter={onCompanyMouseEnter}
          onMouseLeave={onCompanyMouseLeave}
          title={t('sidebar.myCompany')}
        >
          <Briefcase className="h-3.5 w-3.5" />
          {t('mobileNav.company')}
        </button>
        <button
          className="settings-btn"
          onClick={onOpenSettings}
          title={t('sidebar.settingsProfile')}
        >
          {t('sidebar.settings')}
        </button>
        <button className="sign-out-btn" onClick={onSignOut} title={t('sidebar.signOut')}>
          {t('auth.signOut')}
        </button>
      </div>
    </div>
  );
}
